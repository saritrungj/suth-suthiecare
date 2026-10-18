// Fill patient_member_profiles from the cases each member already has.
// Without --apply it only reads and reports what it would store.
// With --apply it stores the newest status answer per member and reports the
// resulting types (school roster rows are read live, never written here).
require("../config/env");
const db = require("../config/db");
const {
  latestStatusAnswer,
  refreshMemberAnswer,
  memberTypeSql,
} = require("../services/memberType");

async function main() {
  const apply = process.argv.includes("--apply");
  const [accounts] = await db.query("SELECT id FROM patient_accounts ORDER BY id");
  const answers = {};
  for (const { id } of accounts) {
    const found = apply
      ? await refreshMemberAnswer(db, id)
      : await latestStatusAnswer(db, id);
    const key = found ? found.type : "no_answer";
    answers[key] = (answers[key] || 0) + 1;
  }
  const report = { mode: apply ? "apply" : "dry-run", accounts: accounts.length, answers };
  if (apply) {
    const sql = memberTypeSql("pa");
    const [rows] = await db.query(
      `SELECT ${sql.type} AS member_type, ${sql.source} AS source, COUNT(*) AS total
         FROM patient_accounts pa ${sql.joins}
        GROUP BY member_type, source ORDER BY member_type, source`,
    );
    report.types = rows.map((r) => ({ type: r.member_type, source: r.source, total: Number(r.total) }));
  }
  console.log(JSON.stringify(report, null, 1));
}

main()
  .catch((error) => {
    console.error("Member type backfill failed:", error.code || error.message);
    process.exitCode = 1;
  })
  .finally(() => db.end());