import test from "node:test";
import assert from "node:assert/strict";
import {
  ageInMonths,
  bmiZScore,
  categoryOfZ,
  classifyBmi,
} from "./bmiForAge.js";

// Rows and SD cut-offs copied from the WHO 2007 expanded tables.
const BOYS_120 = [-1.7407, 16.4433, 0.10566]; // SD: -3 12.775, -2 13.735, +1 18.48, +2 21.4, +3 26.073
const GIRLS_180 = [-1.1311, 20.2125, 0.13904]; // SD: -2 15.871, +2 28.224, +3 35.538, +4 42.852

test("z-scores reproduce the WHO SD cut-offs", () => {
  const near = (actual, expected) =>
    assert.ok(Math.abs(actual - expected) < 0.01, `${actual} vs ${expected}`);
  near(bmiZScore(16.4433, BOYS_120), 0);
  near(bmiZScore(13.735, BOYS_120), -2);
  near(bmiZScore(18.48, BOYS_120), 1);
  near(bmiZScore(21.4, BOYS_120), 2);
  near(bmiZScore(26.073, BOYS_120), 3);
  near(bmiZScore(15.871, GIRLS_180), -2);
  near(bmiZScore(28.224, GIRLS_180), 2);
  // Beyond +3 SD WHO measures in 2–3 SD steps, so +4 SD lands on 4.
  near(bmiZScore(42.852, GIRLS_180), 4);
  near(bmiZScore(12.775, BOYS_120), -3);
});

test("categories follow the WHO cut-offs", () => {
  assert.equal(categoryOfZ(-3.2), "severe_thinness");
  assert.equal(categoryOfZ(-2.5), "thinness");
  assert.equal(categoryOfZ(0), "normal");
  assert.equal(categoryOfZ(1), "normal");
  assert.equal(categoryOfZ(1.5), "overweight");
  assert.equal(categoryOfZ(2.5), "obesity");
  assert.equal(categoryOfZ(3.5), "severe_obesity");
});

test("a student's BMI is judged at the age on the measuring day", () => {
  assert.equal(ageInMonths("2016-06-01", "2026-06-01"), 120);
  const boy = classifyBmi({
    bmi: 22,
    birthDate: "2016-06-01",
    gender: "male",
    measuredAt: "2026-06-01",
  });
  assert.equal(boy.category, "obesity");
  assert.equal(boy.label, "อ้วน");
  assert.equal(
    classifyBmi({
      bmi: 16.4,
      birthDate: "2016-06-01",
      gender: "male",
      measuredAt: "2026-06-01",
    }).label,
    "สมส่วน",
  );
  assert.match(
    classifyBmi({
      bmi: 20,
      birthDate: "",
      gender: "male",
      measuredAt: "2026-06-01",
    }).reason,
    /วันเกิด/,
  );
  assert.match(
    classifyBmi({
      bmi: 20,
      birthDate: "2016-06-01",
      gender: "other",
      measuredAt: "2026-06-01",
    }).reason,
    /เพศ/,
  );
  assert.match(
    classifyBmi({
      bmi: 20,
      birthDate: "2023-01-01",
      gender: "female",
      measuredAt: "2026-06-01",
    }).reason,
    /5–19/,
  );
});
