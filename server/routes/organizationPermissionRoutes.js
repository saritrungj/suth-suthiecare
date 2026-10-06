const express = require("express");
const db = require("../config/db");
const {
  verifyToken,
  verifySuperAdmin,
} = require("../middleware/authMiddleware");
const keys = new Set(require("../authorization/permissionKeys"));
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
    "SELECT id FROM organizations WHERE id=? AND org_level='unit'" +
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
}
const fail = (res, error) =>
  res
    .status(error.status || 503)
    .json({ code: error.code || "ORGANIZATION_PERMISSIONS_UNAVAILABLE" });
const endpoint = "/organizations/:id/roles/:roleId/permissions";
router.get(endpoint, verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    await target(db, req.params.id, req.params.roleId);
    const [sets] = await db.query(
      "SELECT version,source FROM organization_role_permission_sets WHERE organization_id=? AND role_id=?",
      [req.params.id, req.params.roleId],
    );
    res.json({
      permissions: await organizationRolePermissions(
        db,
        req.params.id,
        req.params.roleId,
      ),
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
    await target(connection, req.params.id, req.params.roleId, true);
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
