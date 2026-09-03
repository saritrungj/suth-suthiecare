require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const crypto = require("crypto");
const db = require("../config/db");

const apply = process.argv.includes("--apply");

async function requireMigration(connection) {
  const [columns] = await connection.query(
    "SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'mastercases' AND COLUMN_NAME = 'patient_account_id') OR (TABLE_NAME = 'form_responses' AND COLUMN_NAME = 'patient_account_id'))",
  );
  const found = new Set(columns.map((column) => `${column.TABLE_NAME}.${column.COLUMN_NAME}`));
  const required = ["mastercases.patient_account_id", "form_responses.patient_account_id"];
  const missing = required.filter((column) => !found.has(column));
  if (missing.length) {
    throw new Error(`Patient account identity migration has not been applied. Missing: ${missing.join(", ")}. Run: npm run migrate:patient-account-identity`);
  }
}

async function countCandidates(connection) {
  const [responseRows] = await connection.query(
    "SELECT COUNT(*) AS total FROM form_responses fr JOIN patient_accounts pa ON BINARY fr.identity_hash = BINARY pa.identity_hash WHERE fr.patient_account_id IS NULL AND fr.identity_hash IS NOT NULL",
  );
  const [caseRows] = await connection.query(
    "SELECT COUNT(*) AS total FROM mastercases mc JOIN patient_accounts pa ON BINARY mc.identity_hash = BINARY pa.identity_hash WHERE mc.patient_account_id IS NULL AND mc.identity_hash IS NOT NULL",
  );
  return { formResponses: Number(responseRows[0]?.total || 0), masterCases: Number(caseRows[0]?.total || 0) };
}

async function main() {
  const connection = await db.getConnection();
  try {
    await requireMigration(connection);
    const candidates = await countCandidates(connection);
    if (!apply) {
      console.log(JSON.stringify({ mode: "dry-run", candidates, action: "No data was changed. Re-run with --apply after a verified backup." }));
      return;
    }

    const runId = crypto.randomUUID();
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO patient_identity_backfill_log (run_id, entity_type, record_id, previous_patient_account_id, patient_account_id) SELECT ?, 'form_response', fr.id, fr.patient_account_id, pa.id FROM form_responses fr JOIN patient_accounts pa ON BINARY fr.identity_hash = BINARY pa.identity_hash WHERE fr.patient_account_id IS NULL AND fr.identity_hash IS NOT NULL",
      [runId],
    );
    await connection.query(
      "UPDATE form_responses fr JOIN patient_accounts pa ON BINARY fr.identity_hash = BINARY pa.identity_hash SET fr.patient_account_id = pa.id WHERE fr.patient_account_id IS NULL AND fr.identity_hash IS NOT NULL",
    );
    await connection.query(
      "INSERT INTO patient_identity_backfill_log (run_id, entity_type, record_id, previous_patient_account_id, patient_account_id) SELECT ?, 'master_case', mc.id, mc.patient_account_id, pa.id FROM mastercases mc JOIN patient_accounts pa ON BINARY mc.identity_hash = BINARY pa.identity_hash WHERE mc.patient_account_id IS NULL AND mc.identity_hash IS NOT NULL",
      [runId],
    );
    await connection.query(
      "UPDATE mastercases mc JOIN patient_accounts pa ON BINARY mc.identity_hash = BINARY pa.identity_hash SET mc.patient_account_id = pa.id WHERE mc.patient_account_id IS NULL AND mc.identity_hash IS NOT NULL",
    );
    await connection.commit();
    console.log(JSON.stringify({ mode: "apply", runId, updated: candidates }));
  } catch (error) {
    try { await connection.rollback(); } catch {}
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
