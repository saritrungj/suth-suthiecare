const db = require("../config/db");

const requiredTables = [
  "users",
  "forms",
  "clinics",
  "mastercases",
  "patient_accounts",
];

async function main() {
  try {
    const [versionRows] = await db.query(
      "SELECT VERSION() AS version, DATABASE() AS database_name",
    );
    const connection = versionRows[0];

    if (!String(connection.version || "").startsWith("8.4.")) {
      throw new Error(
        `Expected MySQL 8.4 from local Docker, received ${connection.version || "unknown"}.`,
      );
    }

    const [rows] = await db.query("SHOW TABLES");
    const tableNames = new Set(rows.map((row) => Object.values(row)[0]));
    const missingTables = requiredTables.filter((table) => !tableNames.has(table));

    if (missingTables.length) {
      throw new Error(`Local schema is missing required tables: ${missingTables.join(", ")}.`);
    }

    console.log(
      JSON.stringify({
        status: "ok",
        mysqlVersion: connection.version,
        database: connection.database_name,
        requiredTables: requiredTables.length,
      }),
    );
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      status: "error",
      code: error.code || null,
      message: error.message,
    }),
  );
  process.exitCode = 1;
});
