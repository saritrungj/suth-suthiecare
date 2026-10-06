const crypto = require("crypto");
const { sealText, readJson, fieldContext } = require("./privateData");
function lookup(value) {
  const secret = process.env.AES_SEARCH_KEY;
  if (!secret || secret.length < 32)
    throw new Error("IDENTITY_SEARCH_KEY_REQUIRED");
  return crypto
    .createHmac("sha256", secret)
    .update("email:" + String(value).trim().toLowerCase())
    .digest("hex");
}
function encode(value, table, field = "email") {
  return value
    ? sealText(
        String(value).trim().toLowerCase(),
        fieldContext(table, field, null),
      )
    : null;
}
function decode(account, table, field = "email") {
  if (
    !account?.[field + "_encrypted"] &&
    account?.[field] &&
    process.env.PDPA_LEGACY_READ_ENABLED === "false"
  )
    throw new Error("LEGACY_PRIVATE_DATA_RETIRED");
  return account?.[field + "_encrypted"]
    ? readJson(account[field + "_encrypted"], fieldContext(table, field, null))
    : account?.[field] || "";
}
function readAccount(account, table) {
  if (!account) return account;
  return {
    ...account,
    email: decode(account, table),
    pending_email: decode(account, table, "pending_email"),
  };
}
module.exports = { lookup, encode, decode, readAccount };
