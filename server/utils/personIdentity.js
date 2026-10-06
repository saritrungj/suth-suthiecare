// One person record per human. Responses and per-clinic Master Cases point at
// it, so staff can see every assessment of the same person in one place.
// Stable keys: patient_account_id and identity_hash (HMAC of the 13 digit
// national ID, digits only). Names and phone numbers are never used to match.
const { encrypt, hmacHash, validateThaiId } = require("./encryption");
const { readField, writeField } = require("./privateField");

class PersonIdentityConflictError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
    this.code = "IDENTITY_CONFLICT";
  }
}

// Digits only, 13 digits, valid Thai checksum. Returns null otherwise.
function normalizeNationalId(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 13 || !validateThaiId(digits)) return null;
  return digits;
}

function nationalIdHash(value) {
  const digits = normalizeNationalId(value);
  return digits ? hmacHash(digits) : null;
}

// Tables that reference persons.id and must follow a merge. Missing tables are
// skipped so the helper works before the school module migration is applied.
const PERSON_REFERENCES = ["form_responses", "mastercases", "school_students"];

async function lockPerson(connection, column, value) {
  if (value === null || value === undefined) return null;
  const [rows] = await connection.query(
    `SELECT id, patient_account_id, identity_hash, identity_value_encrypted FROM persons WHERE ${column} = ? AND merged_into_person_id IS NULL LIMIT 1 FOR UPDATE`,
    [value],
  );
  return rows[0] || null;
}

async function mergePersons(connection, keep, drop) {
  for (const table of PERSON_REFERENCES) {
    try {
      await connection.query(
        `UPDATE ${table} SET person_id = ? WHERE person_id = ?`,
        [keep.id, drop.id],
      );
    } catch (error) {
      if (error.code !== "ER_NO_SUCH_TABLE") throw error;
    }
  }
  // Free the unique keys on the merged record before moving them.
  await connection.query(
    "UPDATE persons SET patient_account_id = NULL, identity_hash = NULL, merged_into_person_id = ? WHERE id = ?",
    [keep.id, drop.id],
  );
  const merged = {
    ...keep,
    patient_account_id: keep.patient_account_id || drop.patient_account_id,
    identity_hash: keep.identity_hash || drop.identity_hash,
    identity_value_encrypted:
      keep.identity_value_encrypted || drop.identity_value_encrypted,
  };
  await connection.query(
    "UPDATE persons SET patient_account_id = ?, identity_hash = ?, identity_value_encrypted = ? WHERE id = ?",
    [
      merged.patient_account_id,
      merged.identity_hash,
      merged.identity_value_encrypted,
      keep.id,
    ],
  );
  return merged;
}

/**
 * Finds or creates the person for a submission. Must run inside a transaction.
 *
 * - Logged in: the account is the anchor. Its identity_hash wins over any ID
 *   typed into the form. An account without one adopts the consented national
 *   ID, unless another account already owns it (PersonIdentityConflictError).
 * - Guest with a consented national ID: matched by identity_hash.
 * - Guest without one: anonymous, personId is null.
 *
 * nationalId must already be consented to by the submitter.
 */
async function resolvePerson({
  connection,
  patientAccountId = null,
  nationalId = null,
}) {
  const digits = normalizeNationalId(nationalId);
  let identityHash = digits ? hmacHash(digits) : null;
  const accountId = Number(patientAccountId) || null;
  let account = null;

  if (accountId) {
    const [accounts] = await connection.query(
      "SELECT id, identity_hash, first_name_encrypted, last_name_encrypted FROM patient_accounts WHERE id = ? FOR UPDATE",
      [accountId],
    );
    account = accounts[0];
    if (!account) throw new Error("Patient account no longer exists");
    if (account.identity_hash) {
      identityHash = account.identity_hash;
    } else if (identityHash) {
      const [owners] = await connection.query(
        "SELECT id FROM patient_accounts WHERE identity_hash = ? AND id <> ? LIMIT 1",
        [identityHash, accountId],
      );
      if (owners[0])
        throw new PersonIdentityConflictError(
          "เลขบัตรประชาชนนี้ผูกกับบัญชีอื่นแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีนั้น",
        );
      await connection.query(
        "UPDATE patient_accounts SET identity_hash = ? WHERE id = ? AND identity_hash IS NULL",
        [identityHash, accountId],
      );
    }
  }

  if (!accountId && !identityHash)
    return {
      personId: null,
      patientAccountId: null,
      identityHash: null,
      source: "anonymous",
    };

  // Keep the typed ID only when it is the one the person is filed under.
  const encryptedId =
    digits && hmacHash(digits) === identityHash
      ? require("./privateField").writeField(
          digits,
          "persons",
          "identity_value_encrypted",
        )
      : null;
  const byAccount = await lockPerson(
    connection,
    "patient_account_id",
    accountId,
  );
  const byHash = await lockPerson(connection, "identity_hash", identityHash);

  let person = byAccount || byHash;
  let source = "existing";
  if (byAccount && byHash && byAccount.id !== byHash.id) {
    if (byHash.patient_account_id && byHash.patient_account_id !== accountId)
      throw new PersonIdentityConflictError(
        "เลขบัตรประชาชนนี้ผูกกับบัญชีอื่นแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีนั้น",
      );
    person = await mergePersons(connection, byAccount, byHash);
    source = "merged";
  } else if (person) {
    if (
      accountId &&
      person.patient_account_id &&
      person.patient_account_id !== accountId
    )
      throw new PersonIdentityConflictError(
        "เลขบัตรประชาชนนี้ผูกกับบัญชีอื่นแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีนั้น",
      );
    const missingAccount = accountId && !person.patient_account_id;
    const missingHash = identityHash && !person.identity_hash;
    const missingValue = encryptedId && !person.identity_value_encrypted;
    if (missingAccount || missingHash || missingValue) {
      await connection.query(
        "UPDATE persons SET patient_account_id = COALESCE(patient_account_id, ?), identity_hash = COALESCE(identity_hash, ?), identity_value_encrypted = COALESCE(identity_value_encrypted, ?) WHERE id = ?",
        [accountId, identityHash, encryptedId, person.id],
      );
      source = "linked";
    }
  } else {
    const [created] = await connection.query(
      "INSERT INTO persons (patient_account_id, identity_hash, identity_value_encrypted, first_name_encrypted, last_name_encrypted) VALUES (?, ?, ?, ?, ?)",
      [
        accountId,
        identityHash,
        encryptedId,
        writeField(
          readField(
            account?.first_name_encrypted,
            "patient_accounts",
            "first_name_encrypted",
          ),
          "persons",
          "first_name_encrypted",
        ),
        writeField(
          readField(
            account?.last_name_encrypted,
            "patient_accounts",
            "last_name_encrypted",
          ),
          "persons",
          "last_name_encrypted",
        ),
      ],
    );
    person = { id: created.insertId };
    source = "created";
  }

  // The account name is authoritative for a linked person.
  if (
    account &&
    (account.first_name_encrypted || account.last_name_encrypted) &&
    source !== "created"
  ) {
    await connection.query(
      "UPDATE persons SET first_name_encrypted = ?, last_name_encrypted = ? WHERE id = ?",
      [
        writeField(
          readField(
            account.first_name_encrypted,
            "patient_accounts",
            "first_name_encrypted",
          ),
          "persons",
          "first_name_encrypted",
        ),
        writeField(
          readField(
            account.last_name_encrypted,
            "patient_accounts",
            "last_name_encrypted",
          ),
          "persons",
          "last_name_encrypted",
        ),
        person.id,
      ],
    );
  }

  return {
    personId: person.id,
    patientAccountId: accountId,
    identityHash,
    source,
  };
}

// Links an account to its person record (adopting guest submissions made with
// the same national ID). Best effort: a failure must not block sign-in.
async function linkAccountPerson(pool, patientAccountId) {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const person = await resolvePerson({ connection, patientAccountId });
    if (person.personId) {
      await connection.query(
        "UPDATE form_responses SET person_id = ? WHERE patient_account_id = ? AND person_id IS NULL",
        [person.personId, patientAccountId],
      );
      await connection.query(
        "UPDATE mastercases SET person_id = ? WHERE patient_account_id = ? AND person_id IS NULL",
        [person.personId, patientAccountId],
      );
    }
    await connection.commit();
    return person;
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    console.error(
      "Linking patient account to person failed:",
      require("./safeError").safeError(error),
    );
    return null;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  PersonIdentityConflictError,
  linkAccountPerson,
  normalizeNationalId,
  nationalIdHash,
  resolvePerson,
  mergePersons,
};
