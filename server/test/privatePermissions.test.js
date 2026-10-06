const test = require("node:test"),
  assert = require("node:assert/strict");
const {
  membershipPermissions,
  resetMigratedGrants,
} = require("../authorization/dataPermissions");
test("membership denial overrides its role template without granting a wider record scope", async () => {
  const db = {
    query: async () => [
      [
        { permission_key: "pii.view", granted: 1, source: "legacy_snapshot" },
        { permission_key: "clinical.view", granted: 0, source: "explicit" },
      ],
    ],
  };
  const effective = await membershipPermissions(db, { id: 9 }, [
    "cases.view",
    "clinical.view",
  ]);
  assert.deepEqual(new Set(effective), new Set(["cases.view", "pii.view"]));
  assert.equal(effective.includes("student_health.view"), false);
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
