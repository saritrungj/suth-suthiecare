// One definition of school duties (school_staff_roles.role_code) shared by the
// Add User modal (PUT /users/:id/assignments) and the school staff page
// (PUT /school/staff-roles), so both accept the same codes for the same people.
const SCHOOL_ROLE_LABELS = Object.freeze({
  admin: "ผู้ดูแลข้อมูลทั่วไป",
  mental_admin: "แอดมินสุขภาพจิต",
  physical_admin: "แอดมินสุขภาพกาย",
  counselor: "ครูแนะแนว",
  homeroom: "ครูประจำชั้น",
  subject_teacher: "ครูรายวิชา",
  other: "ครูทั่วไป",
  dorm_staff: "เจ้าหน้าที่หอพัก",
});
const GUARDIAN_ROLE_CODE = "guardian";
const TEACHER_ROLE_CODES = new Set([
  "counselor",
  "homeroom",
  "subject_teacher",
  "other",
]);
const STAFF_ROLE_CODES = new Set([
  "admin",
  "mental_admin",
  "physical_admin",
  "dorm_staff",
]);
const MAX_GRADES = 50;

// personnelKind is "teacher" (has a school_teachers row) or "staff".
function roleMatchesKind(roleCode, personnelKind) {
  return personnelKind === "teacher"
    ? TEACHER_ROLE_CODES.has(roleCode)
    : STAFF_ROLE_CODES.has(roleCode);
}

// A counselor's grades: undefined = leave as saved, null = the whole school,
// a non-empty list = only those grades.
function normalizeGradeIds(value) {
  if (value === undefined || value === null) return { value };
  if (
    !Array.isArray(value) ||
    value.length > MAX_GRADES ||
    value.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) < 1)
  )
    return { error: "ระดับชั้นที่ดูแลไม่ถูกต้อง" };
  if (!value.length)
    return { error: "กรุณาเลือกระดับชั้นที่ดูแลอย่างน้อยหนึ่งระดับ" };
  return { value: [...new Set(value.map(Number))] };
}

// Writes the grade scope after the duty row is saved, inside the caller's
// transaction. Only counselors are grade-scoped; any other duty clears it.
async function saveCounselorGrades(
  connection,
  { schoolId, userId, roleCode, gradeLevelIds, actorId },
) {
  if (roleCode === "counselor" && gradeLevelIds === undefined) return;
  const scoped = roleCode === "counselor" && Array.isArray(gradeLevelIds);
  if (scoped) {
    const [grades] = await connection.query(
      "SELECT id FROM school_grade_levels WHERE school_id=? AND id IN (?)",
      [schoolId, gradeLevelIds],
    );
    if (grades.length !== gradeLevelIds.length)
      throw Object.assign(new Error("ระดับชั้นต้องอยู่ในโรงเรียนที่เลือก"), {
        status: 422,
      });
  }
  await connection.query(
    "UPDATE school_staff_roles SET grade_scoped=? WHERE school_id=? AND user_id=?",
    [scoped ? 1 : 0, schoolId, userId],
  );
  await connection.query(
    "DELETE FROM school_staff_role_grades WHERE school_id=? AND user_id=?",
    [schoolId, userId],
  );
  if (scoped)
    await connection.query(
      "INSERT INTO school_staff_role_grades (school_id,user_id,grade_level_id,created_by) VALUES ?",
      [gradeLevelIds.map((id) => [schoolId, userId, id, actorId || null])],
    );
}

module.exports = {
  GUARDIAN_ROLE_CODE,
  SCHOOL_ROLE_LABELS,
  STAFF_ROLE_CODES,
  TEACHER_ROLE_CODES,
  roleMatchesKind,
  normalizeGradeIds,
  saveCounselorGrades,
};
