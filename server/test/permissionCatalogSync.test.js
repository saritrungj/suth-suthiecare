const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  keysForOrganizationType,
  ACTIONS,
} = require("../authorization/permissionMatrix");

test("the roles page offers exactly the keys the server accepts for each organization type", async () => {
  const registry = await import(
    pathToFileURL(
      path.resolve(
        __dirname,
        "../../app/src/permissions/permissionRegistry.js",
      ),
    ).href
  );
  assert.deepEqual(registry.PERMISSION_ACTIONS, ACTIONS);
  for (const org_type of ["hospital", "school"]) {
    const offered = new Set(
      registry
        .permissionGroupsForOrganization({ org_type })
        .flatMap((group) =>
          group.actions.map((action) => `${group.id}.${action}`),
        ),
    );
    assert.deepEqual(
      [...offered].sort(),
      [...keysForOrganizationType(org_type)].sort(),
      org_type,
    );
  }
  for (const group of registry.PERMISSION_GROUPS)
    for (const action of ACTIONS)
      assert.ok(
        group.meanings?.[action],
        `${group.id}.${action} needs a meaning`,
      );
});
