import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiClock,
  FiCompass,
  FiGrid,
  FiHome,
  FiLock,
  FiLogIn,
  FiRefreshCw,
  FiTool,
} from "react-icons/fi";
import { authSession } from "../../utils/authSession";
import logo from "../../assets/logoSUTH.png";
import "./StatusPage.css";

// Copy per status: what happened, why, and what the person can do next.
const STATUS = {
  401: {
    icon: FiClock,
    tone: "info",
    label: "เซสชันหมดอายุ",
    title: "กรุณาเข้าสู่ระบบอีกครั้ง",
    detail:
      "เพื่อความปลอดภัยของข้อมูล ระบบออกจากระบบให้อัตโนมัติเมื่อไม่มีการใช้งานเป็นเวลานาน",
    hints: [
      "เข้าสู่ระบบใหม่ แล้วระบบจะพากลับไปทำงานต่อ",
      "หากเปิดหลายแท็บ ให้ปิดแท็บที่ไม่ใช้งาน",
    ],
  },
  403: {
    icon: FiLock,
    tone: "warning",
    label: "ไม่มีสิทธิ์เข้าถึง",
    title: "คุณไม่มีสิทธิ์เข้าถึงหน้านี้",
    detail:
      "สิทธิ์ของบัญชีหรือหน่วยงานที่เลือกอยู่ไม่อนุญาตให้เปิดหน้านี้หรือทำรายการนี้",
    hints: [
      "ตรวจสอบว่าเลือกหน่วยงานที่ใช้งานถูกต้องที่แถบด้านซ้าย",
      "หากต้องใช้งานหน้านี้ โปรดติดต่อผู้ดูแลระบบของหน่วยงานเพื่อขอสิทธิ์",
    ],
  },
  404: {
    icon: FiCompass,
    tone: "neutral",
    label: "ไม่พบหน้า",
    title: "ไม่พบหน้าที่ต้องการ",
    detail: "ที่อยู่อาจพิมพ์ไม่ถูกต้อง หรือหน้านี้ถูกย้ายหรือลบไปแล้ว",
    hints: [
      "ตรวจสอบที่อยู่ในแถบ URL อีกครั้ง",
      "กลับไปเริ่มจากเมนูหลักเพื่อหาหน้าที่ต้องการ",
    ],
  },
  500: {
    icon: FiAlertTriangle,
    tone: "danger",
    label: "ระบบขัดข้อง",
    title: "ระบบขัดข้องชั่วคราว",
    detail:
      "เกิดข้อผิดพลาดที่ฝั่งระบบ ข้อมูลที่บันทึกไว้แล้วยังอยู่ครบ กรุณาลองใหม่อีกครั้ง",
    hints: [
      "รอสักครู่แล้วกดลองใหม่",
      "หากยังพบปัญหา โปรดแจ้งผู้ดูแลระบบพร้อมเวลาที่เกิดเหตุ",
    ],
  },
  503: {
    icon: FiTool,
    tone: "info",
    label: "ปิดปรับปรุงระบบ",
    title: "ระบบกำลังปรับปรุงชั่วคราว",
    detail:
      "ขออภัยในความไม่สะดวก ทีมงานกำลังปรับปรุงระบบ และจะกลับมาให้บริการโดยเร็วที่สุด",
    hints: [
      "ลองเข้าใช้งานใหม่อีกครั้งในอีกสักครู่",
      "ข้อมูลที่บันทึกไว้แล้วไม่ได้รับผลกระทบ",
    ],
  },
};

const formatTime = (date) =>
  date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function StatusLayout({
  status,
  icon: Icon,
  tone,
  label,
  title,
  detail,
  hints,
  actions,
  reference,
}) {
  return (
    <main className={`status-page status-page--${tone}`}>
      <section className="status-card" aria-labelledby="status-title">
        <header className="status-card__head">
          <span className="status-card__logo" aria-hidden="true">
            <img src={logo} alt="" />
          </span>
          <span className="status-card__badge">
            {status ? `${status} · ${label}` : label}
          </span>
        </header>

        <div className="status-card__body">
          <span className="status-card__icon" aria-hidden="true">
            <Icon />
          </span>
          {/* Decorative watermark, drawn by CSS so it is not read as text. */}
          {status && (
            <span
              className="status-card__code"
              data-code={status}
              aria-hidden="true"
            />
          )}
          <h1 id="status-title">{title}</h1>
          <p className="status-card__detail">{detail}</p>

          {hints?.length > 0 && (
            <ul className="status-card__hints">
              {hints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          )}

          <div className="status-card__actions">{actions}</div>
        </div>

        {reference && (
          <footer className="status-card__ref">
            <span>{reference}</span>
            <span>{formatTime(new Date())}</span>
          </footer>
        )}
      </section>
    </main>
  );
}

export default function StatusPage({ status }) {
  const navigate = useNavigate();
  const location = useLocation();
  const info = STATUS[status] || STATUS[500];
  const code = STATUS[status] ? status : 500;
  const isStaff = Boolean(authSession("staff").user);
  const home = isStaff
    ? { to: "/admin/dashboard", label: "ไปหน้าแดชบอร์ด", icon: FiGrid }
    : { to: "/", label: "ไปหน้าแรก", icon: FiHome };
  const HomeIcon = home.icon;

  const primary =
    code === 401 ? (
      <Link className="status-btn status-btn--primary" to="/login">
        <FiLogIn aria-hidden="true" /> เข้าสู่ระบบอีกครั้ง
      </Link>
    ) : code === 500 || code === 503 ? (
      <button
        type="button"
        className="status-btn status-btn--primary"
        onClick={() => window.location.reload()}
      >
        <FiRefreshCw aria-hidden="true" /> ลองใหม่อีกครั้ง
      </button>
    ) : (
      <Link className="status-btn status-btn--primary" to={home.to}>
        <HomeIcon aria-hidden="true" /> {home.label}
      </Link>
    );

  return (
    <StatusLayout
      status={code}
      {...info}
      reference={`หน้า: ${location.state?.from || location.pathname}`}
      actions={
        <>
          {primary}
          <button
            type="button"
            className="status-btn"
            onClick={() => navigate(-1)}
          >
            <FiArrowLeft aria-hidden="true" /> ย้อนกลับ
          </button>
          {(code === 401 || code === 500 || code === 503) && (
            <Link className="status-btn status-btn--ghost" to={home.to}>
              {home.label}
            </Link>
          )}
        </>
      }
    />
  );
}
