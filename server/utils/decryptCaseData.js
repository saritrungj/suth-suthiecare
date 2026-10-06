const SENSITIVE_FIELD_NAME =
  /ชื่อ|นามสกุล|เบอร์|โทร|บัตร|เลขประจำตัว|name|phone|mobile|citizen|identity|id.?card/i;

const parseSummary = (value, decryptValue, context) => {
  if (!value) return {};
  const { parseEnvelope, openJson } = require("./privateData");
  const parsed =
    typeof value === "string" && !value.startsWith("suthenc:")
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        })()
      : value;
  if (parseEnvelope(parsed)) return openJson(parsed, context);
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
  if (Array.isArray(value))
    return value.map((item) => decryptValue(item, decrypt));
  return value;
};

const decryptSummaryData = (value, decrypt, organizationId) => {
  const { parseEnvelope, openJson, fieldContext } = require("./privateData");
  const parsed =
    typeof value === "string" && !value.startsWith("suthenc:")
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        })()
      : value;
  if (parseEnvelope(parsed))
    return openJson(
      parsed,
      organizationId == null
        ? undefined
        : fieldContext("form_responses", "summary_data", organizationId),
    );
  if (process.env.PDPA_LEGACY_READ_ENABLED === "false" && value != null)
    throw Object.assign(new Error("LEGACY_PRIVATE_DATA_RETIRED"), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
  const summary = parseSummary(
    value,
    decrypt,
    organizationId == null
      ? undefined
      : require("./privateData").fieldContext(
          "form_responses",
          "summary_data",
          organizationId,
        ),
  );

  Object.keys(summary).forEach((key) => {
    if (key !== "raw_answers" && SENSITIVE_FIELD_NAME.test(key)) {
      summary[key] = decryptValue(summary[key], decrypt);
    }
  });

  if (summary.raw_answers && typeof summary.raw_answers === "object") {
    summary.raw_answers = { ...summary.raw_answers };
    Object.keys(summary.raw_answers).forEach((key) => {
      if (SENSITIVE_FIELD_NAME.test(key)) {
        summary.raw_answers[key] = decryptValue(
          summary.raw_answers[key],
          decrypt,
        );
      }
    });
  }

  return summary;
};

const decryptCaseResponse = (record, decrypt) => {
  const result = { ...record };
  delete result.identity_hash;
  if (result.identity_value)
    result.identity_value = require("./privateField").readField(
      result.identity_value,
      "form_responses",
      "identity_value",
      result.organization_id,
      decrypt,
    );
  if (result.summary_data)
    result.summary_data = decryptSummaryData(
      result.summary_data,
      decrypt,
      result.organization_id,
    );
  if (result.risk_level)
    result.risk_level = require("./privateField").readField(
      result.risk_level,
      "form_responses",
      "risk_level",
      result.organization_id,
      decrypt,
    );
  if (result.overall_risk)
    result.overall_risk = require("./privateField").readField(
      result.overall_risk,
      "mastercases",
      "overall_risk",
      result.organization_id,
      decrypt,
    );
  if (result.clinical_data) {
    const { readJson, fieldContext } = require("./privateData");
    result.clinical_data = readJson(
      result.clinical_data,
      result.organization_id == null
        ? undefined
        : fieldContext("mastercases", "clinical_data", result.organization_id),
    );
  }
  if (result.identityValue)
    result.identityValue = require("./privateField").readField(
      result.identityValue,
      "mastercases",
      "identityValue",
      result.organization_id,
      decrypt,
    );
  return result;
};

module.exports = {
  SENSITIVE_FIELD_NAME,
  decryptCaseResponse,
  decryptSummaryData,
};
