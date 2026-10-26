const express = require("express");
const db = require("../config/db");
const {
  verifyToken,
  verifySuperAdmin,
} = require("../middleware/authMiddleware");
const keys = new Set(require("../authorization/permissionKeys"));
const {
  keysForOrganizationType,
} = require("../authorization/permissionMatrix");
const allowedKeysFor = (organization) =>
  keysForOrganizationType(organization?.org_type);
const {
  organizationRolePermissions,
} = require("../authorization/organizationPermissions");
const { requiredAudit } = require("../utils/pdpaAudit");
const router = express.Router();
const positive = (value) =>
  /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;
async function target(connection, organizationId, roleId, lock = false) {
  if (!positive(organizationId) || !positive(roleId))
    throw Object.assign(new Error(), {
      status: 422,
      code: "INVALID_ORGANIZATION_ROLE",
    });
  const [units] = await connection.query(
    "SELECT id,org_type FROM organizations WHERE id=? AND org_level='unit'" +
      (lock ? " FOR UPDATE" : ""),
    [organizationId],
  );
  const [roles] = await connection.query(
    "SELECT id FROM roles WHERE id=?" + (lock ? " FOR UPDATE" : ""),
    [roleId],
  );
  if (!units.length || !roles.length)
    throw Object.assign(new Error(), {
      status: 404,
      code: "ORGANIZATION_ROLE_NOT_FOUND",
    });
  return units[0];
}
const fail = (res, error) =>
  res
    .status(error.status || 503)
    .json({ code: error.code || "ORGANIZATION_PERMISSIONS_UNAVAILABLE" });
const endpoint = "/organizations/:id/roles/:roleId/permissions";
async function unit(connection, id) {
  if (!positive(id))
    throw Object.assign(new Error(), {
      status: 422,
      code: "INVALID_ORGANIZATION",
    });
  const [rows] = await connection.query(
    "SELECT id,org_type FROM organizations WHERE id=? AND org_level='unit'",
    [id],
  );
  if (!rows.length)
    throw Object.assign(new Error(), {
      status: 404,
      code: "ORGANIZATION_NOT_FOUND",
    });
  return rows[0];
}
router.get(
  "/organizations/:id/roles",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    try {
      await unit(db, req.params.id);
      const [rows] = await db.query(
        `SELECT r.id,r.name,r.description FROM roles r WHERE r.id<>1
      AND r.name NOT IN ('SuperAdmin','school_guardian','school_import_staff','มีแม่แบบแต่ไม่มีสิทธิ์หน่วยงาน','demo_school_template_only')
      AND (EXISTS (SELECT 1 FROM organization_role_permission_sets s WHERE s.role_id=r.id AND s.organization_id=?)
        OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.role_id=r.id AND m.organization_id=?)
        OR EXISTS (SELECT 1 FROM organization_role_permissions p WHERE p.role_id=r.id AND p.organization_id=?)) ORDER BY r.name,r.id`,
        [req.params.id, req.params.id, req.params.id],
      );
      res.json(
        rows.map((role) => ({
          ...role,
          name:
            role.name === "Admin"
              ? "ผู้ดูแลหน่วยงาน"
              : role.name === "Staff"
                ? "เจ้าหน้าที่"
                : role.name,
        })),
      );
    } catch (error) {
      fail(res, error);
    }
  },
);
router.post(
  "/organizations/:id/roles",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    const { normaliseText } = require("../utils/userValidation");
    const name = normaliseText(req.body?.name),
      description = normaliseText(req.body?.description);
    const { ROLE_PRESETS } = require("../authorization/rolePresets");
    const preset = req.body?.preset || null;
    if (preset !== null && !Object.hasOwn(ROLE_PRESETS, preset))
      return res.status(422).json({ message: "ชุดสิทธิ์ตั้งต้นไม่ถูกต้อง" });
    if (
      name.length < 2 ||
      name.length > 100 ||
      description.length > 255 ||
      ["SuperAdmin", "school_guardian", "school_import_staff"].includes(name)
    )
      return res.status(422).json({
        message:
          "ชื่อบทบาทต้องยาว 2–100 ตัวอักษร และคำอธิบายไม่เกิน 255 ตัวอักษร",
      });
    let c;
    try {
      c = await db.getConnection();
      await c.beginTransaction();
      const organization = await unit(c, req.params.id);
      const [[existing]] = await c.query(
        "SELECT id,name FROM roles WHERE name=? FOR UPDATE",
        [name],
      );
      let roleId = existing?.id;
      if (!roleId) {
        const [insert] = await c.query(
          "INSERT INTO roles (name,description) VALUES (?,?)",
          [name, description],
        );
        roleId = insert.insertId;
      }
      if (Number(roleId) === 1)
        throw Object.assign(new Error(), {
          status: 422,
          code: "SYSTEM_ROLE_IS_SEPARATE",
        });
      const [[configured]] = await c.query(
        "SELECT version FROM organization_role_permission_sets WHERE organization_id=? AND role_id=? FOR UPDATE",
        [req.params.id, roleId],
      );
      if (configured)
        throw Object.assign(new Error(), {
          status: 409,
          code: "ORGANIZATION_ROLE_EXISTS",
        });
      await c.query(
        'INSERT INTO organization_role_permission_sets (organization_id,role_id,source,version,updated_by) VALUES (?,? ,"explicit",1,?)',
        [req.params.id, roleId, req.user.id],
      );
      const { PRESET_TYPES } = require("../authorization/rolePresets");
      if (
        preset &&
        PRESET_TYPES[preset] &&
        PRESET_TYPES[preset] !==
          (organization.org_type === "school" ? "school" : "hospital")
      )
        throw Object.assign(new Error(), {
          status: 422,
          code: "PRESET_TYPE_MISMATCH",
        });
      const offered = keysForOrganizationType(organization.org_type);
      const presetKeys = preset
        ? ROLE_PRESETS[preset].filter((key) => offered.has(key))
        : [];
      if (presetKeys.length)
        await c.query(
          "INSERT IGNORE INTO organization_role_permissions (organization_id,role_id,permission_key) VALUES ?",
          [presetKeys.map((key) => [req.params.id, roleId, key])],
        );
      req.organizationContext = Number(req.params.id);
      await requiredAudit(
        req,
        "permissions.unit_role.create",
        "role",
        roleId,
        preset ? { preset, permissions: presetKeys } : {},
        c,
      );
      await c.commit();
      res.status(201).json({ id: roleId, name, description });
    } catch (error) {
      if (c) await c.rollback();
      fail(res, error);
    } finally {
      c?.release();
    }
  },
);
router.delete(
  "/organizations/:id/roles/:roleId",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    let c;
    try {
      if (Number(req.params.roleId) === 1)
        throw Object.assign(new Error(), {
          status: 422,
          code: "SYSTEM_ROLE_IS_SEPARATE",
        });
      c = await db.getConnection();
      await c.beginTransaction();
      await target(c, req.params.id, req.params.roleId, true);
      const [members] = await c.query(
        "SELECT id FROM organization_memberships WHERE organization_id=? AND role_id=? LIMIT 1 FOR UPDATE",
        [req.params.id, req.params.roleId],
      );
      if (members.length)
        throw Object.assign(new Error(), {
          status: 409,
          code: "ORGANIZATION_ROLE_IN_USE",
        });
      await c.query(
        "DELETE FROM organization_role_permissions WHERE organization_id=? AND role_id=?",
        [req.params.id, req.params.roleId],
      );
      const [removed] = await c.query(
        "DELETE FROM organization_role_permission_sets WHERE organization_id=? AND role_id=?",
        [req.params.id, req.params.roleId],
      );
      if (!removed.affectedRows)
        throw Object.assign(new Error(), {
          status: 404,
          code: "ORGANIZATION_ROLE_NOT_FOUND",
        });
      req.organizationContext = Number(req.params.id);
      await requiredAudit(
        req,
        "permissions.unit_role.delete",
        "role",
        req.params.roleId,
        {},
        c,
      );
      await c.commit();
      res.json({ success: true });
    } catch (error) {
      if (c) await c.rollback();
      fail(res, error);
    } finally {
      c?.release();
    }
  },
);
router.get(endpoint, verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const organization = await target(db, req.params.id, req.params.roleId);
    const [sets] = await db.query(
      "SELECT version,source FROM organization_role_permission_sets WHERE organization_id=? AND role_id=?",
      [req.params.id, req.params.roleId],
    );
    res.json({
      permissions: (
        await organizationRolePermissions(db, req.params.id, req.params.roleId)
      ).filter((key) => allowedKeysFor(organization).has(key)),
      version: sets[0]?.version || 0,
      configured: Boolean(sets.length),
    });
  } catch (error) {
    fail(res, error);
  }
});
router.put(endpoint, verifyToken, verifySuperAdmin, async (req, res) => {
  const { permissions, version } = req.body || {};
  if (
    !Array.isArray(permissions) ||
    permissions.length > keys.size ||
    permissions.some((key) => !keys.has(key)) ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    return res.status(422).json({ code: "INVALID_ORGANIZATION_PERMISSIONS" });
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const organization = await target(
      connection,
      req.params.id,
      req.params.roleId,
      true,
    );
    const allowed = allowedKeysFor(organization);
    if (permissions.some((key) => !allowed.has(key)))
      throw Object.assign(new Error(), {
        status: 422,
        code: "PERMISSION_NOT_AVAILABLE_FOR_ORGANIZATION",
      });
    const [sets] = await connection.query(
      "SELECT version FROM organization_role_permission_sets WHERE organization_id=? AND role_id=? FOR UPDATE",
      [req.params.id, req.params.roleId],
    );
    if (Number(sets[0]?.version || 0) !== version)
      throw Object.assign(new Error(), {
        status: 409,
        code: "PERMISSION_VERSION_CONFLICT",
      });
    await connection.query(
      'INSERT INTO organization_role_permission_sets (organization_id,role_id,source,version,updated_by) VALUES (?,?,"explicit",1,?) ON DUPLICATE KEY UPDATE source="explicit",version=version+1,updated_by=VALUES(updated_by),updated_at=NOW()',
      [req.params.id, req.params.roleId, req.user.id],
    );
    await connection.query(
      "DELETE FROM organization_role_permissions WHERE organization_id=? AND role_id=?",
      [req.params.id, req.params.roleId],
    );
    for (const key of new Set(permissions))
      await connection.query(
        "INSERT INTO organization_role_permissions (organization_id,role_id,permission_key) VALUES (?,?,?)",
        [req.params.id, req.params.roleId, key],
      );
    req.organizationContext = Number(req.params.id);
    await requiredAudit(
      req,
      "permissions.unit_role.update",
      "role",
      req.params.roleId,
      { count: new Set(permissions).size, version: version + 1 },
      connection,
    );
    await connection.commit();
    res.json({ success: true, version: version + 1 });
  } catch (error) {
    if (connection) await connection.rollback();
    fail(res, error);
  } finally {
    if (connection) connection.release();
  }
});
module.exports = router;
