import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  FiAlertTriangle,
  FiArrowDownRight,
  FiArrowRight,
  FiArrowUpRight,
  FiBarChart2,
  FiCalendar,
  FiClipboard,
  FiDownload,
  FiHeart,
  FiList,
  FiMessageCircle,
  FiRepeat,
  FiShare2,
} from "react-icons/fi";
import { exportSchoolReport, getSchoolReport } from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  DateRangePills,
  DzSection,
  PageHero,
  describeRange,
  formatCount,
} from "../../../components/dashboard/DashboardKit";
import { RiskPill } from "../../../components/case/CaseDrawer";
import { saveBlobResponse } from "../../../utils/saveBlob";
import { BarSelect, TableScroll, useSchools } from "./schoolUi";
import "./school.css";
import "./schoolReports.css";

// Risk levels are states: the app's status colours, never reused for anything
// else. "Not assessed" is a neutral grey. Identity never rests on colour
// alone: every chart has a legend, direct labels and a table view.
const LEVELS = [
  {
    key: "high",
    pill: "high",
    label: "เสี่ยงสูง",
    color: "var(--suth-risk-dot-high, #d92d20)",
  },
  {
    key: "medium",
    pill: "medium",
    label: "เฝ้าระวัง",
    color: "var(--suth-risk-dot-medium, #f79009)",
  },
  {
    key: "normal",
    pill: "low",
    label: "ปกติ",
    color: "var(--suth-risk-dot-low, #12b76a)",
  },
];
const NOT_ASSESSED = {
  key: "not_assessed",
  pill: "none",
  label: "ยังไม่ได้ประเมิน",
  color: "var(--rp-none)",
};
const ALL_LEVELS = [...LEVELS, NOT_ASSESSED];
const HIDDEN = "น้อยกว่า 5";
const hidden = (value) => value === null || value === undefined;
const show = (value) => (hidden(value) ? HIDDEN : formatCount(value));
const percent = (value, total) =>
  hidden(value) || !total ? null : Math.round((value / total) * 100);

// Axis label on up to two lines, broken at spaces: round names often differ
// only at the end ("… (เปิดรับ)" / "… (สิ้นสุด)"). The tooltip and the table
// always carry the full name.
function splitLabel(text, max = 18) {
  const words = String(text).split(" ");
  const lines = [""];
  for (const word of words) {
    const line = lines.at(-1);
    if (line && (line + " " + word).length > max) lines.push(word);
    else lines[lines.length - 1] = line ? `${line} ${word}` : word;
  }
  if (lines.length > 2)
    lines.splice(1, lines.length - 1, lines.slice(1).join(" "));
  return lines.map((l) => (l.length > max + 2 ? `${l.slice(0, max)}…` : l));
}
function WrappedTick({ x, y, payload }) {
  return (
    <text
      x={x}
      y={y + 14}
      textAnchor="middle"
      fill="var(--suth-muted)"
      fontSize={12}
    >
      {splitLabel(payload?.value).map((line, i) => (
        <tspan key={i} x={x} dy={i ? 15 : 0}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

// A thin 100% bar of the parts of a whole, with a 2px gap between parts.
// Purely visual: the numbers beside it say the same in text.
function SplitBar({ parts }) {
  const total = parts.reduce((sum, p) => sum + (p.value || 0), 0);
  if (!total) return <div className="rp-split is-empty" aria-hidden="true" />;
  return (
    <div className="rp-split" aria-hidden="true">
      {parts
        .filter((p) => p.value)
        .map((p) => (
          <span
            key={p.key}
            style={{ flexGrow: p.value, background: p.color }}
          />
        ))}
    </div>
  );
}

// Change against the previous round. The colour follows meaning, not
// direction: fewer high-risk students is good news, fewer normal is not.
function Delta({ now, before, goodWhenDown = false }) {
  if (hidden(now) || hidden(before)) return null;
  const diff = now - before;
  if (!diff) return <span className="rp-delta is-flat">เท่าเดิม</span>;
  const good = goodWhenDown ? diff < 0 : diff > 0;
  const Icon = diff < 0 ? FiArrowDownRight : FiArrowUpRight;
  return (
    <span className={`rp-delta ${good ? "is-good" : "is-bad"}`}>
      <Icon aria-hidden="true" />
      {diff < 0 ? "ลดลง" : "เพิ่มขึ้น"} {formatCount(Math.abs(diff))} คน
    </span>
  );
}

function LatestRound({ report }) {
  const latest = report.trend.at(-1);
  if (!latest) return null;
  const before = report.trend.length > 1 ? report.trend.at(-2) : null;
  const total =
    hidden(latest.assessed) || hidden(latest.not_assessed)
      ? report.population
      : latest.assessed + latest.not_assessed;
  const coverage = percent(latest.assessed, total);
  return (
    <DzSection
      className="rp-section"
      aria-labelledby="rp-latest-title"
      title={
        <span id="rp-latest-title">
          {report.trend_basis === "rounds" ? "ผลรอบล่าสุด" : "ผลเดือนล่าสุด"}
        </span>
      }
      description={
        before
          ? `${latest.label} · เทียบกับ${report.trend_basis === "rounds" ? "รอบ" : "เดือน"}ก่อนหน้า (${before.label})`
          : latest.label
      }
    >
      <dl className="rp-strip">
        {ALL_LEVELS.map((level) => {
          const value = latest[level.key];
          const share = percent(value, total);
          return (
            <div key={level.key} className="rp-stat">
              <dt>
                <RiskPill level={level.pill} label={level.label} />
              </dt>
              <dd>
                <span
                  className={`rp-stat__value${hidden(value) ? " is-hidden" : ""}`}
                >
                  {show(value)}
                  {!hidden(value) && <small> คน</small>}
                </span>
                <span className="rp-stat__meta">
                  {share === null
                    ? "ซ่อนเพื่อความเป็นส่วนตัว"
                    : `${share}% ของนักเรียน`}
                </span>
                {before && (
                  <Delta
                    now={value}
                    before={before[level.key]}
                    goodWhenDown={level.key !== "normal"}
                  />
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <div className="rp-coverage">
        <p className="rp-coverage__text">
          <span>ความครอบคลุมการประเมิน</span>
          <strong>
            {coverage === null
              ? `ประเมินแล้ว ${show(latest.assessed)} คน`
              : `ประเมินแล้ว ${formatCount(latest.assessed)} จาก ${formatCount(total)} คน (${coverage}%)`}
          </strong>
        </p>
        <SplitBar
          parts={ALL_LEVELS.map((l) => ({ ...l, value: latest[l.key] }))}
        />
      </div>
    </DzSection>
  );
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rp-tooltip">
      <strong>{row.label}</strong>
      {ALL_LEVELS.map((l) => (
        <span key={l.key}>
          <i style={{ background: l.color }} aria-hidden="true" />
          {l.label}: {show(row[l.key])}
        </span>
      ))}
    </div>
  );
}

function RiskTrend({ report }) {
  const [asTable, setAsTable] = useState(false);
  const data = report.trend.map((t) => ({
    ...t,
    // Hidden counts draw nothing. A period with a hidden count is starred on
    // the axis (see the footnote), so an empty segment never reads as zero.
    axisLabel: ALL_LEVELS.some((l) => hidden(t[l.key]))
      ? `${t.label} *`
      : t.label,
    ...Object.fromEntries(
      ALL_LEVELS.map((l) => [`${l.key}Bar`, t[l.key] ?? 0]),
    ),
  }));
  const anyHidden = report.trend.some((t) =>
    ALL_LEVELS.some((l) => hidden(t[l.key])),
  );
  // Bottom-up: normal, watch, high, then the not-assessed cap.
  const stack = [LEVELS[2], LEVELS[1], LEVELS[0], NOT_ASSESSED];
  return (
    <DzSection
      className="rp-section"
      aria-labelledby="rp-trend-title"
      title={<span id="rp-trend-title">แนวโน้มความเสี่ยงสุขภาพจิต</span>}
      description={
        report.trend_basis === "rounds"
          ? "ผลล่าสุดของนักเรียนแต่ละคนในแต่ละรอบคัดกรอง"
          : "ยังไม่มีรอบคัดกรอง แสดงผลล่าสุดของแต่ละคนรายเดือน 6 เดือนล่าสุด"
      }
      aside={
        <div className="cw-mode" role="group" aria-label="รูปแบบการแสดงผล">
          <button
            type="button"
            aria-pressed={!asTable}
            onClick={() => setAsTable(false)}
          >
            <FiBarChart2 aria-hidden="true" /> ดูเป็นกราฟ
          </button>
          <button
            type="button"
            aria-pressed={asTable}
            onClick={() => setAsTable(true)}
          >
            <FiList aria-hidden="true" /> ดูเป็นตาราง
          </button>
        </div>
      }
    >
      <ul className="rp-legend" aria-label="คำอธิบายสี">
        {ALL_LEVELS.map((l) => (
          <li key={l.key}>
            <i style={{ background: l.color }} aria-hidden="true" />
            {l.label}
          </li>
        ))}
      </ul>
      {asTable ? (
        <TableScroll label="ตารางจำนวนนักเรียนตามระดับความเสี่ยง">
          <table className="sch-table admin-data-table">
            <thead>
              <tr>
                <th>
                  {report.trend_basis === "rounds" ? "รอบคัดกรอง" : "เดือน"}
                </th>
                {LEVELS.map((l) => (
                  <th key={l.key}>{l.label}</th>
                ))}
                <th>ประเมินแล้ว</th>
                <th>ยังไม่ได้ประเมิน</th>
              </tr>
            </thead>
            <tbody>
              {report.trend.map((t) => (
                <tr key={t.key}>
                  <td>{t.label}</td>
                  {LEVELS.map((l) => (
                    <td key={l.key}>{show(t[l.key])}</td>
                  ))}
                  <td>{show(t.assessed)}</td>
                  <td>{show(t.not_assessed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      ) : (
        <div
          className="rp-chart"
          role="img"
          aria-label="กราฟแท่งซ้อนจำนวนนักเรียนตามระดับความเสี่ยงและผู้ยังไม่ได้ประเมินในแต่ละช่วง ดูตัวเลขได้จากปุ่มดูเป็นตาราง"
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data}
              barCategoryGap="28%"
              margin={{ top: 12, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="var(--suth-line-soft, #eceff3)"
              />
              <XAxis
                dataKey="axisLabel"
                tickLine={false}
                axisLine={false}
                interval={0}
                height={44}
                tick={<WrappedTick />}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: "var(--suth-muted)", fontSize: 12 }}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ fill: "var(--suth-surface-2)" }}
              />
              {stack.map((l, i) => (
                <Bar
                  key={l.key}
                  dataKey={`${l.key}Bar`}
                  name={l.label}
                  stackId="risk"
                  fill={l.color}
                  stroke="var(--suth-surface, #fff)"
                  strokeWidth={2}
                  maxBarSize={88}
                  radius={i === stack.length - 1 ? [6, 6, 0, 0] : 0}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey={l.key}
                    position="center"
                    formatter={(v) => (v ? v : "")}
                    style={{
                      fill: l === NOT_ASSESSED ? "var(--suth-ink)" : "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {anyHidden && (
        <p className="rp-muted">
          * ช่องที่มีนักเรียนน้อยกว่า 5 คนถูกซ่อนเพื่อไม่ให้ระบุตัวนักเรียนได้
          ส่วนที่ซ่อนจึงไม่แสดงในกราฟ ดูได้ในตาราง
        </p>
      )}
    </DzSection>
  );
}

const TONES = {
  danger: "var(--suth-risk-dot-high, #d92d20)",
  warning: "var(--suth-risk-dot-medium, #f79009)",
  info: "var(--suth-info, #1d5c8c)",
  done: "var(--suth-risk-dot-low, #12b76a)",
};

// One follow-up area as a ruled ledger row: the area, its counts, the split
// as a thin bar, an attention pill when something is overdue or missed, and
// the way into the list when the viewer may open it.
function FollowRow({ title, icon: Icon, to, canOpen, items, note }) {
  const alert = items.find((i) => i.alert && i.value > 0);
  return (
    <li className="rp-row">
      <section className="rp-row__inner" aria-label={title}>
        <div className="rp-row__area">
          <span className="rp-row__icon" aria-hidden="true">
            <Icon />
          </span>
          <div>
            <h3>{title}</h3>
            {note && <p className="rp-muted">{note}</p>}
          </div>
        </div>
        <dl className="rp-metrics">
          {items.map((item) => (
            <div key={item.label} className="rp-metric">
              <dt>
                <i
                  style={{ background: TONES[item.tone] }}
                  aria-hidden="true"
                />
                {item.label}
              </dt>
              <dd className={hidden(item.value) ? "is-hidden" : ""}>
                {show(item.value)}
              </dd>
            </div>
          ))}
        </dl>
        <div className="rp-row__bar">
          {items.length > 1 && (
            <SplitBar
              parts={items.map((item) => ({
                key: item.label,
                value: item.value,
                color: TONES[item.tone],
              }))}
            />
          )}
        </div>
        <div className="rp-row__end">
          {alert && (
            <span className="rp-attention">
              <FiAlertTriangle aria-hidden="true" />
              {alert.label} {formatCount(alert.value)}
            </span>
          )}
          {canOpen && to && (
            <Link className="rp-open" to={to}>
              เปิดรายการ <FiArrowRight aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>
    </li>
  );
}

export default function SchoolReports() {
  const { schoolAccess: access, can } = usePermissions();
  const { schools, schoolId, setSchoolId } = useSchools();
  const [range, setRange] = useState({ startDate: "", endDate: "" }),
    [report, setReport] = useState(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const params = {
    school_id: schoolId,
    from: range.startDate || undefined,
    to: range.endDate || undefined,
  };
  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await getSchoolReport(params);
      setReport(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดรายงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, range.startDate, range.endDate]);
  useEffect(() => {
    load();
  }, [load]);
  const f = report?.follow_up;
  const exportButton = can("dashboard.export") && report && (
    <button
      type="button"
      className="sch-btn-secondary"
      onClick={async () => {
        try {
          saveBlobResponse(
            await exportSchoolReport(params),
            "รายงานภาพรวม.csv",
          );
        } catch {
          setError("ส่งออกไม่สำเร็จ");
        }
      }}
    >
      <FiDownload aria-hidden="true" /> ส่งออก CSV
    </button>
  );
  return (
    <main className="sch-page rp-page">
      <PageHero
        title="รายงานภาพรวม"
        description={
          report
            ? `${report.scope === "school" ? "นักเรียนทั้งโรงเรียน" : "นักเรียนที่คุณดูแล"} ${formatCount(report.population)} คน · แสดงเป็นจำนวนรวม ไม่มีรายชื่อนักเรียน`
            : "จำนวนรวมของนักเรียนตามความเสี่ยงและสถานะการติดตาม"
        }
        actions={exportButton || undefined}
      />
      {schools.length > 1 && (
        <div className="dz-toolbar rp-toolbar">
          <BarSelect label="โรงเรียน" value={schoolId} onChange={setSchoolId}>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </BarSelect>
        </div>
      )}
      {error && (
        <div className="dz-error" role="alert">
          {error}
          <button type="button" onClick={load}>
            ลองอีกครั้ง
          </button>
        </div>
      )}
      {loading && !report && <p role="status">กำลังโหลดรายงาน…</p>}
      {report && (
        <>
          <LatestRound report={report} />
          <RiskTrend report={report} />
          <DzSection
            className="rp-section"
            aria-labelledby="rp-follow-title"
            title={<span id="rp-follow-title">สถานะการติดตาม</span>}
            description="งานดูแลนักเรียนแต่ละด้าน ณ ปัจจุบัน ช่วงเวลาด้านล่างใช้กับนัดหมายที่พบแล้วและไม่มาตามนัด"
          >
            <div className="rp-range">
              <DateRangePills
                value={range}
                onChange={setRange}
                label="ช่วงเวลานัดหมาย"
              />
            </div>
            <ul className="rp-ledger">
              <FollowRow
                title="การติดตามรายบุคคล"
                icon={FiRepeat}
                to="/admin/school/workflows"
                canOpen={access?.can_view_mental}
                items={[
                  { label: "รอทำ", value: f.rescreen.pending, tone: "info" },
                  {
                    label: "เลยกำหนด",
                    value: f.rescreen.overdue,
                    tone: "danger",
                    alert: true,
                  },
                  {
                    label: "ทำแล้ว",
                    value: f.rescreen.completed,
                    tone: "done",
                  },
                ]}
              />
              <FollowRow
                title="การให้คำปรึกษา"
                icon={FiMessageCircle}
                note="นักเรียนที่ถึงวันนัดติดตามแล้วแต่ยังไม่มีบันทึกใหม่"
                items={[
                  {
                    label: "เลยนัดติดตาม",
                    value: f.guidance.overdue,
                    tone: "warning",
                    alert: true,
                  },
                ]}
              />
              <FollowRow
                title="นัดหมายรับคำปรึกษา"
                icon={FiCalendar}
                to="/admin/school/appointments"
                canOpen={access?.can_use_appointments}
                note={`พบแล้วและไม่มาตามนัด: ${describeRange(range)}`}
                items={[
                  {
                    label: "กำลังจะถึง",
                    value: f.appointments.upcoming,
                    tone: "info",
                  },
                  {
                    label: "ไม่มาตามนัด",
                    value: f.appointments.no_show,
                    tone: "warning",
                    alert: true,
                  },
                  {
                    label: "พบแล้ว",
                    value: f.appointments.completed,
                    tone: "done",
                  },
                ]}
              />
              <FollowRow
                title="รายงานพฤติกรรม"
                icon={FiClipboard}
                to="/admin/school/behavior"
                canOpen={access?.can_use_behavior}
                items={[
                  { label: "ใหม่", value: f.behavior.new, tone: "warning" },
                  {
                    label: "กำลังติดตาม",
                    value: f.behavior.following,
                    tone: "info",
                  },
                  { label: "ปิดแล้ว", value: f.behavior.closed, tone: "done" },
                ]}
              />
              <FollowRow
                title="ภาวะเสี่ยงทางกาย"
                icon={FiHeart}
                to="/admin/school/follow-ups"
                canOpen={access?.can_view_physical}
                items={[
                  {
                    label: "ยังไม่เสร็จ",
                    value: f.physical.open,
                    tone: "info",
                  },
                  {
                    label: "เลยกำหนด",
                    value: f.physical.overdue,
                    tone: "danger",
                    alert: true,
                  },
                  {
                    label: "ติดตามแล้ว",
                    value: f.physical.done,
                    tone: "done",
                  },
                ]}
              />
              <FollowRow
                title="การส่งต่อ"
                icon={FiShare2}
                to="/admin/referrals"
                canOpen={can("cases.view")}
                items={[
                  {
                    label: "รอรับ",
                    value: f.referrals.pending,
                    tone: "warning",
                  },
                  {
                    label: "กำลังดำเนินการ",
                    value: f.referrals.in_progress,
                    tone: "info",
                  },
                  {
                    label: "เสร็จสิ้น",
                    value: f.referrals.completed,
                    tone: "done",
                  },
                ]}
              />
            </ul>
          </DzSection>
        </>
      )}
    </main>
  );
}
