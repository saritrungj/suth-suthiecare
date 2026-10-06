require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { definitions, changesFor } = require("../scripts/backfillPrivateData");
const { openJson, readJson } = require("../utils/privateData");
test.after(() => require("../config/db").end());
test("migration keeps types, is idempotent, quarantines missing owners, and does not clear by default", () => {
  const answers = definitions.find((item) => item.table === "form_answers"),
    row = {
      owner_id: 7,
      question_title: "generic",
      answer_value: { a: 0, b: false, c: null, d: [1, 2] },
    };
  const changes = changesFor(answers, row);
  assert.deepEqual(
    openJson(
      JSON.parse(changes.answer_value),
      "form_answers:answer_value:org:7",
    ),
    row.answer_value,
  );
  assert.deepEqual(
    changesFor(answers, { ...row, answer_value: changes.answer_value }),
    {},
  );
  assert.throws(() => changesFor(answers, { ...row, owner_id: null }), {
    code: "OWNER_UNRESOLVED",
  });
  const health = definitions.find(
      (item) => item.table === "school_student_physical_records",
    ),
    vitals = {
      owner_id: 7,
      weight_kg: 0,
      height_cm: null,
      bmi: null,
      hearing_left: "not_tested",
      hearing_right: "normal",
    };
  const payload = changesFor(health, vitals);
  assert.equal(payload.weight_kg, undefined);
  assert.equal(
    readJson(
      payload.measurements_encrypted,
      "school_student_physical_records:measurements:org:7",
    ).weight_kg,
    0,
  );
  assert.equal(
    changesFor(health, { ...vitals, ...payload }, { clearLegacy: true })
      .weight_kg,
    null,
  );
});
