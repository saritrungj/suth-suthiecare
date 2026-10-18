import { toDisplayText } from "../../../utils/textPresentation.js";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, {
  getForms,
  getSchoolStudents,
  getSchoolTeachers,
  getSchoolClassrooms,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  PageHeader,
  BarSelect,
  TableScroll,
  ThaiDateField,
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
import { RiskPill } from "../../../components/case/CaseDrawer";

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
      {message && <p role="status">{message}</p>}
      {loading && <p role="status">กำลังโหลดข้อมูล…</p>}
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
  return (
    <TableScroll label={label}>
      <table className="sch-table">
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
          {rows?.length ? (
            rows.map((row, i) => (
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
              <td colSpan={columns.length}>ยังไม่มีรายการ</td>
            </tr>
          )}
        </tbody>
      </table>
    </TableScroll>
  );
}
function FormSelect({ forms, value, onChange, domain, required = true }) {
  return (
    <Field label="แบบประเมิน">
      <select
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
      </select>
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
  const tabs = [
    ...(access?.can_view_risk !== false ? [["risk", "ภาพรวมความเสี่ยง"]] : []),
    ["rounds", "รอบประเมิน"],
    ...(access?.can_view_mental ? [["followup", "คัดกรองซ้ำ"]] : []),
    ...(access?.can_manage_staff
      ? [
          ["enrollment", "หอพักและเลื่อนชั้น"],
          ["teachers", "นำเข้าครู"],
          ["settings", "คำแนะนำและการเก็บข้อมูล"],
          ...(access?.can_view_mental ? [["rules", "เกณฑ์รายข้อ"]] : []),
        ]
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
        <nav className="sch-workflow-nav" aria-label="งานโรงเรียน">
          {tabs.map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={tab === key ? "sch-btn" : "sch-btn-secondary"}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
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
          <section className="sch-card" key={`${schoolId}-${tab}`}>
            {tab === "risk" && <RiskSummary schoolId={schoolId} />}{" "}
            {tab === "rounds" && (
              <Rounds
                schoolId={schoolId}
                forms={forms}
                manage={access?.can_manage_staff}
              />
            )}{" "}
            {tab === "followup" && access?.can_view_mental && (
              <Followup schoolId={schoolId} forms={forms} />
            )}{" "}
            {tab === "enrollment" && access?.can_manage_staff && (
              <Enrollment schoolId={schoolId} />
            )}{" "}
            {tab === "teachers" && access?.can_manage_staff && (
              <TeacherImport schoolId={schoolId} />
            )}{" "}
            {tab === "settings" && access?.can_manage_staff && (
              <Settings schoolId={schoolId} />
            )}{" "}
            {tab === "rules" &&
              access?.can_manage_staff &&
              access?.can_view_mental && (
                <RiskRules schoolId={schoolId} forms={forms} />
              )}
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
  const rows = (state.data?.data || []).filter(
    (r) => !risk || r.risk_status === risk,
  );
  return (
    <>
      <h2>ภาพรวมความเสี่ยงและคำแนะนำเบื้องต้น</h2>
      <div className="sch-form-grid">
        <Field label="ระดับความเสี่ยง">
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="">ทุกระดับ</option>
            {Object.entries(RISK_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {toDisplayText(label)}
              </option>
            ))}
          </select>
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
          ["classroom_name", "ห้อง"],
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
function Rounds({ schoolId, forms, manage }) {
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
    [selected, setSelected] = useState("");
  const progress = useLoad(
    selected ? `/school/screening-rounds/${selected}/progress` : null,
  );
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <>
      <h2>รอบประเมิน</h2>
      <p>
        สร้างรอบสุขภาพกายหนึ่งครั้ง และสุขภาพจิตต้นภาคเรียน/ปลายภาคเรียน
        โดยกำหนดวันและแบบประเมินแต่ละรอบ
      </p>
      <Notice {...state} />
      <Notice {...action} />
      {manage && (
        <form
          className="sch-form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            action.run(async () => {
              await api.post("/school/screening-rounds", form);
              await state.load();
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
            <select
              value={form.semester}
              onChange={(e) => set("semester", e.target.value)}
            >
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </Field>
          <Field label="ด้านสุขภาพ">
            <select
              value={form.health_domain}
              onChange={(e) =>
                setForm({ ...form, health_domain: e.target.value, form_id: "" })
              }
            >
              <option value="mental">สุขภาพจิต</option>
              <option value="physical">สุขภาพกาย</option>
            </select>
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
          <div className="sch-form-actions sch-full">
            <button className="sch-btn" disabled={action.busy}>
              สร้างรอบประเมิน
            </button>
          </div>
        </form>
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
            (r) => (r.status === "active" ? "เปิดรอบ" : "ปิดรอบ"),
          ],
          [
            "action",
            "ติดตาม",
            (r) => (
              <>
                <button
                  type="button"
                  className="sch-btn-secondary"
                  onClick={() => setSelected(String(r.id))}
                >
                  ดูผู้ยังไม่ประเมิน
                </button>
                {manage && (
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    disabled={action.busy}
                    onClick={() =>
                      action.run(async () => {
                        await api.put(`/school/screening-rounds/${r.id}`, {
                          status: r.status === "active" ? "closed" : "active",
                        });
                        await state.load();
                      })
                    }
                  >
                    {r.status === "active" ? "ปิดรอบ" : "เปิดรอบ"}
                  </button>
                )}
              </>
            ),
          ],
        ]}
      />
      {selected && (
        <>
          <h3>ความคืบหน้ารอบประเมิน</h3>
          <Notice {...progress} />
          {progress.data && (
            <>
              <p role="status">
                ทั้งหมด {progress.data.total} คน · ประเมินแล้ว{" "}
                {progress.data.completed} คน · ยังไม่ประเมิน{" "}
                {progress.data.outstanding} คน
              </p>
              <DataTable
                label="ผู้ยังไม่ประเมิน"
                rows={progress.data.data.filter((r) => !r.completed_on)}
                columns={[
                  ["student_code", "รหัสนักเรียน"],
                  ["classroom_name", "ห้อง"],
                ]}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
function Followup({ schoolId, forms }) {
  const state = useLoad("/school/rescreen-tasks"),
    action = useAction();
  const [students, setStudents] = useState([]),
    [teachers, setTeachers] = useState([]);
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
  const [complete, setComplete] = useState(null),
    [responseId, setResponseId] = useState("");
  const completionHealth = useLoad(
    complete ? `/school/students/${complete.student_id}/health` : null,
  );
  return (
    <>
      <h2>คัดกรองซ้ำและติดตาม</h2>
      <Notice {...state} />
      <Notice {...action} />
      <form
        className="sch-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            await api.post("/school/rescreen-tasks", form);
            await state.load();
          });
        }}
      >
        <Field label="นักเรียน">
          <select
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
                {s.student_code} · {s.classroom_name}
              </option>
            ))}
          </select>
        </Field>
        <Notice {...selectedHealth} />
        <Field label="ผลประเมินต้นทาง">
          <select
            required
            value={form.source_response_id}
            onChange={(e) =>
              setForm({ ...form, source_response_id: e.target.value })
            }
          >
            <option value="">เลือกผลประเมิน</option>
            {selectedHealth.data?.assessments?.mental?.map((r) => (
              <option key={r.id} value={r.id}>
                {toDisplayText(r.form_title)} · {formatThaiDate(r.submitted_at)}{" "}
                · {RISK_LABELS[r.risk]}
              </option>
            ))}
          </select>
        </Field>
        <FormSelect
          forms={forms}
          domain="mental"
          value={form.target_form_id}
          onChange={(v) => setForm({ ...form, target_form_id: v })}
        />
        <Notice {...assignees} />
        <Field label="ผู้รับผิดชอบ">
          <select
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
          </select>
        </Field>
        <ThaiDateField
          required
          allowFuture
          label="กำหนดประเมินซ้ำ"
          value={form.due_on}
          onChange={(v) => setForm({ ...form, due_on: v })}
        />
        <div className="sch-form-actions sch-full">
          <button className="sch-btn" disabled={action.busy}>
            สร้างงานติดตาม
          </button>
        </div>
      </form>
      <DataTable
        label="งานคัดกรองซ้ำ"
        rows={(state.data || []).filter(
          (r) => String(r.school_id) === String(schoolId),
        )}
        columns={[
          ["student_code", "นักเรียน"],
          ["due_on", "ครบกำหนด", (r) => formatThaiDate(r.due_on)],
          [
            "status",
            "สถานะ",
            (r) =>
              r.status === "completed"
                ? "ประเมินซ้ำแล้ว"
                : r.status === "cancelled"
                  ? "ยกเลิก"
                  : r.overdue
                    ? "เลยกำหนด"
                    : "รอประเมินซ้ำ",
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
                <>
                  <button
                    className="sch-btn-secondary"
                    onClick={() => {
                      setComplete(r);
                      setResponseId("");
                    }}
                  >
                    เชื่อมผลประเมินซ้ำ
                  </button>
                  <button
                    className="sch-btn-secondary"
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
                    ยกเลิกงาน
                  </button>
                </>
              ),
          ],
        ]}
      />
      {complete && (
        <form
          className="sch-form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            action.run(async () => {
              await api.put(`/school/rescreen-tasks/${complete.id}`, {
                status: "completed",
                completed_response_id: Number(responseId),
              });
              setComplete(null);
              await state.load();
            });
          }}
        >
          <h3 className="sch-full">
            เชื่อมผลประเมินซ้ำของ {complete.student_code}
          </h3>
          <Notice {...completionHealth} />
          <Field label="ผลประเมินซ้ำ">
            <select
              required
              value={responseId}
              onChange={(e) => setResponseId(e.target.value)}
            >
              <option value="">เลือกผลที่ส่งหลังสร้างงาน</option>
              {completionHealth.data?.assessments?.mental
                ?.filter(
                  (r) =>
                    Number(r.form_id) === Number(complete.target_form_id) &&
                    new Date(r.submitted_at) >= new Date(complete.created_at) &&
                    Number(r.id) !== Number(complete.source_response_id),
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {formatThaiDate(r.submitted_at)} · {RISK_LABELS[r.risk]}
                  </option>
                ))}
            </select>
          </Field>
          <button className="sch-btn" disabled={action.busy}>
            ยืนยันผลประเมินซ้ำ
          </button>
          <button
            type="button"
            className="sch-btn-secondary"
            onClick={() => setComplete(null)}
          >
            ปิด
          </button>
        </form>
      )}
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
function Enrollment({ schoolId }) {
  const action = useAction(),
    [students, setStudents] = useState([]),
    [selected, setSelected] = useState(""),
    [details, setDetails] = useState({ is_boarder: false, graduated_on: "" }),
    [year, setYear] = useState(currentAcademicYear()),
    [source, setSource] = useState([]),
    [target, setTarget] = useState([]),
    [mappings, setMappings] = useState([
      { from_classroom_id: "", to_classroom_id: "" },
    ]),
    [preview, setPreview] = useState(null);
  const history = useLoad(
    selected ? `/school/students/${selected}/enrollment-history` : null,
  );
  useEffect(() => {
    loadStudents(schoolId)
      .then(setStudents)
      .catch((e) => action.run(() => Promise.reject(e)));
  }, [schoolId]);
  useEffect(() => {
    setPreview(null);
    setMappings([{ from_classroom_id: "", to_classroom_id: "" }]);
    Promise.all([
      getSchoolClassrooms(schoolId, { academic_year: year }),
      getSchoolClassrooms(schoolId, { academic_year: Number(year) + 1 }),
    ])
      .then(([a, b]) => {
        setSource(a.data || []);
        setTarget(b.data || []);
      })
      .catch((e) => action.run(() => Promise.reject(e)));
  }, [year, schoolId]);
  const selectedStudent = students.find((s) => String(s.id) === selected);
  return (
    <>
      <h2>สถานะหอพักและวันจบการศึกษา</h2>
      <Notice {...action} />
      <form
        className="sch-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            await api.put(`/school/students/${selected}/enrollment`, details);
            setStudents(await loadStudents(schoolId));
          });
        }}
      >
        <Field label="นักเรียน">
          <select
            required
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              const s = students.find((s) => String(s.id) === e.target.value);
              setDetails({
                is_boarder: Boolean(s?.is_boarder),
                graduated_on: s?.graduated_on || "",
              });
            }}
          >
            <option value="">เลือกนักเรียน</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.student_code} · {s.classroom_name} · {s.status_label}
              </option>
            ))}
          </select>
        </Field>
        <label className="sch-check">
          <input
            type="checkbox"
            checked={details.is_boarder}
            onChange={(e) =>
              setDetails({ ...details, is_boarder: e.target.checked })
            }
          />
          นักเรียนหอพัก
        </label>
        {selectedStudent?.status === "graduated" && (
          <ThaiDateField
            label="วันจบการศึกษา"
            value={details.graduated_on}
            onChange={(v) => setDetails({ ...details, graduated_on: v })}
          />
        )}
        <div className="sch-full">
          <button className="sch-btn" disabled={!selected || action.busy}>
            บันทึกสถานะนักเรียน
          </button>
        </div>
      </form>
      {selected && (
        <>
          <h3>ประวัติห้องเรียน</h3>
          <Notice {...history} />
          <DataTable
            label="ประวัติห้องเรียน"
            rows={history.data || []}
            columns={[
              ["changed_at", "วันที่", (r) => formatThaiDate(r.changed_at)],
              ["from_classroom", "ห้องเดิม"],
              ["to_classroom", "ห้องใหม่"],
              ["academic_year", "ปีการศึกษา"],
            ]}
          />
        </>
      )}
      <h2>เลื่อนชั้นโดยรักษากลุ่มห้องเดิม</h2>
      <p>
        สร้างห้องปีถัดไปในหน้าโครงสร้างโรงเรียนก่อน
        แล้วเลือกห้องต้นทางและปลายทาง
      </p>
      <Field label="ปีการศึกษาต้นทาง (พ.ศ.)">
        <input
          type="number"
          min={2400}
          max={2699}
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </Field>
      <div className="sch-workflow-mappings">
        {mappings.map((m, i) => (
          <div className="sch-form-grid" key={i}>
            {[
              ["from_classroom_id", "ห้องต้นทาง", source],
              ["to_classroom_id", "ห้องปีถัดไป", target],
            ].map(([key, label, rooms]) => (
              <Field key={key} label={label}>
                <select
                  value={m[key]}
                  onChange={(e) => {
                    setPreview(null);
                    setMappings(
                      mappings.map((old, j) =>
                        j === i ? { ...old, [key]: e.target.value } : old,
                      ),
                    );
                  }}
                >
                  <option value="">เลือกห้อง</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.grade_name} · {r.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        ))}
      </div>
      <div className="sch-form-actions">
        <button
          className="sch-btn-secondary"
          disabled={action.busy}
          onClick={() => {
            setPreview(null);
            setMappings([
              ...mappings,
              { from_classroom_id: "", to_classroom_id: "" },
            ]);
          }}
        >
          เพิ่มคู่ห้อง
        </button>
        <button
          className="sch-btn-secondary"
          disabled={
            action.busy ||
            mappings.some((m) => !m.from_classroom_id || !m.to_classroom_id)
          }
          onClick={() =>
            action.run(async () => {
              const { data } = await api.post("/school/promotions", {
                school_id: Number(schoolId),
                mappings,
                dry_run: true,
              });
              setPreview(data);
            }, "ตรวจสอบการเลื่อนชั้นแล้ว")
          }
        >
          ตรวจสอบจำนวนก่อนย้าย
        </button>
        {preview && (
          <button
            className="sch-btn"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await api.post("/school/promotions", {
                  school_id: Number(schoolId),
                  mappings,
                  dry_run: false,
                });
                setPreview(null);
                setStudents(await loadStudents(schoolId));
                await history.load();
              }, "เลื่อนชั้นเรียบร้อย")
            }
          >
            เลื่อนชั้น {preview.data.reduce((n, m) => n + m.count, 0)} คน
          </button>
        )}
      </div>
      {preview && (
        <DataTable
          label="ผลตรวจสอบการเลื่อนชั้น"
          rows={preview.data}
          columns={[
            [
              "from_classroom_id",
              "ห้องต้นทาง",
              (r) => source.find((c) => c.id === r.from_classroom_id)?.name,
            ],
            [
              "to_classroom_id",
              "ห้องปลายทาง",
              (r) => target.find((c) => c.id === r.to_classroom_id)?.name,
            ],
            ["count", "นักเรียน (คน)"],
          ]}
        />
      )}
    </>
  );
}
function TeacherImport({ schoolId }) {
  const action = useAction(),
    [rows, setRows] = useState(null),
    [results, setResults] = useState([]),
    [checked, setChecked] = useState(false),
    [done, setDone] = useState(false),
    [progress, setProgress] = useState(0);
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
      <h2>นำเข้าบัญชีครูและผูกห้องเรียน</h2>
      <p>
        บัญชีใหม่ต้องยืนยันอีเมลเมื่อเข้าสู่ระบบ บัญชีเดิมใช้รหัสผ่านเดิม
        ครูประจำชั้นต้องระบุชั้นปี ห้อง และปีการศึกษา
      </p>
      <Notice {...action} />
      <div className="sch-form-actions">
        <button
          className="sch-btn-secondary"
          onClick={() =>
            action.run(() => saveTeacherWorkbook(), "ดาวน์โหลดไฟล์ต้นแบบแล้ว")
          }
        >
          ดาวน์โหลดไฟล์ต้นแบบครู
        </button>
      </div>
      <Field label="ไฟล์รายชื่อครู (.xlsx / .csv)">
        <input
          type="file"
          accept=".xlsx,.csv"
          disabled={action.busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setRows(null);
            setResults([]);
            setChecked(false);
            setDone(false);
            if (file)
              action.run(async () => {
                const parsed = await readTeacherFile(file);
                if (!parsed.length || parsed.length > 3000)
                  throw Error("นำเข้าได้ 1–3,000 แถว");
                const seen = new Set();
                for (const r of parsed) {
                  const key = r.username?.toLowerCase();
                  if (seen.has(key)) throw Error("ชื่อผู้ใช้ซ้ำในไฟล์");
                  seen.add(key);
                }
                setRows(parsed);
              }, "อ่านไฟล์แล้ว");
          }}
        />
      </Field>
      <div className="sch-form-actions">
        <button
          className="sch-btn-secondary"
          disabled={!rows || done || action.busy}
          onClick={() => action.run(() => runImport(true), "ตรวจสอบข้อมูลแล้ว")}
        >
          ตรวจสอบก่อนนำเข้า
        </button>
        <button
          className="sch-btn"
          disabled={!checked || action.busy || done}
          onClick={() =>
            action.run(() => runImport(false), "นำเข้าครูเรียบร้อย")
          }
        >
          นำเข้าครู
        </button>
        {results.some((r) => r.password) && (
          <button
            className="sch-btn-secondary"
            onClick={() =>
              action.run(
                () => saveTeacherWorkbook(results),
                "ดาวน์โหลดบัญชีครูแล้ว",
              )
            }
          >
            ดาวน์โหลดบัญชีที่สร้างแล้ว
          </button>
        )}
      </div>
      {action.busy && (
        <p role="status">
          ดำเนินการ {progress}/{rows?.length} แถว
        </p>
      )}
      <DataTable
        label="ผลตรวจสอบครู"
        rows={results}
        columns={[
          ["row", "แถว"],
          ["username", "ชื่อผู้ใช้"],
          ["status", "ผล"],
          ["errors", "ข้อผิดพลาด", (r) => r.errors.join(" · ")],
        ]}
      />
    </>
  );
}
function Settings({ schoolId }) {
  const state = useLoad(`/school/workflow-settings/${schoolId}`),
    action = useAction(),
    [form, setForm] = useState({
      care_advice: { high: "", medium: "", normal: "", none: "" },
      retention_years: 2,
    }),
    [preview, setPreview] = useState(null);
  useEffect(() => {
    if (state.data)
      setForm({
        care_advice: state.data.care_advice,
        retention_years: state.data.retention_years || 2,
      });
  }, [state.data]);
  return (
    <>
      <h2>คำแนะนำสำหรับครูทั่วไปและเจ้าหน้าที่หอพัก</h2>
      <Notice {...state} />
      <Notice {...action} />
      <form
        className="sch-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            await api.put(`/school/workflow-settings/${schoolId}`, form);
            setPreview(null);
            await state.load();
          });
        }}
      >
        {Object.entries(RISK_LABELS).map(([key, label]) => (
          <Field key={key} label={`คำแนะนำ: ${label}`}>
            <textarea
              maxLength={2000}
              value={form.care_advice[key] || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  care_advice: { ...form.care_advice, [key]: e.target.value },
                })
              }
            />
          </Field>
        ))}
        <Field label="เก็บข้อมูลหลังจบการศึกษา (ปี)">
          <input
            required
            type="number"
            min={1}
            max={100}
            value={form.retention_years}
            onChange={(e) => {
              setPreview(null);
              setForm({ ...form, retention_years: e.target.value });
            }}
          />
        </Field>
        <div className="sch-full">
          <button
            className="sch-btn"
            disabled={action.busy || state.loading || Boolean(state.error)}
          >
            บันทึกคำแนะนำและนโยบาย
          </button>
        </div>
      </form>
      <h2>ตรวจข้อมูลที่ครบระยะเวลาเก็บ</h2>
      <p>
        นับจากวันจบการศึกษาที่บันทึกไว้
        และยกเว้นข้อมูลที่ต้องเก็บตามคำสั่งระงับการลบ
        การเก็บเข้าคลังจะปิดการเข้าถึงผ่าน School
        โดยยังรักษาบัญชีและเวชระเบียนที่ใช้ร่วมกับหน่วยงานอื่น
      </p>
      <div className="sch-form-actions">
        <button
          className="sch-btn-secondary"
          disabled={action.busy || !state.data?.retention_years}
          onClick={() =>
            action.run(async () => {
              const { data } = await api.post(`/school/retention/${schoolId}`, {
                dry_run: true,
              });
              setPreview(data);
            }, "ตรวจสอบข้อมูลครบกำหนดแล้ว")
          }
        >
          ตรวจสอบข้อมูลครบกำหนด
        </button>
        {preview?.data?.length > 0 && (
          <button
            className="sch-btn"
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                const { data } = await api.post(
                  `/school/retention/${schoolId}`,
                  { dry_run: false },
                );
                setPreview(null);
              }, "เก็บข้อมูลเข้าในคลังแล้ว")
            }
          >
            เก็บเข้าคลัง {preview.data.length} คน
          </button>
        )}
      </div>
      {preview && (
        <DataTable
          label="ข้อมูลครบกำหนด"
          rows={preview.data}
          columns={[
            ["student_code", "รหัสนักเรียน"],
            [
              "graduated_on",
              "วันจบการศึกษา",
              (r) => formatThaiDate(r.graduated_on),
            ],
          ]}
        />
      )}
    </>
  );
}
function flatten(questions) {
  return (questions || []).flatMap((q) => [q, ...flatten(q.subQuestions)]);
}
function RiskRules({ schoolId, forms }) {
  const state = useLoad("/school/risk-triggers"),
    action = useAction(),
    [form, setForm] = useState({
      school_id: Number(schoolId),
      form_id: "",
      question_id: "",
      answer_path: "",
      answer_value: "",
    }),
    [questions, setQuestions] = useState([]);
  useEffect(() => {
    let alive = true;
    setQuestions([]);
    if (form.form_id)
      api
        .get(`/forms/${form.form_id}`)
        .then(({ data }) => {
          if (alive) {
            const q = data.questions;
            setQuestions(flatten(typeof q === "string" ? JSON.parse(q) : q));
          }
        })
        .catch((e) => action.run(() => Promise.reject(e)));
    return () => {
      alive = false;
    };
  }, [form.form_id]);
  return (
    <>
      <h2>เกณฑ์คำตอบรายข้อที่ให้เป็นสีแดง</h2>
      <p>
        เลือกข้อคำถามจากแบบประเมินจริง และระบุคำตอบให้ตรงกับตัวเลือก
        เกณฑ์มีผลกับการส่งแบบประเมินครั้งถัดไปและไม่แก้คะแนนดั้งเดิม
      </p>
      <Notice {...state} />
      <Notice {...action} />
      <form
        className="sch-form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          action.run(async () => {
            await api.post("/school/risk-triggers", form);
            await state.load();
          });
        }}
      >
        <FormSelect
          forms={forms}
          domain="mental"
          value={form.form_id}
          onChange={(v) =>
            setForm({ ...form, form_id: v, question_id: "", answer_path: "" })
          }
        />
        <Field label="ข้อคำถาม">
          <select
            required
            value={form.question_id}
            onChange={(e) =>
              setForm({
                ...form,
                question_id: e.target.value,
                answer_path: "",
                answer_value: "",
              })
            }
          >
            <option value="">เลือกข้อคำถาม</option>
            {questions
              .filter((q) => !["group", "section"].includes(q.type))
              .map((q) => (
                <option key={q.id} value={q.id}>
                  {toDisplayText(String(q.title || q.id))}
                </option>
              ))}
          </select>
        </Field>
        {questions.find((q) => String(q.id) === form.question_id)?.rows && (
          <Field label="แถวคำถามที่ต้องตรวจ">
            <select
              required
              value={form.answer_path}
              onChange={(e) =>
                setForm({ ...form, answer_path: e.target.value })
              }
            >
              <option value="">เลือกแถวคำถาม</option>
              {questions
                .find((q) => String(q.id) === form.question_id)
                .rows.map((row, i) => (
                  <option key={i} value={String(i)}>
                    {toDisplayText(String(row))}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <Field label="คำตอบที่ให้เป็นสีแดง">
          <input
            required
            maxLength={500}
            list="school-trigger-answers"
            value={form.answer_value}
            onChange={(e) => setForm({ ...form, answer_value: e.target.value })}
          />
          <datalist id="school-trigger-answers">
            {(
              questions.find((q) => String(q.id) === form.question_id)
                ?.options ||
              questions.find((q) => String(q.id) === form.question_id)?.cols ||
              []
            ).map((value, i) => (
              <option key={i} value={String(value)} />
            ))}
          </datalist>
        </Field>
        <div className="sch-full">
          <button className="sch-btn" disabled={action.busy}>
            บันทึกเกณฑ์ที่โรงเรียนยืนยัน
          </button>
        </div>
      </form>
      <DataTable
        label="เกณฑ์รายข้อ"
        rows={(state.data || []).filter(
          (r) => String(r.school_id) === String(schoolId),
        )}
        columns={[
          [
            "form_id",
            "แบบประเมิน",
            (r) =>
              forms.find((f) => Number(f.id) === Number(r.form_id))?.title ||
              r.form_id,
          ],
          ["question_id", "ข้อคำถาม"],
          ["answer_value", "คำตอบ"],
          ["enabled", "สถานะ", (r) => (r.enabled ? "ใช้งาน" : "ปิดใช้งาน")],
          [
            "action",
            "จัดการ",
            (r) => (
              <button
                className="sch-btn-secondary"
                disabled={action.busy}
                onClick={() =>
                  action.run(async () => {
                    await api.put(`/school/risk-triggers/${r.id}`, {
                      enabled: !r.enabled,
                    });
                    await state.load();
                  })
                }
              >
                {r.enabled ? "ปิดเกณฑ์" : "เปิดเกณฑ์"}
              </button>
            ),
          ],
        ]}
      />
    </>
  );
}
