require("../config/env");
const db = require("../config/db");
const fs = require("fs"),
  path = require("path"),
  crypto = require("crypto");
const tables = [
  "forms",
  "form_responses",
  "mastercases",
  "staffs",
  "service_types",
  "note_templates",
  "case_statuses",
];
async function inventory() {
  const ownership = [];
  for (const table of tables) {
    const [[counts]] = await db.query(
      `SELECT COUNT(*) AS total,SUM(organization_id IS NULL) AS unassigned FROM ${table}`,
    );
    ownership.push({
      table,
      total: Number(counts.total),
      unassigned: Number(counts.unassigned || 0),
    });
  }
  const [[relationships]] = await db.query(
    "SELECT COUNT(*) AS invalid FROM form_responses fr JOIN mastercases mc ON mc.id=fr.master_case_id WHERE fr.organization_id IS NULL OR mc.organization_id IS NULL OR fr.organization_id<>mc.organization_id",
  );
  const privateDir = path.join(__dirname, "../private/docs");
  const files = fs.existsSync(privateDir)
    ? fs
        .readdirSync(privateDir)
        .filter((name) => name.endsWith(".pdf"))
        .map((name) => ({
          name,
          storage: "private",
          sha256: crypto
            .createHash("sha256")
            .update(fs.readFileSync(path.join(privateDir, name)))
            .digest("hex"),
        }))
    : [];
  const privateTables = require("./backfillPrivateData").definitions.map(
    (item) => item.table,
  );
  const [schema] = await db.query(
    "SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,COLUMN_TYPE AS sql_type,IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (?) ORDER BY TABLE_NAME,ORDINAL_POSITION",
    [privateTables],
  );
  console.log(
    JSON.stringify(
      {
        ownership,
        invalid_case_relationships: Number(relationships.invalid),
        schema,
        private_files: files,
      },
      null,
      2,
    ),
  );
}
inventory()
  .catch((e) => {
    console.error(e.code || e.name);
    process.exitCode = 1;
  })
  .finally(() => db.end());
