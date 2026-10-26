const { ACTIONS } = require("../authorization/permissionMatrix");

// Capabilities come only from the unit role's rights (roles page). School roles,
// classroom assignments and guardian links only decide which students are in scope.
async function loadSchoolAccess(db, req) {
  const isSystemAdmin = Boolean(req.authorization?.isSystemAdmin);
  const can = (key) => require("../authorization/can").can(req, key);
  const actions = (module) =>
    Object.fromEntries(
      ACTIONS.map((action) => [action, can(`${module}.${action}`)]),
    );
  const clinicalAllowed = can("clinical.view");
  const healthView = can("student_health.view") && clinicalAllowed;
  const healthUpdate = can("student_health.update") && clinicalAllowed;
  const [teachers] = await db.query(
    `SELECT st.id, st.school_id FROM school_teachers st
    JOIN schools s ON s.id=st.school_id
    JOIN organization_memberships om ON om.user_id=st.user_id AND om.organization_id=s.organization_id AND om.status='active'
    WHERE st.user_id=? AND st.status='active' AND s.organization_id=?`,
    [req.user.id, req.organizationContext],
  );
  const [roles] = await db.query(
    `SELECT r.school_id,r.role_code,r.grade_scoped FROM school_staff_roles r
    JOIN schools s ON s.id=r.school_id
    JOIN organization_memberships om ON om.user_id=r.user_id AND om.organization_id=s.organization_id AND om.status='active'
    JOIN users u ON u.id=r.user_id AND u.status='active'
    WHERE r.user_id=? AND r.status='active' AND s.organization_id=?`,
    [req.user.id, req.organizationContext],
  );
  if (
    !isSystemAdmin &&
    (req.authorization?.membership?.role_name === "school_guardian" ||
      roles.some((r) => r.role_code === "guardian"))
  ) {
    const [children] = await db.query(
      `SELECT ss.id,ss.school_id FROM school_student_guardians g
      JOIN school_students ss ON ss.id=g.student_id AND ss.archived_at IS NULL
      JOIN schools s ON s.id=ss.school_id
      JOIN school_staff_roles r ON r.user_id=g.user_id AND r.school_id=ss.school_id AND r.role_code='guardian' AND r.status='active'
      WHERE g.user_id=? AND g.status='active' AND s.organization_id=?`,
      [req.user.id, req.organizationContext],
    );
    return {
      isSystemAdmin: false,
      isGuardian: true,
      isTeacher: false,
      guardianStudents: children,
      clinicalAllowed,
      // Guardians are a fixed account type: read-only health of linked children.
      healthView: clinicalAllowed,
      healthUpdate: false,
      healthUnitWide: false,
      staff: Object.fromEntries(ACTIONS.map((action) => [action, false])),
      workflows: Object.fromEntries(ACTIONS.map((action) => [action, false])),
      health: { view: clinicalAllowed },
      teacherIds: [],
      teacherSchoolIds: [],
      homeroomSchoolIds: [],
      classroomIds: [],
      healthClassroomIds: [],
      adminSchoolIds: [],
      mentalAdminSchoolIds: [],
      counselorSchoolIds: [],
      counselorClassroomIds: [],
      counselorGradeIds: [],
      physicalSchoolIds: [],
      dormSchoolIds: [],
      allStudentSchoolIds: [],
      canClinical: clinicalAllowed,
      canMental: clinicalAllowed,
      canPhysical: clinicalAllowed,
      canViewRisk: true,
      canViewSchool: false,
      canCreateSchool: false,
      canUpdateSchool: false,
      canDeleteSchool: false,
      canAssignSchool: false,
      canManageStaff: false,
      canManageWorkflows: false,
      canViewAllStudents: false,
      canViewStudents: true,
      canCreateStudents: false,
      canUpdateStudents: false,
      canDeleteStudents: false,
      canAssignStudents: false,
      canExportStudents: false,
      canViewAllHealth: false,
      canUpdateAllHealth: false,
    };
  }
  const teacherIds = teachers.map((t) => Number(t.id));
  const teacherSchoolIds = teachers.map((t) => Number(t.school_id));
  const homeroomSchoolIds = roles
    .filter((r) => r.role_code === "homeroom")
    .map((r) => Number(r.school_id));
  let classroomIds = [],
    healthClassroomIds = [];
  if (teacherIds.length) {
    const [rooms] = await db.query(
      `SELECT DISTINCT ct.classroom_id,ct.role,t.school_id FROM school_classroom_teachers ct
      JOIN school_teachers t ON t.id=ct.teacher_id WHERE ct.teacher_id IN (?)`,
      [teacherIds],
    );
    classroomIds = [...new Set(rooms.map((r) => Number(r.classroom_id)))];
    healthClassroomIds = [
      ...new Set(
        rooms
          .filter(
            (r) =>
              roles.some(
                (role) =>
                  Number(role.school_id) === Number(r.school_id) &&
                  role.role_code === "homeroom",
              ) && ["homeroom", "co_homeroom"].includes(r.role),
          )
          .map((r) => Number(r.classroom_id)),
      ),
    ];
  }
  const adminSchoolIds = roles
    .filter((r) => ["admin", "mental_admin"].includes(r.role_code))
    .map((r) => Number(r.school_id));
  // Mental-health admins oversee every counseling appointment of the school.
  const mentalAdminSchoolIds = roles
    .filter((r) => r.role_code === "mental_admin")
    .map((r) => Number(r.school_id));
  // A grade-scoped counselor sees only the classrooms of their grades (none
  // when no grade is set). mental_admin always covers the whole school.
  const gradeScoped = (r) =>
    r.role_code === "counselor" && Number(r.grade_scoped) === 1;
  const counselorSchoolIds = roles
    .filter(
      (r) =>
        ["counselor", "mental_admin"].includes(r.role_code) && !gradeScoped(r),
    )
    .map((r) => Number(r.school_id));
  const scopedSchoolIds = roles
    .filter(gradeScoped)
    .map((r) => Number(r.school_id));
  let counselorClassroomIds = [],
    counselorGradeIds = [];
  if (scopedSchoolIds.length) {
    const [gradeRooms] = await db.query(
      `SELECT g.grade_level_id,c.id AS classroom_id FROM school_staff_role_grades g
      LEFT JOIN school_classrooms c ON c.grade_level_id=g.grade_level_id AND c.school_id=g.school_id
      WHERE g.user_id=? AND g.school_id IN (?)`,
      [req.user.id, scopedSchoolIds],
    );
    counselorGradeIds = [
      ...new Set(gradeRooms.map((r) => Number(r.grade_level_id))),
    ];
    counselorClassroomIds = [
      ...new Set(
        gradeRooms
          .filter((r) => r.classroom_id != null)
          .map((r) => Number(r.classroom_id)),
      ),
    ];
  }
  const physicalSchoolIds = roles
    .filter((r) => r.role_code === "physical_admin")
    .map((r) => Number(r.school_id));
  const dormSchoolIds = roles
    .filter((r) => r.role_code === "dorm_staff")
    .map((r) => Number(r.school_id));
  const allStudentSchoolIds = [
    ...new Set([
      ...adminSchoolIds,
      ...counselorSchoolIds,
      ...physicalSchoolIds,
    ]),
  ];
  const isTeacher = teacherIds.length > 0;
  // Staff with no school role and no class see the whole unit, as for students.
  const healthUnitWide = healthView && roles.length === 0 && !isTeacher;
  const mentalScope =
    counselorSchoolIds.length > 0 ||
    counselorClassroomIds.length > 0 ||
    healthClassroomIds.length > 0 ||
    healthUnitWide;
  const physicalScope = mentalScope || physicalSchoolIds.length > 0;
  const students = actions("students");
  const school = actions("school");
  return {
    isSystemAdmin,
    isTeacher,
    clinicalAllowed,
    healthView,
    healthUpdate,
    healthUnitWide,
    teacherIds,
    teacherSchoolIds,
    homeroomSchoolIds,
    classroomIds,
    healthClassroomIds,
    adminSchoolIds,
    mentalAdminSchoolIds,
    // No school duty and no classroom: unit-wide aggregate reports apply.
    hasSchoolRole: roles.length > 0 || isTeacher,
    counselorSchoolIds,
    counselorClassroomIds,
    counselorGradeIds,
    physicalSchoolIds,
    dormSchoolIds,
    allStudentSchoolIds,
    staff: actions("school_staff"),
    workflows: actions("school_workflows"),
    health: actions("student_health"),
    behavior: actions("student_behavior"),
    appointments: actions("school_appointments"),
    documents: actions("school_documents"),
    canViewAudit: can("audit.view"),
    canViewReports: can("dashboard.view"),
    canClinical: isSystemAdmin || (healthView && physicalScope),
    canMental: isSystemAdmin || (healthView && mentalScope),
    canPhysical: isSystemAdmin || (healthView && physicalScope),
    canViewRisk:
      isSystemAdmin ||
      (students.view &&
        (roles.some((r) => r.role_code !== "physical_admin") ||
          (isTeacher && !physicalSchoolIds.length) ||
          healthUnitWide)),
    canViewSchool: school.view,
    canCreateSchool: school.create,
    canUpdateSchool: school.update,
    canDeleteSchool: school.delete,
    canAssignSchool: school.assign,
    canManageStaff: can("school_staff.view"),
    canManageWorkflows: can("school_workflows.view"),
    canViewAllStudents:
      isSystemAdmin || (students.view && roles.length === 0 && !isTeacher),
    canViewStudents: students.view,
    canCreateStudents: students.create,
    canUpdateStudents: students.update,
    canDeleteStudents: students.delete,
    canAssignStudents: students.assign,
    canExportStudents: students.export,
    canViewAllHealth:
      isSystemAdmin ||
      (healthView &&
        (counselorSchoolIds.length > 0 ||
          physicalSchoolIds.length > 0 ||
          healthUnitWide)),
    canUpdateAllHealth:
      isSystemAdmin ||
      (healthUpdate && (counselorSchoolIds.length > 0 || healthUnitWide)),
  };
}
function studentScopeClause(access, alias = "ss") {
  if (access.isGuardian)
    return {
      sql: " AND " + alias + ".id IN (?)",
      params: [
        access.guardianStudents?.map((s) => Number(s.id)).filter(Boolean).length
          ? access.guardianStudents.map((s) => Number(s.id))
          : [0],
      ],
    };
  if (access.canViewAllStudents) return { sql: "", params: [] };
  const clauses = [],
    params = [];
  if (access.allStudentSchoolIds?.length) {
    clauses.push(`${alias}.school_id IN (?)`);
    params.push(access.allStudentSchoolIds);
  }
  if (access.dormSchoolIds?.length) {
    clauses.push(`(${alias}.school_id IN (?) AND ${alias}.is_boarder=1)`);
    params.push(access.dormSchoolIds);
  }
  const rooms = [
    ...new Set([
      ...access.classroomIds,
      ...(access.counselorClassroomIds || []),
    ]),
  ];
  if (rooms.length) {
    clauses.push(`${alias}.classroom_id IN (?)`);
    params.push(rooms);
  }
  return {
    sql: clauses.length ? ` AND (${clauses.join(" OR ")})` : " AND 1 = 0",
    params,
  };
}
const teachesStudent = (access, student) =>
  access.isTeacher &&
  student?.classroom_id != null &&
  access.classroomIds.includes(Number(student.classroom_id)) &&
  (!access.teacherSchoolIds ||
    access.teacherSchoolIds.includes(Number(student.school_id)));
const guardianOf = (access, student) =>
  Boolean(
    access.isGuardian &&
    access.guardianStudents?.some(
      (s) =>
        Number(s.id) === Number(student?.id) &&
        Number(s.school_id) === Number(student?.school_id),
    ),
  );
const counselsStudent = (access, student) =>
  student?.classroom_id != null &&
  Boolean(access.counselorClassroomIds?.includes(Number(student.classroom_id)));
const canSeeStudent = (access, student) =>
  !student?.archived_at &&
  (guardianOf(access, student) ||
    access.canViewAllStudents ||
    access.allStudentSchoolIds?.includes(Number(student?.school_id)) ||
    (student?.is_boarder &&
      access.dormSchoolIds?.includes(Number(student.school_id))) ||
    counselsStudent(access, student) ||
    teachesStudent(access, student));
const canViewStudentHealth = (access, student) =>
  !student?.archived_at &&
  access.clinicalAllowed !== false &&
  access.healthView !== false &&
  Boolean(
    guardianOf(access, student) ||
    access.isSystemAdmin ||
    access.healthUnitWide ||
    access.counselorSchoolIds?.includes(Number(student?.school_id)) ||
    counselsStudent(access, student) ||
    (student?.classroom_id != null &&
      access.healthClassroomIds?.includes(Number(student.classroom_id)) &&
      access.homeroomSchoolIds?.includes(Number(student.school_id))),
  );
const canUpdateStudentHealth = (access, student) =>
  !access.isGuardian &&
  access.healthUpdate !== false &&
  canViewStudentHealth(access, student);
// Counselor level or above for this student: a counselor or mental-health
// admin covering it, unit-wide health staff, or a system admin. Homeroom
// teachers of the class are not included.
const canCounselStudent = (access, student) =>
  !student?.archived_at &&
  !access.isGuardian &&
  Boolean(
    access.isSystemAdmin ||
    access.healthUnitWide ||
    access.counselorSchoolIds?.includes(Number(student?.school_id)) ||
    counselsStudent(access, student),
  );
const canViewPhysicalHealth = (access, student) =>
  !student?.archived_at &&
  access.clinicalAllowed !== false &&
  access.healthView !== false &&
  (canViewStudentHealth(access, student) ||
    Boolean(access.physicalSchoolIds?.includes(Number(student?.school_id))));
// Health create/delete/assign follow the roles page, within the same student scope.
const canHealthAction = (access, action, student, physical = false) =>
  !access.isGuardian &&
  (access.isSystemAdmin || Boolean(access.health?.[action])) &&
  (physical
    ? canViewPhysicalHealth(access, student)
    : canViewStudentHealth(access, student));
// The roles-page keys whose absence alone stops this health check for a
// student the caller can see. Empty when granting keys would not help (the
// student is outside the caller's health scope), so the route keeps its 404.
// check: false/true (view/update) or a health action such as "create".
function missingHealthKeys(access, check, student) {
  if (access.isSystemAdmin || access.isGuardian) return [];
  if (!canSeeStudent(access, student)) return [];
  const action = typeof check === "string" ? check : check ? "update" : "view";
  const missing = [];
  if (access.clinicalAllowed === false) missing.push("clinical.view");
  if (access.healthView === false && !access.health?.view)
    missing.push("student_health.view");
  if (action !== "view" && !access.health?.[action])
    missing.push(`student_health.${action}`);
  if (!missing.length) return [];
  // Staff with no school duty see health unit-wide once they may view it.
  const granted = {
    ...access,
    clinicalAllowed: true,
    healthView: true,
    healthUpdate: true,
    healthUnitWide: access.healthUnitWide || access.hasSchoolRole === false,
    health: { ...access.health, view: true, [action]: true },
  };
  const passes =
    typeof check === "string"
      ? canHealthAction(granted, check, student)
      : (check ? canUpdateStudentHealth : canViewStudentHealth)(
          granted,
          student,
        );
  return passes ? missing : [];
}
const canManageSchool = (access) =>
  access.isSystemAdmin || Boolean(access.canUpdateSchool);
// Staff/guardian accounts and screening workflows, per action on the roles page.
// Routes have already checked that the school belongs to the current unit.
const canManageStaffAt = (access, _schoolId, action = "update") =>
  access.isSystemAdmin || Boolean(access.staff?.[action]);
const canManageWorkflowsAt = (access, _schoolId, action = "update") =>
  access.isSystemAdmin || Boolean(access.workflows?.[action]);
const flags = (access, set = {}) =>
  Object.fromEntries(
    ACTIONS.map((action) => [
      action,
      Boolean(access.isSystemAdmin || set[action]),
    ]),
  );
const publicAccess = (access) => ({
  is_guardian: Boolean(access.isGuardian),
  is_teacher: access.isTeacher,
  classroom_ids: access.classroomIds,
  can_view_school: access.canViewSchool,
  can_create_school: access.canCreateSchool,
  can_update_school: access.canUpdateSchool,
  can_delete_school: access.canDeleteSchool,
  can_assign_school: Boolean(access.canAssignSchool),
  can_view_all_students:
    access.canViewAllStudents || access.allStudentSchoolIds.length > 0,
  can_view_students: access.canViewStudents,
  can_create_students: access.canCreateStudents,
  can_update_students: access.canUpdateStudents,
  can_delete_students: access.canDeleteStudents,
  can_assign_students: Boolean(access.canAssignStudents),
  can_export_students: access.canExportStudents,
  can_manage_staff: access.canManageStaff,
  can_manage_workflows: Boolean(
    access.isSystemAdmin ||
    access.workflows?.create ||
    access.workflows?.update,
  ),
  staff_actions: flags(access, access.staff),
  workflow_actions: flags(access, access.workflows),
  health_actions: flags(access, { ...access.health, view: access.canClinical }),
  can_view_health: access.canClinical,
  can_update_health:
    !access.isGuardian && access.canClinical && access.healthUpdate !== false,
  can_view_mental: access.canMental,
  can_view_physical: access.canPhysical,
  can_view_risk: access.canViewRisk,
  counselor_grade_ids: access.counselorGradeIds || [],
  behavior_actions: flags(access, access.behavior),
  can_use_behavior: Boolean(
    access.isSystemAdmin || access.behavior?.view || access.behavior?.create,
  ),
  appointment_actions: flags(access, access.appointments),
  can_view_reports: Boolean(access.isSystemAdmin || access.canViewReports),
  can_use_documents: Boolean(
    access.isSystemAdmin ||
    ["view", "create", "update", "delete", "assign"].some(
      (a) => access.documents?.[a],
    ),
  ),
  can_use_appointments: Boolean(
    access.isSystemAdmin ||
    access.appointments?.view ||
    access.appointments?.create,
  ),
  document_actions: flags(access, access.documents),
  can_view_audit: Boolean(access.isSystemAdmin || access.canViewAudit),
});
module.exports = {
  loadSchoolAccess,
  studentScopeClause,
  canSeeStudent,
  canViewStudentHealth,
  canUpdateStudentHealth,
  canCounselStudent,
  canViewPhysicalHealth,
  canHealthAction,
  missingHealthKeys,
  canManageSchool,
  canManageStaffAt,
  canManageWorkflowsAt,
  publicAccess,
};
