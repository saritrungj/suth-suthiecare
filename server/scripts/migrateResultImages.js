require("../config/env");
const db = require("../config/db");
const {
  MIGRATIONS,
  resultPageStatements,
} = require("../services/resultPageSchema");

async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("Use --apply to create the result page tables");
  try {
    for (const query of resultPageStatements()) await db.query(query);
    console.log(JSON.stringify({ success: true, migrations: MIGRATIONS }));
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error("Result image migration failed:", error.code || error.message);
  process.exitCode = 1;
});
