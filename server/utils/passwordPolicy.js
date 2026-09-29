// Keep in sync with app/src/utils/passwordPolicy.js.
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 16;
const PASSWORD_POLICY_MESSAGE =
  "รหัสผ่านต้องมีความยาว 8-16 ตัวอักษร และมีตัวอักษรภาษาอังกฤษตัวใหญ่ ตัวเล็ก ตัวเลข และสัญลักษณ์อย่างน้อยอย่างละ 1 ตัว";

function isStrongPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!-/:-@[-`{-~]/.test(password)
  );
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  isStrongPassword,
};
