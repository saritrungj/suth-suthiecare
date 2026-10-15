const test = require("node:test");
const assert = require("node:assert/strict");
const { firstNameOf, lastNameOf, requirePii } = require("../utils/caseFirstName");

test("extracts only the first name from a display name", () => {
  assert.equal(firstNameOf("นาย สมชาย ใจดี"), "สมชาย");
  assert.equal(firstNameOf("นางสาวปวีณา รักษ์ดี"), "ปวีณา");
  assert.equal(firstNameOf("ด.ช. สมชาย ใจดี"), "สมชาย");
  assert.equal(firstNameOf("Ms. Jane Smith"), "Jane");
  assert.equal(firstNameOf("<b>ปิติ</b>&nbsp;วงศ์ดี"), "ปิติ");
});

test("structured first names keep their spelling without consuming a title-like prefix", () => {
  assert.equal(firstNameOf("นางน้อย", true), "นางน้อย");
  assert.equal(firstNameOf("Jean Pierre", true), "Jean Pierre");
});

test("missing or already masked names cannot be revealed", () => {
  for (const value of [null, "", "-", "ส***", "•••"]) assert.equal(firstNameOf(value), null);
});

test("revealing requires the existing PII permission even for case viewers", () => {
  let passed = false;
  let status;
  let body;
  const res = { status: (value) => { status = value; return res; }, json: (value) => { body = value; } };
  requirePii({ authorization: { permissions: new Set(["cases.view"]) } }, res, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(status, 403);
  assert.deepEqual(body, { code: "PII_PERMISSION_REQUIRED" });
  requirePii({ authorization: { permissions: new Set(["pii.view"]) } }, res, () => { passed = true; });
  assert.equal(passed, true);
  passed = false;
  requirePii({ authorization: { isSystemAdmin: true } }, res, () => { passed = true; });
  assert.equal(passed, true);
});

test("surname extraction excludes titles and first names", () => {
  assert.equal(lastNameOf("นาย สมชาย ใจดี"), "ใจดี");
  assert.equal(lastNameOf("Ms. Jane van Smith"), "van Smith");
  assert.equal(lastNameOf("สมชาย"), null);
  assert.equal(lastNameOf("นางน้อย", true), "นางน้อย");
  assert.equal(lastNameOf("ส***"), null);
});
