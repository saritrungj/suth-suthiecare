require("../config/env");
const db = require("../config/db");
const { schemaReadiness } = require("../services/pdpaReadiness");
async function check() {
  const schema = await schemaReadiness(db);
  const checks = {
    schema: schema.ready,
    production: process.env.NODE_ENV === "production",
    same_origin:
      !process.env.CORS_ORIGINS ||
      process.env.CORS_ORIGINS.split(",").every(
        (v) => v.trim() === new URL(process.env.FRONTEND_URL).origin,
      ),
    database_tls: Boolean(process.env.DB_TLS_CA_FILE),
    encrypted_writer: process.env.PDPA_ENCRYPTED_WRITER_ENABLED === "true",
  };
  // Infrastructure and policy confirmation is deliberately evidence-based.
  const external = [
    "network_isolation",
    "database_least_privilege",
    "disk_and_backup_encryption",
    "key_restore_drill",
    "processor_agreements",
    "organization_policy_approval",
  ];
  const evidenceArg = process.argv.find((value) =>
    value.startsWith("--evidence="),
  );
  const manifest = evidenceArg
    ? JSON.parse(require("fs").readFileSync(evidenceArg.slice(11), "utf8"))
    : {};
  const verified = Object.fromEntries(
    external.map((key) => [
      key,
      manifest[key]?.verified === true &&
        typeof manifest[key]?.reference === "string" &&
        manifest[key].reference.trim().length > 0,
    ]),
  );
  const result = {
    checks,
    missing_schema: schema.missing,
    required_external_evidence: external,
    external_evidence_verified: verified,
    production_ready:
      Object.values(checks).every(Boolean) &&
      Object.values(verified).every(Boolean),
  };
  console.log(JSON.stringify(result, null, 2));
  if (
    !schema.ready ||
    (process.argv.includes("--production") && !result.production_ready)
  )
    process.exitCode = 2;
}
check()
  .catch((e) => {
    console.error(e.code || e.name);
    process.exitCode = 1;
  })
  .finally(() => db.end());
