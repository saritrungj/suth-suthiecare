const test = require("node:test");
const assert = require("node:assert/strict");
const { validateUserInput } = require("../utils/userValidation");

const validInput = {
  username: "staff-user",
  password: "password-123",
  name: "นางสาว ทดสอบ ระบบ",
  email: "staff@example.test",
};

test("accepts a long Unicode full name and normalises whitespace", () => {
  const input = { ...validInput, name: `  นางสาว   ${"ก".repeat(230)}  ` };
  const result = validateUserInput(input, { requirePassword: true });

  assert.equal(result.error, undefined);
  assert.equal(result.value.name, `นางสาว ${"ก".repeat(230)}`);
});

test("rejects a full name longer than 255 Unicode characters", () => {
  const result = validateUserInput({ ...validInput, name: "ก".repeat(256) }, { requirePassword: true });

  assert.match(result.error, /ชื่อ-นามสกุล/);
});

test("requires an email and a password that meet account policy", () => {
  const missingEmail = validateUserInput({ ...validInput, email: "invalid" }, { requirePassword: true });
  const shortPassword = validateUserInput({ ...validInput, password: "short" }, { requirePassword: true });

  assert.match(missingEmail.error, /อีเมล/);
  assert.match(shortPassword.error, /รหัสผ่าน/);
});
