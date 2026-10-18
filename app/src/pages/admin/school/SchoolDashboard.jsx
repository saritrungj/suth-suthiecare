import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FiUsers,
  FiGrid,
  FiBookOpen,
  FiArrowRight,
  FiAlertTriangle,
  FiAlertCircle,
  FiCheck,
  FiMinus,
} from "react-icons/fi";
import api from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import { usePageExport } from "../../../components/ExcelExport";
import FormChartWorkspace from "../../../components/FormChartWorkspace";
import { getCurrentMonthDateRange } from "../../../utils/caseDateFilter";
import { TableScroll, RISK_LABELS } from "./schoolUi";
import ActiveOrganizationScope from "../../../components/OrganizationScope";
import {
  DashboardHero,
  DateRangePills,
  DzSection,
  KpiTile,
  describeRange,
  formatCount,
} from "../../../components/dashboard/DashboardKit";
import "./school.css";
import "./schoolDashboard.css";

const RISK_TILES = {
  high: { icon: FiAlertTriangle, tone: "danger", urgent: true },
  medium: { icon: FiAlertCircle, tone: "warning", urgent: true },
  normal: { icon: FiCheck, tone: "success" },
  none: { icon: FiMinus, tone: "neutral" },
};

const CLEAR_TEXT = {
  high: "ไม่มีนักเรียนเสี่ยงสูง",
  medium: "ไม่มีนักเรียนที่ต้องเฝ้าระวัง",
};

// Latest mental-health screening per student, counted by risk level. Counts
// only: names stay on the risk pages.
function useRiskSummary(range, enabled) {
  const { activeOrganization } = usePermissions();
  const [state, setState] = useState({ rows: null, error: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    setState({ rows: null, error: "" });
    api
      .get("/school/risk-summary", {
        params: {
          ...(range.startDate ? { start_date: range.startDate } : {}),
          ...(range.endDate ? { end_date: range.endDate } : {}),
        },
      })
      .then(
        ({ data }) => alive && setState({ rows: data.data || [], error: "" }),
      )
      .catch(
        (e) =>
          alive &&
          setState({
            rows: null,
            error: e.response?.data?.message || "โหลดภาพรวมความเสี่ยงไม่สำเร็จ",
          }),
      );
    return () => {
      alive = false;
    };
  }, [range.startDate, range.endDate, activeOrganization, retry, enabled]);
  const counts = (state.rows || []).reduce((acc, row) => {
    const key = row.risk_status in RISK_LABELS ? row.risk_status : "none";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    counts,
    total: state.rows?.length || 0,
    loading: enabled && !state.rows && !state.error,
    error: state.error,
    retry: () => setRetry((n) => n + 1),
  };
}

export default function SchoolDashboard() {
  const { schoolAccess, activeOrganization, can } = usePermissions();
  const navigate = useNavigate();
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [range, setRange] = useState(getCurrentMonthDateRange);
  const canViewRisk = schoolAccess?.can_view_risk !== false;
  const canOpenCases = Boolean(schoolAccess?.can_view_health);
  const risk = useRiskSummary(range, canViewRisk);
  usePageExport({
    title: "ภาพรวมโรงเรียน",
    sources: [{ resource: "schools" }, { resource: "students" }],
  });
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    Promise.all([
      api.get("/school/schools"),
      // Active students, as counted by the risk summary above.
      api.get("/school/students", { params: { limit: 1, status: "active" } }),
    ])
      .then(([schools, students]) => {
        if (alive) setData({ schools: schools.data, students: students.data });
      })
      .catch((e) => {
        if (alive) setError(e.response?.data?.message || "โหลดภาพรวมไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [activeOrganization, retry]);
  const total = (key) =>
    data?.schools.reduce((n, s) => n + Number(s[key] || 0), 0) || 0;

  const high = risk.counts.high || 0;
  const medium = risk.counts.medium || 0;
  const screened = risk.total - (risk.counts.none || 0);
  const note =
    !canViewRisk || risk.loading || risk.error
      ? null
      : high > 0
        ? "มีนักเรียนเสี่ยงสูง " +
          formatCount(high) +
          " คน ที่ควรได้รับการดูแลก่อนนะ"
        : medium > 0
          ? "ไม่มีนักเรียนเสี่ยงสูง มี " +
            formatCount(medium) +
            " คนที่ควรเฝ้าระวัง"
          : null;
  const tone = high > 0 ? "alert" : medium > 0 ? "warn" : "clear";

  return (
    <div className="sch-wrapper dz-surface">
      <main className="dz-page school-dashboard">
        <DashboardHero
          title="ภาพรวมโรงเรียน"
          scope={<ActiveOrganizationScope />}
          note={note}
          tone={tone}
        />

        <div className="dz-toolbar">
          <DateRangePills value={range} onChange={setRange} />
        </div>

        {canViewRisk && (
          <DzSection
            className="dz-section--bare school-risk"
            aria-labelledby="school-risk-title"
            title={
              <span id="school-risk-title">ความเสี่ยงสุขภาพจิตของนักเรียน</span>
            }
            description={
              "ผลคัดกรองล่าสุดของนักเรียนแต่ละคน " +
              describeRange(range) +
              (risk.loading || risk.error
                ? ""
                : " · คัดกรองแล้ว " +
                  formatCount(screened) +
                  " จาก " +
                  formatCount(risk.total) +
                  " คน")
            }
            aside={
              canOpenCases && (
                <Link
                  className="dz-link school-risk-open"
                  to="/admin/risk-cases"
                >
                  เปิดหน้าเคสเสี่ยง <FiArrowRight aria-hidden="true" />
                </Link>
              )
            }
          >
            {risk.error ? (
              <div className="dz-error" role="alert">
                {risk.error}
                <button type="button" onClick={risk.retry}>
                  ลองอีกครั้ง
                </button>
              </div>
            ) : (
              <div
                className="dz-kpis school-risk-ledger"
                aria-busy={risk.loading || undefined}
              >
                {Object.entries(RISK_LABELS).map(([key, label]) => {
                  const tile = RISK_TILES[key];
                  return (
                    <KpiTile
                      key={key}
                      icon={tile.icon}
                      tone={tile.tone}
                      urgent={tile.urgent}
                      label={label}
                      value={risk.counts[key] || 0}
                      unit="คน"
                      clearText={CLEAR_TEXT[key]}
                      isLoading={risk.loading}
                      onClick={
                        canOpenCases && tile.urgent
                          ? () => navigate("/admin/risk-cases")
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </DzSection>
        )}

        {error && (
          <div className="dz-error" role="alert">
            {error}
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              ลองอีกครั้ง
            </button>
          </div>
        )}

        {!error && (
          <DzSection
            className="dz-section--bare"
            title="ข้อมูลโรงเรียน"
            description="นักเรียน ห้องเรียน และครูในขอบเขตที่คุณรับผิดชอบ"
            aside={
              <nav
                className="school-dashboard-links"
                aria-label="งานในโรงเรียน"
              >
                <Link className="dz-link" to="/admin/school/students">
                  รายชื่อนักเรียน <FiArrowRight aria-hidden="true" />
                </Link>
                {canOpenCases && (
                  <Link className="dz-link" to="/admin/cases">
                    ผลประเมินและประวัติการดูแล{" "}
                    <FiArrowRight aria-hidden="true" />
                  </Link>
                )}
              </nav>
            }
          >
            <div
              className="dz-kpis school-overview"
              aria-label="สรุปข้อมูลโรงเรียน"
              aria-busy={!data || undefined}
            >
              <KpiTile
                icon={FiUsers}
                tone="teal"
                label="นักเรียนที่กำลังศึกษา"
                value={data?.students.pagination?.total}
                unit="คน"
                isLoading={!data}
              />
              <KpiTile
                icon={FiGrid}
                tone="brand"
                label="ห้องเรียน"
                value={total("classroom_count")}
                unit="ห้อง"
                isLoading={!data}
              />
              <KpiTile
                icon={FiBookOpen}
                tone="info"
                label="ครู"
                value={total("teacher_count")}
                unit="คน"
                isLoading={!data}
              />
            </div>
          </DzSection>
        )}

        {can("dashboard.view") && (
          <FormChartWorkspace
            key={activeOrganization}
            startDate={range.startDate}
            endDate={range.endDate}
          />
        )}

        {data && (
          <DzSection
            className="school-directory"
            title={
              <>
                โรงเรียนในความรับผิดชอบ{" "}
                <span className="school-directory__count">
                  {data.schools.length} แห่ง
                </span>
              </>
            }
          >
            <TableScroll label="ข้อมูลโรงเรียน">
              <table className="sch-table admin-data-table">
                <thead>
                  <tr>
                    <th>โรงเรียน</th>
                    <th className="is-num">นักเรียน</th>
                    <th className="is-num">ห้องเรียน</th>
                    <th className="is-num">ครู</th>
                  </tr>
                </thead>
                <tbody>
                  {data.schools.map((s) => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td className="is-num">{formatCount(s.student_count)}</td>
                      <td className="is-num">
                        {formatCount(s.classroom_count)}
                      </td>
                      <td className="is-num">{formatCount(s.teacher_count)}</td>
                    </tr>
                  ))}
                  {!data.schools.length && (
                    <tr>
                      <td colSpan={4}>ยังไม่มีโรงเรียนในขอบเขตสิทธิ์</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableScroll>
          </DzSection>
        )}
      </main>
    </div>
  );
}
