const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * 
      FROM staffs
      WHERE is_active = 1
      ORDER BY fullname ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "โหลดรายชื่อไม่สำเร็จ",
    });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { fullname } = req.body;

    if (
      !fullname ||
      typeof fullname !== "string" ||
      fullname.trim() === "" ||
      fullname.length > 255
    ) {
      return res.status(400).json({ message: "กรุณาระบุชื่อให้ถูกต้อง" });
    }

    const [result] = await db.query(
      `
      INSERT INTO staffs(fullname)
      VALUES(?)
    `,
      [fullname],
    );

    res.json({
      id: result.insertId,
      fullname,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "เพิ่มรายชื่อไม่สำเร็จ",
    });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    await db.query(
      `
      DELETE FROM staffs
      WHERE id = ?
    `,
      [id],
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      message: "ลบผู้รับผิดชอบไม่สำเร็จ",
    });
  }
});

module.exports = router;
