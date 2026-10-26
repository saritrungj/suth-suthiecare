// Tells a student's homeroom teachers and the counselors of their grade when
// a mental-health assessment they submit lands in an at-risk level. Runs in
// the submission transaction, on the server's own risk result (score rules
// and the school's approved answer triggers), never on what the client sent.
// The notification carries only who, which room, the level and the school's
// own care advice: no score, answer or family detail.
const { readField } = require("../utils/privateField");
const { scoreResultsOf, riskLevelOf } = require("../utils/riskLevel");
const { notify, recipientsForStudent } = require("./schoolNotify");

const LEVELS = ["high", "medium"];
const LEVEL_LABELS = { high: "เสี่ยงสูง", medium: "เฝ้าระวัง" };
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  levels: ["high"],
  mental_admins: false,
});

const parse = (value) => {
  if (!value) return null;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
};

// Missing or partial settings fall back to: on, high risk only, teachers only.
function riskAlertSettings(notificationJson) {
  const saved = parse(notificationJson)?.risk_alerts || {};
  return {
    enabled:
      typeof saved.enabled === "boolean"
        ? saved.enabled
        : DEFAULT_SETTINGS.enabled,
    levels: Array.isArray(saved.levels)
      ? saved.levels.filter((level) => LEVELS.includes(level))
      : [...DEFAULT_SETTINGS.levels],
    mental_admins:
      typeof saved.mental_admins === "boolean"
        ? saved.mental_admins
        : DEFAULT_SETTINGS.mental_admins,
  };
}

function validateSettings(body = {}) {
  if (
    typeof body.enabled !== "boolean" ||
    typeof body.mental_admins !== "boolean" ||
    !Array.isArray(body.levels) ||
    body.levels.some((level) => !LEVELS.includes(level))
  )
    return { error: "การตั้งค่าแจ้งเตือนไม่ถูกต้อง" };
  return {
    value: {
      enabled: body.enabled,
      levels: [...new Set(body.levels)],
      mental_admins: body.mental_admins,
    },
  };
}

const riskOf = (summary) =>
  summary?.school_risk_override?.level || riskLevelOf(scoreResultsOf(summary));
// Only an at-risk mental-health result from a known person can alert.
const mayAlert = ({ healthDomain, summary, personId, patientAccountId }) =>
  healthDomain === "mental" &&
  Boolean(personId || patientAccountId) &&
  LEVELS.includes(riskOf(summary));

async function alertForResponse(
  connection,
  {
    organizationId,
    responseId,
    healthDomain,
    summary,
    personId,
    patientAccountId,
  },
) {
  if (!mayAlert({ healthDomain, summary, personId, patientAccountId }))
    return 0;
  const risk = riskOf(summary);
  const [students] = await connection.query(
    `SELECT ss.id,ss.school_id,ss.student_code,ss.prefix,ss.first_name_encrypted,ss.last_name_encrypted,
            c.name AS classroom_name,g.name AS grade_name,ws.notification_json,ws.care_advice_json
       FROM school_students ss
       JOIN schools s ON s.id=ss.school_id
       LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
       LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id
       LEFT JOIN school_workflow_settings ws ON ws.school_id=ss.school_id
      WHERE s.organization_id=? AND ss.archived_at IS NULL AND ss.status='active'
        AND (ss.person_id=? OR ss.patient_account_id=?)`,
    [organizationId, personId || 0, patientAccountId || 0],
  );
  let sent = 0;
  for (const student of students) {
    const settings = riskAlertSettings(student.notification_json);
    if (!settings.enabled || !settings.levels.includes(risk)) continue;
    const recipients = await recipientsForStudent(connection, student.id, {
      homeroom: true,
      counselors: true,
      mentalAdmins: settings.mental_admins,
    });
    if (!recipients.length) continue;
    const name = [
      student.prefix,
      readField(
        student.first_name_encrypted,
        "school_students",
        "first_name_encrypted",
        organizationId,
      ),
      readField(
        student.last_name_encrypted,
        "school_students",
        "last_name_encrypted",
        organizationId,
      ),
    ]
      .filter(Boolean)
      .join(" ");
    const room = [student.grade_name, student.classroom_name]
      .filter(Boolean)
      .join("/");
    const advice = String(parse(student.care_advice_json)?.[risk] || "").trim();
    sent += await notify(connection, {
      organizationId,
      schoolId: student.school_id,
      kind: "risk_alert",
      studentId: student.id,
      sourceType: "form_response",
      sourceId: responseId,
      recipients,
      payload: {
        title:
          risk === "high"
            ? "พบนักเรียนกลุ่มเสี่ยงสูง"
            : "พบนักเรียนที่ควรเฝ้าระวัง",
        body: [
          `${student.student_code}${name ? ` ${name}` : ""} · ห้อง ${room || "-"} · ${LEVEL_LABELS[risk]}`,
          advice ? `คำแนะนำ: ${advice}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      },
      dedupeKey: `risk:${responseId}:${student.id}`,
    });
  }
  return sent;
}

// A failed alert must never lose the student's submission: it runs behind a
// savepoint and is undone on its own.
async function alertForResponseSafely(connection, args) {
  if (!mayAlert(args)) return 0;
  await connection.query("SAVEPOINT school_risk_alert");
  try {
    const sent = await alertForResponse(connection, args);
    await connection.query("RELEASE SAVEPOINT school_risk_alert");
    return sent;
  } catch (error) {
    await connection.query("ROLLBACK TO SAVEPOINT school_risk_alert");
    console.warn(
      "School risk alert skipped:",
      require("../utils/safeError").safeError(error),
    );
    return 0;
  }
}

module.exports = {
  DEFAULT_SETTINGS,
  LEVELS,
  riskAlertSettings,
  validateSettings,
  alertForResponse,
  alertForResponseSafely,
};
