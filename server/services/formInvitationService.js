const crypto = require("crypto");
const { httpError } = require("../utils/operationalOwnership");
const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
async function resolveInvitation(
  connection,
  token,
  patient,
  formId,
  { lock = false } = {},
) {
  if (!patient) throw httpError(401, "PATIENT_LOGIN_REQUIRED");
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw httpError(410, "INVITATION_UNAVAILABLE");
  const [rows] = await connection.query(
    `SELECT i.*, fr.patient_account_id AS current_patient_id,fr.master_case_id AS current_master_case_id,fr.organization_id AS current_organization_id,mc.person_id,mc.status AS master_status,f.organization_id AS form_organization_id,f.status AS form_status FROM form_invitations i JOIN form_responses fr ON fr.id=i.response_id JOIN mastercases mc ON mc.id=i.master_case_id AND mc.organization_id=i.organization_id JOIN forms f ON f.id=i.form_id WHERE i.token_hash=?${lock ? " FOR UPDATE" : ""}`,
    [hash(token)],
  );
  const row = rows[0];
  if (
    !row ||
    row.revoked_at ||
    row.consumed_at ||
    new Date(row.expires_at).getTime() <= Date.now()
  )
    throw httpError(410, "INVITATION_UNAVAILABLE");
  if (
    Number(row.patient_account_id) !== Number(patient.id) ||
    Number(row.current_patient_id) !== Number(patient.id)
  )
    throw httpError(403, "INVITATION_RECIPIENT_MISMATCH");
  if (
    (formId != null && Number(row.form_id) !== Number(formId)) ||
    Number(row.current_master_case_id) !== Number(row.master_case_id) ||
    Number(row.current_organization_id) !== Number(row.organization_id) ||
    Number(row.form_organization_id) !== Number(row.organization_id) ||
    row.master_status !== "Open"
  )
    throw httpError(410, "INVITATION_BINDING_CHANGED");
  return row;
}
async function consumeInvitation(connection, invitation, responseId) {
  const [result] = await connection.query(
    "UPDATE form_invitations SET consumed_at=NOW(),consumed_response_id=? WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>NOW()",
    [responseId, invitation.id],
  );
  if (result.affectedRows !== 1)
    throw httpError(409, "INVITATION_ALREADY_USED");
}
module.exports = { hash, resolveInvitation, consumeInvitation };
