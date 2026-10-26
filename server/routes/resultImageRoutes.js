// routes/resultImageRoutes.js
// Back-office customization of the assessment result page, per organization:
// - pictures for the low / medium / high result levels (bundled images when unset)
// - a picture library that scoring ranges of a form can point at ("asset:<id>")
// - the wording of the result page (app text when unset)
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { safeError } = require("../utils/safeError");
const { ensureResultPageTables } = require("../services/resultPageSchema");

const LEVELS = ["low", "medium", "high"];
// About 2.2 MB of image data once base64 encoded.
const MAX_IMAGE_CHARS = 3_000_000;
const DATA_IMAGE = /^data:image\/(?:png|webp|jpeg);base64,[a-z0-9+/=\s]+$/i;
const MAX_ASSETS = 60;
// Plain-text wording the result page lets an organization replace.
const TEXT_KEYS = [
  "hero_saved_title",
  "hero_saved_desc",
  "hero_done_title",
  "hero_done_desc",
  "advice_title",
  "score_label",
  "back_home",
  "btn_history",
  "btn_eval",
];
const MAX_TEXT_CHARS = 500;
const ASSET_REF = /^asset:(\d+)$/;

const isMissingTable = (error) => error?.code === "ER_NO_SUCH_TABLE";

// Run a query; when its table is missing, create the tables once and retry.
async function withTables(run) {
  try {
    return await run();
  } catch (error) {
    if (!isMissingTable(error) || !(await ensureResultPageTables()))
      throw error;
    return run();
  }
}

// Reads fall back to defaults when the tables cannot be created.
async function readOr(fallback, run) {
  try {
    return await withTables(run);
  } catch (error) {
    if (isMissingTable(error)) return fallback;
    throw error;
  }
}

const emptyImages = () => ({ low: null, medium: null, high: null });

async function imagesForOrganization(organizationId, withMeta = false) {
  const images = emptyImages();
  const rows = await readOr([], async () => {
    const [result] = await db.query(
      "SELECT level, image, filename, updated_at FROM organization_result_images WHERE organization_id = ?",
      [organizationId],
    );
    return result;
  });
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
  return images;
}

const parseJson = (value) => {
  if (typeof value !== "string") return value || {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

const cleanTexts = (value) => {
  const source = parseJson(value);
  const texts = {};
  for (const key of TEXT_KEYS) {
    const text =
      typeof source?.[key] === "string"
        ? source[key].trim().slice(0, MAX_TEXT_CHARS)
        : "";
    if (text) texts[key] = text;
  }
  return texts;
};

async function textsForOrganization(organizationId) {
  const rows = await readOr([], async () => {
    const [result] = await db.query(
      "SELECT texts FROM organization_result_page_settings WHERE organization_id = ?",
      [organizationId],
    );
    return result;
  });
  return cleanTexts(rows[0]?.texts);
}

// Every "asset:<id>" a form's scoring ranges point at, groups included.
function assetIdsInQuestions(questions) {
  const ids = new Set();
  const visit = (list) => {
    for (const question of Array.isArray(list) ? list : []) {
      for (const rule of question?.scoringRules || []) {
        const match = String(rule?.resultImage || "").match(ASSET_REF);
        if (match) ids.add(Number(match[1]));
      }
      visit(question?.subQuestions);
    }
  };
  visit(questions);
  return [...ids];
}

async function assetsById(organizationId, ids) {
  if (!ids.length) return {};
  const rows = await readOr([], async () => {
    const [result] = await db.query(
      "SELECT id, image FROM organization_result_image_assets WHERE organization_id = ? AND id IN (?)",
      [organizationId, ids],
    );
    return result;
  });
  return Object.fromEntries(rows.map((row) => [row.id, row.image]));
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

// Validates the uploaded picture; answers the request itself when invalid.
const imageBody = (req, res) => {
  const image =
    typeof req.body?.image === "string" ? req.body.image.trim() : "";
  if (!DATA_IMAGE.test(image)) {
    res.status(400).json({
      code: "INVALID_IMAGE",
      message: "รองรับเฉพาะไฟล์ภาพ PNG, WEBP หรือ JPEG",
    });
    return null;
  }
  if (image.length > MAX_IMAGE_CHARS) {
    res.status(413).json({
      code: "IMAGE_TOO_LARGE",
      message: "ไฟล์ภาพมีขนาดใหญ่เกินไป",
    });
    return null;
  }
  const filename =
    typeof req.body?.filename === "string"
      ? req.body.filename.trim().slice(0, 255) || null
      : null;
  return { image, filename };
};

const writeFailed = (res, error, label) => {
  if (isMissingTable(error))
    return res.status(503).json({
      code: "RESULT_IMAGES_NOT_READY",
      message: "ระบบยังไม่พร้อมจัดเก็บการตั้งค่าผลลัพธ์ โปรดแจ้งผู้ดูแลระบบ",
    });
  console.error(`${label}:`, safeError(error));
  return res.status(500).json({ message: "Server error" });
};

// Public: the result page asks for the customization of the form's organization.
router.get("/result-images/forms/:formId", async (req, res) => {
  const formId = Number(req.params.formId);
  const empty = { images: emptyImages(), assets: {}, texts: {} };
  if (!Number.isInteger(formId) || formId <= 0) return res.json(empty);
  try {
    const [forms] = await db.query(
      "SELECT organization_id, questions FROM forms WHERE id = ? LIMIT 1",
      [formId],
    );
    const organizationId = forms[0]?.organization_id;
    if (!organizationId) return res.json(empty);
    const questions = parseJson(forms[0].questions);
    const [images, assets, texts] = await Promise.all([
      imagesForOrganization(organizationId),
      assetsById(organizationId, assetIdsInQuestions(questions)),
      textsForOrganization(organizationId),
    ]);
    res.set("Cache-Control", "public, max-age=300");
    res.json({ images, assets, texts });
  } catch (error) {
    console.error("Result images lookup failed:", safeError(error));
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/admin/result-images", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  try {
    const [images, assets, texts] = await Promise.all([
      imagesForOrganization(organizationId, true),
      readOr([], async () => {
        const [rows] = await db.query(
          "SELECT id, image, filename, created_at FROM organization_result_image_assets WHERE organization_id = ? ORDER BY id",
          [organizationId],
        );
        return rows;
      }),
      textsForOrganization(organizationId),
    ]);
    res.json({ images, assets, texts });
  } catch (error) {
    console.error("Result images load failed:", safeError(error));
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/admin/result-images/texts", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  const texts = cleanTexts(req.body?.texts);
  try {
    await withTables(() =>
      db.query(
        `INSERT INTO organization_result_page_settings (organization_id, texts, updated_by)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE texts = VALUES(texts), updated_by = VALUES(updated_by)`,
        [organizationId, JSON.stringify(texts), req.user?.id || null],
      ),
    );
    res.json({ success: true, texts });
  } catch (error) {
    writeFailed(res, error, "Result page texts save failed");
  }
});

router.post("/admin/result-images/assets", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  const body = imageBody(req, res);
  if (!body) return;
  try {
    const [[{ total }]] = await withTables(() =>
      db.query(
        "SELECT COUNT(*) AS total FROM organization_result_image_assets WHERE organization_id = ?",
        [organizationId],
      ),
    );
    if (Number(total) >= MAX_ASSETS)
      return res.status(409).json({
        code: "TOO_MANY_RESULT_IMAGES",
        message: `คลังภาพเก็บได้ไม่เกิน ${MAX_ASSETS} ภาพ กรุณาลบภาพที่ไม่ใช้ก่อน`,
      });
    const [result] = await db.query(
      "INSERT INTO organization_result_image_assets (organization_id, image, filename, updated_by) VALUES (?, ?, ?, ?)",
      [organizationId, body.image, body.filename, req.user?.id || null],
    );
    res.status(201).json({ success: true, id: result.insertId });
  } catch (error) {
    writeFailed(res, error, "Result image asset save failed");
  }
});

// Forms that still point at a removed picture fall back to the level picture.
router.delete(
  "/admin/result-images/assets/:id",
  verifyToken,
  async (req, res) => {
    const organizationId = activeOrganization(req, res);
    if (organizationId === null) return;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0)
      return res
        .status(400)
        .json({ code: "INVALID_ASSET", message: "ไม่พบภาพที่ต้องการลบ" });
    try {
      await readOr(null, () =>
        db.query(
          "DELETE FROM organization_result_image_assets WHERE id = ? AND organization_id = ?",
          [id, organizationId],
        ),
      );
      res.json({ success: true, id });
    } catch (error) {
      writeFailed(res, error, "Result image asset delete failed");
    }
  },
);

router.put("/admin/result-images/:level", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  const level = levelParam(req, res);
  if (!level) return;
  const body = imageBody(req, res);
  if (!body) return;
  try {
    await withTables(() =>
      db.query(
        `INSERT INTO organization_result_images (organization_id, level, image, filename, updated_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE image = VALUES(image), filename = VALUES(filename), updated_by = VALUES(updated_by)`,
        [
          organizationId,
          level,
          body.image,
          body.filename,
          req.user?.id || null,
        ],
      ),
    );
    res.json({ success: true, level });
  } catch (error) {
    writeFailed(res, error, "Result image save failed");
  }
});

// Removing a custom picture puts the bundled default back.
router.delete("/admin/result-images/:level", verifyToken, async (req, res) => {
  const organizationId = activeOrganization(req, res);
  if (organizationId === null) return;
  const level = levelParam(req, res);
  if (!level) return;
  try {
    await readOr(null, () =>
      db.query(
        "DELETE FROM organization_result_images WHERE organization_id = ? AND level = ?",
        [organizationId, level],
      ),
    );
    res.json({ success: true, level });
  } catch (error) {
    writeFailed(res, error, "Result image reset failed");
  }
});

module.exports = router;
module.exports.assetIdsInQuestions = assetIdsInQuestions;
