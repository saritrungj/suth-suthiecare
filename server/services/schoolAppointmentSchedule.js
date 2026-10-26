// The shared counseling schedule of a school: on the chosen weekdays, between
// a start and end time, every counselor of the school offers slots students
// can book. Real slots are made ahead (BOOKING_DAYS) in school_appointment_slots
// with schedule_school_id set, so booking, confirming and cancelling work
// exactly as for slots a teacher opens by hand.
//
// - A made slot a counselor closes (a holiday, a meeting) is never made again.
// - A time already covered by one of the counselor's own open slots is skipped.
// - Changing or switching off the schedule closes the future made slots no one
//   has booked; booked ones stay.
// Making slots runs at most once a day per school unless the schedule or the
// school's counselors change.

const BOOKING_DAYS = 30;
const DEFAULT_SCHEDULE = Object.freeze({
  weekdays: [1, 2, 3, 4, 5],
  start_time: "16:20",
  end_time: "17:00",
  slot_minutes: 40,
  capacity: 1,
  status: "active",
});
const ACTIVE = ["requested", "confirmed", "rescheduled"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const hhmm = (value) => String(value || "").slice(0, 5);
const minutesOf = (value) => {
  const [h, m] = hhmm(value).split(":").map(Number);
  return h * 60 + m;
};
const pad = (n) => String(n).padStart(2, "0");
const clock = (minutes) =>
  `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const bangkokNow = () =>
  new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
    .slice(0, 16)
    .replace(" ", "T");
const addDays = (day, n) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// ISO weekday of a YYYY-MM-DD: Monday 1 ... Sunday 7.
const weekdayOf = (day) => {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return w === 0 ? 7 : w;
};

// Validates a schedule from the request body. Returns { value } or { error }.
function validateSchedule(body = {}) {
  const weekdays = [
    ...new Set(Array.isArray(body.weekdays) ? body.weekdays.map(Number) : []),
  ].sort();
  const start = hhmm(body.start_time);
  const end = hhmm(body.end_time);
  const slot = Number(body.slot_minutes);
  const capacity = Number(body.capacity);
  const status = body.status || "active";
  if (
    !weekdays.length ||
    weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7) ||
    !TIME.test(start) ||
    !TIME.test(end) ||
    minutesOf(end) <= minutesOf(start) ||
    minutesOf(end) - minutesOf(start) > 240 ||
    !Number.isInteger(slot) ||
    slot < 10 ||
    slot > minutesOf(end) - minutesOf(start) ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 10 ||
    !["active", "inactive"].includes(status)
  )
    return {
      error:
        "เลือกวันอย่างน้อยหนึ่งวัน เวลาเริ่มต้องก่อนเวลาสิ้นสุด (ไม่เกิน 4 ชั่วโมง) ช่วงละ 10 นาทีขึ้นไป และรับได้ 1–10 คน",
    };
  return {
    value: {
      weekdays,
      start_time: start,
      end_time: end,
      slot_minutes: slot,
      capacity,
      status,
    },
  };
}

// The slot times one schedule gives on one day: [{ start, end }] in "HH:MM".
function slotTimes(schedule) {
  const out = [];
  const start = minutesOf(schedule.start_time);
  const end = minutesOf(schedule.end_time);
  for (
    let t = start;
    t + schedule.slot_minutes <= end;
    t += schedule.slot_minutes
  )
    out.push({ start: clock(t), end: clock(t + schedule.slot_minutes) });
  return out;
}

const publicSchedule = (row) =>
  row
    ? {
        exists: true,
        weekdays: String(row.weekdays).split(",").map(Number).filter(Boolean),
        start_time: hhmm(row.start_time),
        end_time: hhmm(row.end_time),
        slot_minutes: Number(row.slot_minutes),
        capacity: Number(row.capacity),
        status: row.status,
      }
    : { exists: false, ...DEFAULT_SCHEDULE, status: "inactive" };

// Active counselors of the school (grade-scoped ones too: students only see
// the counselors of their own grade when booking).
async function counselorsOf(connection, schoolId) {
  const [rows] = await connection.query(
    `SELECT DISTINCT u.id,u.username,u.name FROM school_staff_roles r
       JOIN users u ON u.id=r.user_id AND u.status='active'
       JOIN schools s ON s.id=r.school_id
       JOIN organization_memberships om ON om.user_id=u.id AND om.organization_id=s.organization_id AND om.status='active'
      WHERE r.school_id=? AND r.status='active' AND r.role_code='counselor'
      ORDER BY u.username`,
    [schoolId],
  );
  return rows;
}

// Closes the future slots made from this school's schedule that no one has
// booked, and detaches them so a new schedule can make the same times again.
async function withdrawUnbooked(connection, schoolId) {
  await connection.query(
    `UPDATE school_appointment_slots sl SET sl.status='closed', sl.schedule_school_id=NULL
      WHERE sl.schedule_school_id=? AND sl.status='open' AND sl.starts_at>NOW()
        AND NOT EXISTS (SELECT 1 FROM school_appointments a WHERE a.slot_id=sl.id AND a.status IN (?))`,
    [schoolId, ACTIVE],
  );
}

// Makes the missing slots for the next BOOKING_DAYS. Must run inside a
// transaction: the schedule row is locked so two requests never make the
// same slot twice. `force` skips the once-a-day shortcut.
async function materialize(connection, schoolId, { force = false } = {}) {
  const [[row]] = await connection.query(
    "SELECT * FROM school_appointment_schedules WHERE school_id=? FOR UPDATE",
    [schoolId],
  );
  if (!row || row.status !== "active") return 0;
  const counselors = await counselorsOf(connection, schoolId);
  const staffKey = counselors.map((c) => c.id).join(",");
  const now = bangkokNow();
  const today = now.slice(0, 10);
  const madeOn = row.materialized_on
    ? new Date(row.materialized_on).toLocaleDateString("sv-SE", {
        timeZone: "Asia/Bangkok",
      })
    : null;
  if (!force && madeOn === today && (row.materialized_staff || "") === staffKey)
    return 0;
  const schedule = publicSchedule(row);
  const times = slotTimes(schedule);
  const until = addDays(today, BOOKING_DAYS);
  const wanted = [];
  for (let day = today; day <= until; day = addDays(day, 1)) {
    if (!schedule.weekdays.includes(weekdayOf(day))) continue;
    for (const t of times) {
      const start = `${day}T${t.start}`;
      if (start <= now) continue;
      wanted.push({ start, end: `${day}T${t.end}` });
    }
  }
  let made = 0;
  if (counselors.length && wanted.length) {
    // What already covers these times: a counselor's own open slot, or any
    // slot made from this schedule (a closed one is a day off).
    const [existing] = await connection.query(
      `SELECT staff_user_id,DATE_FORMAT(starts_at,'%Y-%m-%dT%H:%i') AS starts_at,DATE_FORMAT(ends_at,'%Y-%m-%dT%H:%i') AS ends_at
         FROM school_appointment_slots
        WHERE staff_user_id IN (?) AND ends_at>NOW() AND starts_at<?
          AND (status='open' OR schedule_school_id=?)`,
      [counselors.map((c) => c.id), `${until} 23:59:59`, schoolId],
    );
    const rows = [];
    for (const c of counselors)
      for (const w of wanted) {
        const taken = existing.some(
          (e) =>
            Number(e.staff_user_id) === Number(c.id) &&
            e.starts_at < w.end &&
            e.ends_at > w.start,
        );
        if (!taken)
          rows.push([
            schoolId,
            c.id,
            `${w.start.replace("T", " ")}:00`,
            `${w.end.replace("T", " ")}:00`,
            schedule.capacity,
            schoolId,
          ]);
      }
    if (rows.length) {
      await connection.query(
        "INSERT INTO school_appointment_slots (school_id,staff_user_id,starts_at,ends_at,capacity,schedule_school_id) VALUES ?",
        [rows],
      );
      made = rows.length;
    }
  }
  await connection.query(
    "UPDATE school_appointment_schedules SET materialized_on=?,materialized_staff=? WHERE school_id=?",
    [today, staffKey.slice(0, 500), schoolId],
  );
  return made;
}

// Runs materialize in its own transaction; a failure never blocks the page
// that asked (the student still sees the slots made before).
async function ensureSlots(db, schoolId) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await materialize(connection, schoolId);
    await connection.commit();
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error(
      "Appointment schedule failed:",
      error.code || error.message || error,
    );
  } finally {
    connection.release();
  }
}

module.exports = {
  BOOKING_DAYS,
  DEFAULT_SCHEDULE,
  validateSchedule,
  slotTimes,
  weekdayOf,
  publicSchedule,
  counselorsOf,
  withdrawUnbooked,
  materialize,
  ensureSlots,
};
