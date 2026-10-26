require("../config/env");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Use --apply to create the patient member type table");
  const sql = fs.readFileSync(
    path.join(__dirname, "../migrations/20261017_patient_member_types.sql"),
    "utf8",
  );
  const statements = sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";")
    .map((query) => query.trim())
    .filter(Boolean);
  try {
    for (const query of statements) await db.query(query);
    console.log(
      JSON.stringify({
        success: true,
        migration: "20261017_patient_member_types.sql",
      }),
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(
    "Patient member type migration failed:",
    error.code || error.message,
  );
  process.exitCode = 1;
});
