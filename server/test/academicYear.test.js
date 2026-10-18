const test = require("node:test");
const assert = require("node:assert/strict");
const {
  currentAcademicYear,
  validAcademicYear,
} = require("../utils/academicYear");
test("Thai academic year rolls over in May in Bangkok, independent of host timezone", () => {
  assert.equal(currentAcademicYear(new Date("2026-04-30T16:59:59Z")), 2568);
  assert.equal(currentAcademicYear(new Date("2026-04-30T17:00:00Z")), 2569);
});
test("academic year allows exactly ten past years and future four-digit years", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  assert.equal(validAcademicYear(2559, now), true);
  assert.equal(validAcademicYear(2558, now), false);
  assert.equal(validAcademicYear(2570, now), true);
  assert.equal(validAcademicYear(2800, now), true);
  for (const year of ["", "2569x", 2569.5, 10000, null])
    assert.equal(validAcademicYear(year, now), false);
});
