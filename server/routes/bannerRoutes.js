// routes/bannerRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { normalizeTrustedAssetUrl, normalizeTrustedLink } = require("../utils/contentSecurity");

// 1. ดึงข้อมูลแบนเนอร์ทั้งหมดเรียงตามลำดับ (position)
router.get("/banners", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM banners ORDER BY position ASC, id DESC",
    );
    res.json(
      rows
        .map((row) => ({
          ...row,
          image: normalizeTrustedAssetUrl(row.image),
          link: normalizeTrustedLink(row.link),
        }))
        .filter((row) => row.image),
    );
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 2. เพิ่มแบนเนอร์ใหม่
router.post("/banners", verifyToken, async (req, res) => {
  try {
    const { image, filename, link } = req.body;
    const safeLink = link ? normalizeTrustedLink(link) : null;
    const safeImage = normalizeTrustedAssetUrl(image);
    if (!safeImage) {
      return res.status(400).json({ message: "Banner image is not a trusted image URL or data image" });
    }
    if (link && !safeLink) {
      return res.status(400).json({ message: "Banner link is not a trusted HTTPS URL" });
    }
    const [max] = await db.query("SELECT MAX(position) as maxPos FROM banners");
    const position = (max[0].maxPos || 0) + 1;
    const [result] = await db.query(
      "INSERT INTO banners (image, filename, link, position) VALUES (?, ?, ?, ?)",
      [safeImage, filename, safeLink, position],
    );
    res.json({ message: "Banner created", id: result.insertId });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 3. แก้ไขรูปแบนเนอร์ — ต้องอยู่ก่อน DELETE /:id
router.patch("/banners/:id/image", verifyToken, async (req, res) => {
  try {
    const { image, filename, link } = req.body;
    if (!image) return res.status(400).json({ message: "ไม่มีรูปภาพ" });
    const safeImage = normalizeTrustedAssetUrl(image);
    if (!safeImage) {
      return res.status(400).json({ message: "Banner image is not a trusted image URL or data image" });
    }
    const finalLink = link && link.trim() !== "" ? normalizeTrustedLink(link) : null;
    if (link && link.trim() && !finalLink) {
      return res.status(400).json({ message: "Banner link is not a trusted HTTPS URL" });
    }

    await db.query(
      "UPDATE banners SET image = ?, filename = ?, link = ? WHERE id = ?",
      [safeImage, filename || "banner.jpg", finalLink, req.params.id],
    );
    res.json({ success: true, message: "อัปเดตแบนเนอร์สำเร็จ" });
  } catch (err) {
    console.error("Update Banner Image Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// 4. ลบแบนเนอร์
router.delete("/banners/:id", verifyToken, async (req, res) => {
  try {
    await db.query("DELETE FROM banners WHERE id=?", [req.params.id]);
    res.json({ message: "Banner deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 5. สลับตำแหน่ง/จัดเรียงแบนเนอร์ใหม่ (Reorder)
router.post("/banners/reorder", verifyToken, async (req, res) => {
  try {
    const banners = req.body;
    for (let i = 0; i < banners.length; i++) {
      await db.query("UPDATE banners SET position=? WHERE id=?", [
        i,
        banners[i].id,
      ]);
    }
    res.json({ message: "Reordered" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
