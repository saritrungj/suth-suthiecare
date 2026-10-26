// Counseling appointments a student books with school staff. Times are
// Bangkok wall-clock values ("YYYY-MM-DDTHH:MM"), as the database session runs
// in Bangkok time. A student may only book the staff who look after them: the
// homeroom teachers of their room, the counselors of their grade and the
// mental-health admins of their school.
const { readField } = require("../utils/privateField");
const { sealText, readJson, fieldContext } = require("../utils/privateData");
const { recipientsForStudent } = require("./schoolNotify");

const DEFAULT_TOPICS = [
  "การเรียน",
  "ครอบครัว",
  "เพื่อนและความสัมพันธ์",
  "อารมณ์และความรู้สึก",
  "สุขภาพ",
  "อื่น ๆ",
];
const ACTIVE = ["requested", "confirmed", "rescheduled"];
const STATUSES = Object.freeze({
  requested: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  rescheduled: "เลื่อนเวลา",
  cancelled: "ยกเลิก",
  completed: "พบแล้ว",
  no_show: "ไม่มาตามนัด",
});
const DUTY_LABELS = {
  counselor: "ครูแนะแนว",
  homeroom: "ครูประจำชั้น",
  mental_admin: "งานสุขภาพใจ",
};
const MAX_OPEN_REQUESTS = 2;
const BOOKING_DAYS = 30;

const context = (org) =>
  fieldContext("school_appointments", "payload_encrypted", org);
const bangkokNow = () =>
  new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Bangkok" })
    .slice(0, 16)
    .replace(" ", "T");
const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const validLocal = (value) => {
  if (typeof value !== "string" || !LOCAL.test(value)) return false;
  const d = new Date(`${value}:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 16) === value;
};
const toSql = (local) => `${local.replace("T", " ")}:00`;
const SLOT_TIME = `DATE_FORMAT(sl.starts_at,'%Y-%m-%dT%H:%i') AS starts_at, DATE_FORMAT(sl.ends_at,'%Y-%m-%dT%H:%i') AS ends_at`;
const userName = (u) =>
  readField(u?.name, "users", "name") || u?.username || null;

// Default topics are created the first time a school's topics are read.
async function topicsFor(connection, schoolId, { all = false } = {}) {
  const [[count]] = await connection.query(
    "SELECT COUNT(*) AS n FROM school_appointment_topics WHERE school_id=?",
    [schoolId],
  );
  if (!Number(count.n))
    await connection.query(
      "INSERT INTO school_appointment_topics (school_id,label,sort_order) VALUES ?",
      [DEFAULT_TOPICS.map((label, i) => [schoolId, label, i + 1])],
    );
  const [rows] = await connection.query(
    `SELECT id,label,sort_order,status FROM school_appointment_topics WHERE school_id=?${all ? "" : " AND status='active'"} ORDER BY sort_order,id`,
    [schoolId],
  );
  return rows;
}

// Active roster rows of a signed-in student account.
async function studentsForPatient(connection, patientAccountId) {
  const [rows] = await connection.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.student_code,ss.prefix,ss.first_name_encrypted,ss.last_name_encrypted,
            c.name AS classroom_name,g.name AS grade_name,s.name AS school_name,s.organization_id
       FROM school_students ss
       JOIN schools s ON s.id=ss.school_id
       LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
       LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id
       LEFT JOIN persons p ON p.id=ss.person_id
      WHERE ss.archived_at IS NULL AND ss.status='active'
        AND (ss.patient_account_id=? OR p.patient_account_id=?)
      ORDER BY ss.id`,
    [patientAccountId, patientAccountId],
  );
  return rows;
}

// Staff a student may book, with their duty for the label.
async function staffFor(connection, student) {
  const ids = await recipientsForStudent(connection, student.id, {
    homeroom: true,
    counselors: true,
    mentalAdmins: true,
  });
  if (!ids.length) return [];
  const [rows] = await connection.query(
    `SELECT u.id,u.name,u.username,r.role_code FROM users u
       LEFT JOIN school_staff_roles r ON r.user_id=u.id AND r.school_id=? AND r.status='active'
      WHERE u.id IN (?) ORDER BY u.username`,
    [student.school_id, ids],
  );
  return rows.map((u) => ({
    id: u.id,
    name: userName(u),
    duty: DUTY_LABELS[u.role_code] || "",
  }));
}

// Open future slots with room left, for the given staff in one school.
async function openSlots(
  connection,
  schoolId,
  staffIds,
  { days = BOOKING_DAYS } = {},
) {
  if (!staffIds.length) return [];
  const [rows] = await connection.query(
    `SELECT sl.id,sl.staff_user_id,${SLOT_TIME},sl.capacity,
            (SELECT COUNT(*) FROM school_appointments a WHERE a.slot_id=sl.id AND a.status IN (?)) AS booked
       FROM school_appointment_slots sl
      WHERE sl.school_id=? AND sl.staff_user_id IN (?) AND sl.status='open'
        AND sl.starts_at>NOW() AND sl.starts_at<DATE_ADD(NOW(),INTERVAL ? DAY)
      ORDER BY sl.starts_at,sl.id`,
    [ACTIVE, schoolId, staffIds, days],
  );
  return rows
    .filter((r) => Number(r.booked) < Number(r.capacity))
    .map((r) => ({
      id: r.id,
      staff_user_id: r.staff_user_id,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      remaining: Number(r.capacity) - Number(r.booked),
    }));
}

// Locks a slot and checks it can take one more booking for this staff set.
async function lockSlot(connection, slotId, { schoolId, staffIds }) {
  const [[slot]] = await connection.query(
    `SELECT sl.id,sl.school_id,sl.staff_user_id,sl.capacity,sl.status,${SLOT_TIME},
            sl.starts_at>NOW() AS future
       FROM school_appointment_slots sl WHERE sl.id=? FOR UPDATE`,
    [slotId],
  );
  if (
    !slot ||
    slot.status !== "open" ||
    !Number(slot.future) ||
    Number(slot.school_id) !== Number(schoolId) ||
    !staffIds.includes(Number(slot.staff_user_id))
  )
    return null;
  const [[taken]] = await connection.query(
    "SELECT COUNT(*) AS n FROM school_appointments WHERE slot_id=? AND status IN (?)",
    [slot.id, ACTIVE],
  );
  return Number(taken.n) < Number(slot.capacity) ? slot : null;
}

const APPOINTMENT_SELECT = `SELECT a.*, ${SLOT_TIME}, t.label AS topic_label,
    su.name AS staff_name, su.username AS staff_username,
    ss.student_code, ss.prefix, ss.first_name_encrypted, ss.last_name_encrypted,
    ss.classroom_id, ss.is_boarder, ss.archived_at, ss.school_id AS student_school_id,
    c.name AS classroom_name, g.name AS grade_name, s.organization_id
  FROM school_appointments a
  JOIN schools s ON s.id=a.school_id
  JOIN school_students ss ON ss.id=a.student_id
  LEFT JOIN school_appointment_slots sl ON sl.id=a.slot_id
  LEFT JOIN school_appointment_topics t ON t.id=a.topic_id
  LEFT JOIN users su ON su.id=a.staff_user_id
  LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
  LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id`;

function appointmentView(
  row,
  { org, withNote = true, withStudent = true } = {},
) {
  const payload =
    withNote && row.payload_encrypted != null
      ? readJson(row.payload_encrypted, context(org))
      : {};
  const field = (name) => readField(row[name], "school_students", name, org);
  return {
    id: row.id,
    status: row.status,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    topic_id: row.topic_id,
    topic_label: row.topic_label,
    staff_user_id: row.staff_user_id,
    staff_name: userName({
      name: row.staff_name,
      username: row.staff_username,
    }),
    note: withNote ? payload.note || "" : undefined,
    requested_at: row.requested_at,
    ...(withStudent && {
      student_id: row.student_id,
      student_code: row.student_code,
      student_name:
        [
          row.prefix,
          field("first_name_encrypted"),
          field("last_name_encrypted"),
        ]
          .filter(Boolean)
          .join(" ") || null,
      grade_name: row.grade_name,
      classroom_name: row.classroom_name,
    }),
    guidance_record_id: row.guidance_record_id,
  };
}

// Whether students can book this person at all: the same duties staffFor
// offers to a student (a homeroom duty with a homeroom seat, a counselor,
// or a mental-health admin of the school). Anyone else would open times no
// student is ever shown.
async function offersSlots(connection, userId, schoolId) {
  const [[row]] = await connection.query(
    `SELECT
       EXISTS (SELECT 1 FROM school_staff_roles r
         WHERE r.user_id=? AND r.school_id=? AND r.status='active'
           AND (r.role_code='mental_admin'
             OR (r.role_code='counselor' AND (r.grade_scoped=0 OR EXISTS (
               SELECT 1 FROM school_staff_role_grades g WHERE g.user_id=r.user_id AND g.school_id=r.school_id)))))
       OR EXISTS (SELECT 1 FROM school_staff_roles r
         JOIN school_teachers t ON t.user_id=r.user_id AND t.school_id=r.school_id AND t.status='active'
         JOIN school_classroom_teachers ct ON ct.teacher_id=t.id AND ct.role IN ('homeroom','co_homeroom')
         WHERE r.user_id=? AND r.school_id=? AND r.status='active' AND r.role_code='homeroom') AS ok`,
    [userId, schoolId, userId, schoolId],
  );
  return Boolean(Number(row?.ok));
}

module.exports = {
  ACTIVE,
  STATUSES,
  MAX_OPEN_REQUESTS,
  DEFAULT_TOPICS,
  APPOINTMENT_SELECT,
  SLOT_TIME,
  bangkokNow,
  validLocal,
  toSql,
  topicsFor,
  studentsForPatient,
  staffFor,
  offersSlots,
  openSlots,
  lockSlot,
  appointmentView,
  appointmentContext: context,
  userName,
};
