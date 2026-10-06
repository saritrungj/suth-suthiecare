const { decrypt, maskName } = require("./encryption");
const { readField } = require("./privateField");

const STATUSES = [
  "pending",
  "accepted",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
];
const TARGET_TRANSITIONS = {
  pending: ["accepted", "rejected"],
  accepted: ["in_progress"],
  in_progress: ["completed"],
};
function transitionsFor(referral, organizationId) {
  if (Number(referral.destination_organization_id) === Number(organizationId))
    return TARGET_TRANSITIONS[referral.status] || [];
  if (
    Number(referral.source_organization_id) === Number(organizationId) &&
    referral.status === "pending"
  )
    return ["cancelled"];
  return [];
}
function plain(value) {
  if (!value) return "";
  return decrypt(value) || "";
}
function publicReferral(row, organizationId) {
  // Explicit allowlist: do not leak source IDs, identity keys or raw data from
  // joined tables into the receiving organization, even if a SELECT expands.
  return {
    id: row.id,
    source_organization_id: row.source_organization_id,
    destination_organization_id: row.destination_organization_id,
    source_organization_name: row.source_organization_name,
    destination_organization_name: row.destination_organization_name,
    display_name:
      maskName(
        readField(
          row.display_name_encrypted,
          "case_referrals",
          "display_name_encrypted",
          row.source_organization_id,
        ),
      ) || "ไม่ระบุชื่อ",
    form_title: row.form_title,
    reason:
      readField(
        row.reason_encrypted,
        "case_referrals",
        "reason_encrypted",
        row.source_organization_id,
      ) || "",
    status: row.status,
    version: row.version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    direction:
      Number(row.source_organization_id) === Number(organizationId)
        ? "outgoing"
        : "incoming",
    allowed_statuses: transitionsFor(row, organizationId),
  };
}
function publicUpdate(row) {
  return {
    id: row.id,
    organization_name: row.organization_name,
    actor_name:
      readField(
        row.actor_name_encrypted,
        "case_referral_updates",
        "actor_name_encrypted",
        row.organization_id,
      ) || "เจ้าหน้าที่",
    kind: row.kind,
    status: row.status,
    summary:
      readField(
        row.summary_encrypted,
        "case_referral_updates",
        "summary_encrypted",
        row.organization_id,
      ) || "",
    created_at: row.created_at,
  };
}
function validId(value) {
  return (
    /^\d+$/.test(String(value)) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0
  );
}
function summaryText(value) {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 1000
  );
}
function allowedFields(body, fields) {
  return (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    Object.keys(body).every((key) => fields.includes(key))
  );
}
module.exports = {
  STATUSES,
  transitionsFor,
  publicReferral,
  publicUpdate,
  validId,
  summaryText,
  allowedFields,
};
