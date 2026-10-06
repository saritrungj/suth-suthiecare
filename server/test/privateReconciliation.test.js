require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { definitions, changesFor } = require("../scripts/backfillPrivateData");
const { optionUsage } = require("../utils/formOptionUsage");
const { sealJson, fieldContext } = require("../utils/privateData");
const { serialize } = require("../utils/privateDto");
test.after(() => require("../config/db").end());
test("cleanup quarantines legacy changes made after the encrypted backfill", () => {
  const def = definitions.find(
    (v) => v.table === "school_student_physical_records",
  );
  const original = { owner_id: 1, weight_kg: 45, height_cm: 150 };
  const encoded = changesFor(def, original);
  assert.throws(
    () =>
      changesFor(
        def,
        { ...original, ...encoded, weight_kg: 46 },
        { clearLegacy: true },
      ),
    { code: "RECONCILIATION_MISMATCH" },
  );
  const emails = definitions.find((v) => v.table === "users");
  const data = { email: "synthetic@example.test" };
  const protectedEmail = changesFor(emails, data);
  assert.throws(
    () =>
      changesFor(
        emails,
        { ...data, ...protectedEmail, email: "changed@example.test" },
        { clearLegacy: true },
      ),
    { code: "RECONCILIATION_MISMATCH" },
  );
  assert.throws(() =>
    changesFor(definitions[0], { owner_id: 1, summary_data: "invalid JSON" }),
  );
});
test("quota aggregation decrypts scoped answers and only exposes server-defined options", () => {
  const encoded = (v) =>
    sealJson(v, fieldContext("form_answers", "answer_value", 1));
  const rows = [
    {
      question_id: "choice",
      answer_value: encoded(["A", "A", "B"]),
      organization_id: 1,
    },
    { question_id: "choice", answer_value: encoded("A"), organization_id: 1 },
    {
      question_id: "name",
      answer_value: encoded("private-name"),
      organization_id: 1,
    },
  ];
  const usage = optionUsage(
    [
      { id: "choice", options: ["A", "B"], optionLimits: [2, 2] },
      { id: "name", options: [], type: "text" },
    ],
    rows,
  );
  assert.deepEqual({ ...usage.choice }, { A: 2, B: 1 });
  assert.equal(usage.name, undefined);
  assert.throws(
    () =>
      optionUsage(
        [{ id: "choice", options: ["A"], optionLimits: [2] }],
        [{ ...rows[1], organization_id: 2 }],
      ),
    { code: "CIPHERTEXT_CONTEXT_MISMATCH" },
  );
});
test("lists minimize PII and full answers preserve literal envelope-looking strings", () => {
  const answer = {
    literal: "suthenc:v2:literal",
    object: { __enc: "user-defined-marker" },
    zero: 0,
    checked: false,
  };
  const row = {
    id: 1,
    summary_data: sealJson(
      { display_name: "Synthetic Name", raw_answers: answer },
      "form_responses:summary_data:org:1",
    ),
  };
  const full = serialize(row, { pii: true, clinical: true });
  assert.deepEqual(full.summary_data.raw_answers, answer);
  const list = serialize(row, { pii: true, clinical: true, list: true });
  assert.equal(list.summary_data.display_name, "S***");
  assert.equal(list.summary_data.raw_answers, undefined);
});
