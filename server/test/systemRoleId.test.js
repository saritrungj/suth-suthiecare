const test = require("node:test");
const assert = require("node:assert/strict");
const { normaliseSystemRoleId } = require("../utils/userValidation");

test("system role keeps System Admin and folds ordinary accounts into 3", () => {
  assert.equal(normaliseSystemRoleId(1), 1);
  assert.equal(normaliseSystemRoleId("1"), 1);
  assert.equal(normaliseSystemRoleId(2), 3);
  assert.equal(normaliseSystemRoleId(3), 3);
});

test("system role rejects values outside 1-3", () => {
  for (const bad of [0, 4, 99, -1, 1.5, "x", null, undefined])
    assert.equal(normaliseSystemRoleId(bad), null);
});
