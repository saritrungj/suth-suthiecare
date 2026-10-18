const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SCHOOL_ROLE_LABELS,
  TEACHER_ROLE_CODES,
  STAFF_ROLE_CODES,
  roleMatchesKind,
} = require("../utils/schoolStaffRoles");

test("every school duty is either a teacher or a staff duty", () => {
  for (const code of Object.keys(SCHOOL_ROLE_LABELS))
    assert.ok(TEACHER_ROLE_CODES.has(code) !== STAFF_ROLE_CODES.has(code));
});

test("duties follow the personnel kind", () => {
  assert.equal(roleMatchesKind("counselor", "teacher"), true);
  assert.equal(roleMatchesKind("counselor", "staff"), false);
  assert.equal(roleMatchesKind("dorm_staff", "staff"), true);
  assert.equal(roleMatchesKind("dorm_staff", "teacher"), false);
  assert.equal(roleMatchesKind("guardian", "staff"), false);
});
