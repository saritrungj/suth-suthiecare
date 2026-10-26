// Mental-health status in the student file: the current status, a form to
// record a care step, the history of care steps, and every assessment filed
// under the semester and class it was taken in, from first enrollment on.
import { useState } from "react";
import { FiClock, FiFlag, FiLayers, FiSave, FiUser } from "react-icons/fi";
import SearchableSelect from "../../../components/SearchableSelect";
import { setStudentCareStatus } from "../../../services/api";
import { showErrorAlert, showSuccessToast } from "../../../utils/alerts";
import { bangkokDateKey } from "../../../utils/caseDateFilter";
import { toDisplayText } from "../../../utils/textPresentation.js";
import {
  CARE_STATUS_LABELS,
  MentalStatusBadge,
  RiskBadge,
  ThaiDateField,
  formatThaiDate,
} from "./schoolUi";

// Same rule as the student list: a care step in force wins, then whether
// the latest result needs screening, else that nothing was assessed.
function currentStatus(assessments, careStatuses) {
  const care = careStatuses[0];
  if (care && care.status !== "closed") return { status: care.status, care };
  const latest = assessments[0];
  if (!latest) return { status: "not_assessed" };
  return {
    status: latest.risk === "normal" ? "no_screening" : "screening",
    latest,
  };
}

export function StudentMentalStatus({ data, reload }) {
  const assessments = data.assessments.mental;
  const careStatuses = data.care_statuses || [];
  const { status, care, latest } = currentStatus(assessments, careStatuses);
  const latestResult = assessments[0];
  const empty = {
    status: "counselor_referral",
    effective_on: bangkokDateKey(new Date()),
    note: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await setStudentCareStatus(data.student.id, form);
      setForm(empty);
      await showSuccessToast("บันทึกสถานะแล้ว");
      await reload?.();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกสถานะไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="sch-insights-section sch-mental-status"
      aria-labelledby="mental-status-title"
    >
      <header className="sch-insights-section-head">
        <span className="sch-insights-section-icon" aria-hidden="true">
          <FiFlag />
        </span>
        <div>
          <h2 id="mental-status-title">สถานะสุขภาพจิต ณ วันนี้</h2>
          <p>
            ผลประเมินและคัดกรองคำนวณจากแบบประเมินครั้งล่าสุด
            ส่วนการส่งต่อและการติดตามบันทึกโดยครู
          </p>
        </div>
      </header>
      <dl className="sch-mental-now">
        <div>
          <dt>สถานะ</dt>
          <dd>
            <MentalStatusBadge status={status} />
            {care && (
              <span className="sch-sub">
                ตั้งแต่ {formatThaiDate(care.effective_on)}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>ผลประเมินล่าสุด</dt>
          <dd>
            {latestResult ? (
              <>
                <RiskBadge risk={latestResult.risk} />
                <span className="sch-sub">
                  {formatThaiDate(latestResult.submitted_at)} ·{" "}
                  {toDisplayText(latestResult.form_title)}
                </span>
                <span className="sch-sub">
                  {[latestResult.term_label, latestResult.classroom_label]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            ) : (
              <span className="sch-muted">ยังไม่มีการประเมิน</span>
            )}
          </dd>
        </div>
        {latest && !care && (
          <div>
            <dt>การคัดกรอง</dt>
            <dd>
              {latest.risk === "normal"
                ? "ผลอยู่ในเกณฑ์ปกติ ไม่ต้องคัดกรองเพิ่ม"
                : "ผลอยู่ในกลุ่มเฝ้าระวังหรือเสี่ยง ควรคัดกรองและพิจารณาส่งต่อ"}
            </dd>
          </div>
        )}
      </dl>

      {data.can_set_care_status && (
        <form className="sch-insights-form sch-care-form" onSubmit={save}>
          <label className="sch-field">
            <span>
              บันทึกสถานะการดูแล
              <span className="sch-required" aria-hidden="true">
                *
              </span>
            </span>
            <SearchableSelect
              value={form.status}
              disabled={saving}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(CARE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <ThaiDateField
            label="ตั้งแต่วันที่"
            required
            value={form.effective_on}
            onChange={(value) => setForm({ ...form, effective_on: value })}
          />
          <label className="sch-field sch-insights-wide">
            หมายเหตุ
            <textarea
              rows="3"
              maxLength="2000"
              value={form.note}
              disabled={saving}
              placeholder="เช่น ส่งต่อครูแนะแนวเพื่อพูดคุยเพิ่มเติม"
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <div className="sch-insights-actions">
            <button className="sch-btn sch-btn-primary" disabled={saving}>
              <FiSave aria-hidden="true" />
              {saving ? "กำลังบันทึก…" : "บันทึกสถานะ"}
            </button>
          </div>
        </form>
      )}

      <h3 className="sch-mental-subhead">
        <FiClock aria-hidden="true" /> ประวัติสถานะการดูแล
      </h3>
      {careStatuses.length ? (
        <ol className="sch-timeline sch-care-history">
          {careStatuses.map((item) => (
            <li key={item.id}>
              <div className="sch-timeline-body">
                <span className="sch-name">
                  <MentalStatusBadge status={item.status} />{" "}
                  {formatThaiDate(item.effective_on)}
                </span>
                <span className="sch-sub">
                  {[item.term_label, item.classroom_label]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {item.note && <p>{toDisplayText(item.note)}</p>}
                <span className="sch-sub">
                  <FiUser aria-hidden="true" /> {item.recorded_by || "-"}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="sch-muted">ยังไม่มีการบันทึกสถานะการดูแล</p>
      )}
    </section>
  );
}

// Every mental assessment grouped by academic year and semester, newest
// first, each with the class the student was in at the time.
export function MentalHistoryByTerm({ items }) {
  if (!items.length)
    return <p className="sch-muted">ยังไม่มีผลแบบประเมินในหมวดนี้</p>;
  const groups = [];
  for (const item of items) {
    const key = `${item.academic_year || ""}:${item.semester || ""}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: item.term_label || "ไม่ระบุภาคเรียน", items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return (
    <div className="sch-term-history">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h4 className="sch-term-head">
            <FiLayers aria-hidden="true" /> {group.label}
            <span className="sch-sub">{group.items.length} ครั้ง</span>
          </h4>
          <ol className="sch-timeline">
            {group.items.map((item) => (
              <li key={item.id} className={`risk-${item.risk}`}>
                <div className="sch-timeline-body">
                  <span className="sch-name">
                    <span className="sch-risk-dot" aria-hidden="true" />
                    {toDisplayText(item.form_title)}
                  </span>
                  <span className="sch-sub">
                    {formatThaiDate(item.submitted_at)}
                    {item.classroom_label
                      ? ` · ชั้น ${item.classroom_label}`
                      : ""}
                  </span>
                  {item.score_results.length > 0 && (
                    <ul className="sch-score-list">
                      {item.score_results.map((result, index) => (
                        <li key={index}>
                          {result.title ? `${result.title}: ` : ""}
                          {toDisplayText(result.label || "-")}
                          {result.score !== undefined && result.score !== null
                            ? ` (คะแนน ${result.score})`
                            : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <RiskBadge risk={item.risk} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
