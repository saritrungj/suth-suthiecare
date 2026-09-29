const express = require("express");
const crypto = require("crypto");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { audit, permissionsForRole } = require("../authorization/authorization");
const { isAgencyOnlyRole, canAgencyAction } = require("../agency/permissions");
const router = express.Router();
const { CHECKUP_FIELDS, readAgencySchema, validateCheckupRange } = require("../agency/checkupSchema");

const supported = new Set(["text", "textarea", "number", "date", "select", "multiselect", "email", "phone"]);
const sourceId = (value) => String(value || "").trim().slice(0, 128);
const createAgencyCode = () => `AGY-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
async function resolveAgency(req, res, next) {
  let id = Number(req.get("X-Agency-Id"));
  // The client normally persists this choice in X-Agency-Id.  Default safely
  // on the server too so a fresh browser session does not fail with 422 before
  // the sidebar context has had a chance to initialize.
  if (!Number.isInteger(id) || id < 1) {
    if (req.authorizationProfile?.isSystemAdmin) {
      const [rows] = await db.query("SELECT id FROM agencies WHERE status='active' ORDER BY name LIMIT 1");
      id = Number(rows[0]?.id);
    } else {
      const membership = (req.authorizationProfile?.agencyMemberships || []).find(
        (item) => item.status === "active" && item.agency_status === "active",
      );
      id = Number(membership?.agency_id);
    }
  }
  if (!Number.isInteger(id) || id < 1) return res.status(422).json({ message: "ยังไม่มี Agency ที่พร้อมใช้งาน กรุณาให้ผู้ดูแลระบบสร้างหรือเลือก Agency ก่อน" });
  const [agencies] = await db.query("SELECT id, name FROM agencies WHERE id=? AND status='active'", [id]);
  if (!agencies[0]) return res.status(404).json({ message: "ไม่พบ Agency" });
  if (!req.authorizationProfile?.isSystemAdmin) {
    const membership = (req.authorizationProfile?.agencyMemberships || []).find((item) => Number(item.agency_id) === id && item.status === "active" && item.agency_status === "active");
    if (!membership) return res.status(403).json({ message: "คุณไม่มีสิทธิ์ใช้ Agency นี้" });
    req.agencyMembership = membership;
  }
  req.agency = agencies[0]; return next();
}
const allow = (type) => async (req, res, next) => {
  if (req.authorizationProfile?.isSystemAdmin) return next();
  const permissions = await permissionsForRole(req.authorizationProfile?.user?.role_id);
  if (canAgencyAction(permissions, type)) return next();
  return res.status(403).json({ message: "คุณไม่มีสิทธิ์ดำเนินการนี้" });
};
const guard = [verifyToken, resolveAgency];
const systemAdmin = (req, res, next) => req.authorizationProfile?.isSystemAdmin ? next() : res.status(403).json({ message: "สงวนสิทธิ์สำหรับ System Admin" });
function fields(master) {
  const list = readAgencySchema(master.field_schema).fields;
  return list.filter((item) => item && typeof item.id === "string" && supported.has(item.type)).map((item) => ({ id: item.id.slice(0, 64), label: String(item.label || item.id).replace(/<[^>]*>/g, "").trim(), type: item.type, required: Boolean(item.required), options: Array.isArray(item.options) ? item.options.map(String) : [] }));
}
function validate(schema, data) {
  const errors = {}; if (!data || typeof data !== "object" || Array.isArray(data)) return { data: "Invalid data" };
  Object.assign(errors, validateCheckupRange(schema, data));
  schema.forEach((field) => { const value = data[field.id]; const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && !value.length); if (field.required && empty) { errors[field.id] = "Required"; return; } if (empty) return; if (field.type === "number" && !Number.isFinite(Number(value))) errors[field.id] = "Invalid number"; if (field.type === "date" && Number.isNaN(Date.parse(value))) errors[field.id] = "Invalid date"; if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors[field.id] = "Invalid email"; if (field.type === "phone" && String(value).replace(/\D/g, "").length < 8) errors[field.id] = "Invalid phone"; if (field.type === "select" && !field.options.includes(String(value))) errors[field.id] = "Invalid option"; if (field.type === "multiselect" && (!Array.isArray(value) || value.some((item) => !field.options.includes(String(item))))) errors[field.id] = "Invalid selection"; }); return errors;
}
async function master(req, id) { const [rows] = await db.query("SELECT * FROM agency_masters WHERE id=? AND agency_id=? AND status='active'", [id, req.agency.id]); return rows[0] || null; }
async function save({ connection, agencyId, masterId, recordSourceId, data, userId, method, replacesRevisionId }) {
  const [found] = await connection.query("SELECT id FROM agency_entry_records_v2 WHERE agency_id=? AND master_id=? AND source_record_id=? FOR UPDATE", [agencyId, masterId, recordSourceId]); let recordId = found[0]?.id;
  if (!recordId) { const [created] = await connection.query("INSERT INTO agency_entry_records_v2 (agency_id, master_id, source_record_id) VALUES (?, ?, ?)", [agencyId, masterId, recordSourceId]); recordId = created.insertId; }
  const [current] = await connection.query("SELECT id, verification_status FROM agency_entry_revisions_v2 WHERE record_id=? AND superseded_at IS NULL FOR UPDATE", [recordId]);
  if (current[0] && (Number(current[0].id) !== Number(replacesRevisionId) || current[0].verification_status !== "rejected")) throw Object.assign(new Error("Duplicate source record ID"), { status: 409 });
  if (current[0]) await connection.query("UPDATE agency_entry_revisions_v2 SET superseded_at=NOW() WHERE id=?", [current[0].id]);
  const [revision] = await connection.query("INSERT INTO agency_entry_revisions_v2 (record_id, entered_by_user_id, entry_method, data, replaces_revision_id) VALUES (?, ?, ?, ?, ?)", [recordId, userId, method, JSON.stringify(data), replacesRevisionId || null]); return { recordId, revisionId: revision.insertId };
}

// Agency administration is intentionally separate from Organization Management.
router.get("/admin/agencies", verifyToken, systemAdmin, async (req, res) => {
  const [rows] = await db.query("SELECT id, code, name, status, created_at FROM agencies ORDER BY name");
  res.json(rows);
});
router.post("/admin/agencies", verifyToken, systemAdmin, async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 255);
  if (!name) return res.status(422).json({ message: "กรุณาระบุชื่อ Agency" });
  // Codes are server-owned identifiers, not user input. A UUID-derived value
  // makes creation safe even when multiple administrators create Agencies at once.
  const code = createAgencyCode();
  try { const [result] = await db.query("INSERT INTO agencies (code, name) VALUES (?, ?)", [code, name]); await audit(req, { action: "agency.admin.create", targetType: "agency", targetId: result.insertId, after: { code, name } }); return res.status(201).json({ id: result.insertId, code }); } catch (error) { return res.status(500).json({ message: "ไม่สามารถสร้าง Agency" }); }
});
router.get("/admin/agencies/:id/masters", verifyToken, systemAdmin, async (req, res) => { const [rows] = await db.query("SELECT id, code, name, field_schema, status, updated_at FROM agency_masters WHERE agency_id=? ORDER BY name", [req.params.id]); res.json(rows); });
router.post("/admin/agencies/:id/masters", verifyToken, systemAdmin, async (req, res) => {
  const formType = req.body?.form_type || "custom";
  if (!["custom", "health_checkup"].includes(formType)) return res.status(422).json({ message: "ประเภทแบบฟอร์มไม่ถูกต้อง" });
  const agencyId = Number(req.params.id), code = formType === "health_checkup" ? `CHK-${crypto.randomUUID().slice(0, 8).toUpperCase()}` : String(req.body?.code || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 64), name = String(req.body?.name || "").trim().slice(0, 255), schema = formType === "health_checkup" ? CHECKUP_FIELDS : req.body?.field_schema;
  if (!Number.isInteger(agencyId) || !code || !name || !Array.isArray(schema) || !schema.length) return res.status(422).json({ message: "ข้อมูล Master data ไม่ถูกต้อง" });
  const normalized = schema.map((item) => ({ id: String(item?.id || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64), label: String(item?.label || "").trim().slice(0, 255), type: String(item?.type || ""), required: Boolean(item?.required), options: Array.isArray(item?.options) ? item.options.map((option) => String(option).slice(0, 255)) : [] }));
  if (normalized.some((item) => !item.id || !item.label || !supported.has(item.type)) || new Set(normalized.map((item) => item.id)).size !== normalized.length) return res.status(422).json({ message: "Schema ของ Master data ไม่ถูกต้อง" });
  try { const [result] = await db.query("INSERT INTO agency_masters (agency_id, code, name, field_schema) VALUES (?, ?, ?, ?)", [agencyId, code, name, JSON.stringify({ form_type: formType, fields: normalized })]); await audit(req, { action: "agency.master.create", targetType: "agency_master", targetId: result.insertId, after: { agency_id: agencyId, code, name, form_type: formType } }); return res.status(201).json({ id: result.insertId, form_type: formType }); } catch (error) { return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ message: error.code === "ER_DUP_ENTRY" ? "รหัสแบบฟอร์มซ้ำ" : "ไม่สามารถสร้างแบบฟอร์ม" }); }
});
router.put("/admin/agencies/:agencyId/masters/:masterId", verifyToken, systemAdmin, async (req, res) => {
  const agencyId = Number(req.params.agencyId), masterId = Number(req.params.masterId), name = String(req.body?.name || "").trim().slice(0, 255), schema = req.body?.field_schema;
  if (!Number.isInteger(agencyId) || !Number.isInteger(masterId) || !name || !Array.isArray(schema) || !schema.length) return res.status(422).json({ message: "ข้อมูลแบบฟอร์มตรวจสุขภาพไม่ถูกต้อง" });
  const [masters] = await db.query("SELECT id, field_schema FROM agency_masters WHERE id=? AND agency_id=?", [masterId, agencyId]);
  if (!masters[0]) return res.status(404).json({ message: "ไม่พบแบบฟอร์มของ Agency นี้" });
  if (readAgencySchema(masters[0].field_schema).form_type !== "health_checkup") return res.status(422).json({ message: "จัดการฟิลด์ได้เฉพาะแบบฟอร์มตรวจสุขภาพ" });
  const normalized = schema.map((item) => ({ id: String(item?.id || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64), label: String(item?.label || "").trim().slice(0, 255), type: String(item?.type || ""), required: Boolean(item?.required), options: Array.isArray(item?.options) ? item.options.map((option) => String(option).trim().slice(0, 255)).filter(Boolean) : [] }));
  if (normalized.some((item) => !item.id || !item.label || !supported.has(item.type)) || new Set(normalized.map((item) => item.id)).size !== normalized.length) return res.status(422).json({ message: "รายการฟิลด์ไม่ถูกต้องหรือมีรหัสซ้ำ" });
  await db.query("UPDATE agency_masters SET name=?, field_schema=? WHERE id=? AND agency_id=?", [name, JSON.stringify({ form_type: "health_checkup", fields: normalized }), masterId, agencyId]);
  await audit(req, { action: "agency.master.update", targetType: "agency_master", targetId: masterId, after: { agency_id: agencyId, name, form_type: "health_checkup", field_count: normalized.length } });
  return res.json({ success: true, fields: normalized });
});
router.post("/admin/agencies/:id/members", verifyToken, systemAdmin, async (req, res) => {
  const agencyId = Number(req.params.id), userId = Number(req.body?.user_id);
  if (!Number.isInteger(agencyId) || !Number.isInteger(userId)) return res.status(422).json({ message: "ข้อมูลสมาชิกไม่ถูกต้อง" });
  const [accounts] = await db.query("SELECT role_id, status FROM users WHERE id=?", [userId]);
  if (!accounts[0] || accounts[0].status !== "active" || Number(accounts[0].role_id) === 1) return res.status(422).json({ message: "กรุณาเลือกบัญชีเจ้าหน้าที่ Agency ที่ใช้งานได้" });
  if (!isAgencyOnlyRole(await permissionsForRole(accounts[0].role_id))) return res.status(422).json({ message: "กำหนดบทบาทบัญชีนี้ให้มีเฉพาะสิทธิ์ Agency จากหน้าบทบาทและสิทธิ์ก่อน" });
  // Legacy membership.role is retained for schema compatibility only.
  // Authorization now reads the account's role_permissions on every request.
  const role = "encoder";
  const [orgRoles] = await db.query("SELECT 1 FROM organization_memberships WHERE user_id=? AND status='active' LIMIT 1", [userId]);
  const [systemRoles] = await db.query("SELECT 1 FROM user_system_roles WHERE user_id=? LIMIT 1", [userId]);
  if (orgRoles.length || systemRoles.length) return res.status(409).json({ message: "บัญชี Agency ต้องไม่เป็นสมาชิกหรือผู้ดูแลระบบหลัก" });
  try { await db.query("INSERT INTO agency_memberships (agency_id, user_id, role) VALUES (?, ?, ?)", [agencyId, userId, role]); return res.status(201).json({ success: true }); } catch (error) { return res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ message: error.code === "ER_DUP_ENTRY" ? "ผู้ใช้นี้เป็นสมาชิก Agency อยู่แล้ว" : "ไม่สามารถเพิ่มสมาชิก" }); }
});

router.get("/masters", ...guard, allow("schema"), async (req, res) => { const [rows] = await db.query("SELECT id, code, name, updated_at FROM agency_masters WHERE agency_id=? AND status='active' ORDER BY name", [req.agency.id]); res.json(rows); });
router.get("/masters/:id", ...guard, allow("schema"), async (req, res) => { const item = await master(req, Number(req.params.id)); if (!item) return res.status(404).json({ message: "ไม่พบ Master data" }); return res.json({ id: item.id, code: item.code, name: item.name, form_type: readAgencySchema(item.field_schema).form_type, schema_version: new Date(item.updated_at).toISOString(), fields: fields(item) }); });
router.post("/validate", ...guard, allow("create"), async (req, res) => { const item = await master(req, Number(req.body?.master_id)); const rows = req.body?.rows; if (!item || !Array.isArray(rows) || rows.length > 1000) return res.status(422).json({ message: "ข้อมูลนำเข้าไม่ถูกต้อง" }); const shape = fields(item); res.json({ rows: rows.map((row, index) => ({ row: index + 1, source_record_id: sourceId(row.source_record_id), errors: { ...(sourceId(row.source_record_id) ? {} : { source_record_id: "Required" }), ...validate(shape, row.data) } })) }); });
router.post("/records", ...guard, allow("create"), async (req, res) => { const item = await master(req, Number(req.body?.master_id)); if (!item) return res.status(404).json({ message: "ไม่พบ Master data" }); const errors = validate(fields(item), req.body?.data); if (Object.keys(errors).length) return res.status(422).json({ message: "กรุณาแก้ไขข้อมูล", errors }); const connection = await db.getConnection(); try { await connection.beginTransaction(); const result = await save({ connection, agencyId: req.agency.id, masterId: item.id, recordSourceId: sourceId(req.body.source_record_id) || `MANUAL-${crypto.randomUUID()}`, data: req.body.data, userId: req.user.id, method: "single", replacesRevisionId: req.body.replaces_revision_id }); await connection.commit(); await audit(req, { action: "agency.record.create", targetType: "agency_record", targetId: result.recordId, after: { agency_id: req.agency.id, master_id: item.id } }); return res.status(201).json(result); } catch (error) { await connection.rollback(); return res.status(error.status || 500).json({ message: error.message || "ไม่สามารถบันทึกข้อมูลได้" }); } finally { connection.release(); } });
router.post("/imports", ...guard, allow("create"), async (req, res) => { const item = await master(req, Number(req.body?.master_id)); const rows = req.body?.rows; if (!item || !Array.isArray(rows) || !rows.length || rows.length > 1000) return res.status(422).json({ message: "ข้อมูลนำเข้าไม่ถูกต้อง" }); const shape = fields(item), results = []; for (let i = 0; i < rows.length; i += 1) { const row = rows[i] || {}, id = sourceId(row.source_record_id), errors = { ...(id ? {} : { source_record_id: "Required" }), ...validate(shape, row.data) }; if (Object.keys(errors).length) { results.push({ row: i + 1, source_record_id: id, errors }); continue; } const connection = await db.getConnection(); try { await connection.beginTransaction(); const result = await save({ connection, agencyId: req.agency.id, masterId: item.id, recordSourceId: id, data: row.data, userId: req.user.id, method: "import" }); await connection.commit(); results.push({ row: i + 1, source_record_id: id, record_id: result.recordId, errors: {} }); } catch (error) { await connection.rollback(); results.push({ row: i + 1, source_record_id: id, errors: { import: error.status === 409 ? "Duplicate source record ID" : "Unable to save row" } }); } finally { connection.release(); } } const accepted = results.filter((row) => !Object.keys(row.errors).length).length; res.status(201).json({ accepted, rejected: rows.length - accepted, rows: results }); });
router.get("/records", ...guard, allow("view"), async (req, res) => { const [rows] = await db.query("SELECT r.id, r.source_record_id, m.id master_id, m.name master_name, v.id revision_id, v.verification_status, v.created_at, u.username entered_by FROM agency_entry_records_v2 r JOIN agency_entry_revisions_v2 v ON v.record_id=r.id AND v.superseded_at IS NULL JOIN agency_masters m ON m.id=r.master_id JOIN users u ON u.id=v.entered_by_user_id WHERE r.agency_id=? ORDER BY v.created_at DESC LIMIT 100", [req.agency.id]); res.json(rows); });
router.get("/records/:id", ...guard, allow("view"), async (req, res) => { const [rows] = await db.query("SELECT r.id, r.master_id, r.source_record_id, m.name master_name, m.field_schema, v.* FROM agency_entry_records_v2 r JOIN agency_entry_revisions_v2 v ON v.record_id=r.id JOIN agency_masters m ON m.id=r.master_id WHERE r.id=? AND r.agency_id=? ORDER BY v.created_at DESC", [req.params.id, req.agency.id]); if (!rows.length) return res.status(404).json({ message: "ไม่พบรายการ" }); const { field_schema, ...record } = rows[0]; res.json({ ...record, fields: fields({ field_schema }), revisions: rows.map(({ field_schema: ignored, ...row }) => ({ ...row, data: typeof row.data === "string" ? JSON.parse(row.data) : row.data })) }); });
router.post("/records/:id/review", ...guard, allow("verify"), async (req, res) => { const decision = req.body?.decision, note = String(req.body?.note || "").trim(); if (!["verified", "rejected"].includes(decision) || (decision === "rejected" && !note)) return res.status(422).json({ message: "ผลการตรวจสอบไม่ถูกต้อง" }); const [result] = await db.query("UPDATE agency_entry_revisions_v2 v JOIN agency_entry_records_v2 r ON r.id=v.record_id SET v.verification_status=?, v.reviewed_by_user_id=?, v.reviewed_at=NOW(), v.review_note=? WHERE r.id=? AND r.agency_id=? AND v.superseded_at IS NULL AND v.verification_status='pending' AND v.entered_by_user_id<>?", [decision, req.user.id, note || null, req.params.id, req.agency.id, req.user.id]); if (!result.affectedRows) return res.status(409).json({ message: "ไม่สามารถตรวจสอบรายการนี้ได้" }); await audit(req, { action: `agency.record.${decision}`, targetType: "agency_record", targetId: req.params.id, after: { agency_id: req.agency.id } }); res.json({ success: true }); });
module.exports = router;
