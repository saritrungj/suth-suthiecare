import { useCallback, useEffect, useState } from "react";
import { FiPlus } from "react-icons/fi";
import {
  assignBehaviorReport,
  cancelBehaviorReport,
  createBehaviorReport,
  getBehaviorOptions,
  getBehaviorReport,
  getBehaviorReports,
  updateBehaviorStatus,
} from "../../../services/api";
import { confirmAlert, showSuccessToast } from "../../../utils/alerts";
import SearchableSelect from "../../../components/SearchableSelect";
import {
  RequiredMark,
  SchoolModal,
  TableScroll,
  ThaiDateField,
  formatThaiDate,
} from "./schoolUi";
import "./behavior.css";

// Shared pieces of the behaviour report feature: the label lists, the report
// form, the report file and the tab in the student file.

// Labels and the caller's behaviour rights (they follow the active unit).
export function useBehaviorOptions() {
  const [options, setOptions] = useState(null);
  useEffect(() => {
    let alive = true;
    getBehaviorOptions()
      .then(({ data }) => alive && setOptions(data))
      .catch(
        () =>
          alive &&
          setOptions({ categories: {}, levels: {}, statuses: {}, actions: {} }),
      );
    return () => {
      alive = false;
    };
  }, []);
  return options;
}

const STATUS_TONES = {
  new: "waiting",
  acknowledged: "active",
  following: "active",
  closed: "success",
  cancelled: "neutral",
};
export function BehaviorStatus({ status, labels }) {
  return (
    <span
      className={`sch-workflow-status is-${STATUS_TONES[status] || "neutral"}`}
    >
      <span aria-hidden="true" />
      {labels?.[status] || status}
    </span>
  );
}
const LEVEL_TONES = { low: "neutral", medium: "waiting", high: "danger" };
export function ConcernLevel({ level, labels }) {
  return (
    <span
      className={`sch-workflow-status is-${LEVEL_TONES[level] || "neutral"}`}
    >
      <span aria-hidden="true" />
      {labels?.[level] || level}
    </span>
  );
}

const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

export function BehaviorReportForm({
  studentId,
  studentLabel,
  onClose,
  onSaved,
}) {
  const options = useBehaviorOptions();
  const [form, setForm] = useState({
    category: "",
    concern_level: "low",
    observed_on: today(),
    details: "",
  });
  const [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!form.category || !form.observed_on || !form.details.trim()) {
      setError("กรุณาเลือกเรื่อง วันที่พบ และเขียนสิ่งที่สังเกตเห็น");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createBehaviorReport({ ...form, student_id: Number(studentId) });
      await showSuccessToast("ส่งรายงานพฤติกรรมแล้ว");
      onSaved?.();
    } catch (e) {
      setError(e.response?.data?.message || "ส่งรายงานไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      title="บันทึกพฤติกรรม"
      subtitle={studentLabel}
      onClose={onClose}
      size="small"
    >
      <form className="sch-form-grid" onSubmit={submit} noValidate>
        <label className="sch-field">
          <span>
            เรื่องที่พบ <RequiredMark />
          </span>
          <SearchableSelect
            aria-label="เรื่องที่พบ"
            value={form.category}
            disabled={saving || !options}
            onChange={set("category")}
          >
            <option value="">เลือกเรื่อง</option>
            {Object.entries(options?.categories || {}).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </SearchableSelect>
        </label>
        <ThaiDateField
          label="วันที่พบ"
          value={form.observed_on}
          onChange={(observed_on) => setForm({ ...form, observed_on })}
          required
        />
        <fieldset className="sch-full behavior-levels" disabled={saving}>
          <legend>ระดับความกังวล</legend>
          {Object.entries(options?.levels || {}).map(([code, label]) => (
            <label key={code}>
              <input
                type="radio"
                name="concern_level"
                value={code}
                checked={form.concern_level === code}
                onChange={set("concern_level")}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <label className="sch-field sch-full">
          <span>
            สิ่งที่สังเกตเห็น <RequiredMark />
          </span>
          <textarea
            rows={5}
            maxLength={4000}
            value={form.details}
            disabled={saving}
            onChange={set("details")}
            placeholder="เล่าสิ่งที่เห็นหรือได้ยิน เมื่อไร ที่ไหน โดยไม่ต้องสรุปว่าเป็นอะไร"
          />
        </label>
        <p className="sch-muted sch-full">
          รายงานจะส่งถึงครูประจำชั้นและครูแนะแนวที่ดูแลนักเรียนคนนี้
          ผู้ส่งจะเห็นสถานะการติดตามของรายงานตัวเอง
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
            {saving ? "กำลังส่ง…" : "ส่งรายงาน"}
          </button>
        </div>
      </form>
    </SchoolModal>
  );
}

export function BehaviorReportDetail({ id, onClose, onChanged }) {
  const options = useBehaviorOptions();
  const [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [status, setStatus] = useState(""),
    [note, setNote] = useState(""),
    [assignee, setAssignee] = useState("");
  const actions = options?.actions || {};
  const load = useCallback(async () => {
    try {
      const { data } = await getBehaviorReport(id);
      setReport(data);
      setStatus(data.status === "new" ? "acknowledged" : data.status);
      setAssignee(data.assigned_to ? String(data.assigned_to) : "");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดรายงานไม่สำเร็จ");
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (work, done) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await work();
      await showSuccessToast(done);
      setNote("");
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  const full = report?.access === "full";
  const open = report && report.status !== "cancelled";
  return (
    <SchoolModal
      title="รายงานพฤติกรรม"
      subtitle={
        report &&
        `${report.student_code} ${report.student_name || ""} · ${[report.grade_name, report.classroom_name].filter(Boolean).join("/") || "-"}`
      }
      onClose={onClose}
    >
      {!report && !error && <p role="status">กำลังโหลด…</p>}
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {report && (
        <div className="behavior-detail">
          <dl className="behavior-facts">
            <div>
              <dt>เรื่อง</dt>
              <dd>
                {options?.categories?.[report.category] || report.category}
              </dd>
            </div>
            <div>
              <dt>ระดับความกังวล</dt>
              <dd>
                <ConcernLevel
                  level={report.concern_level}
                  labels={options?.levels}
                />
              </dd>
            </div>
            <div>
              <dt>สถานะ</dt>
              <dd>
                <BehaviorStatus
                  status={report.status}
                  labels={options?.statuses}
                />
              </dd>
            </div>
            <div>
              <dt>วันที่พบ</dt>
              <dd>{formatThaiDate(report.observed_on)}</dd>
            </div>
            <div>
              <dt>ผู้รายงาน</dt>
              <dd>{report.reporter_name || "-"}</dd>
            </div>
            <div>
              <dt>ผู้รับผิดชอบ</dt>
              <dd>{report.assignee_name || "ยังไม่มอบหมาย"}</dd>
            </div>
          </dl>
          <section className="behavior-block">
            <h3>สิ่งที่สังเกตเห็น</h3>
            <p className="behavior-text">{report.details || "-"}</p>
          </section>
          <section className="behavior-block">
            <h3>ประวัติการติดตาม</h3>
            <ol className="behavior-history">
              {report.history.map((h) => (
                <li key={h.id}>
                  <BehaviorStatus
                    status={h.status}
                    labels={options?.statuses}
                  />
                  <span className="sch-muted">
                    {h.by || "-"} · {formatThaiDate(h.created_at)}
                  </span>
                  {h.assigned_to && (
                    <span className="sch-muted">มอบหมายผู้รับผิดชอบ</span>
                  )}
                  {h.note && <p className="behavior-text">{h.note}</p>}
                </li>
              ))}
            </ol>
            {!full && (
              <p className="sch-muted">
                บันทึกการติดตามเห็นได้เฉพาะผู้รับผิดชอบดูแลนักเรียน
              </p>
            )}
          </section>
          {full && open && actions.update && (
            <form
              className="sch-form-grid behavior-block"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () => updateBehaviorStatus(report.id, { status, note }),
                  "บันทึกการติดตามแล้ว",
                );
              }}
            >
              <h3 className="sch-full">บันทึกการติดตาม</h3>
              <label className="sch-field">
                <span>สถานะ</span>
                <SearchableSelect
                  aria-label="สถานะ"
                  value={status}
                  disabled={saving}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {Object.entries(options?.statuses || {})
                    .filter(([code]) => code !== "cancelled")
                    .map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                </SearchableSelect>
              </label>
              <label className="sch-field sch-full">
                <span>บันทึก</span>
                <textarea
                  rows={3}
                  maxLength={4000}
                  value={note}
                  disabled={saving}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="พูดคุยกับใคร ได้ข้อมูลอะไร และจะติดตามอย่างไรต่อ"
                />
              </label>
              <div className="sch-form-actions sch-full">
                <button className="sch-btn" disabled={saving}>
                  บันทึกการติดตาม
                </button>
              </div>
            </form>
          )}
          {full && open && actions.assign && report.assignees?.length > 0 && (
            <div className="sch-form-grid behavior-block">
              <label className="sch-field">
                <span>มอบหมายผู้รับผิดชอบ</span>
                <SearchableSelect
                  aria-label="มอบหมายผู้รับผิดชอบ"
                  value={assignee}
                  disabled={saving}
                  onChange={(event) => setAssignee(event.target.value)}
                >
                  <option value="">เลือกผู้รับผิดชอบ</option>
                  {report.assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <div className="sch-form-actions">
                <button
                  type="button"
                  className="sch-btn-secondary"
                  disabled={
                    saving ||
                    !assignee ||
                    String(report.assigned_to || "") === assignee
                  }
                  onClick={() =>
                    run(
                      () => assignBehaviorReport(report.id, Number(assignee)),
                      "มอบหมายผู้รับผิดชอบแล้ว",
                    )
                  }
                >
                  มอบหมาย
                </button>
              </div>
            </div>
          )}
          {full && open && actions.delete && (
            <div className="sch-form-actions behavior-block">
              <button
                type="button"
                className="sch-btn-ghost behavior-cancel"
                disabled={saving}
                onClick={async () => {
                  if (
                    await confirmAlert({
                      title: "ยกเลิกรายงานนี้?",
                      text: "รายงานจะยังอยู่ในประวัติ แต่ติดตามต่อไม่ได้",
                      confirmText: "ยกเลิกรายงาน",
                      danger: true,
                    })
                  )
                    run(
                      () => cancelBehaviorReport(report.id),
                      "ยกเลิกรายงานแล้ว",
                    );
                }}
              >
                ยกเลิกรายงาน
              </button>
            </div>
          )}
        </div>
      )}
    </SchoolModal>
  );
}

// The "พฤติกรรม" tab of the student file.
export function StudentBehaviorTab({ student }) {
  const options = useBehaviorOptions();
  const actions = options?.actions || {};
  const [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [creating, setCreating] = useState(false),
    [openId, setOpenId] = useState(null);
  const load = useCallback(async () => {
    try {
      const { data } = await getBehaviorReports({
        student_id: student.id,
        limit: 50,
      });
      setRows(Array.isArray(data?.data) ? data.data : []);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดรายงานพฤติกรรมไม่สำเร็จ");
    }
  }, [student.id]);
  useEffect(() => {
    load();
  }, [load]);
  const label = `${student.student_code} ${[student.prefix, student.first_name, student.last_name].filter(Boolean).join(" ")}`;
  return (
    <section className="sch-section">
      <div className="behavior-tab-head">
        <h3>รายงานพฤติกรรม</h3>
        {actions.create && (
          <button
            type="button"
            className="sch-btn"
            onClick={() => setCreating(true)}
          >
            <FiPlus aria-hidden="true" />
            บันทึกพฤติกรรม
          </button>
        )}
      </div>
      {!actions.view && (
        <p className="sch-muted">แสดงเฉพาะรายงานที่คุณเป็นผู้ส่ง</p>
      )}
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {rows && !rows.length && (
        <p className="sch-muted">ยังไม่มีรายงานพฤติกรรมของนักเรียนคนนี้</p>
      )}
      {rows?.length > 0 && (
        <TableScroll label="รายงานพฤติกรรมของนักเรียน">
          <table className="sch-table admin-data-table">
            <thead>
              <tr>
                <th>วันที่พบ</th>
                <th>เรื่อง</th>
                <th>ระดับ</th>
                <th>สถานะ</th>
                <th>ผู้รายงาน</th>
                <th className="is-actions">ดู</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatThaiDate(r.observed_on)}</td>
                  <td>{options?.categories?.[r.category] || r.category}</td>
                  <td>
                    <ConcernLevel
                      level={r.concern_level}
                      labels={options?.levels}
                    />
                  </td>
                  <td>
                    <BehaviorStatus
                      status={r.status}
                      labels={options?.statuses}
                    />
                  </td>
                  <td>{r.reporter_name || "-"}</td>
                  <td className="is-actions">
                    <button
                      type="button"
                      className="sch-btn-secondary"
                      onClick={() => setOpenId(r.id)}
                    >
                      เปิด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
      {creating && (
        <BehaviorReportForm
          studentId={student.id}
          studentLabel={label}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}
      {openId && (
        <BehaviorReportDetail
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </section>
  );
}
