// Builds one person record per human from existing data and links every
// Master Case and response to it. Runs inside one transaction: without
// --apply it rolls back, so a dry run reports exactly what would change.
//   node scripts/backfillPersons.js            (dry run)
//   node scripts/backfillPersons.js --apply
require("../config/env");
const db = require("../config/db");
const { encrypt, decrypt } = require("../utils/encryption");
const { normalizeNationalId } = require("../utils/personIdentity");

const apply = process.argv.includes("--apply");
const safeDecrypt = (value) => {
  try {
    return decrypt(value) || "";
  } catch {
    return "";
  }
};

async function main() {
  const connection = await db.getConnection();
  const report = {};
  const count = (key, n = 1) => (report[key] = (report[key] || 0) + n);
  try {
    await connection.beginTransaction();

    // 1. One person per patient account. A person already holding the account's
    //    hash (from a guest submission) is linked instead of duplicated.
    const [accounts] = await connection.query(
      "SELECT id, identity_hash, first_name_encrypted, last_name_encrypted FROM patient_accounts",
    );
    for (const account of accounts) {
      const [[byAccount]] = await connection.query(
        "SELECT id FROM persons WHERE patient_account_id = ? LIMIT 1",
        [account.id],
      );
      if (byAccount) continue;
      const [[byHash]] = account.identity_hash
        ? await connection.query(
            "SELECT id FROM persons WHERE identity_hash = ? AND patient_account_id IS NULL AND merged_into_person_id IS NULL LIMIT 1",
            [account.identity_hash],
          )
        : [[null]];
      if (byHash) {
        await connection.query(
          "UPDATE persons SET patient_account_id = ?, first_name_encrypted = ?, last_name_encrypted = ? WHERE id = ?",
          [
            account.id,
            account.first_name_encrypted,
            account.last_name_encrypted,
            byHash.id,
          ],
        );
        count("persons_linked_to_account");
      } else {
        await connection.query(
          "INSERT INTO persons (patient_account_id, identity_hash, first_name_encrypted, last_name_encrypted) VALUES (?, ?, ?, ?)",
          [
            account.id,
            account.identity_hash || null,
            account.first_name_encrypted,
            account.last_name_encrypted,
          ],
        );
        count("persons_created_from_accounts");
      }
    }

    // 2. One person per national ID hash seen on cases or responses. A hash is
    //    only trusted when its stored value decrypts to a valid national ID, so
    //    walk-in placeholders and passports do not become people.
    const [hashes] = await connection.query(
      `SELECT identity_hash, MAX(identity_value) AS identity_value FROM (
         SELECT identity_hash, identityValue AS identity_value FROM mastercases WHERE identity_hash IS NOT NULL
         UNION ALL
         SELECT identity_hash, identity_value FROM form_responses WHERE identity_hash IS NOT NULL
       ) seen
       WHERE identity_hash NOT IN (SELECT identity_hash FROM persons WHERE identity_hash IS NOT NULL)
       GROUP BY identity_hash`,
    );
    for (const row of hashes) {
      const digits = normalizeNationalId(safeDecrypt(row.identity_value));
      if (!digits) {
        count("hashes_skipped_not_national_id");
        continue;
      }
      await connection.query(
        "INSERT INTO persons (identity_hash, identity_value_encrypted) VALUES (?, ?)",
        [row.identity_hash, encrypt(digits)],
      );
      count("persons_created_from_identity");
    }

    // 3. Unlinked legacy cases whose hash belongs to an account join the account.
    const [linkedCases] = await connection.query(
      `UPDATE mastercases mc JOIN patient_accounts pa ON pa.identity_hash = mc.identity_hash COLLATE utf8mb4_unicode_ci
          SET mc.patient_account_id = pa.id
        WHERE mc.patient_account_id IS NULL`,
    );
    count("legacy_cases_linked_to_account", linkedCases.affectedRows);
    const [linkedResponses] = await connection.query(
      `UPDATE form_responses fr JOIN mastercases mc ON mc.id = fr.master_case_id
          SET fr.patient_account_id = mc.patient_account_id
        WHERE fr.patient_account_id IS NULL AND mc.patient_account_id IS NOT NULL`,
    );
    count("legacy_responses_linked_to_account", linkedResponses.affectedRows);

    // 4. Point cases and responses at their person.
    const updates = [
      [
        "cases_by_account",
        `UPDATE mastercases mc JOIN persons p ON p.patient_account_id = mc.patient_account_id
            SET mc.person_id = p.id WHERE mc.person_id IS NULL`,
      ],
      [
        "cases_by_identity",
        `UPDATE mastercases mc JOIN persons p ON p.identity_hash = mc.identity_hash
            SET mc.person_id = p.id WHERE mc.person_id IS NULL AND p.merged_into_person_id IS NULL`,
      ],
      [
        "responses_by_case",
        `UPDATE form_responses fr JOIN mastercases mc ON mc.id = fr.master_case_id
            SET fr.person_id = mc.person_id WHERE fr.person_id IS NULL AND mc.person_id IS NOT NULL`,
      ],
      [
        "responses_by_account",
        `UPDATE form_responses fr JOIN persons p ON p.patient_account_id = fr.patient_account_id
            SET fr.person_id = p.id WHERE fr.person_id IS NULL`,
      ],
      [
        "responses_by_identity",
        `UPDATE form_responses fr JOIN persons p ON p.identity_hash = fr.identity_hash
            SET fr.person_id = p.id WHERE fr.person_id IS NULL AND p.merged_into_person_id IS NULL`,
      ],
    ];
    for (const [key, sql] of updates) {
      const [result] = await connection.query(sql);
      count(key, result.affectedRows);
    }

    // 5. Account-linked responses without a name get the account name.
    const [unnamed] = await connection.query(
      `SELECT fr.id, fr.summary_data, pa.first_name_encrypted, pa.last_name_encrypted
         FROM form_responses fr JOIN patient_accounts pa ON pa.id = fr.patient_account_id`,
    );
    for (const row of unnamed) {
      let summary = row.summary_data;
      if (typeof summary === "string") {
        try {
          summary = JSON.parse(summary);
        } catch {
          continue;
        }
      }
      summary = summary || {};
      const current = summary.display_name
        ? safeDecrypt(summary.display_name) || summary.display_name
        : "";
      if (current && String(current).trim() !== "-") continue;
      const name = [row.first_name_encrypted, row.last_name_encrypted]
        .map((value) => (value ? safeDecrypt(value) : ""))
        .filter(Boolean)
        .join(" ");
      if (!name) continue;
      summary.display_name = encrypt(name);
      summary.display_name_source = "account";
      await connection.query(
        "UPDATE form_responses SET summary_data = ? WHERE id = ?",
        [JSON.stringify(summary), row.id],
      );
      count("responses_named_from_account");
    }

    const [[totals]] = await connection.query(
      `SELECT (SELECT COUNT(*) FROM persons WHERE merged_into_person_id IS NULL) AS persons,
              (SELECT COUNT(*) FROM mastercases WHERE person_id IS NULL) AS cases_without_person,
              (SELECT COUNT(*) FROM form_responses WHERE person_id IS NULL) AS responses_without_person`,
    );

    if (apply) await connection.commit();
    else await connection.rollback();
    console.log(
      JSON.stringify(
        { mode: apply ? "applied" : "dry-run (rolled back)", report, totals },
        null,
        2,
      ),
    );
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

main().catch((error) => {
  console.error(`Person backfill failed: ${error.message}`);
  process.exitCode = 1;
});
