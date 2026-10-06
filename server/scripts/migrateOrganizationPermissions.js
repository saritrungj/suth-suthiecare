require("../config/env");
const fs = require("fs"),
  path = require("path");
async function migrate(db) {
  const connection = db.getConnection ? await db.getConnection() : db;
  let locked = false,
    initialized = 0;
  try {
    const [[lock]] = await connection.query(
      'SELECT GET_LOCK("suth_organization_permissions",30) AS acquired',
    );
    if (Number(lock.acquired) !== 1)
      throw new Error("ORGANIZATION_PERMISSION_MIGRATION_LOCKED");
    locked = true;
    const ddl = fs.readFileSync(
      path.join(
        __dirname,
        "../migrations/20261003_organization_role_permissions.sql",
      ),
      "utf8",
    );
    for (const statement of ddl
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean))
      await connection.query(statement);
    const [completed] = await connection.query(
      'SELECT last_id FROM pdpa_migration_progress WHERE migration_key="organization-permissions:v1"',
    );
    if (Number(completed[0]?.last_id) === 1) return { initialized: 0 };
    // Snapshot each existing template once. Later template edits and subsequent
    // migrations cannot overwrite rights already configured for a unit.
    const [pairs] = await connection.query(
      "SELECT o.id AS organization_id,r.id AS role_id FROM organizations o CROSS JOIN roles r WHERE o.org_level='unit'",
    );
    for (const pair of pairs) {
      await connection.beginTransaction();
      try {
        const [result] = await connection.query(
          'INSERT IGNORE INTO organization_role_permission_sets (organization_id,role_id,source) VALUES (?,?,"legacy_snapshot")',
          [pair.organization_id, pair.role_id],
        );
        if (result.affectedRows) {
          await connection.query(
            "INSERT INTO organization_role_permissions (organization_id,role_id,permission_key) SELECT ?,role_id,permission_key FROM role_permissions WHERE role_id=?",
            [pair.organization_id, pair.role_id],
          );
          initialized++;
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }
    await connection.query(
      'INSERT INTO pdpa_migration_progress (migration_key,last_id,completed_count) VALUES ("organization-permissions:v1",1,?) ON DUPLICATE KEY UPDATE last_id=1,completed_count=completed_count+VALUES(completed_count)',
      [initialized],
    );
    return { initialized };
  } finally {
    if (locked)
      await connection.query(
        'SELECT RELEASE_LOCK("suth_organization_permissions")',
      );
    if (db.getConnection) connection.release();
  }
}
async function main() {
  if (!process.argv.includes("--apply"))
    throw new Error("USE_APPLY_FOR_SCHEMA_MIGRATION");
  if (
    process.env.NODE_ENV === "production" &&
    !process.argv.includes("--allow-production")
  )
    throw new Error("PRODUCTION_RELEASE_GATE_REQUIRED");
  const db = require("../config/db");
  try {
    console.log(
      JSON.stringify({
        migration: "organization_role_permissions",
        ...(await migrate(db)),
      }),
    );
  } finally {
    await db.end();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.code || error.message);
    process.exitCode = 1;
  });
module.exports = { migrate };
