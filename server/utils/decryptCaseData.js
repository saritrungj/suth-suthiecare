const SENSITIVE_FIELD_NAME =
  /ชื่อ|นามสกุล|เบอร์|โทร|บัตร|เลขประจำตัว|name|phone|mobile|citizen|identity|id.?card/i;

const parseSummary = (value, decryptValue) => {
  if (!value) return {};
  if (typeof value === "object") return { ...value };

  try {
    return JSON.parse(value);
  } catch {
    try {
      const decrypted = decryptValue(value);
      return typeof decrypted === "string" ? JSON.parse(decrypted) : {};
    } catch {
      return {};
    }
  }
};

const decryptValue = (value, decrypt) => {
  if (typeof value === "string") return decrypt(value);
  if (Array.isArray(value)) return value.map((item) => decryptValue(item, decrypt));
  return value;
};

const decryptSummaryData = (value, decrypt) => {
  const summary = parseSummary(value, decrypt);

  Object.keys(summary).forEach((key) => {
    if (key !== "raw_answers" && SENSITIVE_FIELD_NAME.test(key)) {
      summary[key] = decryptValue(summary[key], decrypt);
    }
  });

  if (summary.raw_answers && typeof summary.raw_answers === "object") {
    summary.raw_answers = { ...summary.raw_answers };
    Object.keys(summary.raw_answers).forEach((key) => {
      if (SENSITIVE_FIELD_NAME.test(key)) {
        summary.raw_answers[key] = decryptValue(summary.raw_answers[key], decrypt);
      }
    });
  }

  return summary;
};

const decryptCaseResponse = (record, decrypt) => {
  const result = { ...record };
  if (result.identity_value) result.identity_value = decryptValue(result.identity_value, decrypt);
  if (result.summary_data) result.summary_data = decryptSummaryData(result.summary_data, decrypt);
  return result;
};

module.exports = {
  SENSITIVE_FIELD_NAME,
  decryptCaseResponse,
  decryptSummaryData,
};
