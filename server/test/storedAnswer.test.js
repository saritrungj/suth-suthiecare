const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeStoredAnswer } = require("../utils/storedAnswer");

test("keeps MySQL-decoded scalar JSON answers instead of replacing them", () => {
  assert.equal(normalizeStoredAnswer("นาย", "คำนำหน้า"), "นาย");
  assert.equal(normalizeStoredAnswer("\"ชั้นปีที่ 4\"", "ชั้นปีที่"), "ชั้นปีที่ 4");
});

test("decrypts sensitive scalar answers after normalizing JSON storage", () => {
  const decrypt = (value) => (value === "ciphertext" ? "สมชาย ใจดี" : value);
  assert.equal(
    normalizeStoredAnswer("ciphertext", "ชื่อ-สกุล", decrypt),
    "สมชาย ใจดี",
  );
});

test("preserves array and object answers", () => {
  assert.deepEqual(normalizeStoredAnswer(["ตัวเลือก 1"]), ["ตัวเลือก 1"]);
  assert.deepEqual(normalizeStoredAnswer({ 0: "ไม่มีเลย" }), { 0: "ไม่มีเลย" });
});

