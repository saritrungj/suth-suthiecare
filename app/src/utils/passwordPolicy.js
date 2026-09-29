// Keep in sync with server/utils/passwordPolicy.js.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 16;

export const PASSWORD_RULES = [
  {
    id: "length",
    test: (value) =>
      value.length >= PASSWORD_MIN_LENGTH &&
      value.length <= PASSWORD_MAX_LENGTH,
    th: `ความยาว ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} ตัวอักษร`,
    en: `${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters`,
  },
  {
    id: "upper",
    test: (value) => /[A-Z]/.test(value),
    th: "ตัวอักษรภาษาอังกฤษตัวใหญ่ (A-Z) อย่างน้อย 1 ตัว",
    en: "At least 1 uppercase letter (A-Z)",
  },
  {
    id: "lower",
    test: (value) => /[a-z]/.test(value),
    th: "ตัวอักษรภาษาอังกฤษตัวเล็ก (a-z) อย่างน้อย 1 ตัว",
    en: "At least 1 lowercase letter (a-z)",
  },
  {
    id: "digit",
    test: (value) => /[0-9]/.test(value),
    th: "ตัวเลข (0-9) อย่างน้อย 1 ตัว",
    en: "At least 1 number (0-9)",
  },
  {
    id: "symbol",
    test: (value) => /[!-/:-@[-`{-~]/.test(value),
    th: "สัญลักษณ์ เช่น ! @ # $ % อย่างน้อย 1 ตัว",
    en: "At least 1 symbol, e.g. ! @ # $ %",
  },
];

export function checkPassword(value) {
  const password = String(value || "");
  return PASSWORD_RULES.map((rule) => ({ ...rule, met: rule.test(password) }));
}

export function isStrongPassword(value) {
  return checkPassword(value).every((rule) => rule.met);
}
