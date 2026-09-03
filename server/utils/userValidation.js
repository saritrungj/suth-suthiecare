const MAX_NAME_LENGTH = 255;
const MAX_USERNAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;

function normaliseText(value) {
  return typeof value === "string"
    ? value.normalize("NFC").trim().replace(/\s+/g, " ")
    : "";
}

function characterLength(value) {
  return Array.from(value).length;
}

function validateUserInput(input, { requirePassword = false } = {}) {
  const username = normaliseText(input.username);
  const name = normaliseText(input.name);
  const email = normaliseText(input.email);
  const password = input.password;

  if (characterLength(username) < 3 || characterLength(username) > MAX_USERNAME_LENGTH || /\s/.test(username)) {
    return { error: "ชื่อผู้ใช้งานต้องยาว 3-100 ตัวอักษร และห้ามมีช่องว่าง" };
  }
  if (characterLength(name) < 2 || characterLength(name) > MAX_NAME_LENGTH) {
    return { error: `ชื่อ-นามสกุลต้องยาว 2-${MAX_NAME_LENGTH} ตัวอักษร` };
  }
  if (characterLength(email) > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  }
  if (requirePassword && (typeof password !== "string" || password.length < 8 || password.length > 200)) {
    return { error: "รหัสผ่านต้องมี 8-200 ตัวอักษร" };
  }
  if (password !== undefined && password !== "" && (typeof password !== "string" || password.length < 8 || password.length > 200)) {
    return { error: "รหัสผ่านต้องมี 8-200 ตัวอักษร" };
  }
  return { value: { username, name, email, password } };
}

module.exports = { MAX_NAME_LENGTH, normaliseText, validateUserInput };
