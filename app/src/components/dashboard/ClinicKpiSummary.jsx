import {
  FiActivity,
  FiAlertTriangle,
  FiArchive,
  FiArrowRight,
  FiCornerUpRight,
  FiDroplet,
  FiPhoneCall,
  FiPlusSquare,
  FiShield,
  FiUsers,
} from "react-icons/fi";
import {
  getClinicKpiProfile,
  readKpiValue,
} from "../../permissions/organizationProfile";
import { DzSection, KpiTile, formatCount } from "./DashboardKit";
import "./ClinicKpiSummary.css";

const ICONS = {
  alert: FiAlertTriangle,
  phone: FiPhoneCall,
  activity: FiActivity,
  users: FiUsers,
  archive: FiArchive,
  forward: FiCornerUpRight,
  plus: FiPlusSquare,
  shield: FiShield,
};

const CLEAR_TEXT = {
  highRisk: "ไม่มีเคสเสี่ยงสูงค้าง",
  waitingContact: "ติดต่อครบทุกเคสแล้ว",
};

const SECONDARY_TONE = {
  newToday: "brand",
  totalActive: "info",
  closed: "success",
  registered: "teal",
  forwardSafeClinic: "info",
};

// Case counts for the selected clinic. The people who need contact now lead
// as urgent tiles (tinted while above zero); the rest follow as plain tiles.
export default function ClinicKpiSummary({
  clinicSlug,
  clinicName,
  stats,
  isLoading,
  newCaseLabel,
  rangeLabel,
  onOpenCases,
}) {
  const profile = getClinicKpiProfile(clinicSlug);
  const labelFor = (item) =>
    item.key === "newToday" ? newCaseLabel : item.label;
  const sti = profile.extras?.length > 0;
  const total = readKpiValue(stats, "registered");

  return (
    <div className="ckpi" aria-busy={isLoading || undefined}>
      <DzSection
        className="dz-section--bare"
        title={"สรุปเคส " + clinicName}
        description={rangeLabel}
        aside={
          onOpenCases && (
            <button type="button" className="dz-link" onClick={onOpenCases}>
              เปิดรายการเคส <FiArrowRight aria-hidden="true" />
            </button>
          )
        }
      >
        <div className="dz-kpis">
          {profile.priority.map((item) => (
            <KpiTile
              key={item.key}
              icon={ICONS[item.icon]}
              tone={item.tone}
              urgent
              label={labelFor(item)}
              value={readKpiValue(stats, item.key)}
              unit="เคส"
              clearText={CLEAR_TEXT[item.key]}
              isLoading={isLoading}
            />
          ))}
          {profile.secondary.map((item) => (
            <KpiTile
              key={item.key}
              icon={ICONS[item.icon]}
              tone={SECONDARY_TONE[item.key] || "neutral"}
              label={labelFor(item)}
              value={readKpiValue(stats, item.key)}
              unit={item.key === "registered" ? "คน" : "เคส"}
              hint={
                item.key === "closed" && total > 0
                  ? "ปิดแล้ว " +
                    Math.round((readKpiValue(stats, "closed") / total) * 100) +
                    "% ของเคสทั้งหมด"
                  : undefined
              }
              isLoading={isLoading}
            />
          ))}
        </div>
      </DzSection>

      {sti && (
        <DzSection
          className="dz-section--bare"
          title="บริการของคลินิก"
          description="ผู้ลงทะเบียน ผลเจาะเลือด และการรับยา PrEP ในช่วงเวลาเดียวกัน"
        >
          <div className="dz-kpis">
            <KpiTile
              icon={FiUsers}
              tone="teal"
              label="ผู้ลงทะเบียนทั้งหมด"
              value={total}
              unit="คน"
              hint={
                "นักศึกษา " +
                formatCount(stats?.totalStudent) +
                " · บุคคลทั่วไป " +
                formatCount(stats?.totalGeneral)
              }
              isLoading={isLoading}
            />
            <KpiTile
              icon={FiDroplet}
              tone="info"
              label="ผลเจาะเลือด"
              value={
                readKpiValue(stats, "bloodTestNegative") +
                readKpiValue(stats, "bloodTestPositive")
              }
              unit="ราย"
              hint={
                <span className="ckpi-split">
                  <span className="ckpi-result tone-success">
                    ผลลบ (−) {formatCount(stats?.bloodTestNegative)}
                  </span>
                  <span className="ckpi-result tone-danger">
                    ผลบวก (+) {formatCount(stats?.bloodTestPositive)}
                  </span>
                </span>
              }
              isLoading={isLoading}
            />
            {profile.prep.map((item) => (
              <KpiTile
                key={item.key}
                icon={ICONS[item.icon]}
                tone="brand"
                label={item.label}
                value={readKpiValue(stats, item.key)}
                unit="ราย"
                isLoading={isLoading}
              />
            ))}
          </div>
        </DzSection>
      )}
    </div>
  );
}
