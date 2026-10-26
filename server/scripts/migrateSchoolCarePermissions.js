// Gives existing unit roles the new school care modules (behavior reports,
// appointments, documents, audit history) and the rights the everyday school
// flow needs (importing students, recording health, screening rounds,
// approving referrals) based on rights they already hold,
// so the new features work for the right people on day one. Only adds keys,
// never removes. Dry run by default; pass --apply to write.
//   pnpm --filter suthiecare-api migrate:school-care-permissions
//   pnpm --filter suthiecare-api migrate:school-care-permissions -- --apply
require("../config/env");
const {
  keysForOrganizationType,
  expandManage,
} = require("../authorization/permissionMatrix");

// [held key or keys (all needed), keys to add]. Held keys are compared after
// expanding "manage".
const RULES = [
  [
    "student_health.update",
    [
      "student_behavior.view",
      "student_behavior.create",
      "student_behavior.update",
      "student_behavior.assign",
      "school_appointments.view",
      "school_appointments.create",
      "school_appointments.update",
      "school_appointments.assign",
      "audit.view",
    ],
  ],
  // Any teacher who can see students can report a behaviour.
  ["students.view", ["student_behavior.create"]],
  ["school.view", ["school_documents.view"]],
  // Whoever manages school staff also looks after the document library.
  ["school_staff.manage", ["school_documents.manage"]],
  // Importing students records who they are.
  ["students.create", ["pii.create"]],
  // Whoever may edit a student's health can also record it (physical checks,
  // guidance notes) and open follow-up tasks for it.
  ["student_health.update", ["student_health.create", "student_health.assign"]],
  // Whoever builds the assessments and reads their results runs the screening
  // rounds and approves referrals to hospitals.
  [
    ["clinical.view", "forms.update"],
    [
      "school_workflows.view",
      "school_workflows.create",
      "school_workflows.update",
      "referral_approvals.view",
      "referral_approvals.update",
    ],
  ],
];

function plan({ units, rolePermissions }) {
  const byOrg = new Map(units.map((u) => [Number(u.id), u]));
  const current = new Map();
  for (const row of rolePermissions) {
    const key = `${row.organization_id}:${row.role_id}`;
    if (!current.has(key)) current.set(key, []);
    current.get(key).push(row.permission_key);
  }
  const changes = [];
  for (const [key, stored] of current) {
    const [organizationId, roleId] = key.split(":").map(Number);
    const unit = byOrg.get(organizationId);
    if (!unit) continue;
    const raw = new Set(stored);
    const held = expandManage(stored);
    const allowed = keysForOrganizationType(unit.org_type);
    const added = new Map();
    for (const [when, keys] of RULES) {
      const needs = [when].flat();
      // school_staff.manage means the stored manage key, not every view.
      const has = needs.every((key) =>
        key.endsWith(".manage") ? raw.has(key) : held.has(key),
      );
      if (!has) continue;
      for (const permission of keys)
        if (
          allowed.has(permission) &&
          !held.has(permission) &&
          !added.has(permission)
        )
          added.set(permission, `holds ${needs.join(" + ")}`);
    }
    // An added "manage" already covers the rest of its module.
    for (const permission of [...added.keys()]) {
      const [module, action] = permission.split(".");
      if (action !== "manage" && added.has(`${module}.manage`))
        added.delete(permission);
    }
    if (added.size)
      changes.push({
        organization_id: organizationId,
        role_id: roleId,
        added: [...added]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([permission, reason]) => ({ permission, reason })),
      });
  }
  return changes.sort(
    (a, b) => a.organization_id - b.organization_id || a.role_id - b.role_id,
  );
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
  };
}

async function apply(db, changes) {
  const connection = await db.getConnection();
  try {
    const [[lock]] = await connection.query(
      'SELECT GET_LOCK("suth_school_care_permissions",30) AS acquired',
    );
    if (Number(lock.acquired) !== 1)
      throw new Error("SCHOOL_CARE_PERMISSIONS_LOCKED");
    await connection.beginTransaction();
    for (const change of changes) {
      await connection.query(
        'INSERT INTO organization_role_permission_sets (organization_id,role_id,source,version) VALUES (?,?,"explicit",1) ON DUPLICATE KEY UPDATE version=version+1,updated_at=NOW()',
        [change.organization_id, change.role_id],
      );
      for (const { permission } of change.added)
        await connection.query(
          "INSERT IGNORE INTO organization_role_permissions (organization_id,role_id,permission_key) VALUES (?,?,?)",
          [change.organization_id, change.role_id, permission],
        );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection
      .query('SELECT RELEASE_LOCK("suth_school_care_permissions")')
      .catch(() => {});
    connection.release();
  }
}

async function main() {
  const db = require("../config/db");
  const write = process.argv.includes("--apply");
  try {
    const changes = plan(await load(db));
    if (write) await apply(db, changes);
    console.log(
      JSON.stringify(
        {
          mode: write ? "applied" : "dry_run",
          roles_changed: changes.length,
          keys_added: changes.reduce((sum, c) => sum + c.added.length, 0),
          changes,
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

module.exports = { plan, RULES };
