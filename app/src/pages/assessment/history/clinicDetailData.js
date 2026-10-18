// Builds everything the clinic detail page shows from the state the history
// page hands over. Kept pure so the ordering and trend rules are testable.

const clinicOf = (item) => item?.clinicType || item?.clinic_type || "general";
const time = (value) => {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
};
const toNumber = (value) => {
  const digits = String(value ?? "").replace(/[^0-9.]/g, "");
  const number = Number(digits);
  return digits && Number.isFinite(number) ? number : null;
};

// Asian adult cut-offs: normal BMI is 18.5 up to (not including) 23.
const BMI_LOW = 18.5;
const BMI_HIGH = 23;
// How far a BMI sits outside the normal range; 0 inside it.
const bmiDistance = (bmi) =>
  bmi < BMI_LOW ? BMI_LOW - bmi : bmi >= BMI_HIGH ? bmi - BMI_HIGH + 0.1 : 0;

export function bmiCategory(bmi) {
  if (bmi == null) return null;
  if (bmi < BMI_LOW) return "underweight";
  if (bmi < BMI_HIGH) return "normal";
  if (bmi < 25) return "overweight";
  return "obese";
}

function responseRecord(response) {
  const results = response.summary_data?.score_results || [];
  const result = results[0];
  return {
    id: response.id,
    date: response.submitted_at,
    title: response.form_title || `#${response.form_id ?? response.id}`,
    value: result ? toNumber(result.score) : null,
    label: result?.label || null,
    color: result?.color || null,
    status: response.status || null,
  };
}

export function buildClinicDetail({
  clinicType,
  masterCase,
  bmiRecords = [],
  adviceByClinic = {},
  timelineEvents = [],
  responses = [],
  logs = [],
} = {}) {
  const clinicResponses = responses
    .filter((response) => clinicOf(response) === clinicType)
    .sort((a, b) => time(a.submitted_at) - time(b.submitted_at));

  const bmiSeries = bmiRecords
    .filter((record) => (record.clinicId || "general") === clinicType)
    .map((record) => ({
      date: record.date,
      value: toNumber(record.bmi ?? record.score),
      label: record.label || null,
      color: record.color || null,
      weight: toNumber(record.weight),
      height: toNumber(record.height),
    }))
    .filter((record) => record.value != null)
    .sort((a, b) => time(a.date) - time(b.date));

  const scoreSeries = clinicResponses
    .map(responseRecord)
    .filter((record) => record.value != null);

  // The behaviour clinic follows BMI when the forms record it.
  const metric =
    clinicType === "behavior" && bmiSeries.length ? "bmi" : "score";
  const series = metric === "bmi" ? bmiSeries : scoreSeries;
  const latest = series[series.length - 1] || null;
  const first = series[0] || null;

  let trend = null;
  if (series.length > 1) {
    const before =
      metric === "bmi" ? bmiDistance(first.value) : Number(first.value);
    const after =
      metric === "bmi" ? bmiDistance(latest.value) : Number(latest.value);
    trend = after < before ? "better" : after > before ? "worse" : "same";
  }

  const history = timelineEvents
    .filter((event) => clinicOf(event) === clinicType && event.data)
    .map((event) => responseRecord(event.data))
    .sort((a, b) => time(b.date) - time(a.date));

  const advice = [...(adviceByClinic[clinicType] || [])]
    .filter((log) => String(log.detail || "").trim())
    .sort((a, b) => time(b.created_at) - time(a.created_at));

  let caseInfo = null;
  if (masterCase?.id != null) {
    const caseResponses = responses
      .filter(
        (response) => String(response.master_case_id) === String(masterCase.id),
      )
      .sort((a, b) => time(b.submitted_at) - time(a.submitted_at));
    const caseResponseIds = new Set(caseResponses.map((r) => String(r.id)));
    caseInfo = {
      code: `MC-${String(masterCase.id).padStart(4, "0")}`,
      status: caseResponses[0]?.status || masterCase.status || null,
      openedAt:
        masterCase.created_at ||
        caseResponses[caseResponses.length - 1]?.submitted_at ||
        null,
      updates: logs
        .filter((log) => caseResponseIds.has(String(log.case_id)))
        .filter((log) => String(log.detail || "").trim())
        .sort((a, b) => time(b.created_at) - time(a.created_at)),
    };
  }

  return {
    metric,
    series,
    latest,
    first,
    trend,
    history,
    advice,
    caseInfo,
    assessmentCount: clinicResponses.length,
    lastVisit:
      clinicResponses[clinicResponses.length - 1]?.submitted_at || null,
  };
}
