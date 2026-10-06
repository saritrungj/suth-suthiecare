// Who may see which students inside a school organization.
//
// - System admins and holders of students.view see every student of the
//   active organization.
// - A staff user linked as an active teacher sees only the students of the
//   classrooms they are assigned to, and may view and record those students'
//   health even without the student_health permissions.
// - Anyone else gets no student rows.

async function loadSchoolAccess(db, req) {
  const isSystemAdmin = Boolean(req.authorization?.isSystemAdmin);
  const permissions = req.authorization?.permissions;
  const can = (key) => isSystemAdmin || Boolean(permissions?.has?.(key));
  const canClinical = can("clinical.view");

  const [teachers] = await db.query(
    `SELECT st.id, st.school_id
       FROM school_teachers st
       JOIN schools s ON s.id = st.school_id
      WHERE st.user_id = ? AND st.status = 'active' AND s.organization_id = ?`,
    [req.user.id, req.organizationContext],
  );
  const teacherIds = teachers.map((row) => row.id);
  let classroomIds = [];
  if (teacherIds.length) {
    const [rows] = await db.query(
      "SELECT DISTINCT classroom_id FROM school_classroom_teachers WHERE teacher_id IN (?)",
      [teacherIds],
    );
    classroomIds = rows.map((row) => row.classroom_id);
  }
  const isTeacher = teacherIds.length > 0;

  return {
    isSystemAdmin,
    isTeacher,
    canClinical,
    teacherIds,
    classroomIds,
    canViewSchool: can("school.view") || isTeacher,
    canCreateSchool: can("school.create"),
    canUpdateSchool: can("school.update"),
    canDeleteSchool: can("school.delete"),
    canViewAllStudents: can("students.view"),
    canViewStudents: can("students.view") || isTeacher,
    canCreateStudents: can("students.create"),
    canUpdateStudents: can("students.update"),
    canDeleteStudents: can("students.delete"),
    canExportStudents: can("students.export"),
    canViewAllHealth: canClinical && can("student_health.view"),
    canUpdateAllHealth: canClinical && can("student_health.update"),
  };
}

// SQL fragment limiting a student query to the caller's classrooms.
function studentScopeClause(access, alias = "ss") {
  if (access.canViewAllStudents) return { sql: "", params: [] };
  if (!access.classroomIds.length) return { sql: " AND 1 = 0", params: [] };
  return {
    sql: ` AND ${alias}.classroom_id IN (?)`,
    params: [access.classroomIds],
  };
}

const teachesStudent = (access, student) =>
  access.isTeacher &&
  student?.classroom_id != null &&
  access.classroomIds.includes(Number(student.classroom_id));

const canSeeStudent = (access, student) =>
  access.canViewAllStudents || teachesStudent(access, student);

const canViewStudentHealth = (access, student) =>
  access.canClinical &&
  ((access.canViewAllHealth && canSeeStudent(access, student)) ||
    teachesStudent(access, student));

const canUpdateStudentHealth = (access, student) =>
  access.canClinical &&
  ((access.canUpdateAllHealth && canSeeStudent(access, student)) ||
    teachesStudent(access, student));

// What the client needs to render menus and buttons.
const publicAccess = (access) => ({
  is_teacher: access.isTeacher,
  classroom_ids: access.classroomIds,
  can_view_school: access.canViewSchool,
  can_create_school: access.canCreateSchool,
  can_update_school: access.canUpdateSchool,
  can_delete_school: access.canDeleteSchool,
  can_view_all_students: access.canViewAllStudents,
  can_view_students: access.canViewStudents,
  can_create_students: access.canCreateStudents,
  can_update_students: access.canUpdateStudents,
  can_delete_students: access.canDeleteStudents,
  can_export_students: access.canExportStudents,
  can_view_health:
    access.canClinical && (access.canViewAllHealth || access.isTeacher),
  can_update_health:
    access.canClinical && (access.canUpdateAllHealth || access.isTeacher),
});

module.exports = {
  loadSchoolAccess,
  studentScopeClause,
  canSeeStudent,
  canViewStudentHealth,
  canUpdateStudentHealth,
  publicAccess,
};
