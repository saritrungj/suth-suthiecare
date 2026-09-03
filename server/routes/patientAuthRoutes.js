const express = require("express");
const rateLimit = require("express-rate-limit");
const { getClientIp } = require("../utils/clientIp");
const { verifyTurnstile, isTurnstileDisabled } = require("../utils/turnstile");
const { db, bcrypt, encrypt, hmacHash, validateIdentity, validatePhone, validateCredentials, validatePersonName, getExistingPhone, audit, signPatientToken, publicAccount } = require("../utils/patientAuth");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const genericConflict = { success: false, message: "ไม่สามารถสมัครด้วยข้อมูลนี้ได้ กรุณาตรวจสอบข้อมูลหรือติดต่อเจ้าหน้าที่" };

async function requireTurnstile(req, res) {
  if (isTurnstileDisabled()) return true;
  const token = req.body.turnstileToken || req.body.cfTurnstileResponse || req.body.hcaptchaToken;
  if (!token) { res.status(400).json({ success: false, message: "กรุณายืนยันว่าคุณไม่ใช่บอท" }); return false; }
  if (!(await verifyTurnstile(token, getClientIp(req)))) { res.status(400).json({ success: false, message: "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่" }); return false; }
  return true;
}

router.post("/register", authLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const firstName = validatePersonName(req.body.first_name, "ชื่อ");
  const lastName = validatePersonName(req.body.last_name, "นามสกุล");
  const identityInput = String(req.body.national_id || "").trim();
  const identity = identityInput ? validateIdentity(identityInput) : null;
  const creds = validateCredentials(req.body);
  if (firstName.error) return res.status(400).json({ success: false, message: firstName.error });
  if (lastName.error) return res.status(400).json({ success: false, message: lastName.error });
  if (identityInput && !identity) return res.status(400).json({ success: false, message: "เลขบัตรประชาชนไม่ถูกต้อง" });
  if (creds.error) return res.status(400).json({ success: false, message: creds.error });
  const identityHash = identity ? hmacHash(identity) : null;
  try {
    const [userRows] = await db.query("SELECT * FROM patient_accounts WHERE username = ? LIMIT 1", [creds.username]);
    const [identityRows] = identityHash
      ? await db.query("SELECT * FROM patient_accounts WHERE identity_hash = ? LIMIT 1", [identityHash])
      : [[]];
    const byUser = userRows[0]; const byIdentity = identityRows[0];
    if (byUser || byIdentity) return res.status(409).json(genericConflict);
    const phone = (identityHash ? await getExistingPhone(identityHash) : null) || validatePhone(req.body.phone);
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const [result] = await db.query(
      "INSERT INTO patient_accounts (username, password_hash, first_name_encrypted, last_name_encrypted, identity_hash, phone_hash, phone_encrypted, status, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', NOW())",
      [creds.username, passwordHash, encrypt(firstName.value), encrypt(lastName.value), identityHash, phone ? hmacHash(phone) : null, phone ? encrypt(phone) : null],
    );
    const accountId = result.insertId;
    const [rows] = await db.query("SELECT * FROM patient_accounts WHERE id = ?", [accountId]);
    await audit(accountId, "register_success", req, { has_existing_history: identityHash ? Boolean(await getExistingPhone(identityHash)) : false });
    return res.status(201).json({ success: true, token: signPatientToken(rows[0]), user: publicAccount(rows[0]) });
  } catch (error) {
    await audit(null, "register_failed", req, { reason: error.code || "server_error" });
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json(genericConflict);
    console.error("Patient register failed:", error.message);
    return res.status(503).json({ success: false, message: "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่ภายหลัง" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const username = String(req.body.username || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!username || !password) return res.status(400).json({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
  try {
    const [rows] = await db.query("SELECT * FROM patient_accounts WHERE username = ? LIMIT 1", [username]);
    const account = rows[0];
    if (!account) return res.status(401).json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    if (account.locked_until && new Date(account.locked_until) > new Date()) return res.status(423).json({ success: false, message: "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง" });
    if (account.status === "locked" && account.locked_until && new Date(account.locked_until) <= new Date()) {
      await db.query("UPDATE patient_accounts SET status = 'active', failed_login_count = 0, locked_until = NULL WHERE id = ?", [account.id]);
      account.status = "active";
      account.failed_login_count = 0;
      account.locked_until = null;
    }
    if (account.status !== "active") return res.status(401).json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    if (!(await bcrypt.compare(password, account.password_hash))) {
      const failures = Number(account.failed_login_count || 0) + 1;
      await db.query("UPDATE patient_accounts SET failed_login_count = ?, status = IF(? >= 10, 'locked', status), locked_until = IF(? >= 10, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until) WHERE id = ?", [failures, failures, failures, account.id]);
      await audit(account.id, "login_failed", req); return res.status(401).json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    await db.query("UPDATE patient_accounts SET failed_login_count = 0, last_login_at = NOW() WHERE id = ?", [account.id]);
    await audit(account.id, "login_success", req);
    return res.json({ success: true, token: signPatientToken(account), user: publicAccount(account) });
  } catch (error) { console.error("Patient login failed:", error.message); return res.status(500).json({ success: false, message: "ไม่สามารถเข้าสู่ระบบได้" }); }
});

router.post("/logout", verifyPatientToken, async (req, res) => { await db.query("UPDATE patient_accounts SET token_version = token_version + 1 WHERE id = ?", [req.patient.id]); await audit(req.patient.id, "logout", req); res.json({ success: true }); });

module.exports = router;
