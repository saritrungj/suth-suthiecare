import test from "node:test";
import assert from "node:assert/strict";
import { buildAssessmentResultSections } from "./assessmentResultUtils.js";

test("places the total before separately scored sections", () => {
  const source = [
    { question_id: "sleep", title: "Sleep", score: 1.5 },
    { question_id: "stress", title: "Stress", score: 2 },
  ];

  assert.deepEqual(buildAssessmentResultSections(source), [
    { id: "total-score", displayKind: "total", score: 3.5, partCount: 2 },
    { question_id: "sleep", title: "Sleep", score: 1.5, displayKind: "section" },
    { question_id: "stress", title: "Stress", score: 2, displayKind: "section" },
  ]);
});

test("keeps a single scored section as the original result", () => {
  const source = [{ question_id: "sleep", title: "Sleep", score: 2 }];

  assert.deepEqual(buildAssessmentResultSections(source), [
    { question_id: "sleep", title: "Sleep", score: 2, displayKind: "section" },
  ]);
});
