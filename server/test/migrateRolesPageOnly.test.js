const test = require("node:test");
const assert = require("node:assert/strict");
const { plan } = require("../scripts/migrateRolesPageOnly");

const base = {
  units: [
    { id: 2, org_type: "school" },
    { id: 1, org_type: "hospital" },
  ],
  rolePermissions: [
    { organization_id: 1, role_id: 3, permission_key: "cases.update" },
    { organization_id: 1, role_id: 3, permission_key: "dashboard.view" },
  ],
  memberships: [
    { organization_id: 2, role_id: 4, user_id: 10, role_name: "ครู" },
    { organization_id: 2, role_id: 4, user_id: 11, role_name: "ครู" },
    {
      organization_id: 2,
      role_id: 5,
      user_id: 12,
      role_name: "school_guardian",
    },
    { organization_id: 1, role_id: 3, user_id: 20, role_name: "เจ้าหน้าที่" },
  ],
  schoolRoles: [
    { organization_id: 2, user_id: 10, role_code: "homeroom" },
    { organization_id: 2, user_id: 12, role_code: "guardian" },
  ],
  teachers: [{ organization_id: 2, user_id: 11 }],
  memberData: [
    {
      organization_id: 1,
      role_id: 3,
      user_id: 20,
      permission_key: "pii.view",
      granted: 0,
    },
  ],
};

test("school presets and plain teachers are copied onto the shared unit role, guardians are skipped", () => {
  const { changes, warnings } = plan(base);
  const teacher = changes.find(
    (c) => c.organization_id === 2 && c.role_id === 4,
  );
  const added = teacher.added.map((a) => a.permission);
  for (const key of [
    "students.view",
    "student_health.view",
    "clinical.view",
    "school.view",
  ])
    assert.ok(added.includes(key), key);
  // Derived from student_health.view so health record writes keep working.
  assert.ok(added.includes("student_health.create"));
  assert.equal(
    changes.some((c) => c.role_id === 5),
    false,
  );
  assert.deepEqual(
    warnings.find((w) => w.type === "school_roles_share_unit_role")
      .school_roles,
    ["homeroom", "other"],
  );
});

test("hospital roles gain only the keys that keep today's behaviour and never school keys", () => {
  const { changes, warnings } = plan(base);
  const staff = changes.find((c) => c.organization_id === 1);
  const added = staff.added.map((a) => a.permission);
  assert.ok(added.includes("clinical.update"));
  assert.ok(added.includes("patient_members.create"));
  assert.ok(added.includes("dashboard.create"));
  assert.equal(
    added.some((key) => key.startsWith("student")),
    false,
  );
  assert.equal(added.includes("cases.delete"), false);
  // Every member of this role was denied pii.view, so the role does not get it.
  assert.equal(added.includes("pii.view"), false);
  assert.equal(
    warnings.some((w) => w.type === "explicit_member_denial_not_kept"),
    false,
  );
});

test("a denial held by only some members of a role is reported, not silently widened", () => {
  const { warnings } = plan({
    ...base,
    memberships: [
      ...base.memberships,
      { organization_id: 1, role_id: 3, user_id: 21, role_name: "เจ้าหน้าที่" },
    ],
  });
  assert.ok(
    warnings.some(
      (w) => w.type === "explicit_member_denial_not_kept" && w.user_id === 20,
    ),
  );
});
