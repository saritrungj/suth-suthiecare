const { parseEnvelope, fieldContext, openJson } = require("./privateData");
const { encrypt, decrypt } = require("./encryption");
function writeField(value, table, field, organization = null) {
  return encrypt(value, fieldContext(table, field, organization));
}
function readField(
  value,
  table,
  field,
  organization = null,
  legacyReader = decrypt,
) {
  const envelope = parseEnvelope(value);
  // Explicit compatibility for the short-lived pre-context envelope writer.
  if (envelope?.context === "legacy-field") {
    if (process.env.PDPA_LEGACY_READ_ENABLED === "false")
      throw Object.assign(new Error("LEGACY_PRIVATE_DATA_RETIRED"), {
        code: "LEGACY_PRIVATE_DATA_RETIRED",
      });
    return openJson(value);
  }
  if (
    value != null &&
    value !== "" &&
    !envelope &&
    process.env.PDPA_LEGACY_READ_ENABLED === "false"
  )
    throw Object.assign(new Error("LEGACY_PRIVATE_DATA_RETIRED"), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
  return envelope
    ? decrypt(value, fieldContext(table, field, organization))
    : legacyReader(value);
}
module.exports = { writeField, readField };
