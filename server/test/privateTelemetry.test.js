const test = require("node:test"),
  assert = require("node:assert/strict");
test("privacy telemetry has bounded dimensions and cannot retain supplied PII or tokens", () => {
  const telemetry = require("../utils/privacyTelemetry");
  telemetry.record("audit_failure");
  telemetry.record("private-name-and-token");
  const result = telemetry.snapshot();
  assert.equal(result.counters.audit_failure, 1);
  assert.deepEqual(Object.keys(result.counters), [
    "decrypt_failure",
    "audit_failure",
    "scope_denial",
    "migration_mismatch",
  ]);
  assert.doesNotMatch(JSON.stringify(result), /private-name-and-token/);
});
