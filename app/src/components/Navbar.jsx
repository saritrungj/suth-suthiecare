import { useNavigate } from "react-router-dom";
import logo from "../assets/logoSUTH.png";
import { FiArrowLeft } from "react-icons/fi";
import PatientAccountMenu from "./PatientAccountMenu";
import LanguageSwitcher from "./LanguageSwitcher";
import "./Navbar.css";

export default function Navbar({
  showLogin = false,
  showBack = false,
  showPatientAccount = false,
  showLanguage = false,
  backText = "กลับ",
  onBack,
}) {
  const navigate = useNavigate();

  return (
    <nav className="main-nav">
      <button
        type="button"
        className="main-nav__brand"
        onClick={() => navigate("/")}
        aria-label="ไปหน้าแรก"
      >
        <span className="main-nav__logo-frame" aria-hidden="true">
          <img src={logo} alt="" className="main-nav__logo-img" />
        </span>
        <span className="main-nav__brand-copy">
          <strong>ระบบขอรับบริการ</strong>
          <small>โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี</small>
        </span>
      </button>

      {/* RIGHT BUTTONS */}
      <div className="main-nav__actions">
        {showLanguage && <LanguageSwitcher darkText />}
        {showBack && (
          <button
            className="main-nav__back"
            onClick={onBack ? onBack : () => navigate(-1)}
            aria-label={backText}
          >
            <FiArrowLeft size={16} /> <span>{backText}</span>
          </button>
        )}

        {showLogin && (
          <button
            className="sl-nav__cta" /* คลาสเดิมจาก SutLanding */
            onClick={() => navigate("/login")}
          >
            เข้าสู่ระบบ →
          </button>
        )}
        {showPatientAccount && <PatientAccountMenu />}
      </div>
    </nav>
  );
}
