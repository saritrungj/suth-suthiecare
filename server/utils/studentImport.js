// Pure helpers for importing students from a spreadsheet. The route does the
// database work; everything here is deterministic (except the password) and
// covered by test/schoolImport.test.js.
const crypto = require("crypto");
const { isStrongPassword } = require("./passwordPolicy");
const { validatePersonName } = require("./patientValidation");
const { normalizeNationalId } = require("./personIdentity");

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,79}$/;
const STUDENT_CODE_PATTERN = /^[\p{L}\p{N}._/-]{1,32}$/u;
const MAX_IMPORT_ROWS = 200;

const text = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const GENDERS = {
  male: "male",
  m: "male",
  ชาย: "male",
  "ด.ช.": "male",
  เด็กชาย: "male",
  นาย: "male",
  female: "female",
  f: "female",
  หญิง: "female",
  "ด.ญ.": "female",
  เด็กหญิง: "female",
  นางสาว: "female",
  other: "other",
  อื่นๆ: "other",
};

function normalizeGender(value) {
  const key = text(value).toLowerCase();
  if (!key) return null;
  return GENDERS[key] || undefined; // undefined = present but unknown
}

// Accepts 2026-05-31, 31/05/2569 (Buddhist year) or 31/05/2026.
function normalizeBirthDate(value) {
  const raw = text(value);
  if (!raw) return null;
  let year;
  let month;
  let day;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) [, year, month, day] = match;
  else {
    match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (!match) return undefined;
    [, day, month, year] = match;
  }
  year = Number(year);
  if (year > 2400) year -= 543;
  const date = new Date(Date.UTC(year, Number(month) - 1, Number(day)));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    year < 1900 ||
    date > new Date()
  )
    return undefined;
  return date.toISOString().slice(0, 10);
}

function buildUsername(schoolCode, studentCode) {
  const username = `${text(schoolCode)}${text(studentCode)}`
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
  return USERNAME_PATTERN.test(username) ? username : null;
}

// Normalizes one spreadsheet row and lists everything wrong with it. The
// grade, classroom and type are resolved against the school later.
function prepareImportRow(raw = {}, { schoolCode } = {}) {
  const errors = [];
  const row = {
    status:
      raw.status == null || raw.status === ""
        ? null
        : require("./studentStatus").normalizeStudentStatus(raw.status),
    student_code: text(raw.student_code),
    prefix: text(raw.prefix) || null,
    first_name: text(raw.first_name),
    last_name: text(raw.last_name),
    nickname: text(raw.nickname) || null,
    grade: text(raw.grade),
    classroom: text(raw.classroom),
    student_type: text(raw.student_type) || null,
    gender: normalizeGender(raw.gender),
    birth_date: normalizeBirthDate(raw.birth_date),
    national_id: null,
    username: text(raw.username).toLowerCase() || null,
    email: text(raw.email).toLowerCase() || null,
    initial_password:
      raw.initial_password == null || raw.initial_password === ""
        ? null
        : String(raw.initial_password),
    is_boarder:
      raw.is_boarder == null || raw.is_boarder === ""
        ? null
        : ["1", "true", "ใช่", "หอพัก"].includes(
              text(raw.is_boarder).toLowerCase(),
            )
          ? 1
          : ["0", "false", "ไม่ใช่", "ไปกลับ"].includes(
                text(raw.is_boarder).toLowerCase(),
              )
            ? 0
            : undefined,
  };

  if (raw.status && !row.status) errors.push("สถานะนักเรียนไม่ถูกต้อง");
  if (
    row.email &&
    (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || row.email.length > 254)
  )
    errors.push("อีเมลไม่ถูกต้อง");
  if (row.initial_password && !isStrongPassword(row.initial_password))
    errors.push("รหัสผ่านตั้งต้นไม่ผ่านนโยบายรหัสผ่าน");
  if (row.is_boarder === undefined)
    errors.push("สถานะหอพักไม่ถูกต้อง (ใช่/ไม่ใช่)");
  if (!row.student_code) errors.push("ไม่มีรหัสนักเรียน");
  else if (!STUDENT_CODE_PATTERN.test(row.student_code))
    errors.push("รหัสนักเรียนมีอักขระที่ไม่รองรับ (ไม่เกิน 32 ตัว)");
  for (const [field, label] of [
    ["first_name", "ชื่อ"],
    ["last_name", "นามสกุล"],
  ]) {
    const checked = validatePersonName(row[field], label);
    if (checked.error) errors.push(checked.error);
    else row[field] = checked.value;
  }
  if (!row.grade) errors.push("ไม่มีชั้นปี");
  if (!row.classroom) errors.push("ไม่มีห้องเรียน");
  if (row.gender === undefined) {
    errors.push("เพศไม่ถูกต้อง (ชาย/หญิง)");
    row.gender = null;
  }
  if (row.birth_date === undefined) {
    errors.push("วันเกิดไม่ถูกต้อง (เช่น 31/05/2555)");
    row.birth_date = null;
  }
  const rawId = text(raw.national_id);
  if (rawId) {
    row.national_id = normalizeNationalId(rawId);
    if (!row.national_id) errors.push("เลขบัตรประชาชนไม่ถูกต้อง");
  }
  if (row.username) {
    if (!USERNAME_PATTERN.test(row.username))
      errors.push(
        "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษตัวเล็ก ตัวเลข . _ - ยาว 3-80 ตัว",
      );
  } else if (row.student_code) {
    row.username = buildUsername(schoolCode, row.student_code);
    if (!row.username)
      errors.push("สร้างชื่อผู้ใช้จากรหัสนักเรียนไม่ได้ กรุณาระบุ username");
  }
  return { row, errors };
}

const PASSWORD_SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%*?-+",
];

// 12 characters from unambiguous sets (no 0/O, 1/l/I), at least one of each.
function generateTemporaryPassword(length = 12) {
  const all = PASSWORD_SETS.join("");
  for (;;) {
    const chars = PASSWORD_SETS.map((set) => set[crypto.randomInt(set.length)]);
    while (chars.length < length) chars.push(all[crypto.randomInt(all.length)]);
    for (let i = chars.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    const password = chars.join("");
    if (isStrongPassword(password)) return password;
  }
}

module.exports = {
  MAX_IMPORT_ROWS,
  USERNAME_PATTERN,
  buildUsername,
  normalizeBirthDate,
  normalizeGender,
  prepareImportRow,
  generateTemporaryPassword,
};
