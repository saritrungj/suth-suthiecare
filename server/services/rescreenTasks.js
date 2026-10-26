// Follow-up tasks for one student (school_rescreen_tasks), shared
// by the screening workflow page and the student file. A task names the
// mental-health form to complete, the staff member responsible and a due
// date. It may start from an earlier response (re-screening) or from a
// guidance record made before the student has any assessment.
const { validDate, positiveId } = require("../utils/schoolWorkflows");

// Every task here is for one student, so it is a follow-up: "rescreen" from
// an earlier result, "follow_up" from a guidance record. Group screening is
// done by screening rounds.
const TASK_KINDS = ["rescreen", "follow_up"];
const invalid = (message) => Object.assign(new Error(message), { status: 422 });

async function activeStaff(connection, organizationId, userId) {
  const [[row]] = await connection.query(
    "SELECT u.id FROM organization_memberships om JOIN users u ON u.id=om.user_id WHERE om.organization_id=? AND om.user_id=? AND om.status='active' AND u.status='active'",
    [organizationId, positiveId(userId)],
  );
  return row;
}

// Staff who may follow this student's mental health: system admins, the
// school's mental-health admins, counselors covering the student's grade and
// the homeroom teachers of the student's class.
async function rescreenAssignees(
  connection,
  organizationId,
  ss,
  userId = null,
) {
  const [rows] = await connection.query(
    `SELECT DISTINCT u.id,u.username FROM organization_memberships om JOIN users u ON u.id=om.user_id LEFT JOIN school_staff_roles r ON r.user_id=u.id AND r.school_id=? AND r.status='active' WHERE om.organization_id=? AND om.status='active' AND u.status='active'${userId ? " AND u.id=?" : ""} AND (EXISTS (SELECT 1 FROM user_system_roles usr WHERE usr.user_id=u.id AND usr.system_role_id=1) OR r.role_code='mental_admin' OR (r.role_code='counselor' AND (r.grade_scoped=0 OR EXISTS (SELECT 1 FROM school_staff_role_grades rg JOIN school_classrooms rc ON rc.grade_level_id=rg.grade_level_id WHERE rg.user_id=u.id AND rg.school_id=r.school_id AND rc.id=?))) OR (r.role_code='homeroom' AND EXISTS (SELECT 1 FROM school_classroom_teachers ct JOIN school_teachers t ON t.id=ct.teacher_id WHERE t.user_id=u.id AND t.school_id=? AND t.status='active' AND ct.classroom_id=? AND ct.role IN ('homeroom','co_homeroom')))) ORDER BY u.username`,
    [
      ss.school_id,
      organizationId,
      ...(userId ? [Number(userId)] : []),
      ss.classroom_id || 0,
      ss.school_id,
      ss.classroom_id || 0,
    ],
  );
  return rows;
}

async function mentalForm(connection, organizationId, id) {
  const [[row]] = await connection.query(
    "SELECT id FROM forms WHERE id=? AND organization_id=? AND health_domain='mental'",
    [positiveId(id), organizationId],
  );
  return row;
}

// Validates and inserts one task inside the caller's transaction. Throws an
// error with status 422 and a Thai message when the task is not valid.
// task: { target_form_id, assigned_user_id, due_on, source_response_id?,
//         task_kind?, guidance_record_id? }
async function createTask(connection, { organizationId, userId, ss, task }) {
  const kind = task.task_kind || "rescreen";
  if (!TASK_KINDS.includes(kind)) throw invalid("ประเภทงานไม่ถูกต้อง");
  if (
    !validDate(task.due_on) ||
    !(await mentalForm(connection, organizationId, task.target_form_id))
  )
    throw invalid("วันที่ติดตามหรือแบบประเมินไม่ถูกต้อง");
  // A re-screening starts from an earlier response; follow-up tasks made
  // from the student file may not have one yet.
  const sourceId = task.source_response_id
    ? positiveId(task.source_response_id)
    : null;
  if (kind === "rescreen" && !sourceId)
    throw invalid("กรุณาเลือกผลประเมินต้นทาง");
  if (sourceId) {
    const [[source]] = await connection.query(
      "SELECT id FROM form_responses WHERE id=? AND organization_id=? AND (person_id=? OR (person_id IS NULL AND patient_account_id=?))",
      [sourceId, organizationId, ss.person_id || 0, ss.patient_account_id || 0],
    );
    if (!source) throw invalid("ผลประเมินต้นทางไม่ใช่ของนักเรียนนี้");
  }
  if (!(await activeStaff(connection, organizationId, task.assigned_user_id)))
    throw invalid("ผู้รับผิดชอบต้องเป็นสมาชิกหน่วยงานที่ใช้งานอยู่");
  if (
    !(
      await rescreenAssignees(
        connection,
        organizationId,
        ss,
        task.assigned_user_id,
      )
    ).length
  )
    throw invalid("ผู้รับผิดชอบต้องมีสิทธิ์สุขภาพจิตของนักเรียนนี้");
  const [insert] = await connection.query(
    "INSERT INTO school_rescreen_tasks (student_id,task_kind,guidance_record_id,source_response_id,target_form_id,assigned_user_id,due_on,created_by) VALUES (?,?,?,?,?,?,?,?)",
    [
      ss.id,
      kind,
      task.guidance_record_id || null,
      sourceId,
      positiveId(task.target_form_id),
      positiveId(task.assigned_user_id),
      task.due_on,
      userId,
    ],
  );
  return insert.insertId;
}

module.exports = {
  TASK_KINDS,
  activeStaff,
  rescreenAssignees,
  mentalForm,
  createTask,
};
