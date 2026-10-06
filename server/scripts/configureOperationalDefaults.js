require("../config/env");
const db = require("../config/db");
const args = process.argv.slice(2),
  org = Number(
    args.find((v) => v.startsWith("--organization="))?.split("=")[1],
  );
async function configure() {
  if (!Number.isSafeInteger(org) || org < 1)
    throw new Error("EXPLICIT_ORGANIZATION_REQUIRED");
  if (
    process.env.NODE_ENV === "production" &&
    args.includes("--apply") &&
    !args.includes("--allow-production")
  )
    throw new Error("PRODUCTION_RELEASE_GATE_REQUIRED");
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [organizations] = await c.query(
      "SELECT id FROM organizations WHERE id=? AND status='active' AND org_level='unit' FOR UPDATE",
      [org],
    );
    if (!organizations.length) throw new Error("ORGANIZATION_NOT_FOUND");
    const defaults = [
      {
        table: "case_statuses",
        names: ["รอดำเนินการ", "กำลังติดตาม", "เสร็จสิ้น"],
      },
      { table: "service_types", names: ["รับบริการ", "ติดตามผล"] },
    ];
    const planned = [];
    for (const def of defaults)
      for (const name of def.names) {
        const [existing] = await c.query(
          `SELECT id FROM ${def.table} WHERE organization_id=? AND name=?`,
          [org, name],
        );
        if (!existing.length) {
          planned.push({ table: def.table, name });
          if (args.includes("--apply"))
            await c.query(
              `INSERT INTO ${def.table} (organization_id,name${def.table === "case_statuses" ? ",clinic_type" : ""}) VALUES (?,?${def.table === "case_statuses" ? ',"general"' : ""})`,
              [org, name],
            );
        }
      }
    if (args.includes("--apply"))
      await require("../utils/pdpaAudit").requiredAudit(
        { organizationContext: org, get: () => "deployment-cli" },
        "lookup.defaults.create",
        "organization",
        org,
        { count: planned.length },
        c,
      );
    if (args.includes("--apply")) await c.commit();
    else await c.rollback();
    console.log(
      JSON.stringify({
        organization_id: org,
        dry_run: !args.includes("--apply"),
        created: planned,
      }),
    );
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
configure()
  .catch((e) => {
    console.error(e.code || e.name);
    process.exitCode = 1;
  })
  .finally(() => db.end());
