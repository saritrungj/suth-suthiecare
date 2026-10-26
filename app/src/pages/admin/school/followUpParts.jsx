import { useCallback, useEffect, useState } from "react";
import {
  getFollowUp,
  getFollowUps,
  updateFollowUp,
} from "../../../services/api";
import { showSuccessToast } from "../../../utils/alerts";
import SearchableSelect from "../../../components/SearchableSelect";
import {
  SchoolModal,
  TableScroll,
  ThaiDateField,
  formatThaiDate,
} from "./schoolUi";
import "./behavior.css";

// Physical-health follow-up items opened by the school's risk rules: the
// status pill, the item editor and the list inside the student file.

const TONES = {
  open: "waiting",
  in_progress: "active",
  done: "success",
  cancelled: "neutral",
};
export function FollowUpStatus({ status, labels }) {
  return (
    <span className={`sch-workflow-status is-${TONES[status] || "neutral"}`}>
      <span aria-hidden="true" />
      {labels?.[status] || status}
    </span>
  );
}

const todayIso = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
export const isOverdue = (item) =>
  ["open", "in_progress"].includes(item.status) &&
  item.due_on &&
  String(item.due_on).slice(0, 10) < todayIso();

export function FollowUpDetail({ id, labels, canUpdate, onClose, onChanged }) {
  const [item, setItem] = useState(null),
    [form, setForm] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    getFollowUp(id)
      .then(({ data }) => {
        setItem(data);
        setForm({
          status: data.status === "open" ? "in_progress" : data.status,
          result: data.result || "",
          assigned_to: data.assigned_to ? String(data.assigned_to) : "",
          due_on: data.due_on ? String(data.due_on).slice(0, 10) : "",
        });
      })
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดรายการติดตามไม่สำเร็จ"),
      );
  }, [id]);
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await updateFollowUp(id, {
        ...form,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
        due_on: form.due_on || null,
      });
      await showSuccessToast("บันทึกการติดตามแล้ว");
      onChanged?.();
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };
  const set = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  return (
    <SchoolModal
      title="ติดตามภาวะเสี่ยงทางกาย"
      subtitle={
        item &&
        `${item.student_code} ${item.student_name || ""} · ${[item.grade_name, item.classroom_name].filter(Boolean).join("/") || "-"}`
      }
      onClose={onClose}
      size="small"
    >
      {!item && !error && <p role="status">กำลังโหลด…</p>}
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {item && form && (
        <form className="sch-form-grid" onSubmit={save}>
          <dl className="behavior-facts sch-full">
            <div>
              <dt>เกณฑ์ที่พบ</dt>
              <dd>{item.rule_label}</dd>
            </div>
            <div>
              <dt>ค่าที่ตรวจได้</dt>
              <dd>
                {item.value ?? "-"} ({formatThaiDate(item.measured_at)})
              </dd>
            </div>
            <div>
              <dt>สถานะ</dt>
              <dd>
                <FollowUpStatus status={item.status} labels={labels} />
              </dd>
            </div>
          </dl>
          {canUpdate ? (
            <>
              <label className="sch-field">
                <span>สถานะ</span>
                <SearchableSelect
                  aria-label="สถานะการติดตาม"
                  value={form.status}
                  disabled={saving}
                  onChange={set("status")}
                >
                  {Object.entries(labels || {}).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <ThaiDateField
                label="กำหนดติดตาม"
                value={form.due_on}
                allowFuture
                onChange={(due_on) => setForm({ ...form, due_on })}
              />
              <label className="sch-field sch-full">
                <span>ผู้รับผิดชอบ</span>
                <SearchableSelect
                  aria-label="ผู้รับผิดชอบ"
                  value={form.assigned_to}
                  disabled={saving}
                  onChange={set("assigned_to")}
                >
                  <option value="">ยังไม่มอบหมาย</option>
                  {item.assignees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </SearchableSelect>
              </label>
              <label className="sch-field sch-full">
                <span>ผลการติดตาม</span>
                <textarea
                  rows={4}
                  maxLength={4000}
                  value={form.result}
                  disabled={saving}
                  onChange={set("result")}
                  placeholder="ทำอะไรไปแล้ว ส่งต่อที่ไหน และผลเป็นอย่างไร"
                />
              </label>
              <div className="sch-form-actions sch-full">
                <button
                  type="button"
                  className="sch-btn-secondary"
                  onClick={onClose}
                >
                  ปิด
                </button>
                <button className="sch-btn" disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึกการติดตาม"}
                </button>
              </div>
            </>
          ) : (
            <p className="sch-full behavior-text">
              {item.result || "ยังไม่มีผลการติดตาม"}
            </p>
          )}
        </form>
      )}
    </SchoolModal>
  );
}

// Follow-ups of one student, shown above the physical-health tab.
export function StudentFollowUps({ studentId }) {
  const [result, setResult] = useState(null),
    [openId, setOpenId] = useState(null);
  const load = useCallback(() => {
    getFollowUps({ student_id: studentId, limit: 50 })
      // A section of the student file: an odd response hides it, never the file.
      .then(({ data }) => setResult(Array.isArray(data?.data) ? data : null))
      .catch(() => setResult(null));
  }, [studentId]);
  useEffect(() => {
    load();
  }, [load]);
  if (!result?.data?.length) return null;
  return (
    <section className="sch-section">
      <h3>รายการที่ต้องติดตาม</h3>
      <TableScroll label="รายการที่ต้องติดตามด้านสุขภาพกาย">
        <table className="sch-table admin-data-table">
          <thead>
            <tr>
              <th>เกณฑ์ที่พบ</th>
              <th>ค่าที่ตรวจได้</th>
              <th>กำหนดติดตาม</th>
              <th>สถานะ</th>
              <th className="is-actions">ดู</th>
            </tr>
          </thead>
          <tbody>
            {result.data.map((item) => (
              <tr key={item.id}>
                <td>{item.rule_label}</td>
                <td>{item.value ?? "-"}</td>
                <td className={isOverdue(item) ? "sch-error" : undefined}>
                  {item.due_on ? formatThaiDate(item.due_on) : "-"}
                  {isOverdue(item) ? " (เลยกำหนด)" : ""}
                </td>
                <td>
                  <FollowUpStatus
                    status={item.status}
                    labels={result.statuses}
                  />
                </td>
                <td className="is-actions">
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    onClick={() => setOpenId(item.id)}
                  >
                    เปิด
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      {openId && (
        <FollowUpDetail
          id={openId}
          labels={result.statuses}
          canUpdate={result.can_update}
          onClose={() => setOpenId(null)}
          onChanged={load}
        />
      )}
    </section>
  );
}
