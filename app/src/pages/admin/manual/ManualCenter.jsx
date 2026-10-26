import { FiBookOpen, FiDownload, FiFileText } from "react-icons/fi";
import { PageHero } from "../../../components/dashboard/DashboardKit";
import DataPanel from "../../../components/table/DataPanel";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import "./ManualCenter.css";

// Every manual the back office offers. `access` mirrors the server's
// allowlist in server/routes/privateFileRoutes.js; `orgTypes` narrows a
// unit guide to the organization type it describes.
const MANUALS = [
  {
    file: "guide_central.pdf",
    title: "คู่มือแอดมินกลาง",
    description:
      "หน่วยงานหลักและหน่วยงานย่อย บัญชีเจ้าหน้าที่ บทบาทและสิทธิ์ แบนเนอร์ ฟอร์ม ภาพผลลัพธ์ และข้อมูลหลัก",
    pages: 13,
    access: "system",
    audience: "แอดมินกลาง",
  },
  {
    file: "guide_hospital.pdf",
    title: "คู่มือแอดมินโรงพยาบาล",
    description:
      "เคสและเคสเสี่ยง นัดหมาย ส่งต่อระหว่างหน่วยงาน ฟอร์ม คลินิก ผู้มารับบริการ ศูนย์ช่วยเหลือ และข้อมูลหลัก",
    pages: 17,
    access: "staff",
    audience: "หน่วยงานโรงพยาบาล",
    orgTypes: ["hospital"],
  },
  {
    file: "guide_school.pdf",
    title: "คู่มือแอดมินโรงเรียน",
    description:
      "ชั้นปีและห้องเรียน นำเข้าข้อมูล นักเรียน ครู บุคลากรและผู้ปกครอง รอบคัดกรองและการติดตามรายบุคคล และข้อมูลสุขภาพนักเรียน",
    pages: 17,
    access: "staff",
    audience: "หน่วยงานโรงเรียน",
    orgTypes: ["school"],
  },
  {
    file: "guide_user.pdf",
    title: "คู่มือผู้รับบริการ",
    description:
      "เลือกบริการ ทำแบบประเมิน ดูผล สมัครสมาชิก ติดตามประวัติ และแบบประเมินที่นักเรียนต้องทำ ใช้แนะนำผู้รับบริการได้",
    pages: 15,
    access: "staff",
    audience: "ผู้รับบริการ",
  },
  {
    file: "admin_manual.pdf",
    title: "คู่มือผู้ดูแลระบบ (ฉบับเต็ม)",
    description: "เอกสารคู่มือผู้ดูแลระบบฉบับเดิม",
    access: "system",
    audience: "แอดมินกลาง",
    legacy: true,
  },
  {
    file: "user_manual.pdf",
    title: "คู่มือการใช้งานระบบ (ฉบับเต็ม)",
    description: "เอกสารคู่มือการใช้งานฉบับเดิมที่หน้าแรกให้ดาวน์โหลด",
    access: "staff",
    audience: "ผู้รับบริการ",
    legacy: true,
  },
];

function ManualCard({ manual }) {
  return (
    <article className={`mc-card ${manual.legacy ? "mc-card--legacy" : ""}`}>
      <span className="mc-card__icon" aria-hidden="true">
        {manual.legacy ? <FiFileText /> : <FiBookOpen />}
      </span>
      <div className="mc-card__body">
        <h3>{manual.title}</h3>
        <p>{manual.description}</p>
        <p className="mc-card__meta">
          PDF
          {manual.pages ? ` · ${manual.pages} หน้า` : ""} · สำหรับ
          {manual.audience}
        </p>
      </div>
      <a
        className="mc-btn"
        href={`/api/private-files/${manual.file}`}
        download
        aria-label={`ดาวน์โหลด${manual.title} (PDF)`}
      >
        <FiDownload aria-hidden="true" /> ดาวน์โหลด
      </a>
    </article>
  );
}

export default function ManualCenter() {
  const { authorization, activeOrganizationType } = usePermissions();
  const isSystemAdmin = authorization?.is_system_admin === true;

  // System admins see every manual. Others see what they may download and,
  // for unit guides, the one for their organization type.
  const visible = MANUALS.filter((manual) => {
    if (isSystemAdmin) return true;
    if (manual.access === "system") return false;
    return !manual.orgTypes || manual.orgTypes.includes(activeOrganizationType);
  });
  const guides = visible.filter((manual) => !manual.legacy);
  const legacy = visible.filter((manual) => manual.legacy);

  return (
    <div className="mc-page">
      <PageHero
        title="คู่มือการใช้งาน"
        description="ดาวน์โหลดคู่มือการใช้งานแยกตามบทบาท พร้อมภาพหน้าจอและขั้นตอนทีละขั้น"
      />

      <DataPanel as="section" className="mc-panel" aria-labelledby="mc-guides">
        <div className="dz-section__head">
          <h2 id="mc-guides" className="dz-section__title">
            คู่มือตามบทบาท
          </h2>
          <p className="dz-section__desc">
            เลือกคู่มือที่ตรงกับงานของคุณ ไฟล์เป็น PDF เปิดได้ทุกอุปกรณ์
          </p>
        </div>
        <div className="mc-grid">
          {guides.map((manual) => (
            <ManualCard key={manual.file} manual={manual} />
          ))}
        </div>
      </DataPanel>

      {legacy.length > 0 && (
        <DataPanel
          as="section"
          className="mc-panel"
          aria-labelledby="mc-legacy"
        >
          <div className="dz-section__head">
            <h2 id="mc-legacy" className="dz-section__title">
              เอกสารเพิ่มเติม
            </h2>
          </div>
          <div className="mc-grid">
            {legacy.map((manual) => (
              <ManualCard key={manual.file} manual={manual} />
            ))}
          </div>
        </DataPanel>
      )}
    </div>
  );
}
