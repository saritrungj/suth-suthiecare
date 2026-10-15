import SearchableSelect from '../../../components/SearchableSelect';
import { toDisplayText } from '../../../utils/textPresentation.js';
import MasterSelect from "../../../components/MasterSelect";
import StudentInsights from "./StudentInsights";
import { ExportButton } from "../../../components/ExcelExport";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import CaseActivity from "../../../components/case/CaseActivity";
import CaseDrawer from "../../../components/case/CaseDrawer";
import CaseReferralPanel from "../../../components/case/CaseReferralPanel";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import { FiEdit2, FiPlus, FiTrash2, FiUser, FiActivity, FiHeart, FiCornerUpRight } from "react-icons/fi";
import {
  createStudentPhysicalRecord,
  deleteStudentPhysicalRecord,
  getStudentHealth,
  getSchoolStudent,
  updateStudentHealthProfile,
  updateStudentPhysicalRecord,
} from "../../../services/api";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../../utils/alerts";
import {
  GENDER_LABELS,
  RiskBadge,
  STUDENT_STATUS_LABELS,
  useStudentStatusLabels,
  SchoolModal,
  TableScroll,
  ThaiDateField,
  classroomLabel,
  formatThaiDate,
  studentName,
} from "./schoolUi";

// recharts loads only when a health tab with a chart opens.
const GrowthChart = lazy(() =>
  import("./StudentHealthCharts").then((m) => ({ default: m.GrowthChart })),
);
const ScoreTrendChart = lazy(() =>
  import("./StudentHealthCharts").then((m) => ({
    default: m.ScoreTrendChart,
  })),
);

function ChartFrame({ label, children }) {
  return (
    <div className="sch-chart" role="img" aria-label={toDisplayText(label)}>
      <Suspense
        fallback={<div className="sch-chart-loading">กำลังโหลดกราฟ...</div>}
      >
        {children}
      </Suspense>
    </div>
  );
}

const TABS = [
  { id: "general", label: "ข้อมูลทั่วไป", icon: FiUser },
  { id: "physical", label: "สุขภาพกาย", icon: FiActivity },
  { id: "mental", label: "สุขภาพจิต", icon: FiHeart },
];

const HEARING_LABELS = {
  normal: "ปกติ",
  abnormal: "ผิดปกติ",
  not_tested: "ไม่ได้ตรวจ",
};
const BLOOD_LABELS = {
  A: "A",
  B: "B",
  AB: "AB",
  O: "O",
  unknown: "ไม่ทราบ",
};

const today = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Student file: profile, physical health (records + physical assessments)
// and mental health (assessment history). Opened from the student list and
// from the school case list.
export default function StudentDetailModal({
  studentId,
  onUpdated,
  initialTab = "general",
  onClose,
  nav,
}) {
  const { can } = usePermissions();
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const basic = await getSchoolStudent(studentId);
      const response = basic.data.can_view_health ? await getStudentHealth(studentId) : { data: { student: basic.data, can_update: false, assessments: { other: [] } } };
      if (id === requestId.current) { setData({...response.data,can_view_mental:basic.data.can_view_mental ?? basic.data.can_view_health,can_view_physical:basic.data.can_view_physical ?? basic.data.can_view_health}); if (!basic.data.can_view_health || (initialTab === 'mental' && basic.data.can_view_mental === false)) setTab("general"); }
    } catch (err) {
      if (id === requestId.current)
        setError(
          err.response?.data?.message || "ไม่สามารถโหลดข้อมูลนักเรียนได้",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    setData(null);
    load();
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  const reloadHealth = useCallback(async () => {
    await load();
    await onUpdated?.();
  }, [load, onUpdated]);

  const student = data?.student;
  return (
    <CaseDrawer
      title={student ? studentName(student) : "ข้อมูลนักเรียน"}
      meta={
        student
          ? `รหัส ${student.student_code} · ${classroomLabel(student)}`
          : undefined
      }
      nav={nav}
      tabs={[...TABS.filter(t => t.id === 'general' || (t.id === 'mental' ? data?.can_view_mental : data?.can_view_physical)), ...(data?.can_view_mental ? [{ id: "insights", label: "ข้อมูลเชิงลึก", icon: FiUser }, ...(can("cases.view") ? [{ id: "referrals", label: "ส่งต่อ", icon: FiCornerUpRight }] : [])] : [])]}
      activeTab={tab}
      onTabChange={setTab}
      onClose={onClose}
    >
      {loading && (
        <p className="sch-muted" role="status">
          กำลังโหลด...
        </p>
      )}
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {!loading && data && (
        <>
          <ExportButton sources={[{resource:"student",id:studentId}]} title="ข้อมูลนักเรียน" />
          <CaseActivity school full activity={data.latest_activity} />
          {tab === "insights" && data.can_view_mental && <StudentInsights studentId={studentId} />}
          {tab === "general" && <GeneralTab data={data} />}
          {tab === "physical" && data.can_view_physical && <PhysicalTab data={data} reload={reloadHealth} />}
          {tab === "mental" && data.can_view_mental && <MentalTab data={data} />}
          {tab === "referrals" && data.can_view_mental && can("cases.view") && (
            <StudentReferrals key={data.student.id} data={data} onUpdated={reloadHealth} />
          )}
        </>
      )}
    </CaseDrawer>
  );
}

function StudentReferrals({ data, onUpdated }) {
  const assessments = Object.values(data.assessments || {})
    .flat()
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const [selectedId, setSelectedId] = useState(assessments[0]?.id || "");
  return (
    <>
      <label className="sch-label" htmlFor="student-referral-assessment">
        แบบประเมินที่ใช้อ้างอิงการส่งต่อ
      </label>
      <SearchableSelect
        className="sch-input"
        id="student-referral-assessment"
        value={selectedId}
        onChange={(event) => setSelectedId(Number(event.target.value))}
      >
        {assessments.map((item) => (
          <option key={item.id} value={item.id}>
            {toDisplayText(item.form_title)} · {formatThaiDate(item.submitted_at)}
          </option>
        ))}
      </SearchableSelect>
      {selectedId ? (
        <CaseReferralPanel key={selectedId} sourceResponseId={selectedId} onUpdated={onUpdated} />
      ) : (
        <p className="sch-muted">
          ยังไม่มีแบบประเมินในหน่วยงานนี้สำหรับอ้างอิงการส่งต่อ
        </p>
      )}
    </>
  );
}

function GeneralTab({ data }) {
  const statusLabels=useStudentStatusLabels();
  const { student, assessments } = data;
  const accountStatus = student.username
    ? student.must_change_password
      ? "ยังไม่ได้เข้าใช้งาน (ใช้รหัสชั่วคราว)"
      : student.account_status === "active"
        ? "ใช้งานแล้ว"
        : "ปิดใช้งาน"
    : "ไม่มีบัญชี";
  return (
    <>
      <section className="sch-section">
        <dl className="sch-info-grid">
          <div>
            <dt>ชื่อ-นามสกุล</dt>
            <dd>{studentName(student)}</dd>
          </div>
          <div>
            <dt>ชื่อเล่น</dt>
            <dd>{student.nickname || "-"}</dd>
          </div>
          <div>
            <dt>รหัสนักเรียน</dt>
            <dd>{student.student_code}</dd>
          </div>
          <div>
            <dt>ชั้น/ห้อง</dt>
            <dd>
              {classroomLabel(student)}
              {student.academic_year
                ? ` (ปีการศึกษา ${student.academic_year})`
                : ""}
            </dd>
          </div>
          <div>
            <dt>ประเภทนักเรียน</dt>
            <dd>{student.student_type_name || "-"}</dd>
          </div>
          <div>
            <dt>เพศ</dt>
            <dd>{GENDER_LABELS[student.gender] || "-"}</dd>
          </div>
          <div>
            <dt>วันเกิด</dt>
            <dd>{formatThaiDate(student.birth_date)}</dd>
          </div>
          <div>
            <dt>สถานะ</dt>
            <dd>{student.status_label || statusLabels[student.status] || STUDENT_STATUS_LABELS[student.status] || student.status}</dd>
          </div>
          <div>
            <dt>ชื่อผู้ใช้</dt>
            <dd>{student.username || "-"}</dd>
          </div>
          <div>
            <dt>บัญชีผู้ใช้</dt>
            <dd>{accountStatus}</dd>
          </div>
        </dl>
      </section>
      {assessments.other.length > 0 && (
        <section className="sch-section">
          <h3>แบบประเมินอื่น ๆ (ไม่ได้ระบุหมวดสุขภาพ)</h3>
          <AssessmentList items={assessments.other} />
        </section>
      )}
    </>
  );
}

function AssessmentList({ items }) {
  if (!items.length)
    return <p className="sch-muted">ยังไม่มีผลแบบประเมินในหมวดนี้</p>;
  return (
    <ol className="sch-timeline">
      {items.map((item) => (
        <li key={item.id} className={`risk-${item.risk}`}>
          <div className="sch-timeline-body">
            <span className="sch-name">
              <span className="sch-risk-dot" aria-hidden="true" />
              {toDisplayText(item.form_title)}
            </span>
            <span className="sch-sub">{formatThaiDate(item.submitted_at)}</span>
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
  );
}

function PhysicalTab({ data, reload }) {
  const {
    profile,
    physical_records: records,
    assessments,
    can_update: canUpdate,
  } = data;
  const [editingProfile, setEditingProfile] = useState(false);
  const [recordForm, setRecordForm] = useState(null);
  const latest = records[0];
  const chartData = useMemo(
    () =>
      [...records]
        .reverse()
        .filter((r) => r.weight_kg || r.height_cm || r.bmi)
        .map((r) => ({
          date: formatThaiDate(r.measured_at),
          BMI: r.bmi,
          "น้ำหนัก (กก.)": r.weight_kg,
          "ส่วนสูง (ซม.)": r.height_cm,
        })),
    [records],
  );

  const removeRecord = async (record) => {
    if (
      !(await confirmAlert({
        title: "ลบบันทึกการตรวจ?",
        text: `บันทึกวันที่ ${formatThaiDate(record.measured_at)} จะถูกลบถาวร`,
        confirmText: "ลบ",
        danger: true,
      }))
    )
      return;
    try {
      await deleteStudentPhysicalRecord(record.id);
      await reload();
    } catch (err) {
      await showErrorAlert({ error: err, title: "ลบไม่สำเร็จ" });
    }
  };

  return (
    <>
      <section className="sch-section">
        <div className="sch-card-head">
          <h3>ข้อมูลสุขภาพประจำตัว</h3>
          {canUpdate && !editingProfile && (
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={() => setEditingProfile(true)}
            >
              <FiEdit2 aria-hidden="true" /> แก้ไข
            </button>
          )}
        </div>
        {editingProfile ? (
          <HealthProfileForm
            studentId={data.student.id}
            profile={profile}
            onCancel={() => setEditingProfile(false)}
            onSaved={async () => {
              setEditingProfile(false);
              await reload();
            }}
          />
        ) : (
          <dl className="sch-info-grid">
            <div>
              <dt>กรุ๊ปเลือด</dt>
              <dd>{BLOOD_LABELS[profile.blood_type] || "ไม่ทราบ"}</dd>
            </div>
            <div>
              <dt>โรคประจำตัว</dt>
              <dd>{profile.chronic_conditions || "-"}</dd>
            </div>
            <div>
              <dt>ประวัติแพ้ยา/อาหาร</dt>
              <dd>{profile.allergies || "-"}</dd>
            </div>
            <div>
              <dt>ยาที่ใช้ประจำ</dt>
              <dd>{profile.medications || "-"}</dd>
            </div>
            <div>
              <dt>ผู้ติดต่อฉุกเฉิน</dt>
              <dd>
                {profile.emergency_contact_name || "-"}
                {profile.emergency_contact_phone
                  ? ` (${profile.emergency_contact_phone})`
                  : ""}
              </dd>
            </div>
            <div>
              <dt>หมายเหตุ</dt>
              <dd>{toDisplayText(profile.notes || "-")}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="sch-section">
        <div className="sch-card-head">
          <h3>ผลตรวจร่างกายล่าสุด</h3>
          {canUpdate && (
            <button
              type="button"
              className="sch-btn"
              onClick={() =>
                setRecordForm({
                  measured_at: today(),
                  hearing_left: "not_tested",
                  hearing_right: "not_tested",
                })
              }
            >
              <FiPlus aria-hidden="true" /> บันทึกผลตรวจ
            </button>
          )}
        </div>
        {latest ? (
          <div className="sch-tiles sch-physical-summary">
            <div className="sch-tile">
              <span>BMI</span>
              <strong>{latest.bmi ?? "-"}</strong>
            </div>
            <div className="sch-tile">
              <span>น้ำหนัก / ส่วนสูง</span>
              <strong>
                {latest.weight_kg ?? "-"} / {latest.height_cm ?? "-"}
              </strong>
            </div>
            <div className="sch-tile">
              <span>ความดัน (mmHg)</span>
              <strong>
                {latest.systolic
                  ? `${latest.systolic}/${latest.diastolic ?? "-"}`
                  : "-"}
              </strong>
            </div>
            <div className="sch-tile">
              <span>ชีพจร (ครั้ง/นาที)</span>
              <strong>{latest.pulse ?? "-"}</strong>
            </div>
          </div>
        ) : (
          <p className="sch-muted">ยังไม่มีบันทึกผลตรวจร่างกาย</p>
        )}
        {latest && (
          <p className="sch-muted sch-tile-note">
            ตรวจเมื่อ {formatThaiDate(latest.measured_at)} · ค่า BMI
            ของเด็กต้องแปลผลตามเกณฑ์อายุและเพศ จึงแสดงเป็นตัวเลขเท่านั้น
          </p>
        )}
      </section>

      {chartData.length > 1 && (
        <section className="sch-section">
          <h3>แนวโน้มการเจริญเติบโต</h3>
          <ChartFrame label="กราฟแนวโน้ม BMI น้ำหนัก และส่วนสูงตามวันที่ตรวจ">
            <GrowthChart data={chartData} />
          </ChartFrame>
        </section>
      )}

      {records.length > 0 && (
        <section className="sch-section">
          <h3>ประวัติการตรวจร่างกาย</h3>
          <TableScroll
            label="ประวัติการตรวจร่างกาย"
            className="sch-health-history"
          >
            <table className="sch-table">
              <thead>
                <tr>
                  <th>วันที่ตรวจ</th>
                  <th className="sch-num">น้ำหนัก</th>
                  <th className="sch-num">ส่วนสูง</th>
                  <th className="sch-num">BMI</th>
                  <th>ความดัน / ชีพจร</th>
                  <th>สายตา (ซ/ข)</th>
                  <th>การได้ยิน (ซ/ข)</th>
                  <th>สมรรถภาพกาย</th>
                  <th>หมายเหตุ</th>
                  {canUpdate && (
                    <th>
                      <span className="sr-only">จัดการ</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td data-label="วันที่ตรวจ">
                      {formatThaiDate(record.measured_at)}
                    </td>
                    <td data-label="น้ำหนัก" className="sch-num">
                      {record.weight_kg ?? "-"}
                    </td>
                    <td data-label="ส่วนสูง" className="sch-num">
                      {record.height_cm ?? "-"}
                    </td>
                    <td data-label="BMI" className="sch-num">
                      {record.bmi ?? "-"}
                    </td>
                    <td data-label="ความดัน / ชีพจร">
                      {record.systolic
                        ? `${record.systolic}/${record.diastolic ?? "-"}`
                        : "-"}
                      {record.pulse ? ` · ${record.pulse}` : ""}
                    </td>
                    <td data-label="สายตา (ซ/ข)">
                      {record.vision_left || "-"} / {record.vision_right || "-"}
                    </td>
                    <td data-label="การได้ยิน (ซ/ข)">
                      {HEARING_LABELS[record.hearing_left]} /{" "}
                      {HEARING_LABELS[record.hearing_right]}
                    </td>
                    <td data-label="สมรรถภาพกาย">{record.fitness || "-"}</td>
                    <td data-label="หมายเหตุ">{toDisplayText(record.note || "-")}</td>
                    {canUpdate && (
                      <td>
                        <div className="sch-row-actions">
                          <button
                            type="button"
                            className="sch-icon-btn"
                            aria-label={`แก้ไขผลตรวจวันที่ ${formatThaiDate(record.measured_at)}`}
                            onClick={() => setRecordForm({ ...record })}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="sch-icon-btn sch-danger"
                            aria-label={`ลบผลตรวจวันที่ ${formatThaiDate(record.measured_at)}`}
                            onClick={() => removeRecord(record)}
                          >
                            <FiTrash2 aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      )}

      <section className="sch-section">
        <h3>แบบประเมินหมวดสุขภาพกาย</h3>
        <AssessmentList items={assessments.physical} />
      </section>

      {recordForm && (
        <PhysicalRecordForm
          studentId={data.student.id}
          initial={recordForm}
          onClose={() => setRecordForm(null)}
          onSaved={async () => {
            setRecordForm(null);
            await reload();
          }}
        />
      )}
    </>
  );
}

function HealthProfileForm({ studentId, profile, onCancel, onSaved }) {
  const [form, setForm] = useState({ ...profile });
  const [saving, setSaving] = useState(false);
  const field = (key) => ({
    value: form[key] || "",
    onChange: (event) => setForm({ ...form, [key]: event.target.value }),
  });
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await updateStudentHealthProfile(studentId, form);
      await showSuccessToast("บันทึกข้อมูลสุขภาพแล้ว");
      await onSaved();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="sch-form-grid" onSubmit={save}>
      <label className="sch-field">
        กรุ๊ปเลือด
        <MasterSelect category="blood_type" {...field("blood_type")} fallback={Object.entries(BLOOD_LABELS).map(([code,label])=>({code,label}))} />
      </label>
      <label className="sch-field">
        ผู้ติดต่อฉุกเฉิน
        <input maxLength={255} {...field("emergency_contact_name")} />
      </label>
      <label className="sch-field">
        เบอร์ผู้ติดต่อฉุกเฉิน
        <input
          maxLength={32}
          inputMode="tel"
          {...field("emergency_contact_phone")}
        />
      </label>
      <label className="sch-field sch-full">
        โรคประจำตัว
        <textarea {...field("chronic_conditions")} />
      </label>
      <label className="sch-field sch-full">
        ประวัติแพ้ยา/อาหาร
        <textarea {...field("allergies")} />
      </label>
      <label className="sch-field sch-full">
        ยาที่ใช้ประจำ
        <textarea {...field("medications")} />
      </label>
      <label className="sch-field sch-full">
        หมายเหตุ
        <textarea {...field("notes")} />
      </label>
      <div className="sch-full sch-form-actions">
        <button type="button" className="sch-btn-secondary" onClick={onCancel}>
          ยกเลิก
        </button>
        <button className="sch-btn" disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูลสุขภาพ"}
        </button>
      </div>
    </form>
  );
}

function PhysicalRecordForm({ studentId, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    measured_at: initial.measured_at || today(),
    weight_kg: initial.weight_kg ?? "",
    height_cm: initial.height_cm ?? "",
    systolic: initial.systolic ?? "",
    diastolic: initial.diastolic ?? "",
    pulse: initial.pulse ?? "",
    vision_left: initial.vision_left || "",
    vision_right: initial.vision_right || "",
    hearing_left: initial.hearing_left || "not_tested",
    hearing_right: initial.hearing_right || "not_tested",
    fitness: initial.fitness || "",
    note: initial.note || "",
  });
  const [saving, setSaving] = useState(false);
  const bmiPreview = useMemo(() => {
    const weight = Number(form.weight_kg);
    const height = Number(form.height_cm) / 100;
    return weight > 0 && height > 0
      ? (weight / (height * height)).toFixed(1)
      : "-";
  }, [form.weight_kg, form.height_cm]);
  const number = (key, label, props = {}) => (
    <label className="sch-field">
      {toDisplayText(label)}
      <input
        inputMode="decimal"
        value={form[key]}
        onChange={(event) =>
          setForm({
            ...form,
            [key]: event.target.value.replace(/[^\d.]/g, "").slice(0, 6),
          })
        }
        {...props}
      />
    </label>
  );
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (initial.id) await updateStudentPhysicalRecord(initial.id, form);
      else await createStudentPhysicalRecord(studentId, form);
      await showSuccessToast("บันทึกผลตรวจแล้ว");
      await onSaved();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกผลตรวจไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      size="small"
      title={initial.id ? "แก้ไขผลตรวจร่างกาย" : "บันทึกผลตรวจร่างกาย"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="submit"
            form="physical-record-form"
            className="sch-btn"
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </>
      }
    >
      <form id="physical-record-form" className="sch-form-grid" onSubmit={save}>
        <ThaiDateField
          label="วันที่ตรวจ"
          required
          value={form.measured_at}
          onChange={(iso) => setForm({ ...form, measured_at: iso })}
        />
        {number("weight_kg", "น้ำหนัก (กก.)")}
        {number("height_cm", "ส่วนสูง (ซม.)")}
        <div className="sch-field">
          BMI (คำนวณอัตโนมัติ)
          <output className="sch-output">{bmiPreview}</output>
        </div>
        {number("systolic", "ความดันตัวบน")}
        {number("diastolic", "ความดันตัวล่าง")}
        {number("pulse", "ชีพจร (ครั้ง/นาที)")}
        <label className="sch-field sch-full">ผลสมรรถภาพกาย<textarea maxLength={4000} value={form.fitness} onChange={event=>setForm({...form,fitness:event.target.value})} /></label>
        <label className="sch-field">
          สายตาซ้าย
          <input
            maxLength={10}
            placeholder="เช่น 6/6"
            value={form.vision_left}
            onChange={(event) =>
              setForm({ ...form, vision_left: event.target.value })
            }
          />
        </label>
        <label className="sch-field">
          สายตาขวา
          <input
            maxLength={10}
            placeholder="เช่น 6/9"
            value={form.vision_right}
            onChange={(event) =>
              setForm({ ...form, vision_right: event.target.value })
            }
          />
        </label>
        {["hearing_left", "hearing_right"].map((key) => (
          <label className="sch-field" key={key}>
            {key === "hearing_left" ? "การได้ยินหูซ้าย" : "การได้ยินหูขวา"}
            <MasterSelect category="hearing" fallback={Object.entries(HEARING_LABELS).map(([code,label])=>({code,label}))} value={form[key]} onChange={(event)=>setForm({...form,[key]:event.target.value})} />
          </label>
        ))}
        <label className="sch-field sch-full">
          หมายเหตุ
          <textarea
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
      </form>
    </SchoolModal>
  );
}

function MentalTab({ data }) {
  const items = data.assessments.mental;
  // Latest result of each form, plus a score trend for forms done repeatedly.
  const byForm = useMemo(() => {
    const groups = new Map();
    [...items].reverse().forEach((item) => {
      const group = groups.get(item.form_id) || {
        form_id: item.form_id,
        title: item.form_title,
        points: [],
      };
      group.points.push(item);
      groups.set(item.form_id, group);
    });
    return [...groups.values()];
  }, [items]);
  const repeated = byForm.filter((group) => group.points.length > 1);
  const [trendFormId, setTrendFormId] = useState(repeated[0]?.form_id || "");
  const trend = repeated.find(
    (group) => String(group.form_id) === String(trendFormId),
  );
  const trendData = (trend?.points || [])
    .map((point) => ({
      date: formatThaiDate(point.submitted_at),
      คะแนน: Number(point.score_results[0]?.score),
    }))
    .filter((point) => Number.isFinite(point["คะแนน"]));

  if (!items.length)
    return (
      <div className="sch-empty-state">
        <strong>ยังไม่มีผลแบบประเมินสุขภาพจิต</strong>
        <span>
          ผลจะแสดงเมื่อนักเรียนทำแบบประเมินที่ตั้งหมวดสุขภาพเป็น
          &quot;สุขภาพจิต&quot; ด้วยบัญชีของตนเอง
          หรือกรอกเลขบัตรประชาชนและยินยอม PDPA
        </span>
      </div>
    );

  return (
    <>
      <section className="sch-section">
        <h3>ผลล่าสุดของแต่ละแบบประเมิน</h3>
        <div className="sch-tiles">
          {byForm.map((group) => {
            const latest = group.points[group.points.length - 1];
            return (
              <div
                className={`sch-tile risk-${latest.risk}`}
                key={group.form_id}
              >
                <span>{toDisplayText(group.title)}</span>
                <strong className="sch-tile-label">
                  {latest.score_results[0]?.label || "-"}
                </strong>
                <span className="sch-tile-meta">
                  <RiskBadge risk={latest.risk} />
                  {formatThaiDate(latest.submitted_at)}
                </span>
              </div>
            );
          })}
        </div>
      </section>
      {repeated.length > 0 && (
        <section className="sch-section">
          <div className="sch-card-head">
            <h3>แนวโน้มคะแนน</h3>
            <label className="sch-field sch-trend-select">
              <span className="sr-only">เลือกแบบประเมิน</span>
              <SearchableSelect
                value={trendFormId}
                onChange={(event) => setTrendFormId(event.target.value)}
              >
                {repeated.map((group) => (
                  <option key={group.form_id} value={group.form_id}>
                    {toDisplayText(group.title)}
                  </option>
                ))}
              </SearchableSelect>
            </label>
          </div>
          {trendData.length > 1 ? (
            <ChartFrame label={`กราฟแนวโน้มคะแนน ${trend?.title || ""}`}>
              <ScoreTrendChart data={trendData} />
            </ChartFrame>
          ) : (
            <p className="sch-muted">
              แบบประเมินนี้ไม่มีคะแนนตัวเลขให้แสดงเป็นกราฟ
            </p>
          )}
        </section>
      )}
      <section className="sch-section">
        <h3>ประวัติแบบประเมินสุขภาพจิตทั้งหมด</h3>
        <AssessmentList items={items} />
      </section>
    </>
  );
}
