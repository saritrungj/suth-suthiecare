// A signed-in student books counseling with the school staff who look after
// them, follows the status and can cancel. Mounted under /api/patient.
const express = require("express");
const db = require("../config/db");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const { sealText } = require("../utils/privateData");
const { notify } = require("../services/schoolNotify");
const appointments = require("../services/schoolAppointments");
const router = express.Router();
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });
const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;

router.use("/school-appointments", verifyPatientToken);

const studentName = (row) =>
  [
    row.prefix,
    require("../utils/privateField").readField(
      row.first_name_encrypted,
      "school_students",
      "first_name_encrypted",
      row.organization_id,
    ),
    require("../utils/privateField").readField(
      row.last_name_encrypted,
      "school_students",
      "last_name_encrypted",
      row.organization_id,
    ),
  ]
    .filter(Boolean)
    .join(" ");

// The student's own appointments, newest first. Staff notes never come back.
router.get("/school-appointments", async (req, res) => {
  const students = await appointments.studentsForPatient(db, req.patient.id);
  if (!students.length)
    return res.json({ success: true, eligible: false, appointments: [] });
  const [rows] = await db.query(
    `${appointments.APPOINTMENT_SELECT} WHERE a.student_id IN (?) ORDER BY sl.starts_at IS NULL, sl.starts_at DESC, a.id DESC LIMIT 100`,
    [students.map((s) => s.id)],
  );
  res.set("Cache-Control", "no-store");
  res.json({
    success: true,
    eligible: true,
    statuses: appointments.STATUSES,
    appointments: rows.map((row) => ({
      ...appointments.appointmentView(row, {
        org: row.organization_id,
        withStudent: false,
      }),
      can_cancel:
        appointments.ACTIVE.includes(row.status) &&
        Boolean(row.starts_at) &&
        row.starts_at > appointments.bangkokNow(),
    })),
  });
});

// What the student can choose: topics, their staff and those staff's open slots.
router.get("/school-appointments/options", async (req, res) => {
  const students = await appointments.studentsForPatient(db, req.patient.id);
  const result = [];
  for (const student of students) {
    // Slots from the school's shared schedule are made before they are read.
    await require("../services/schoolAppointmentSchedule").ensureSlots(
      db,
      student.school_id,
    );
    const staff = await appointments.staffFor(db, student);
    const slots = await appointments.openSlots(
      db,
      student.school_id,
      staff.map((s) => s.id),
    );
    result.push({
      student_id: student.id,
      school_name: student.school_name,
      topics: await appointments.topicsFor(db, student.school_id),
      staff: staff
        .map((s) => ({
          ...s,
          slots: slots
            .filter((slot) => slot.staff_user_id === s.id)
            .map(({ id, starts_at, ends_at }) => ({ id, starts_at, ends_at })),
        }))
        .filter((s) => s.slots.length),
    });
  }
  res.set("Cache-Control", "no-store");
  res.json({ success: true, students: result });
});

router.post("/school-appointments", async (req, res) => {
  const b = req.body || {};
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (!positiveId(b.slot_id) || !positiveId(b.topic_id) || note.length > 1000)
    return fail(res, 422, "กรุณาเลือกเรื่อง ผู้ให้คำปรึกษา และเวลา");
  const student = (
    await appointments.studentsForPatient(db, req.patient.id)
  ).find((s) => s.id === Number(b.student_id) || !b.student_id);
  if (!student) return fail(res, 404, "ไม่พบข้อมูลนักเรียนของบัญชีนี้");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [[open]] = await connection.query(
      "SELECT COUNT(*) AS n FROM school_appointments a JOIN school_appointment_slots sl ON sl.id=a.slot_id WHERE a.student_id=? AND a.status IN (?) AND sl.starts_at>NOW() FOR UPDATE",
      [student.id, appointments.ACTIVE],
    );
    if (Number(open.n) >= appointments.MAX_OPEN_REQUESTS) {
      await connection.rollback();
      return fail(
        res,
        409,
        `มีนัดหมายที่ยังไม่ถึงเวลา ${appointments.MAX_OPEN_REQUESTS} รายการแล้ว ยกเลิกนัดเดิมก่อนขอนัดใหม่`,
      );
    }
    const [[topic]] = await connection.query(
      "SELECT id,label FROM school_appointment_topics WHERE id=? AND school_id=? AND status='active'",
      [Number(b.topic_id), student.school_id],
    );
    const staff = await appointments.staffFor(connection, student);
    const slot =
      topic &&
      (await appointments.lockSlot(connection, Number(b.slot_id), {
        schoolId: student.school_id,
        staffIds: staff.map((s) => s.id),
      }));
    if (!slot) {
      await connection.rollback();
      return fail(res, 409, "เวลานี้ไม่ว่างแล้ว กรุณาเลือกเวลาอื่น");
    }
    const [result] = await connection.query(
      "INSERT INTO school_appointments (school_id,student_id,staff_user_id,slot_id,topic_id,payload_encrypted,status) VALUES (?,?,?,?,?,?,'requested')",
      [
        student.school_id,
        student.id,
        slot.staff_user_id,
        slot.id,
        topic.id,
        note
          ? sealText(
              { note },
              appointments.appointmentContext(student.organization_id),
            )
          : null,
      ],
    );
    await notify(connection, {
      organizationId: student.organization_id,
      schoolId: student.school_id,
      kind: "appointment",
      studentId: student.id,
      sourceType: "appointment",
      sourceId: result.insertId,
      recipients: [slot.staff_user_id],
      payload: {
        title: "นักเรียนขอนัดรับคำปรึกษา",
        body: `${student.student_code} ${studentName(student)} · ${slot.starts_at.replace("T", " ")} · ${topic.label}`,
      },
      dedupeKey: `appointment:${result.insertId}:requested`,
    });
    await connection.commit();
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.post("/school-appointments/:id/cancel", async (req, res) => {
  const students = await appointments.studentsForPatient(db, req.patient.id);
  const [[row]] = await db.query(
    `${appointments.APPOINTMENT_SELECT} WHERE a.id=? AND a.student_id IN (?)`,
    [
      positiveId(req.params.id) || 0,
      students.length ? students.map((s) => s.id) : [0],
    ],
  );
  if (!row) return fail(res, 404, "ไม่พบนัดหมาย");
  if (
    !appointments.ACTIVE.includes(row.status) ||
    !(row.starts_at > appointments.bangkokNow())
  )
    return fail(res, 409, "นัดหมายนี้ยกเลิกไม่ได้แล้ว");
  const student = students.find((s) => s.id === row.student_id);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE school_appointments SET status='cancelled',cancelled_by=NULL WHERE id=?",
      [row.id],
    );
    await notify(connection, {
      organizationId: row.organization_id,
      schoolId: row.school_id,
      kind: "appointment",
      studentId: row.student_id,
      sourceType: "appointment",
      sourceId: row.id,
      recipients: [row.staff_user_id],
      payload: {
        title: "นักเรียนยกเลิกนัดหมาย",
        body: `${row.student_code} ${studentName({ ...student, organization_id: row.organization_id })} · ${String(row.starts_at || "").replace("T", " ")}`,
      },
      dedupeKey: `appointment:${row.id}:cancelled`,
    });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  res.json({ success: true });
});

module.exports = router;
