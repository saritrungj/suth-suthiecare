import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useState,
} from "react";
import {
  FiActivity,
  FiArrowDownRight,
  FiArrowUpRight,
  FiMinus,
  FiRefreshCw,
} from "react-icons/fi";
import { getPatientSchoolHealth } from "../../services/api";
import "./SchoolHealthPanel.css";

// recharts loads only when the student has at least two checks to compare.
const SchoolHealthTrend = lazy(() => import("./SchoolHealthTrend"));

const HEARING = {
  normal: { th: "ปกติ", en: "Normal" },
  abnormal: { th: "ผิดปกติ", en: "Abnormal" },
  not_tested: { th: "ไม่ได้ตรวจ", en: "Not tested" },
};

const MEASURES = [
  {
    key: "weight_kg",
    th: "น้ำหนัก",
    en: "Weight",
    unitTh: "กก.",
    unitEn: "kg",
  },
  {
    key: "height_cm",
    th: "ส่วนสูง",
    en: "Height",
    unitTh: "ซม.",
    unitEn: "cm",
  },
  { key: "bmi", th: "BMI", en: "BMI", unitTh: "", unitEn: "" },
];

const formatDate = (value, en, short = false) => {
  if (!value) return "-";
  const date = new Date(
    String(value).length === 10 ? `${value}T00:00:00` : value,
  );
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(en ? "en-GB" : "th-TH", {
    year: short ? "2-digit" : "numeric",
    month: "short",
    day: "numeric",
  });
};

const round1 = (value) => Math.round(value * 10) / 10;

// Latest value, the one before it, and the series for the chart (oldest first).
function trendOf(records, key, en) {
  const points = [...records]
    .reverse()
    .filter((record) => record[key] != null)
    .map((record) => ({
      date: formatDate(record.measured_at, en, true),
      value: Number(record[key]),
      at: record.measured_at,
    }));
  const latest = points[points.length - 1] || null;
  const previous = points.length > 1 ? points[points.length - 2] : null;
  return { points, latest, previous };
}

// Change stated in words, never judged: a growing child gains weight and height.
function ChangeLine({ measure, latest, previous, en }) {
  if (!latest) return null;
  if (!previous)
    return (
      <p className="sh-change sh-change--none">
        <FiMinus aria-hidden="true" />
        {en
          ? "One check so far, no trend yet"
          : "มีผลตรวจครั้งเดียว ยังไม่มีแนวโน้ม"}
      </p>
    );
  const diff = round1(latest.value - previous.value);
  const unit = en ? measure.unitEn : measure.unitTh;
  const since = formatDate(previous.at, en);
  if (diff === 0)
    return (
      <p className="sh-change">
        <FiMinus aria-hidden="true" />
        {en ? `Same as on ${since}` : `เท่าเดิมจากครั้งก่อน (${since})`}
      </p>
    );
  const Icon = diff > 0 ? FiArrowUpRight : FiArrowDownRight;
  const amount = `${Math.abs(diff)}${unit ? ` ${unit}` : ""}`;
  return (
    <p className="sh-change">
      <Icon aria-hidden="true" />
      {en
        ? `${diff > 0 ? "Up" : "Down"} ${amount} since ${since}`
        : `${diff > 0 ? "เพิ่มขึ้น" : "ลดลง"} ${amount} จากครั้งก่อน (${since})`}
    </p>
  );
}

// A school student's own physical health: the latest check, how each
// measure changed, and every check the school recorded. Shown only to
// members whose type is school student (see MemberTypePanel).
export default function SchoolHealthPanel({ language = "th" }) {
  const en = language === "en";
  const tr = (pair) => (pair ? pair[en ? "en" : "th"] : "-");
  const titleId = useId();
  const [state, setState] = useState({ loading: true, error: "", data: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const { data } = await getPatientSchoolHealth();
      setState({ loading: false, error: "", data });
    } catch (error) {
      setState({
        loading: false,
        data: null,
        error:
          error.response?.data?.message ||
          (en
            ? "Could not load your health records."
            : "ไม่สามารถโหลดข้อมูลสุขภาพได้"),
      });
    }
  }, [en]);

  useEffect(() => {
    load();
  }, [load]);

  const records = state.data?.records || [];
  const profile = state.data?.profile || {};
  const latest = records[0];

  return (
    <section
      className="sh-panel"
      aria-labelledby={titleId}
      aria-busy={state.loading}
    >
      <header className="sh-head">
        <span className="sh-icon" aria-hidden="true">
          <FiActivity />
        </span>
        <div className="sh-heading">
          <p className="sh-eyebrow">
            {en ? "From your school" : "ข้อมูลจากโรงเรียน"}
          </p>
          <h2 id={titleId} className="sh-title">
            {en ? "My physical health" : "สุขภาพกายของฉัน"}
          </h2>
        </div>
        {latest && (
          <p className="sh-meta">
            {en ? "Last check" : "ตรวจล่าสุด"}{" "}
            {formatDate(latest.measured_at, en)}
            <span aria-hidden="true"> · </span>
            {en
              ? `${records.length} checks`
              : `ทั้งหมด ${records.length} ครั้ง`}
          </p>
        )}
      </header>

      {state.loading && (
        <p className="sh-status" role="status">
          {en ? "Loading your health records..." : "กำลังโหลดข้อมูลสุขภาพ..."}
        </p>
      )}

      {!state.loading && state.error && (
        <div className="sh-status sh-status--error" role="alert">
          <span>{state.error}</span>
          <button type="button" className="sh-retry" onClick={load}>
            <FiRefreshCw aria-hidden="true" /> {en ? "Try again" : "ลองใหม่"}
          </button>
        </div>
      )}

      {!state.loading && !state.error && !records.length && (
        <p className="sh-status">
          {en
            ? "Your school has not recorded a physical check yet."
            : "โรงเรียนยังไม่ได้บันทึกผลตรวจร่างกายของคุณ"}
        </p>
      )}

      {!state.loading && !state.error && records.length > 0 && (
        <>
          <div className="sh-trends">
            {MEASURES.map((measure) => {
              const {
                points,
                latest: last,
                previous,
              } = trendOf(records, measure.key, en);
              const label = tr(measure);
              const unit = en ? measure.unitEn : measure.unitTh;
              return (
                <article key={measure.key} className="sh-trend">
                  <h3 className="sh-trend__label">
                    {label}
                    {unit && <span> ({unit})</span>}
                  </h3>
                  <p className="sh-trend__value">{last ? last.value : "-"}</p>
                  <ChangeLine
                    measure={measure}
                    latest={last}
                    previous={previous}
                    en={en}
                  />
                  {points.length > 1 && (
                    <div
                      className="sh-trend__chart"
                      role="img"
                      aria-label={
                        en
                          ? `${label} over ${points.length} checks, from ${points[0].value} to ${last.value}`
                          : `${label} จากการตรวจ ${points.length} ครั้ง จาก ${points[0].value} เป็น ${last.value}`
                      }
                    >
                      <Suspense
                        fallback={<div className="sh-trend__loading" />}
                      >
                        <SchoolHealthTrend
                          data={points}
                          unit={unit}
                          label={label}
                        />
                      </Suspense>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          <p className="sh-note">
            {en
              ? "A child's BMI is read against age and sex, so it is shown as a number only. Ask your school nurse if you have questions."
              : "ค่า BMI ของเด็กต้องแปลผลตามเกณฑ์อายุและเพศ จึงแสดงเป็นตัวเลขเท่านั้น หากมีข้อสงสัยสอบถามครูอนามัยหรือเจ้าหน้าที่สาธารณสุขได้"}
          </p>

          <div className="sh-columns">
            <section
              className="sh-block"
              aria-label={en ? "Latest check" : "ผลตรวจล่าสุด"}
            >
              <h3 className="sh-block__title">
                {en ? "Latest check" : "ผลตรวจล่าสุด"}
              </h3>
              <dl className="sh-facts">
                <div>
                  <dt>
                    {en ? "Blood pressure (mmHg)" : "ความดันโลหิต (mmHg)"}
                  </dt>
                  <dd>
                    {latest.systolic
                      ? `${latest.systolic}/${latest.diastolic ?? "-"}`
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt>{en ? "Pulse (per minute)" : "ชีพจร (ครั้ง/นาที)"}</dt>
                  <dd>{latest.pulse ?? "-"}</dd>
                </div>
                <div>
                  <dt>{en ? "Vision (left / right)" : "สายตา (ซ้าย / ขวา)"}</dt>
                  <dd>
                    {latest.vision_left || "-"} / {latest.vision_right || "-"}
                  </dd>
                </div>
                <div>
                  <dt>
                    {en ? "Hearing (left / right)" : "การได้ยิน (ซ้าย / ขวา)"}
                  </dt>
                  <dd>
                    {tr(HEARING[latest.hearing_left])} /{" "}
                    {tr(HEARING[latest.hearing_right])}
                  </dd>
                </div>
                <div>
                  <dt>{en ? "Fitness" : "สมรรถภาพทางกาย"}</dt>
                  <dd>{latest.fitness || "-"}</dd>
                </div>
              </dl>
            </section>

            <section
              className="sh-block"
              aria-label={en ? "Health profile" : "ข้อมูลสุขภาพประจำตัว"}
            >
              <h3 className="sh-block__title">
                {en ? "Health profile" : "ข้อมูลสุขภาพประจำตัว"}
              </h3>
              <dl className="sh-facts">
                <div>
                  <dt>{en ? "Blood type" : "กรุ๊ปเลือด"}</dt>
                  <dd>
                    {profile.blood_type && profile.blood_type !== "unknown"
                      ? profile.blood_type
                      : en
                        ? "Unknown"
                        : "ไม่ทราบ"}
                  </dd>
                </div>
                <div>
                  <dt>{en ? "Chronic conditions" : "โรคประจำตัว"}</dt>
                  <dd>{profile.chronic_conditions || "-"}</dd>
                </div>
                <div>
                  <dt>
                    {en ? "Drug / food allergies" : "ประวัติแพ้ยา / อาหาร"}
                  </dt>
                  <dd>{profile.allergies || "-"}</dd>
                </div>
                <div>
                  <dt>{en ? "Regular medicines" : "ยาที่ใช้ประจำ"}</dt>
                  <dd>{profile.medications || "-"}</dd>
                </div>
              </dl>
            </section>
          </div>

          <details className="sh-history">
            <summary>
              {en
                ? `All checks (${records.length})`
                : `ประวัติการตรวจทั้งหมด (${records.length} ครั้ง)`}
            </summary>
            <div className="sh-history__scroll">
              <table className="sh-table">
                <thead>
                  <tr>
                    <th scope="col">{en ? "Date" : "วันที่ตรวจ"}</th>
                    <th scope="col" className="sh-num">
                      {en ? "Weight (kg)" : "น้ำหนัก (กก.)"}
                    </th>
                    <th scope="col" className="sh-num">
                      {en ? "Height (cm)" : "ส่วนสูง (ซม.)"}
                    </th>
                    <th scope="col" className="sh-num">
                      BMI
                    </th>
                    <th scope="col">{en ? "BP / pulse" : "ความดัน / ชีพจร"}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td data-label={en ? "Date" : "วันที่ตรวจ"}>
                        {formatDate(record.measured_at, en)}
                      </td>
                      <td
                        data-label={en ? "Weight (kg)" : "น้ำหนัก (กก.)"}
                        className="sh-num"
                      >
                        {record.weight_kg ?? "-"}
                      </td>
                      <td
                        data-label={en ? "Height (cm)" : "ส่วนสูง (ซม.)"}
                        className="sh-num"
                      >
                        {record.height_cm ?? "-"}
                      </td>
                      <td data-label="BMI" className="sh-num">
                        {record.bmi ?? "-"}
                      </td>
                      <td data-label={en ? "BP / pulse" : "ความดัน / ชีพจร"}>
                        {record.systolic
                          ? `${record.systolic}/${record.diastolic ?? "-"}`
                          : "-"}
                        {record.pulse ? ` · ${record.pulse}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
