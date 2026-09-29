require("../config/env");
const db = require("../config/db");

const tables = [
  ["staffs", "idx_staffs_organization"],
  ["service_types", "idx_service_types_organization"],
  ["case_statuses", "idx_case_statuses_organization"],
  ["note_templates", "idx_note_templates_organization"],
  ["dashboard_settings", "idx_dashboard_settings_organization"],
];

async function exists(connection, kind, table, name) {
  const [rows] = await connection.query(
    kind === "column"
      ? "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? LIMIT 1"
      : kind === "index"
        ? "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=? LIMIT 1"
        : "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=? LIMIT 1",
    [table, name],
  );
  return Boolean(rows[0]);
}

async function main() {
  const connection = await db.getConnection();
  const applied = [];
  try {
    const [[organization]] = await connection.query(
      "SELECT MIN(id) id FROM organizations WHERE name=?",
      ["โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี"],
    );
    if (!organization?.id) throw new Error("ไม่พบหน่วยงานโรงพยาบาล มทส.");
    for (const [table, index] of tables) {
      if (!(await exists(connection, "column", table, "organization_id"))) {
        await connection.query(
          `ALTER TABLE \`${table}\` ADD COLUMN organization_id INT NULL`,
        );
        applied.push(`${table}.organization_id`);
      }
      if (!(await exists(connection, "index", table, index))) {
        await connection.query(
          `CREATE INDEX \`${index}\` ON \`${table}\` (organization_id)`,
        );
        applied.push(index);
      }
      await connection.query(
        `UPDATE \`${table}\` SET organization_id=? WHERE organization_id IS NULL`,
        [organization.id],
      );
      const constraint = `fk_${table}_organization`;
      if (!(await exists(connection, "constraint", table, constraint))) {
        await connection.query(
          `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraint}\` FOREIGN KEY (organization_id) REFERENCES organizations(id)`,
        );
        applied.push(constraint);
      }
    }
    await connection.query(
      "UPDATE note_templates nt JOIN clinics c ON BINARY c.slug=BINARY nt.clinic_type SET nt.organization_id=c.organization_id WHERE c.organization_id IS NOT NULL",
    );
    await connection.query(
      "UPDATE case_statuses cs JOIN clinics c ON BINARY c.slug=BINARY cs.clinic_type SET cs.organization_id=c.organization_id WHERE c.organization_id IS NOT NULL AND cs.clinic_type NOT IN ('all','general')",
    );
    const [counts] = await connection.query(
      "SELECT 'staffs' table_name,COUNT(*) total,SUM(organization_id IS NULL) unassigned FROM staffs UNION ALL SELECT 'service_types',COUNT(*),SUM(organization_id IS NULL) FROM service_types UNION ALL SELECT 'case_statuses',COUNT(*),SUM(organization_id IS NULL) FROM case_statuses UNION ALL SELECT 'note_templates',COUNT(*),SUM(organization_id IS NULL) FROM note_templates UNION ALL SELECT 'dashboard_settings',COUNT(*),SUM(organization_id IS NULL) FROM dashboard_settings",
    );
    console.log(JSON.stringify({ success: true, applied, ownership: counts }));
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error(`Operational organization migration failed: ${error.message}`);
  process.exitCode = 1;
});
