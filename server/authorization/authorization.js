const db = require("../config/db");
const { decrypt } = require("../utils/encryption");

// users.name holds AES ciphertext; never hand the raw value to the client.
const displayName = (value) => {
  return (
    require("../utils/privateField").readField(value, "users", "name") || null
  );
};

const SYSTEM_ADMIN_PERMISSIONS = new Set([
  "organizations.manage",
  "users.manage",
  "roles.manage",
  "global_content.manage",
  "cross_organization_data.view",
  "audit.view",
]);

const LEGACY_PERMISSION_KEYS = {
  Dashboard: ["dashboard.view"],
  "Case Management": [
    "cases.view",
    "cases.create",
    "cases.update",
    "cases.delete",
    "cases.assign",
    "cases.export",
  ],
  Appointments: [
    "appointments.view",
    "appointments.create",
    "appointments.update",
    "appointments.delete",
  ],
  "User Management": [
    "patient_members.view",
    "patient_members.update",
    "patient_members.delete",
  ],
  "Form Management": ["forms.view"],
  "Clinic Management": ["clinics.view"],
  "Help Center Management": ["help_center.view"],
  "Content Management": ["content.view"],
};

async function tableExists(name) {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [name]);
  return rows.length > 0;
}

// organizations.org_type and parent_id arrive with the school module
// migrations. Until they are applied every organization is a hospital without
// a parent. A positive answer is cached for good; a negative one is re-checked
// after a minute.
const columnChecks = new Map();
async function organizationColumnExists(column) {
  const known = columnChecks.get(column);
  if (known && (known.exists || Date.now() - known.checkedAt < 60000))
    return known.exists;
  const [rows] = await db.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='organizations' AND COLUMN_NAME=? LIMIT 1",
    [column],
  );
  columnChecks.set(column, { exists: rows.length > 0, checkedAt: Date.now() });
  return rows.length > 0;
}
const hasOrganizationTypeColumn = () => organizationColumnExists("org_type");
const hasOrganizationParentColumn = () => organizationColumnExists("parent_id");
const organizationTypeSql = async (alias) =>
  (await hasOrganizationTypeColumn()) ? `${alias}.org_type` : "'hospital'";
const organizationParentSql = async (alias) =>
  (await hasOrganizationParentColumn()) ? `${alias}.parent_id` : "NULL";
const organizationLevelSql = async (alias) =>
  (await organizationColumnExists("org_level"))
    ? `${alias}.org_level`
    : "'unit'";

async function loadAuthorization(userId) {
  const [users] = await db.query(
    "SELECT id, username, name, status, role_id FROM users WHERE id = ?",
    [userId],
  );
  if (!users.length || users[0].status !== "active") return null;
  const user = { ...users[0], name: displayName(users[0].name) };
  const modern = await tableExists("user_system_roles");
  let isSystemAdmin = false;
  if (modern) {
    const [systemRows] = await db.query(
      "SELECT 1 FROM user_system_roles usr JOIN system_roles sr ON sr.id = usr.system_role_id WHERE usr.user_id = ? AND sr.code = 'system_admin'",
      [userId],
    );
    isSystemAdmin = systemRows.length > 0;
  }
  // Preserve the original super-admin account during an incremental RBAC
  // rollout. Some deployments already have the new tables but have not yet
  // copied that account into user_system_roles. Role 1 was the established
  // super-admin role; no other legacy role receives this bypass.
  if (!isSystemAdmin) {
    const [legacy] = await db.query("SELECT role_id FROM users WHERE id = ?", [
      userId,
    ]);
    isSystemAdmin = Number(legacy[0]?.role_id) === 1;
  }
  let memberships = [];
  if (await tableExists("organization_memberships")) {
    const orgType = await organizationTypeSql("o");
    const parent = await organizationParentSql("o");
    const [rows] = await db.query(
      `SELECT om.id, om.organization_id, om.role_id, om.status, om.is_primary,
              o.code AS organization_code, o.name AS organization_name, o.status AS organization_status,
              ${orgType} AS organization_type,
              ${parent} AS organization_parent_id, p.name AS organization_parent_name,
              ${await organizationLevelSql("o")} AS organization_level,
              r.name AS role_name
         FROM organization_memberships om
         JOIN organizations o ON o.id = om.organization_id
         LEFT JOIN organizations p ON p.id = ${parent}
         JOIN roles r ON r.id = om.role_id
        WHERE om.user_id = ? ORDER BY om.is_primary DESC, o.name`,
      [userId],
    );
    memberships = rows;
  }
  return { user, isSystemAdmin, memberships };
}

function activeOrganization(req) {
  const raw = String(req.get("X-Organization-Id") || "").trim();
  return raw === "all" ? raw : /^\d+$/.test(raw) ? Number(raw) : null;
}

async function resolveContext(req, res, next) {
  try {
    const authorization = await loadAuthorization(req.user.id);
    if (!authorization)
      return res
        .status(401)
        .json({ success: false, message: "บัญชีไม่พร้อมใช้งาน" });
    const context = activeOrganization(req);
    if (!context)
      return res
        .status(422)
        .json({ success: false, message: "กรุณาระบุหน่วยงานที่กำลังใช้งาน" });
    if (authorization.isSystemAdmin) {
      req.authorization = authorization;
      req.organizationContext = context;
      return next();
    }
    if (typeof context !== "number") {
      require("../utils/privacyTelemetry").record("scope_denial");
      return res
        .status(403)
        .json({ success: false, message: "คุณไม่มีสิทธิ์ใช้บริบทนี้" });
    }
    const membership = authorization.memberships.find(
      (item) =>
        Number(item.organization_id) === context &&
        item.status === "active" &&
        item.organization_status === "active",
    );
    if (!membership) {
      require("../utils/privacyTelemetry").record("scope_denial");
      return res
        .status(403)
        .json({ success: false, message: "คุณไม่ได้เป็นสมาชิกหน่วยงานนี้" });
    }
    const rolePermissions =
      await require("./organizationPermissions").organizationRolePermissions(
        db,
        membership.organization_id,
        membership.role_id,
      );
    const permissionRows =
      await require("./dataPermissions").membershipPermissions(
        db,
        membership,
        rolePermissions,
      );
    req.authorization = {
      ...authorization,
      membership,
      permissions: new Set(permissionRows),
    };
    req.organizationContext = context;
    return next();
  } catch (error) {
    console.error(
      "Authorization context failed:",
      require("../utils/safeError").safeError(error),
    );
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถตรวจสอบสิทธิ์ได้" });
  }
}

async function permissionsForRole(roleId) {
  if (await tableExists("role_permissions")) {
    const [rows] = await db.query(
      "SELECT permission_key FROM role_permissions WHERE role_id = ?",
      [roleId],
    );
    return rows.map((row) => row.permission_key);
  }
  return [];
}

function requireAction(permission) {
  return (req, res, next) => {
    if (req.authorization?.isSystemAdmin) return next();
    if (req.authorization?.permissions?.has(permission)) return next();
    return res
      .status(403)
      .json({ success: false, message: "คุณไม่มีสิทธิ์ดำเนินการนี้" });
  };
}

function organizationWhere(column, req, params = []) {
  if (req.organizationContext === "all")
    return { sql: ` AND ${column} IS NOT NULL`, params };
  const scope = req.schoolSubjectScope;
  if (scope) {
    const alias = column.includes(".") ? column.split(".")[0] + "." : "";
    const path = req.schoolResourcePath || req.path;
    const master = path.startsWith("/master-cases") || ["mc.", "m."].includes(alias);
    const ids = master ? scope.masterIds : scope.responseIds;
    return { sql: ` AND ${column} = ? AND ${alias}id IN (?)`, params: [...params, req.organizationContext, ids.length ? ids : [0]] };
  }
  return { sql: ` AND ${column} = ?`, params: [...params, req.organizationContext] };
}

async function audit(
  req,
  { action, targetType, targetId, result = "changed", reason, before, after },
) {
  try {
    if (!(await tableExists("authorization_audit_logs"))) return;
    await db.query(
      `INSERT INTO authorization_audit_logs (request_id, actor_user_id, organization_id, action, target_type, target_id, result, reason, before_data, after_data, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.requestId || null,
        req.user?.id || null,
        typeof req.organizationContext === "number"
          ? req.organizationContext
          : null,
        action,
        targetType || null,
        targetId == null ? null : String(targetId),
        result,
        reason || null,
        before ? JSON.stringify({ fields: Object.keys(before) }) : null,
        after ? JSON.stringify({ fields: Object.keys(after) }) : null,
        req.ip || null,
        String(req.get("user-agent") || "").slice(0, 255),
      ],
    );
  } catch (error) {
    console.error(
      "Authorization audit failed:",
      require("../utils/safeError").safeError(error),
    );
  }
}

module.exports = {
  SYSTEM_ADMIN_PERMISSIONS,
  hasOrganizationTypeColumn,
  hasOrganizationParentColumn,
  organizationTypeSql,
  organizationParentSql,
  organizationLevelSql,
  LEGACY_PERMISSION_KEYS,
  loadAuthorization,
  permissionsForRole,
  resolveContext,
  requireAction,
  organizationWhere,
  audit,
};
