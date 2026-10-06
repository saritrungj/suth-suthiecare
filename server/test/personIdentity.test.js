const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeNationalId,
  nationalIdHash,
  resolvePerson,
} = require("../utils/personIdentity");

const thaiId = (prefix) => {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(prefix[i]) * (13 - i);
  return `${prefix}${(11 - (sum % 11)) % 10}`;
};

function fakeConnection(rules) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      const rule = rules.find(([match]) => sql.includes(match));
      if (!rule) throw new Error(`Unexpected SQL: ${sql}`);
      return typeof rule[1] === "function" ? rule[1](params) : rule[1];
    },
  };
}

test("normalizes a dashed national ID and rejects a bad checksum", () => {
  const id = thaiId("310150012345");
  const dashed = `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`;
  assert.equal(normalizeNationalId(dashed), id);
  assert.equal(nationalIdHash(dashed), nationalIdHash(id));
  const wrong = `${id.slice(0, 12)}${(Number(id[12]) + 1) % 10}`;
  assert.equal(normalizeNationalId(wrong), null);
  assert.equal(normalizeNationalId("123"), null);
});

test("an account without an ID adopts the consented national ID", async () => {
  const id = thaiId("310150012345");
  const connection = fakeConnection([
    [
      "FROM patient_accounts WHERE id = ? FOR UPDATE",
      [[{ id: 5, identity_hash: null }]],
    ],
    ["FROM patient_accounts WHERE identity_hash", [[]]],
    ["UPDATE patient_accounts SET identity_hash", [{}]],
    ["FROM persons WHERE patient_account_id", [[]]],
    ["FROM persons WHERE identity_hash", [[]]],
    ["INSERT INTO persons", [{ insertId: 12 }]],
  ]);
  const person = await resolvePerson({
    connection,
    patientAccountId: 5,
    nationalId: id,
  });
  assert.equal(person.personId, 12);
  assert.equal(person.identityHash, nationalIdHash(id));
  const update = connection.calls.find((call) =>
    call.sql.startsWith("UPDATE patient_accounts"),
  );
  assert.deepEqual(update.params, [nationalIdHash(id), 5]);
});

test("the account's own ID wins over a different ID typed into the form", async () => {
  const connection = fakeConnection([
    [
      "FROM patient_accounts WHERE id = ? FOR UPDATE",
      [[{ id: 5, identity_hash: "account-hash" }]],
    ],
    [
      "FROM persons WHERE patient_account_id",
      [[{ id: 3, patient_account_id: 5, identity_hash: "account-hash" }]],
    ],
    [
      "FROM persons WHERE identity_hash",
      (params) => {
        assert.equal(params[0], "account-hash");
        return [
          [{ id: 3, patient_account_id: 5, identity_hash: "account-hash" }],
        ];
      },
    ],
  ]);
  const person = await resolvePerson({
    connection,
    patientAccountId: 5,
    nationalId: thaiId("310150012345"),
  });
  assert.equal(person.personId, 3);
  assert.equal(person.identityHash, "account-hash");
});

test("merges a guest person into the account person with the same ID", async () => {
  const connection = fakeConnection([
    [
      "FROM patient_accounts WHERE id = ? FOR UPDATE",
      [[{ id: 5, identity_hash: "h" }]],
    ],
    [
      "FROM persons WHERE patient_account_id",
      [[{ id: 3, patient_account_id: 5, identity_hash: null }]],
    ],
    [
      "FROM persons WHERE identity_hash",
      [[{ id: 8, patient_account_id: null, identity_hash: "h" }]],
    ],
    ["UPDATE form_responses SET person_id", [{}]],
    ["UPDATE mastercases SET person_id", [{}]],
    ["UPDATE school_students SET person_id", [{}]],
    ["merged_into_person_id = ?", [{}]],
    ["UPDATE persons SET patient_account_id = ?, identity_hash = ?", [{}]],
  ]);
  const person = await resolvePerson({ connection, patientAccountId: 5 });
  assert.equal(person.personId, 3);
  assert.equal(person.source, "merged");
  const moved = connection.calls.find((call) =>
    call.sql.startsWith("UPDATE form_responses SET person_id"),
  );
  assert.deepEqual(moved.params, [3, 8]);
});

test("a guest without a national ID has no person", async () => {
  const connection = fakeConnection([]);
  const person = await resolvePerson({ connection });
  assert.equal(person.personId, null);
  assert.equal(connection.calls.length, 0);
});
