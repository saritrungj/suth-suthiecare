const test = require("node:test");
const assert = require("node:assert/strict");
const { needsOrganizationContext } = require("../authorization/requestScope");

test("dashboard statistic endpoint requires an active organization context", () => {
  assert.equal(needsOrganizationContext("/admin/master-cases/stats", true), true);
  assert.equal(needsOrganizationContext("/dashboard/recent", true), true);
});

test("public form submission does not require an organization context", () => {
  assert.equal(needsOrganizationContext("/forms/12/submit", false), false);
});
