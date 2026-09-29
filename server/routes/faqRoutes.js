const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { sanitizeRichText } = require("../utils/contentSecurity");
const { organizationWhere } = require("../authorization/authorization");

const PUBLISHED = "published";
const idOf = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const fail = (res, result) =>
  res.status(result.status).json({ success: false, message: result.message });

async function clinicInScope(req, clinicId) {
  const id = idOf(clinicId);
  if (!id) return { status: 422, message: "กรุณาเลือกคลินิก" };
  const [rows] = await db.query(
    "SELECT organization_id FROM clinics WHERE id=?",
    [id],
  );
  if (!rows.length) return { status: 404, message: "ไม่พบคลินิก" };
  if (
    req.organizationContext !== "all" &&
    Number(rows[0].organization_id) !== Number(req.organizationContext)
  )
    return {
      status: 403,
      message: "คุณไม่มีสิทธิ์เข้าถึงคลินิกของหน่วยงานนี้",
    };
  return null;
}

async function categoryInScope(req, categoryId) {
  const [rows] = await db.query(
    "SELECT clinic_id FROM faq_categories WHERE id=?",
    [categoryId],
  );
  if (!rows.length) return { status: 404, message: "ไม่พบหมวดหมู่" };
  return clinicInScope(req, rows[0].clinic_id);
}

async function faqInScope(req, faqId) {
  const [rows] = await db.query(
    "SELECT f.clinic_id,c.organization_id FROM faqs f LEFT JOIN clinics c ON c.id=f.clinic_id WHERE f.id=?",
    [faqId],
  );
  if (!rows.length) return { status: 404, message: "ไม่พบคำถาม" };
  const faq = rows[0];
  if (!faq.clinic_id && !req.authorization?.isSystemAdmin)
    return {
      status: 403,
      message: "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการ FAQ ส่วนกลางได้",
    };
  if (
    faq.clinic_id &&
    req.organizationContext !== "all" &&
    Number(faq.organization_id) !== Number(req.organizationContext)
  )
    return { status: 403, message: "คุณไม่มีสิทธิ์เข้าถึง FAQ ของหน่วยงานนี้" };
  return null;
}

// Public API: published FAQ only. Keep it separate from all administrative reads.
router.get("/public/faqs", async (req, res) => {
  try {
    const scope =
      typeof req.organizationContext === "number"
        ? organizationWhere("c.organization_id", req)
        : { sql: "", params: [] };
    const [rows] = await db.query(
      `SELECT f.id faq_id,f.question,f.answer,f.is_homepage,f.display_order,f.clinic_id,f.category_id,
      cat.category_name,c.name clinic_name FROM faqs f LEFT JOIN faq_categories cat ON cat.id=f.category_id
      LEFT JOIN clinics c ON c.id=f.clinic_id WHERE f.status=? AND (f.clinic_id IS NULL OR (c.is_active=1 AND c.show_in_help_center=1))
      ${scope.sql} ORDER BY COALESCE(f.clinic_id,0),f.display_order,f.id`,
      [PUBLISHED, ...scope.params],
    );
    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        answer: sanitizeRichText(row.answer),
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});
router.get("/public/categories/:clinicId", async (req, res) => {
  try {
    const scope =
      typeof req.organizationContext === "number"
        ? organizationWhere("c.organization_id", req)
        : { sql: "", params: [] };
    const [rows] = await db.query(
      `SELECT fc.* FROM faq_categories fc JOIN clinics c ON c.id=fc.clinic_id
      WHERE fc.clinic_id=? AND fc.status=? AND c.is_active=1 AND c.show_in_help_center=1
      ${scope.sql} ORDER BY fc.display_order,fc.id`,
      [req.params.clinicId, PUBLISHED, ...scope.params],
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/categories/:clinicId", verifyToken, async (req, res) => {
  const denied = await clinicInScope(req, req.params.clinicId);
  if (denied) return fail(res, denied);
  const [rows] = await db.query(
    "SELECT * FROM faq_categories WHERE clinic_id=? ORDER BY display_order,id",
    [req.params.clinicId],
  );
  res.json({ success: true, data: rows });
});
router.post("/categories", verifyToken, async (req, res) => {
  const denied = await clinicInScope(req, req.body.clinic_id);
  if (denied) return fail(res, denied);
  const [result] = await db.query(
    "INSERT INTO faq_categories (clinic_id,category_name,display_order,status) VALUES (?,?,?,?)",
    [
      req.body.clinic_id,
      String(req.body.category_name || "").trim(),
      Number(req.body.display_order) || 0,
      req.body.status || PUBLISHED,
    ],
  );
  res.json({ success: true, insertId: result.insertId });
});
router.patch("/categories/:id", verifyToken, async (req, res) => {
  const denied = await categoryInScope(req, req.params.id);
  if (denied) return fail(res, denied);
  await db.query(
    "UPDATE faq_categories SET category_name=?,display_order=?,status=? WHERE id=?",
    [
      String(req.body.category_name || "").trim(),
      Number(req.body.display_order) || 0,
      req.body.status || PUBLISHED,
      req.params.id,
    ],
  );
  res.json({ success: true });
});
router.delete("/categories/:id", verifyToken, async (req, res) => {
  const denied = await categoryInScope(req, req.params.id);
  if (denied) return fail(res, denied);
  await db.query("DELETE FROM faq_categories WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

router.get("/faqs", verifyToken, async (req, res) => {
  try {
    const scope = organizationWhere("c.organization_id", req);
    let sql = `SELECT f.id faq_id,f.question,f.answer,f.is_homepage,f.status,f.display_order,f.updated_at,f.clinic_id,f.category_id,cat.category_name,c.name clinic_name
      FROM faqs f LEFT JOIN faq_categories cat ON cat.id=f.category_id LEFT JOIN clinics c ON c.id=f.clinic_id
      WHERE (f.clinic_id IS NULL OR 1=1${scope.sql})`;
    const params = [...scope.params];
    if (req.query.clinic_id) {
      sql += " AND f.clinic_id=?";
      params.push(req.query.clinic_id);
    }
    if (req.query.status) {
      sql += " AND f.status=?";
      params.push(req.query.status);
    }
    if (req.query.search) {
      sql += " AND f.question LIKE ?";
      params.push(`%${req.query.search}%`);
    }
    sql += " ORDER BY COALESCE(f.clinic_id,0),f.display_order,f.id";
    const [rows] = await db.query(sql, params);
    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        answer: sanitizeRichText(row.answer),
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function validateFaqPayload(req, res) {
  const clinicId = idOf(req.body.clinic_id);
  if (!clinicId && !req.authorization?.isSystemAdmin) {
    fail(res, {
      status: 403,
      message: "เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการ FAQ ส่วนกลางได้",
    });
    return null;
  }
  if (clinicId) {
    const denied = await clinicInScope(req, clinicId);
    if (denied) {
      fail(res, denied);
      return null;
    }
  }
  if (req.body.category_id) {
    const denied = await categoryInScope(req, req.body.category_id);
    if (denied) {
      fail(res, denied);
      return null;
    }
  }
  return clinicId;
}
router.post("/faqs", verifyToken, async (req, res) => {
  const clinicId = await validateFaqPayload(req, res);
  if (clinicId === null && !req.authorization?.isSystemAdmin) return;
  const [result] = await db.query(
    "INSERT INTO faqs (category_id,clinic_id,question,answer,is_homepage,status,display_order) VALUES (?,?,?,?,?,?,?)",
    [
      idOf(req.body.category_id),
      clinicId,
      String(req.body.question || "").trim(),
      sanitizeRichText(req.body.answer),
      req.body.is_homepage ? 1 : 0,
      req.body.status || PUBLISHED,
      Number(req.body.display_order) || 0,
    ],
  );
  res.json({ success: true, insertId: result.insertId });
});
router.put("/faqs/:id", verifyToken, async (req, res) => {
  const existing = await faqInScope(req, req.params.id);
  if (existing) return fail(res, existing);
  const clinicId = await validateFaqPayload(req, res);
  if (clinicId === null && !req.authorization?.isSystemAdmin) return;
  await db.query(
    "UPDATE faqs SET category_id=?,clinic_id=?,question=?,answer=?,is_homepage=?,status=?,display_order=? WHERE id=?",
    [
      idOf(req.body.category_id),
      clinicId,
      String(req.body.question || "").trim(),
      sanitizeRichText(req.body.answer),
      req.body.is_homepage ? 1 : 0,
      req.body.status || PUBLISHED,
      Number(req.body.display_order) || 0,
      req.params.id,
    ],
  );
  res.json({ success: true });
});
router.delete("/faqs/:id", verifyToken, async (req, res) => {
  const denied = await faqInScope(req, req.params.id);
  if (denied) return fail(res, denied);
  await db.query("DELETE FROM faqs WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
