const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePersonName } = require("../utils/patientValidation");
const { extractExistingPhone } = require("../utils/patientHistoryProfile");

test("accepts and normalises Thai patient names", () => {
  assert.deepEqual(validatePersonName("  สมชาย  ", "ชื่อ"), {
    value: "สมชาย",
  });
  assert.deepEqual(validatePersonName("ใจดี-ทดสอบ", "นามสกุล"), {
    value: "ใจดี-ทดสอบ",
  });
});

test("rejects empty, overly long, and unsafe patient names", () => {
  assert.match(validatePersonName("", "ชื่อ").error, /1-100/);
  assert.match(validatePersonName("ก".repeat(101), "ชื่อ").error, /1-100/);
  assert.match(validatePersonName("<script>", "ชื่อ").error, /ไม่รองรับ/);
});

test("finds a legacy patient phone from assessment history", () => {
  assert.equal(
    extractExistingPhone([
      { summary_data: JSON.stringify({ phone: "invalid" }) },
      {
        summary_data: {
          raw_answers: { "เบอร์โทรศัพท์": "081-234-5678" },
        },
      },
    ]),
    "0812345678",
  );
});

test("does not return an invalid historical phone", () => {
  assert.equal(
    extractExistingPhone([{ summary_data: { display_phone: "021234567" } }]),
    null,
  );
});
