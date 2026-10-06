const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildUsername,
  normalizeBirthDate,
  normalizeGender,
  prepareImportRow,
  generateTemporaryPassword,
} = require("../utils/studentImport");
const { isStrongPassword } = require("../utils/passwordPolicy");

const thaiId = (prefix) => {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(prefix[i]) * (13 - i);
  return `${prefix}${(11 - (sum % 11)) % 10}`;
};

const validRow = {
  student_code: "65001",
  prefix: "ด.ช.",
  first_name: " สมชาย ",
  last_name: "ใจดี",
  grade: "ม.1",
  classroom: "1/1",
  gender: "ชาย",
  birth_date: "31/05/2555",
};

test("builds the username from the school code and student code", () => {
  assert.equal(buildUsername("SUT01", "65001"), "sut0165001");
  assert.equal(buildUsername("SUT01", "65/001"), "sut0165001");
  assert.equal(buildUsername("", "ก"), null);
});

test("reads Thai and Gregorian birth dates and Thai gender words", () => {
  assert.equal(normalizeBirthDate("31/05/2555"), "2012-05-31");
  assert.equal(normalizeBirthDate("2012-05-31"), "2012-05-31");
  assert.equal(normalizeBirthDate("31/02/2555"), undefined);
  assert.equal(normalizeBirthDate(""), null);
  assert.equal(normalizeGender("หญิง"), "female");
  assert.equal(normalizeGender("M"), "male");
  assert.equal(normalizeGender("ไม่ทราบ"), undefined);
});

test("prepares a valid row and generates its username", () => {
  const { row, errors } = prepareImportRow(validRow, { schoolCode: "SUT01" });
  assert.deepEqual(errors, []);
  assert.equal(row.first_name, "สมชาย");
  assert.equal(row.gender, "male");
  assert.equal(row.birth_date, "2012-05-31");
  assert.equal(row.username, "sut0165001");
  assert.equal(row.national_id, null);
});

test("lists every problem of an invalid row", () => {
  const { errors } = prepareImportRow(
    {
      student_code: "",
      first_name: "",
      last_name: "ใจดี",
      grade: "",
      classroom: "1/1",
      gender: "ไม่ทราบ",
      birth_date: "99/99/9999",
      national_id: "1234567890123",
    },
    { schoolCode: "SUT01" },
  );
  assert.ok(errors.includes("ไม่มีรหัสนักเรียน"));
  assert.ok(errors.some((e) => e.startsWith("ชื่อ")));
  assert.ok(errors.includes("ไม่มีชั้นปี"));
  assert.ok(errors.some((e) => e.startsWith("เพศ")));
  assert.ok(errors.some((e) => e.startsWith("วันเกิด")));
  assert.ok(errors.includes("เลขบัตรประชาชนไม่ถูกต้อง"));
});

test("keeps a valid national ID digits-only and an explicit username", () => {
  const id = thaiId("110170023070");
  const { row, errors } = prepareImportRow(
    {
      ...validRow,
      national_id: `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`,
      username: "Somchai.J",
    },
    { schoolCode: "SUT01" },
  );
  assert.deepEqual(errors, []);
  assert.equal(row.national_id, id);
  assert.equal(row.username, "somchai.j");
});

test("temporary passwords always satisfy the password policy", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const password = generateTemporaryPassword();
    assert.equal(password.length, 12);
    assert.ok(isStrongPassword(password), password);
    assert.doesNotMatch(password, /[0O1lI]/);
    seen.add(password);
  }
  assert.ok(seen.size > 195);
});
