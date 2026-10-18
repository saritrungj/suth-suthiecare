import test from "node:test";
import assert from "node:assert/strict";
import { bmiCategory, buildClinicDetail } from "./clinicDetailData.js";

const response = (id, date, score, extra = {}) => ({
  id,
  form_title: `Form ${id}`,
  clinic_type: "sti",
  submitted_at: date,
  summary_data: {
    score_results: [{ score, label: `L${score}`, color: "#f59e0b" }],
  },
  ...extra,
});

test("risk scores are ordered by date and a lower score is better", () => {
  const responses = [
    response(2, "2026-03-01", 4),
    response(1, "2026-01-01", 9),
    { ...response(3, "2026-02-01", 1), clinic_type: "teenager" },
  ];
  const detail = buildClinicDetail({ clinicType: "sti", responses });
  assert.equal(detail.metric, "score");
  assert.deepEqual(
    detail.series.map((r) => r.value),
    [9, 4],
  );
  assert.equal(detail.latest.value, 4);
  assert.equal(detail.trend, "better");
  assert.equal(detail.assessmentCount, 2);
});

test("records keyed clinicType are included", () => {
  const detail = buildClinicDetail({
    clinicType: "sti",
    responses: [
      {
        ...response(1, "2026-01-01", 2),
        clinic_type: undefined,
        clinicType: "sti",
      },
    ],
  });
  assert.equal(detail.assessmentCount, 1);
});

test("behaviour clinic follows BMI towards the normal range", () => {
  const bmiRecords = [
    {
      clinicId: "behavior",
      date: "2026-02-01",
      score: "26.1",
      weight: "70",
      height: "164",
    },
    {
      clinicId: "behavior",
      date: "2026-01-01",
      score: "28.4",
      weight: "-",
      height: "-",
    },
    { clinicId: "sti", date: "2026-01-01", score: "20" },
  ];
  const detail = buildClinicDetail({ clinicType: "behavior", bmiRecords });
  assert.equal(detail.metric, "bmi");
  assert.deepEqual(
    detail.series.map((r) => r.value),
    [28.4, 26.1],
  );
  assert.equal(detail.series[0].weight, null);
  assert.equal(detail.latest.weight, 70);
  assert.equal(detail.trend, "better");
  assert.equal(bmiCategory(detail.latest.value), "obese");
  assert.equal(bmiCategory(22.9), "normal");
});

test("history reads the nested form record, newest first", () => {
  const timelineEvents = [
    { clinic_type: "sti", data: response(1, "2026-01-01", 3) },
    { clinic_type: "sti", data: response(2, "2026-05-01", 1) },
    { clinic_type: "teenager", data: response(3, "2026-06-01", 1) },
  ];
  const detail = buildClinicDetail({ clinicType: "sti", timelineEvents });
  assert.deepEqual(
    detail.history.map((h) => [h.id, h.title]),
    [
      [2, "Form 2"],
      [1, "Form 1"],
    ],
  );
});

test("case info collects the case status and staff updates", () => {
  const responses = [
    response(1, "2026-01-01", 3, { master_case_id: 7, status: "รอติดต่อ" }),
    response(2, "2026-02-01", 3, {
      master_case_id: 7,
      status: "กำลังดำเนินการ",
    }),
  ];
  const logs = [
    { case_id: 1, detail: "โทรนัดแล้ว", created_at: "2026-01-02" },
    { case_id: 2, detail: "ติดตามผล", created_at: "2026-02-03" },
    { case_id: 9, detail: "อื่น", created_at: "2026-02-04" },
    { case_id: 2, detail: " ", created_at: "2026-02-05" },
  ];
  const detail = buildClinicDetail({
    clinicType: "sti",
    masterCase: { id: 7 },
    responses,
    logs,
    adviceByClinic: {
      sti: [
        { detail: "old", created_at: "2026-01-01" },
        { detail: "new", created_at: "2026-03-01" },
      ],
    },
  });
  assert.equal(detail.caseInfo.code, "MC-0007");
  assert.equal(detail.caseInfo.status, "กำลังดำเนินการ");
  assert.equal(detail.caseInfo.openedAt, "2026-01-01");
  assert.deepEqual(
    detail.caseInfo.updates.map((u) => u.detail),
    ["ติดตามผล", "โทรนัดแล้ว"],
  );
  assert.deepEqual(
    detail.advice.map((a) => a.detail),
    ["new", "old"],
  );
});
