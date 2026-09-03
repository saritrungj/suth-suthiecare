const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveSubmissionOwner } = require("../utils/submissionIdentity");

test("creates an account-owned Master Case without an identity hash", async () => {
  const calls = [];
  const connection = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT id FROM patient_accounts")) return [[{ id: 42 }]];
    if (sql.startsWith("SELECT id, identity_hash FROM mastercases")) return [[]];
    if (sql.startsWith("INSERT INTO mastercases")) return [{ insertId: 701 }];
    throw new Error(`Unexpected SQL: ${sql}`);
  }};

  const owner = await resolveSubmissionOwner({ connection, patientAccountId: 42, clinicType: "general" });
  assert.deepEqual(owner, { masterCaseId: 701, patientAccountId: 42, identityHash: null, source: "created" });
  assert.deepEqual(calls.at(-1).params, [42, null, "general"]);
});

test("adopts only an unlinked legacy Master Case with the same identity hash", async () => {
  const calls = [];
  const connection = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT id FROM patient_accounts")) return [[{ id: 42 }]];
    if (sql.includes("patient_account_id = ?")) return [[]];
    if (sql.includes("patient_account_id IS NULL")) return [[{ id: 55, identity_hash: "hash" }]];
    if (sql.startsWith("UPDATE mastercases")) return [{}];
    throw new Error(`Unexpected SQL: ${sql}`);
  }};

  const owner = await resolveSubmissionOwner({ connection, patientAccountId: 42, accountIdentityHash: "hash", clinicType: "general" });
  assert.deepEqual(owner, { masterCaseId: 55, patientAccountId: 42, identityHash: "hash", source: "legacy-backfill" });
  assert.deepEqual(calls.at(-1).params, [42, 55]);
});
