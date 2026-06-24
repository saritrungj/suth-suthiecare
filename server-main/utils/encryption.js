/**
 * ============================================================
 * server/utils/encryption.js
 * AES-256-GCM Encryption Utility — suthieproj
 * (Optimized Version - Caching Keys in Memory)
 * ============================================================
 */

const crypto = require("crypto");
require("dotenv").config(); // 🟢 สำคัญ: โหลด .env เผื่อไว้ให้ชัวร์ว่ามีข้อมูล

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// 🟢 1. ดึงและแปลงกุญแจแค่ "ครั้งเดียว" ตอนเริ่มทำงาน (ลดภาระ CPU มหาศาล)
const rawAesKey = process.env.AES_KEY || "";
if (rawAesKey.length !== 64) {
  console.warn("⚠️ คำเตือน: AES_KEY ใน .env ควรมี 64 ตัวอักษร (256-bit)");
}
const AES_KEY_BUFFER = Buffer.from(rawAesKey, "hex");

const AES_SEARCH_KEY = process.env.AES_SEARCH_KEY || "";
if (AES_SEARCH_KEY.length < 32) {
  console.warn("⚠️ คำเตือน: AES_SEARCH_KEY ใน .env ควรมีอย่างน้อย 32 ตัวอักษร");
}

// ── Encrypt ───────────────────────────────────────────────
function encrypt(text) {
  if (text === null || text === undefined || text === "") return null;
  const iv = crypto.randomBytes(IV_LENGTH);
  // 🟢 2. เรียกใช้กุญแจที่แปลงไว้แล้วได้เลย
  const cipher = crypto.createCipheriv(ALGORITHM, AES_KEY_BUFFER, iv);
  const encrypted = Buffer.concat([
    cipher.update(String(text), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

// ── Decrypt ───────────────────────────────────────────────
function decrypt(encryptedBase64) {
  if (!encryptedBase64) return null;
  try {
    const buf = Buffer.from(encryptedBase64, "base64");

    // เช็คความยาวข้อมูลเบื้องต้น
    if (buf.length <= IV_LENGTH + TAG_LENGTH) {
      return encryptedBase64;
    }

    const iv = buf.slice(0, IV_LENGTH);
    const authTag = buf.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = buf.slice(IV_LENGTH + TAG_LENGTH);

    // 🟢 3. เรียกใช้กุญแจที่แปลงไว้แล้วได้เลย ไม่ต้องคำนวณใหม่
    const decipher = crypto.createDecipheriv(ALGORITHM, AES_KEY_BUFFER, iv);

    decipher.setAuthTag(authTag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    // 🟢 คง behavior เดิม (คืนค่าเดิม) เพื่อไม่ให้ข้อมูล legacy ที่ไม่ได้เข้ารหัสพัง
    // แต่เพิ่ม log แบบไม่เปิดเผยข้อมูล (ไม่ log ตัว ciphertext/plaintext) เพื่อให้เห็นว่ามีปัญหา
    console.warn(
      `⚠️ decrypt failed (${err.name}); returning value as-is. len=${encryptedBase64.length}`,
    );
    return encryptedBase64;
  }
}

// ── HMAC Hash (สำหรับ Search) ─────────────────────────────
function hmacHash(value) {
  if (!value) return null;
  return (
    crypto
      // 🟢 4. เรียกใช้คีย์ค้นหาจากหน่วยความจำได้เลย
      .createHmac("sha256", AES_SEARCH_KEY)
      .update(String(value).trim())
      .digest("hex")
  );
}

// ── Mask และ Validate (ใช้ของเดิม ดีอยู่แล้ว) ───────────────
function maskName(name) {
  if (!name) return null;
  const parts = String(name).trim().split(" ");
  if (parts.length === 1) return parts[0];
  return parts[0] + " " + "*".repeat(parts.slice(1).join(" ").length);
}

function maskPhone(phone) {
  if (!phone) return null;
  const s = String(phone);
  return s.slice(0, 3) + "****" + s.slice(-3);
}

function maskNationalId(id) {
  if (!id) return null;
  const s = String(id);
  return s.slice(0, 4) + "*".repeat(5) + s.slice(-4);
}

function validateThaiId(id) {
  const digits = String(id).replace(/\D/g, "");
  if (digits.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(digits[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === parseInt(digits[12]);
}

function validateThaiPhone(phone) {
  return /^0[689]\d{8}$/.test(String(phone).replace(/\D/g, ""));
}

module.exports = {
  encrypt,
  decrypt,
  hmacHash,
  maskName,
  maskPhone,
  maskNationalId,
  validateThaiId,
  validateThaiPhone,
};
