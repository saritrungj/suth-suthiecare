require("../config/env");
const db = require("../config/db");

async function main() {
  const connection = await db.getConnection();
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS staff_trusted_sessions (
      id BIGINT NOT NULL AUTO_INCREMENT, account_id INT NOT NULL, token_hash CHAR(64) NOT NULL,
      auth_version_snapshot INT NOT NULL DEFAULT 0, expires_at DATETIME NOT NULL, revoked_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id), UNIQUE KEY uq_staff_trusted_session_token (token_hash), KEY idx_staff_trusted_session_account (account_id, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    const [database] = await connection.query("SELECT DATABASE() AS name");
    console.log(
      JSON.stringify({
        success: true,
        database: database[0]?.name,
        complete: ["staff_trusted_sessions"],
      }),
    );
  } finally {
    connection.release();
    await db.end();
  }
}
if (require.main === module) {
  main().catch((error) => {
    console.error(`Staff trusted session migration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = main;
