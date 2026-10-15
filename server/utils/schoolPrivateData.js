const { sealText, readJson, fieldContext } = require("./privateData");
const MEASUREMENTS = [
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
];
function encodeMeasurements(value, org) {
  return sealText(
    Object.fromEntries(MEASUREMENTS.map((key) => [key, value[key]])),
    fieldContext("school_student_physical_records", "measurements", org),
  );
}
function physicalRecord(row, org) {
  if (
    !row.measurements_encrypted &&
    process.env.PDPA_LEGACY_READ_ENABLED === "false" &&
    MEASUREMENTS.some((key) => row[key] != null)
  )
    throw Object.assign(new Error("LEGACY_PRIVATE_DATA_RETIRED"), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
  const result = { ...row };
  if (row.measurements_encrypted)
    Object.assign(
      result,
      readJson(
        row.measurements_encrypted,
        fieldContext("school_student_physical_records", "measurements", org),
      ),
    );
  delete result.measurements_encrypted;
  if (row.note_encrypted) {
    result.note = require("./privateField").readField(
      row.note_encrypted,
      "school_student_physical_records",
      "note_encrypted",
      org,
    );
    delete result.note_encrypted;
  }
  for (const key of [
    "weight_kg",
    "height_cm",
    "bmi",
    "systolic",
    "diastolic",
    "pulse",
  ])
    if (result[key] != null) result[key] = Number(result[key]);
  return result;
}
function bloodType(row, org) {
  if (
    row &&
    !row.health_payload_encrypted &&
    process.env.PDPA_LEGACY_READ_ENABLED === "false"
  )
    throw Object.assign(new Error("LEGACY_PRIVATE_DATA_RETIRED"), {
      code: "LEGACY_PRIVATE_DATA_RETIRED",
    });
  return row?.health_payload_encrypted
    ? readJson(
        row.health_payload_encrypted,
        fieldContext("school_student_health_profiles", "health", org),
      ).blood_type
    : row?.blood_type || "unknown";
}
module.exports = {
  MEASUREMENTS,
  encodeMeasurements,
  physicalRecord,
  bloodType,
};
