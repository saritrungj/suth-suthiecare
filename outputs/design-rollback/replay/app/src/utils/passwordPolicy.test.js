import test from "node:test";
import assert from "node:assert/strict";
import { checkPassword, isStrongPassword } from "./passwordPolicy.js";

test("accepts a password meeting every rule", () => {
  assert.equal(isStrongPassword("Abcdef1!"), true);
  assert.equal(isStrongPassword("Abcdefgh1234567!"), true);
});

test("rejects passwords missing a rule", () => {
  assert.equal(isStrongPassword("Abc1!"), false); // too short
  assert.equal(isStrongPassword("Abcdefgh12345678!"), false); // 17 chars
  assert.equal(isStrongPassword("abcdef1!"), false); // no uppercase
  assert.equal(isStrongPassword("ABCDEF1!"), false); // no lowercase
  assert.equal(isStrongPassword("Abcdefg!"), false); // no digit
  assert.equal(isStrongPassword("Abcdefg1"), false); // no symbol
});

test("does not count Thai characters as symbols", () => {
  assert.equal(isStrongPassword("Abcdef1ก"), false);
});

test("reports which rules are unmet", () => {
  const unmet = checkPassword("abc")
    .filter((rule) => !rule.met)
    .map((rule) => rule.id);
  assert.deepEqual(unmet, ["length", "upper", "digit", "symbol"]);
});
