import SearchableSelect from "../../../components/SearchableSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, {
  getForms,
  getSchoolStudents,
  getSchoolTeachers,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  PageHeader,
  BarSelect,
  TableScroll,
  ThaiDateField,
  SchoolModal,
  useSchools,
  currentAcademicYear,
  formatThaiDate,
  RISK_LABELS,
} from "./schoolUi";
import {
  readTeacherFile,
  saveTeacherWorkbook,
} from "../../../utils/teacherImport";
import "./school.css";
import TablePagination from "../../../components/table/TablePagination";
import usePagedRows from "../../../components/table/usePagedRows";
import ResultSummary from "../../../components/table/ResultSummary";
import { RiskPill } from "../../../components/case/CaseDrawer";
import {
  FiActivity,
  FiCalendar,
  FiCheckCircle,
  FiClipboard,
  FiDownload,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiRepeat,
  FiSlash,
  FiUploadCloud,
  FiUsers,
} from "react-icons/fi";

function useLoad(url) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(url);
      setData(data);
    } catch (e) {
      setError(e.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    if (!url) return;
    setLoading(true);
    api
      .get(url)
      .then(({ data }) => {
        if (alive) setData(data);
      })
      .catch(
        (e) =>
          alive && setError(e.response?.data?.message || "โหลดข้อมูลไม่สำเร็จ"),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url]);
  return { data, error, loading, load };
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const run = async (work, success = "บันทึกเรียบร้อย") => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
      setMessage(success);
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message ||
          "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, message, run };
}
function Notice({ error, message, loading }) {
  return (
    <>
      {error && (
        <p role="alert" className="sch-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="sch-notice sch-notice--success">
          <FiCheckCircle aria-hidden="true" />
          {message}
        </p>
      )}
      {loading && (
        <p role="status" className="sch-notice">
          <span className="sch-loading-dot" aria-hidden="true" />
          กำลังโหลดข้อมูล…
        </p>
      )}
    </>
  );
}
function Field({ label, children }) {
  return (
    <label className="sch-field">
      {toDisplayText(label)}
      {children}
    </label>
  );
}
function DataTable({ label, columns, rows }) {
  const { pageRows, pagination, setPage, setLimit } = usePagedRows(rows || []);
  return (
    <section className="sch-data-section" aria-label={label}>
      <div className="sch-data-head">
        <h3>{label}</h3>
        <ResultSummary pagination={pagination} />
      </div>
      <TableScroll label={label}>
        <table className="sch-table admin-data-table">
          <thead>
            <tr>
              {columns.map(([key, title]) => (
                <th key={key} scope="col">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((row, i) => (
                <tr key={row.id || i}>
                  {columns.map(([key, title, render]) => (
                    <td key={key} data-label={title}>
                      {render ? render(row) : (row[key] ?? "–")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="sch-empty-row">
                  <FiClipboard aria-hidden="true" />
                  <strong>ยังไม่มีรายการ</strong>
                  <span>ข้อมูลที่บันทึกไว้จะแสดงในส่วนนี้</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </TableScroll>
      <TablePagination
        page={pagination.page}
        totalPages={pagination.total_pages}
        total={pagination.total}
        limit={pagination.limit}
        onPage={setPage}
        onLimit={setLimit}
      />
    </section>
  );
}

function StatusBadge({ tone = "neutral", children }) {
  return (
    <span className={`sch-workflow-status is-${tone}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
function FormSelect({ forms, value, onChange, domain, required = true }) {
  return (
    <Field label="แบบประเมิน">
      <SearchableSelect
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">เลือกแบบประเมิน</option>
        {forms
          .filter((f) => !domain || f.health_domain === domain)
          .map((f) => (
            <option key={f.id} value={f.id}>
              {toDisplayText(f.title)}
            </option>
          ))}
      </SearchableSelect>
    </Field>
  );
}

export default function SchoolWorkflows() {
  const { schoolAccess: access } = usePermissions(),
    {
      schools,
      schoolId,
      setSchoolId,
      loading: schoolsLoading,
      error: schoolsError,
      reload: reloadSchools,
    } = useSchools();
  const [tab, setTab] = useState(
      access?.can_view_risk === false ? "rounds" : "risk",
    ),
    [forms, setForms] = useState([]);
  useEffect(() => {
    getForms("latest")
      .then(({ data }) => setForms(Array.isArray(data) ? data : []))
      .catch(() => setForms([]));
  }, [schoolId]);
  const primaryTabs = [
    ...(access?.can_view_risk !== false
      ? [{ key: "risk", label: "ภาพรวมความเสี่ยง", icon: FiActivity }]
      : []),
    { key: "rounds", label: "รอบประเมิน", icon: FiCalendar },
    ...(access?.can_view_mental
      ? [{ key: "followup", label: "คัดกรองซ้ำ", icon: FiRepeat }]
      : []),
  ];
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="คัดกรองและติดตามโรงเรียน"
          description="จัดรอบประเมิน ติดตามนักเรียน และเตรียมข้อมูลก่อนเปิดภาคเรียน"
        >
          <BarSelect
            label="โรงเรียน"
            value={schoolId}
            onChange={setSchoolId}
            disabled={schoolsLoading || !schools.length}
          >
            {!schools.length && (
              <option value="">
                {schoolsLoading ? "กำลังโหลด…" : "ยังไม่มีโรงเรียน"}
              </option>
            )}
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </BarSelect>
          <Link className="sch-btn-secondary" to="/admin/school/students">
            รายชื่อนักเรียน
          </Link>
        </PageHeader>
        {schoolsError && (
          <div className="sch-card">
            <p className="sch-error" role="alert">
              {schoolsError}
            </p>
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={reloadSchools}
            >
              โหลดโรงเรียนใหม่
            </button>
          </div>
        )}
        <nav className="sch-workflow-nav" aria-label="งานคัดกรองและติดตาม">
          {primaryTabs.map(({ key, label, icon: Icon }) => (
            <button
              type="button"
              key={key}
              className={tab === key ? "is-active" : ""}
              aria-current={tab === key ? "page" : undefined}
              aria-controls="school-workflow-panel"
              onClick={() => setTab(key)}
            >
              <Icon aria-hidden="true" />
              {toDisplayText(label)}
            </button>
          ))}
        </nav>
        {!schoolId ? (
          <p role="status">
            {schoolsLoading
              ? "กำลังโหลดโรงเรียน…"
              : "ยังไม่มีโรงเรียนที่พร้อมใช้งาน"}
          </p>
        ) : (
          <section
            className="sch-card sch-workflow-surface"
            id="school-workflow-panel"
            role="tabpanel"
            key={`${schoolId}-${tab}`}
          >
            {tab === "risk" && <RiskSummary schoolId={schoolId} />}{" "}
            {tab === "rounds" && (
              <Rounds
                schoolId={schoolId}
                forms={forms}
                manage={access?.can_manage_workflows}
                rights={access?.workflow_actions}
              />
            )}{" "}
            {tab === "followup" && access?.can_view_mental && (
              <Followup
                schoolId={schoolId}
                forms={forms}
                canAssign={access?.health_actions?.assign ?? true}
              />
            )}{" "}
          </section>
        )}
      </main>
    </div>
  );
}
function RiskSummary({ schoolId }) {
  const [boarders, setBoarders] = useState(false),
    [risk, setRisk] = useState("");
  const state = useLoad(
    `/school/risk-summary?school_id=${schoolId}${boarders ? "&is_boarder=1" : ""}`,
  );
  const allRows = state.data?.data || [];
  const rows = allRows.filter((r) => !risk || r.risk_status === risk);
  const riskCounts = Object.keys(RISK_LABELS).reduce((counts, key) => {
    counts[key] = allRows.filter((row) => row.risk_status === key).length;
    return counts;
  }, {});
  return (
    <>
      <div className="sch-workflow-heading">
        <div>
          <h2>ภาพรวมความเสี่ยงและคำแนะนำการดูแล</h2>
          <p>
            สรุปจำนวนตามระดับความเสี่ยงและคำแนะนำที่โรงเรียนกำหนด
            การติดตามรายเคสทำในหน้าเคสเสี่ยง
          </p>
        </div>
        <Link className="sch-btn-secondary" to="/admin/risk-cases">
          เปิดหน้าเคสเสี่ยง
        </Link>
      </div>
      <div className="sch-risk-summary" aria-label="สรุประดับความเสี่ยง">
        {Object.entries(RISK_LABELS).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={`sch-risk-summary-item risk-${key} ${risk === key ? "is-active" : ""}`}
            aria-pressed={risk === key}
            onClick={() => setRisk(risk === key ? "" : key)}
          >
            <span>{label}</span>
            <strong>{riskCounts[key] || 0}</strong>
          </button>
        ))}
      </div>
      <div className="sch-workflow-toolbar">
        <Field label="ระดับความเสี่ยง">
          <SearchableSelect
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
          >
            <option value="">ทุกระดับ</option>
            {Object.entries(RISK_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {toDisplayText(label)}
              </option>
            ))}
          </SearchableSelect>
        </Field>
        <label className="sch-check">
          <input
            type="checkbox"
            checked={boarders}
            onChange={(e) => setBoarders(e.target.checked)}
          />
          เฉพาะนักเรียนหอพัก
        </label>
      </div>
      <Notice {...state} />
      {state.error && (
        <button className="sch-btn-secondary" onClick={state.load}>
          ลองใหม่
        </button>
      )}
      <DataTable
        label="ภาพรวมความเสี่ยง"
        rows={rows}
        columns={[
          ["student_code", "รหัสนักเรียน"],
          ["student_name", "ชื่อ–นามสกุล"],
          [
            "classroom_name",
            "ชั้น / ห้อง",
            (r) =>
              [r.grade_name, r.classroom_name ? `ห้อง ${r.classroom_name}` : ""]
                .filter(Boolean)
                .join(" ") || "-",
          ],
          ["is_boarder", "ที่พัก", (r) => (r.is_boarder ? "หอพัก" : "ไปกลับ")],
          [
            "risk_status",
            "ความเสี่ยง",
            (r) => (
              <RiskPill
                level={r.risk_status === "normal" ? "low" : r.risk_status}
                label={RISK_LABELS[r.risk_status]}
              />
            ),
          ],
          [
            "assessed_on",
            "วันที่ประเมิน",
            (r) => formatThaiDate(r.assessed_on),
          ],
          ["care_advice", "คำแนะนำการดูแล"],
        ]}
      />
    </>
  );
}
// rights: workflow actions from the roles page (create rounds, update their status).
function Rounds({ schoolId, forms, manage, rights }) {
  const canCreate = rights ? rights.create : manage;
  const canUpdate = rights ? rights.update : manage;
  const state = useLoad("/school/screening-rounds"),
    action = useAction();
  const [form, setForm] = useState({
      school_id: Number(schoolId),
      name: "",
      academic_year: currentAcademicYear(),
      semester: "2",
      health_domain: "mental",
      form_id: "",
      starts_on: "",
      ends_on: "",
    }),
    [selected, setSelected] = useState(""),
    [createOpen, setCreateOpen] = useState(false);
  const progress = useLoad(
    selected ? `/school/screening-rounds/${selected}/progress` : null,
  );
  const selectedRound = (state.data || []).find(
    (round) => String(round.id) === selected,
  );
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <>
      <div className="sch-workflow-heading">
        <div>
          <h2>รอบประเมิน</h2>
          <p>กำหนดช่วงเวลาและแบบประเมิน แล้วติดตามนักเรียนที่ยังไม่ได้ส่งผล</p>
        </div>
        {canCreate && (
          <button
            type="button"
            className="sch-btn"
            onClick={() => setCreateOpen(true)}
          >
            <FiPlus aria-hidden="true" /> สร้างรอบประเมิน
          </button>
        )}
      </div>
      <Notice {...state} />
      <Notice {...action} />
      {createOpen && (
        <SchoolModal
          title="สร้างรอบประเมิน"
          subtitle="ระบุแบบประเมินและช่วงเวลาที่จะใช้ติดตามผล"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="sch-btn-secondary"
                onClick={() => setCreateOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="school-round-create"
                className="sch-btn"
                disabled={action.busy}
              >
                สร้างรอบประเมิน
              </button>
            </>
          }
        >
          <Notice {...action} />
          <form
            id="school-round-create"
            className="sch-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async () => {
                await api.post("/school/screening-rounds", form);
                await state.load();
                setCreateOpen(false);
              });
            }}
          >
            <Field label="ชื่อรอบ">
              <input
                required
                maxLength={180}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field label="ปีการศึกษา (พ.ศ.)">
              <input
                required
                type="number"
                min={2400}
                max={2700}
                value={form.academic_year}
                onChange={(e) => set("academic_year", e.target.value)}
              />
            </Field>
            <Field label="ภาคเรียน">
              <SearchableSelect
                value={form.semester}
                onChange={(e) => set("semester", e.target.value)}
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </SearchableSelect>
            </Field>
            <Field label="ด้านสุขภาพ">
              <SearchableSelect
                value={form.health_domain}
                onChange={(e) =>
                  setForm({
                    ...form,
                    health_domain: e.target.value,
                    form_id: "",
                  })
                }
              >
                <option value="mental">สุขภาพจิต</option>
                <option value="physical">สุขภาพกาย</option>
              </SearchableSelect>
            </Field>
            <FormSelect
              forms={forms}
              domain={form.health_domain}
              value={form.form_id}
              onChange={(value) => set("form_id", value)}
            />
            <ThaiDateField
              label="เริ่มประเมิน"
              allowFuture
              required
              value={form.starts_on}
              onChange={(v) => set("starts_on", v)}
            />
            <ThaiDateField
              label="สิ้นสุดประเมิน"
              allowFuture
              required
              value={form.ends_on}
              onChange={(v) => set("ends_on", v)}
            />
          </form>
        </SchoolModal>
      )}
      <DataTable
        label="รอบประเมิน"
        rows={(state.data || []).filter(
          (r) => String(r.school_id) === String(schoolId),
        )}
        columns={[
          ["name", "รอบ"],
          ["academic_year", "ปีการศึกษา"],
          ["semester", "ภาคเรียน"],
          ["form_title", "แบบประเมิน"],
          [
            "starts_on",
            "ช่วงเวลา",
            (r) =>
              `${formatThaiDate(r.starts_on)} – ${formatThaiDate(r.ends_on)}`,
          ],
          [
            "status",
            "สถานะ",
            (r) => (
              <StatusBadge tone={r.status === "active" ? "active" : "neutral"}>
                {r.status === "active" ? "เปิดรอบ" : "ปิดรอบ"}
              </StatusBadge>
            ),
          ],
          [
            "action",
            "ติดตาม",
            (r) => (
              <div className="sch-round-actions">
                <button
                  type="button"
                  className="sch-btn-secondary sch-round-view-btn"
                  aria-label={`ดูผู้ยังไม่ประเมิน รอบ ${r.name}`}
                  title="ดูผู้ยังไม่ประเมิน"
                  onClick={() => setSelected(String(r.id))}
                >
                  <FiUsers aria-hidden="true" />
                </button>
                {canUpdate && (
                  <button
                    type="button"
                    className={`sch-btn-ghost sch-round-status-btn ${r.status === "active" ? "is-close" : "is-open"}`}
                    disabled={action.busy}
                    aria-label={`${r.status === "active" ? "ปิด" : "เปิด"}รอบ ${r.name}`}
                    title={r.status === "active" ? "ปิดรอบ" : "เปิดรอบ"}
                    onClick={() =>
                      action.run(async () => {
                        await api.put(`/school/screening-rounds/${r.id}`, {
                          status: r.status === "active" ? "closed" : "active",
                        });
                        await state.load();
                      })
                    }
                  >
                    {r.status === "active" ? (
                      <FiSlash aria-hidden="true" />
                    ) : (
                      <FiCheckCircle aria-hidden="true" />
                    )}
                  </button>
                )}
              </div>
            ),
          ],
        ]}
      />
      {selected && (
        <SchoolModal
          title="ผู้ยังไม่ประเมิน"
          subtitle={
            selectedRound
              ? `${selectedRound.name} · ${selectedRound.form_title || "แบบประเมิน"}`
              : "ความคืบหน้ารอบประเมิน"
          }
          onClose={() => setSelected("")}
          footer={
            <button
              type="button"
              className="sch-btn"
              onClick={() => setSelected("")}
            >
              ปิดหน้าต่าง
            </button>
          }
        >
          <Notice {...progress} />
          {progress.data && (
            <>
              <div className="sch-progress-summary" role="status">
                <span>
                  <small>นักเรียนทั้งหมด</small>
                  <strong>{progress.data.total}</strong>
                </span>
                <span>
                  <small>ประเมินแล้ว</small>
                  <strong>{progress.data.completed}</strong>
                </span>
                <span>
                  <small>ยังไม่ประเมิน</small>
                  <strong>{progress.data.outstanding}</strong>
                </span>
              </div>
              <p className="sr-only">
                ทั้งหมด {progress.data.total} คน · ประเมินแล้ว{" "}
                {progress.data.completed} คน · ยังไม่ประเมิน{" "}
                {progress.data.outstanding} คน
              </p>
              <DataTable
                label="ผู้ยังไม่ประเมิน"
                rows={progress.data.data.filter((r) => !r.completed_on)}
                columns={[
                  ["student_code", "รหัสนักเรียน"],
                  ["student_name", "ชื่อ–นามสกุล"],
                  [
                    "classroom_name",
                    "ชั้น / ห้อง",
                    (r) =>
                      [
                        r.grade_name,
                        r.classroom_name ? `ห้อง ${r.classroom_name}` : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || "-",
                  ],
                ]}
              />
            </>
          )}
        </SchoolModal>
      )}
    </>
  );
}
// canAssign: creating and closing rescreen tasks (student health -> assign).
function Followup({ schoolId, forms, canAssign = true }) {
  const state = useLoad("/school/rescreen-tasks"),
    action = useAction();
  const [students, setStudents] = useState([]),
    [teachers, setTeachers] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "",
    source_response_id: "",
    target_form_id: "",
    assigned_user_id: "",
    due_on: "",
  });
  useEffect(() => {
    loadStudents(schoolId)
      .then(setStudents)
      .catch((e) => action.run(() => Promise.reject(e)));
    getSchoolTeachers({ school_id: schoolId })
      .then(({ data }) => setTeachers(data || []))
      .catch(() => setTeachers([]));
  }, [schoolId]);
  const selectedHealth = useLoad(
    form.student_id ? `/school/students/${form.student_id}/health` : null,
  );
  const assignees = useLoad(
    form.student_id
      ? `/school/rescreen-assignees?student_id=${form.student_id}`
      : null,
  );
  useEffect(() => {
    const assessments = selectedHealth.data?.assessments?.mental || [];
    if (!form.student_id || !assessments.length) return;
    const latest = [...assessments].sort(
      (a, b) =>
        new Date(b.submitted_at) - new Date(a.submitted_at) ||
        Number(b.id) - Number(a.id),
    )[0];
    setForm((current) =>
      current.student_id === form.student_id && !current.source_response_id
        ? {
            ...current,
            source_response_id: String(latest.id),
            target_form_id: current.target_form_id || String(latest.form_id),
          }
        : current,
    );
  }, [selectedHealth.data, form.student_id]);
  const taskRows = (state.data || []).filter(
    (task) => String(task.school_id) === String(schoolId),
  );
  const taskCounts = taskRows.reduce(
    (counts, task) => {
      if (task.status === "completed") counts.completed += 1;
      else if (task.status === "cancelled") counts.cancelled += 1;
      else if (task.overdue) counts.overdue += 1;
      else counts.pending += 1;
      return counts;
    },
    { pending: 0, overdue: 0, completed: 0, cancelled: 0 },
  );
  const studentForTask = (task) =>
    students.find((student) => Number(student.id) === Number(task.student_id));
  const studentNameForTask = (task) => {
    const matched = studentForTask(task);
    return (
      [matched?.prefix, matched?.first_name, matched?.last_name]
        .filter(Boolean)
        .join(" ") || "-"
    );
  };
  const studentClassForTask = (task) => {
    const matched = studentForTask(task);
    return (
      [
        matched?.grade_name,
        matched?.classroom_name ? `ห้อง ${matched.classroom_name}` : "",
      ]
        .filter(Boolean)
        .join(" ") || "-"
    );
  };
  const linkLatestAssessment = (task) =>
    action.run(async () => {
      const { data } = await api.get(
        `/school/students/${task.student_id}/health`,
      );
      const latest = [...(data?.assessments?.mental || [])]
        .filter(
          (assessment) =>
            Number(assessment.form_id) === Number(task.target_form_id) &&
            new Date(assessment.submitted_at) >= new Date(task.created_at) &&
            Number(assessment.id) !== Number(task.source_response_id),
        )
        .sort(
          (a, b) =>
            new Date(b.submitted_at) - new Date(a.submitted_at) ||
            Number(b.id) - Number(a.id),
        )[0];
      if (!latest) throw new Error("ยังไม่พบผลประเมินใหม่ของนักเรียนคนนี้");
      await api.put(`/school/rescreen-tasks/${task.id}`, {
        status: "completed",
        completed_response_id: Number(latest.id),
      });
      await state.load();
    }, `เชื่อมผลประเมินล่าสุดของ ${task.student_code} แล้ว`);
  return (
    <>
      <div className="sch-workflow-heading">
        <div>
          <h2>คัดกรองซ้ำและติดตาม</h2>
          <p>
            มอบหมายงานติดตาม
            แล้วโหลดผลล่าสุดของนักเรียนเพื่อเชื่อมและปิดงานอัตโนมัติ
          </p>
        </div>
        <button
          hidden={!canAssign}
          type="button"
          className="sch-btn"
          onClick={() => setCreateOpen(true)}
        >
          <FiPlus aria-hidden="true" /> สร้างงานใหม่
        </button>
      </div>
      <Notice {...state} />
      <Notice {...action} />
      <div className="sch-followup-summary" aria-label="สรุปงานคัดกรองซ้ำ">
        <span>
          <small>รอติดตาม</small>
          <strong>{taskCounts.pending}</strong>
        </span>
        <span>
          <small>เลยกำหนด</small>
          <strong>{taskCounts.overdue}</strong>
        </span>
        <span>
          <small>เสร็จแล้ว</small>
          <strong>{taskCounts.completed}</strong>
        </span>
      </div>
      {createOpen && (
        <SchoolModal
          title="สร้างงานคัดกรองซ้ำ"
          subtitle="เลือกผลต้นทาง แบบประเมินใหม่ ผู้รับผิดชอบ และวันครบกำหนด"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="sch-btn-secondary"
                onClick={() => setCreateOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="school-followup-create"
                className="sch-btn"
                disabled={action.busy}
              >
                สร้างงานติดตาม
              </button>
            </>
          }
        >
          <Notice {...action} />
          <form
            id="school-followup-create"
            className="sch-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async () => {
                await api.post("/school/rescreen-tasks", form);
                await state.load();
                setCreateOpen(false);
              });
            }}
          >
            <Field label="นักเรียน">
              <SearchableSelect
                required
                value={form.student_id}
                onChange={(e) => {
                  setForm({
                    ...form,
                    student_id: e.target.value,
                    source_response_id: "",
                  });
                }}
              >
                <option value="">เลือกนักเรียน</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.student_code} ·{" "}
                    {[s.prefix, s.first_name, s.last_name]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    ·{" "}
                    {[
                      s.grade_name,
                      s.classroom_name ? `ห้อง ${s.classroom_name}` : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </option>
                ))}
              </SearchableSelect>
            </Field>
            <Notice {...selectedHealth} />
            <Field label="ผลประเมินต้นทาง">
              <SearchableSelect
                required
                value={form.source_response_id}
                onChange={(e) =>
                  setForm({ ...form, source_response_id: e.target.value })
                }
              >
                <option value="">เลือกผลประเมิน</option>
                {selectedHealth.data?.assessments?.mental?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {toDisplayText(r.form_title)} ·{" "}
                    {formatThaiDate(r.submitted_at)} · {RISK_LABELS[r.risk]}
                  </option>
                ))}
              </SearchableSelect>
              <span className="sch-field-hint">
                ระบบเลือกผลประเมินล่าสุดให้อัตโนมัติ
                สามารถเปลี่ยนได้ก่อนสร้างงาน
              </span>
            </Field>
            <FormSelect
              forms={forms}
              domain="mental"
              value={form.target_form_id}
              onChange={(v) => setForm({ ...form, target_form_id: v })}
            />
            <Notice {...assignees} />
            <Field label="ผู้รับผิดชอบ">
              <SearchableSelect
                required
                value={form.assigned_user_id}
                onChange={(e) =>
                  setForm({ ...form, assigned_user_id: e.target.value })
                }
              >
                <option value="">เลือกผู้รับผิดชอบ</option>
                {(assignees.data || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.username}
                  </option>
                ))}
              </SearchableSelect>
            </Field>
            <ThaiDateField
              required
              allowFuture
              label="กำหนดประเมินซ้ำ"
              value={form.due_on}
              onChange={(v) => setForm({ ...form, due_on: v })}
            />
          </form>
        </SchoolModal>
      )}
      <DataTable
        label="งานคัดกรองซ้ำ"
        rows={taskRows}
        columns={[
          ["student_code", "รหัสนักเรียน"],
          ["student_id", "ชื่อ–นามสกุล", studentNameForTask],
          ["classroom_id", "ชั้น / ห้อง", studentClassForTask],
          ["due_on", "ครบกำหนด", (r) => formatThaiDate(r.due_on)],
          [
            "status",
            "สถานะ",
            (r) => {
              const label =
                r.status === "completed"
                  ? "ประเมินซ้ำแล้ว"
                  : r.status === "cancelled"
                    ? "ยกเลิก"
                    : r.overdue
                      ? "เลยกำหนด"
                      : "รอประเมินซ้ำ";
              const tone =
                r.status === "completed"
                  ? "success"
                  : r.status === "cancelled"
                    ? "neutral"
                    : r.overdue
                      ? "danger"
                      : "waiting";
              return <StatusBadge tone={tone}>{label}</StatusBadge>;
            },
          ],
          [
            "assigned_user_id",
            "ผู้รับผิดชอบ",
            (r) =>
              r.assigned_username ||
              teachers.find(
                (t) => Number(t.user_id) === Number(r.assigned_user_id),
              )?.name ||
              r.assigned_user_id,
          ],
          [
            "action",
            "จัดการ",
            (r) =>
              r.status === "pending" && (
                <div className="sch-followup-actions">
                  <button
                    hidden={!canAssign}
                    type="button"
                    className="sch-btn-secondary sch-followup-action"
                    aria-label={`โหลดการประเมินล่าสุดของ ${r.student_code}`}
                    title="โหลดและเชื่อมผลประเมินล่าสุด"
                    disabled={action.busy}
                    onClick={() => linkLatestAssessment(r)}
                  >
                    <FiRefreshCw aria-hidden="true" />
                  </button>
                  <button
                    hidden={!canAssign}
                    type="button"
                    className="sch-btn-ghost sch-followup-action is-cancel"
                    aria-label={`ยกเลิกงานติดตามของ ${r.student_code}`}
                    title="ยกเลิกงานติดตาม"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await api.put(`/school/rescreen-tasks/${r.id}`, {
                          status: "cancelled",
                        });
                        await state.load();
                      })
                    }
                  >
                    <FiSlash aria-hidden="true" />
                  </button>
                </div>
              ),
          ],
        ]}
      />
    </>
  );
}
async function loadStudents(schoolId) {
  let rows = [],
    page = 1;
  for (;;) {
    const { data } = await getSchoolStudents({
      school_id: schoolId,
      page,
      limit: 200,
      status: "",
    });
    rows.push(...data.data);
    if (page >= data.pagination.total_pages) break;
    page++;
  }
  return rows;
}
export function TeacherImport({ schoolId }) {
  const action = useAction(),
    [rows, setRows] = useState(null),
    [results, setResults] = useState([]),
    [checked, setChecked] = useState(false),
    [done, setDone] = useState(false),
    [progress, setProgress] = useState(0),
    [fileName, setFileName] = useState(""),
    [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const teacherSteps = ["เลือกไฟล์", "ตรวจสอบข้อมูล", "นำเข้า", "เสร็จสิ้น"];
  const step = done ? 3 : action.busy && checked ? 2 : results.length ? 1 : 0;
  const resultSummary = results.reduce((summary, item) => {
    summary[item.status] = (summary[item.status] || 0) + 1;
    return summary;
  }, {});
  const statusLabels = {
    will_create: "จะสร้างใหม่",
    will_update: "จะอัปเดต",
    created: "สร้างแล้ว",
    linked: "ผูกบัญชีเดิม",
    updated: "อัปเดตแล้ว",
    skipped: "ข้าม (มีอยู่แล้ว)",
    error: "มีปัญหา",
  };
  const reset = () => {
    setRows(null);
    setResults([]);
    setChecked(false);
    setDone(false);
    setProgress(0);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  };
  const chooseFile = (file) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    action.run(async () => {
      const parsed = await readTeacherFile(file);
      if (!parsed.length || parsed.length > 3000)
        throw Error("นำเข้าได้ 1–3,000 แถว");
      const seen = new Set();
      for (const row of parsed) {
        const key = row.username?.toLowerCase();
        if (seen.has(key)) throw Error("ชื่อผู้ใช้ซ้ำในไฟล์");
        seen.add(key);
      }
      setRows(parsed);
    }, "อ่านไฟล์แล้ว");
  };
  const runImport = async (dryRun) => {
    setProgress(0);
    setResults([]);
    const all = [];
    for (let offset = 0; offset < rows.length; offset += 100) {
      const { data } = await api.post("/school/teachers/import", {
        school_id: Number(schoolId),
        dry_run: dryRun,
        rows: rows.slice(offset, offset + 100),
      });
      all.push(...data.results.map((r) => ({ ...r, row: r.row + offset })));
      setResults([...all]);
      setProgress(Math.min(offset + 100, rows.length));
    }
    if (dryRun) setChecked(!all.some((r) => r.status === "error"));
    else {
      setDone(true);
      setChecked(false);
    }
  };
  return (
    <>
      <ol className="sch-steps" aria-label="ขั้นตอนการนำเข้าครู">
        {teacherSteps.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>
      <Notice {...action} />
      {!done && (
        <section
          className="sch-card"
          aria-labelledby="teacher-import-setup-title"
        >
          <h2 id="teacher-import-setup-title">ตั้งค่าการนำเข้า</h2>
          <p className="sch-muted">
            ข้อมูลในไฟล์สามารถกำหนดบัญชี บทบาท และห้องเรียนที่ครูรับผิดชอบได้
          </p>
          <div
            className={`sch-dropzone sch-stack-top ${dragging ? "is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files?.[0]);
            }}
          >
            <FiUploadCloud size={32} aria-hidden="true" />
            <strong>{fileName || "ลากไฟล์มาวางที่นี่ หรือเลือกไฟล์"}</strong>
            <span className="sch-muted">
              รองรับ .xlsx และ .csv จำนวน 1–3,000 แถว
            </span>
            <div className="sch-button-row sch-button-row--center">
              <label className="sch-btn sch-file-btn">
                <FiFileText aria-hidden="true" /> เลือกไฟล์
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.csv"
                  className="sch-file-input"
                  disabled={action.busy}
                  onChange={(event) => chooseFile(event.target.files?.[0])}
                />
              </label>
              <button
                type="button"
                className="sch-btn-secondary"
                onClick={() =>
                  action.run(
                    () => saveTeacherWorkbook(),
                    "ดาวน์โหลดไฟล์ต้นแบบแล้ว",
                  )
                }
              >
                <FiDownload aria-hidden="true" /> ดาวน์โหลดแบบฟอร์ม
              </button>
            </div>
          </div>
          {rows && (
            <div className="sch-stack-top sch-stack">
              <p>
                พบรายชื่อครู <strong>{rows.length}</strong> แถว
              </p>
              <div className="sch-button-row">
                <button
                  type="button"
                  className="sch-btn"
                  disabled={action.busy || checked}
                  onClick={() =>
                    action.run(() => runImport(true), "ตรวจสอบข้อมูลแล้ว")
                  }
                >
                  {action.busy && !checked
                    ? "กำลังตรวจสอบ..."
                    : "ตรวจสอบข้อมูล"}
                </button>
                {results.length > 0 && !checked && (
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    onClick={reset}
                  >
                    เลือกไฟล์ใหม่
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}
      {action.busy && (
        <section className="sch-card" aria-live="polite">
          <p className="sch-progress-label">
            {checked ? "กำลังนำเข้า" : "กำลังตรวจสอบ"} {progress}/{rows?.length}{" "}
            แถว
          </p>
          <div
            className="sch-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={rows?.length || 0}
            aria-valuenow={progress}
          >
            <span
              style={{
                transform: `scaleX(${rows?.length ? progress / rows.length : 0})`,
              }}
            />
          </div>
        </section>
      )}
      {results.length > 0 && !action.busy && (
        <section
          className="sch-card"
          aria-labelledby="teacher-import-result-title"
        >
          <div className="sch-card-head">
            <h2 id="teacher-import-result-title">
              {done ? "ผลการนำเข้า" : "ผลการตรวจสอบ (ยังไม่บันทึก)"}
            </h2>
          </div>
          <div className="sch-tiles">
            {Object.entries(resultSummary).map(([status, count]) => (
              <div
                key={status}
                className={`sch-tile ${status === "error" ? "risk-high" : status === "skipped" ? "risk-medium" : "risk-normal"}`}
              >
                <span>{statusLabels[status] || status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <div className="sch-button-row sch-stack-bottom">
            {!done && (
              <button
                type="button"
                className="sch-btn"
                disabled={!checked}
                onClick={() =>
                  action.run(() => runImport(false), "นำเข้าครูเรียบร้อย")
                }
              >
                นำเข้าครู {rows?.length || 0} คน
              </button>
            )}
            {done && results.some((row) => row.password) && (
              <button
                type="button"
                className="sch-btn"
                onClick={() =>
                  action.run(
                    () => saveTeacherWorkbook(results),
                    "ดาวน์โหลดบัญชีครูแล้ว",
                  )
                }
              >
                <FiDownload aria-hidden="true" /> ดาวน์โหลดบัญชีครู (Excel)
              </button>
            )}
            <button type="button" className="sch-btn-secondary" onClick={reset}>
              {done ? "นำเข้าไฟล์อื่น" : "เลือกไฟล์ใหม่"}
            </button>
          </div>
          <DataTable
            label={done ? "ตารางผลการนำเข้า" : "ตารางผลการตรวจสอบ"}
            rows={results}
            columns={[
              ["row", "แถว"],
              ["username", "ชื่อผู้ใช้"],
              ["status", "ผล", (row) => statusLabels[row.status] || row.status],
              ["errors", "ข้อผิดพลาด", (row) => row.errors?.join(" · ") || "-"],
            ]}
          />
        </section>
      )}
    </>
  );
}
