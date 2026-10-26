// In-app notifications for school staff. Callers pass their own connection so
// a notification is written inside the same transaction as the event that
// caused it. Payloads are encrypted and hold only what the recipient needs.
const { sealText, readJson, fieldContext } = require("../utils/privateData");

const context = (organizationId) =>
  fieldContext("school_notifications", "payload_encrypted", organizationId);

// Active staff of the student's school organization, by duty.
const ACTIVE_STAFF = `JOIN users u ON u.id=r.user_id AND u.status='active'
  JOIN schools s ON s.id=r.school_id
  JOIN organization_memberships om ON om.user_id=u.id AND om.organization_id=s.organization_id AND om.status='active'`;

async function recipientsForStudent(
  conn,
  studentId,
  {
    homeroom = false,
    counselors = false,
    mentalAdmins = false,
    physicalAdmins = false,
  } = {},
) {
  const [[student]] = await conn.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,c.grade_level_id FROM school_students ss
    LEFT JOIN school_classrooms c ON c.id=ss.classroom_id WHERE ss.id=? AND ss.archived_at IS NULL`,
    [studentId],
  );
  if (!student) return [];
  const ids = new Set();
  const add = (rows) => rows.forEach((row) => ids.add(Number(row.user_id)));
  if (homeroom && student.classroom_id) {
    // Same rule as health access: a homeroom duty plus a homeroom seat.
    const [rows] = await conn.query(
      `SELECT DISTINCT r.user_id FROM school_classroom_teachers ct
      JOIN school_teachers t ON t.id=ct.teacher_id AND t.status='active'
      JOIN school_staff_roles r ON r.user_id=t.user_id AND r.school_id=t.school_id AND r.role_code='homeroom' AND r.status='active'
      ${ACTIVE_STAFF}
      WHERE ct.classroom_id=? AND ct.role IN ('homeroom','co_homeroom') AND t.school_id=?`,
      [student.classroom_id, student.school_id],
    );
    add(rows);
  }
  if (counselors) {
    const [rows] = await conn.query(
      `SELECT DISTINCT r.user_id FROM school_staff_roles r ${ACTIVE_STAFF}
      WHERE r.school_id=? AND r.status='active' AND r.role_code='counselor'
        AND (r.grade_scoped=0 OR EXISTS (SELECT 1 FROM school_staff_role_grades g
          WHERE g.user_id=r.user_id AND g.school_id=r.school_id AND g.grade_level_id=?))`,
      [student.school_id, student.grade_level_id || 0],
    );
    add(rows);
  }
  const admins = [
    ...(mentalAdmins ? ["mental_admin"] : []),
    ...(physicalAdmins ? ["physical_admin"] : []),
  ];
  if (admins.length) {
    const [rows] = await conn.query(
      `SELECT DISTINCT r.user_id FROM school_staff_roles r ${ACTIVE_STAFF}
      WHERE r.school_id=? AND r.status='active' AND r.role_code IN (?)`,
      [student.school_id, admins],
    );
    add(rows);
  }
  return [...ids];
}

// Writes one notification per recipient. A repeated dedupeKey for the same
// recipient is ignored, so retried events never notify twice.
async function notify(
  conn,
  {
    organizationId,
    schoolId,
    kind,
    studentId = null,
    sourceType = null,
    sourceId = null,
    recipients,
    payload,
    dedupeKey,
  },
) {
  if (!organizationId || !schoolId || !kind || !dedupeKey)
    throw new Error(
      "notify needs organizationId, schoolId, kind and dedupeKey",
    );
  const unique = [...new Set((recipients || []).map(Number))].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  if (!unique.length) return 0;
  const sealed = sealText(payload || {}, context(organizationId));
  const [result] = await conn.query(
    `INSERT IGNORE INTO school_notifications
      (school_id,recipient_user_id,student_id,kind,source_type,source_id,payload_encrypted,dedupe_key) VALUES ?`,
    [
      unique.map((recipient) => [
        schoolId,
        recipient,
        studentId,
        kind,
        sourceType,
        sourceId,
        sealed,
        String(dedupeKey).slice(0, 120),
      ]),
    ],
  );
  return result.affectedRows;
}

const readPayload = (value, organizationId) =>
  value == null ? {} : readJson(value, context(organizationId));

module.exports = { notify, recipientsForStudent, readPayload };
