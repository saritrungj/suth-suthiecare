const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { encrypt, decrypt, hmacHash, validateThaiId, validateThaiPhone } = require("./encryption");
const { validatePersonName } = require("./patientValidation");
const { extractExistingPhone } = require("./patientHistoryProfile");

const patientJwtSecret = () => process.env.PATIENT_JWT_SECRET || process.env.JWT_SECRET;
const normalizeUsername = (value) => String(value || "").trim().toLowerCase();
const normalizeId = (value) => String(value || "").replace(/\D/g, "");
const normalizePhone = (value) => String(value || "").replace(/\D/g, "");

function validateCredentials({ username, password }) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(normalized)) {
    return { error: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3-80 ตัวอักษร" };
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return { error: "รหัสผ่านต้องมีความยาว 8-128 ตัวอักษร" };
  }
  return { username: normalized };
}

function validateIdentity(value) {
  const identity = normalizeId(value);
  if (identity.length !== 13 || !validateThaiId(identity)) return null;
  return identity;
}

function validatePhone(value) {
  const phone = normalizePhone(value);
  return validateThaiPhone(phone) ? phone : null;
}

async function getExistingPhone(identityHash) {
  if (!identityHash) return null;
  const [rows] = await db.query(
    "SELECT summary_data FROM form_responses WHERE identity_hash = ? ORDER BY submitted_at DESC LIMIT 20",
    [identityHash],
  );
  return extractExistingPhone(rows);
}

async function audit(accountId, eventType, req, metadata = {}) {
  try {
    await db.query(
      "INSERT INTO patient_auth_audit_logs (patient_account_id, event_type, ip_address, user_agent, metadata) VALUES (?, ?, ?, ?, ?)",
      [accountId || null, eventType, req.ip || null, String(req.get("user-agent") || "").slice(0, 255), JSON.stringify(metadata)],
    );
  } catch (error) {
    console.error("Patient auth audit failed:", error.message);
  }
}

function signPatientToken(account) {
  return jwt.sign(
    { sub: account.id, account_type: "patient", token_version: account.token_version },
    patientJwtSecret(),
    { expiresIn: process.env.PATIENT_JWT_EXPIRES || "2h" },
  );
}

function publicAccount(account) {
  const safeDecrypt = (value) => {
    if (!value) return "";
    try { return decrypt(value) || ""; } catch { return ""; }
  };
  return {
    id: account.id,
    username: account.username,
    first_name: safeDecrypt(account.first_name_encrypted),
    last_name: safeDecrypt(account.last_name_encrypted),
    status: account.status,
    verified_at: account.verified_at,
  };
}

module.exports = {
  db,
  bcrypt,
  encrypt,
  decrypt,
  hmacHash,
  normalizeId,
  validateIdentity,
  validatePhone,
  getExistingPhone,
  validatePersonName,
  validateCredentials,
  audit,
  signPatientToken,
  publicAccount,
};
