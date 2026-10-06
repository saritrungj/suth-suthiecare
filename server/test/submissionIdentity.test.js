const test = require("node:test");
const assert = require("node:assert/strict");
const {
  resolveSubmissionOwner,
  resolveGuestSubmissionOwner,
} = require("../utils/submissionIdentity");
const { nationalIdHash } = require("../utils/personIdentity");

// A checksum-valid Thai national ID built from 12 digits.
const thaiId = (prefix) => {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(prefix[i]) * (13 - i);
  return `${prefix}${(11 - (sum % 11)) % 10}`;
};

// Answers queries by the first matching prefix/substring rule and records calls.
function fakeConnection(rules) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      const rule = rules.find(([match]) =>
        typeof match === "function" ? match(sql) : sql.includes(match),
      );
      if (!rule) throw new Error(`Unexpected SQL: ${sql}`);
      return typeof rule[1] === "function" ? rule[1](params) : rule[1];
    },
  };
}

test("creates a person and an account-owned Master Case for a new account", async () => {
  const connection = fakeConnection([
    [
      "FROM patient_accounts WHERE id = ? FOR UPDATE",
      [[{ id: 42, identity_hash: null }]],
    ],
    ["FROM persons WHERE patient_account_id", [[]]],
    ["INSERT INTO persons", [{ insertId: 9 }]],
    ["FROM mastercases WHERE person_id", [[]]],
    ["FROM mastercases WHERE patient_account_id", [[]]],
    ["INSERT INTO mastercases", [{ insertId: 701 }]],
  ]);

  const owner = await resolveSubmissionOwner({
    connection,
    patientAccountId: 42,
    clinicType: "general",
    organizationId: 1,
  });
  assert.deepEqual(owner, {
    masterCaseId: 701,
    personId: 9,
    patientAccountId: 42,
    identityHash: null,
    source: "created",
  });
  assert.deepEqual(connection.calls.at(-1).params, [9, 42, null, "general", 1]);
});

test("adopts an unlinked legacy Master Case with the account identity hash", async () => {
  const connection = fakeConnection([
    [
      "FROM patient_accounts WHERE id = ? FOR UPDATE",
      [[{ id: 42, identity_hash: "hash" }]],
    ],
    ["FROM persons WHERE", [[]]],
    ["INSERT INTO persons", [{ insertId: 9 }]],
    ["FROM mastercases WHERE person_id", [[]]],
    ["FROM mastercases WHERE patient_account_id", [[]]],
    [
      "FROM mastercases WHERE identity_hash",
      [[{ id: 55, identity_hash: "hash" }]],
    ],
    ["UPDATE mastercases", [{}]],
  ]);

  const owner = await resolveSubmissionOwner({
    connection,
    patientAccountId: 42,
    clinicType: "general",
    organizationId: 1,
  });
  assert.equal(owner.masterCaseId, 55);
  assert.equal(owner.source, "legacy-backfill");
  assert.deepEqual(connection.calls.at(-1).params, [9, 42, "hash", 55]);
});

test("a guest with a consented national ID returns to the same person's open case", async () => {
  const id = thaiId("110170023070");
  const hash = nationalIdHash(id);
  const connection = fakeConnection([
    [
      "FROM persons WHERE identity_hash",
      (params) => {
        assert.equal(params[0], hash);
        return [
          [
            {
              id: 7,
              patient_account_id: null,
              identity_hash: hash,
              identity_value_encrypted: "x",
            },
          ],
        ];
      },
    ],
    ["FROM mastercases WHERE person_id", [[{ id: 88, identity_hash: hash }]]],
  ]);

  const owner = await resolveGuestSubmissionOwner({
    connection,
    nationalId: id,
    clinicType: "teenager",
    organizationId: 1,
  });
  assert.equal(owner.masterCaseId, 88);
  assert.equal(owner.personId, 7);
  assert.equal(owner.patientAccountId, null);
});

test("a guest without a national ID stays anonymous", async () => {
  const connection = fakeConnection([
    ["INSERT INTO mastercases", [{ insertId: 300 }]],
  ]);
  const owner = await resolveGuestSubmissionOwner({
    connection,
    clinicType: "general",
    organizationId: 1,
  });
  assert.deepEqual(owner, {
    masterCaseId: 300,
    personId: null,
    patientAccountId: null,
    identityHash: null,
    source: "guest",
  });
});

test("refuses a national ID that already belongs to another account", async () => {
  const connection = fakeConnection([
    [
      "FROM patient_accounts WHERE id = ? FOR UPDATE",
      [[{ id: 42, identity_hash: null }]],
    ],
    ["FROM patient_accounts WHERE identity_hash", [[{ id: 99 }]]],
  ]);
  await assert.rejects(
    resolveSubmissionOwner({
      connection,
      patientAccountId: 42,
      nationalId: thaiId("110170023070"),
      clinicType: "general",
      organizationId: 1,
    }),
    (error) => error.status === 409 && error.code === "IDENTITY_CONFLICT",
  );
});
