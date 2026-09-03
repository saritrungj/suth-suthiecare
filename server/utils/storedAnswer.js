const SENSITIVE_QUESTION =
  /ชื่อ|นามสกุล|เบอร์|โทร|บัตร|เลขประจำตัว|name|phone|mobile|citizen|identity|id.?card/i;

function parseStoredAnswer(value) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    // mysql2 already decodes JSON scalar strings. A second JSON.parse() would
    // throw for values such as "นาย"; those are valid answers, not bad JSON.
    return value;
  }
}

function normalizeStoredAnswer(value, questionTitle = "", decrypt = (item) => item) {
  const normalized = parseStoredAnswer(value);
  if (SENSITIVE_QUESTION.test(String(questionTitle)) && typeof normalized === "string") {
    return decrypt(normalized);
  }
  return normalized;
}

module.exports = { normalizeStoredAnswer, parseStoredAnswer };
