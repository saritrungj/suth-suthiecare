function assertPatientAccountId(patientAccountId) {
  const normalized = Number(patientAccountId);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error("A valid patient account is required for a form submission");
  }
  return normalized;
}

async function findOpenCaseByAccount(connection, patientAccountId, clinicType) {
  const [rows] = await connection.query(
    "SELECT id, identity_hash FROM mastercases WHERE patient_account_id = ? AND clinicType = ? AND status = 'Open' ORDER BY id ASC LIMIT 1 FOR UPDATE",
    [patientAccountId, clinicType],
  );
  return rows[0] || null;
}

async function resolveSubmissionOwner({
  connection,
  patientAccountId,
  accountIdentityHash = null,
  clinicType,
}) {
  const accountId = assertPatientAccountId(patientAccountId);
  if (!connection || typeof connection.query !== "function") {
    throw new Error("A database connection is required to resolve a submission owner");
  }
  if (!clinicType) throw new Error("A clinic type is required to resolve a submission owner");

  // Lock the account row. This serialises submissions for one account across all API
  // instances and prevents two simultaneous requests creating separate open cases.
  const [accountRows] = await connection.query(
    "SELECT id FROM patient_accounts WHERE id = ? FOR UPDATE",
    [accountId],
  );
  if (!accountRows[0]) throw new Error("Patient account no longer exists");

  let masterCase = await findOpenCaseByAccount(connection, accountId, clinicType);
  if (masterCase) {
    return { masterCaseId: masterCase.id, patientAccountId: accountId, identityHash: masterCase.identity_hash || accountIdentityHash || null, source: "account" };
  }

  // Legacy records may predate patient_account_id. Only adopt an unlinked record
  // when its stable identity hash matches the authenticated account.
  if (accountIdentityHash) {
    const [legacyRows] = await connection.query(
      "SELECT id, identity_hash FROM mastercases WHERE identity_hash = ? AND clinicType = ? AND status = 'Open' AND patient_account_id IS NULL ORDER BY id ASC LIMIT 1 FOR UPDATE",
      [accountIdentityHash, clinicType],
    );
    masterCase = legacyRows[0];
    if (masterCase) {
      await connection.query(
        "UPDATE mastercases SET patient_account_id = ? WHERE id = ? AND patient_account_id IS NULL",
        [accountId, masterCase.id],
      );
      return { masterCaseId: masterCase.id, patientAccountId: accountId, identityHash: masterCase.identity_hash, source: "legacy-backfill" };
    }
  }

  const [created] = await connection.query(
    "INSERT INTO mastercases (patient_account_id, identityValue, identity_hash, clinicType, status, currentStage) VALUES (?, NULL, ?, ?, 'Open', 'Registered')",
    [accountId, accountIdentityHash || null, clinicType],
  );
  return { masterCaseId: created.insertId, patientAccountId: accountId, identityHash: accountIdentityHash || null, source: "created" };
}

async function resolveGuestSubmissionOwner({ connection, clinicType }) {
  if (!connection || typeof connection.query !== "function") {
    throw new Error("A database connection is required to resolve a submission owner");
  }
  if (!clinicType) throw new Error("A clinic type is required to resolve a submission owner");

  const [created] = await connection.query(
    "INSERT INTO mastercases (patient_account_id, identityValue, identity_hash, clinicType, status, currentStage) VALUES (NULL, NULL, NULL, ?, 'Open', 'Registered')",
    [clinicType],
  );
  return { masterCaseId: created.insertId, patientAccountId: null, identityHash: null, source: "guest" };
}

module.exports = { resolveSubmissionOwner, resolveGuestSubmissionOwner };
