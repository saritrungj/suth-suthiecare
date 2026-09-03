const test = require("node:test");
const assert = require("node:assert/strict");

const { masterCaseIdentityValue } = require("../utils/masterCaseIdentity");

test("stores an empty non-null identity when only an identity hash is available", () => {
  assert.equal(masterCaseIdentityValue(null), "");
  assert.equal(masterCaseIdentityValue(undefined), "");
});

test("preserves the encrypted identity when one is available", () => {
  assert.equal(masterCaseIdentityValue("encrypted-value"), "encrypted-value");
});
