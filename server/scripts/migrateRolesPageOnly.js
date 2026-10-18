// One-time move to "the roles page is the only source of rights".
// Copies each unit role's current effective rights (school-role presets of its
// members, per-member grants, and the keys implied by today's behaviour) into
// organization_role_permissions, so nobody loses access when presets stop
// applying. Dry run by default; pass --apply to write.
require("../config/env");
const { presets } = require("../authorization/schoolRolePermissions");
const {
  keysForOrganizationType,
  expandManage,
} = require("../authorization/permissionMatrix");

// Keys that today's routes allowed with another right; adding them keeps behaviour.
const DERIVED = [
  [
    ["dashboard.view"],
    [
      "dashboard.create",
      "dashboard.update",
      "dashboard.delete",
      "dashboard.assign",
    ],
  ],
  [["pii.view"], ["pii.export", "pii.assign"]],
  [["clinical.view"], ["clinical.export", "clinical.assign"]],
  [["students.create"], ["pii.create"]],
  [["cases.create"], ["pii.create"]],
  [["students.update"], ["pii.update"]],
  [
    ["patient_members.update"],
    ["pii.update", "patient_members.assign", "patient_members.delete"],
  ],
  [["students.delete"], ["pii.delete"]],
  [
    ["cases.update"],
    [
      "clinical.create",
      "clinical.update",
      "patient_members.create",
      "patient_members.delete",
    ],
  ],
  [["cases.delete"], ["clinical.delete"]],
  [["appointments.update"], ["appointments.delete"]],
  [["appointments.create"], ["appointments.assign"]],
  [["forms.update"], ["forms.assign"]],
  [["clinics.update"], ["clinics.assign"]],
  [["help_center.update"], ["help_center.assign"]],
  [["school.update"], ["school.assign"]],
  [["school_workflows.manage"], ["students.assign"]],
  [
    ["student_health.view"],
    [
      "student_health.create",
      "student_health.update",
      "student_health.delete",
      "student_health.assign",
    ],
  ],
  [["students.export"], ["student_health.export"]],
  [["school.export"], ["school_staff.export"]],
];

function derive(keys) {
  const result = expandManage(keys);
  let grew = true;
  while (grew) {
    grew = false;
    for (const [from, to] of DERIVED)
      if (from.every((key) => result.has(key)))
        for (const key of to)
          if (!result.has(key)) {
            result.add(key);
            grew = true;
          }
  }
  return result;
}

// Pure planner: rows in, per-role additions and warnings out.
function plan({
  units,
  rolePermissions,
  memberships,
  schoolRoles,
  teachers,
  memberData,
}) {
  const byOrg = new Map(units.map((u) => [Number(u.id), u]));
  const current = new Map();
  for (const row of rolePermissions) {
    const key = `${row.organization_id}:${row.role_id}`;
    if (!current.has(key)) current.set(key, new Set());
    current.get(key).add(row.permission_key);
  }
  const rolesOf = new Map();
  for (const r of schoolRoles) {
    const key = `${r.organization_id}:${r.user_id}`;
    if (!rolesOf.has(key)) rolesOf.set(key, new Set());
    rolesOf.get(key).add(r.role_code);
  }
  const teaching = new Set(
    teachers.map((t) => `${t.organization_id}:${t.user_id}`),
  );
  const grants = new Map(),
    denials = new Map(),
    warnings = [];
  for (const d of memberData) {
    const memberKey = `${d.organization_id}:${d.role_id}`;
    const target = Number(d.granted) === 1 ? grants : denials;
    if (!target.has(memberKey)) target.set(memberKey, new Map());
    const users = target.get(memberKey).get(d.permission_key) || new Set();
    users.add(Number(d.user_id));
    target.get(memberKey).set(d.permission_key, users);
  }
  const groups = new Map();
  for (const m of memberships) {
    const unit = byOrg.get(Number(m.organization_id));
    if (!unit || m.role_name === "school_guardian") continue;
    const key = `${m.organization_id}:${m.role_id}`;
    if (!groups.has(key))
      groups.set(key, {
        unit,
        role_id: Number(m.role_id),
        role_name: m.role_name,
        members: [],
      });
    groups.get(key).members.push(m);
  }
  const changes = [];
  for (const [key, group] of groups) {
    const base = current.get(key) || new Set();
    const wanted = new Set(base);
    const reasons = new Map();
    const add = (permission, reason) => {
      if (!wanted.has(permission)) reasons.set(permission, reason);
      wanted.add(permission);
    };
    const codes = new Set();
    if (group.unit.org_type === "school")
      for (const m of group.members) {
        const memberRoles = rolesOf.get(`${m.organization_id}:${m.user_id}`);
        if (memberRoles?.size)
          memberRoles.forEach((code) => code !== "guardian" && codes.add(code));
        else if (teaching.has(`${m.organization_id}:${m.user_id}`))
          codes.add("other");
      }
    for (const code of codes)
      for (const permission of expandManage(presets[code] || []))
        add(permission, `school role ${code}`);
    for (const [permission] of grants.get(key) || [])
      add(permission, "member grant");
    for (const permission of derive(wanted))
      add(permission, "keeps current behaviour");
    // A key denied to every member of the role stays off the role; a partial
    // denial cannot be kept per member and is reported.
    const removed = [];
    for (const [permission, users] of denials.get(key) || []) {
      const everyone = group.members.every((m) => users.has(Number(m.user_id)));
      if (everyone) {
        // Without view, the module's other keys from this migration go too.
        const [module, action] = permission.split(".");
        const dropped =
          action === "view"
            ? [...wanted].filter((p) => p.startsWith(`${module}.`))
            : [permission];
        for (const p of dropped) {
          wanted.delete(p);
          if (base.has(p)) removed.push(p);
        }
      } else
        for (const user of users)
          warnings.push({
            type: "explicit_member_denial_not_kept",
            organization_id: Number(group.unit.id),
            role_id: group.role_id,
            user_id: user,
            permission,
          });
    }
    const allowed = keysForOrganizationType(group.unit.org_type);
    const added = [...wanted]
      .filter((p) => !base.has(p) && allowed.has(p))
      .sort();
    if (codes.size > 1)
      warnings.push({
        type: "school_roles_share_unit_role",
        organization_id: group.unit.id,
        role_id: group.role_id,
        school_roles: [...codes].sort(),
      });
    if (added.length || removed.length)
      changes.push({
        organization_id: Number(group.unit.id),
        role_id: group.role_id,
        role_name: group.role_name,
        added: added.map((permission) => ({
          permission,
          reason: reasons.get(permission),
        })),
        removed: removed.map((permission) => ({
          permission,
          reason: "denied to every member",
        })),
      });
  }
  return { changes, warnings };
}

async function load(db) {
  const q = async (sql) => (await db.query(sql))[0];
  return {
    units: await q(
      "SELECT id,org_type FROM organizations WHERE org_level='unit'",
    ),
    rolePermissions: await q(
      "SELECT organization_id,role_id,permission_key FROM organization_role_permissions",
    ),
    memberships: await q(
      "SELECT om.organization_id,om.role_id,om.user_id,r.name AS role_name FROM organization_memberships om JOIN roles r ON r.id=om.role_id WHERE om.status='active'",
    ),
    schoolRoles: await q(
      "SELECT s.organization_id,r.user_id,r.role_code FROM school_staff_roles r JOIN schools s ON s.id=r.school_id WHERE r.status='active'",
    ),
    teachers: await q(
      "SELECT s.organization_id,t.user_id FROM school_teachers t JOIN schools s ON s.id=t.school_id WHERE t.status='active'",
    ),
    memberData: await q(
      "SELECT om.organization_id,om.role_id,om.user_id,d.permission_key,d.granted FROM organization_membership_data_permissions d JOIN organization_memberships om ON om.id=d.membership_id WHERE om.status='active'",
    ),
  };
}

async function apply(db, result) {
  const connection = await db.getConnection();
  try {
    const [[lock]] = await connection.query(
      'SELECT GET_LOCK("suth_roles_page_only",30) AS acquired',
    );
    if (Number(lock.acquired) !== 1)
      throw new Error("ROLES_PAGE_MIGRATION_LOCKED");
    await connection.beginTransaction();
    for (const change of result.changes) {
      await connection.query(
        'INSERT INTO organization_role_permission_sets (organization_id,role_id,source,version) VALUES (?,?,"explicit",1) ON DUPLICATE KEY UPDATE version=version+1,updated_at=NOW()',
        [change.organization_id, change.role_id],
      );
      for (const { permission } of change.added)
        await connection.query(
          "INSERT IGNORE INTO organization_role_permissions (organization_id,role_id,permission_key) VALUES (?,?,?)",
          [change.organization_id, change.role_id, permission],
        );
      for (const { permission } of change.removed)
        await connection.query(
          "DELETE FROM organization_role_permissions WHERE organization_id=? AND role_id=? AND permission_key=?",
          [change.organization_id, change.role_id, permission],
        );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection
      .query('SELECT RELEASE_LOCK("suth_roles_page_only")')
      .catch(() => {});
    connection.release();
  }
}

async function main() {
  const db = require("../config/db");
  const write = process.argv.includes("--apply");
  try {
    const result = plan(await load(db));
    if (write) await apply(db, result);
    console.log(
      JSON.stringify(
        {
          mode: write ? "applied" : "dry_run",
          roles_changed: result.changes.length,
          keys_added: result.changes.reduce(
            (sum, c) => sum + c.added.length,
            0,
          ),
          changes: result.changes,
          warnings: result.warnings,
        },
        null,
        2,
      ),
    );
  } finally {
    await db.end?.();
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = { plan, derive, DERIVED };
