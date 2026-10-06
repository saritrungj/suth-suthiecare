import test from "node:test";
import assert from "node:assert/strict";
import {
  buildScoreResults,
  canGuestSubmit,
  countScoredTargets,
  shouldShowRealtimeResults,
  withoutNationalIdQuestions,
  prepareNationalIdQuestions,
  accountPrefillAnswers,
  consentedNationalId,
  maskThaiID,
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

  assert.equal(
    buildScoreResults(questions, { q1: "Yes", q2: "Yes" })[0].score,
    5,
  );
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
    {
      id: "group",
      type: "group",
      subQuestions: [
        { id: "nested-id", type: "national_id" },
        { id: "phone", type: "phone_number" },
      ],
    },
  ];
  assert.deepEqual(withoutNationalIdQuestions(questions), [
    { id: "name", type: "full_name" },
    {
      id: "group",
      type: "group",
      subQuestions: [{ id: "phone", type: "phone_number" }],
    },
  ]);
});

const thaiId = (prefix) => {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(prefix[i]) * (13 - i);
  return `${prefix}${(11 - (sum % 11)) % 10}`;
};

test("keeps the national ID question unless the account already has one", () => {
  const questions = [
    { id: "id", type: "national_id" },
    { id: "name", type: "full_name" },
  ];
  assert.deepEqual(prepareNationalIdQuestions(questions), questions);
  assert.deepEqual(
    prepareNationalIdQuestions(questions, { accountHasIdentity: true }),
    [{ id: "name", type: "full_name" }],
  );
});

test("prefills empty name and phone fields from the account", () => {
  const questions = [
    { id: "name", type: "full_name" },
    { id: "nick", type: "short_text", systemRole: "name" },
    {
      id: "g",
      type: "group",
      subQuestions: [{ id: "g_phone", type: "phone_number" }],
    },
    { id: "other", type: "short_text" },
  ];
  const account = {
    first_name: "สมหญิง",
    last_name: "ใจดี",
    phone: "0812345678",
  };
  assert.deepEqual(
    accountPrefillAnswers(questions, account, { nick: "แก้แล้ว" }),
    {
      name: "สมหญิง ใจดี",
      g_phone: "081-234-5678",
    },
  );
  assert.deepEqual(accountPrefillAnswers(questions, null), {});
});

test("sends a national ID only when its PDPA consent was given", () => {
  const id = thaiId("110170023070");
  const questions = [{ id: "nid", type: "national_id" }];
  const dashed = `${id[0]}-${id.slice(1, 5)}-${id.slice(5, 10)}-${id.slice(10, 12)}-${id[12]}`;
  assert.equal(consentedNationalId(questions, { nid: dashed }, {}), null);
  assert.equal(
    consentedNationalId(questions, { nid: dashed }, { nid: true }),
    id,
  );
  assert.equal(
    consentedNationalId(questions, { nid: "1-2345-67890-12-3" }, { nid: true }),
    null,
  );
  assert.equal(
    maskThaiID(id),
    `${id[0]}-${id.slice(1, 3)}xx-xxxxx-x${id[11]}-${id[12]}`,
  );
});
