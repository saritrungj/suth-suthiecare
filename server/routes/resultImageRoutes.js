// routes/resultImageRoutes.js
// Per-organization pictures for the low / medium / high assessment result
// levels. Levels without a custom picture use the images bundled with the app.
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { safeError } = require("../utils/safeError");

const LEVELS = ["low", "medium", "high"];
// About 2.2 MB of image data once base64 encoded.
const MAX_IMAGE_CHARS = 3_000_000;
const DATA_IMAGE = /^data:image\/(?:png|webp|jpeg);base64,[a-z0-9+/=\s]+$/i;

// The table arrives with a migration; until then every level is "default".
const isMissingTable = (error) => error?.code === "ER_NO_SUCH_TABLE";

const emptyImages = () => ({ low: null, medium: null, high: null });

async function imagesForOrganization(organizationId, withMeta = false) {
  const images = emptyImages();
  try {
    const [rows] = await db.query(
      "SELECT level, image, filename, updated_at FROM organization_result_images WHERE organization_id = ?",
      [organizationId],
    );
    for (const row of rows) {
      if (!LEVELS.includes(row.level)) continue;
      images[row.level] = withMeta
        ? {
            image: row.image,
            filename: row.filename || null,
            updated_at: row.updated_at,
          }
        : row.image;
    }
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  return images;
}

// Admin pages work on exactly one organization at a time.
const activeOrganization = (req, res) => {
  const organizationId = req.organizationContext;
  if (typeof organizationId !== "number") {
    res.status(422).json({
      code: "SELECT_ONE_ORGANIZATION",
      message: "กรุณาเลือกหน่วยงานที่ต้องการจัดการภาพผลลัพธ์",
    });
    return null;
  }
  return organizationId;
};

const levelParam = (req, res) => {
  const { level } = req.params;
  if (LEVELS.includes(level)) return level;
  res
    .status(400)
    .json({ code: "INVALID_LEVEL", message: "ระดับผลลัพธ์ไม่ถูกต้อง" });
  return null;
};

// Public: the result page asks for the pictures of the form's organization.
router.get("/result-images/forms/:formId", async (req, res) => {
  const formId = Number(req.params.formId);
  if (!Number.isInteger(formId) || formId <= 0)
    return res.json({ images: emptyImages() });
  try {
    const [forms] = await db.query(
      "SELECT organization_id FROM forms WHERE id = ? LIMIT 1",
      [formId],
    );
    const organizationId = forms[0]?.organization_id;
    const images = organizationId
      ? await imagesForOrganization(organizationId)
      : emptyImages();
    res.set("Cache-Control", "public, max-age=300");
    res.json({ images });
  } catch (error) {
    console.error("Result images lookup failed:", safeError(error));
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/admin/result-images", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  try {
    res.json({ images: await imagesForOrganization(organizationId, true) });
  } catch (error) {
    console.error("Result images load failed:", safeError(error));
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/admin/result-images/:level", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  const level = levelParam(req, res);
  if (!level) return;
  const image =
    typeof req.body?.image === "string" ? req.body.image.trim() : "";
  if (!DATA_IMAGE.test(image))
    return res.status(400).json({
      code: "INVALID_IMAGE",
      message: "รองรับเฉพาะไฟล์ภาพ PNG, WEBP หรือ JPEG",
    });
  if (image.length > MAX_IMAGE_CHARS)
    return res.status(413).json({
      code: "IMAGE_TOO_LARGE",
      message: "ไฟล์ภาพมีขนาดใหญ่เกินไป",
    });
  const filename =
    typeof req.body?.filename === "string"
      ? req.body.filename.trim().slice(0, 255) || null
      : null;
  try {
    await db.query(
      `INSERT INTO organization_result_images (organization_id, level, image, filename, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE image = VALUES(image), filename = VALUES(filename), updated_by = VALUES(updated_by)`,
      [organizationId, level, image, filename, req.user?.id || null],
    );
    res.json({ success: true, level });
  } catch (error) {
    if (isMissingTable(error))
      return res.status(503).json({
        code: "RESULT_IMAGES_NOT_READY",
        message: "ระบบยังไม่พร้อมจัดเก็บภาพผลลัพธ์ โปรดแจ้งผู้ดูแลระบบ",
      });
    console.error("Result image save failed:", safeError(error));
    res.status(500).json({ message: "Server error" });
  }
});

// Removing a custom picture puts the bundled default back.
router.delete("/admin/result-images/:level", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  const level = levelParam(req, res);
  if (!level) return;
  try {
    await db.query(
      "DELETE FROM organization_result_images WHERE organization_id = ? AND level = ?",
      [organizationId, level],
    );
    res.json({ success: true, level });
  } catch (error) {
    if (isMissingTable(error)) return res.json({ success: true, level });
    console.error("Result image reset failed:", safeError(error));
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
