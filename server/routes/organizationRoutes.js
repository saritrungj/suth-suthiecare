const accountEmail = require("../utils/accountEmail");
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  loadAuthorization,
  audit,
  hasOrganizationParentColumn,
  hasOrganizationTypeColumn,
  organizationLevelSql,
  organizationParentSql,
  organizationTypeSql,
} = require("../authorization/authorization");
const {
  isMainOrganization,
  planOrganizationWrite,
  memberUserIds,
} = require("../utils/organizationHierarchy");

const { decrypt } = require("../utils/encryption");

const displayName = (value) => {
  if (!value) return "";
  return (
    require("../utils/privateField").readField(value, "users", "name") || ""
  );
};

const router = express.Router();
const createOrganizationCode = async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = `ORG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const [rows] = await db.query(
      "SELECT 1 FROM organizations WHERE code=? LIMIT 1",
      [code],
    );
    if (!rows.length) return code;
  }
  throw new Error("ไม่สามารถสร้างรหัสหน่วยงานได้");
};

async function requireSystemAdmin(req, res, next) {
  const authorization = await loadAuthorization(req.user.id);
  if (!authorization?.isSystemAdmin)
    return res
      .status(403)
      .json({ success: false, message: "สงวนสิทธิ์สำหรับ System Admin" });
  req.authorization = authorization;
  return next();
}

router.get("/me/authorization", verifyToken, async (req, res) => {
  try {
    const authorization = await loadAuthorization(req.user.id);
    if (!authorization)
      return res
        .status(401)
        .json({ success: false, message: "บัญชีไม่พร้อมใช้งาน" });
    // Only sub-units are working contexts; a main organization only groups.
    const memberships = await Promise.all(
      authorization.memberships
        .filter(
          (m) =>
            m.status === "active" &&
            m.organization_status === "active" &&
            m.organization_level !== "main",
        )
        .map(async (membership) => ({
          id: membership.id,
          organization: {
            id: membership.organization_id,
            code: membership.organization_code,
            name: membership.organization_name,
            org_type: membership.organization_type || "hospital",
            parent_id: membership.organization_parent_id || null,
            parent_name: membership.organization_parent_name || null,
          },
          role: { id: membership.role_id, name: membership.role_name },
          is_primary: Boolean(membership.is_primary),
          permissions:
            await require("../authorization/dataPermissions").membershipPermissions(
              db,
              membership,
              await require("../authorization/organizationPermissions").organizationRolePermissions(
                db,
                membership.organization_id,
                membership.role_id,
              ),
            ),
        })),
    );
    let organizations = [];
    if (authorization.isSystemAdmin) {
      const type = await organizationTypeSql("o");
      const parent = await organizationParentSql("o");
      const level = await organizationLevelSql("o");
      const [rows] = await db.query(
        `SELECT o.id, o.code, o.name, ${type} AS org_type, ${parent} AS parent_id, p.name AS parent_name
           FROM organizations o LEFT JOIN organizations p ON p.id = ${parent}
          WHERE o.status = 'active' AND ${level} = 'unit'
          ORDER BY p.name IS NULL, p.name, o.name`,
      );
      organizations = rows;
    }
    return res.json({
      user: authorization.user,
      is_system_admin: authorization.isSystemAdmin,
      // Derived from the current database account, independent of unit roles.
      system_role: authorization.isSystemAdmin
        ? "system_admin"
        : Number(authorization.user.role_id) === 2
          ? "admin"
          : Number(authorization.user.role_id) === 3
            ? "staff"
            : null,
      system_permissions: authorization.isSystemAdmin
        ? [
            "organizations.manage",
            "users.manage",
            "roles.manage",
            "global_content.manage",
            "cross_organization_data.view",
            "audit.view",
          ]
        : [],
      memberships,
      organizations,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถโหลดสิทธิ์ได้" });
  }
});

router.use("/organizations", verifyToken, requireSystemAdmin);

async function organizationRow(id) {
  if (!Number.isInteger(Number(id)) || Number(id) < 1) return null;
  const type = await organizationTypeSql("o");
  const parent = await organizationParentSql("o");
  const level = await organizationLevelSql("o");
  const [rows] = await db.query(
    `SELECT o.id, o.code, o.name, o.description, o.status, ${type} AS org_type, ${parent} AS parent_id,
            ${level} AS org_level
       FROM organizations o WHERE o.id = ? LIMIT 1`,
    [Number(id)],
  );
  return rows[0] || null;
}

// Every organization with its parent and counts, for the hierarchy view.
router.get("/organizations", async (req, res) => {
  const type = await organizationTypeSql("o");
  const parent = await organizationParentSql("o");
  const level = await organizationLevelSql("o");
  const [rows] = await db.query(
    `SELECT o.id, o.code, o.name, ${type} AS org_type, ${parent} AS parent_id, ${level} AS org_level,
            o.description, o.status,
            o.created_at, o.updated_at,
            (SELECT COUNT(*) FROM organization_memberships om WHERE om.organization_id = o.id AND om.status = 'active') AS member_count
       FROM organizations o
      ORDER BY o.status = 'active' DESC, o.name`,
  );
  const childCounts = new Map();
  rows.forEach((row) => {
    if (row.parent_id)
      childCounts.set(row.parent_id, (childCounts.get(row.parent_id) || 0) + 1);
  });
  res.json(
    rows.map((row) => ({
      ...row,
      kind: isMainOrganization(row) ? "main" : "unit",
      child_count: childCounts.get(row.id) || 0,
    })),
  );
});

async function hierarchyReady(res) {
  if (
    (await hasOrganizationTypeColumn()) &&
    (await hasOrganizationParentColumn()) &&
    (await organizationLevelSql("o")) !== "'unit'"
  )
    return true;
  res.status(503).json({
    success: false,
    message:
      "ฐานข้อมูลยังไม่รองรับหน่วยงานหลัก/หน่วยงานย่อย กรุณารัน migrate:school-module",
  });
  return false;
}

router.post("/organizations", async (req, res) => {
  if (!(await hierarchyReady(res))) return;
  const body = req.body || {};
  const parent = body.parent_id ? await organizationRow(body.parent_id) : null;
  const plan = planOrganizationWrite({ body, parent });
  if (plan.error)
    return res.status(422).json({ success: false, message: plan.error });
  const v = plan.value;
  try {
    const code = await createOrganizationCode();
    const [result] = await db.query(
      "INSERT INTO organizations (code, name, description, org_type, parent_id, org_level) VALUES (?, ?, ?, ?, ?, ?)",
      [code, v.name, v.description, v.org_type, v.parent_id, v.kind],
    );
    await audit(req, {
      action: "organizations.manage",
      targetType: "organization",
      targetId: result.insertId,
      after: { code, ...v },
    });
    res.status(201).json({ id: result.insertId, code });
  } catch (error) {
    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      success: false,
      message:
        error.code === "ER_DUP_ENTRY"
          ? "รหัสหน่วยงานซ้ำ"
          : "ไม่สามารถสร้างหน่วยงานได้",
    });
  }
});

router.put("/organizations/:id", async (req, res) => {
  if (!(await hierarchyReady(res))) return;
  const existing = await organizationRow(req.params.id);
  if (!existing)
    return res.status(404).json({ success: false, message: "ไม่พบหน่วยงาน" });
  const body = req.body || {};
  const parentId =
    body.parent_id === undefined ? existing.parent_id : body.parent_id;
  const parent = parentId ? await organizationRow(parentId) : null;
  const plan = planOrganizationWrite({ body, existing, parent });
  if (plan.error)
    return res.status(422).json({ success: false, message: plan.error });
  const v = plan.value;
  // Which sub-units take the (possibly new) type: the unit itself, or every
  // sub-unit of a main organization. None may still own clinics or schools of
  // the other type.
  const affectedIds =
    v.kind === "main"
      ? (
          await db.query(
            "SELECT id FROM organizations WHERE parent_id = ? AND org_type <> ?",
            [existing.id, v.org_type],
          )
        )[0].map((row) => row.id)
      : v.org_type !== existing.org_type
        ? [existing.id]
        : [];
  if (affectedIds.length) {
    const [owned] = await db.query(
      v.org_type === "school"
        ? "SELECT o.name FROM clinics c JOIN organizations o ON o.id = c.organization_id WHERE c.organization_id IN (?) LIMIT 1"
        : `SELECT o.name FROM schools s JOIN organizations o ON o.id = s.organization_id
            WHERE s.organization_id IN (?)
              AND (EXISTS (SELECT 1 FROM school_grade_levels g WHERE g.school_id = s.id)
                OR EXISTS (SELECT 1 FROM school_students st WHERE st.school_id = s.id)
                OR EXISTS (SELECT 1 FROM school_teachers t WHERE t.school_id = s.id))
            LIMIT 1`,
      [affectedIds],
    );
    if (owned.length)
      return res.status(409).json({
        success: false,
        message: `${owned[0].name} ยังมี${v.org_type === "school" ? "คลินิก" : "โรงเรียน"}อยู่ จึงเปลี่ยนเป็นประเภท${v.org_type === "school" ? "โรงเรียน" : "โรงพยาบาล"}ไม่ได้`,
      });
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE organizations SET name = ?, description = ?, status = ?, org_type = ?, parent_id = ? WHERE id = ?",
      [v.name, v.description, v.status, v.org_type, v.parent_id, existing.id],
    );
    if (v.kind === "main")
      await connection.query(
        "UPDATE organizations SET org_type = ? WHERE parent_id = ?",
        [v.org_type, existing.id],
      );
    // Empty school rows of units leaving the school type go away.
    if (affectedIds.length && v.org_type !== "school")
      await connection.query(
        "DELETE FROM schools WHERE organization_id IN (?)",
        [affectedIds],
      );
    if (v.kind === "unit" && v.org_type === "school")
      await connection.query(
        "UPDATE schools SET name = ? WHERE organization_id = ?",
        [v.name, existing.id],
      );
    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "permissions.change",
      "organization",
      organization.id,
      {},
      connection,
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  await audit(req, {
    action: "organizations.manage",
    targetType: "organization",
    targetId: existing.id,
    before: {
      name: existing.name,
      status: existing.status,
      org_type: existing.org_type,
      parent_id: existing.parent_id,
    },
    after: v,
  });
  res.json({ success: true });
});

// Current members only. A removed member keeps an inactive row (audit trail and
// re-adding restores it) but is no longer listed as part of the organization.
router.get("/organizations/:id/members", async (req, res) => {
  const [rows] = await db.query(
    `SELECT om.id, om.user_id, om.role_id, om.status, om.is_primary, u.username, u.email,u.email_encrypted, u.name AS name_encrypted, r.name role_name
    FROM organization_memberships om JOIN users u ON u.id=om.user_id JOIN roles r ON r.id=om.role_id
    WHERE om.organization_id=? AND om.status='active' ORDER BY u.username`,
    [req.params.id],
  );
  res.json(
    rows.map(({ name_encrypted, email_encrypted, email, ...row }) => ({
      ...row,
      email: require("../utils/accountEmail").decode(
        { email, email_encrypted },
        "users",
      ),
      name: displayName(name_encrypted) || row.username,
    })),
  );
});

// Adds one ({ user_id }) or many ({ user_ids: [] }) staff with one role. A
// former member is re-activated with the new role. Main organizations have no
// members: staff belong to the sub-unit they work in.
router.post("/organizations/:id/members", async (req, res) => {
  const { role_id, is_primary = false } = req.body || {};
  const userIds = memberUserIds(req.body);
  if (!userIds || !Number.isInteger(Number(role_id)))
    return res
      .status(422)
      .json({ success: false, message: "ข้อมูลสมาชิกไม่ถูกต้อง" });
  const organization = await organizationRow(req.params.id);
  if (!organization)
    return res.status(404).json({ success: false, message: "ไม่พบหน่วยงาน" });
  if (isMainOrganization(organization) && (await hasOrganizationParentColumn()))
    return res.status(422).json({
      success: false,
      message:
        "หน่วยงานหลักไม่มีสมาชิก กรุณาเพิ่มเจ้าหน้าที่ในหน่วยงานย่อยที่ทำงานจริง",
    });
  const [roles] = await db.query("SELECT id FROM roles WHERE id = ? LIMIT 1", [
    Number(role_id),
  ]);
  if (!roles.length)
    return res.status(422).json({ success: false, message: "ไม่พบบทบาท" });
  const [users] = await db.query(
    "SELECT id FROM users WHERE id IN (?) AND status = 'active'",
    [userIds],
  );
  if (users.length !== userIds.length)
    return res.status(422).json({
      success: false,
      message: "มีบัญชีเจ้าหน้าที่ที่ไม่พบหรือถูกปิดใช้งาน",
    });
  const [existingRows] = await db.query(
    "SELECT user_id, status FROM organization_memberships WHERE organization_id = ? AND user_id IN (?)",
    [organization.id, userIds],
  );
  const existing = new Map(
    existingRows.map((row) => [row.user_id, row.status]),
  );
  const added = [];
  const reactivated = [];
  const skipped = [];
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const userId of userIds) {
      if (existing.get(userId) === "active") {
        skipped.push(userId);
        continue;
      }
      await connection.query(
        `INSERT INTO organization_memberships (user_id, organization_id, role_id, is_primary)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), status = 'active'`,
        [userId, organization.id, Number(role_id), Boolean(is_primary)],
      );
      const [memberships] = await connection.query(
        "SELECT id FROM organization_memberships WHERE user_id=? AND organization_id=?",
        [userId, organization.id],
      );
      await require("../authorization/dataPermissions").resetMigratedGrants(
        connection,
        memberships[0].id,
        Number(role_id),
        organization.id,
      );
      if (is_primary)
        await connection.query(
          "UPDATE organization_memberships SET is_primary=0 WHERE user_id=? AND organization_id<>?",
          [userId, organization.id],
        );
      (existing.has(userId) ? reactivated : added).push(userId);
    }
    req.organizationContext = organization.id;
    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "memberships.create",
      "organization",
      organization.id,
      { count: added.length + reactivated.length },
      connection,
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    connection.release();
    return res
      .status(error.status || 500)
      .json({ success: false, message: "ไม่สามารถเพิ่มสมาชิกได้" });
  }
  connection.release();
  await audit(req, {
    action: "organizations.manage",
    targetType: "membership",
    targetId: String(organization.id),
    after: { role_id: Number(role_id), added, reactivated, skipped },
  });
  if (userIds.length === 1 && skipped.length === 1)
    return res
      .status(409)
      .json({ success: false, message: "ผู้ใช้นี้เป็นสมาชิกอยู่แล้ว" });
  res.status(201).json({ success: true, added, reactivated, skipped });
});

router.put("/organizations/:id/members/:membershipId", async (req, res) => {
  const { role_id, status, is_primary = false } = req.body || {};
  if (
    !Number.isInteger(Number(role_id)) ||
    !["active", "inactive"].includes(status)
  )
    return res
      .status(422)
      .json({ success: false, message: "ข้อมูลสมาชิกไม่ถูกต้อง" });
  const connection = await db.getConnection();
  let result;
  try {
    await connection.beginTransaction();
    const [members] = await connection.query(
      "SELECT id,role_id FROM organization_memberships WHERE id=? AND organization_id=? FOR UPDATE",
      [req.params.membershipId, req.params.id],
    );
    if (!members[0]) {
      await connection.rollback();
      return res.status(404).json({ code: "MEMBERSHIP_NOT_FOUND" });
    }
    [result] = await connection.query(
      "UPDATE organization_memberships SET role_id=?,status=?,is_primary=? WHERE id=? AND organization_id=?",
      [
        role_id,
        status,
        Boolean(is_primary),
        req.params.membershipId,
        req.params.id,
      ],
    );
    if (Number(members[0].role_id) !== Number(role_id))
      await require("../authorization/dataPermissions").resetMigratedGrants(
        connection,
        members[0].id,
        Number(role_id),
        Number(req.params.id),
      );
    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "permissions.change",
      "membership",
      members[0].id,
      {},
      connection,
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  if (!result.affectedRows)
    return res.status(404).json({ success: false, message: "ไม่พบสมาชิก" });
  await audit(req, {
    action: "organizations.manage",
    targetType: "membership",
    targetId: req.params.membershipId,
    after: { role_id, status, is_primary },
  });
  res.json({ success: true });
});

module.exports = router;
