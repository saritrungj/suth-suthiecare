require("../config/env");
const fs = require("fs"),
  path = require("path");
const db = require("../config/db");
async function migrate(connection) {
  const sql = fs.readFileSync(
    path.join(__dirname, "../migrations/20261003_pdpa_security.sql"),
    "utf8",
  );
  for (const statement of sql
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await connection.query(statement);
  await connection.query(
    "INSERT IGNORE INTO pdpa_notice_versions (organization_id,form_id,notice_version,purpose,legal_basis,notice_text,approved_by,approved_at) SELECT organization_id,form_id,notice_version,purpose,legal_basis,notice_text,approved_by,approved_at FROM pdpa_processing_purposes",
  );
  await connection.query(
    "INSERT IGNORE INTO pdpa_retention_policy_versions (organization_id,data_type,version,retention_days,approved_by,approved_at) SELECT organization_id,data_type,version,retention_days,approved_by,approved_at FROM pdpa_retention_policies WHERE approved_at IS NOT NULL AND retention_days IS NOT NULL AND approved_by IS NOT NULL",
  );
  const { keyring, sealJson, openJson } = require("../utils/privateData");
  const [checks] = await connection.query(
    "SELECT key_id,payload FROM pdpa_crypto_key_checks",
  );
  for (const row of checks)
    openJson(
      typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      "key-readiness:" + row.key_id,
    );
  const active = keyring().active;
  if (!checks.some((row) => row.key_id === active))
    await connection.query(
      "INSERT INTO pdpa_crypto_key_checks (key_id,payload) VALUES (?,?)",
      [
        active,
        JSON.stringify(
          sealJson(
            require("crypto").randomBytes(32).toString("base64url"),
            "key-readiness:" + active,
          ),
        ),
      ],
    );
  const additions = {
    case_logs: { patient_visible: "TINYINT NOT NULL DEFAULT 0" },
    appointments: { clinical_payload_encrypted: "TEXT NULL" },
    school_student_health_profiles: { health_payload_encrypted: "TEXT NULL" },
    school_student_physical_records: { measurements_encrypted: "TEXT NULL" },
    users: {
      email_encrypted: "TEXT NULL",
      email_hash: "CHAR(64) NULL",
      pending_email_encrypted: "TEXT NULL",
      pending_email_hash: "CHAR(64) NULL",
    },
    patient_accounts: {
      email_encrypted: "TEXT NULL",
      email_hash: "CHAR(64) NULL",
      pending_email_encrypted: "TEXT NULL",
      pending_email_hash: "CHAR(64) NULL",
    },
    auth_email_challenges: { destination_encrypted: "TEXT NULL" },
  };
  for (const [table, columns] of Object.entries(additions)) {
    const [exists] = await connection.query(
      "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
      [table],
    );
    if (!exists.length) continue;
    for (const [column, type] of Object.entries(columns)) {
      const [rows] = await connection.query(
        "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
        [table, column],
      );
      if (!rows.length)
        await connection.query(
          `ALTER TABLE ${table} ADD COLUMN ${column} ${type}`,
        );
    }
  }
  for (const table of ["users", "patient_accounts"]) {
    const [columns] = await connection.query(
      "SELECT DATA_TYPE,CHARACTER_MAXIMUM_LENGTH,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='email'",
      [table],
    );
    if (columns.length && columns[0].IS_NULLABLE === "NO")
      await connection.query(
        `ALTER TABLE ${table} MODIFY COLUMN email VARCHAR(254) NULL`,
      );
    const [indexes] = await connection.query(
      "SHOW INDEX FROM " + table + " WHERE Key_name=?",
      ["uq_pdpa_email_hash"],
    );
    if (!indexes.length)
      await connection.query(
        "CREATE UNIQUE INDEX uq_pdpa_email_hash ON " + table + " (email_hash)",
      );
  }
  for (const column of [
    "weight_kg",
    "height_cm",
    "bmi",
    "systolic",
    "diastolic",
    "pulse",
    "vision_left",
    "vision_right",
    "hearing_left",
    "hearing_right",
  ]) {
    const [columns] = await connection.query(
      "SELECT COLUMN_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_student_physical_records' AND COLUMN_NAME=?",
      [column],
    );
    if (columns[0]?.IS_NULLABLE === "NO")
      await connection.query(
        `ALTER TABLE school_student_physical_records MODIFY COLUMN ${column} ${columns[0].COLUMN_TYPE} NULL`,
      );
  }
  for (const [table, column, nullable] of [
    ["case_logs", "staff", false],
    ["appointments", "staff", true],
    ["staffs", "fullname", false],
    ["form_responses", "risk_level", true],
    ["mastercases", "overall_risk", true],
    ["form_responses", "identity_value", true],
    ["mastercases", "identityValue", true],
  ]) {
    const [rows] = await connection.query(
      "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
      [table, column],
    );
    if (rows.length && rows[0].DATA_TYPE !== "text")
      await connection.query(
        `ALTER TABLE ${table} MODIFY COLUMN ${column} TEXT ${nullable ? "NULL" : "NOT NULL"}`,
      );
  }
  for (const def of require("./backfillPrivateData").definitions)
    for (const column of def.text || []) {
      const [rows] = await connection.query(
        "SELECT DATA_TYPE,IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?",
        [def.table, column],
      );
      if (
        rows.length &&
        !["text", "mediumtext", "longtext"].includes(rows[0].DATA_TYPE)
      )
        await connection.query(
          `ALTER TABLE ${def.table} MODIFY COLUMN ${column} TEXT ${rows[0].IS_NULLABLE === "YES" ? "NULL" : "NOT NULL"}`,
        );
    }
  await require("./migrateOrganizationPermissions").migrate(connection);
  await connection.query(`INSERT IGNORE INTO organization_membership_data_permissions (membership_id,permission_key,granted,source)
    SELECT DISTINCT om.id,'pii.view',1,'legacy_snapshot' FROM organization_memberships om JOIN organization_role_permissions rp ON rp.role_id=om.role_id AND rp.organization_id=om.organization_id
    WHERE om.status='active' AND rp.permission_key IN ('cases.view','forms.view','patient_members.view','students.view','student_health.view')`);
  await connection.query(`INSERT IGNORE INTO organization_membership_data_permissions (membership_id,permission_key,granted,source)
    SELECT DISTINCT om.id,'clinical.view',1,'legacy_snapshot' FROM organization_memberships om JOIN organization_role_permissions rp ON rp.role_id=om.role_id AND rp.organization_id=om.organization_id
    WHERE om.status='active' AND rp.permission_key IN ('cases.view','forms.view','student_health.view')`);
  const [schoolTables] = await connection.query(
    "SHOW TABLES LIKE 'school_teachers'",
  );
  if (schoolTables.length)
    for (const key of ["pii.view", "clinical.view"])
      await connection.query(
        `INSERT IGNORE INTO organization_membership_data_permissions (membership_id,permission_key,granted,source)
    SELECT DISTINCT om.id,?,1,'legacy_snapshot' FROM organization_memberships om
    JOIN schools s ON s.organization_id=om.organization_id JOIN school_teachers st ON st.school_id=s.id AND st.user_id=om.user_id
    JOIN school_classroom_teachers ct ON ct.teacher_id=st.id WHERE om.status='active' AND st.status='active'`,
        [key],
      );
}
async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("USE_APPLY_FOR_SCHEMA_MIGRATION");
  if (
    process.env.NODE_ENV === "production" &&
    !process.argv.includes("--allow-production")
  )
    throw new Error("PRODUCTION_RELEASE_GATE_REQUIRED");
  try {
    await migrate(db);
    console.log(
      JSON.stringify({ migration: "20261003_pdpa_security", success: true }),
    );
  } finally {
    await db.end();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e.code || e.message);
    process.exitCode = 1;
  });
module.exports = { migrate };
