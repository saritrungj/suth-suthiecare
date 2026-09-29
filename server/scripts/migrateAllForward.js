// Applies every forward migration in dependency order to the environment selected
// by server/config/env. Rollback files are deliberately never part of this plan.
require("../config/env");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");
const migrateEmailOtp = require("./migrateEmailOtp");

const dir = path.join(__dirname, "..", "migrations");
const forward = [
  "20260901_organizations_rbac.sql",
  "20260901_assign_unassigned_to_suth_hospital.sql",
  "20260902_form_result_display_mode.sql",
  "20260902_form_requires_login.sql",
  "20260902_form_login_enforcement.sql",
  "20260915_schema_alignment.sql",
];

function statements(sql) {
  const output = [];
  let delimiter = ";";
  let source = "";
  const collect = () => {
    source.split(delimiter).forEach((part) => {
      const query = part
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .trim();
      if (query) output.push(query);
    });
    source = "";
  };
  for (const line of sql.replace(/\r/g, "").split("\n")) {
    const match = line.match(/^\s*DELIMITER\s+(.+)$/i);
    if (match) {
      collect();
      delimiter = match[1].trim();
    } else source += `${line}\n`;
  }
  collect();
  return output;
}

async function has(connection, table, column) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [table, column],
  );
  return Boolean(rows[0]);
}

async function runFile(connection, file) {
  for (const query of statements(fs.readFileSync(path.join(dir, file), "utf8")))
    await connection.query(query);
}

async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Re-run with --apply to execute migrations");
  const connection = await db.getConnection();
  const applied = [];
  try {
    if (!(await has(connection, "clinics", "organization_id"))) {
      await runFile(connection, forward[0]);
      applied.push(forward[0]);
    } else applied.push(`${forward[0]} (already satisfied)`);
    // The RBAC migration already adds these two fields and their foreign keys.
    applied.push(
      "20260901_clinics_forms_organization.sql (satisfied by RBAC migration)",
    );
    await runFile(connection, forward[1]);
    applied.push(forward[1]);
    await runFile(connection, forward[2]);
    applied.push(forward[2]);
    if (!(await has(connection, "forms", "login_enforcement"))) {
      await runFile(connection, forward[3]);
      applied.push(forward[3]);
    } else applied.push(`${forward[3]} (superseded by login_enforcement)`);
    await runFile(connection, forward[4]);
    applied.push(forward[4]);
    await runFile(connection, forward[5]);
    applied.push(forward[5]);
  } finally {
    connection.release();
  }
  await migrateEmailOtp();
  console.log(JSON.stringify({ success: true, applied }));
}
main().catch((error) => {
  console.error(`Forward migration failed: ${error.message}`);
  process.exitCode = 1;
});
