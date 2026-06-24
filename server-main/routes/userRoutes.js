/**
 * ============================================================
 * server/routes/userRoutes.js  —  เวอร์ชัน AES
 * แก้จากของเดิม: เพิ่ม encrypt/decrypt ใน route ที่มีอยู่
 * + แก้ password ให้ hash ด้วย bcryptjs
 * + ลบ Phone และ National ID ออกตาม Database
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // ใช้ bcryptjs ตาม package.json
const db = require("../config/db");
const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware");

const { encrypt, decrypt, maskName } = require("../utils/encryption");

function safeDecrypt(value) {
  try {
    return decrypt(value);
  } catch (e) {
    return value;
  }
}

// ============================================================
//  1. ดึงข้อมูลผู้ใช้งานทั้งหมด  GET /users
//     → แสดงข้อมูลแบบ mask (ปลอดภัย ไม่เปิดเผยข้อมูลจริง)
// ============================================================
router.get("/users", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, name, email, role_id, status, created_at FROM users ORDER BY id DESC",
    );

    // Decrypt แล้ว mask ก่อนส่งกลับ
    const data = rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role_id: row.role_id,
      status: row.status,
      created_at: row.created_at,
      // ── ข้อมูลที่ encrypt → decrypt → mask ──
      name: maskName(safeDecrypt(row.name)),
    }));

    res.json(data);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ============================================================
//  GET /users/:id/full  →  ดูข้อมูลจริง (สำหรับ admin)
//  เพิ่มใหม่: ดูข้อมูลเต็มโดย decrypt ไม่ mask
// ============================================================
router.get("/users/:id/full", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, name, email, role_id, status, created_at FROM users WHERE id = ?",
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });

    const row = rows[0];
    res.json({
      id: row.id,
      username: row.username,
      email: row.email,
      role_id: row.role_id,
      status: row.status,
      created_at: row.created_at,
      // ── decrypt ข้อมูลจริง ──
      name: decrypt(row.name),
    });
  } catch (err) {
    console.error("Error fetching user full:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ============================================================
//  2. สร้างผู้ใช้งานใหม่  POST /users
//     → encrypt name ก่อน INSERT
//     → hash password ด้วย bcryptjs
// ============================================================
router.post("/users", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { username, password, name, email, role_id, status } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "กรุณากรอก username และ password" });
    }
    if (
      typeof username !== "string" ||
      username.trim().length < 3 ||
      username.length > 100
    ) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 200
    ) {
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }
    if (role_id !== undefined && role_id !== null && isNaN(Number(role_id))) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const encName = name ? encrypt(name) : null;

    const [result] = await db.query(
      `INSERT INTO users
        (username, password, name, email, role_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, encName, email, role_id, status || "active"],
    );

    res
      .status(201)
      .json({ id: result.insertId, message: "สร้างผู้ใช้งานสำเร็จ" });
  } catch (err) {
    console.error("Error creating user:", err);

    // 🔥 เพิ่มส่วนนี้: ดักจับ Error กรณีข้อมูลซ้ำ (ER_DUP_ENTRY)
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Username นี้มีคนใช้แล้ว กรุณาเปลี่ยนใหม่" });
    }

    // ถ้าเป็น Error อื่นๆ ก็ปล่อยไปตามปกติ
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ============================================================
//  3. แก้ไขข้อมูลผู้ใช้  PUT /users/:id
//     → re-encrypt ทุกครั้งที่แก้ไข
// ============================================================
router.put("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    const { username, name, email, role_id, status, password } = req.body;

    if (
      !username ||
      typeof username !== "string" ||
      username.trim().length < 3 ||
      username.length > 100
    ) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (role_id !== undefined && role_id !== null && isNaN(Number(role_id))) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (
      password &&
      (typeof password !== "string" ||
        password.length < 8 ||
        password.length > 200)
    ) {
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }

    // ✅ Encrypt เฉพาะตอนมีค่า
    const encName = name ? encrypt(name) : null;

    let fields = [];
    let values = [];

    // ── field พื้นฐาน ──
    fields.push("username=?");
    values.push(username);
    fields.push("name=?");
    values.push(encName);
    fields.push("email=?");
    values.push(email);
    fields.push("role_id=?");
    values.push(role_id);
    fields.push("status=?");
    values.push(status);

    // 🔐 password
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 12);
      fields.push("password=?");
      values.push(hashedPassword);
    }

    values.push(req.params.id);

    await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, values);

    res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ============================================================
//  4. ลบผู้ใช้  DELETE /users/:id
// ============================================================
router.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
    res.json({ message: "ลบผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
