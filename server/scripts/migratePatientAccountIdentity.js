require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });
const db = require("../config/db");

async function has(connection, type, name) {
  const sql = {
    column: "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1",
    index: "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    constraint: "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? LIMIT 1",
  }[type];
  const [rows] = await connection.query(sql, name);
  return Boolean(rows[0]);
}

async function main() {
  const connection = await db.getConnection();
  const completed = [];
  try {
    if (!(await has(connection, "column", ["mastercases", "patient_account_id"]))) {
      await connection.query("ALTER TABLE mastercases ADD COLUMN patient_account_id INT NULL AFTER id");
      completed.push("mastercases.patient_account_id added");
    }

    await connection.query("ALTER TABLE mastercases MODIFY identityValue VARCHAR(255) NULL");
    completed.push("mastercases.identityValue accepts NULL");

    if (!(await has(connection, "index", ["mastercases", "idx_mastercases_account_clinic_status"]))) {
      await connection.query("CREATE INDEX idx_mastercases_account_clinic_status ON mastercases (patient_account_id, clinicType, status)");
      completed.push("master case account index added");
    }
    if (!(await has(connection, "index", ["form_responses", "idx_form_responses_patient_account"]))) {
      await connection.query("CREATE INDEX idx_form_responses_patient_account ON form_responses (patient_account_id, submitted_at)");
      completed.push("form response account index added");
    }
    if (!(await has(connection, "constraint", ["mastercases", "fk_mastercases_patient_account"]))) {
      await connection.query("ALTER TABLE mastercases ADD CONSTRAINT fk_mastercases_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id) ON DELETE SET NULL");
      completed.push("master case account foreign key added");
    }
    if (!(await has(connection, "constraint", ["form_responses", "fk_form_responses_patient_account"]))) {
      await connection.query("ALTER TABLE form_responses ADD CONSTRAINT fk_form_responses_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id) ON DELETE SET NULL");
      completed.push("form response account foreign key added");
    }
    await connection.query(`CREATE TABLE IF NOT EXISTS patient_identity_backfill_log (
      id BIGINT NOT NULL AUTO_INCREMENT,
      run_id CHAR(36) NOT NULL,
      entity_type ENUM('form_response', 'master_case') NOT NULL,
      record_id BIGINT NOT NULL,
      previous_patient_account_id INT NULL,
      patient_account_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_patient_identity_backfill (run_id, entity_type, record_id),
      KEY idx_patient_identity_backfill_record (entity_type, record_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    completed.push("backfill audit log is ready");

    const [database] = await connection.query("SELECT DATABASE() AS name");
    console.log(JSON.stringify({ success: true, database: database[0]?.name, completed }));
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => { console.error(`Migration failed: ${error.message}`); process.exitCode = 1; });
