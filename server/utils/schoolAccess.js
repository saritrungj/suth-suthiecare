// Stable school roles are separate from editable teacher types and unit RBAC.
async function loadSchoolAccess(db, req) {
  const isSystemAdmin = Boolean(req.authorization?.isSystemAdmin);
  const can = key => isSystemAdmin || Boolean(req.authorization?.permissions?.has?.(key));
  const [teachers] = await db.query(`SELECT st.id, st.school_id FROM school_teachers st
    JOIN schools s ON s.id=st.school_id
    JOIN organization_memberships om ON om.user_id=st.user_id AND om.organization_id=s.organization_id AND om.status='active'
    WHERE st.user_id=? AND st.status='active' AND s.organization_id=?`, [req.user.id, req.organizationContext]);
  const [roles] = await db.query(`SELECT r.school_id,r.role_code FROM school_staff_roles r
    JOIN schools s ON s.id=r.school_id
    JOIN organization_memberships om ON om.user_id=r.user_id AND om.organization_id=s.organization_id AND om.status='active'
    JOIN users u ON u.id=r.user_id AND u.status='active'
    WHERE r.user_id=? AND r.status='active' AND s.organization_id=?`, [req.user.id, req.organizationContext]);
  if (!isSystemAdmin && (req.authorization?.membership?.role_name === 'school_guardian' || roles.some(r => r.role_code === 'guardian'))) {
    const [children] = await db.query(`SELECT ss.id,ss.school_id FROM school_student_guardians g
      JOIN school_students ss ON ss.id=g.student_id AND ss.archived_at IS NULL
      JOIN schools s ON s.id=ss.school_id
      JOIN school_staff_roles r ON r.user_id=g.user_id AND r.school_id=ss.school_id AND r.role_code='guardian' AND r.status='active'
      WHERE g.user_id=? AND g.status='active' AND s.organization_id=?`, [req.user.id, req.organizationContext]);
    return {isSystemAdmin:false,isGuardian:true,isTeacher:false,guardianStudents:children,
      teacherIds:[],teacherSchoolIds:[],homeroomSchoolIds:[],classroomIds:[],healthClassroomIds:[],adminSchoolIds:[],counselorSchoolIds:[],physicalSchoolIds:[],dormSchoolIds:[],allStudentSchoolIds:[],
      canClinical:true,canMental:true,canPhysical:true,canViewRisk:true,
      canViewSchool:false,canCreateSchool:false,canUpdateSchool:false,canDeleteSchool:false,canManageStaff:false,
      canViewAllStudents:false,canViewStudents:true,canCreateStudents:false,canUpdateStudents:false,canDeleteStudents:false,canExportStudents:false,canViewAllHealth:false,canUpdateAllHealth:false};
  }
  const teacherIds = teachers.map(t => Number(t.id));
  const teacherSchoolIds = teachers.map(t=>Number(t.school_id));
  const homeroomSchoolIds = roles.filter(r=>r.role_code==='homeroom').map(r=>Number(r.school_id));
  let classroomIds = [], healthClassroomIds = [];
  if (teacherIds.length) {
    const [rooms] = await db.query(`SELECT DISTINCT ct.classroom_id,ct.role,t.school_id FROM school_classroom_teachers ct
      JOIN school_teachers t ON t.id=ct.teacher_id WHERE ct.teacher_id IN (?)`, [teacherIds]);
    classroomIds = [...new Set(rooms.map(r => Number(r.classroom_id)))];
    healthClassroomIds = [...new Set(rooms.filter(r => roles.some(role => Number(role.school_id) === Number(r.school_id) && role.role_code === 'homeroom') && ['homeroom','co_homeroom'].includes(r.role)).map(r => Number(r.classroom_id)))];
  }
  const adminSchoolIds = roles.filter(r => ['admin','mental_admin'].includes(r.role_code)).map(r => Number(r.school_id));
  const counselorSchoolIds = roles.filter(r => ['counselor','mental_admin'].includes(r.role_code)).map(r => Number(r.school_id));
  const physicalSchoolIds = roles.filter(r => r.role_code === 'physical_admin').map(r => Number(r.school_id));
  const dormSchoolIds = roles.filter(r => r.role_code === 'dorm_staff').map(r => Number(r.school_id));
  const allStudentSchoolIds = [...new Set([...adminSchoolIds,...counselorSchoolIds,...physicalSchoolIds])];
  const isTeacher = teacherIds.length > 0;
  return {
    isSystemAdmin, isTeacher, teacherIds, teacherSchoolIds, homeroomSchoolIds, classroomIds, healthClassroomIds, adminSchoolIds, counselorSchoolIds, physicalSchoolIds, dormSchoolIds, allStudentSchoolIds,
    canClinical: isSystemAdmin || counselorSchoolIds.length > 0 || healthClassroomIds.length > 0 || physicalSchoolIds.length > 0,
    canMental: isSystemAdmin || counselorSchoolIds.length > 0 || healthClassroomIds.length > 0,
    canPhysical: isSystemAdmin || counselorSchoolIds.length > 0 || healthClassroomIds.length > 0 || physicalSchoolIds.length > 0,
    canViewRisk: isSystemAdmin || roles.some(r=>r.role_code!=='physical_admin') || (isTeacher && !physicalSchoolIds.length),
    canViewSchool: can('school.view') || isTeacher || roles.length > 0,
    canCreateSchool: can('school.create') || adminSchoolIds.length>0, canUpdateSchool: can('school.update') || adminSchoolIds.length>0, canDeleteSchool: can('school.delete') || adminSchoolIds.length>0,
    canManageStaff: isSystemAdmin || adminSchoolIds.length > 0,
    canViewAllStudents: isSystemAdmin || (can('students.view') && roles.length === 0 && !isTeacher),
    canViewStudents: can('students.view') || isTeacher || roles.length > 0,
    canCreateStudents: can('students.create') || adminSchoolIds.length > 0,
    canUpdateStudents: can('students.update') || adminSchoolIds.length > 0,
    canDeleteStudents: can('students.delete') || adminSchoolIds.length > 0,
    canExportStudents: can('students.export') || roles.some(r=>['admin','counselor','homeroom'].includes(r.role_code)),
    canViewAllHealth: isSystemAdmin || counselorSchoolIds.length > 0 || physicalSchoolIds.length > 0,
    canUpdateAllHealth: isSystemAdmin || counselorSchoolIds.length > 0,
  };
}
function studentScopeClause(access, alias='ss') {
  if (access.isGuardian) return {sql:' AND '+alias+'.id IN (?)',params:[access.guardianStudents?.map(s=>Number(s.id)).filter(Boolean).length ? access.guardianStudents.map(s=>Number(s.id)) : [0]]};
  if (access.canViewAllStudents) return {sql:'',params:[]};
  const clauses=[],params=[];
  if (access.allStudentSchoolIds?.length) {clauses.push(`${alias}.school_id IN (?)`);params.push(access.allStudentSchoolIds);}
  if (access.dormSchoolIds?.length) {clauses.push(`(${alias}.school_id IN (?) AND ${alias}.is_boarder=1)`);params.push(access.dormSchoolIds);}
  if (access.classroomIds.length) {clauses.push(`${alias}.classroom_id IN (?)`);params.push(access.classroomIds);}
  return {sql:clauses.length ? ` AND (${clauses.join(' OR ')})` : ' AND 1 = 0',params};
}
const teachesStudent = (access, student) => access.isTeacher && student?.classroom_id != null && access.classroomIds.includes(Number(student.classroom_id)) && (!access.teacherSchoolIds || access.teacherSchoolIds.includes(Number(student.school_id)));
const guardianOf = (access,student) => Boolean(access.isGuardian && access.guardianStudents?.some(s=>Number(s.id)===Number(student?.id) && Number(s.school_id)===Number(student?.school_id)));
const canSeeStudent = (access, student) => !student?.archived_at && (guardianOf(access,student) || access.canViewAllStudents || access.allStudentSchoolIds?.includes(Number(student?.school_id)) || (student?.is_boarder && access.dormSchoolIds?.includes(Number(student.school_id))) || teachesStudent(access,student));
const canViewStudentHealth = (access, student) => !student?.archived_at && Boolean(guardianOf(access,student) || access.isSystemAdmin || access.counselorSchoolIds?.includes(Number(student?.school_id)) || (student?.classroom_id != null && access.healthClassroomIds?.includes(Number(student.classroom_id)) && access.homeroomSchoolIds?.includes(Number(student.school_id))));
const canUpdateStudentHealth = (access,student) => !access.isGuardian && canViewStudentHealth(access,student);
const canViewPhysicalHealth = (access,student) => !student?.archived_at && (canViewStudentHealth(access,student) || Boolean(access.physicalSchoolIds?.includes(Number(student?.school_id))));
const canManageSchool = (access, schoolId) => access.isSystemAdmin || access.adminSchoolIds?.includes(Number(schoolId));
const publicAccess = access => ({
  is_guardian:Boolean(access.isGuardian), is_teacher:access.isTeacher, classroom_ids:access.classroomIds,
  can_view_school:access.canViewSchool,can_create_school:access.canCreateSchool,can_update_school:access.canUpdateSchool,can_delete_school:access.canDeleteSchool,
  can_view_all_students:access.canViewAllStudents || access.allStudentSchoolIds.length>0,
  can_view_students:access.canViewStudents,can_create_students:access.canCreateStudents,can_update_students:access.canUpdateStudents,can_delete_students:access.canDeleteStudents,
  can_export_students:access.canExportStudents,can_manage_staff:access.canManageStaff,
  can_view_health:access.canClinical,can_update_health:!access.isGuardian && access.canClinical,
  can_view_mental:access.canMental,can_view_physical:access.canPhysical,can_view_risk:access.canViewRisk,
});
module.exports={loadSchoolAccess,studentScopeClause,canSeeStudent,canViewStudentHealth,canUpdateStudentHealth,canViewPhysicalHealth,canManageSchool,publicAccess};
