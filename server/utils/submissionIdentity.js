const { resolvePerson } = require("./personIdentity");

function assertPatientAccountId(patientAccountId) {
  const normalized = Number(patientAccountId);
  if (!Number.isInteger(normalized) || normalized < 1) {
    throw new Error(
      "A valid patient account is required for a form submission",
    );
  }
  return normalized;
}

function assertConnection(connection, clinicType) {
  if (!connection || typeof connection.query !== "function") {
    throw new Error(
      "A database connection is required to resolve a submission owner",
    );
  }
  if (!clinicType)
    throw new Error("A clinic type is required to resolve a submission owner");
}

async function findOpenCase(
  connection,
  column,
  value,
  clinicType,
  organizationId,
  extra = "",
) {
  const [rows] = await connection.query(
    `SELECT id, identity_hash, patient_account_id, person_id FROM mastercases WHERE ${column} = ? AND clinicType = ? AND status = 'Open' AND organization_id = ?${extra} ORDER BY id ASC LIMIT 1 FOR UPDATE`,
    [value, clinicType, organizationId],
  );
  return rows[0] || null;
}

// Finds the open per-clinic Master Case of one person, adopting legacy cases
// that predate person_id, or creates one. The person lookup locks the account
// and person rows, which serialises concurrent submissions of one person.
async function resolveCaseForPerson({
  connection,
  person,
  clinicType,
  organizationId,
}) {
  if (!Number.isSafeInteger(organizationId) || organizationId < 1)
    throw Object.assign(new Error("FORM_ORGANIZATION_REQUIRED"), {
      status: 503,
    });
  const { personId, patientAccountId, identityHash } = person;
  const owner = (masterCaseId, source, caseHash) => ({
    masterCaseId,
    personId,
    patientAccountId,
    identityHash: caseHash || identityHash || null,
    source,
  });

  const current = await findOpenCase(
    connection,
    "person_id",
    personId,
    clinicType,
    organizationId,
  );
  if (current) return owner(current.id, "person", current.identity_hash);

  // Legacy cases: linked to the account, or unlinked but carrying the same hash.
  const legacy =
    (patientAccountId &&
      (await findOpenCase(
        connection,
        "patient_account_id",
        patientAccountId,
        clinicType,
        organizationId,
        " AND person_id IS NULL",
      ))) ||
    (identityHash &&
      (await findOpenCase(
        connection,
        "identity_hash",
        identityHash,
        clinicType,
        organizationId,
        " AND person_id IS NULL AND patient_account_id IS NULL",
      )));
  if (legacy) {
    await connection.query(
      "UPDATE mastercases SET person_id = ?, patient_account_id = COALESCE(patient_account_id, ?), identity_hash = COALESCE(identity_hash, ?) WHERE id = ?",
      [personId, patientAccountId, identityHash, legacy.id],
    );
    return owner(legacy.id, "legacy-backfill", legacy.identity_hash);
  }

  const [created] = await connection.query(
    "INSERT INTO mastercases (person_id, patient_account_id, identityValue, identity_hash, clinicType, organization_id, status, currentStage) VALUES (?, ?, NULL, ?, ?, ?, 'Open', 'Registered')",
    [
      personId,
      patientAccountId,
      identityHash || null,
      clinicType,
      organizationId,
    ],
  );
  return owner(created.insertId, "created");
}

// Logged-in submission. nationalId is only passed when the submitter consented.
async function resolveSubmissionOwner({
  connection,
  patientAccountId,
  nationalId = null,
  clinicType,
  organizationId,
}) {
  const accountId = assertPatientAccountId(patientAccountId);
  assertConnection(connection, clinicType);
  const person = await resolvePerson({
    connection,
    patientAccountId: accountId,
    nationalId,
  });
  return resolveCaseForPerson({
    connection,
    person,
    clinicType,
    organizationId,
  });
}

// Guest submission. With a consented national ID the guest is matched to the
// same person (and case) as earlier submissions. Without one it is anonymous.
async function resolveGuestSubmissionOwner({
  connection,
  nationalId = null,
  clinicType,
  organizationId,
}) {
  if (!Number.isSafeInteger(organizationId) || organizationId < 1)
    throw Object.assign(new Error("FORM_ORGANIZATION_REQUIRED"), {
      status: 503,
    });
  assertConnection(connection, clinicType);
  const person = await resolvePerson({ connection, nationalId });
  if (person.personId)
    return resolveCaseForPerson({
      connection,
      person,
      clinicType,
      organizationId,
    });

  const [created] = await connection.query(
    "INSERT INTO mastercases (patient_account_id, identityValue, identity_hash, clinicType, organization_id, status, currentStage) VALUES (NULL, NULL, NULL, ?, ?, 'Open', 'Registered')",
    [clinicType, organizationId],
  );
  return {
    masterCaseId: created.insertId,
    personId: null,
    patientAccountId: null,
    identityHash: null,
    source: "guest",
  };
}

module.exports = { resolveSubmissionOwner, resolveGuestSubmissionOwner };
