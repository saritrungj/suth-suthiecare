require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

async function profileFor(
  roleId,
  modernSystemAdmin = false,
  organizationContext,
) {
  const query = async (sql) => {
    if (sql.startsWith("SHOW TABLES")) return [[{ exists: 1 }]];
    if (sql.startsWith("SELECT 1 FROM information_schema"))
      return [[{ exists: 1 }]];
    if (sql.startsWith("SELECT id, username, name, status, role_id FROM users"))
      return [
        [
          {
            id: 5,
            username: "synthetic-staff",
            name: null,
            status: "active",
            role_id: roleId,
          },
        ],
      ];
    if (sql.startsWith("SELECT role_id FROM users"))
      return [[{ role_id: roleId }]];
    if (sql.includes("FROM user_system_roles usr"))
      return [modernSystemAdmin ? [{ exists: 1 }] : []];
    if (sql.includes("FROM organization_memberships om"))
      return [
        [
          {
            id: 9,
            organization_id: 20,
            role_id: 1,
            role_name: "SuperAdmin",
            organization_name: "หน่วยงานจำลอง",
            organization_code: "DEMO",
            organization_status: "active",
            organization_type: "hospital",
            organization_level: "unit",
            status: "active",
            is_primary: 1,
          },
        ],
      ];
    if (sql.includes("FROM organization_membership_data_permissions"))
      return [[]];
    if (sql.startsWith("SELECT permission_key"))
      return [[{ permission_key: "patient_members.view" }]];
    if (sql.includes("FROM organizations o LEFT JOIN"))
      return [[{ id: 20, name: "หน่วยงานจำลอง", org_type: "hospital" }]];
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  require.cache[require.resolve("../config/db")] = { exports: { query } };
  require.cache[require.resolve("../middleware/authMiddleware")] = {
    exports: {
      // The session claim is deliberately stale. The response must reflect the
      // current database account instead of this token or its unit membership.
      verifyToken: (req, _res, next) => {
        req.user = { id: 5, role_id: 1 };
        next();
      },
    },
  };
  delete require.cache[require.resolve("../authorization/authorization")];
  delete require.cache[require.resolve("../routes/organizationRoutes")];
  const app = express();
  const { verifyToken } = require("../middleware/authMiddleware");
  const { resolveContext } = require("../authorization/authorization");
  app.get("/scope-probe", verifyToken, resolveContext, (req, res) =>
    res.json({ organization: req.organizationContext }),
  );
  app.use(require("../routes/organizationRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const path =
      organizationContext === undefined ? "/me/authorization" : "/scope-probe";
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}${path}`,
      {
        headers:
          organizationContext === undefined
            ? {}
            : { "X-Organization-Id": String(organizationContext) },
      },
    );
    if (organizationContext !== undefined)
      return { status: response.status, data: await response.json() };
    assert.equal(response.status, 200);
    return await response.json();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("staff system role remains separate from a privileged organization role", async () => {
  const profile = await profileFor(3);
  assert.equal(profile.user.role_id, 3);
  assert.equal(profile.system_role, "staff");
  assert.equal(profile.is_system_admin, false);
  assert.deepEqual(profile.system_permissions, []);
  assert.equal(profile.memberships[0].role.id, 1);
  assert.deepEqual(profile.memberships[0].permissions, [
    "patient_members.view",
  ]);
});

test("admin system role does not inherit main management authority from the unit", async () => {
  const profile = await profileFor(2);
  assert.equal(profile.system_role, "admin");
  assert.equal(profile.is_system_admin, false);
  assert.deepEqual(profile.organizations, []);
});

test("a modern system administrator is recognized regardless of the legacy account role", async () => {
  const profile = await profileFor(3, true);
  assert.equal(profile.system_role, "system_admin");
  assert.equal(profile.is_system_admin, true);
  assert.ok(profile.system_permissions.includes("users.manage"));
  assert.equal(profile.organizations[0].id, 20);
});

test("unknown legacy account roles do not silently become administrators or staff", async () => {
  const profile = await profileFor(99);
  assert.equal(profile.system_role, null);
  assert.equal(profile.is_system_admin, false);
});

test("admin and staff cannot request all organizations or a foreign unit even with a privileged unit role", async () => {
  for (const roleId of [2, 3]) {
    assert.equal((await profileFor(roleId, false, "all")).status, 403);
    assert.equal((await profileFor(roleId, false, 99)).status, 403);
    assert.deepEqual(await profileFor(roleId, false, 20), {
      status: 200,
      data: { organization: 20 },
    });
  }
});

test("only a system administrator can use the all-organizations context", async () => {
  assert.deepEqual(await profileFor(3, true, "all"), {
    status: 200,
    data: { organization: "all" },
  });
});
