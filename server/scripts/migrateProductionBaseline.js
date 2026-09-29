/*
 * Applies the migration baseline required by suthiecare_db_15092569.sql.
 * It deliberately excludes the legacy patient-auth migrations (already present
 * in that backup) and the duplicate clinics/forms organization migration.
 */
// This command must always use the deployed server/.env.production file.
// A plain `pnpm migrate:production-baseline` does not set NODE_ENV itself.
process.env.NODE_ENV = "production";
require("../config/env");

const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const migrateEmailOtp = require("./migrateEmailOtp");

const migrationsDirectory = path.join(__dirname, "..", "migrations");

const plan = [
  {
    file: "20260901_organizations_rbac.sql",
    name: "Organizations and RBAC",
    shouldRun: async (connection) => {
      const expectedTables = [
        "organizations",
        "system_roles",
        "user_system_roles",
        "organization_memberships",
        "role_permissions",
        "authorization_audit_logs",
      ];
      const expectedColumns = [
        "mastercases",
        "form_responses",
        "clinics",
        "forms",
      ];
      const tablesReady = await Promise.all(
        expectedTables.map((table) => hasTable(connection, table)),
      );
      const columnsReady = await Promise.all(
        expectedColumns.map((table) =>
          hasColumn(connection, table, "organization_id"),
        ),
      );
      const anythingExists =
        tablesReady.some(Boolean) || columnsReady.some(Boolean);
      const everythingExists =
        tablesReady.every(Boolean) && columnsReady.every(Boolean);

      if (everythingExists) return false;
      if (anythingExists) {
        throw new Error(
          "พบ Organization/RBAC schema เพียงบางส่วน กรุณาตรวจฐานข้อมูลและแก้ migration ที่ค้างอยู่ก่อนรันสคริปต์นี้อีกครั้ง",
        );
      }
      return true;
    },
  },
  {
    file: "20260901_assign_unassigned_to_suth_hospital.sql",
    name: "Assign legacy data to SUT Hospital",
    shouldRun: async () => true,
  },
  {
    file: "20260902_form_result_display_mode.sql",
    name: "Form result display mode",
    shouldRun: async () => true,
  },
  {
    file: "20260902_form_login_enforcement.sql",
    name: "Form login enforcement",
    shouldRun: async () => true,
  },
  {
    // Idempotent: adds clinics.name_en, widens users.name, and back-fills the
    // forms/clinics/help_center/content write permission keys.
    file: "20260915_schema_alignment.sql",
    name: "Schema alignment (clinics.name_en, users.name, write permissions)",
    shouldRun: async () => true,
  },
];

async function hasTable(connection, table) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
    [table],
  );
  return Boolean(rows[0]);
}

async function hasColumn(connection, table, column) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    [table, column],
  );
  return Boolean(rows[0]);
}

// MySQL DELIMITER is a client instruction, not SQL understood by mysql2.
// This converts each source file into statements while keeping stored
// procedures (used by the form migrations) as one statement.
function splitStatements(sql) {
  const statements = [];
  let delimiter = ";";
  let source = "";

  for (const line of sql.replace(/\r\n/g, "\n").split("\n")) {
    const delimiterMatch = line.match(/^\s*DELIMITER\s+(.+)\s*$/i);
    if (delimiterMatch) {
      collectStatements(source, delimiter, statements);
      source = "";
      delimiter = delimiterMatch[1].trim();
      continue;
    }
    source += `${line}\n`;
  }
  collectStatements(source, delimiter, statements);
  return statements;
}

function collectStatements(source, delimiter, statements) {
  for (const part of source.split(delimiter)) {
    const statement = part
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n")
      .trim();
    if (statement) statements.push(statement);
  }
}

async function runSqlFile(connection, migration) {
  const filePath = path.join(migrationsDirectory, migration.file);
  const sql = fs.readFileSync(filePath, "utf8");
  const statements = splitStatements(sql);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log("Connecting with server/.env.production...");
  const connection = await db.getConnection();
  const applied = [];
  const skipped = [];

  try {
    const [database] = await connection.query("SELECT DATABASE() AS name");
    console.log(
      `${apply ? "Applying" : "Checking"} production migration baseline on: ${database[0]?.name || "(unknown database)"}`,
    );

    for (const migration of plan) {
      if (!(await migration.shouldRun(connection))) {
        skipped.push(migration.name);
        console.log(`Skipped (already applied): ${migration.name}`);
        continue;
      }
      if (!apply) {
        console.log(`Would apply: ${migration.name}`);
        continue;
      }
      await runSqlFile(connection, migration);
      applied.push(migration.name);
      console.log(`Applied: ${migration.name}`);
    }
  } finally {
    connection.release();
  }

  if (!apply) {
    await db.end();
    console.log(
      "Dry run complete. No database changes were made. Re-run with --apply after taking a backup.",
    );
    return;
  }

  // The Email OTP migration has its own idempotent schema checks.
  await migrateEmailOtp();
  console.log(
    JSON.stringify({
      success: true,
      applied,
      skipped,
      emailOtp: "applied-or-already-present",
    }),
  );
}

main().catch((error) => {
  console.error(`Production migration baseline failed: ${error.message}`);
  process.exitCode = 1;
});
