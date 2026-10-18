import { useEffect, useMemo, useState } from "react";
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowRight,
  FiCheckCircle,
  FiPhoneCall,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { LuBuilding2, LuHospital, LuSchool } from "react-icons/lu";
import { getOrganizationsOverview } from "../../services/api";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  getCurrentMonthDateRange,
  parseCaseDate,
} from "../../utils/caseDateFilter";
import ActiveOrganizationScope from "../OrganizationScope";
import {
  DashboardHero,
  DateRangePills,
  DzSection,
  KpiTile,
  describeRange,
  formatCount,
} from "./DashboardKit";
import "./AllOrganizationsOverview.css";

const TYPE_LABEL = { hospital: "โรงพยาบาล", school: "โรงเรียน" };
const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "hospital", label: "โรงพยาบาล" },
  { key: "school", label: "โรงเรียน" },
  { key: "attention", label: "มีเคสต้องดูแล" },
];

const relative = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
function lastActivity(value) {
  const date = parseCaseDate(value);
  if (!date) return "ยังไม่มีผลประเมิน";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1) return "มีผลประเมินเข้ามาวันนี้";
  if (days < 30) return "ผลประเมินล่าสุด " + relative.format(-days, "day");
  if (days < 365)
    return (
      "ผลประเมินล่าสุด " + relative.format(-Math.floor(days / 30), "month")
    );
  return "ผลประเมินล่าสุด " + relative.format(-Math.floor(days / 365), "year");
}

const attentionOf = (org) =>
  org.cases.highRisk + org.cases.waitingContact + (org.school?.high || 0);

const riskOf = (org) => org.cases.highRisk + (org.school?.high || 0);

const percent = (part, whole) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

function Meter({ parts, label }) {
  const total = parts.reduce((n, p) => n + p.value, 0);
  return (
    <span className="dzo-meter" role="img" aria-label={label}>
      {total === 0 ? (
        <span className="dzo-meter__empty" />
      ) : (
        parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.key}
              className={"dzo-meter__part is-" + p.key}
              style={{ flexGrow: p.value }}
            />
          ))
      )}
    </span>
  );
}

function OrganizationCard({ org, onOpen }) {
  const school = org.org_type === "school";
  const Icon = school ? LuSchool : LuHospital;
  const { cases } = org;
  return (
    <li>
      <button type="button" className="dz-org" onClick={() => onOpen(org)}>
        <span className="dz-org__head">
          <span
            className={"dz-org__avatar is-" + org.org_type}
            aria-hidden="true"
          >
            <Icon />
          </span>
          <span className="dz-org__name">
            <strong>{org.name}</strong>
            <span className="dz-org__meta">
              <span className={"dz-org__type is-" + org.org_type}>
                {TYPE_LABEL[org.org_type]}
              </span>
              {org.parent_name && <span>สังกัด {org.parent_name}</span>}
            </span>
          </span>
        </span>

        <span className="dz-org__flags">
          {cases.highRisk > 0 && (
            <span className="dz-flag is-danger">
              <FiAlertTriangle aria-hidden="true" />
              เสี่ยงสูงยังไม่ปิด {formatCount(cases.highRisk)}
            </span>
          )}
          {school && org.school.high > 0 && (
            <span className="dz-flag is-danger">
              <FiAlertTriangle aria-hidden="true" />
              นักเรียนเสี่ยงสูง {formatCount(org.school.high)}
            </span>
          )}
          {cases.waitingContact > 0 && (
            <span className="dz-flag is-warning">
              <FiPhoneCall aria-hidden="true" />
              รอติดต่อ {formatCount(cases.waitingContact)}
            </span>
          )}
          {attentionOf(org) === 0 && (
            <span className="dz-flag is-clear">
              <FiCheckCircle aria-hidden="true" />
              ไม่มีเคสค้างดูแล
            </span>
          )}
        </span>

        {school ? (
          <span className="dz-org__body">
            <span className="dz-org__stats">
              <span>
                <small>นักเรียน</small>
                <b>{formatCount(org.school.students)}</b>
              </span>
              <span>
                <small>คัดกรองแล้ว</small>
                <b>{formatCount(org.school.screened)}</b>
              </span>
              <span>
                <small>ห้อง · ครู</small>
                <b>
                  {formatCount(org.school.classrooms)} ·{" "}
                  {formatCount(org.school.teachers)}
                </b>
              </span>
            </span>
            <Meter
              label={
                "ผลคัดกรองสุขภาพจิตล่าสุด: เสี่ยงสูง " +
                org.school.high +
                " เฝ้าระวัง " +
                org.school.medium +
                " ปกติ " +
                org.school.normal +
                " คน"
              }
              parts={[
                { key: "high", value: org.school.high },
                { key: "medium", value: org.school.medium },
                { key: "normal", value: org.school.normal },
              ]}
            />
            <span className="dzo-legend">
              <span className="is-high">
                เสี่ยงสูง {formatCount(org.school.high)}
              </span>
              <span className="is-medium">
                เฝ้าระวัง {formatCount(org.school.medium)}
              </span>
              <span className="is-normal">
                ปกติ {formatCount(org.school.normal)}
              </span>
              <span className="dzo-legend__note">
                คัดกรองแล้ว {percent(org.school.screened, org.school.students)}%
              </span>
            </span>
          </span>
        ) : (
          <span className="dz-org__body">
            <span className="dz-org__stats">
              <span>
                <small>เคสในช่วงนี้</small>
                <b>{formatCount(cases.total)}</b>
              </span>
              <span>
                <small>กำลังดูแล</small>
                <b>{formatCount(cases.active)}</b>
              </span>
              <span>
                <small>ปิดแล้ว</small>
                <b>{formatCount(cases.closed)}</b>
              </span>
            </span>
            <Meter
              label={
                "กำลังดูแล " +
                cases.active +
                " เคส ปิดแล้ว " +
                cases.closed +
                " เคส"
              }
              parts={[
                { key: "active", value: cases.active },
                { key: "closed", value: cases.closed },
              ]}
            />
            <span className="dzo-legend">
              <span className="is-active">กำลังดูแล</span>
              <span className="is-closed">
                ปิดแล้ว {percent(cases.closed, cases.total)}%
              </span>
              <span className="dzo-legend__note">
                แบบฟอร์มเผยแพร่ {formatCount(org.published_forms)}
              </span>
            </span>
          </span>
        )}

        <span className="dz-org__foot">
          <span>{lastActivity(org.last_activity_at)}</span>
          <span className="dz-org__go">
            เปิดแดชบอร์ด <FiArrowRight aria-hidden="true" />
          </span>
        </span>
      </button>
    </li>
  );
}

// System admin, "all organizations" scope: totals across every unit, then
// one card per unit with the counts that need someone, risk first. A card
// switches the workspace to that unit's own dashboard.
export default function AllOrganizationsOverview() {
  const { setActiveOrganization } = usePermissions();
  const [range, setRange] = useState(getCurrentMonthDateRange);
  const [state, setState] = useState({ data: null, error: "" });
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    setState({ data: null, error: "" });
    getOrganizationsOverview(range.startDate, range.endDate)
      .then(({ data }) => alive && setState({ data, error: "" }))
      .catch(
        (e) =>
          alive &&
          setState({
            data: null,
            error:
              e.response?.data?.message || "โหลดภาพรวมทุกหน่วยงานไม่สำเร็จ",
          }),
      );
    return () => {
      alive = false;
    };
  }, [range.startDate, range.endDate, retry]);

  const loading = !state.data && !state.error;
  const totals = state.data?.totals || {};
  const all = useMemo(() => state.data?.organizations || [], [state.data]);

  const organizations = useMemo(() => {
    const term = query.trim().toLowerCase();
    return all
      .filter((org) =>
        filter === "attention"
          ? attentionOf(org) > 0
          : filter === "all" || org.org_type === filter,
      )
      .filter(
        (org) =>
          !term ||
          [org.name, org.code, org.parent_name]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(term)),
      )
      .sort(
        (a, b) =>
          riskOf(b) - riskOf(a) ||
          b.cases.waitingContact - a.cases.waitingContact ||
          a.name.localeCompare(b.name, "th"),
      );
  }, [all, filter, query]);

  const counts = {
    all: all.length,
    hospital: all.filter((o) => o.org_type === "hospital").length,
    school: all.filter((o) => o.org_type === "school").length,
    attention: all.filter((o) => attentionOf(o) > 0).length,
  };

  // Students at high risk usually also have a high-risk case, so the note
  // counts cases only and never adds the two together.
  const urgent = totals.highRisk || 0;
  const urgentOrgs = all.filter((o) => o.cases.highRisk > 0).length;
  const note = loading
    ? null
    : urgent > 0
      ? "มีเคสเสี่ยงสูงที่ยังไม่ปิด " +
        formatCount(urgent) +
        " เคส ใน " +
        formatCount(urgentOrgs) +
        " หน่วยงาน"
      : null;

  const open = (org) => {
    setActiveOrganization(String(org.id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="admin-page dz-surface">
      <main className="dz-page">
        <DashboardHero
          title="ภาพรวมทุกหน่วยงาน"
          scope={<ActiveOrganizationScope />}
          note={note}
          tone={urgent > 0 ? "alert" : "clear"}
        />

        <div className="dz-toolbar">
          <DateRangePills value={range} onChange={setRange} />
        </div>

        {state.error && (
          <div className="dz-error" role="alert">
            {state.error}
            <button type="button" onClick={() => setRetry((n) => n + 1)}>
              ลองอีกครั้ง
            </button>
          </div>
        )}

        <DzSection
          className="dz-section--bare"
          title="ยอดรวมทุกหน่วยงาน"
          description={
            "ข้อมูล " +
            describeRange(range) +
            " นับเคสละหนึ่งครั้งตามผลประเมินล่าสุด"
          }
          aria-busy={loading || undefined}
        >
          <div className="dz-kpis">
            <KpiTile
              icon={FiAlertTriangle}
              tone="danger"
              urgent
              label="เคสเสี่ยงสูงที่ยังไม่ปิด"
              value={totals.highRisk}
              unit="เคส"
              clearText="ไม่มีเคสเสี่ยงสูงค้าง"
              isLoading={loading}
            />
            <KpiTile
              icon={FiPhoneCall}
              tone="warning"
              urgent
              label="รอติดต่อกลับ"
              value={totals.waitingContact}
              unit="เคส"
              clearText="ติดต่อครบทุกเคสแล้ว"
              isLoading={loading}
            />
            <KpiTile
              icon={FiActivity}
              tone="info"
              label="เคสในช่วงนี้"
              value={totals.cases}
              unit="เคส"
              hint={
                "กำลังดูแล " +
                formatCount(totals.active) +
                " · ปิดแล้ว " +
                formatCount(totals.closed)
              }
              isLoading={loading}
            />
            <KpiTile
              icon={FiUsers}
              tone="teal"
              label="นักเรียนที่คัดกรองสุขภาพจิต"
              value={totals.screened}
              unit="คน"
              hint={
                "จากนักเรียน " +
                formatCount(totals.students) +
                " คน · เสี่ยงสูง " +
                formatCount(totals.studentHighRisk) +
                " คน"
              }
              isLoading={loading}
            />
            <KpiTile
              icon={LuBuilding2}
              tone="brand"
              label="หน่วยงานที่เปิดใช้งาน"
              value={totals.organizations}
              unit="แห่ง"
              hint={
                "โรงพยาบาล " +
                formatCount(totals.hospitals) +
                " · โรงเรียน " +
                formatCount(totals.schools)
              }
              isLoading={loading}
            />
          </div>
        </DzSection>

        <DzSection
          title="หน่วยงานทั้งหมด"
          description="หน่วยงานที่มีเคสเสี่ยงสูงขึ้นก่อน กดการ์ดเพื่อเข้าแดชบอร์ดของหน่วยงานนั้น"
          aside={
            <label className="dzo-search">
              <FiSearch aria-hidden="true" />
              <span className="dz-sr">ค้นหาหน่วยงาน</span>
              <input
                type="search"
                placeholder="ค้นหาชื่อหรือรหัสหน่วยงาน"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          }
        >
          <div
            className="dz-pills dzo-filters"
            role="group"
            aria-label="ประเภทหน่วยงาน"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="dz-pill"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label} <span className="dzo-count">{counts[f.key]}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <ul className="dzo-grid" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <li key={i} className="dzo-ghost" />
              ))}
            </ul>
          ) : organizations.length ? (
            <ul className="dzo-grid">
              {organizations.map((org) => (
                <OrganizationCard key={org.id} org={org} onOpen={open} />
              ))}
            </ul>
          ) : (
            <div className="dz-empty">
              <strong>ไม่พบหน่วยงานที่ตรงกับตัวกรอง</strong>
              <span>ลองเปลี่ยนประเภทหรือคำค้นหา</span>
            </div>
          )}
        </DzSection>
      </main>
    </div>
  );
}
