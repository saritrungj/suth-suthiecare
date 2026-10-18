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

test("school module routes always run inside the active organization", () => {
  assert.equal(needsOrganizationContext("/school/students", false), true);
  assert.equal(needsOrganizationContext("/school/access", true), true);
});

test("result image management needs an organization, the public lookup does not", () => {
  assert.equal(needsOrganizationContext("/admin/result-images", false), true);
  assert.equal(
    needsOrganizationContext("/admin/result-images/high", true),
    true,
  );
  assert.equal(
    needsOrganizationContext("/result-images/forms/12", false),
    false,
  );
});
