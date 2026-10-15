const { scoreResultsOf, riskLevelOf } = require("./riskLevel");
const { decryptCaseResponse } = require("./decryptCaseData");
const { decrypt } = require("./encryption");

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + "T00:00:00Z");
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function dateWindow(query) {
  const { start_date: start, end_date: end } = query;
  if (
    (start && !validDate(start)) ||
    (end && !validDate(end)) ||
    (start && end && start > end)
  )
    throw Object.assign(new Error("ช่วงวันที่ไม่ถูกต้อง"), { status: 422 });
  return { start, end };
}
function answerMatches(actual, expected) {
  if (Array.isArray(actual))
    return actual.some((value) => answerMatches(value, expected));
  if (actual && typeof actual === "object")
    return Object.values(actual).some((value) =>
      answerMatches(value, expected),
    );
  return actual != null && String(actual).trim() === String(expected).trim();
}
function evaluateRiskTriggers(triggers, answers) {
  const ids = triggers
    .filter((rule) => {
      let actual = answers?.[rule.question_id];
      if (rule.answer_path)
        actual =
          actual && Object.hasOwn(actual, rule.answer_path)
            ? actual[rule.answer_path]
            : undefined;
      return (
        Number(rule.enabled) === 1 && answerMatches(actual, rule.answer_value)
      );
    })
    .map((rule) => Number(rule.id));
  return ids.length ? { level: "high", trigger_ids: ids } : null;
}
function questionById(questions, id) {
  for (const question of questions || []) {
    if (String(question.id) === String(id)) return question;
    const child = questionById(question.subQuestions, id);
    if (child) return child;
  }
  return null;
}
function responseRisk(row) {
  const summary = decryptCaseResponse(
    row,
    (value) => decrypt(value) || value,
  ).summary_data;
  return (
    summary?.school_risk_override?.level || riskLevelOf(scoreResultsOf(summary))
  );
}
const positiveId = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
module.exports = {
  validDate,
  dateWindow,
  answerMatches,
  evaluateRiskTriggers,
  questionById,
  responseRisk,
  positiveId,
};
