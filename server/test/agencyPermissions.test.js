const { test } = require("node:test");
const assert = require("node:assert/strict");
const { canAgencyAction, isAgencyOnlyRole } = require("../agency/permissions");
test("view-only Agency role cannot create or review; revoking view removes access", () => {
  assert.equal(canAgencyAction(["agency_entries.view"], "view"), true);
  assert.equal(canAgencyAction(["agency_entries.view"], "create"), false);
  assert.equal(canAgencyAction(["agency_entries.view"], "verify"), false);
  assert.equal(canAgencyAction([], "view"), false);
});
test("mixed roles cannot be assigned to Agency and unrelated permissions grant no Agency actions", () => {
  assert.equal(isAgencyOnlyRole(["agency_entries.create"]), true);
  assert.equal(isAgencyOnlyRole(["agency_entries.create", "forms.update"]), false);
  assert.equal(isAgencyOnlyRole([]), false);
  assert.equal(canAgencyAction(["roles.manage"], "verify"), false);
  assert.equal(canAgencyAction(["agency_entries.create"], "schema"), true);
});
