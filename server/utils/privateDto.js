const { decrypt } = require("./encryption");
const { readJson, parseEnvelope } = require("./privateData");
const INTERNAL =
  /^(identity_hash|phone_hash|email_hash|pending_email_hash|password|password_hash|auth_version|token_version|csrf_hash|token_hash|auth_token|otp_hmac|__enc|kid|iv|tag|ct|context)$/;
const PII = new Set([
  "identity_value",
  "identityValue",
  "citizenId",
  "idCard",
  "national_id",
  "phone",
  "display_phone",
  "display_name",
  "full_name",
  "first_name",
  "last_name",
  "nickname",
  "birth_date",
  "email",
  "pending_email",
  "emergency_contact_name",
  "emergency_contact_phone",
  "patient_name",
  "name",
]);
const CLINICAL = new Set([
  "insights",
  "guidance",
  "guardian_name",
  "guardian_relationship",
  "guardian_phone",
  "living_with",
  "family_status",
  "living_conditions",
  "support_needs",
  "issue",
  "support",
  "clinical_data",
  "risk_level",
  "overall_risk",
  "score_results",
  "score",
  "risk",
  "label",
  "weight",
  "height",
  "weight_kg",
  "height_cm",
  "bmi",
  "systolic",
  "diastolic",
  "pulse",
  "vision_left",
  "vision_right",
  "hearing_left",
  "hearing_right",
  "fitness",
  "blood_type",
  "chronic_conditions",
  "allergies",
  "medications",
  "notes",
  "note",
  "detail",
  "mental",
  "physical",
  "latest_vitals",
  "assessments",
  "physical_records",
  "profile",
]);
const CASE_FIELDS = new Set([
  "first_name",
  "last_name",
  "case_source",
  "latest_activity",
  "id",
  "response_id",
  "form_id",
  "form_type",
  "master_case_id",
  "person_id",
  "patient_account_id",
  "organization_id",
  "organization_name",
  "organization_code",
  "clinic_type",
  "clinicType",
  "form_title",
  "form_status",
  "status",
  "currentStage",
  "staff_id",
  "staff_name",
  "staff",
  "submitted_at",
  "created_at",
  "updated_at",
  "createdAt",
  "updatedAt",
  "summary_data",
  "identity_value",
  "identityValue",
  "risk_level",
  "overall_risk",
  "clinical_data",
  "appt_status",
  "appointment_date",
  "appointment_no",
  "service_id",
  "service_name",
  "case_id",
  "case_status",
  "master_status",
  "note",
  "type",
  "detail",
  "patient_visible",
  "submitted_by",
]);
const SUMMARY_FIELDS = new Set([
  "case_source",
  "display_name",
  "display_phone",
  "name",
  "phone",
  "citizenId",
  "idCard",
  "display_faculty",
  "score_results",
  "raw_answers",
  "weight",
  "height",
  "display_name_source",
  "display_phone_source",
  "display_name_updated_at",
  "phone_updated_at",
  "height_updated_at",
  "weight_updated_at",
]);
function mask(value, key) {
  if (value == null || value === "") return value;
  const text = String(value);
  return /name/.test(key) ? text.slice(0, 1) + "***" : "***" + text.slice(-4);
}
const STORED_TEXT = new Set([
  "identity_value",
  "identityValue",
  "risk_level",
  "overall_risk",
  "staff",
  "staff_name",
  "detail",
  "note",
  "fullname",
  "name",
]);
function serialize(
  value,
  {
    pii = false,
    clinical = false,
    list = false,
    credential = false,
    caseNames = false,
    // The patient-member directory shows the full name to PII viewers.
    memberNames = false,
  } = {},
  scope = "root",
  decodedPayload = false,
) {
  if (value == null || value instanceof Date) return value;
  if (scope === "answers") return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((item) =>
      serialize(
        item,
        { pii, clinical, list, credential, caseNames, memberNames },
        scope,
        decodedPayload,
      ),
    );
  if (typeof value !== "object") return value;
  if (!decodedPayload && parseEnvelope(value))
    return serialize(
      readJson(value),
      { pii, clinical, list, caseNames, memberNames },
      scope,
      true,
    );
  const record =
    ("summary_data" in value ||
      "identity_value" in value ||
      "identityValue" in value) &&
    scope !== "summary";
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      (INTERNAL.test(key) && !(key === "password" && credential)) ||
      key.endsWith("_encrypted")
    )
      continue;
    if (record && !CASE_FIELDS.has(key)) continue;
    if (scope === "summary" && !SUMMARY_FIELDS.has(key)) continue;
    if (
      list &&
      (key === "clinical_data" ||
        key === "raw_answers" ||
        key === "score_results" ||
        key === "note" ||
        key === "detail" ||
        (scope === "summary" && ["weight", "height"].includes(key)))
    )
      continue;
    if (CLINICAL.has(key) && !clinical) continue;
    if (key === "raw_answers" && (!pii || !clinical)) continue;
    let decoded = raw;
    let opened = decodedPayload;
    if (!decodedPayload && key === "summary_data") {
      decoded = readJson(raw);
      opened = true;
    }
    if (
      !decodedPayload &&
      STORED_TEXT.has(key) &&
      typeof raw === "string" &&
      raw.startsWith("suthenc:")
    )
      decoded = decrypt(raw);
    if (key === "staff" && raw) decoded = decrypt(raw);
    if (
      PII.has(key) &&
      (!pii ||
        (list &&
          !(caseNames && ["first_name", "last_name"].includes(key)) &&
          !(memberNames && key === "full_name")))
    ) {
      result[key] = mask(decoded, key);
      continue;
    }
    result[key] = serialize(
      decoded,
      { pii, clinical, list, credential, caseNames, memberNames },
      key === "summary_data"
        ? "summary"
        : key === "raw_answers"
          ? "answers"
          : "root",
      opened,
    );
  }
  return result;
}
module.exports = { serialize, mask };
