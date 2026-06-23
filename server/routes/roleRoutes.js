// routes/roleRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware");

// 1. ดึงข้อมูล Role ทั้งหมด
router.get("/roles", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM roles");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 2. ดึง Permission ของแต่ละ Role
router.get("/roles/:id/permissions", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM permissions WHERE role_id = ?",
      [req.params.id],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 3. บันทึก/อัปเดต Permission
router.post(
  "/roles/:id/permissions",
  verifyToken,
  verifyAdmin,
  async (req, res) => {
    try {
      const roleId = req.params.id;
      const permissions = req.body;
      await db.query("DELETE FROM permissions WHERE role_id = ?", [roleId]);
      for (const module in permissions) {
        const p = permissions[module];
        await db.query(
          `INSERT INTO permissions (role_id, module, can_view, can_manage, can_full, can_view_password) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            roleId,
            module,
            p.View ? 1 : 0,
            p.Manage ? 1 : 0,
            p["Full Control"] ? 1 : 0,
            p["View Password"] ? 1 : 0,
          ],
        );
      }
      res.json({ message: "Permissions saved" });
    } catch (err) {
      console.error("Error saving permissions:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// 4. สร้าง Role ใหม่
router.post("/roles", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await db.query(
      "INSERT INTO roles (name, description) VALUES (?, ?)",
      [name, description || ""],
    );
    res.status(201).json({ id: result.insertId, message: "สร้าง Role สำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
