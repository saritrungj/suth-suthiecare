// Change history of one student, for the student file: the roles page
// audit.view right plus the student in scope. Covers records about the
// student and their physical-check records; reads are left out.
const express = require("express");
const db = require("../config/db");
const { canSeeStudent } = require("../utils/schoolAccess");
const { rowView, SELECT, READ_SQL } = require("./auditRoutes");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });

router.get("/students/:id/audit", async (req, res) => {
  if (!req.schoolAccess) return fail(res, 422, "กรุณาเลือกโรงเรียน");
  if (!(
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has("audit.view")
  ))
    return fail(res, 403, "ไม่มีสิทธิ์ดูประวัติการแก้ไข");
  const [[student]] = await db.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.is_boarder,ss.archived_at FROM school_students ss
       JOIN schools s ON s.id=ss.school_id WHERE ss.id=? AND s.organization_id=?`,
    [
      /^\d+$/.test(req.params.id) ? Number(req.params.id) : 0,
      req.organizationContext,
    ],
  );
  if (!student || !canSeeStudent(req.schoolAccess, student))
    return fail(res, 404, "ไม่พบนักเรียนในขอบเขตสิทธิ์");
  const [records] = await db.query(
    "SELECT id FROM school_student_physical_records WHERE student_id=?",
    [student.id],
  );
  const recordIds = records.map((r) => String(r.id));
  const [rows] = await db.query(
    `${SELECT} WHERE l.organization_id=? AND NOT ${READ_SQL}
       AND ((l.target_type IN ('student','student_health_profile','student_password_reset') AND l.target_id=?)
         ${recordIds.length ? "OR (l.target_type='student_physical_record' AND l.target_id IN (?))" : ""})
     ORDER BY l.id DESC LIMIT 200`,
    [
      req.organizationContext,
      String(student.id),
      ...(recordIds.length ? [recordIds] : []),
    ],
  );
  res.set("Cache-Control", "no-store");
  res.json({ data: rows.map(rowView) });
});

module.exports = router;
