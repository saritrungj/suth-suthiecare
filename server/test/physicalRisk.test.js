const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateRule,
  ruleMatches,
  ageOn,
  applies,
} = require("../services/physicalRisk");

const base = { metric: "bmi", label: "BMI สูงกว่าเกณฑ์ (ตัวอย่าง)" };

test("rules need a metric, a comparator and the thresholds it uses", () => {
  assert.ok(validateRule({ ...base, comparator: "gt" }).error);
  assert.ok(
    validateRule({ ...base, comparator: "nope", threshold_high: 1 }).error,
  );
  assert.ok(
    validateRule({
      ...base,
      metric: "vision",
      comparator: "gt",
      threshold_high: 1,
    }).error,
  );
  assert.ok(
    validateRule({
      ...base,
      comparator: "outside",
      threshold_low: 30,
      threshold_high: 20,
    }).error,
  );
  assert.ok(
    validateRule({
      ...base,
      comparator: "gt",
      threshold_high: 25,
      age_min: 15,
      age_max: 12,
    }).error,
  );
  assert.ok(
    validateRule({ ...base, comparator: "gt", threshold_high: 25, label: " " })
      .error,
  );
  assert.ok(
    validateRule({
      ...base,
      comparator: "gt",
      threshold_high: 25,
      follow_up_days: 0,
    }).error,
  );
  const ok = validateRule({
    ...base,
    comparator: "gt",
    threshold_low: 5,
    threshold_high: "25",
    follow_up_days: "30",
  });
  assert.equal(ok.error, undefined);
  // The unused threshold is dropped.
  assert.equal(ok.value.threshold_low, null);
  assert.equal(ok.value.threshold_high, 25);
  assert.equal(ok.value.follow_up_days, 30);
});

test("comparators compare with the right threshold", () => {
  const rule = (comparator, low, high) => ({
    comparator,
    threshold_low: low,
    threshold_high: high,
  });
  assert.equal(ruleMatches(rule("lt", 18.5, null), 18.4), true);
  assert.equal(ruleMatches(rule("lt", 18.5, null), 18.5), false);
  assert.equal(ruleMatches(rule("lte", 18.5, null), 18.5), true);
  assert.equal(ruleMatches(rule("gt", null, 25), 25.1), true);
  assert.equal(ruleMatches(rule("gte", null, 25), 25), true);
  assert.equal(ruleMatches(rule("outside", 60, 100), 59), true);
  assert.equal(ruleMatches(rule("outside", 60, 100), 80), false);
  assert.equal(ruleMatches(rule("gt", null, 25), null), false, "not measured");
});

test("age and sex limits use the measurement date", () => {
  assert.equal(ageOn("2012-10-20", "2026-10-19"), 13);
  assert.equal(ageOn("2012-10-20", "2026-10-20"), 14);
  assert.equal(ageOn(null, "2026-10-20"), null);
  const rule = { sex: "female", age_min: 12, age_max: 14 };
  assert.equal(
    applies(rule, { gender: "female", birth_date: "2012-01-01" }, "2026-06-01"),
    true,
  );
  assert.equal(
    applies(rule, { gender: "male", birth_date: "2012-01-01" }, "2026-06-01"),
    false,
  );
  assert.equal(
    applies(rule, { gender: "female", birth_date: "2010-01-01" }, "2026-06-01"),
    false,
  );
  assert.equal(
    applies(rule, { gender: "female", birth_date: null }, "2026-06-01"),
    false,
    "an age-limited rule never guesses an unknown age",
  );
  assert.equal(
    applies({ sex: null, age_min: null, age_max: null }, {}, "2026-06-01"),
    true,
  );
});
