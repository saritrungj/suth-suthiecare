import SearchableSelect from "../../../components/SearchableSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { usePageExport } from "../../../components/ExcelExport";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiActivity } from "react-icons/fi";
import api from "../../../services/api";
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
  useSchools,
  BarSelect,
  FilterDropdown,
  MenuSelect,
  SearchField,
  useMediaQuery,
  ThaiDateField,
} from "./schoolUi";
import CasePerson from "../../../components/case/CasePerson";
import { useOpenStudentFile, useSessionState } from "./studentFileLink";
import { RiskPill } from "../../../components/case/CaseDrawer";
import "./school.css";
import { DEFAULT_PAGE_SIZE } from "../../../components/table/TablePagination";
import DataPanel from "../../../components/table/DataPanel";
import ResultSummary from "../../../components/table/ResultSummary";
import { isoToThai } from "../../../utils/thaiDate";

const RISK_LEVEL = {
  high: "high",
  medium: "medium",
  normal: "low",
  none: "none",
};

// BMI with one decimal throughout (24.1, 20.0), or "-" when not measured.
function SchoolRisk({ risk }) {
  if (!risk) return <span className="cw-sub">ยังไม่มีผล</span>;
  return (
    <RiskPill
      level={RISK_LEVEL[risk] || "none"}
      label={RISK_LABELS[risk] || risk}
    />
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
  const [rounds, setRounds] = useState([]),
    [roundId, setRoundId] = useSessionState(
      `sch-cases${initialRisk}:round`,
      "",
    );
  // Kept while a student file is open on its own page, so "กลับ" lands on
  // the same filters and page.
  const [filters, setFilters] = useSessionState(
    `sch-cases${initialRisk}:filters`,
    {
      grade_id: "",
      classroom_id: "",
      domain: "",
      form_id: "",
      risk: initialRisk,
      search: "",
      start_date: "",
      end_date: "",
    },
  );
  usePageExport({
    title: "ผลประเมินนักเรียน",
    sources: [
      {
        resource: "school_cases",
        filters: { ...filters, school_id: schoolId },
      },
    ],
  });
  const [page, setPage] = useSessionState(`sch-cases${initialRisk}:page`, 1);
  const [limit, setLimit] = useSessionState(
    `sch-cases${initialRisk}:limit`,
    DEFAULT_PAGE_SIZE,
  );
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const openFile = useOpenStudentFile();
  const requestId = useRef(0);
  useEffect(() => {
    api
      .get("/school/screening-rounds")
      .then(({ data }) => setRounds(Array.isArray(data) ? data : []))
      .catch(() => setRounds([]));
  }, [schoolId]);

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
  // The file opens on its own page on the mental tab; previous/next there
  // follow this page of the list.
  const view = (id) =>
    openFile(id, { ids: rows.map((row) => row.id), tab: "mental" });
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
          description="ติดตามเคสและเปิดแฟ้มสุขภาพนักเรียน"
        />

        <DataPanel className="cw-surface" aria-label="รายการนักเรียน">
          {isPhone ? (
            <label className="cw-field cw-school-risk-filter">
              <span>ความเสี่ยง</span>
              <SearchableSelect
                aria-label="ความเสี่ยง"
                value={filters.risk}
                onChange={(event) => update("risk", event.target.value)}
              >
                <option value="">ทั้งหมด ({total})</option>
                {["high", "medium", "normal", "none"].map((risk) => (
                  <option key={risk} value={risk}>
                    {RISK_LABELS[risk]} ({counts[risk] || 0})
                  </option>
                ))}
              </SearchableSelect>
            </label>
          ) : (
            <ul className="cw-strip" aria-label="กรองตามระดับความเสี่ยง">
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
          )}

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
                  roundId,
                  filters.start_date,
                  filters.end_date,
                  filters.domain,
                  filters.form_id,
                  ...(isPhone ? [filters.grade_id, filters.classroom_id] : []),
                ].filter(Boolean).length
              }
              onClear={() => {
                setRoundId("");
                setPage(1);
                setFilters((old) => ({
                  ...old,
                  start_date: "",
                  end_date: "",
                  domain: "",
                  form_id: "",
                }));
              }}
            >
              {isPhone && classFilters}
              <MenuSelect
                label="รอบประเมิน"
                value={roundId}
                onChange={(value) => {
                  setRoundId(value);
                  const r = rounds.find((r) => String(r.id) === value);
                  setFilters((old) => ({
                    ...old,
                    start_date: r?.starts_on || "",
                    end_date: r?.ends_on || "",
                    form_id: r ? String(r.form_id) : "",
                    domain: r?.health_domain || "",
                  }));
                  setPage(1);
                }}
              >
                <option value="">ทุกช่วงเวลา</option>
                {rounds
                  .filter((r) => String(r.school_id) === String(schoolId))
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} · {r.semester}/{r.academic_year}
                    </option>
                  ))}
              </MenuSelect>
              <ThaiDateField
                label="ประเมินตั้งแต่"
                allowFuture
                value={filters.start_date}
                onChange={(value) => {
                  setRoundId("");
                  update("start_date", value);
                }}
              />
              <ThaiDateField
                label="ประเมินถึง"
                allowFuture
                value={filters.end_date}
                onChange={(value) => {
                  setRoundId("");
                  update("end_date", value);
                }}
              />
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
                    {toDisplayText(String(form.title || ""))}
                  </option>
                ))}
              </MenuSelect>
            </FilterDropdown>
          </div>

          <ResultSummary
            loading={loading && !result}
            pagination={result?.pagination}
            chips={[
              {
                key: "grade",
                label: "ชั้นปี",
                value: grades.find(
                  (g) => String(g.id) === String(filters.grade_id),
                )?.name,
                onRemove: () => update("grade_id", ""),
              },
              {
                key: "room",
                label: "ห้อง",
                value: (() => {
                  const room = classrooms.find(
                    (c) => String(c.id) === String(filters.classroom_id),
                  );
                  return room ? `ห้อง ${room.name}` : "";
                })(),
                onRemove: () => update("classroom_id", ""),
              },
              {
                key: "round",
                label: "รอบประเมิน",
                value: rounds.find((r) => String(r.id) === String(roundId))
                  ?.name,
                onRemove: () => {
                  setRoundId("");
                  setPage(1);
                  setFilters((old) => ({
                    ...old,
                    start_date: "",
                    end_date: "",
                    form_id: "",
                    domain: "",
                  }));
                },
              },
              {
                key: "from",
                label: "ตั้งแต่",
                value: roundId ? "" : isoToThai(filters.start_date),
                onRemove: () => update("start_date", ""),
              },
              {
                key: "to",
                label: "ถึง",
                value: roundId ? "" : isoToThai(filters.end_date),
                onRemove: () => update("end_date", ""),
              },
              {
                key: "domain",
                label: "หมวดสุขภาพ",
                value:
                  filters.domain === "mental"
                    ? "สุขภาพจิต"
                    : filters.domain === "physical"
                      ? "สุขภาพกาย"
                      : "",
                onRemove: () => update("domain", ""),
              },
              {
                key: "form",
                label: "แบบประเมิน",
                value: filters.form_id
                  ? toDisplayText(
                      String(
                        visibleForms.find(
                          (f) => String(f.id) === String(filters.form_id),
                        )?.title || filters.form_id,
                      ),
                    )
                  : "",
                onRemove: () => update("form_id", ""),
              },
            ]}
            onClearAll={() => {
              setRoundId("");
              setPage(1);
              setFilters((old) => ({
                ...old,
                grade_id: "",
                classroom_id: "",
                start_date: "",
                end_date: "",
                domain: "",
                form_id: "",
              }));
            }}
          />

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
                <li key={row.id} className="cw-card">
                  <div className="cw-card-top">
                    <CasePerson
                      school
                      id={row.id}
                      name={[row.prefix, row.first_name]
                        .filter(Boolean)
                        .join(" ")}
                      lastName={row.last_name}
                      code={`รหัส ${row.student_code}`}
                      onOpen={() => view(row.id)}
                    />
                    {row.overall_risk !== "none" && (
                      <SchoolRisk risk={row.overall_risk} />
                    )}
                  </div>
                  <div className="cw-card-summary">
                    <span>{classroomLabel(row)}</span>
                    <span className="cw-card-date">
                      {row.latest_activity?.occurred_at
                        ? formatThaiDate(row.latest_activity.occurred_at)
                        : "ยังไม่มีข้อมูล"}
                    </span>
                  </div>
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
              <table className="cw-queue cw-queue--compact">
                <thead>
                  <tr>
                    <th className="cw-col-person">นักเรียน</th>
                    <th>ภาพรวม</th>
                    <th>ชั้น / ห้อง</th>
                    <th className="cw-col-date">อัปเดตล่าสุด</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="cw-col-person">
                        <CasePerson
                          school
                          id={row.id}
                          name={[row.prefix, row.first_name]
                            .filter(Boolean)
                            .join(" ")}
                          lastName={row.last_name}
                          code={`รหัส ${row.student_code}`}
                          onOpen={() => view(row.id)}
                        />
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
                      <td>{classroomLabel(row)}</td>
                      <td className="cw-col-date">
                        {row.latest_activity?.occurred_at
                          ? formatThaiDate(row.latest_activity.occurred_at)
                          : "ยังไม่มีข้อมูล"}
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
        </DataPanel>

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
                          <dt>{toDisplayText(label)}</dt>
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
      </main>
    </div>
  );
}
