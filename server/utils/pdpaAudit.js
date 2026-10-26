const db = require("../config/db");
const ALLOWED = new Set([
  "request_id",
  "count",
  "format",
  "direction",
  "version",
  "status",
  "field",
  "reason_code",
  // Record identifiers and codes only: never names, notes or health values.
  "report_id",
  "appointment_id",
  "follow_up_id",
  "rule_id",
  "document_id",
  "category_id",
  "user_id",
  "role_code",
  "assigned_to",
  "grade_level_ids",
  "preset",
  "permissions",
]);
async function requiredAudit(
  req,
  action,
  targetType,
  targetId,
  metadata = {},
  connection = db,
) {
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => ALLOWED.has(key)),
  );
  try {
    await connection.query(
      "INSERT INTO authorization_audit_logs (request_id, actor_user_id, organization_id, action, target_type, target_id, result, after_data, ip, user_agent) VALUES (?,?,?,?,?,?,'allowed',?,?,?)",
      [
        req.requestId || null,
        req.user?.id || null,
        typeof req.organizationContext === "number"
          ? req.organizationContext
          : null,
        action,
        targetType,
        String(targetId ?? ""),
        JSON.stringify(safe),
        req.ip || null,
        String(req.get?.("user-agent") || "").slice(0, 255),
      ],
    );
  } catch {
    require("./privacyTelemetry").record("audit_failure");
    const error = new Error("AUDIT_UNAVAILABLE");
    error.code = "AUDIT_UNAVAILABLE";
    error.status = 503;
    throw error;
  }
}
async function requiredPatientAudit(
  req,
  action,
  targetId,
  metadata = {},
  connection = db,
) {
  const safe = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => ALLOWED.has(key)),
  );
  safe.target_id = String(targetId ?? "");
  try {
    await connection.query(
      "INSERT INTO patient_auth_audit_logs (patient_account_id,event_type,ip_address,user_agent,metadata) VALUES (?,?,?,?,?)",
      [
        req.patient.id,
        action,
        req.ip || null,
        String(req.get?.("user-agent") || "").slice(0, 255),
        JSON.stringify(safe),
      ],
    );
  } catch {
    require("./privacyTelemetry").record("audit_failure");
    throw Object.assign(new Error("AUDIT_UNAVAILABLE"), {
      code: "AUDIT_UNAVAILABLE",
      status: 503,
    });
  }
}
module.exports = { requiredAudit, requiredPatientAudit };
