const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { loadAuthorization, permissionsForRole, audit } = require("../authorization/authorization");

const router = express.Router();
const createOrganizationCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `ORG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const [rows] = await db.query("SELECT 1 FROM organizations WHERE code=? LIMIT 1", [code]);
    if (!rows.length) return code;
  }
  throw new Error("ไม่สามารถสร้างรหัสหน่วยงานได้");
};

async function requireSystemAdmin(req, res, next) {
  const authorization = await loadAuthorization(req.user.id);
  if (!authorization?.isSystemAdmin) return res.status(403).json({ success: false, message: "สงวนสิทธิ์สำหรับ System Admin" });
  req.authorization = authorization;
  return next();
}

router.get("/me/authorization", verifyToken, async (req, res) => {
  try {
    const authorization = await loadAuthorization(req.user.id);
    if (!authorization) return res.status(401).json({ success: false, message: "บัญชีไม่พร้อมใช้งาน" });
    const memberships = await Promise.all(authorization.memberships.filter((m) => m.status === "active" && m.organization_status === "active").map(async (membership) => ({
      id: membership.id,
      organization: { id: membership.organization_id, code: membership.organization_code, name: membership.organization_name },
      role: { id: membership.role_id, name: membership.role_name },
      is_primary: Boolean(membership.is_primary),
      permissions: await permissionsForRole(membership.role_id),
    })));
    let organizations = [];
    if (authorization.isSystemAdmin) {
      const [rows] = await db.query(
        "SELECT id, code, name FROM organizations WHERE status = 'active' ORDER BY name",
      );
      organizations = rows;
    }
    return res.json({ user: authorization.user, is_system_admin: authorization.isSystemAdmin, system_permissions: authorization.isSystemAdmin ? ["organizations.manage", "users.manage", "roles.manage", "global_content.manage", "cross_organization_data.view", "audit.view"] : [], memberships, organizations });
  } catch (error) { return res.status(500).json({ success: false, message: "ไม่สามารถโหลดสิทธิ์ได้" }); }
});

router.use("/organizations", verifyToken, requireSystemAdmin);
router.get("/organizations", async (req, res) => {
  const [rows] = await db.query("SELECT id, code, name, description, status, created_at, updated_at FROM organizations ORDER BY status = 'active' DESC, name");
  res.json(rows);
});
router.post("/organizations", async (req, res) => {
  const { name, description = "" } = req.body || {};
  if (!String(name || "").trim()) return res.status(422).json({ success: false, message: "กรุณาระบุชื่อหน่วยงาน" });
  try {
    const code = await createOrganizationCode();
    const [result] = await db.query("INSERT INTO organizations (code, name, description) VALUES (?, ?, ?)", [String(code).trim(), String(name).trim(), String(description).trim() || null]);
    await audit(req, { action: "organizations.manage", targetType: "organization", targetId: result.insertId, after: { code, name } });
    res.status(201).json({ id: result.insertId, code });
  } catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ success: false, message: error.code === "ER_DUP_ENTRY" ? "รหัสหน่วยงานซ้ำ" : "ไม่สามารถสร้างหน่วยงานได้" }); }
});
router.put("/organizations/:id", async (req, res) => {
  const { name, description, status } = req.body || {};
  if (!Number.isInteger(Number(req.params.id)) || !String(name || "").trim() || !["active", "inactive"].includes(status)) return res.status(422).json({ success: false, message: "ข้อมูลหน่วยงานไม่ถูกต้อง" });
  const [result] = await db.query("UPDATE organizations SET name=?, description=?, status=? WHERE id=?", [String(name).trim(), String(description || "").trim() || null, status, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "ไม่พบหน่วยงาน" });
  await audit(req, { action: "organizations.manage", targetType: "organization", targetId: req.params.id, after: { name, status } });
  res.json({ success: true });
});
router.get("/organizations/:id/members", async (req, res) => {
  const [rows] = await db.query(`SELECT om.id, om.user_id, om.role_id, om.status, om.is_primary, u.username, u.email, r.name role_name
    FROM organization_memberships om JOIN users u ON u.id=om.user_id JOIN roles r ON r.id=om.role_id WHERE om.organization_id=? ORDER BY u.username`, [req.params.id]);
  res.json(rows);
});
router.post("/organizations/:id/members", async (req, res) => {
  const { user_id, role_id, is_primary = false } = req.body || {};
  if (![user_id, role_id, req.params.id].every((v) => Number.isInteger(Number(v)))) return res.status(422).json({ success: false, message: "ข้อมูลสมาชิกไม่ถูกต้อง" });
  try {
    await db.query("INSERT INTO organization_memberships (user_id, organization_id, role_id, is_primary) VALUES (?, ?, ?, ?)", [user_id, req.params.id, role_id, Boolean(is_primary)]);
    if (is_primary) await db.query("UPDATE organization_memberships SET is_primary=0 WHERE user_id=? AND organization_id<>?", [user_id, req.params.id]);
    await audit(req, { action: "organizations.manage", targetType: "membership", targetId: `${user_id}:${req.params.id}`, after: { role_id, is_primary } });
    res.status(201).json({ success: true });
  } catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ success: false, message: error.code === "ER_DUP_ENTRY" ? "ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว" : "ไม่สามารถเพิ่มสมาชิกได้" }); }
});
router.put("/organizations/:id/members/:membershipId", async (req, res) => {
  const { role_id, status, is_primary = false } = req.body || {};
  if (!Number.isInteger(Number(role_id)) || !["active", "inactive"].includes(status)) return res.status(422).json({ success: false, message: "ข้อมูลสมาชิกไม่ถูกต้อง" });
  const [result] = await db.query("UPDATE organization_memberships SET role_id=?, status=?, is_primary=? WHERE id=? AND organization_id=?", [role_id, status, Boolean(is_primary), req.params.membershipId, req.params.id]);
  if (!result.affectedRows) return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
  await audit(req, { action: "organizations.manage", targetType: "membership", targetId: req.params.membershipId, after: { role_id, status, is_primary } });
  res.json({ success: true });
});

module.exports = router;
