const test = require("node:test");
const assert = require("node:assert/strict");
const { isStrongPassword } = require("../utils/passwordPolicy");

test("accepts passwords meeting every rule at both length bounds", () => {
  assert.equal(isStrongPassword("Abcdef1!"), true);
  assert.equal(isStrongPassword("Abcdefgh1234567!"), true);
});

test("rejects passwords missing a rule", () => {
  for (const password of [
    "Abc1!",
    "Abcdefgh12345678!",
    "abcdef1!",
    "ABCDEF1!",
    "Abcdefg!",
    "Abcdefg1",
    "Abcdef1ก",
    null,
    12345678,
  ])
    assert.equal(isStrongPassword(password), false, String(password));
});
