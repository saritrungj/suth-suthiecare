require("../config/env");
const crypto = require("crypto");
const {
  sealJson,
  sealText,
  readJson,
  parseEnvelope,
  openJson,
  fieldContext,
} = require("../utils/privateData");
const { decryptSummaryData } = require("../utils/decryptCaseData");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
const email = require("../utils/accountEmail");
const mismatch = () => {
  require("../utils/privacyTelemetry").record("migration_mismatch");
  return Object.assign(new Error("RECONCILIATION_MISMATCH"), {
    code: "RECONCILIATION_MISMATCH",
  });
};
function legacySummary(value) {
  let parsed = typeof value === "string" ? JSON.parse(legacy(value)) : value;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("INVALID_LEGACY_SUMMARY");
  // The compatibility reader is safe here only after strict JSON/decryption above.
  return decryptSummaryData(parsed, legacy);
}
// Ambiguous or damaged legacy ciphertext is quarantined, never treated as text.
function legacy(value) {
  if (value == null || typeof value !== "string" || !value) return value;
  if (parseEnvelope(value)) return openJson(value);
  if (
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value) ||
    value.length % 4 ||
    value.length < 44
  )
    return value;
  const bytes = Buffer.from(value, "base64");
  try {
    const cipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(process.env.AES_KEY, "hex"),
      bytes.subarray(0, 16),
    );
    cipher.setAuthTag(bytes.subarray(16, 32));
    return Buffer.concat([
      cipher.update(bytes.subarray(32)),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw Object.assign(new Error("LEGACY_DECRYPT_FAILED"), {
      code: "LEGACY_DECRYPT_FAILED",
    });
  }
}
const definitions = [
  {
    table: "form_responses",
    owner: "t.organization_id",
    json: { summary_data: (r) => legacySummary(r.summary_data) },
    text: ["identity_value", "risk_level"],
  },
  {
    table: "form_answers",
    join: "JOIN form_responses fr ON fr.id=t.response_id",
    owner: "fr.organization_id",
    json: {
      answer_value: (r) =>
        normalizeStoredAnswer(r.answer_value, r.question_title, legacy),
    },
  },
  {
    table: "mastercases",
    owner: "t.organization_id",
    json: { clinical_data: (r) => readJson(r.clinical_data) },
    text: ["identityValue", "overall_risk"],
  },
  {
    table: "case_logs",
    join: "LEFT JOIN form_responses fr ON fr.id=t.response_id LEFT JOIN mastercases mc ON mc.id=t.master_case_id",
    owner:
      "CASE WHEN t.master_case_id IS NOT NULL AND (mc.id IS NULL OR fr.id IS NULL OR mc.organization_id<>fr.organization_id OR mc.id<>fr.master_case_id) THEN NULL ELSE COALESCE(fr.organization_id,mc.organization_id) END",
    text: ["staff", "detail"],
  },
  {
    table: "appointments",
    join: "LEFT JOIN form_responses fr ON fr.id=t.case_id LEFT JOIN mastercases mc ON mc.id=COALESCE(t.master_case_id,fr.master_case_id)",
    owner:
      "CASE WHEN t.case_id IS NOT NULL AND (mc.id IS NULL OR fr.id IS NULL OR mc.organization_id<>fr.organization_id OR mc.id<>fr.master_case_id) THEN NULL ELSE COALESCE(fr.organization_id,mc.organization_id) END",
    payload: "clinical_payload_encrypted",
    contextField: "clinical",
    plain: ["risk_id"],
    text: ["staff", "note"],
  },
  { table: "staffs", owner: "t.organization_id", text: ["fullname"] },
  { table: "note_templates", owner: "t.organization_id", text: ["text"] },
  {
    table: "case_referrals",
    owner: "t.source_organization_id",
    text: ["display_name_encrypted", "reason_encrypted"],
  },
  {
    table: "case_referral_updates",
    owner: "t.organization_id",
    text: ["actor_name_encrypted", "summary_encrypted"],
  },
  {
    table: "school_student_health_profiles",
    pk: "student_id",
    join: "JOIN school_students st ON st.id=t.student_id JOIN schools s ON s.id=st.school_id",
    owner: "s.organization_id",
    payload: "health_payload_encrypted",
    contextField: "health",
    plain: ["blood_type"],
    text: [
      "chronic_conditions_encrypted",
      "allergies_encrypted",
      "medications_encrypted",
      "emergency_contact_name_encrypted",
      "emergency_contact_phone_encrypted",
      "notes_encrypted",
    ],
  },
  {
    table: "school_student_physical_records",
    join: "JOIN school_students st ON st.id=t.student_id JOIN schools s ON s.id=st.school_id",
    owner: "s.organization_id",
    payload: "measurements_encrypted",
    contextField: "measurements",
    plain: [
      "weight_kg",
      "height_cm",
      "bmi",
      "systolic",
      "diastolic",
      "pulse",
      "vision_left",
      "vision_right",
      "hearing_left",
      "hearing_right",
    ],
    text: ["note_encrypted"],
  },
  {
    table: "school_students",
    join: "JOIN schools s ON s.id=t.school_id",
    owner: "s.organization_id",
    text: [
      "first_name_encrypted",
      "last_name_encrypted",
      "nickname_encrypted",
      "birth_date_encrypted",
    ],
  },
  {
    table: "school_teachers",
    join: "JOIN schools s ON s.id=t.school_id",
    owner: "s.organization_id",
    text: ["phone_encrypted"],
  },
  {
    table: "persons",
    global: true,
    text: [
      "identity_value_encrypted",
      "first_name_encrypted",
      "last_name_encrypted",
      "display_name_encrypted",
    ],
  },
  { table: "users", global: true, email: true, text: ["name", "phone"] },
  {
    table: "patient_accounts",
    global: true,
    email: true,
    text: ["first_name_encrypted", "last_name_encrypted", "phone_encrypted"],
  },
  { table: "auth_email_challenges", global: true, destination: true },
];
function changesFor(def, row, { clearLegacy = false } = {}) {
  if (
    !def.global &&
    (!Number.isSafeInteger(Number(row.owner_id)) || Number(row.owner_id) < 1)
  )
    throw Object.assign(new Error("OWNER_UNRESOLVED"), {
      code: "OWNER_UNRESOLVED",
    });
  const result = {},
    org = def.global ? null : row.owner_id;
  for (const [column, read] of Object.entries(def.json || {})) {
    if (row[column] == null) continue;
    const parsed =
      typeof row[column] === "string"
        ? (() => {
            try {
              return JSON.parse(row[column]);
            } catch {
              return row[column];
            }
          })()
        : row[column];
    const context = fieldContext(def.table, column, org);
    if (parseEnvelope(parsed)) {
      openJson(parsed, context);
      continue;
    }
    const value = read(row),
      sealed = sealJson(value, context);
    if (JSON.stringify(openJson(sealed, context)) !== JSON.stringify(value))
      throw new Error("ROUNDTRIP_MISMATCH");
    result[column] = JSON.stringify(sealed);
  }
  for (const column of def.text || []) {
    if (row[column] == null || row[column] === "") continue;
    if (parseEnvelope(row[column])) {
      const context = fieldContext(def.table, column, org),
        envelope = parseEnvelope(row[column]);
      const value = openJson(
        row[column],
        envelope.context === "legacy-field" ? undefined : context,
      );
      if (envelope.context === "legacy-field")
        result[column] = sealText(value, context);
      continue;
    }
    result[column] = sealText(
      legacy(row[column]),
      fieldContext(def.table, column, org),
    );
  }
  if (def.payload) {
    const context = fieldContext(def.table, def.contextField, org);
    if (row[def.payload]) {
      const protectedValue = openJson(row[def.payload], context);
      if (clearLegacy)
        for (const key of def.plain)
          if (
            row[key] != null &&
            !(key === "blood_type" && row[key] === "unknown") &&
            JSON.stringify(row[key]) !== JSON.stringify(protectedValue[key])
          )
            throw mismatch();
    } else
      result[def.payload] = sealText(
        Object.fromEntries(def.plain.map((key) => [key, row[key]])),
        context,
      );
    if (clearLegacy)
      for (const key of def.plain)
        result[key] = key === "blood_type" ? "unknown" : null;
  }
  if (def.email)
    for (const field of ["email", "pending_email"]) {
      if (row[field + "_encrypted"]) {
        const decoded = email.decode(row, def.table, field);
        if (
          clearLegacy &&
          row[field] &&
          String(row[field]).trim().toLowerCase() !== decoded
        )
          throw mismatch();
      } else if (row[field]) {
        result[field + "_encrypted"] = email.encode(
          row[field],
          def.table,
          field,
        );
        result[field + "_hash"] = email.lookup(row[field]);
      }
      if (clearLegacy && row[field]) result[field] = null;
    }
  if (def.destination) {
    if (row.destination_encrypted) {
      const decoded = email.decode(row, def.table, "destination");
      if (
        clearLegacy &&
        row.destination &&
        String(row.destination).trim().toLowerCase() !== decoded
      )
        throw mismatch();
    } else if (row.destination)
      result.destination_encrypted = email.encode(
        row.destination,
        def.table,
        "destination",
      );
    if (clearLegacy) result.destination = "";
  }
  return result;
}
async function run(
  db,
  {
    apply = false,
    batch = 100,
    resume = false,
    clearLegacy = false,
    onProgress = () => {},
  } = {},
) {
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > 1000)
    throw new Error("INVALID_BATCH");
  const c = await db.getConnection(),
    results = [];
  try {
    const [[lock]] = await c.query(
      'SELECT GET_LOCK(CONCAT(DATABASE(),":pdpa-private-v1"),0) AS acquired',
    );
    if (!lock?.acquired) throw new Error("MIGRATION_ALREADY_RUNNING");
    for (const def of definitions) {
      const [exists] = await c.query(
        "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?",
        [def.table],
      );
      if (!exists.length) {
        results.push({ table: def.table, skipped: true });
        continue;
      }
      const migrationKey =
        "private-v1:" + def.table + (clearLegacy ? ":clear" : "");
      let lastId = 0,
        completed = 0,
        failed = 0;
      if (resume && apply) {
        const [p] = await c.query(
          "SELECT * FROM pdpa_migration_progress WHERE migration_key=?",
          [migrationKey],
        );
        lastId = Number(p[0]?.last_id || 0);
      }
      while (true) {
        const priorFailed = failed;
        await c.beginTransaction();
        const [rows] = await c.query(
          `SELECT t.*,${def.global ? "NULL" : def.owner} AS owner_id FROM ${def.table} t ${def.join || ""} WHERE t.${def.pk || "id"}>? ORDER BY t.${def.pk || "id"} LIMIT ? FOR UPDATE`,
          [lastId, batch],
        );
        if (!rows.length) {
          await c.rollback();
          break;
        }
        for (const row of rows) {
          if (apply) await c.query("SAVEPOINT pdpa_record");
          try {
            const changes = changesFor(def, row, { clearLegacy });
            if (apply && Object.keys(changes).length) {
              await c.query(
                `UPDATE ${def.table} SET ${Object.keys(changes)
                  .map((key) => key + "=?")
                  .join(",")} WHERE ${def.pk || "id"}=?`,
                [...Object.values(changes), row[def.pk || "id"]],
              );
              const [[saved]] = await c.query(
                `SELECT * FROM ${def.table} WHERE ${def.pk || "id"}=?`,
                [row[def.pk || "id"]],
              );
              for (const [key, value] of Object.entries(changes)) {
                let actual = saved[key],
                  expected = value;
                if (def.json?.[key]) {
                  if (typeof actual === "string") actual = JSON.parse(actual);
                  expected = JSON.parse(expected);
                }
                if (!require("node:util").isDeepStrictEqual(actual, expected))
                  throw mismatch();
              }
            }
            if (apply)
              await c.query(
                "DELETE FROM pdpa_migration_issues WHERE migration_key=? AND record_id=?",
                [migrationKey, row[def.pk || "id"]],
              );
            completed++;
          } catch (error) {
            failed++;
            if (apply) {
              await c.query("ROLLBACK TO SAVEPOINT pdpa_record");
              await c.query(
                "INSERT INTO pdpa_migration_issues (migration_key,record_id,reason_code) VALUES (?,?,?) ON DUPLICATE KEY UPDATE reason_code=VALUES(reason_code)",
                [
                  migrationKey,
                  row[def.pk || "id"],
                  [
                    "OWNER_UNRESOLVED",
                    "LEGACY_DECRYPT_FAILED",
                    "RECONCILIATION_MISMATCH",
                  ].includes(error.code)
                    ? error.code
                    : "PRIVATE_DATA_INVALID",
                ],
              );
            }
          }
          lastId = row[def.pk || "id"];
        }
        if (apply) {
          await c.query(
            "INSERT INTO pdpa_migration_progress (migration_key,last_id,completed_count,failed_count) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE last_id=VALUES(last_id),completed_count=completed_count+VALUES(completed_count),failed_count=failed_count+VALUES(failed_count)",
            [
              migrationKey,
              lastId,
              rows.length - (failed - priorFailed),
              failed - priorFailed,
            ],
          );
          await c.commit();
        } else await c.rollback();
        onProgress({
          table: def.table,
          last_id: lastId,
          checked: completed + failed,
          failed,
          dry_run: !apply,
        });
      }
      results.push({ table: def.table, last_id: lastId, completed, failed });
    }
    return { dry_run: !apply, clear_legacy: clearLegacy, results };
  } finally {
    await c
      .query('SELECT RELEASE_LOCK(CONCAT(DATABASE(),":pdpa-private-v1"))')
      .catch(() => {});
    c.release();
  }
}
if (require.main === module) {
  const args = process.argv.slice(2),
    db = require("../config/db");
  const options = {
    apply: args.includes("--apply"),
    resume: args.includes("--resume"),
    batch: Number(
      args.find((v) => v.startsWith("--batch="))?.split("=")[1] || 100,
    ),
    clearLegacy: args.includes("--clear-legacy"),
    onProgress: (value) => console.log(JSON.stringify(value)),
  };
  if (
    options.clearLegacy &&
    (!args.includes("--reconciled") || !options.apply)
  ) {
    console.error("CLEAR_REQUIRES_APPLY_AND_RECONCILED");
    db.end();
    process.exitCode = 1;
  } else if (
    process.env.NODE_ENV === "production" &&
    options.apply &&
    !args.includes("--allow-production")
  ) {
    console.error("PRODUCTION_RELEASE_GATE_REQUIRED");
    db.end();
    process.exitCode = 1;
  } else
    run(db, options)
      .then((value) => {
        console.log(JSON.stringify(value));
        if (value.results.some((r) => r.failed)) process.exitCode = 2;
      })
      .catch((e) => {
        console.error(e.code || e.name);
        process.exitCode = 1;
      })
      .finally(() => db.end());
}
module.exports = { run, changesFor, definitions, legacy };
