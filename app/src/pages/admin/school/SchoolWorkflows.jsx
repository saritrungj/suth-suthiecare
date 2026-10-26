import SearchableSelect from "../../../components/SearchableSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, {
  getForms,
  getSchoolClassrooms,
  getSchoolGrades,
  getSchoolStudents,
  getSchoolTeachers,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  PageHeader,
  BarSelect,
  TableScroll,
  ThaiDateField,
  SearchField,
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
import { useOpenStudentFile, useSessionState } from "./studentFileLink";
import TablePagination from "../../../components/table/TablePagination";
import usePagedRows from "../../../components/table/usePagedRows";
import ResultSummary from "../../../components/table/ResultSummary";
import { RiskPill } from "../../../components/case/CaseDrawer";
import { confirmAlert } from "../../../utils/alerts";
import {
  FiActivity,
  FiCalendar,
  FiCheckCircle,
  FiClipboard,
  FiDownload,
  FiLink,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiRepeat,
  FiSlash,
  FiSliders,
  FiUploadCloud,
  FiUsers,
} from "react-icons/fi";
import {
  CareGuidanceSettings,
  GuidanceSteps,
  PhysicalRiskRules,
  RiskAlertSettings,
} from "./careSettings";

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
  // Remembered while a student file is open on its own page.
  const [tab, setTab] = useSessionState(
      "sch-workflows:tab",
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
    // Screening is by rounds for a group; follow-up is per student.
    { key: "rounds", label: "รอบคัดกรอง", icon: FiCalendar },
    ...(access?.can_view_mental
      ? [{ key: "followup", label: "ติดตามรายบุคคล", icon: FiRepeat }]
      : []),
    ...(access?.workflow_actions?.view
      ? [{ key: "care", label: "ตั้งค่าการดูแล", icon: FiSliders }]
      : []),
  ];
  // A remembered tab the viewer may no longer open falls back to the first.
  const current = primaryTabs.some((t) => t.key === tab)
    ? tab
    : primaryTabs[0].key;
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
              className={current === key ? "is-active" : ""}
              aria-current={current === key ? "page" : undefined}
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
            key={`${schoolId}-${current}`}
          >
            {current === "risk" && <RiskSummary schoolId={schoolId} />}{" "}
            {current === "rounds" && (
              <Rounds
                schoolId={schoolId}
                forms={forms}
                manage={access?.can_manage_workflows}
                rights={access?.workflow_actions}
              />
            )}{" "}
            {current === "care" && access?.workflow_actions?.view && (
              <>
                <RiskAlertSettings
                  schoolId={schoolId}
                  canEdit={Boolean(access?.workflow_actions?.update)}
                />
                <CareGuidanceSettings
                  schoolId={schoolId}
                  canEdit={Boolean(access?.workflow_actions?.update)}
                />
                {access?.can_view_physical && (
                  <PhysicalRiskRules
                    schoolId={schoolId}
                    rights={access?.workflow_actions}
                  />
                )}
              </>
            )}{" "}
            {current === "followup" && access?.can_view_mental && (
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
          [
            "care_advice",
            "คำแนะนำการดูแล",
            (r) => (
              <>
                {r.care_advice}
                <GuidanceSteps steps={r.care_guidance} />
              </>
            ),
          ],
        ]}
      />
    </>
  );
}
// Who a round is for, as shown in the rounds table: grades, then classrooms
// that are not already covered by a chosen grade.
function roundTarget(round) {
  const grades = round.grades || [],
    gradeIds = grades.map((g) => g.id);
  const parts = [
    ...grades.map((g) => g.name),
    ...(round.classrooms || [])
      .filter((c) => !gradeIds.includes(c.grade_level_id))
      .map((c) => `${c.grade_name} ห้อง ${c.name}`),
  ];
  return parts.length ? parts.join(", ") : "ทั้งโรงเรียน";
}
// "YYYY-MM-DD" plus n days, or the next school day n times when weekends
// are skipped.
function addDays(day, n, skipWeekends) {
  const d = new Date(`${day}T00:00:00Z`);
  const weekend = () => [0, 6].includes(d.getUTCDay());
  while (skipWeekends && weekend()) d.setUTCDate(d.getUTCDate() + 1);
  for (let i = 0; i < n; i += 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    while (skipWeekends && weekend()) d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}
// One round per classroom on the homeroom timetable: perDay classrooms a day
// (empty = all on the start day), each open for openDays days.
function homeroomSchedule(classrooms, plan) {
  if (!validDay(plan.starts_on)) return [];
  const perDay = Math.max(0, Number(plan.per_day) || 0),
    openDays = Math.max(1, Number(plan.open_days) || 1);
  return classrooms.map((c, i) => {
    const starts = addDays(
      plan.starts_on,
      perDay ? Math.floor(i / perDay) : 0,
      plan.skip_weekends,
    );
    return {
      classroom: c,
      name: `${plan.name.trim()} ${c.grade_name} ห้อง ${c.name}`.trim(),
      starts_on: starts,
      ends_on: addDays(starts, openDays - 1, plan.skip_weekends),
    };
  });
}
const validDay = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || "");
const blankRound = (schoolId) => ({
  school_id: Number(schoolId),
  name: "",
  academic_year: currentAcademicYear(),
  semester: "2",
  health_domain: "mental",
  form_id: "",
  starts_on: "",
  ends_on: "",
});
// Year, semester, health domain and form: shared by the single round and
// the per-classroom rounds.
function RoundBasics({ value, setValue, forms }) {
  const set = (key, v) => setValue((old) => ({ ...old, [key]: v }));
  return (
    <>
      <Field label="ปีการศึกษา (พ.ศ.)">
        <input
          required
          type="number"
          min={2400}
          max={2700}
          value={value.academic_year}
          onChange={(e) => set("academic_year", e.target.value)}
        />
      </Field>
      <Field label="ภาคเรียน">
        <SearchableSelect
          value={value.semester}
          onChange={(e) => set("semester", e.target.value)}
        >
          <option value="1">1</option>
          <option value="2">2</option>
        </SearchableSelect>
      </Field>
      <Field label="ด้านสุขภาพ">
        <SearchableSelect
          value={value.health_domain}
          onChange={(e) =>
            setValue((old) => ({
              ...old,
              health_domain: e.target.value,
              form_id: "",
            }))
          }
        >
          <option value="mental">สุขภาพจิต</option>
          <option value="physical">สุขภาพกาย</option>
        </SearchableSelect>
      </Field>
      <FormSelect
        forms={forms}
        domain={value.health_domain}
        value={value.form_id}
        onChange={(v) => set("form_id", v)}
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
      ...blankRound(schoolId),
      // No grade and no classroom: every student of the school does this round.
      grade_level_ids: [],
      classroom_ids: [],
    }),
    [plan, setPlan] = useState({
      ...blankRound(schoolId),
      name: "คัดกรองคาบโฮมรูม",
      per_day: "",
      open_days: 1,
      skip_weekends: true,
      grade_level_ids: [],
    }),
    [selected, setSelected] = useState(""),
    [createOpen, setCreateOpen] = useState(false),
    [batchOpen, setBatchOpen] = useState(false),
    [grades, setGrades] = useState([]),
    [classrooms, setClassrooms] = useState([]);
  const year = batchOpen ? plan.academic_year : form.academic_year;
  useEffect(() => {
    if (!schoolId) return;
    getSchoolGrades(schoolId)
      .then(({ data }) => setGrades(Array.isArray(data) ? data : []))
      .catch(() => setGrades([]));
  }, [schoolId]);
  useEffect(() => {
    if (!schoolId || !(createOpen || batchOpen) || !Number(year)) return;
    getSchoolClassrooms(schoolId, { academic_year: Number(year) })
      .then(({ data }) =>
        setClassrooms(
          (Array.isArray(data) ? data : []).filter(
            (c) => c.status !== "inactive",
          ),
        ),
      )
      .catch(() => setClassrooms([]));
  }, [schoolId, year, createOpen, batchOpen]);
  const toggle = (setter, key, id) =>
    setter((old) => ({
      ...old,
      [key]: old[key].includes(id)
        ? old[key].filter((g) => g !== id)
        : [...old[key], id],
    }));
  const roomsOf = (gradeId) =>
    classrooms.filter((c) => Number(c.grade_level_id) === Number(gradeId));
  const batchRooms = classrooms.filter(
    (c) =>
      !plan.grade_level_ids.length ||
      plan.grade_level_ids.includes(Number(c.grade_level_id)),
  );
  const schedule = homeroomSchedule(batchRooms, plan);
  const progress = useLoad(
    selected ? `/school/screening-rounds/${selected}/progress` : null,
  );
  const selectedRound = (state.data || []).find(
    (round) => String(round.id) === selected,
  );
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const setPlanKey = (key, value) =>
    setPlan((old) => ({ ...old, [key]: value }));
  return (
    <>
      <div className="sch-workflow-heading">
        <div>
          <h2>รอบคัดกรอง</h2>
          <p>
            คัดกรองนักเรียนทั้งกลุ่ม ภาคเรียนละกี่รอบก็ได้
            รอบที่เปิดจะแสดงในหน้าของนักเรียนจนกว่าจะส่ง
            แล้วติดตามคนที่ยังไม่ได้ส่งได้จากที่นี่
          </p>
        </div>
        {canCreate && (
          <div className="sch-round-create-actions">
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={() => setBatchOpen(true)}
            >
              <FiCalendar aria-hidden="true" /> สร้างรอบให้ทุกห้องตามตาราง
            </button>
            <button
              type="button"
              className="sch-btn"
              onClick={() => setCreateOpen(true)}
            >
              <FiPlus aria-hidden="true" /> สร้างรอบประเมิน
            </button>
          </div>
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
                // A classroom of a chosen grade is already covered.
                await api.post("/school/screening-rounds", {
                  ...form,
                  classroom_ids: form.classroom_ids.filter(
                    (id) =>
                      !form.grade_level_ids.includes(
                        Number(
                          classrooms.find((c) => c.id === id)?.grade_level_id,
                        ),
                      ),
                  ),
                });
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
            <RoundBasics value={form} setValue={setForm} forms={forms} />
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
            {grades.length > 0 && (
              <fieldset className="sch-round-grades">
                <legend>ระดับชั้นและห้องที่ต้องทำ</legend>
                <p className="sch-field-hint">
                  ไม่เลือก = นักเรียนทั้งโรงเรียน เลือกชั้น = ทุกห้องในชั้นนั้น
                  หรือเลือกเฉพาะบางห้องเพื่อให้ทำในคาบโฮมรูมของห้อง
                </p>
                {grades.map((grade) => {
                  const wholeGrade = form.grade_level_ids.includes(grade.id);
                  const rooms = roomsOf(grade.id);
                  return (
                    <div key={grade.id} className="sch-round-target-row">
                      <div className="sch-round-grade-list">
                        <label>
                          <input
                            type="checkbox"
                            checked={wholeGrade}
                            onChange={() =>
                              toggle(setForm, "grade_level_ids", grade.id)
                            }
                          />
                          {grade.name}
                        </label>
                      </div>
                      {rooms.length > 0 && (
                        <div
                          className="sch-round-grade-list sch-round-room-list"
                          role="group"
                          aria-label={`ห้องของ ${grade.name}`}
                        >
                          {rooms.map((room) => (
                            <label key={room.id}>
                              <input
                                type="checkbox"
                                disabled={wholeGrade}
                                checked={
                                  wholeGrade ||
                                  form.classroom_ids.includes(room.id)
                                }
                                onChange={() =>
                                  toggle(setForm, "classroom_ids", room.id)
                                }
                              />
                              ห้อง {room.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </fieldset>
            )}
          </form>
        </SchoolModal>
      )}
      {batchOpen && (
        <SchoolModal
          title="สร้างรอบให้ทุกห้องตามตาราง"
          subtitle="สร้างรอบห้องละหนึ่งรอบ ให้แต่ละห้องทำในคาบโฮมรูมของตัวเอง เพื่อไม่ให้นักเรียนเข้าระบบพร้อมกันทั้งโรงเรียน"
          onClose={() => setBatchOpen(false)}
          footer={
            <>
              <button
                type="button"
                className="sch-btn-secondary"
                onClick={() => setBatchOpen(false)}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="school-round-batch"
                className="sch-btn"
                disabled={action.busy || !schedule.length}
              >
                สร้าง {schedule.length} รอบ
              </button>
            </>
          }
        >
          <Notice {...action} />
          <form
            id="school-round-batch"
            className="sch-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              action.run(async () => {
                const base = {
                  school_id: plan.school_id,
                  academic_year: plan.academic_year,
                  semester: plan.semester,
                  health_domain: plan.health_domain,
                  form_id: plan.form_id,
                };
                await api.post("/school/screening-rounds/batch", {
                  school_id: plan.school_id,
                  rounds: schedule.map((row) => ({
                    ...base,
                    name: row.name,
                    starts_on: row.starts_on,
                    ends_on: row.ends_on,
                    classroom_ids: [row.classroom.id],
                  })),
                });
                await state.load();
                setBatchOpen(false);
              }, `สร้างรอบประเมิน ${schedule.length} รอบเรียบร้อย`);
            }}
          >
            <Field label="ชื่อรอบ (นำหน้าชื่อห้อง)">
              <input
                required
                maxLength={150}
                value={plan.name}
                onChange={(e) => setPlanKey("name", e.target.value)}
              />
            </Field>
            <RoundBasics value={plan} setValue={setPlan} forms={forms} />
            <ThaiDateField
              label="วันแรกของตาราง"
              allowFuture
              required
              value={plan.starts_on}
              onChange={(v) => setPlanKey("starts_on", v)}
            />
            <Field label="จำนวนห้องต่อวัน (เว้นว่าง = ทุกห้องวันเดียวกัน)">
              <input
                type="number"
                min={1}
                max={200}
                value={plan.per_day}
                onChange={(e) => setPlanKey("per_day", e.target.value)}
              />
            </Field>
            <Field label="เปิดให้ทำกี่วัน">
              <input
                required
                type="number"
                min={1}
                max={30}
                value={plan.open_days}
                onChange={(e) => setPlanKey("open_days", e.target.value)}
              />
            </Field>
            <label className="sch-check">
              <input
                type="checkbox"
                checked={plan.skip_weekends}
                onChange={(e) => setPlanKey("skip_weekends", e.target.checked)}
              />
              ข้ามวันเสาร์และวันอาทิตย์
            </label>
            {grades.length > 0 && (
              <fieldset className="sch-round-grades">
                <legend>ระดับชั้น</legend>
                <p className="sch-field-hint">
                  ไม่เลือก = ทุกห้องของปีการศึกษา {plan.academic_year}
                </p>
                <div className="sch-round-grade-list">
                  {grades.map((grade) => (
                    <label key={grade.id}>
                      <input
                        type="checkbox"
                        checked={plan.grade_level_ids.includes(grade.id)}
                        onChange={() =>
                          toggle(setPlan, "grade_level_ids", grade.id)
                        }
                      />
                      {grade.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </form>
          {!batchRooms.length ? (
            <p className="sch-field-hint">
              ไม่พบห้องเรียนของปีการศึกษา {plan.academic_year}
            </p>
          ) : !schedule.length ? (
            <p className="sch-field-hint">
              เลือกวันแรกของตารางเพื่อดูวันของแต่ละห้อง
            </p>
          ) : (
            <DataTable
              label="ตารางรอบรายห้อง"
              rows={schedule.map((row) => ({ ...row, id: row.classroom.id }))}
              columns={[
                [
                  "classroom",
                  "ห้อง",
                  (r) => `${r.classroom.grade_name} ห้อง ${r.classroom.name}`,
                ],
                ["name", "ชื่อรอบ"],
                [
                  "starts_on",
                  "วันที่ทำ",
                  (r) =>
                    r.starts_on === r.ends_on
                      ? formatThaiDate(r.starts_on)
                      : `${formatThaiDate(r.starts_on)} – ${formatThaiDate(r.ends_on)}`,
                ],
              ]}
            />
          )}
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
          ["grades", "กลุ่มเป้าหมาย", roundTarget],
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
  // New tasks are made in the student file (insights tab): pick a student
  // here and the file opens there.
  const [createOpen, setCreateOpen] = useState(false);
  const [pickedStudent, setPickedStudent] = useState("");
  const openFile = useOpenStudentFile();
  useEffect(() => {
    loadStudents(schoolId)
      .then(setStudents)
      .catch((e) => action.run(() => Promise.reject(e)));
    getSchoolTeachers({ school_id: schoolId })
      .then(({ data }) => setTeachers(data || []))
      .catch(() => setTeachers([]));
  }, [schoolId]);
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
  const [statusFilter, setStatusFilter] = useState("all"),
    [search, setSearch] = useState("");
  const statusOf = (task) =>
    task.status === "completed" || task.status === "cancelled"
      ? task.status
      : task.overdue
        ? "overdue"
        : "pending";
  const query = search.trim().toLowerCase();
  const visibleRows = taskRows
    .filter((task) => statusFilter === "all" || statusOf(task) === statusFilter)
    .filter(
      (task) =>
        !query ||
        [task.student_code, studentNameForTask(task)]
          .join(" ")
          .toLowerCase()
          .includes(query),
    )
    .sort(
      (a, b) =>
        FOLLOWUP_ORDER[statusOf(a)] - FOLLOWUP_ORDER[statusOf(b)] ||
        String(a.due_on).localeCompare(String(b.due_on)),
    );
  const paged = usePagedRows(visibleRows, {
    resetKeys: [statusFilter, query],
  });
  const statusChips = [
    ["all", "ทั้งหมด", taskRows.length],
    ["pending", "รอประเมิน", taskCounts.pending],
    ["overdue", "เลยกำหนด", taskCounts.overdue],
    ["completed", "ประเมินแล้ว", taskCounts.completed],
    ["cancelled", "ยกเลิก", taskCounts.cancelled],
  ];
  const copyFormLink = (task) =>
    action.run(async () => {
      await navigator.clipboard.writeText(
        `${window.location.origin}/assessment/${task.target_form_id}`,
      );
    }, `คัดลอกลิงก์แบบประเมินของ ${task.student_code} แล้ว`);
  const cancelTask = async (task) => {
    if (
      !(await confirmAlert({
        title: "ยกเลิกงานติดตาม?",
        text: `งานของ ${task.student_code} จะหายจากบัญชีนักเรียน และเปิดกลับไม่ได้`,
        confirmText: "ยกเลิกงาน",
        cancelText: "ไม่ยกเลิก",
        danger: true,
      }))
    )
      return;
    action.run(async () => {
      await api.put(`/school/rescreen-tasks/${task.id}`, {
        status: "cancelled",
      });
      await state.load();
    }, `ยกเลิกงานของ ${task.student_code} แล้ว`);
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
          <h2>ติดตามรายบุคคล</h2>
          <p>
            งานติดตามของนักเรียนแต่ละคน นักเรียนเห็นงานใน “แบบประเมินติดตาม”
            ของบัญชีตนเอง และงานจะปิดเองเมื่อนักเรียนส่งแบบประเมิน
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
      <div className="sch-followup-filter">
        <div
          className="sch-followup-status"
          role="group"
          aria-label="กรองตามสถานะงาน"
        >
          {statusChips.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              className={`is-${key}`}
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(key)}
            >
              <span>{label}</span>
              <strong>{count}</strong>
            </button>
          ))}
        </div>
        <SearchField
          label="ค้นหานักเรียน"
          placeholder="ค้นหารหัสหรือชื่อนักเรียน"
          value={search}
          onChange={setSearch}
        />
      </div>
      {createOpen && (
        <SchoolModal
          title="สร้างงานคัดกรองหรือติดตาม"
          subtitle="เลือกนักเรียน แล้วสร้างงานจากบันทึกแนะแนวในแฟ้มนักเรียน"
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
                form="school-followup-pick"
                className="sch-btn"
                disabled={!pickedStudent}
              >
                เปิดแฟ้มนักเรียน
              </button>
            </>
          }
        >
          <form
            id="school-followup-pick"
            className="sch-form-grid"
            onSubmit={(e) => {
              e.preventDefault();
              openFile(Number(pickedStudent), { tab: "insights" });
              setCreateOpen(false);
              setPickedStudent("");
            }}
          >
            <Field label="นักเรียน">
              <SearchableSelect
                required
                value={pickedStudent}
                onChange={(e) => setPickedStudent(e.target.value)}
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
            <p className="sch-field-hint">
              ในแท็บข้อมูลเชิงลึก เลือกประเภทบันทึกเป็นคัดกรองหรือติดตาม
              แล้วเลือกแบบประเมิน ผู้รับผิดชอบ และวันครบกำหนด
            </p>
          </form>
        </SchoolModal>
      )}
      <ResultSummary
        loading={state.loading}
        pagination={paged.pagination}
        chips={[
          {
            key: "status",
            label: "สถานะ",
            value:
              statusFilter === "all"
                ? ""
                : statusChips.find(([key]) => key === statusFilter)?.[1],
            onRemove: () => setStatusFilter("all"),
          },
          {
            key: "search",
            label: "ค้นหา",
            value: search.trim(),
            onRemove: () => setSearch(""),
          },
        ]}
        onClearAll={() => {
          setStatusFilter("all");
          setSearch("");
        }}
      />
      <section
        className="sch-data-section sch-followup-list"
        aria-label="งานติดตามรายบุคคล"
      >
        <TableScroll label="ตารางงานติดตามรายบุคคล">
          <table className="sch-table admin-data-table sch-followup-table">
            <thead>
              <tr>
                <th scope="col">นักเรียน</th>
                <th scope="col">แบบประเมิน</th>
                <th scope="col">ครบกำหนด</th>
                <th scope="col">สถานะ</th>
                <th scope="col">ผู้รับผิดชอบ</th>
                <th scope="col" className="sch-actions-col">
                  จัดการ
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.pageRows.length ? (
                paged.pageRows.map((r) => {
                  const status = statusOf(r);
                  const [label, tone] = FOLLOWUP_STATUS[status];
                  return (
                    <tr key={r.id}>
                      <td data-label="นักเรียน">
                        <span className="sch-followup-cell">
                          <strong>{studentNameForTask(r)}</strong>
                          <small>
                            {r.student_code} · {studentClassForTask(r)}
                          </small>
                        </span>
                      </td>
                      <td data-label="แบบประเมิน">
                        <span className="sch-followup-cell">
                          <span>
                            {toDisplayText(r.target_form_title) || "–"}
                          </span>
                          {r.status === "pending" && (
                            <small
                              className={
                                r.has_account ? "is-shown" : "is-manual"
                              }
                            >
                              {r.has_account
                                ? "แสดงในบัญชีนักเรียนแล้ว"
                                : "นักเรียนยังไม่มีบัญชี ต้องส่งลิงก์เอง"}
                            </small>
                          )}
                        </span>
                      </td>
                      <td data-label="ครบกำหนด">
                        <span className="sch-followup-cell">
                          <span>{formatThaiDate(r.due_on)}</span>
                          <small
                            className={status === "overdue" ? "is-late" : ""}
                          >
                            {dueHint(r)}
                          </small>
                        </span>
                      </td>
                      <td data-label="สถานะ">
                        <StatusBadge tone={tone}>{label}</StatusBadge>
                      </td>
                      <td data-label="ผู้รับผิดชอบ">
                        {r.assigned_username ||
                          teachers.find(
                            (t) =>
                              Number(t.user_id) === Number(r.assigned_user_id),
                          )?.name ||
                          r.assigned_user_id}
                      </td>
                      <td data-label="จัดการ" className="sch-actions-col">
                        {r.status === "pending" && canAssign ? (
                          <div className="sch-followup-actions">
                            <button
                              type="button"
                              className="sch-btn-secondary sch-followup-action"
                              aria-label={`คัดลอกลิงก์แบบประเมินของ ${r.student_code}`}
                              title="คัดลอกลิงก์แบบประเมิน"
                              disabled={action.busy}
                              onClick={() => copyFormLink(r)}
                            >
                              <FiLink aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="sch-btn-secondary sch-followup-action"
                              aria-label={`โหลดการประเมินล่าสุดของ ${r.student_code}`}
                              title="เชื่อมผลประเมินล่าสุดเอง (กรณีนักเรียนทำโดยไม่เข้าสู่ระบบ)"
                              disabled={action.busy}
                              onClick={() => linkLatestAssessment(r)}
                            >
                              <FiRefreshCw aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="sch-btn-ghost sch-followup-action is-cancel"
                              aria-label={`ยกเลิกงานติดตามของ ${r.student_code}`}
                              title="ยกเลิกงานติดตาม"
                              disabled={action.busy}
                              onClick={() => cancelTask(r)}
                            >
                              <FiSlash aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <span className="sch-muted">–</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="sch-empty-row">
                    <FiClipboard aria-hidden="true" />
                    <strong>
                      {taskRows.length
                        ? "ไม่พบงานตามตัวกรอง"
                        : "ยังไม่มีงานติดตาม"}
                    </strong>
                    <span>
                      {taskRows.length
                        ? "ลองเปลี่ยนสถานะหรือคำค้นหา"
                        : "สร้างงานใหม่เพื่อให้นักเรียนเห็นแบบประเมินในบัญชีของตน"}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
        <TablePagination
          page={paged.pagination.page}
          totalPages={paged.pagination.total_pages}
          total={paged.pagination.total}
          limit={paged.pagination.limit}
          onPage={paged.setPage}
          onLimit={paged.setLimit}
        />
      </section>
    </>
  );
}
const FOLLOWUP_ORDER = { overdue: 0, pending: 1, completed: 2, cancelled: 3 };
const FOLLOWUP_STATUS = {
  pending: ["รอประเมินซ้ำ", "waiting"],
  overdue: ["เลยกำหนด", "danger"],
  completed: ["ประเมินซ้ำแล้ว", "success"],
  cancelled: ["ยกเลิก", "neutral"],
};
// Days left (or late) for an open task; the completion date for a done one.
function dueHint(task) {
  if (task.status === "completed")
    return task.completed_at
      ? `ส่งแล้ว ${formatThaiDate(task.completed_at)}`
      : "ส่งแล้ว";
  if (task.status === "cancelled") return "";
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Bangkok",
  });
  const days = Math.round(
    (new Date(`${task.due_on}T00:00:00`) - new Date(`${today}T00:00:00`)) /
      86400000,
  );
  if (Number.isNaN(days)) return "";
  if (days === 0) return "ครบกำหนดวันนี้";
  return days > 0 ? `อีก ${days} วัน` : `เลยมา ${-days} วัน`;
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
          <ul className="sch-muted">
            <li>ครูประจำชั้น: ระบุชั้นปี ห้อง และปีการศึกษา</li>
            <li>
              ครูรายวิชา: ระบุชั้นปีและปีการศึกษา
              ห้องใส่ได้หลายห้องคั่นด้วยจุลภาค เช่น 1, 2, 3
            </li>
            <li>
              ครูแนะแนว: เว้นห้องว่าง แล้วใส่ชั้นปีที่ดูแลคั่นด้วยจุลภาค เช่น
              ม.1, ม.2, ม.3 ถ้าเว้นชั้นปีว่างจะดูแลทั้งโรงเรียน
            </li>
          </ul>
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
