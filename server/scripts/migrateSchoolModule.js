// Applies the person identity, school management and organization hierarchy
// migrations, in order, to the environment selected by server/config/env.
// Every file is idempotent. Rollback runs the _rollback files in reverse.
//   node scripts/migrateSchoolModule.js --apply
//   node scripts/migrateSchoolModule.js --apply --rollback
require("../config/env");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const dir = path.join(__dirname, "..", "migrations");
const forward = [
  "20261002_person_identity.sql",
  "20261002_school_management.sql",
  "20261003_organization_hierarchy.sql",
];

// Same splitter as migrateAllForward.js: drops comment lines, splits on ";".
function statements(sql) {
  return sql
    .replace(/\r/g, "")
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

async function runFile(connection, file) {
  for (const query of statements(fs.readFileSync(path.join(dir, file), "utf8")))
    await connection.query(query);
}

async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Re-run with --apply to execute migrations");
  const rollback = process.argv.includes("--rollback");
  const files = rollback
    ? [...forward]
        .reverse()
        .map((file) => file.replace(".sql", "_rollback.sql"))
    : forward;
  const connection = await db.getConnection();
  const applied = [];
  try {
    for (const file of files) {
      if (!fs.existsSync(path.join(dir, file))) continue;
      await runFile(connection, file);
      applied.push(file);
    }
  } finally {
    connection.release();
    await db.end();
  }
  console.log(JSON.stringify({ success: true, applied }));
}

main().catch((error) => {
  console.error(`School module migration failed: ${error.message}`);
  process.exitCode = 1;
});
