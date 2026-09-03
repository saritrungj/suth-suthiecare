const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { organizationWhere } = require("../authorization/authorization");

const scopedWhere = (req, column = "organization_id") =>
  req.organizationContext === undefined ? { sql: "", params: [] } : organizationWhere(column, req);

async function clinicInScope(req, id) {
  const [rows] = await db.query("SELECT organization_id FROM clinics WHERE id = ?", [id]);
  if (!rows.length) return { status: 404, message: "Clinic not found" };
  if (req.organizationContext === undefined || req.organizationContext === "all") return null;
  const allowed = Number(rows[0].organization_id) === Number(req.organizationContext);
  return allowed ? null : { status: 403, message: "คุณไม่มีสิทธิ์เข้าถึงคลินิกของหน่วยงานนี้" };
}

async function organizationForNewClinic(req, requestedOrganizationId) {
  const requestedId = Number(requestedOrganizationId);
  const organizationId = req.authorization?.isSystemAdmin && Number.isInteger(requestedId) && requestedId > 0
    ? requestedId
    : req.organizationContext;
  if (!Number.isInteger(organizationId)) return null;
  const [rows] = await db.query("SELECT id FROM organizations WHERE id = ? AND status = 'active'", [organizationId]);
  return rows.length ? organizationId : null;
}

// ✅ PATCH ต้องอยู่บนสุด ก่อน /:idOrSlug
router.patch("/reorder", verifyToken, async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: "order array is required" });
    }
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of order) {
        const denied = await clinicInScope(req, item.id);
        if (denied) { const error = new Error(denied.message); error.status = denied.status; throw error; }
        await conn.query("UPDATE clinics SET sort_order = ? WHERE id = ?", [
          item.sort_order,
          item.id,
        ]);
      }
      await conn.commit();
      res.json({ message: "Reordered successfully" });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error reordering clinics:", error);
    res.status(error.status || 500).json({ error: error.status ? error.message : "Failed to reorder clinics" });
  }
});

router.patch("/:id/toggle-help-center", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { show_in_help_center } = req.body;

  try {
    const denied = await clinicInScope(req, id);
    if (denied) return res.status(denied.status).json({ success: false, error: denied.message });
    const query = `UPDATE clinics SET show_in_help_center = ? WHERE id = ?`;
    const [result] = await db.query(query, [show_in_help_center, id]);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, error: "ไม่พบคลินิกที่ระบุ" });
    }

    res.json({
      success: true,
      message:
        show_in_help_center === 1
          ? "เปิดการแสดงผลบนหน้าช่วยเหลือเรียบร้อยแล้ว"
          : "ซ่อนการแสดงผลบนหน้าช่วยเหลือเรียบร้อยแล้ว",
    });
  } catch (error) {
    console.error("Error toggling help center:", error);
    res.status(500).json({
      success: false,
      error: "เกิดข้อผิดพลาดบนเซิร์ฟเวอร์: " + error.message,
    });
  }
});

// ✅ ORDER BY sort_order แล้ว
router.get("/", async (req, res) => {
  try {
    const scope = scopedWhere(req, "c.organization_id");
    const [rows] = await db.query(
      `SELECT c.*, o.name AS organization_name, o.code AS organization_code FROM clinics c LEFT JOIN organizations o ON o.id = c.organization_id WHERE c.is_active = 1${scope.sql} ORDER BY c.sort_order ASC, c.id ASC`, scope.params,
    );
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching clinics:", error);
    res.status(500).json({ error: "Failed to fetch clinics" });
  }
});

// ✅ ORDER BY sort_order แล้ว
router.get("/all", verifyToken, async (req, res) => {
  try {
    const scope = scopedWhere(req, "c.organization_id");
    const [rows] = await db.query(
      `SELECT c.*, o.name AS organization_name, o.code AS organization_code FROM clinics c LEFT JOIN organizations o ON o.id = c.organization_id WHERE 1=1${scope.sql} ORDER BY c.sort_order ASC, c.id ASC`, scope.params,
    );
    res.json({ data: rows });
  } catch (error) {
    console.error("Error fetching all clinics:", error);
    res.status(500).json({ error: "Failed to fetch all clinics" });
  }
});

// ต้องอยู่หลัง /reorder และ /all เสมอ
router.get("/:idOrSlug", async (req, res) => {
  try {
    const param = req.params.idOrSlug;
    const scope = scopedWhere(req, "c.organization_id");
    const sql = `SELECT c.*, o.name AS organization_name, o.code AS organization_code FROM clinics c LEFT JOIN organizations o ON o.id = c.organization_id WHERE c.${!isNaN(param) ? "id" : "slug"} = ?${scope.sql}`;
    const [rows] = await db.query(sql, [param, ...scope.params]);
    if (rows.length === 0)
      return res.status(404).json({ error: "Clinic not found" });
    res.json({ data: rows[0] });
  } catch (error) {
    console.error("Error fetching clinic:", error);
    res.status(500).json({ error: "Failed to fetch clinic" });
  }
});

// ✅ INSERT ใส่ sort_order ด้วย
router.post("/", verifyToken, async (req, res) => {
  try {
    const organizationId = await organizationForNewClinic(req, req.body.organization_id);
    if (!organizationId) return res.status(422).json({ error: "กรุณาเลือกหน่วยงานที่เปิดใช้งานก่อนเพิ่มคลินิก" });
    const {
      slug,
      name,
      name_en,
      description,
      image,
      bg,
      is_active,
      show_icon,
    } = req.body;
    if (!slug || !name)
      return res.status(400).json({ error: "Slug and name are required" });

    const [[{ count }]] = await db.query(
      "SELECT COUNT(*) as count FROM clinics",
    );

    const [result] = await db.query(
      "INSERT INTO clinics (slug, name, name_en, description, image, bg, is_active, show_icon, sort_order, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        slug,
        name,
        name_en || null,
        description || null,
        image || null,
        bg || null,
        is_active ?? 1,
        show_icon ?? 1,
        count,
        organizationId,
      ],
    );
    res.status(201).json({ message: "Clinic created", id: result.insertId });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res.status(400).json({ error: "Slug already exists" });
    console.error("Error creating clinic:", error);
    res.status(500).json({ error: "Failed to create clinic" });
  }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const denied = await clinicInScope(req, id);
    if (denied) return res.status(denied.status).json({ error: denied.message });
    let organizationId = null;
    if (req.authorization?.isSystemAdmin && String(req.body.organization_id || "").trim()) {
      organizationId = await organizationForNewClinic(req, req.body.organization_id);
      if (!organizationId) return res.status(422).json({ error: "หน่วยงานที่เลือกไม่พร้อมใช้งาน" });
    }
    const {
      slug,
      name,
      name_en,
      description,
      image,
      bg,
      is_active,
      show_icon,
    } = req.body;
    if (!slug || !name)
      return res.status(400).json({ error: "Slug and name are required" });

    const [result] = await db.query(
      "UPDATE clinics SET slug=?, name=?, name_en=?, description=?, image=?, bg=?, is_active=?, show_icon=?, organization_id=COALESCE(?, organization_id) WHERE id=?",
      [
        slug,
        name,
        name_en || null,
        description || null,
        image || null,
        bg || null,
        is_active,
        show_icon ?? 1,
        organizationId,
        id,
      ],
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Clinic not found" });
    res.json({ message: "Clinic updated successfully" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res.status(400).json({ error: "Slug already exists" });
    console.error("Error updating clinic:", error);
    res.status(500).json({ error: "Failed to update clinic" });
  }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const denied = await clinicInScope(req, id);
    if (denied) return res.status(denied.status).json({ error: denied.message });
    const [result] = await db.query("DELETE FROM clinics WHERE id = ?", [id]);
    if (result.affectedRows === 0)
      return res.status(404).json({ error: "Clinic not found" });
    res.json({ message: "Clinic deleted successfully" });
  } catch (error) {
    console.error("Error deleting clinic:", error);
    res.status(500).json({ error: "Failed to delete clinic" });
  }
});

module.exports = router;
