const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeGradeIds,
  roleMatchesKind,
  SCHOOL_ROLE_LABELS,
} = require("../utils/schoolStaffRoles");
const { ROLE_PRESETS } = require("../authorization/rolePresets");
const {
  keysForOrganizationType,
  UNIT_KEYS,
} = require("../authorization/permissionMatrix");

test("counselor grades: undefined keeps, null is the whole school, a list limits", () => {
  assert.deepEqual(normalizeGradeIds(undefined), { value: undefined });
  assert.deepEqual(normalizeGradeIds(null), { value: null });
  assert.deepEqual(normalizeGradeIds([3, "4", 3]), { value: [3, 4] });
  assert.ok(normalizeGradeIds([]).error, "an empty limit is refused");
  assert.ok(normalizeGradeIds([0]).error);
  assert.ok(normalizeGradeIds("1,2").error);
  assert.ok(
    normalizeGradeIds(Array.from({ length: 51 }, (_, i) => i + 1)).error,
  );
});

test("subject teachers are a teacher duty", () => {
  assert.equal(SCHOOL_ROLE_LABELS.subject_teacher, "ครูรายวิชา");
  assert.equal(roleMatchesKind("subject_teacher", "teacher"), true);
  assert.equal(roleMatchesKind("subject_teacher", "staff"), false);
});

test("the supervisor preset holds only overview, report and audit keys", () => {
  const preset = ROLE_PRESETS.supervisor;
  for (const key of preset) assert.ok(UNIT_KEYS.includes(key), key);
  // No per-person data: no pii, clinical, cases, students or health keys.
  assert.ok(
    !preset.some((key) =>
      /^(pii|clinical|cases|students|student_health|student_behavior)\./.test(
        key,
      ),
    ),
  );
  const offered = (type) =>
    preset.filter((key) => keysForOrganizationType(type).has(key)).sort();
  assert.deepEqual(offered("school"), [...preset].sort());
  assert.deepEqual(offered("hospital"), [
    "audit.export",
    "audit.view",
    "dashboard.export",
    "dashboard.view",
  ]);
});
