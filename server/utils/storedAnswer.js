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

function normalizeStoredAnswer(
  value,
  questionTitle = "",
  decrypt = (item) => item,
  organizationId,
) {
  const normalized = parseStoredAnswer(value);
  const { parseEnvelope, openJson } = require("./privateData");
  if (parseEnvelope(normalized))
    return openJson(
      normalized,
      organizationId == null
        ? undefined
        : require("./privateData").fieldContext(
            "form_answers",
            "answer_value",
            organizationId,
          ),
    );
  if (process.env.PDPA_LEGACY_READ_ENABLED === "false")
    throw Object.assign(new Error("LEGACY_PRIVATE_DATA_RETIRED"), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
  if (
    SENSITIVE_QUESTION.test(String(questionTitle)) &&
    typeof normalized === "string"
  ) {
    return decrypt(normalized);
  }
  return normalized;
}

module.exports = { normalizeStoredAnswer, parseStoredAnswer };
