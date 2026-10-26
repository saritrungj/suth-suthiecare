import SearchableSelect from "../../../components/SearchableSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import MasterSelect from "../../../components/MasterSelect";
import StudentInsights from "./StudentInsights";
import { StudentBehaviorTab } from "./behavior";
import { StudentFollowUps } from "./followUpParts";
import { StudentCareGuidance } from "./careSettings";
import StudentAuditTab from "./StudentAuditTab";
import StudentContactsSection from "./StudentContactsSection";
import StudentGuardiansSection from "./StudentGuardiansSection";
import { bangkokDateKey } from "../../../utils/caseDateFilter";
import { BMI_SOURCE_NOTE, classifyBmi } from "../../../utils/bmiForAge";
import {
  MentalHistoryByTerm,
  StudentMentalStatus,
} from "./StudentMentalStatus";
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
import {
  FiEdit2,
  FiPlus,
  FiTrash2,
  FiUser,
  FiActivity,
  FiHeart,
  FiCornerUpRight,
  FiLayers,
  FiClipboard,
  FiClock,
  FiBookOpen,
  FiKey,
} from "react-icons/fi";
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

// BMI judged against WHO BMI-for-age, by the student's age on the day.
function BmiCategory({ bmi, student, measuredAt }) {
  const result = classifyBmi({
    bmi,
    birthDate: student?.birth_date,
    gender: student?.gender,
    measuredAt,
  });
  if (!bmi) return null;
  return result.category ? (
    <span
      className={`sch-badge bmi-${result.tone}`}
      title={`z-score ${result.z}`}
    >
      {result.label}
    </span>
  ) : (
    <span className="sch-badge" title={result.reason}>
      ประเมินตามเกณฑ์ไม่ได้
    </span>
  );
}

// Line colours of the score chart, from the app's chart tokens.
const SERIES_COLORS = [
  "var(--suth-chart-purple)",
  "var(--suth-chart-teal)",
  "var(--suth-action)",
  "var(--suth-chart-blue)",
  "var(--suth-chart-sage)",
  "var(--suth-chart-apricot)",
  "var(--suth-danger)",
];

function ChartFrame({ label, children, className = "" }) {
  return (
    <div
      className={`sch-chart ${className}`.trim()}
      role="img"
      aria-label={toDisplayText(label)}
    >
      <Suspense
        fallback={<div className="sch-chart-loading">กำลังโหลดกราฟ...</div>}
      >
        {children}
      </Suspense>
    </div>
  );
}

// Tabs of the student file, in display order. A new tab is one entry here:
// `visible(data, can, schoolAccess)` decides who sees it (data is null while
// loading) and `render` draws it once the file has loaded.
const STUDENT_TABS = [
  {
    id: "general",
    label: "ข้อมูลทั่วไป",
    icon: FiUser,
    visible: () => true,
    render: ({ data }) => (
      <>
        <GeneralTab data={data} />
        {(data.can_view_mental || data.can_view_physical) && (
          <StudentContactsSection studentId={data.student.id} />
        )}
        <StudentGuardiansSection student={data.student} />
      </>
    ),
  },
  {
    id: "physical",
    label: "สุขภาพกาย",
    icon: FiActivity,
    visible: (data) => Boolean(data?.can_view_physical),
    render: ({ data, reload }) => (
      <>
        <StudentFollowUps studentId={data.student.id} />
        <PhysicalTab data={data} reload={reload} />
      </>
    ),
  },
  {
    id: "mental",
    label: "สุขภาพจิต",
    icon: FiHeart,
    visible: (data) => Boolean(data?.can_view_mental),
    render: ({ data, reload, period }) => (
      <>
        <StudentMentalStatus data={data} reload={reload} />
        <StudentCareGuidance studentId={data.student.id} />
        <MentalTab data={data} period={period} />
      </>
    ),
  },
  {
    id: "behavior",
    label: "พฤติกรรม",
    icon: FiClipboard,
    visible: (data, _can, access) =>
      Boolean(
        data &&
        (access?.behavior_actions?.view || access?.behavior_actions?.create),
      ),
    render: ({ data }) => <StudentBehaviorTab student={data.student} />,
  },
  {
    id: "insights",
    label: "ข้อมูลเชิงลึก",
    icon: FiLayers,
    // Family background and guidance records are staff notes, not for
    // guardians.
    visible: (data, _can, access) =>
      Boolean(data?.can_view_mental) && !access?.is_guardian,
    render: ({ data, studentId }) => (
      <StudentInsights
        studentId={studentId}
        assessments={data.assessments?.mental || []}
      />
    ),
  },
  {
    id: "referrals",
    label: "ส่งต่อ",
    icon: FiCornerUpRight,
    visible: (data, can, access) =>
      Boolean(data?.can_view_mental) &&
      can("cases.view") &&
      !access?.is_guardian,
    render: ({ data, reload }) => (
      <StudentReferrals key={data.student.id} data={data} onUpdated={reload} />
    ),
  },
  {
    id: "audit",
    label: "ประวัติการแก้ไข",
    icon: FiClock,
    visible: (data, can) => Boolean(data) && can("audit.view"),
    render: ({ studentId }) => <StudentAuditTab studentId={studentId} />,
  },
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
// and mental health (assessment history). Shown as its own page
// (StudentFilePage, opened from the student and case lists) or as a drawer.
export default function StudentDetailModal({
  studentId,
  onUpdated,
  initialTab = "general",
  onClose,
  nav,
  // { range: { from, to }, label } from the student list's period filter;
  // the mental tab then shows that period only. Omitted: all time.
  period = null,
  // "page": the file's own page (StudentFilePage) instead of a side drawer.
  variant = "drawer",
  onTabChange,
  backLabel,
}) {
  const { can, schoolAccess } = usePermissions();
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestId = useRef(0);
  // Student whose file is on screen. Reloading that same file (after a save
  // inside a tab) refreshes quietly, so the open tab keeps its messages and
  // half-filled forms instead of being replaced by "กำลังโหลด".
  const shownStudent = useRef(null);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    if (shownStudent.current !== studentId) setLoading(true);
    setError("");
    try {
      const basic = await getSchoolStudent(studentId);
      const response = basic.data.can_view_health
        ? await getStudentHealth(studentId)
        : {
            data: {
              student: basic.data,
              can_update: false,
              assessments: { other: [] },
            },
          };
      if (id === requestId.current) {
        shownStudent.current = studentId;
        setData({
          ...response.data,
          can_view_mental:
            basic.data.can_view_mental ?? basic.data.can_view_health,
          can_view_physical:
            basic.data.can_view_physical ?? basic.data.can_view_health,
        });
        if (
          !basic.data.can_view_health ||
          (initialTab === "mental" && basic.data.can_view_mental === false)
        )
          setTab("general");
      }
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
  const tabs = STUDENT_TABS.filter((t) => t.visible(data, can, schoolAccess));
  const current = tabs.find((t) => t.id === tab);
  return (
    <CaseDrawer
      title={student ? studentName(student) : "ข้อมูลนักเรียน"}
      meta={
        student
          ? `รหัส ${student.student_code} · ${classroomLabel(student)}`
          : undefined
      }
      badges={student && <StudentBadges data={data} />}
      record={
        data && <CaseActivity school full activity={data.latest_activity} />
      }
      exportSources={
        data ? [{ resource: "student", id: studentId }] : undefined
      }
      exportTitle="ข้อมูลนักเรียน"
      nav={nav}
      tabs={tabs.map(({ id, label, icon }) => ({ id, label, icon }))}
      activeTab={tab}
      onTabChange={(next) => {
        setTab(next);
        onTabChange?.(next);
      }}
      onClose={onClose}
      variant={variant}
      backLabel={backLabel}
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
      {!loading &&
        data &&
        current?.render({ data, studentId, reload: reloadHealth, period })}
    </CaseDrawer>
  );
}

// Header pills, matching the case drawer: the latest mental-health risk
// (when the viewer may see it) and the student's enrolment status.
function StudentBadges({ data }) {
  const statusLabels = useStudentStatusLabels();
  const { student } = data;
  const latestMental = data.can_view_mental
    ? [...(data.assessments?.mental || [])].sort(
        (a, b) => new Date(b.submitted_at) - new Date(a.submitted_at),
      )[0]
    : null;
  const status =
    student.status_label ||
    statusLabels[student.status] ||
    STUDENT_STATUS_LABELS[student.status] ||
    student.status;
  return (
    <>
      {latestMental?.risk && <RiskBadge risk={latestMental.risk} />}
      {status && <span className="cw-case-state">{status}</span>}
    </>
  );
}

function StudentReferrals({ data, onUpdated }) {
  const assessments = Object.values(data.assessments || {})
    .flat()
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
  const [selectedId, setSelectedId] = useState(assessments[0]?.id || "");
  return (
    <>
      <div className="ref-source-field">
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
              {toDisplayText(item.form_title)} ·{" "}
              {formatThaiDate(item.submitted_at)}
            </option>
          ))}
        </SearchableSelect>
      </div>
      {selectedId ? (
        <CaseReferralPanel
          key={selectedId}
          sourceResponseId={selectedId}
          onUpdated={onUpdated}
        />
      ) : (
        <p className="sch-muted">
          ยังไม่มีแบบประเมินในหน่วยงานนี้สำหรับอ้างอิงการส่งต่อ
        </p>
      )}
    </>
  );
}

// Whole years between a birth date and today; null when unknown.
function ageInYears(birthDate) {
  const born = new Date(birthDate);
  if (!birthDate || Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  )
    years -= 1;
  return years >= 0 ? years : null;
}

// One labelled group of facts, read as label | value rows.
function FactGroup({ title, icon: Icon, facts }) {
  return (
    <section className="sch-section cw-fact-group">
      <h3>
        <Icon aria-hidden="true" />
        {title}
      </h3>
      <dl className="cw-facts">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GeneralTab({ data }) {
  const statusLabels = useStudentStatusLabels();
  const { student, assessments } = data;
  const accountStatus = student.username
    ? student.must_change_password
      ? "ยังไม่ได้เข้าใช้งาน (ใช้รหัสชั่วคราว)"
      : student.account_status === "active"
        ? "ใช้งานแล้ว"
        : "ปิดใช้งาน"
    : "ไม่มีบัญชี";
  const accountTone = !student.username
    ? "closed"
    : student.must_change_password
      ? "waiting"
      : student.account_status === "active"
        ? "active"
        : "closed";
  const age = ageInYears(student.birth_date);
  return (
    <>
      <FactGroup
        title="ข้อมูลส่วนตัว"
        icon={FiUser}
        facts={[
          ["ชื่อ-นามสกุล", studentName(student)],
          ["ชื่อเล่น", student.nickname || "-"],
          ["เพศ", GENDER_LABELS[student.gender] || "-"],
          [
            "วันเกิด",
            student.birth_date
              ? `${formatThaiDate(student.birth_date)}${age !== null ? ` (อายุ ${age} ปี)` : ""}`
              : "-",
          ],
        ]}
      />
      <FactGroup
        title="ข้อมูลการศึกษา"
        icon={FiBookOpen}
        facts={[
          [
            "รหัสนักเรียน",
            <span className="cw-num">{student.student_code}</span>,
          ],
          ["ชั้น/ห้อง", classroomLabel(student)],
          ["ปีการศึกษา", student.academic_year || "-"],
          ["ประเภทนักเรียน", student.student_type_name || "-"],
          [
            "สถานะ",
            student.status_label ||
              statusLabels[student.status] ||
              STUDENT_STATUS_LABELS[student.status] ||
              student.status ||
              "-",
          ],
        ]}
      />
      <FactGroup
        title="บัญชีผู้ใช้"
        icon={FiKey}
        facts={[
          ["ชื่อผู้ใช้", student.username || "-"],
          [
            "สถานะบัญชี",
            <span className={`cw-status cw-status--${accountTone}`}>
              <span className="cw-status-label">{accountStatus}</span>
            </span>,
          ],
        ]}
      />
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
    can_create: canCreate = canUpdate,
    can_delete: canDelete = canUpdate,
  } = data;
  const canManageRecords = canUpdate || canDelete;
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
          <dl className="cw-facts">
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
              <dd className="sch-muted">ดูและแก้ไขได้ที่แท็บข้อมูลทั่วไป</dd>
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
          {canCreate && (
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
              <span className="sch-tile-meta">
                <BmiCategory
                  bmi={latest.bmi}
                  student={data.student}
                  measuredAt={latest.measured_at}
                />
              </span>
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
            ตรวจเมื่อ {formatThaiDate(latest.measured_at)} · {BMI_SOURCE_NOTE}
            {(() => {
              const result = classifyBmi({
                bmi: latest.bmi,
                birthDate: data.student.birth_date,
                gender: data.student.gender,
                measuredAt: latest.measured_at,
              });
              return result.reason && latest.bmi
                ? ` · ประเมินตามเกณฑ์ไม่ได้: ${result.reason}`
                : "";
            })()}
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
            <table className="sch-table admin-data-table">
              <thead>
                <tr>
                  <th>วันที่ตรวจ</th>
                  <th className="sch-num">น้ำหนัก</th>
                  <th className="sch-num">ส่วนสูง</th>
                  <th className="sch-num">BMI</th>
                  <th>เกณฑ์ BMI</th>
                  <th>ความดัน / ชีพจร</th>
                  <th>สายตา (ซ/ข)</th>
                  <th>การได้ยิน (ซ/ข)</th>
                  <th>สมรรถภาพกาย</th>
                  <th>หมายเหตุ</th>
                  {canManageRecords && (
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
                    <td data-label="เกณฑ์ BMI">
                      <BmiCategory
                        bmi={record.bmi}
                        student={data.student}
                        measuredAt={record.measured_at}
                      />
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
                    <td data-label="หมายเหตุ">
                      {toDisplayText(record.note || "-")}
                    </td>
                    {canManageRecords && (
                      <td>
                        <div className="sch-row-actions">
                          <button
                            type="button"
                            className="sch-icon-btn"
                            hidden={!canUpdate}
                            aria-label={`แก้ไขผลตรวจวันที่ ${formatThaiDate(record.measured_at)}`}
                            onClick={() => setRecordForm({ ...record })}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="sch-icon-btn sch-danger"
                            hidden={!canDelete}
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
          student={data.student}
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
        <MasterSelect
          category="blood_type"
          {...field("blood_type")}
          fallback={Object.entries(BLOOD_LABELS).map(([code, label]) => ({
            code,
            label,
          }))}
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

function PhysicalRecordForm({ studentId, student, initial, onClose, onSaved }) {
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
          <output className="sch-output">
            {bmiPreview}{" "}
            {bmiPreview !== "-" && (
              <BmiCategory
                bmi={bmiPreview}
                student={student}
                measuredAt={form.measured_at}
              />
            )}
          </output>
        </div>
        {number("systolic", "ความดันตัวบน")}
        {number("diastolic", "ความดันตัวล่าง")}
        {number("pulse", "ชีพจร (ครั้ง/นาที)")}
        <label className="sch-field sch-full">
          ผลสมรรถภาพกาย
          <textarea
            maxLength={4000}
            value={form.fitness}
            onChange={(event) =>
              setForm({ ...form, fitness: event.target.value })
            }
          />
        </label>
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
            <MasterSelect
              category="hearing"
              fallback={Object.entries(HEARING_LABELS).map(([code, label]) => ({
                code,
                label,
              }))}
              value={form[key]}
              onChange={(event) =>
                setForm({ ...form, [key]: event.target.value })
              }
            />
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

// Assessments inside a { from, to } range of Bangkok dates.
const inRange = (item, range) => {
  const day = bangkokDateKey(new Date(item.submitted_at));
  return (
    (!range.from || day >= range.from) &&
    day <= (range.to || bangkokDateKey(new Date()))
  );
};

function MentalTab({ data, period }) {
  const all = data.assessments.mental;
  // The period chosen on the student list applies until cleared here.
  const [usePeriod, setUsePeriod] = useState(Boolean(period?.range));
  const items = useMemo(
    () =>
      usePeriod && period?.range
        ? all.filter((item) => inRange(item, period.range))
        : all,
    [all, usePeriod, period],
  );
  // Latest result of each form, plus one score chart per chosen form.
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
  // Forms unticked in the checklist; every form is shown by default.
  const [hidden, setHidden] = useState(() => new Set());
  // One line per form in one chart. A form keeps its colour while others
  // are ticked on or off.
  const colorOf = (formId) =>
    SERIES_COLORS[
      byForm.findIndex((g) => String(g.form_id) === String(formId)) %
        SERIES_COLORS.length
    ];
  const charted = byForm
    .filter((group) => !hidden.has(String(group.form_id)))
    .map((group) => ({
      key: String(group.form_id),
      name: toDisplayText(group.title),
      color: colorOf(group.form_id),
      points: group.points
        .map((point) => ({
          t: new Date(point.submitted_at).getTime(),
          score: Number(point.score_results[0]?.score),
        }))
        .filter((point) => Number.isFinite(point.score)),
    }))
    .filter((series) => series.points.length);
  const toggle = (formId) =>
    setHidden((current) => {
      const next = new Set(current);
      const key = String(formId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const banner = period?.range && (
    <div className="sch-period-banner" role="status">
      <span>
        {usePeriod ? period.label : "แสดงผลประเมินทั้งหมด ไม่จำกัดช่วงเวลา"}
      </span>
      <button
        type="button"
        className="sch-btn-ghost"
        onClick={() => setUsePeriod((value) => !value)}
      >
        {usePeriod ? "ดูทั้งหมด" : "ใช้ช่วงเวลาจากหน้ารายชื่อ"}
      </button>
    </div>
  );

  if (!items.length)
    return (
      <>
        {banner}
        <div className="sch-empty-state">
          <strong>
            {all.length
              ? "ไม่มีผลแบบประเมินสุขภาพจิตในช่วงเวลานี้"
              : "ยังไม่มีผลแบบประเมินสุขภาพจิต"}
          </strong>
          <span>
            ผลจะแสดงเมื่อนักเรียนทำแบบประเมินที่ตั้งหมวดสุขภาพเป็น
            &quot;สุขภาพจิต&quot; ด้วยบัญชีของตนเอง
            หรือกรอกเลขบัตรประชาชนและยินยอม PDPA
          </span>
        </div>
      </>
    );

  return (
    <>
      {banner}
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
      <section className="sch-section">
        <h3>กราฟคะแนนแบบประเมิน</h3>
        <p className="sch-muted">
          แบบประเมินละหนึ่งเส้น เลือกเปิดหรือปิดเส้นได้จากรายการด้านล่าง
          คะแนนเต็มของแต่ละแบบอาจไม่เท่ากัน
        </p>
        <fieldset className="sch-form-checklist">
          <legend className="sr-only">เลือกแบบประเมินที่จะแสดงกราฟ</legend>
          {byForm.map((group) => (
            <label key={group.form_id}>
              <input
                type="checkbox"
                checked={!hidden.has(String(group.form_id))}
                onChange={() => toggle(group.form_id)}
              />
              <span
                className="sch-series-swatch"
                style={{ background: colorOf(group.form_id) }}
                aria-hidden="true"
              />
              {toDisplayText(group.title)}
              <span className="sch-sub">{group.points.length} ครั้ง</span>
            </label>
          ))}
        </fieldset>
        {charted.length ? (
          <ChartFrame
            className="sch-chart--multi"
            label={`กราฟคะแนน ${charted.map((c) => c.name).join(", ")}`}
          >
            <ScoreTrendChart series={charted} />
          </ChartFrame>
        ) : (
          <p className="sch-muted">
            เลือกแบบประเมินที่มีคะแนนตัวเลขอย่างน้อยหนึ่งแบบเพื่อดูกราฟ
          </p>
        )}
      </section>
      <section className="sch-section">
        <h3>ประวัติแบบประเมินสุขภาพจิต แยกตามภาคเรียน</h3>
        <p className="sch-muted">
          {usePeriod && period?.range
            ? "เฉพาะช่วงเวลาที่เลือก พร้อมชั้นเรียนในขณะที่ประเมิน"
            : "รวมทุกครั้งตั้งแต่เข้าเรียน พร้อมชั้นเรียนในขณะที่ประเมิน"}
        </p>
        <MentalHistoryByTerm items={items} />
      </section>
    </>
  );
}
