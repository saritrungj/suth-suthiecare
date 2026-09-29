const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CHECKUP_FIELDS, readAgencySchema, validateCheckupRange } = require("../agency/checkupSchema");

test("health checkup definition survives JSON persistence with its form type", () => {
  const result = readAgencySchema(JSON.stringify({ form_type: "health_checkup", fields: CHECKUP_FIELDS }));
  assert.equal(result.form_type, "health_checkup");
  assert.deepEqual(result.fields.filter((field) => field.required).map((field) => field.id), ["first_name", "last_name"]);
  assert.equal(new Set(result.fields.map((field) => field.id)).size, result.fields.length);
});

test("existing typed checkup schema gains end date without losing historical dates", () => {
  const fields = CHECKUP_FIELDS.filter(field => field.id !== "checkup_end_date");
  const result = readAgencySchema({ form_type: "health_checkup", fields });
  assert.equal(result.fields.filter(field => field.id === "checkup_end_date").length, 1);
  assert.equal(fields.length, CHECKUP_FIELDS.length - 1);
});

test("checkup range rejects reversed and impossible dates; historical single dates remain valid", () => {
  const validate = data => validateCheckupRange(CHECKUP_FIELDS, data);
  assert.deepEqual(validate({}), {});
  assert.deepEqual(validate({ checkup_date: "2026-09-01" }), {});
  assert.deepEqual(validate({ checkup_date: "2026-09-01", checkup_end_date: "2026-09-30" }), {});
  assert.ok(validate({ checkup_date: "2026-09-30", checkup_end_date: "2026-09-01" }).checkup_end_date);
  assert.ok(validate({ checkup_date: "2026-02-30" }).checkup_date);
  assert.ok(validate({ checkup_end_date: "2026-09-01" }).checkup_date);
});
test("existing array schemas retain all fields without a migration", () => {
  const legacy = [{ id: "name", type: "text" }];
  assert.deepEqual(readAgencySchema(legacy), { form_type: "custom", fields: legacy });
  assert.deepEqual(readAgencySchema(JSON.stringify(legacy)).fields, legacy);
});
