const { normalizeStoredAnswer } = require("./storedAnswer");
const { decrypt } = require("./encryption");

// Public counts may only use quota-controlled options from the server schema.
// Free text, personal identifiers and answer values never become response keys.
function optionUsage(questions, rows) {
  const schema = new Map();
  const visit = (items) => {
    for (const question of items || []) {
      if (
        Array.isArray(question.options) &&
        question.optionLimits?.some((limit) => limit !== "" && limit != null)
      ) {
        schema.set(
          String(question.id),
          new Set(
            question.options.filter((option) => typeof option === "string"),
          ),
        );
      }
      visit(question.subQuestions);
    }
  };
  visit(questions);
  const result = Object.create(null);
  for (const row of rows) {
    const options = schema.get(String(row.question_id));
    if (!options) continue;
    const value = normalizeStoredAnswer(
      row.answer_value,
      row.question_title,
      decrypt,
      row.organization_id,
    );
    for (const selected of new Set(Array.isArray(value) ? value : [value])) {
      if (!options.has(selected)) continue;
      const counts = (result[row.question_id] ||= Object.create(null));
      counts[selected] = (counts[selected] || 0) + 1;
    }
  }
  return result;
}
module.exports = { optionUsage };
