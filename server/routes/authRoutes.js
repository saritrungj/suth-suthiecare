const express = require("express");
const router = express.Router();
const db = require("../config/db");
const bcrypt = require("bcryptjs"); // 🟢 กลับมาใช้ bcryptjs ตามเดิม
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const axios = require("axios");

// ── Rate Limit: ผิดได้แค่ 5 ครั้ง / 1 นาที ──
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "พยายาม Login มากเกินไป กรุณารอสักครู่",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const isTurnstileDisabled = () => process.env.DISABLE_TURNSTILE === "true";

// ✅ เปลี่ยนจาก hCaptcha → Cloudflare Turnstile
const verifyTurnstile = async (token, remoteip) => {
  try {
    const params = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token,
    });
    if (remoteip) params.append("remoteip", remoteip);

    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      params,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );
    return response.data.success === true;
  } catch {
    return false;
  }
};

// ── POST /login ──
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { username, password, turnstileToken } = req.body;

    // 1. ✅ ตรวจ Turnstile
    if (!isTurnstileDisabled() && !turnstileToken) {
      return res.status(400).json({
        success: false,
        message: "กรุณายืนยันว่าคุณไม่ใช่บอท",
      });
    }

    const remoteip = req.headers["cf-connecting-ip"] || req.ip;
    const captchaOk =
      isTurnstileDisabled() ||
      (await verifyTurnstile(turnstileToken, remoteip));

    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        message: "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่",
      });
    }

    // 2. ตรวจว่ากรอกครบ
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "กรุณากรอกข้อมูลให้ครบ",
      });
    }

    // 3. ดึง user จาก DB
    const [rows] = await db.query(
      `SELECT id, username, password, role, role_id, name, status 
       FROM users WHERE username = ?`,
      [username],
    );

    if (rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    const user = rows[0];

    // 4. ตรวจสถานะ User
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "บัญชีนี้ถูกระงับการใช้งาน",
      });
    }

    // 5. 🟢 ตรวจ Password (อนุญาตเฉพาะรหัสที่ Hash ด้วย Bcrypt เท่านั้น)
    let isMatch = false;

    // เช็คว่ารหัสใน DB ถูก Hash มาด้วย Bcrypt หรือไม่ (Bcrypt จะขึ้นต้นด้วย $2a$, $2b$ หรือ $2y$)
    if (user.password && user.password.startsWith("$2")) {
      // ใช้ bcrypt.compare เปรียบเทียบรหัสที่พิมพ์มา กับ รหัสใน DB
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      // ❌ ไม่รองรับรหัสผ่านแบบ Plain Text อีกต่อไป (ความปลอดภัย)
      // หากเจอรหัสเก่าที่ยังไม่ถูก Hash ให้ถือว่าล็อกอินไม่ผ่าน และต้อง migrate ก่อน
      console.warn(
        `Login blocked: user "${user.username}" has a non-bcrypt password. Run migratePasswords.js.`,
      );
      isMatch = false;
    }

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
      });
    }

    // 6. ออก JWT Token (อายุปรับได้ผ่าน .env, ค่าเริ่มต้น 8 ชั่วโมง)
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        role_id: user.role_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "8h" },
    );

    res.json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        role_id: user.role_id,
        name: user.name, // ชื่อยังคงเป็นรูปแบบที่เข้ารหัสมาจาก DB ต้องเอาไป Decrypt ตอนใช้งาน
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
    });
  }
});

module.exports = router;
