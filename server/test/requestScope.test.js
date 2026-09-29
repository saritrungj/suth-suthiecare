const test = require("node:test");
const assert = require("node:assert/strict");
const { needsOrganizationContext } = require("../authorization/requestScope");

test("dashboard statistic endpoint requires an active organization context", () => {
  assert.equal(
    needsOrganizationContext("/admin/master-cases/stats", true),
    true,
  );
  assert.equal(needsOrganizationContext("/dashboard/recent", true), true);
});

test("public form submission does not require an organization context", () => {
  assert.equal(needsOrganizationContext("/forms/12/submit", false), false);
});

test("help-center reads use the active organization when staff is signed in", () => {
  assert.equal(
    needsOrganizationContext("/admin/help-center/public/faqs", true),
    true,
  );
  assert.equal(
    needsOrganizationContext("/admin/help-center/public/faqs", false),
    false,
  );
});

test("agency entry endpoints do not use the system organization context", () => {
  assert.equal(needsOrganizationContext("/agency-entry/masters", true), false);
});
