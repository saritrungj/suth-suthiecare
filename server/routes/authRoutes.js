const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { clientIpKeyGenerator, getClientIp } = require("../utils/clientIp");
const { verifyTurnstile, isTurnstileDisabled } = require("../utils/turnstile");
const { encrypt, decrypt } = require("../utils/encryption");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  normaliseText,
} = require("../utils/userValidation");
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
const {
  TRUSTED_SESSION_COOKIE,
  issueTrustedSession,
  verifyTrustedSession,
  trustedSessionCookieOptions,
} = require("../services/trustedSessionService");

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKeyGenerator,
  message: {
    success: false,
    message: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่",
  },
});
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKeyGenerator,
  message: { success: false, message: "ลองยืนยันรหัสมากเกินไป กรุณารอสักครู่" },
});
const required = () =>
  String(process.env.STAFF_EMAIL_OTP_MODE || "enroll").toLowerCase() ===
  "required";
const validPassword = (password) =>
  typeof password === "string" &&
  password.length >= 8 &&
  password.length <= 200;

// users.name is stored as AES ciphertext; the client only ever needs plaintext.
const displayName = (value) => {
  try {
    return decrypt(value) || value || null;
  } catch {
    return value || null;
  }
};

function staffPayload(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    role_id: user.role_id,
    name: displayName(user.name),
  };
}
function signStaffToken(user) {
  return jwt.sign(
    {
      ...staffPayload(user),
      account_type: "staff",
      email_otp: true,
      auth_version: Number(user.auth_version || 0),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "8h", algorithm: "HS256" },
  );
}
async function validCaptcha(req) {
  return (
    isTurnstileDisabled() ||
    (Boolean(req.body.turnstileToken) &&
      verifyTurnstile(req.body.turnstileToken, getClientIp(req)))
  );
}
async function passwordUser(req) {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!username || !password)
    return { error: "กรุณากรอกข้อมูลให้ครบ", status: 400 };
  const [rows] = await db.query(
    "SELECT id, username, password, role, role_id, name, email, email_verified_at, status, auth_version FROM users WHERE username=? LIMIT 1",
    [username],
  );
  const user = rows[0];
  if (
    !user ||
    user.status !== "active" ||
    !user.password?.startsWith("$2") ||
    !(await bcrypt.compare(password, user.password))
  )
    return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", status: 400 };
  return { user };
}

router.post("/login", loginLimiter, async (req, res) => {
  try {
    if (!(await validCaptcha(req)))
      return res.status(400).json({
        success: false,
        message: "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่",
      });
    const result = await passwordUser(req);
    if (result.error)
      return res
        .status(result.status)
        .json({ success: false, message: result.error });
    const { user } = result;
    if (!required())
      return res.json({
        success: true,
        message: "เข้าสู่ระบบสำเร็จ",
        token: signStaffToken(user),
        user: staffPayload(user),
      });
    const trustedToken = req.cookies?.[TRUSTED_SESSION_COOKIE];
    if (
      trustedToken &&
      (await verifyTrustedSession(db, {
        accountId: user.id,
        token: trustedToken,
        authVersion: user.auth_version,
      }))
    )
      return res.json({
        success: true,
        message: "เข้าสู่ระบบสำเร็จ",
        token: signStaffToken(user),
        user: staffPayload(user),
      });
    if (!user.email)
      return res.status(403).json({
        success: false,
        code: "EMAIL_ENROLLMENT_REQUIRED",
        message: "บัญชีนี้ยังไม่มีอีเมล กรุณาติดต่อผู้ดูแลระบบ",
      });
    const purpose = user.email_verified_at
      ? "staff_login"
      : "email_verification";
    const challenge = await createChallenge(db, {
      accountType: "staff",
      accountId: user.id,
      email: user.email,
      purpose,
      authVersion: user.auth_version,
    });
    return res.json({
      success: true,
      requiresOtp: true,
      emailVerification: purpose === "email_verification",
      ...challenge,
    });
  } catch (error) {
    console.error("Staff login failed:", error.code || "", error.message);
    return res.status(503).json({
      success: false,
      message:
        error.code === "EMAIL_NOT_CONFIGURED"
          ? "ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ"
          : "ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่",
    });
  }
});

router.post("/login/verify-otp", otpLimiter, async (req, res) => {
  try {
    const result = await verifyChallenge(db, {
      challengeToken: req.body.challengeToken,
      otp: req.body.otp,
      accountType: "staff",
      purpose: "staff_login",
      loadAccount: async (connection, id) => {
        const [rows] = await connection.query(
          "SELECT id, username, role, role_id, name, email_verified_at, status, auth_version FROM users WHERE id=? AND status='active' LIMIT 1",
          [id],
        );
        return rows[0]?.email_verified_at ? rows[0] : null;
      },
    });
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    const { token: trustedToken, maxAgeMs } = await issueTrustedSession(db, {
      accountId: result.account.id,
      authVersion: result.account.auth_version,
    });
    res.cookie(
      TRUSTED_SESSION_COOKIE,
      trustedToken,
      trustedSessionCookieOptions(maxAgeMs),
    );
    return res.json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      token: signStaffToken(result.account),
      user: staffPayload(result.account),
    });
  } catch (error) {
    console.error("Staff OTP verification failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถยืนยันรหัสได้" });
  }
});

router.post("/email/verify", otpLimiter, async (req, res) => {
  try {
    const result = await verifyChallenge(db, {
      challengeToken: req.body.challengeToken,
      otp: req.body.otp,
      accountType: "staff",
      purpose: "email_verification",
      loadAccount: async (connection, id) => {
        const [rows] = await connection.query(
          "SELECT id, username, role, role_id, name, email, status, auth_version FROM users WHERE id=? AND status='active' LIMIT 1",
          [id],
        );
        return rows[0] || null;
      },
    });
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    await db.query(
      "UPDATE users SET email_verified_at=NOW(), auth_version=auth_version+1 WHERE id=?",
      [result.account.id],
    );
    const [rows] = await db.query(
      "SELECT id,username,role,role_id,name,auth_version FROM users WHERE id=?",
      [result.account.id],
    );
    const { token: trustedToken, maxAgeMs } = await issueTrustedSession(db, {
      accountId: rows[0].id,
      authVersion: rows[0].auth_version,
    });
    res.cookie(
      TRUSTED_SESSION_COOKIE,
      trustedToken,
      trustedSessionCookieOptions(maxAgeMs),
    );
    return res.json({
      success: true,
      message: "ยืนยันอีเมลสำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง",
      requiresLogin: true,
      user: staffPayload(rows[0]),
    });
  } catch (error) {
    console.error("Staff email verification failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถยืนยันอีเมลได้" });
  }
});

router.post("/login/resend-otp", otpLimiter, async (req, res) => {
  try {
    const purpose = req.body.emailVerification
      ? "email_verification"
      : "staff_login";
    const result = await resendChallenge(db, {
      challengeToken: req.body.challengeToken,
      accountType: "staff",
      purpose,
    });
    if (result.error)
      return res.status(429).json({
        success: false,
        message: result.error,
        resendAfter: result.resendAfter,
      });
    return res.json(result);
  } catch (error) {
    console.error("Staff OTP resend failed:", error.code || error.message);
    return res.status(503).json({
      success: false,
      message: "ไม่สามารถส่งรหัสใหม่ได้ กรุณาลองใหม่",
    });
  }
});

router.post("/password-recovery/request", otpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const generic = {
    success: true,
    message: "หากอีเมลนี้ผูกกับบัญชี ระบบได้ส่งรหัสยืนยันให้แล้ว",
  };
  try {
    if (!email) return res.json(generic);
    const [rows] = await db.query(
      "SELECT id,email,auth_version FROM users WHERE email=? AND status='active' LIMIT 2",
      [email],
    );
    if (rows.length !== 1) return res.json(generic);
    const challenge = await createChallenge(db, {
      accountType: "staff",
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
      "Password recovery request failed:",
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
      accountType: "staff",
      purpose: "account_recovery",
      loadAccount: async (connection, id) => {
        const [rows] = await connection.query(
          "SELECT id,username,status,auth_version,email_verified_at FROM users WHERE id=? AND status='active' LIMIT 1",
          [id],
        );
        return rows[0] || null;
      },
    });
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });
    const recoveryToken = jwt.sign(
      {
        sub: result.account.id,
        account_type: "staff",
        purpose: "password_recovery",
        auth_version: Number(result.account.auth_version || 0),
      },
      process.env.JWT_SECRET,
      { expiresIn: "5m", algorithm: "HS256" },
    );
    return res.json({
      success: true,
      recoveryToken,
      username: result.account.username,
    });
  } catch (error) {
    console.error("Password recovery verification failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถยืนยันรหัสได้" });
  }
});

router.post("/password-recovery/reset", otpLimiter, async (req, res) => {
  const password = req.body.password;
  // Same form as patient recovery, so it shares the patient password policy.
  if (!isStrongPassword(password))
    return res
      .status(400)
      .json({ success: false, message: PASSWORD_POLICY_MESSAGE });
  try {
    const decoded = jwt.verify(req.body.recoveryToken, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (
      decoded.account_type !== "staff" ||
      decoded.purpose !== "password_recovery" ||
      !decoded.sub
    )
      throw new Error("invalid recovery token");
    const [result] = await db.query(
      "UPDATE users SET password=?, email_verified_at=COALESCE(email_verified_at, NOW()), auth_version=auth_version+1 WHERE id=? AND auth_version=? AND status='active'",
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
    return res.json({
      success: true,
      message: "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบ",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "คำขอกู้รหัสผ่านหมดอายุแล้ว กรุณาเริ่มใหม่",
    });
  }
});

// ============================================================
//  Self-service profile: signed-in staff manage their own account.
//  Changing the email or password requires the current password.
// ============================================================
const profileLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKeyGenerator,
  message: {
    success: false,
    message: "ลองยืนยันรหัสผ่านมากเกินไป กรุณารอสักครู่",
  },
});

async function loadOwnProfile(userId) {
  const [rows] = await db.query(
    `SELECT u.id, u.username, u.name, u.email, u.email_verified_at, u.role, u.role_id,
            u.status, u.created_at, u.auth_version, r.name role_name
       FROM users u LEFT JOIN roles r ON r.id=u.role_id
      WHERE u.id=? LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

// Returns the stored row when the password matches, otherwise null.
async function verifyOwnPassword(userId, password) {
  const [rows] = await db.query(
    "SELECT password, email, auth_version FROM users WHERE id=? AND status='active' LIMIT 1",
    [userId],
  );
  const stored = rows[0];
  if (
    !stored ||
    !stored.password?.startsWith("$2") ||
    !(await bcrypt.compare(password, stored.password))
  )
    return null;
  return stored;
}

// 400 rather than 401 so the client keeps the current session.
const wrongPassword = (res) =>
  res
    .status(400)
    .json({ success: false, message: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
const accountChanged = (res) =>
  res.status(409).json({
    success: false,
    message: "ข้อมูลบัญชีมีการเปลี่ยนแปลง กรุณาลองใหม่อีกครั้ง",
  });

const ownProfileResponse = (user) => ({
  id: user.id,
  username: user.username,
  name: displayName(user.name),
  email: user.email,
  email_verified_at: user.email_verified_at,
  role_id: user.role_id,
  role_name: user.role_name,
  created_at: user.created_at,
});

router.get("/me/profile", verifyToken, async (req, res) => {
  try {
    const user = await loadOwnProfile(req.user.id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบบัญชีผู้ใช้" });
    return res.json({ success: true, profile: ownProfileResponse(user) });
  } catch (error) {
    console.error("Load own profile failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

router.put("/me/profile", verifyToken, async (req, res) => {
  const name = normaliseText(req.body.name);
  const length = Array.from(name).length;
  if (length < 2 || length > MAX_NAME_LENGTH)
    return res.status(422).json({
      success: false,
      message: `ชื่อ-นามสกุลต้องยาว 2-${MAX_NAME_LENGTH} ตัวอักษร`,
    });
  try {
    await db.query("UPDATE users SET name=? WHERE id=?", [
      encrypt(name),
      req.user.id,
    ]);
    const user = await loadOwnProfile(req.user.id);
    return res.json({
      success: true,
      message: "บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว",
      profile: ownProfileResponse(user),
      user: staffPayload(user),
    });
  } catch (error) {
    console.error("Update own profile failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

router.put("/me/password", profileLimiter, verifyToken, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = req.body.newPassword;
  if (!currentPassword)
    return res
      .status(422)
      .json({ success: false, message: "กรุณากรอกรหัสผ่านปัจจุบัน" });
  if (!validPassword(newPassword))
    return res
      .status(422)
      .json({ success: false, message: "รหัสผ่านใหม่ต้องมี 8-200 ตัวอักษร" });
  if (newPassword === currentPassword)
    return res.status(422).json({
      success: false,
      message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน",
    });
  try {
    const stored = await verifyOwnPassword(req.user.id, currentPassword);
    if (!stored) return wrongPassword(res);
    // Bumping auth_version signs out every other session; this one gets a
    // freshly signed token below so the user stays logged in.
    const [result] = await db.query(
      "UPDATE users SET password=?, auth_version=auth_version+1 WHERE id=? AND auth_version=?",
      [
        await bcrypt.hash(newPassword, 12),
        req.user.id,
        Number(stored.auth_version || 0),
      ],
    );
    if (!result.affectedRows) return accountChanged(res);
    const user = await loadOwnProfile(req.user.id);
    return res.json({
      success: true,
      message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว",
      token: signStaffToken(user),
      user: staffPayload(user),
    });
  } catch (error) {
    console.error("Change own password failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// The new address starts unverified, so the next login sends an email
// verification OTP to it (same as when an administrator changes it).
router.put("/me/email", profileLimiter, verifyToken, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const email = normalizeEmail(req.body.email);
  if (!currentPassword)
    return res
      .status(422)
      .json({ success: false, message: "กรุณากรอกรหัสผ่านปัจจุบัน" });
  if (
    email.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  )
    return res
      .status(422)
      .json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" });
  try {
    const stored = await verifyOwnPassword(req.user.id, currentPassword);
    if (!stored) return wrongPassword(res);
    if (normalizeEmail(stored.email) === email)
      return res
        .status(422)
        .json({ success: false, message: "อีเมลใหม่ต้องไม่ซ้ำกับอีเมลเดิม" });
    // Password recovery looks accounts up by email, so it must stay unique.
    const [taken] = await db.query(
      "SELECT id FROM users WHERE email=? AND id<>? LIMIT 1",
      [email, req.user.id],
    );
    if (taken.length)
      return res
        .status(409)
        .json({ success: false, message: "อีเมลนี้ถูกใช้งานโดยบัญชีอื่นแล้ว" });
    const [result] = await db.query(
      "UPDATE users SET email=?, email_verified_at=NULL, auth_version=auth_version+1 WHERE id=? AND auth_version=?",
      [email, req.user.id, Number(stored.auth_version || 0)],
    );
    if (!result.affectedRows) return accountChanged(res);
    const user = await loadOwnProfile(req.user.id);
    return res.json({
      success: true,
      message: "เปลี่ยนอีเมลเรียบร้อยแล้ว",
      profile: ownProfileResponse(user),
      token: signStaffToken(user),
      user: staffPayload(user),
    });
  } catch (error) {
    console.error("Change own email failed:", error.message);
    return res
      .status(500)
      .json({ success: false, message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

module.exports = router;
