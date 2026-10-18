const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  membershipPermissions,
  resetMigratedGrants,
} = require("../authorization/dataPermissions");
test("the unit role on the roles page is the only source; member rows and school presets add nothing", async () => {
  const db = {
    query: async (sql) => {
      if (sql.includes("school_staff_roles"))
        return [[{ role_code: "counselor" }]];
      return [
        [
          { permission_key: "pii.view", granted: 1, source: "legacy_snapshot" },
          { permission_key: "clinical.view", granted: 0, source: "explicit" },
        ],
      ];
    },
  };
  const effective = await membershipPermissions(
    db,
    { id: 9, organization_type: "school", organization_id: 2 },
    ["cases.view", "clinical.view", "forms.manage"],
  );
  assert.equal(effective.includes("clinical.view"), true);
  assert.equal(effective.includes("pii.view"), false);
  assert.equal(effective.includes("student_health.view"), false);
  // manage grants every action of its module only.
  for (const action of [
    "view",
    "create",
    "update",
    "delete",
    "assign",
    "export",
  ])
    assert.equal(effective.includes(`forms.${action}`), true, action);
  assert.equal(effective.includes("cases.update"), false);
});
test("role change removes only migrated grants and recalculates from proven new-role access", async () => {
  const calls = [],
    db = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return sql.startsWith("SELECT")
          ? [[{ permission_key: "students.view" }]]
          : [{}];
      },
    };
  await resetMigratedGrants(db, 8, 3, 20);
  assert.match(calls[0].sql, /source="legacy_snapshot"/);
  assert.deepEqual(calls[1].params, [20, 3]);
  assert.equal(calls.filter((v) => v.sql.startsWith("INSERT")).length, 1);
  assert.deepEqual(calls[2].params, [8, "pii.view"]);
  assert.match(calls[2].sql, /INSERT IGNORE/);
});
