// Staff side of counseling appointments: their open slots, the appointments
// booked with them, and the school's topic list. Rights come from the roles
// page (school_appointments.*). A staff member sees the appointments booked
// with them; mental-health admins oversee their whole school.
const express = require("express");
const db = require("../config/db");
const { canHealthAction } = require("../utils/schoolAccess");
const { sealText, fieldContext } = require("../utils/privateData");
const { requiredAudit } = require("../utils/pdpaAudit");
const { notify } = require("../services/schoolNotify");
const appointments = require("../services/schoolAppointments");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const PAGE_SIZES = [10, 20, 50];
const MAX_SLOT_MINUTES = 240;

router.use(
  ["/appointments", "/appointment-slots", "/appointment-topics"],
  (req, res, next) =>
    req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);

const rights = (req) =>
  Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export"].map((a) => [
      a,
      Boolean(
        req.schoolAccess.isSystemAdmin || req.schoolAccess.appointments?.[a],
      ),
    ]),
  );
const oversees = (req, schoolId) =>
  req.schoolAccess.isSystemAdmin ||
  Boolean(req.schoolAccess.mentalAdminSchoolIds?.includes(Number(schoolId)));
const visible = (req, row) =>
  rights(req).view &&
  (Number(row.staff_user_id) === Number(req.user.id) ||
    oversees(req, row.school_id));

async function schoolInUnit(req, schoolId) {
  const [[school]] = await db.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [positiveId(schoolId) || 0, req.organizationContext],
  );
  return school || null;
}

async function inTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ── Topics ──────────────────────────────────────────────────────────────
router.get("/appointment-topics", async (req, res) => {
  if (!rights(req).view && !rights(req).create)
    return fail(res, 403, "ไม่มีสิทธิ์ดูหัวข้อนัดหมาย");
  const school = await schoolInUnit(req, req.query.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  res.json({
    topics: await appointments.topicsFor(db, school.id, { all: true }),
  });
});

// Replaces the topic list: [{ id?, label, status }]. Topics in use are
// deactivated, never deleted, so past appointments keep their label.
router.put("/appointment-topics", async (req, res) => {
  if (!rights(req).update)
    return fail(res, 403, "ไม่มีสิทธิ์แก้ไขหัวข้อนัดหมาย");
  const school = await schoolInUnit(req, req.body?.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const list = req.body?.topics;
  if (
    !Array.isArray(list) ||
    !list.length ||
    list.length > 30 ||
    list.some(
      (t) =>
        typeof t?.label !== "string" ||
        !t.label.trim() ||
        t.label.trim().length > 120 ||
        !["active", "inactive"].includes(t.status || "active") ||
        (t.id != null && !positiveId(t.id)),
    ) ||
    !list.some((t) => (t.status || "active") === "active")
  )
    return fail(
      res,
      422,
      "หัวข้อไม่ถูกต้อง ต้องมีหัวข้อที่เปิดใช้อย่างน้อยหนึ่งหัวข้อ",
    );
  await inTransaction(async (c) => {
    await appointments.topicsFor(c, school.id);
    for (const [i, t] of list.entries()) {
      if (t.id)
        await c.query(
          "UPDATE school_appointment_topics SET label=?,status=?,sort_order=? WHERE id=? AND school_id=?",
          [t.label.trim(), t.status || "active", i + 1, t.id, school.id],
        );
      else
        await c.query(
          "INSERT INTO school_appointment_topics (school_id,label,status,sort_order) VALUES (?,?,?,?)",
          [school.id, t.label.trim(), t.status || "active", i + 1],
        );
    }
    await requiredAudit(
      req,
      "school.appointment_topics.update",
      "school",
      school.id,
      {},
      c,
    );
  });
  res.json({ success: true });
});

// ── Shared schedule (every counselor of the school) ──────────────────────
const schedules = require("../services/schoolAppointmentSchedule");
router.get("/appointment-schedule", async (req, res) => {
  if (!rights(req).view && !rights(req).create)
    return fail(res, 403, "ไม่มีสิทธิ์ดูตารางนัดหมาย");
  const school = await schoolInUnit(req, req.query.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const [[row]] = await db.query(
    "SELECT * FROM school_appointment_schedules WHERE school_id=?",
    [school.id],
  );
  const counselors = await schedules.counselorsOf(db, school.id);
  res.set("Cache-Control", "no-store");
  res.json({
    schedule: schedules.publicSchedule(row),
    counselors: counselors.map((u) => ({
      id: u.id,
      name: appointments.userName(u),
    })),
    can_update: rights(req).update,
    booking_days: schedules.BOOKING_DAYS,
  });
});

// Saves the school's schedule (roles page: appointments "update", like the
// topic list). Future slots it made that no one booked are replaced.
router.put("/appointment-schedule", async (req, res) => {
  if (!rights(req).update)
    return fail(res, 403, "ไม่มีสิทธิ์ตั้งตารางนัดหมายกลาง");
  const school = await schoolInUnit(req, req.body?.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const { value, error } = schedules.validateSchedule(req.body);
  if (error) return fail(res, 422, error);
  const made = await inTransaction(async (c) => {
    await c.query(
      `INSERT INTO school_appointment_schedules (school_id,weekdays,start_time,end_time,slot_minutes,capacity,status,materialized_on,materialized_staff,updated_by)
       VALUES (?,?,?,?,?,?,?,NULL,NULL,?)
       ON DUPLICATE KEY UPDATE weekdays=VALUES(weekdays),start_time=VALUES(start_time),end_time=VALUES(end_time),
         slot_minutes=VALUES(slot_minutes),capacity=VALUES(capacity),status=VALUES(status),
         materialized_on=NULL,materialized_staff=NULL,updated_by=VALUES(updated_by)`,
      [
        school.id,
        value.weekdays.join(","),
        value.start_time,
        value.end_time,
        value.slot_minutes,
        value.capacity,
        value.status,
        req.user.id,
      ],
    );
    await schedules.withdrawUnbooked(c, school.id);
    const count =
      value.status === "active"
        ? await schedules.materialize(c, school.id, { force: true })
        : 0;
    await requiredAudit(
      req,
      "school.appointment_schedule.update",
      "school",
      school.id,
      { status: value.status, count },
      c,
    );
    return count;
  });
  res.json({ success: true, slots_made: made });
});

// ── Slots (always the caller's own) ─────────────────────────────────────
router.get("/appointment-slots", async (req, res) => {
  if (!rights(req).create && !rights(req).view)
    return fail(res, 403, "ไม่มีสิทธิ์ดูช่วงเวลานัดหมาย");
  // Counselors see the slots the school schedule made for them too.
  if (req.query.school_id) {
    const school = await schoolInUnit(req, req.query.school_id);
    if (school) await schedules.ensureSlots(db, school.id);
  }
  const [rows] = await db.query(
    `SELECT sl.id,sl.school_id,${appointments.SLOT_TIME},sl.capacity,sl.status,
            (sl.schedule_school_id IS NOT NULL) AS from_schedule,
            (SELECT COUNT(*) FROM school_appointments a WHERE a.slot_id=sl.id AND a.status IN (?)) AS booked
       FROM school_appointment_slots sl JOIN schools s ON s.id=sl.school_id AND s.organization_id=?
      WHERE sl.staff_user_id=? AND sl.ends_at>DATE_SUB(NOW(),INTERVAL 1 DAY)
      ORDER BY sl.starts_at,sl.id LIMIT 300`,
    [appointments.ACTIVE, req.organizationContext, req.user.id],
  );
  // Tell the page up front when students could never book these times.
  const school = req.query.school_id
    ? await schoolInUnit(req, req.query.school_id)
    : null;
  res.set("Cache-Control", "no-store");
  res.json({
    slots: rows.map((r) => ({
      ...r,
      booked: Number(r.booked),
      from_schedule: Boolean(Number(r.from_schedule)),
    })),
    bookable: school
      ? await appointments.offersSlots(db, req.user.id, school.id)
      : null,
  });
});

const NOT_BOOKABLE =
  "นักเรียนจะจองเวลานี้ไม่ได้ เพราะบัญชีนี้ไม่ได้เป็นครูประจำชั้น ครูแนะแนว หรือแอดมินสุขภาพจิตของโรงเรียน กำหนดหน้าที่ได้ที่หน้าบุคลากรและผู้ปกครอง";

router.post("/appointment-slots", async (req, res) => {
  if (!rights(req).create)
    return fail(res, 403, "ไม่มีสิทธิ์เปิดช่วงเวลานัดหมาย");
  const b = req.body || {};
  const school = await schoolInUnit(req, b.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  if (!(await appointments.offersSlots(db, req.user.id, school.id)))
    return fail(res, 422, NOT_BOOKABLE);
  const weeks = b.repeat_weeks == null ? 1 : Number(b.repeat_weeks);
  const capacity = b.capacity == null ? 1 : Number(b.capacity);
  if (
    !appointments.validLocal(b.starts_at) ||
    !appointments.validLocal(b.ends_at) ||
    b.ends_at <= b.starts_at ||
    b.starts_at <= appointments.bangkokNow() ||
    (new Date(`${b.ends_at}:00Z`) - new Date(`${b.starts_at}:00Z`)) / 60000 >
      MAX_SLOT_MINUTES ||
    !Number.isInteger(weeks) ||
    weeks < 1 ||
    weeks > 8 ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 10
  )
    return fail(
      res,
      422,
      "ช่วงเวลาต้องอยู่ในอนาคต ยาวไม่เกิน 4 ชั่วโมง รับได้ 1–10 คน และซ้ำได้ไม่เกิน 8 สัปดาห์",
    );
  const shift = (local, days) => {
    const d = new Date(`${local}:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 16);
  };
  const ids = await inTransaction(async (c) => {
    const created = [];
    for (let w = 0; w < weeks; w++) {
      const start = shift(b.starts_at, 7 * w),
        end = shift(b.ends_at, 7 * w);
      const [[overlap]] = await c.query(
        "SELECT id FROM school_appointment_slots WHERE staff_user_id=? AND status='open' AND starts_at<? AND ends_at>? LIMIT 1",
        [req.user.id, appointments.toSql(end), appointments.toSql(start)],
      );
      if (overlap)
        throw Object.assign(
          new Error(
            `ช่วงเวลา ${start.replace("T", " ")} ซ้อนกับช่วงเวลาที่เปิดไว้แล้ว`,
          ),
          {
            status: 409,
          },
        );
      const [r] = await c.query(
        "INSERT INTO school_appointment_slots (school_id,staff_user_id,starts_at,ends_at,capacity) VALUES (?,?,?,?,?)",
        [
          school.id,
          req.user.id,
          appointments.toSql(start),
          appointments.toSql(end),
          capacity,
        ],
      );
      created.push(r.insertId);
    }
    return created;
  }).catch((error) => {
    if (error.status === 409) return error;
    throw error;
  });
  if (ids instanceof Error) return fail(res, 409, ids.message);
  res.status(201).json({ ids });
});

// Closing keeps the slot for history; one with an active booking stays open.
router.delete("/appointment-slots/:id", async (req, res) => {
  if (!rights(req).create)
    return fail(res, 403, "ไม่มีสิทธิ์ปิดช่วงเวลานัดหมาย");
  const [[slot]] = await db.query(
    `SELECT sl.id,(SELECT COUNT(*) FROM school_appointments a WHERE a.slot_id=sl.id AND a.status IN (?)) AS booked
       FROM school_appointment_slots sl WHERE sl.id=? AND sl.staff_user_id=?`,
    [appointments.ACTIVE, positiveId(req.params.id) || 0, req.user.id],
  );
  if (!slot) return fail(res, 404, "ไม่พบช่วงเวลา");
  if (Number(slot.booked))
    return fail(
      res,
      409,
      "มีนักเรียนจองช่วงเวลานี้อยู่ เลื่อนหรือยกเลิกนัดก่อนปิดช่วงเวลา",
    );
  await db.query(
    "UPDATE school_appointment_slots SET status='closed' WHERE id=?",
    [slot.id],
  );
  res.json({ success: true });
});

// ── Appointments ────────────────────────────────────────────────────────
router.get("/appointments", async (req, res) => {
  if (!rights(req).view) return fail(res, 403, "ไม่มีสิทธิ์ดูนัดหมาย");
  const where = ["s.organization_id=?"],
    params = [req.organizationContext];
  if (appointments.STATUSES[req.query.status]) {
    where.push("a.status=?");
    params.push(req.query.status);
  } else if (req.query.status === "active") {
    where.push("a.status IN (?)");
    params.push(appointments.ACTIVE);
  }
  if (req.query.scope === "mine") {
    where.push("a.staff_user_id=?");
    params.push(req.user.id);
  }
  if (positiveId(req.query.student_id)) {
    where.push("a.student_id=?");
    params.push(Number(req.query.student_id));
  }
  const [rows] = await db.query(
    `${appointments.APPOINTMENT_SELECT} WHERE ${where.join(" AND ")} ORDER BY sl.starts_at IS NULL, sl.starts_at, a.id LIMIT 2000`,
    params,
  );
  const search = String(req.query.q || "")
    .trim()
    .toLocaleLowerCase();
  const items = rows
    .filter((row) => visible(req, row))
    .map((row) =>
      appointments.appointmentView(row, { org: req.organizationContext }),
    )
    .filter(
      (item) =>
        !search ||
        `${item.student_code} ${item.student_name || ""} ${item.staff_name || ""} ${item.topic_label || ""}`
          .toLocaleLowerCase()
          .includes(search),
    );
  if (req.query.format === "csv") {
    if (!rights(req).export) return fail(res, 403, "ไม่มีสิทธิ์ส่งออกนัดหมาย");
    await requiredAudit(req, "school_appointments.export", "school", null, {
      count: items.length,
    });
    // The student's own note stays out of exports.
    return require("../utils/sendCsv").sendCsv(
      res,
      "นัดหมายรับคำปรึกษา.csv",
      [
        "เริ่ม",
        "สิ้นสุด",
        "รหัสนักเรียน",
        "ชื่อ",
        "ชั้น/ห้อง",
        "เรื่อง",
        "ผู้ให้คำปรึกษา",
        "สถานะ",
      ],
      items.map((a) => [
        String(a.starts_at || "").replace("T", " "),
        String(a.ends_at || "").replace("T", " "),
        a.student_code,
        a.student_name,
        [a.grade_name, a.classroom_name].filter(Boolean).join("/"),
        a.topic_label,
        a.staff_name,
        appointments.STATUSES[a.status] || a.status,
      ]),
    );
  }
  const limit = PAGE_SIZES.includes(Number(req.query.limit))
    ? Number(req.query.limit)
    : 10;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  res.set("Cache-Control", "no-store");
  res.json({
    data: items.slice((page - 1) * limit, page * limit),
    pagination: {
      total: items.length,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(items.length / limit)),
    },
    statuses: appointments.STATUSES,
    oversees:
      req.schoolAccess.isSystemAdmin ||
      Boolean(req.schoolAccess.mentalAdminSchoolIds?.length),
  });
});

async function loadVisible(req, connection = db) {
  const [[row]] = await connection.query(
    `${appointments.APPOINTMENT_SELECT} WHERE a.id=? AND s.organization_id=?`,
    [positiveId(req.params.id) || 0, req.organizationContext],
  );
  return row && visible(req, row) ? row : null;
}
const studentOf = (row) => ({
  id: row.student_id,
  school_id: row.student_school_id,
  classroom_id: row.classroom_id,
  is_boarder: row.is_boarder,
  archived_at: row.archived_at,
});

router.get("/appointments/:id", async (req, res) => {
  const row = await loadVisible(req);
  if (!row) return fail(res, 404, "ไม่พบนัดหมาย");
  const r = rights(req);
  const staff = await appointments.staffFor(db, {
    id: row.student_id,
    school_id: row.school_id,
  });
  const slots = await appointments.openSlots(
    db,
    row.school_id,
    staff.map((s) => s.id),
  );
  res.set("Cache-Control", "no-store");
  res.json({
    ...appointments.appointmentView(row, { org: req.organizationContext }),
    // Another time with the same staff, or (assign) with another of the student's staff.
    reschedule_slots: r.update
      ? slots.filter(
          (s) => s.staff_user_id === row.staff_user_id && s.id !== row.slot_id,
        )
      : [],
    transfer_options: r.assign
      ? staff
          .filter((s) => s.id !== row.staff_user_id)
          .map((s) => ({
            ...s,
            slots: slots.filter((slot) => slot.staff_user_id === s.id),
          }))
          .filter((s) => s.slots.length)
      : [],
    can_record_guidance: canHealthAction(
      req.schoolAccess,
      "create",
      studentOf(row),
    ),
  });
});

const ACTIONS = {
  confirm: {
    right: "update",
    from: ["requested", "rescheduled"],
    to: "confirmed",
  },
  reschedule: { right: "update", from: appointments.ACTIVE, to: "rescheduled" },
  transfer: { right: "assign", from: appointments.ACTIVE, to: "requested" },
  complete: { right: "update", from: appointments.ACTIVE, to: "completed" },
  no_show: { right: "update", from: appointments.ACTIVE, to: "no_show" },
  cancel: { right: "delete", from: appointments.ACTIVE, to: "cancelled" },
};
const validDate = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

router.put("/appointments/:id", async (req, res) => {
  const action = ACTIONS[req.body?.action];
  if (!action) return fail(res, 422, "การดำเนินการไม่ถูกต้อง");
  if (!rights(req)[action.right])
    return fail(res, 403, "ไม่มีสิทธิ์ดำเนินการกับนัดหมายนี้");
  const row = await loadVisible(req);
  if (!row) return fail(res, 404, "ไม่พบนัดหมาย");
  if (!action.from.includes(row.status))
    return fail(res, 409, "สถานะนัดหมายนี้เปลี่ยนแบบนี้ไม่ได้แล้ว");
  const b = req.body;
  const outcome = b.outcome;
  if (
    req.body.action === "complete" &&
    outcome &&
    (typeof outcome.issue !== "string" ||
      !outcome.issue.trim() ||
      outcome.issue.length > 4000 ||
      (outcome.support != null &&
        (typeof outcome.support !== "string" ||
          outcome.support.length > 4000)) ||
      (outcome.follow_up_at && !validDate(outcome.follow_up_at)))
  )
    return fail(res, 422, "กรุณาระบุเรื่องที่พูดคุยในบันทึกการให้คำปรึกษา");
  if (
    req.body.action === "complete" &&
    outcome &&
    !canHealthAction(req.schoolAccess, "create", studentOf(row))
  )
    return fail(res, 403, "ไม่มีสิทธิ์บันทึกการให้คำปรึกษาของนักเรียนคนนี้");
  try {
    await inTransaction(async (c) => {
      const changes = { status: action.to };
      if (["reschedule", "transfer"].includes(req.body.action)) {
        const staff = await appointments.staffFor(c, {
          id: row.student_id,
          school_id: row.school_id,
        });
        const allowed =
          req.body.action === "reschedule"
            ? [Number(row.staff_user_id)]
            : staff
                .map((s) => s.id)
                .filter((id) => id !== Number(row.staff_user_id));
        const slot = await appointments.lockSlot(
          c,
          positiveId(b.slot_id) || 0,
          {
            schoolId: row.school_id,
            staffIds: allowed,
          },
        );
        if (!slot)
          throw Object.assign(
            new Error("เวลานี้ไม่ว่างแล้ว กรุณาเลือกเวลาอื่น"),
            { status: 409 },
          );
        changes.slot_id = slot.id;
        changes.staff_user_id = slot.staff_user_id;
        changes.when = slot.starts_at;
      }
      if (req.body.action === "confirm") changes.confirmed_at = true;
      if (req.body.action === "cancel") changes.cancelled_by = req.user.id;
      if (req.body.action === "complete" && outcome) {
        const [g] = await c.query(
          "INSERT INTO school_guidance_records (student_id,recorded_at,follow_up_at,payload_encrypted,recorded_by) VALUES (?,?,?,?,?)",
          [
            row.student_id,
            new Date().toLocaleDateString("sv-SE", {
              timeZone: "Asia/Bangkok",
            }),
            outcome.follow_up_at || null,
            sealText(
              {
                issue: outcome.issue.trim(),
                support: (outcome.support || "").trim() || null,
              },
              fieldContext(
                "school_guidance_records",
                "payload_encrypted",
                req.organizationContext,
              ),
            ),
            req.user.id,
          ],
        );
        changes.guidance_record_id = g.insertId;
      }
      await c.query(
        `UPDATE school_appointments SET status=?${changes.slot_id ? ",slot_id=?,staff_user_id=?" : ""}${changes.confirmed_at ? ",confirmed_at=NOW()" : ""}${changes.cancelled_by ? ",cancelled_by=?" : ""}${changes.guidance_record_id ? ",guidance_record_id=?" : ""} WHERE id=?`,
        [
          changes.status,
          ...(changes.slot_id ? [changes.slot_id, changes.staff_user_id] : []),
          ...(changes.cancelled_by ? [changes.cancelled_by] : []),
          ...(changes.guidance_record_id ? [changes.guidance_record_id] : []),
          row.id,
        ],
      );
      if (req.body.action === "transfer")
        await notify(c, {
          organizationId: req.organizationContext,
          schoolId: row.school_id,
          kind: "appointment",
          studentId: row.student_id,
          sourceType: "appointment",
          sourceId: row.id,
          recipients: [changes.staff_user_id],
          payload: {
            title: "ได้รับโอนนัดรับคำปรึกษา",
            body: `${row.student_code} · ${String(changes.when).replace("T", " ")} · ${row.topic_label || ""}`,
          },
          dedupeKey: `appointment:${row.id}:transfer:${changes.slot_id}`,
        });
      await requiredAudit(
        req,
        `school_appointments.${req.body.action}`,
        "student",
        row.student_id,
        { appointment_id: row.id, status: changes.status },
        c,
      );
    });
  } catch (error) {
    if (error.status === 409) return fail(res, 409, error.message);
    throw error;
  }
  res.json({ success: true });
});

module.exports = router;
