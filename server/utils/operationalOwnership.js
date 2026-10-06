function httpError(status, code) {
  if (
    /OUTSIDE_ORGANIZATION|OWNER_MISMATCH|MASTER_CASE_MISMATCH|PERSON_MISMATCH/.test(
      code,
    )
  )
    require("./privacyTelemetry").record("scope_denial");
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}
function concreteOrganization(req) {
  if (
    !Number.isSafeInteger(req.organizationContext) ||
    req.organizationContext < 1
  )
    throw httpError(422, "SELECT_ONE_ORGANIZATION");
  return req.organizationContext;
}
async function responseOwner(connection, req, id, claimedMaster, lock = false) {
  const org = concreteOrganization(req);
  const [rows] = await connection.query(
    `SELECT fr.id, fr.master_case_id, fr.organization_id,fr.person_id,fr.patient_account_id,mc.person_id AS master_person_id,mc.patient_account_id AS master_patient_account_id, mc.organization_id AS master_organization_id FROM form_responses fr LEFT JOIN mastercases mc ON mc.id=fr.master_case_id WHERE fr.id=? AND fr.organization_id=?${lock ? " FOR UPDATE" : ""}`,
    [id, org],
  );
  const row = rows[0];
  if (!row) throw httpError(404, "CASE_NOT_FOUND");
  if (row.master_case_id && Number(row.master_organization_id) !== org)
    throw httpError(409, "CASE_OWNER_MISMATCH");
  if (
    row.master_case_id &&
    ((row.person_id != null &&
      Number(row.person_id) !== Number(row.master_person_id)) ||
      (row.patient_account_id != null &&
        Number(row.patient_account_id) !==
          Number(row.master_patient_account_id)))
  )
    throw httpError(409, "CASE_PERSON_MISMATCH");
  if (
    claimedMaster != null &&
    Number(claimedMaster) !== Number(row.master_case_id)
  )
    throw httpError(422, "MASTER_CASE_MISMATCH");
  return row;
}
async function ownedReference(connection, table, id, org) {
  if (id == null || id === "") return;
  if (
    !["staffs", "service_types", "case_statuses", "mastercases"].includes(table)
  )
    throw new Error("INVALID_REFERENCE_TABLE");
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1)
    throw httpError(422, "INVALID_REFERENCE");
  const active = ["staffs", "case_statuses"].includes(table)
    ? " AND is_active=1"
    : "";
  const [rows] = await connection.query(
    `SELECT id FROM ${table} WHERE id=? AND organization_id=?${active} LIMIT 1 FOR UPDATE`,
    [id, org],
  );
  if (!rows[0]) throw httpError(422, "REFERENCE_OUTSIDE_ORGANIZATION");
}
module.exports = {
  httpError,
  concreteOrganization,
  responseOwner,
  ownedReference,
};
