const crypto = require("crypto");

const MARKER = "suth-private-v1";
const PREFIX = "suthenc:v1:";
class PrivateDataError extends Error {
  constructor(code) {
    super(code);
    this.name = "PrivateDataError";
    this.code = code;
    if (/CIPHERTEXT|ENCRYPTION_KEY/.test(code))
      require("./privacyTelemetry").record("decrypt_failure");
  }
}
function keyring() {
  let keys;
  try {
    keys = process.env.DATA_ENCRYPTION_KEYS
      ? JSON.parse(process.env.DATA_ENCRYPTION_KEYS)
      : { legacy: process.env.AES_KEY };
  } catch {
    throw new PrivateDataError("INVALID_ENCRYPTION_KEYRING");
  }
  const active = process.env.DATA_ENCRYPTION_ACTIVE_KEY || "legacy";
  if (
    !keys ||
    typeof keys !== "object" ||
    Array.isArray(keys) ||
    !Object.keys(keys).length ||
    Object.values(keys).some((key) => !/^[a-f0-9]{64}$/i.test(String(key))) ||
    !keys[active]
  )
    throw new PrivateDataError("INVALID_ENCRYPTION_KEYRING");
  return { keys, active };
}
function isEnvelope(value) {
  return Boolean(value && typeof value === "object" && value.__enc === MARKER);
}
function parseEnvelope(value) {
  if (isEnvelope(value)) return value;
  if (value && typeof value === "object" && Object.hasOwn(value, "__enc"))
    throw new PrivateDataError("UNSUPPORTED_CIPHERTEXT_VERSION");
  if (
    typeof value === "string" &&
    value.startsWith("suthenc:") &&
    !value.startsWith(PREFIX)
  )
    throw new PrivateDataError("UNSUPPORTED_CIPHERTEXT_VERSION");
  if (typeof value === "string" && value.startsWith(PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(PREFIX.length));
      if (!isEnvelope(parsed)) throw new Error();
      return parsed;
    } catch {
      throw new PrivateDataError("INVALID_CIPHERTEXT");
    }
  }
  return null;
}
function sealJson(value, context) {
  if (typeof context !== "string" || !context)
    throw new PrivateDataError("MISSING_ENCRYPTION_CONTEXT");
  const { keys, active } = keyring();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    Buffer.from(keys[active], "hex"),
    iv,
  );
  cipher.setAAD(Buffer.from(`${MARKER}:${active}:${context}`, "utf8"));
  const serialized = JSON.stringify(value);
  if (serialized === undefined)
    throw new PrivateDataError("INVALID_PRIVATE_JSON");
  const ct = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  return {
    __enc: MARKER,
    version: 1,
    kid: active,
    context,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ct: ct.toString("base64"),
  };
}
function openJson(value, expectedContext) {
  const envelope = parseEnvelope(value);
  if (!envelope) throw new PrivateDataError("INVALID_CIPHERTEXT");
  if (envelope.version !== 1)
    throw new PrivateDataError("UNSUPPORTED_CIPHERTEXT_VERSION");
  if (expectedContext !== undefined && envelope.context !== expectedContext)
    throw new PrivateDataError("CIPHERTEXT_CONTEXT_MISMATCH");
  const { keys } = keyring();
  const key = keys[envelope.kid];
  if (!key) throw new PrivateDataError("UNKNOWN_ENCRYPTION_KEY");
  try {
    const iv = Buffer.from(envelope.iv, "base64"),
      tag = Buffer.from(envelope.tag, "base64");
    if (
      iv.length !== 12 ||
      tag.length !== 16 ||
      typeof envelope.context !== "string"
    )
      throw new Error();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "hex"),
      iv,
    );
    decipher.setAAD(
      Buffer.from(`${MARKER}:${envelope.kid}:${envelope.context}`, "utf8"),
    );
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(envelope.ct, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw new PrivateDataError("CIPHERTEXT_AUTHENTICATION_FAILED");
  }
}
function sealText(value, context = "legacy-field") {
  return PREFIX + JSON.stringify(sealJson(value, context));
}
function readJson(value, context, legacyDecrypt = (v) => v) {
  let parsed = value;
  if (typeof value === "string" && !value.startsWith(PREFIX)) {
    try {
      parsed = JSON.parse(value);
    } catch {
      parsed = value;
    }
  }
  if (parseEnvelope(parsed)) return openJson(parsed, context);
  if (
    value != null &&
    context &&
    process.env.PDPA_LEGACY_READ_ENABLED === "false"
  )
    throw new PrivateDataError("LEGACY_PRIVATE_DATA_RETIRED");
  return parsed;
}
function fieldContext(table, field, organization) {
  if (
    organization != null &&
    (!Number.isSafeInteger(Number(organization)) || Number(organization) < 1)
  )
    throw new PrivateDataError("INVALID_ORGANIZATION_CONTEXT");
  return `${table}:${field}:org:${organization == null ? "unassigned" : Number(organization)}`;
}
module.exports = {
  MARKER,
  PREFIX,
  PrivateDataError,
  keyring,
  isEnvelope,
  parseEnvelope,
  sealJson,
  sealText,
  openJson,
  readJson,
  fieldContext,
};
