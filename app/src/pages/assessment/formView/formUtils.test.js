import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScoreResults,
  canGuestSubmit,
  countScoredTargets,
  shouldShowRealtimeResults,
  withoutNationalIdQuestions,
} from "./formUtils.js";

test("keeps form login and result-display modes distinct", () => {
  assert.equal(canGuestSubmit("strict"), false);
  assert.equal(canGuestSubmit("optional"), false);
  assert.equal(canGuestSubmit("none"), true);
  assert.equal(shouldShowRealtimeResults("realtime"), true);
  assert.equal(shouldShowRealtimeResults("on_submit"), false);
});

test("builds a live result from the same scoring rule used for submission", () => {
  const questions = [
    {
      id: "q1",
      type: "multiple_choice",
      title: "Symptom frequency",
      isScored: true,
      options: ["Never", "Sometimes", "Often"],
      optionScores: [0, 1, 2],
      scoringRules: [
        { min: 0, max: 0, label: "Low" },
        { min: 1, max: 2, label: "Monitor", advice: "Review symptoms" },
      ],
    },
  ];

  assert.deepEqual(buildScoreResults(questions, { q1: "Sometimes" }), [
    {
      question_id: "q1",
      title: "Symptom frequency",
      score: 1,
      label: "Monitor",
      color: "#35756d",
      advice: "Review symptoms",
    },
  ]);
});

test("updates a scored group when its sub-question answers change", () => {
  const questions = [
    {
      id: "group-1",
      type: "group",
      title: "Wellbeing",
      isScored: true,
      subQuestions: [
        {
          id: "q1",
          type: "multiple_choice",
          options: ["No", "Yes"],
          optionScores: [0, 2],
        },
        {
          id: "q2",
          type: "multiple_choice",
          options: ["No", "Yes"],
          optionScores: [0, 3],
        },
      ],
      scoringRules: [{ min: 0, max: 5, label: "Calculated" }],
    },
  ];

  assert.equal(buildScoreResults(questions, { q1: "Yes", q2: "Yes" })[0].score, 5);
  assert.equal(countScoredTargets(questions), 1);
});

test("does not show a result before a scored question has an answer", () => {
  const questions = [{ id: "q1", type: "multiple_choice", isScored: true }];
  assert.deepEqual(buildScoreResults(questions, {}), []);
  assert.equal(countScoredTargets(questions), 1);
});

test("removes national ID questions from legacy forms before rendering", () => {
  const questions = [
    { id: "id", type: "national_id" },
    { id: "name", type: "full_name" },
    { id: "group", type: "group", subQuestions: [{ id: "nested-id", type: "national_id" }, { id: "phone", type: "phone_number" }] },
  ];
  assert.deepEqual(withoutNationalIdQuestions(questions), [
    { id: "name", type: "full_name" },
    { id: "group", type: "group", subQuestions: [{ id: "phone", type: "phone_number" }] },
  ]);
});
