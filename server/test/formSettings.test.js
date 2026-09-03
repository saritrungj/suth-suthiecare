const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeLoginEnforcement,
  normalizeResultDisplayMode,
  requiresAuthenticatedSubmission,
} = require("../utils/formSettings");

test("only public forms accept a guest submission", () => {
  assert.equal(requiresAuthenticatedSubmission("strict"), true);
  assert.equal(requiresAuthenticatedSubmission("optional"), true);
  assert.equal(requiresAuthenticatedSubmission("none"), false);
});

test("form settings safely fall back for legacy or malformed values", () => {
  assert.equal(normalizeLoginEnforcement("unknown"), "none");
  assert.equal(normalizeResultDisplayMode("unknown"), "realtime");
});
