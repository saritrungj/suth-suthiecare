const { decrypt } = require("./encryption");

function safeDecrypt(value) {
  if (!value) return "";
  try { return decrypt(value) || ""; } catch { return ""; }
}

function submittedBy(row) {
  if (!row?.patient_account_id) return { status: "legacy_unlinked" };
  const displayName = [safeDecrypt(row.patient_first_name_encrypted), safeDecrypt(row.patient_last_name_encrypted)]
    .filter(Boolean)
    .join(" ");
  return {
    status: row.patient_username ? "linked" : "account_deleted",
    account_id: row.patient_account_id,
    username: row.patient_username || null,
    display_name: displayName || row.patient_username || null,
  };
}

module.exports = { submittedBy };
