const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { getClientIp } = require("../utils/clientIp");
const { verifyTurnstile, isTurnstileDisabled } = require("../utils/turnstile");
const {
  db,
  bcrypt,
  encrypt,
  hmacHash,
  validateIdentity,
  validatePhone,
  validateCredentials,
  validatePersonName,
  getExistingPhone,
  audit,
  signPatientToken,
  publicAccount,
} = require("../utils/patientAuth");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const {
  isStrongPassword,
  PASSWORD_POLICY_MESSAGE,
} = require("../utils/passwordPolicy");
const {
  createChallenge,
  verifyChallenge,
  resendChallenge,
  normalizeEmail,
} = require("../services/otpService");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});
const genericConflict = {
  success: false,
  message:
    "ไม่สามารถสมัครด้วยข้อมูลนี้ได้ กรุณาตรวจสอบข้อมูลหรือติดต่อเจ้าหน้าที่",
};
const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const patientJwtSecret = () =>
  process.env.PATIENT_JWT_SECRET || process.env.JWT_SECRET;

async function requireTurnstile(req, res) {
  if (isTurnstileDisabled()) return true;
  const token =
    req.body.turnstileToken ||
    req.body.cfTurnstileResponse ||
    req.body.hcaptchaToken;
  if (!token || !(await verifyTurnstile(token, getClientIp(req)))) {
    res
      .status(400)
      .json({ success: false, message: "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่" });
    return false;
  }
  return true;
}

router.post("/register", authLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const firstName = validatePersonName(req.body.first_name, "ชื่อ");
  const lastName = validatePersonName(req.body.last_name, "นามสกุล");
  const identityInput = String(req.body.national_id || "").trim();
  const identity = identityInput ? validateIdentity(identityInput) : null;
  const email = normalizeEmail(req.body.email);
  const creds = validateCredentials(req.body);
  if (firstName.error || lastName.error || creds.error)
    return res.status(400).json({
      success: false,
      message: firstName.error || lastName.error || creds.error,
    });
  if (!validEmail(email))
    return res
      .status(400)
      .json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" });
  if (identityInput && !identity)
    return res
      .status(400)
      .json({ success: false, message: "เลขบัตรประชาชนไม่ถูกต้อง" });
  const identityHash = identity ? hmacHash(identity) : null;
  try {
    const [userRows] = await db.query(
      "SELECT id FROM patient_accounts WHERE username=? LIMIT 1",
      [creds.username],
    );
    const [identityRows] = identityHash
      ? await db.query(
          "SELECT id FROM patient_accounts WHERE identity_hash=? LIMIT 1",
          [identityHash],
        )
      : [[]];
    if (userRows[0] || identityRows[0])
      return res.status(409).json(genericConflict);
    const phone =
      (identityHash ? await getExistingPhone(identityHash) : null) ||
      validatePhone(req.body.phone);
    const [result] = await db.query(
      "INSERT INTO patient_accounts (username,password_hash,first_name_encrypted,last_name_encrypted,identity_hash,phone_hash,phone_encrypted,email,status) VALUES (?,?,?,?,?,?,?,?, 'pending_verification')",
      [
        creds.username,
        await bcrypt.hash(req.body.password, 12),
        encrypt(firstName.value),
        encrypt(lastName.value),
        identityHash,
        phone ? hmacHash(phone) : null,
        phone ? encrypt(phone) : null,
        email,
      ],
    );
    let challenge;
    try {
      challenge = await createChallenge(db, {
        accountType: "patient",
        accountId: result.insertId,
        email,
        purpose: "email_verification",
        authVersion: 0,
      });
    } catch (error) {
      // Without a verification code the pending account can never be activated,
      // and it would block the username/identity from being registered again.
      await db.query(
        "DELETE FROM patient_accounts WHERE id=? AND status='pending_verification'",
        [result.insertId],
      );
      throw error;
    }
    await audit(result.insertId, "register_email_verification_sent", req);
    return res
      .status(201)
      .json({ success: true, requiresEmailVerification: true, ...challenge });
  } catch (error) {
    await audit(null, "register_failed", req, {
      reason: error.code || "server_error",
    });
    if (error.code === "ER_DUP_ENTRY")
      return res.status(409).json(genericConflict);
    console.error("Patient register failed:", error.code || error.message);
    return res.status(503).json({
      success: false,
      message: "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่ภายหลัง",
    });
  }
});

router.post("/email/verify", otpLimiter, async (req, res) => {
  try {
    const result = await verifyChallenge(db, {
      challengeToken: req.body.challengeToken,
      otp: req.body.otp,
      accountType: "patient",
      purpose: "email_verification",
      loadAccount: async (connection, id) => {
        const [rows] = await connection.query(
          "SELECT * FROM patient_accounts WHERE id=? AND status='pending_verification' LIMIT 1",
          [id],
        );
        return rows[0] || null;
      },
    });
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    await db.query(
      "UPDATE patient_accounts SET status='active', email_verified_at=NOW(), verified_at=NOW() WHERE id=?",
      [result.account.id],
    );
    const [rows] = await db.query("SELECT * FROM patient_accounts WHERE id=?", [
      result.account.id,
    ]);
    await audit(result.account.id, "email_verification_success", req);
    return res.json({
      success: true,
      token: signPatientToken(rows[0]),
      user: publicAccount(rows[0]),
    });
  } catch (error) {
    console.error("Patient email verification failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถยืนยันอีเมลได้" });
  }
});

router.post("/email/resend", otpLimiter, async (req, res) => {
  try {
    const result = await resendChallenge(db, {
      challengeToken: req.body.challengeToken,
      accountType: "patient",
      purpose: "email_verification",
    });
    if (result.error)
      return res.status(429).json({
        success: false,
        message: result.error,
        resendAfter: result.resendAfter,
      });
    return res.json(result);
  } catch (error) {
    console.error("Patient email resend failed:", error.code || error.message);
    return res
      .status(503)
      .json({ success: false, message: "ไม่สามารถส่งรหัสใหม่ได้" });
  }
});

router.post("/password-recovery/request", otpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const generic = {
    success: true,
    message: "หากอีเมลนี้ผูกและยืนยันกับบัญชีแล้ว ระบบได้ส่งรหัสยืนยันให้แล้ว",
  };
  try {
    if (!email) return res.json(generic);
    const [rows] = await db.query(
      "SELECT id,email,auth_version FROM patient_accounts WHERE email=? AND email_verified_at IS NOT NULL AND status='active' LIMIT 2",
      [email],
    );
    if (rows.length !== 1) return res.json(generic);
    const challenge = await createChallenge(db, {
      accountType: "patient",
      accountId: rows[0].id,
      email: rows[0].email,
      purpose: "account_recovery",
      authVersion: rows[0].auth_version,
    });
    return res.json({
      ...generic,
      challengeToken: challenge.challengeToken,
      maskedEmail: challenge.maskedEmail,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    console.error(
      "Patient password recovery request failed:",
      error.code || error.message,
    );
    return res.status(503).json({
      success: false,
      message: "ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่",
    });
  }
});

router.post("/password-recovery/verify", otpLimiter, async (req, res) => {
  try {
    const result = await verifyChallenge(db, {
      challengeToken: req.body.challengeToken,
      otp: req.body.otp,
      accountType: "patient",
      purpose: "account_recovery",
      loadAccount: async (connection, id) => {
        const [rows] = await connection.query(
          "SELECT id,username,status,auth_version,email_verified_at FROM patient_accounts WHERE id=? AND status='active' LIMIT 1",
          [id],
        );
        return rows[0]?.email_verified_at ? rows[0] : null;
      },
    });
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    const recoveryToken = jwt.sign(
      {
        sub: result.account.id,
        account_type: "patient",
        purpose: "password_recovery",
        auth_version: Number(result.account.auth_version || 0),
      },
      patientJwtSecret(),
      { expiresIn: "5m", algorithm: "HS256" },
    );
    return res.json({
      success: true,
      recoveryToken,
      username: result.account.username,
    });
  } catch (error) {
    console.error(
      "Patient password recovery verification failed:",
      error.message,
    );
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถยืนยันรหัสได้" });
  }
});

router.post("/password-recovery/reset", otpLimiter, async (req, res) => {
  const password = req.body.password;
  if (!isStrongPassword(password))
    return res
      .status(400)
      .json({ success: false, message: PASSWORD_POLICY_MESSAGE });
  try {
    const decoded = jwt.verify(req.body.recoveryToken, patientJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (
      decoded.account_type !== "patient" ||
      decoded.purpose !== "password_recovery" ||
      !decoded.sub
    )
      throw new Error("invalid recovery token");
    const [result] = await db.query(
      "UPDATE patient_accounts SET password_hash=?, token_version=token_version+1, auth_version=auth_version+1 WHERE id=? AND auth_version=? AND status='active'",
      [
        await bcrypt.hash(password, 12),
        decoded.sub,
        Number(decoded.auth_version || 0),
      ],
    );
    if (!result.affectedRows)
      return res.status(400).json({
        success: false,
        message: "คำขอกู้รหัสผ่านหมดอายุแล้ว กรุณาเริ่มใหม่",
      });
    await audit(decoded.sub, "password_recovery_success", req);
    return res.json({
      success: true,
      message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ",
    });
  } catch {
    return res.status(400).json({
      success: false,
      message: "คำขอกู้รหัสผ่านหมดอายุแล้ว กรุณาเริ่มใหม่",
    });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  if (!(await requireTurnstile(req, res))) return;
  const username = String(req.body.username || "")
    .trim()
    .toLowerCase();
  const password = String(req.body.password || "");
  if (!username || !password)
    return res
      .status(400)
      .json({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
  try {
    const [rows] = await db.query(
      "SELECT * FROM patient_accounts WHERE username=? LIMIT 1",
      [username],
    );
    const account = rows[0];
    if (!account)
      return res
        .status(401)
        .json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    if (account.locked_until && new Date(account.locked_until) > new Date())
      return res.status(423).json({
        success: false,
        message: "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง",
      });
    if (
      account.status === "locked" &&
      account.locked_until &&
      new Date(account.locked_until) <= new Date()
    ) {
      await db.query(
        "UPDATE patient_accounts SET status='active', failed_login_count=0, locked_until=NULL WHERE id=?",
        [account.id],
      );
      account.status = "active";
      account.failed_login_count = 0;
    }
    if (!(await bcrypt.compare(password, account.password_hash))) {
      const failures = Number(account.failed_login_count || 0) + 1;
      await db.query(
        "UPDATE patient_accounts SET failed_login_count=?, status=IF(? >= 10, 'locked', status), locked_until=IF(? >= 10, DATE_ADD(NOW(), INTERVAL 15 MINUTE), locked_until) WHERE id=?",
        [failures, failures, failures, account.id],
      );
      await audit(account.id, "login_failed", req);
      return res
        .status(401)
        .json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    if (account.status === "pending_verification")
      return res.status(403).json({
        success: false,
        code: "EMAIL_VERIFICATION_REQUIRED",
        message: "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ",
      });
    if (account.locked_until && new Date(account.locked_until) > new Date())
      return res.status(423).json({
        success: false,
        message: "บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ภายหลัง",
      });
    if (account.status !== "active")
      return res
        .status(401)
        .json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    await db.query(
      "UPDATE patient_accounts SET failed_login_count=0,last_login_at=NOW() WHERE id=?",
      [account.id],
    );
    await audit(account.id, "login_success", req);
    return res.json({
      success: true,
      token: signPatientToken(account),
      user: publicAccount(account),
    });
  } catch (error) {
    console.error("Patient login failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถเข้าสู่ระบบได้" });
  }
});

router.post("/logout", verifyPatientToken, async (req, res) => {
  await db.query(
    "UPDATE patient_accounts SET token_version=token_version+1 WHERE id=?",
    [req.patient.id],
  );
  await audit(req.patient.id, "logout", req);
  res.json({ success: true });
});
module.exports = router;
