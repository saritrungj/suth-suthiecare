require("../config/env");
const db = require("../config/db");

async function hasColumn(connection, table, column) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1",
    [table, column],
  );
  return Boolean(rows[0]);
}

async function main() {
  const connection = await db.getConnection();
  const complete = [];
  try {
    const columns = [
      ["users", "email_verified_at", "DATETIME NULL"],
      ["users", "pending_email", "VARCHAR(254) NULL"],
      ["users", "auth_version", "INT NOT NULL DEFAULT 0"],
      ["patient_accounts", "email", "VARCHAR(254) NULL"],
      ["patient_accounts", "email_verified_at", "DATETIME NULL"],
      ["patient_accounts", "pending_email", "VARCHAR(254) NULL"],
      ["patient_accounts", "auth_version", "INT NOT NULL DEFAULT 0"],
    ];
    for (const [table, column, definition] of columns) {
      if (!(await hasColumn(connection, table, column))) {
        await connection.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
        );
        complete.push(`${table}.${column}`);
      }
    }
    await connection.query(`CREATE TABLE IF NOT EXISTS auth_email_challenges (
      id BIGINT NOT NULL AUTO_INCREMENT, token_hash CHAR(64) NOT NULL, account_type ENUM('staff','patient') NOT NULL, account_id INT NOT NULL,
      purpose ENUM('staff_login','email_verification','account_recovery') NOT NULL, destination VARCHAR(254) NOT NULL, otp_hmac CHAR(64) NOT NULL,
      generation INT NOT NULL DEFAULT 1, auth_version_snapshot INT NOT NULL DEFAULT 0, attempts INT NOT NULL DEFAULT 0,
      expires_at DATETIME NOT NULL, resend_after DATETIME NOT NULL, consumed_at DATETIME NULL, invalidated_at DATETIME NULL,
      send_status ENUM('sending','sent','failed') NOT NULL DEFAULT 'sending', provider_message_id VARCHAR(255) NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY uq_auth_email_challenge_token (token_hash), KEY idx_auth_email_challenge_account (account_type, account_id, purpose, created_at), KEY idx_auth_email_challenge_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    complete.push("auth_email_challenges");
    await connection.query(
      "CREATE TABLE IF NOT EXISTS email_send_usage (period ENUM('day','month') NOT NULL, bucket CHAR(10) NOT NULL, sent_count INT NOT NULL DEFAULT 0, PRIMARY KEY (period, bucket)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    );
    complete.push("email_send_usage");
    const [database] = await connection.query("SELECT DATABASE() AS name");
    console.log(
      JSON.stringify({ success: true, database: database[0]?.name, complete }),
    );
  } finally {
    connection.release();
    await db.end();
  }
}
if (require.main === module) {
  main().catch((error) => {
    console.error(`Email OTP migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = main;
