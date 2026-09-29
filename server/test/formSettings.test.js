const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isFormOpenForSubmission,
  normalizeLoginEnforcement,
  normalizeResultDisplayMode,
  requiresAuthenticatedSubmission,
} = require("../utils/formSettings");

test("only published forms inside their publish window accept submissions", () => {
  const now = new Date("2026-09-15T10:00:00+07:00");
  assert.equal(isFormOpenForSubmission({ status: "draft" }, now), false);
  assert.equal(isFormOpenForSubmission({ status: "published" }, now), true);
  assert.equal(
    isFormOpenForSubmission(
      { status: "published", publish_start_date: "2026-09-16 00:00:00" },
      now,
    ),
    false,
  );
  assert.equal(
    isFormOpenForSubmission(
      { status: "published", publish_end_date: "2026-09-14 23:59:59" },
      now,
    ),
    false,
  );
  assert.equal(
    isFormOpenForSubmission(
      {
        status: "published",
        publish_start_date: "2026-09-01 00:00:00",
        publish_end_date: "2026-09-30 23:59:59",
      },
      now,
    ),
    true,
  );
});

test("only public forms accept a guest submission", () => {
  assert.equal(requiresAuthenticatedSubmission("strict"), true);
  assert.equal(requiresAuthenticatedSubmission("optional"), true);
  assert.equal(requiresAuthenticatedSubmission("none"), false);
});

test("form settings safely fall back for legacy or malformed values", () => {
  assert.equal(normalizeLoginEnforcement("unknown"), "none");
  assert.equal(normalizeResultDisplayMode("unknown"), "realtime");
});
