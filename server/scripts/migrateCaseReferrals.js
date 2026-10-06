require("../config/env");
const fs = require("fs");
const path = require("path");
const db = require("../config/db");

async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Use --apply to create the case referral tables");
  const sql = fs.readFileSync(
    path.join(__dirname, "../migrations/20261003_case_referrals.sql"),
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
        migration: "20261003_case_referrals.sql",
      }),
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error("Case referral migration failed:", error.code || error.message);
  process.exitCode = 1;
});
