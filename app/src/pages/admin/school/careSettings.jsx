import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus } from "react-icons/fi";
import {
  createPhysicalRule,
  getCareGuidance,
  getNotificationSettings,
  getPhysicalRules,
  saveNotificationSettings,
  getStudentCareGuidance,
  saveCareGuidance,
  updatePhysicalRule,
} from "../../../services/api";
import { showSuccessToast } from "../../../utils/alerts";
import SearchableSelect from "../../../components/SearchableSelect";
import {
  GENDER_LABELS,
  RISK_LABELS,
  SchoolModal,
  TableScroll,
} from "./schoolUi";
import "./behavior.css";

// School care settings: step-by-step guidance for teachers per risk level and
// the physical risk rules. Nothing clinical is pre-filled; each school writes
// and approves its own content.

export const GUIDANCE_STEPS = [
  ["observe", "สังเกต", "เช่น สิ่งที่ครูควรสังเกตในห้องเรียนหรือการมาเรียน"],
  ["talk", "พูดคุย", "เช่น วิธีเริ่มคุยกับนักเรียน และประโยคที่ควรใช้"],
  ["follow_up", "ติดตาม", "เช่น ติดตามบ่อยแค่ไหน และบันทึกอะไร"],
  ["refer", "ส่งต่อ", "เช่น ส่งต่อเมื่อไรและส่งให้ใคร"],
];
const STEP_LABELS = Object.fromEntries(GUIDANCE_STEPS.map(([k, l]) => [k, l]));

// The written steps for one risk level, as a numbered list.
export function GuidanceSteps({ steps, className = "" }) {
  if (!steps?.length) return null;
  return (
    <ol className={`care-steps ${className}`}>
      {steps.map(({ step, text }) => (
        <li key={step}>
          <strong>{STEP_LABELS[step] || step}</strong>
          <span>{text}</span>
        </li>
      ))}
    </ol>
  );
}

// Guidance for a student's latest risk, at the top of the mental-health tab.
export function StudentCareGuidance({ studentId }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    getStudentCareGuidance(studentId)
      .then(({ data }) => setData(data))
      .catch(() => setData(null));
  }, [studentId]);
  if (!data || (!data.care_advice && !data.care_guidance?.length)) return null;
  return (
    <section
      className="sch-section care-guidance-box"
      aria-label="แนวทางการดูแลสำหรับครู"
    >
      <h3>แนวทางการดูแลสำหรับครู · {RISK_LABELS[data.risk] || data.risk}</h3>
      {data.care_advice && <p className="behavior-text">{data.care_advice}</p>}
      <GuidanceSteps steps={data.care_guidance} />
    </section>
  );
}

// Who hears about an at-risk mental-health assessment, and at which levels.
export function RiskAlertSettings({ schoolId, canEdit }) {
  const [settings, setSettings] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    setSettings(null);
    getNotificationSettings(schoolId)
      .then(({ data }) => setSettings(data.risk_alerts))
      .catch((e) =>
        setError(
          e.response?.data?.message || "โหลดการตั้งค่าแจ้งเตือนไม่สำเร็จ",
        ),
      );
  }, [schoolId]);
  const toggleLevel = (level, on) =>
    setSettings({
      ...settings,
      levels: on
        ? [...new Set([...settings.levels, level])]
        : settings.levels.filter((l) => l !== level),
    });
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (settings.enabled && !settings.levels.length) {
      setError("เลือกระดับที่จะแจ้งอย่างน้อยหนึ่งระดับ หรือปิดการแจ้งเตือน");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveNotificationSettings(schoolId, { risk_alerts: settings });
      await showSuccessToast("บันทึกการตั้งค่าแจ้งเตือนแล้ว");
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="sch-data-section" aria-labelledby="risk-alert-title">
      <h3 id="risk-alert-title">แจ้งเตือนกลุ่มเสี่ยง</h3>
      <p className="sch-muted">
        เมื่อนักเรียนส่งแบบประเมินสุขภาพจิตแล้วผลอยู่ในระดับที่เลือก
        ครูประจำชั้นของห้องและครูแนะแนวที่ดูแลระดับชั้นนั้นจะได้รับแจ้งเตือนในระบบ
        แจ้งเฉพาะชื่อ ห้อง ระดับความเสี่ยง และคำแนะนำโดยย่อ
        ไม่แสดงคะแนนหรือคำตอบ
      </p>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {!settings && !error && <p role="status">กำลังโหลด…</p>}
      {settings && (
        <form className="sch-form-grid" onSubmit={save}>
          <label className="sch-full care-approve">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={!canEdit || saving}
              onChange={(e) =>
                setSettings({ ...settings, enabled: e.target.checked })
              }
            />
            เปิดการแจ้งเตือนกลุ่มเสี่ยง
          </label>
          <fieldset
            className="sch-full behavior-levels"
            disabled={!canEdit || saving || !settings.enabled}
          >
            <legend>แจ้งเมื่อผลอยู่ในระดับ</legend>
            {[
              ["high", RISK_LABELS.high],
              ["medium", RISK_LABELS.medium],
            ].map(([level, label]) => (
              <label key={level}>
                <input
                  type="checkbox"
                  checked={settings.levels.includes(level)}
                  onChange={(e) => toggleLevel(level, e.target.checked)}
                />
                {label}
              </label>
            ))}
            <label>
              <input
                type="checkbox"
                checked={settings.mental_admins}
                onChange={(e) =>
                  setSettings({ ...settings, mental_admins: e.target.checked })
                }
              />
              แจ้งแอดมินสุขภาพจิตด้วย
            </label>
          </fieldset>
          {canEdit && (
            <div className="sch-form-actions sch-full">
              <button className="sch-btn" disabled={saving}>
                {saving ? "กำลังบันทึก…" : "บันทึกการแจ้งเตือน"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

export function CareGuidanceSettings({ schoolId, canEdit }) {
  const [data, setData] = useState(null),
    [risk, setRisk] = useState("high"),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    setData(null);
    getCareGuidance(schoolId)
      .then(({ data }) => setData(data))
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดคำแนะนำไม่สำเร็จ"),
      );
  }, [schoolId]);
  const setAdvice = (value) =>
    setData({ ...data, care_advice: { ...data.care_advice, [risk]: value } });
  const setStep = (step, value) =>
    setData({
      ...data,
      care_guidance: {
        ...data.care_guidance,
        [risk]: { ...data.care_guidance[risk], [step]: value },
      },
    });
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveCareGuidance(schoolId, data);
      await showSuccessToast("บันทึกคำแนะนำแล้ว");
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="sch-data-section" aria-labelledby="care-guidance-title">
      <h3 id="care-guidance-title">คำแนะนำสำหรับครู</h3>
      <p className="sch-muted">
        ครูทั่วไปและครูรายวิชาเห็นคำแนะนำตามระดับความเสี่ยงล่าสุดของนักเรียน
        ครูที่ดูแลข้อมูลสุขภาพจิตเห็นในแฟ้มนักเรียนด้วย
        เขียนแนวทางที่โรงเรียนเห็นชอบแล้ว
      </p>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">กำลังโหลด…</p>}
      {data && (
        <form className="sch-form-grid" onSubmit={save}>
          <div
            className="care-risk-tabs sch-full"
            role="group"
            aria-label="ระดับความเสี่ยง"
          >
            {Object.entries(RISK_LABELS).map(([code, label]) => (
              <button
                type="button"
                key={code}
                aria-pressed={risk === code}
                className={risk === code ? "is-active" : ""}
                onClick={() => setRisk(code)}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="sch-field sch-full">
            <span>คำแนะนำโดยย่อ</span>
            <textarea
              rows={2}
              maxLength={2000}
              value={data.care_advice[risk] || ""}
              disabled={!canEdit || saving}
              onChange={(e) => setAdvice(e.target.value)}
            />
          </label>
          {GUIDANCE_STEPS.map(([step, label, placeholder], index) => (
            <label className="sch-field" key={step}>
              <span>
                {index + 1}. {label}
              </span>
              <textarea
                rows={3}
                maxLength={2000}
                value={data.care_guidance[risk]?.[step] || ""}
                disabled={!canEdit || saving}
                placeholder={placeholder}
                onChange={(e) => setStep(step, e.target.value)}
              />
            </label>
          ))}
          {canEdit && (
            <div className="sch-form-actions sch-full">
              <button className="sch-btn" disabled={saving}>
                {saving ? "กำลังบันทึก…" : "บันทึกคำแนะนำทุกระดับ"}
              </button>
            </div>
          )}
        </form>
      )}
    </section>
  );
}

const EMPTY_RULE = {
  metric: "bmi",
  comparator: "gt",
  threshold_low: "",
  threshold_high: "",
  age_min: "",
  age_max: "",
  sex: "",
  label: "",
  follow_up_days: "",
  status: "active",
  approved: false,
};
const usesLow = (c) => ["lt", "lte", "outside"].includes(c);
const usesHigh = (c) => ["gt", "gte", "outside"].includes(c);

function describe(rule, meta) {
  const metric = meta?.metrics?.[rule.metric] || rule.metric;
  const op = meta?.comparators?.[rule.comparator] || rule.comparator;
  const value =
    rule.comparator === "outside"
      ? `${Number(rule.threshold_low)}–${Number(rule.threshold_high)}`
      : Number(
          usesLow(rule.comparator) ? rule.threshold_low : rule.threshold_high,
        );
  return `${metric} ${op} ${value}`;
}
function who(rule) {
  const parts = [];
  if (rule.sex) parts.push(GENDER_LABELS[rule.sex] || rule.sex);
  if (rule.age_min !== null || rule.age_max !== null)
    parts.push(`อายุ ${rule.age_min ?? 0}–${rule.age_max ?? "∞"} ปี`);
  return parts.join(" · ") || "ทุกคน";
}

function RuleForm({ schoolId, initial, meta, onClose, onSaved }) {
  const [form, setForm] = useState(
    initial
      ? Object.fromEntries(
          Object.keys(EMPTY_RULE).map((k) => [
            k,
            k === "approved" ? false : (initial[k] ?? ""),
          ]),
        )
      : EMPTY_RULE,
  );
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const set = (key) => (event) =>
    setForm({
      ...form,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    });
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.approved) {
      setError(
        "กรุณายืนยันว่าเกณฑ์นี้ผ่านการเห็นชอบจากผู้รับผิดชอบงานสุขภาพแล้ว",
      );
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      ...form,
      school_id: Number(schoolId),
      sex: form.sex || null,
    };
    try {
      if (initial) await updatePhysicalRule(initial.id, body);
      else await createPhysicalRule(body);
      await showSuccessToast("บันทึกเกณฑ์แล้ว");
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกเกณฑ์ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      title={
        initial ? "แก้ไขเกณฑ์ภาวะเสี่ยงทางกาย" : "เพิ่มเกณฑ์ภาวะเสี่ยงทางกาย"
      }
      onClose={onClose}
      size="small"
    >
      <form className="sch-form-grid" onSubmit={submit} noValidate>
        <label className="sch-field sch-full">
          <span>ชื่อเกณฑ์</span>
          <input
            maxLength={160}
            value={form.label}
            onChange={set("label")}
            placeholder="ชื่อที่ครูจะเห็นในรายการติดตาม"
          />
        </label>
        <label className="sch-field">
          <span>ค่าที่ตรวจ</span>
          <SearchableSelect
            aria-label="ค่าที่ตรวจ"
            value={form.metric}
            onChange={set("metric")}
          >
            {Object.entries(meta?.metrics || {}).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </SearchableSelect>
        </label>
        <label className="sch-field">
          <span>เงื่อนไข</span>
          <SearchableSelect
            aria-label="เงื่อนไข"
            value={form.comparator}
            onChange={set("comparator")}
          >
            {Object.entries(meta?.comparators || {}).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </SearchableSelect>
        </label>
        {usesLow(form.comparator) && (
          <label className="sch-field">
            <span>
              {form.comparator === "outside"
                ? "ค่าต่ำสุดของช่วงปกติ"
                : "ค่าเกณฑ์"}
            </span>
            <input
              type="number"
              step="0.1"
              value={form.threshold_low}
              onChange={set("threshold_low")}
            />
          </label>
        )}
        {usesHigh(form.comparator) && (
          <label className="sch-field">
            <span>
              {form.comparator === "outside"
                ? "ค่าสูงสุดของช่วงปกติ"
                : "ค่าเกณฑ์"}
            </span>
            <input
              type="number"
              step="0.1"
              value={form.threshold_high}
              onChange={set("threshold_high")}
            />
          </label>
        )}
        <label className="sch-field">
          <span>อายุตั้งแต่ (ปี)</span>
          <input
            type="number"
            min="0"
            max="30"
            value={form.age_min}
            onChange={set("age_min")}
          />
        </label>
        <label className="sch-field">
          <span>ถึงอายุ (ปี)</span>
          <input
            type="number"
            min="0"
            max="30"
            value={form.age_max}
            onChange={set("age_max")}
          />
        </label>
        <label className="sch-field">
          <span>เพศ</span>
          <SearchableSelect
            aria-label="เพศ"
            value={form.sex}
            onChange={set("sex")}
          >
            <option value="">ทุกเพศ</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
          </SearchableSelect>
        </label>
        <label className="sch-field">
          <span>ติดตามภายใน (วัน)</span>
          <input
            type="number"
            min="1"
            max="365"
            value={form.follow_up_days}
            onChange={set("follow_up_days")}
          />
        </label>
        {initial && (
          <label className="sch-field">
            <span>สถานะ</span>
            <SearchableSelect
              aria-label="สถานะเกณฑ์"
              value={form.status}
              onChange={set("status")}
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </SearchableSelect>
          </label>
        )}
        <label className="sch-full care-approve">
          <input
            type="checkbox"
            checked={form.approved}
            onChange={set("approved")}
          />
          เกณฑ์นี้ผ่านการเห็นชอบจากผู้รับผิดชอบงานสุขภาพของโรงเรียนแล้ว
        </label>
        <p className="sch-muted sch-full">
          เกณฑ์มีผลกับผลตรวจที่บันทึกหลังจากนี้
          นักเรียนที่เข้าเกณฑ์จะอยู่ในรายการติดตามสุขภาพกาย
        </p>
        {error && (
          <p className="sch-error sch-full" role="alert">
            {error}
          </p>
        )}
        <div className="sch-form-actions sch-full">
          <button type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="sch-btn" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกเกณฑ์"}
          </button>
        </div>
      </form>
    </SchoolModal>
  );
}

export function PhysicalRiskRules({ schoolId, rights }) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(null);
  const load = useCallback(() => {
    getPhysicalRules(schoolId)
      .then(({ data }) => {
        setData(data);
        setError("");
      })
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดเกณฑ์ไม่สำเร็จ"),
      );
  }, [schoolId]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <section
      className="sch-data-section"
      aria-labelledby="physical-rules-title"
    >
      <div className="behavior-tab-head">
        <h3 id="physical-rules-title">เกณฑ์ภาวะเสี่ยงทางกาย</h3>
        {rights?.create && (
          <button
            type="button"
            className="sch-btn"
            onClick={() => setEditing({})}
          >
            <FiPlus aria-hidden="true" />
            เพิ่มเกณฑ์
          </button>
        )}
      </div>
      <p className="sch-muted">
        ระบบไม่มีเกณฑ์ตั้งต้น ให้ผู้รับผิดชอบงานสุขภาพกำหนดค่าที่โรงเรียนใช้
        เช่น BMI หรือความดันเกินเกณฑ์
      </p>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {data && (
        <TableScroll label="เกณฑ์ภาวะเสี่ยงทางกาย">
          <table className="sch-table admin-data-table">
            <thead>
              <tr>
                <th>ชื่อเกณฑ์</th>
                <th>เงื่อนไข</th>
                <th>ใช้กับ</th>
                <th>ติดตามภายใน</th>
                <th>สถานะ</th>
                {rights?.update && <th className="is-actions">แก้ไข</th>}
              </tr>
            </thead>
            <tbody>
              {!data.rules.length && (
                <tr>
                  <td colSpan={6} className="sch-empty-row">
                    <strong>ยังไม่มีเกณฑ์</strong>
                    <span>
                      เพิ่มเกณฑ์ที่โรงเรียนเห็นชอบแล้วเพื่อเริ่มติดตาม
                    </span>
                  </td>
                </tr>
              )}
              {data.rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.label}</td>
                  <td>{describe(rule, data)}</td>
                  <td>{who(rule)}</td>
                  <td>
                    {rule.follow_up_days ? `${rule.follow_up_days} วัน` : "-"}
                  </td>
                  <td>
                    <span
                      className={`sch-workflow-status is-${rule.status === "active" ? "success" : "neutral"}`}
                    >
                      <span aria-hidden="true" />
                      {rule.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  {rights?.update && (
                    <td className="is-actions">
                      <button
                        type="button"
                        className="sch-btn-secondary"
                        aria-label={`แก้ไขเกณฑ์ ${rule.label}`}
                        onClick={() => setEditing(rule)}
                      >
                        <FiEdit2 aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      {editing && (
        <RuleForm
          schoolId={schoolId}
          initial={editing.id ? editing : null}
          meta={data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}
