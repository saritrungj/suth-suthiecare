import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity } from "react-icons/fi";
import {
  getForms,
  getSchoolCases,
  getSchoolClassrooms,
  getSchoolGrades,
} from "../../../services/api";
import {
  PageHeader,
  Pagination,
  RISK_LABELS,
  classroomLabel,
  formatThaiDate,
  studentName,
  useSchools,
  BarSelect,
  FilterDropdown,
  MenuSelect,
  SearchField,
  useMediaQuery,
} from "./schoolUi";
import StudentDetailModal from "./StudentDetailModal";
import { RiskPill } from "../../../components/case/CaseDrawer";
import "./school.css";

const RISK_LEVEL = {
  high: "high",
  medium: "medium",
  normal: "low",
  none: "none",
};

// BMI with one decimal throughout (24.1, 20.0), or "-" when not measured.
const formatBmi = (value) =>
  value === null || value === undefined || value === ""
    ? "-"
    : Number(value).toFixed(1);

function SchoolRisk({ risk }) {
  if (!risk) return <span className="cw-sub">ยังไม่มีผล</span>;
  return (
    <RiskPill
      level={RISK_LEVEL[risk] || "none"}
      label={RISK_LABELS[risk] || risk}
    />
  );
}

function LatestResult({ result }) {
  if (!result) return <span className="cw-sub">ยังไม่มีผล</span>;
  return (
    <>
      <SchoolRisk risk={result.risk} />
      <span className="cw-sub">
        {result.label || result.form_title} ·{" "}
        {formatThaiDate(result.submitted_at)}
      </span>
    </>
  );
}

function EmptyCases() {
  return (
    <div className="cw-empty" role="status">
      <FiActivity aria-hidden="true" />
      <strong>ไม่พบนักเรียนตามเงื่อนไข</strong>
      <p>
        ผลแบบประเมินจะแสดงเมื่อแบบประเมินตั้งหมวดสุขภาพไว้
        (ตั้งได้ในหน้าตั้งค่าการเผยแพร่ของฟอร์ม)
      </p>
    </div>
  );
}

// Case list of a school organization: one row per student with the latest
// mental and physical assessment, ordered by risk. Replaces the hospital
// case list (forms → responses) when a school organization is active.
export default function SchoolCaseData({ initialRisk = "" }) {
  const { schoolId } = useSchools();
  const [grades, setGrades] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [forms, setForms] = useState([]);
  const [filters, setFilters] = useState({
    grade_id: "",
    classroom_id: "",
    domain: "",
    form_id: "",
    risk: initialRisk,
    search: "",
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    getForms("latest")
      .then(({ data }) =>
        setForms(
          (Array.isArray(data) ? data : []).filter((form) =>
            ["mental", "physical"].includes(form.health_domain),
          ),
        ),
      )
      .catch(() => setForms([]));
  }, []);

  useEffect(() => {
    if (!schoolId) {
      setGrades([]);
      setClassrooms([]);
      return;
    }
    Promise.all([getSchoolGrades(schoolId), getSchoolClassrooms(schoolId)])
      .then(([gradeRes, roomRes]) => {
        setGrades(gradeRes.data || []);
        setClassrooms(roomRes.data || []);
      })
      .catch(() => {
        setGrades([]);
        setClassrooms([]);
      });
  }, [schoolId]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await getSchoolCases({
        school_id: schoolId || undefined,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== ""),
        ),
        page,
        limit,
      });
      if (id === requestId.current) setResult(data);
    } catch (err) {
      if (id === requestId.current)
        setError(err.response?.data?.message || "ไม่สามารถโหลดข้อมูลเคสได้");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [schoolId, filters, page, limit]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const update = (key, value) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "grade_id" ? { classroom_id: "" } : {}),
      ...(key === "domain" ? { form_id: "" } : {}),
    }));
  };

  // A phone gets one card per student instead of a sideways-scrolling table.
  const isPhone = useMediaQuery("(max-width: 760px)");
  const counts = result?.counts || { high: 0, medium: 0, normal: 0, none: 0 };
  const total = Object.values(counts).reduce(
    (sum, n) => sum + Number(n || 0),
    0,
  );
  const rows = result?.data || [];
  // Previous/next inside the student file follow this page of the list.
  const viewingIndex = rows.findIndex((row) => row.id === viewing);
  const studentNav =
    viewingIndex === -1
      ? undefined
      : {
          position: viewingIndex + 1,
          total: rows.length,
          onPrev:
            viewingIndex > 0
              ? () => setViewing(rows[viewingIndex - 1].id)
              : undefined,
          onNext:
            viewingIndex < rows.length - 1
              ? () => setViewing(rows[viewingIndex + 1].id)
              : undefined,
        };
  const visibleForms = forms.filter(
    (form) => !filters.domain || form.health_domain === filters.domain,
  );

  // Grade and room: in the filter row on a computer, inside the filter menu
  // on a phone so the list starts in the first screen.
  const classFilters = (
    <>
      <BarSelect
        label="ชั้นปี"
        value={filters.grade_id}
        disabled={!schoolId}
        onChange={(value) => update("grade_id", value)}
      >
        <option value="">ทุกชั้นปี</option>
        {grades.map((grade) => (
          <option key={grade.id} value={grade.id}>
            {grade.name}
          </option>
        ))}
      </BarSelect>
      <BarSelect
        label="ห้อง"
        value={filters.classroom_id}
        disabled={!schoolId}
        onChange={(value) => update("classroom_id", value)}
      >
        <option value="">ทุกห้อง</option>
        {classrooms
          .filter(
            (room) =>
              !filters.grade_id ||
              String(room.grade_level_id) === filters.grade_id,
          )
          .map((room) => (
            <option key={room.id} value={room.id}>
              {room.grade_name} ห้อง {room.name} ({room.academic_year})
            </option>
          ))}
      </BarSelect>
    </>
  );

  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title={
            filters.risk === "high"
              ? "นักเรียนกลุ่มเสี่ยง"
              : "ข้อมูลสุขภาพนักเรียน"
          }
          description="สรุปผลแบบประเมินสุขภาพจิตและสุขภาพกายล่าสุดของนักเรียนแต่ละคน คลิกที่ชื่อเพื่อเปิดแฟ้มสุขภาพของนักเรียน"
        />

        <section className="cw-surface" aria-label="รายการนักเรียน">
          <ul
            className={`cw-strip ${isPhone ? "sch-risk-summary" : ""}`}
            aria-label="กรองตามระดับความเสี่ยง"
          >
            <li>
              <button
                type="button"
                className="cw-chip"
                aria-pressed={filters.risk === ""}
                onClick={() => update("risk", "")}
              >
                ทั้งหมด <strong>{total}</strong>
              </button>
            </li>
            {["high", "medium", "normal", "none"].map((risk) => (
              <li key={risk}>
                <button
                  type="button"
                  className={`cw-chip cw-chip--${RISK_LEVEL[risk]}`}
                  aria-pressed={filters.risk === risk}
                  onClick={() =>
                    update("risk", filters.risk === risk ? "" : risk)
                  }
                >
                  <span className="cw-dot" aria-hidden="true" />
                  {RISK_LABELS[risk]}
                  <strong>{counts[risk]}</strong>
                </button>
              </li>
            ))}
          </ul>

          <div className="sch-filter-bar">
            <SearchField
              label="ค้นหานักเรียน"
              placeholder="ค้นหาชื่อ ชื่อเล่น หรือรหัสนักเรียน"
              value={filters.search}
              onChange={(value) => update("search", value)}
            />
            {!isPhone && classFilters}
            <FilterDropdown
              label={isPhone ? "ตัวกรอง" : undefined}
              activeCount={
                [
                  filters.domain,
                  filters.form_id,
                  ...(isPhone ? [filters.grade_id, filters.classroom_id] : []),
                ].filter(Boolean).length
              }
            >
              {isPhone && classFilters}
              <MenuSelect
                label="หมวดสุขภาพ"
                value={filters.domain}
                onChange={(value) => update("domain", value)}
              >
                <option value="">จิตและกาย</option>
                <option value="mental">สุขภาพจิต</option>
                <option value="physical">สุขภาพกาย</option>
              </MenuSelect>
              <MenuSelect
                label="แบบประเมิน"
                value={filters.form_id}
                onChange={(value) => update("form_id", value)}
              >
                <option value="">ทุกแบบประเมิน</option>
                {visibleForms.map((form) => (
                  <option key={form.id} value={form.id}>
                    {String(form.title || "").replace(/<[^>]+>/g, "")}
                  </option>
                ))}
              </MenuSelect>
            </FilterDropdown>
          </div>

          {error && (
            <p className="sch-error" role="alert">
              {error}
            </p>
          )}

          {loading && !result ? (
            <div
              className="cw-skeleton"
              role="status"
              aria-label="กำลังโหลดข้อมูล"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          ) : !rows.length ? (
            <EmptyCases />
          ) : isPhone ? (
            <ul className="cw-cards">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={`cw-card ${viewing === row.id ? "is-open" : ""}`}
                >
                  <div className="cw-card-top">
                    <button
                      type="button"
                      className="cw-name-btn"
                      aria-haspopup="dialog"
                      onClick={() => setViewing(row.id)}
                    >
                      {studentName(row)}
                    </button>
                    {row.overall_risk !== "none" && (
                      <SchoolRisk risk={row.overall_risk} />
                    )}
                  </div>
                  <div className="cw-card-meta">
                    <span>{classroomLabel(row)}</span>
                    <span>รหัส {row.student_code}</span>
                    {row.nickname && <span>{row.nickname}</span>}
                  </div>
                  <dl className="cw-card-facts">
                    <div>
                      <dt>สุขภาพจิต</dt>
                      <dd>
                        <SchoolRisk risk={row.mental?.risk} />
                      </dd>
                    </div>
                    <div>
                      <dt>สุขภาพกาย</dt>
                      <dd>
                        <SchoolRisk risk={row.physical?.risk} />
                      </dd>
                    </div>
                    <div>
                      <dt>BMI</dt>
                      <dd className="cw-num">
                        {formatBmi(row.latest_vitals?.bmi)}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <div
              className="cw-scroll"
              tabIndex={0}
              role="region"
              aria-label="ตารางข้อมูลสุขภาพนักเรียน"
            >
              <table className="cw-queue">
                <thead>
                  <tr>
                    <th className="cw-col-person">นักเรียน</th>
                    <th>ภาพรวม</th>
                    <th>สุขภาพจิตล่าสุด</th>
                    <th>สุขภาพกายล่าสุด</th>
                    <th className="cw-col-date">BMI ล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={viewing === row.id ? "is-open" : ""}
                    >
                      <td className="cw-col-person">
                        <button
                          type="button"
                          className="cw-name-btn"
                          aria-haspopup="dialog"
                          onClick={() => setViewing(row.id)}
                        >
                          {studentName(row)}
                        </button>
                        <span className="cw-sub">
                          {classroomLabel(row)} · รหัส {row.student_code}
                          {row.nickname ? ` · ${row.nickname}` : ""}
                        </span>
                      </td>
                      <td>
                        <SchoolRisk
                          risk={
                            row.overall_risk === "none"
                              ? null
                              : row.overall_risk
                          }
                        />
                      </td>
                      <td>
                        <LatestResult result={row.mental} />
                      </td>
                      <td>
                        <LatestResult result={row.physical} />
                      </td>
                      <td className="cw-col-date">
                        {formatBmi(row.latest_vitals?.bmi)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination
            pagination={result?.pagination}
            onPage={setPage}
            onLimit={(value) => {
              setLimit(value);
              setPage(1);
            }}
          />
        </section>

        {result?.classrooms?.length > 1 && (
          <section
            className="cw-surface cw-surface--gap"
            aria-labelledby="by-classroom-title"
          >
            <h2 id="by-classroom-title" className="cw-section-title">
              สรุปตามห้องเรียน
            </h2>
            {isPhone ? (
              <ul className="sch-classroom-summary">
                {result.classrooms.map((room) => (
                  <li key={room.classroom_id || 0}>
                    <h3>{room.name}</h3>
                    <dl>
                      {[
                        ["high", "เสี่ยงสูง"],
                        ["medium", "เฝ้าระวัง"],
                        ["normal", "ปกติ"],
                        ["none", "ยังไม่มีผล"],
                      ].map(([risk, label]) => (
                        <div key={risk}>
                          <dt>{label}</dt>
                          <dd>{room[risk]}</dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                ))}
              </ul>
            ) : (
              <div
                className="cw-scroll"
                tabIndex={0}
                role="region"
                aria-label="ตารางสรุปตามห้องเรียน"
              >
                <table className="cw-queue">
                  <thead>
                    <tr>
                      <th>ห้อง</th>
                      <th className="cw-col-date">เสี่ยงสูง</th>
                      <th className="cw-col-date">เฝ้าระวัง</th>
                      <th className="cw-col-date">ปกติ</th>
                      <th className="cw-col-date">ยังไม่มีผล</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.classrooms.map((room) => (
                      <tr key={room.classroom_id || 0}>
                        <td>{room.name}</td>
                        <td className="cw-col-date">{room.high}</td>
                        <td className="cw-col-date">{room.medium}</td>
                        <td className="cw-col-date">{room.normal}</td>
                        <td className="cw-col-date">{room.none}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {viewing && (
          <StudentDetailModal
            studentId={viewing}
            initialTab="mental"
            nav={studentNav}
            onClose={() => setViewing(null)}
          />
        )}
      </main>
    </div>
  );
}
