const { isFormOpenForSubmission } = require("../utils/formSettings");

// A re-screening task is shown to the student and closed by their own
// submission. The student sees only the form and the due date: never the
// source assessment, its risk, or who assigned the task.

const bangkokToday = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const dateOnly = (value) =>
  value instanceof Date
    ? value.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })
    : String(value || "").slice(0, 10);

// Who a screening round is for. No grade and no classroom: the whole school.
// Grades: every classroom of those grades. Classrooms: only those classrooms.
// Both: either. roundId is an SQL expression for the round id ("r.id" or
// "?"), ss and c are the student and classroom aliases. With "?" the clause
// takes the round id four times (roundTargetParams).
const roundTargetClause = (roundId, ss = "ss", c = "c") =>
  `((NOT EXISTS (SELECT 1 FROM school_screening_round_grades rg WHERE rg.round_id = ${roundId})
     AND NOT EXISTS (SELECT 1 FROM school_screening_round_classrooms rc WHERE rc.round_id = ${roundId}))
    OR ${c}.grade_level_id IN (SELECT rg.grade_level_id FROM school_screening_round_grades rg WHERE rg.round_id = ${roundId})
    OR ${ss}.classroom_id IN (SELECT rc.classroom_id FROM school_screening_round_classrooms rc WHERE rc.round_id = ${roundId}))`;
const roundTargetParams = (roundId) => [roundId, roundId, roundId, roundId];
// The same rule in code, for a student row carrying classroom_id and
// grade_level_id. Empty lists mean no limit.
const inRoundTarget = ({ grades = [], classrooms = [] }, student) =>
  (!grades.length && !classrooms.length) ||
  grades.map(Number).includes(Number(student.grade_level_id)) ||
  classrooms.map(Number).includes(Number(student.classroom_id));

// Pending tasks of every active roster row linked to this account, either
// directly or through the person record.
async function pendingTasksForPatient(connection, patientAccountId) {
  const [rows] = await connection.query(
    `SELECT t.id, t.target_form_id, t.due_on, f.title, f.status,
            f.publish_start_date, f.publish_end_date
       FROM school_rescreen_tasks t
       JOIN school_students ss ON ss.id = t.student_id
       JOIN schools s ON s.id = ss.school_id
       JOIN forms f ON f.id = t.target_form_id AND f.organization_id = s.organization_id
       LEFT JOIN persons p ON p.id = ss.person_id
      WHERE t.status = 'pending' AND ss.archived_at IS NULL AND ss.status = 'active'
        AND (ss.patient_account_id = ? OR p.patient_account_id = ?)
      ORDER BY t.due_on, t.id`,
    [patientAccountId, patientAccountId],
  );
  const today = bangkokToday();
  return rows.map((row) => ({
    id: row.id,
    form_id: row.target_form_id,
    title: row.title,
    due_on: dateOnly(row.due_on),
    overdue: dateOnly(row.due_on) < today,
    available: isFormOpenForSubmission(row),
  }));
}

// Screening rounds the student still has to do: active rounds of their school
// open today, for their classroom or grade (or the whole school, see
// roundTargetClause), with no response to the round's form inside the
// round's dates. Same rule as the staff progress page, so a round disappears
// for the student once it counts as done there.
async function pendingRoundsForPatient(connection, patientAccountId) {
  const today = bangkokToday();
  const [rows] = await connection.query(
    `SELECT DISTINCT r.id, r.name, r.form_id, r.ends_on, f.title, f.status,
            f.publish_start_date, f.publish_end_date
       FROM school_screening_rounds r
       JOIN school_students ss ON ss.school_id = r.school_id
       JOIN schools s ON s.id = ss.school_id
       JOIN forms f ON f.id = r.form_id AND f.organization_id = s.organization_id
       LEFT JOIN persons p ON p.id = ss.person_id
       LEFT JOIN school_classrooms c ON c.id = ss.classroom_id
      WHERE r.status = 'active' AND ? BETWEEN r.starts_on AND r.ends_on
        AND ss.archived_at IS NULL AND ss.status = 'active'
        AND (ss.patient_account_id = ? OR p.patient_account_id = ?)
        AND ${roundTargetClause("r.id")}
        AND NOT EXISTS (
          SELECT 1 FROM form_responses fr
           WHERE fr.form_id = r.form_id AND fr.organization_id = s.organization_id
             AND (fr.person_id = ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id = ss.patient_account_id))
             AND DATE(fr.submitted_at) BETWEEN r.starts_on AND r.ends_on)
      ORDER BY r.ends_on, r.id`,
    [today, patientAccountId, patientAccountId],
  );
  return rows.map((row) => ({
    id: row.id,
    form_id: row.form_id,
    title: row.title,
    round_name: row.name,
    due_on: dateOnly(row.ends_on),
    available: isFormOpenForSubmission(row),
  }));
}

// Runs inside the submission transaction. Every pending task for this form
// and this student, created before the response, is completed by it. The
// ownership rule matches the manual link on the staff page.
async function completeTasksForResponse(
  connection,
  { formId, organizationId, responseId, personId, patientAccountId },
) {
  if (!personId && !patientAccountId) return 0;
  const [result] = await connection.query(
    `UPDATE school_rescreen_tasks t
       JOIN school_students ss ON ss.id = t.student_id
       JOIN schools s ON s.id = ss.school_id
        SET t.status = 'completed', t.completed_response_id = ?, t.completed_at = NOW()
      WHERE t.status = 'pending' AND t.target_form_id = ? AND s.organization_id = ?
        AND (t.source_response_id IS NULL OR t.source_response_id <> ?)
        AND t.created_at <= NOW()
        AND ss.archived_at IS NULL
        AND (ss.person_id = ? OR ss.patient_account_id = ?)`,
    [
      responseId,
      formId,
      organizationId,
      responseId,
      personId || 0,
      patientAccountId || 0,
    ],
  );
  return result?.affectedRows || 0;
}

module.exports = {
  pendingTasksForPatient,
  pendingRoundsForPatient,
  completeTasksForResponse,
  roundTargetClause,
  roundTargetParams,
  inRoundTarget,
};
