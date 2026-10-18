// One definition of school duties (school_staff_roles.role_code) shared by the
// Add User modal (PUT /users/:id/assignments) and the school staff page
// (PUT /school/staff-roles), so both accept the same codes for the same people.
const SCHOOL_ROLE_LABELS = Object.freeze({
  admin: "ผู้ดูแลข้อมูลทั่วไป",
  mental_admin: "แอดมินสุขภาพจิต",
  physical_admin: "แอดมินสุขภาพกาย",
  counselor: "ครูแนะแนว",
  homeroom: "ครูประจำชั้น",
  other: "ครูทั่วไป",
  dorm_staff: "เจ้าหน้าที่หอพัก",
});
const GUARDIAN_ROLE_CODE = "guardian";
const TEACHER_ROLE_CODES = new Set(["counselor", "homeroom", "other"]);
const STAFF_ROLE_CODES = new Set([
  "admin",
  "mental_admin",
  "physical_admin",
  "dorm_staff",
]);

// personnelKind is "teacher" (has a school_teachers row) or "staff".
function roleMatchesKind(roleCode, personnelKind) {
  return personnelKind === "teacher"
    ? TEACHER_ROLE_CODES.has(roleCode)
    : STAFF_ROLE_CODES.has(roleCode);
}

module.exports = {
  GUARDIAN_ROLE_CODE,
  SCHOOL_ROLE_LABELS,
  STAFF_ROLE_CODES,
  TEACHER_ROLE_CODES,
  roleMatchesKind,
};
