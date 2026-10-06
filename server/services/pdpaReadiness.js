const { keyring } = require("../utils/privateData");
const TABLES = [
  "organization_role_permission_sets",
  "organization_role_permissions",
  "form_invitations",
  "organization_referral_links",
  "organization_notification_targets",
  "organization_notification_events",
  "organization_membership_data_permissions",
  "auth_sessions",
  "pdpa_migration_progress",
  "pdpa_migration_issues",
  "pdpa_rights_requests",
  "pdpa_rights_request_events",
  "pdpa_retention_policies",
  "pdpa_retention_policy_versions",
  "pdpa_legal_holds",
  "pdpa_consent_evidence",
  "pdpa_processing_purposes",
  "pdpa_notice_versions",
  "authorization_audit_logs",
];
const COLUMNS = {
  case_logs: ["patient_visible"],
  appointments: ["clinical_payload_encrypted"],
  school_student_health_profiles: ["health_payload_encrypted"],
  school_student_physical_records: ["measurements_encrypted"],
  users: ["email_encrypted", "email_hash"],
  patient_accounts: [
    "email_encrypted",
    "email_hash",
    "pending_email_encrypted",
    "pending_email_hash",
  ],
  auth_email_challenges: ["destination_encrypted"],
};
// The trusted migration is the source of truth for every new table column.
const ddl = [
  "20261003_pdpa_security.sql",
  "20261003_organization_role_permissions.sql",
]
  .map((file) =>
    require("fs").readFileSync(
      require("path").join(__dirname, "../migrations", file),
      "utf8",
    ),
  )
  .join("\n");
for (const table of ddl.matchAll(
  /CREATE TABLE IF NOT EXISTS (\w+)\s*\(([\s\S]*?)\);/g,
)) {
  COLUMNS[table[1]] = [
    ...table[2].matchAll(
      /(?:^|,)\s*(\w+)\s+(?:BIGINT|INT|TINYINT|CHAR|VARCHAR|DATETIME|TEXT|TIMESTAMP|JSON)\b/g,
    ),
  ].map((column) => column[1]);
}
COLUMNS.users.push("pending_email_encrypted", "pending_email_hash");
async function schemaReadiness(db) {
  keyring();
  const [tables] = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()",
  );
  const names = new Set(tables.map((row) => row.TABLE_NAME));
  const missing = TABLES.filter((table) => !names.has(table));
  for (const [table, columns] of Object.entries(COLUMNS)) {
    if (!names.has(table)) {
      missing.push(table);
      continue;
    }
    const [found] = await db.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [table],
    );
    const keys = new Set(found.map((row) => row.COLUMN_NAME));
    for (const column of columns)
      if (!keys.has(column)) missing.push(table + "." + column);
  }
  if (names.has("pdpa_migration_progress")) {
    const [snapshots] = await db.query(
      'SELECT last_id FROM pdpa_migration_progress WHERE migration_key="organization-permissions:v1"',
    );
    if (Number(snapshots[0]?.last_id) !== 1)
      missing.push("organization_permissions_snapshot");
  }
  if (names.has("pdpa_crypto_key_checks")) {
    const [checks] = await db.query(
      "SELECT key_id,payload FROM pdpa_crypto_key_checks",
    );
    if (!checks.length) missing.push("encryption_key_check");
    for (const row of checks)
      require("../utils/privateData").openJson(
        typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
        "key-readiness:" + row.key_id,
      );
  } else missing.push("pdpa_crypto_key_checks");
  return { ready: missing.length === 0, missing };
}
let checkedAt = 0,
  known = null;
async function readinessMiddleware(req, res, next) {
  try {
    if (!known || Date.now() - checkedAt > 30000) {
      known = await schemaReadiness(require("../config/db"));
      checkedAt = Date.now();
    }
    if (!known.ready)
      return res.status(503).json({ code: "PDPA_SCHEMA_NOT_READY" });
    if (
      process.env.NODE_ENV === "production" &&
      process.env.PDPA_ENCRYPTED_WRITER_ENABLED !== "true" &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !/^\/(login|email\/verify|password-recovery\/|session|logout|patient\/logout|patient-auth\/(login|email\/verify|password-recovery\/))/.test(
        req.path,
      )
    )
      return res.status(503).json({ code: "ENCRYPTED_WRITER_RELEASE_GATE" });
    next();
  } catch {
    return res.status(503).json({ code: "PDPA_READINESS_FAILED" });
  }
}
module.exports = { TABLES, COLUMNS, schemaReadiness, readinessMiddleware };
