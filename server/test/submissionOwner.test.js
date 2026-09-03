const test = require("node:test");
const assert = require("node:assert/strict");
const { submittedBy } = require("../utils/submissionOwner");

test("labels old records without an account as legacy and unlinked", () => {
  assert.deepEqual(submittedBy({ patient_account_id: null }), { status: "legacy_unlinked" });
});

test("does not expose an account as linked when its record has been deleted", () => {
  assert.deepEqual(submittedBy({ patient_account_id: 42 }), {
    status: "account_deleted",
    account_id: 42,
    username: null,
    display_name: null,
  });
});
