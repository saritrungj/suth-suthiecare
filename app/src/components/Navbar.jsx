import { useNavigate } from "react-router-dom";
import logo from "../assets/logoSUTH.png";
import { FiArrowLeft } from "react-icons/fi";
import "./Navbar.css";

export default function Navbar({
  showLogin = false,
  showBack = false,
  backText = "กลับ",
  onBack,
}) {
  const navigate = useNavigate();

  return (
    <nav className="main-nav">
      {/* LOGO */}
      <div className="main-nav__logo" onClick={() => navigate("/")}>
        <img
          src={logo}
          alt="SUTH Logo"
          className="main-nav__logo-img"
          style={{ cursor: "pointer", height: "100%" }}
        />
      </div>

      {/* RIGHT BUTTONS */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {showBack && (
          <button
            className="main-nav__back"
            onClick={onBack ? onBack : () => navigate(-1)}
          >
            <FiArrowLeft size={16} /> {backText}
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
      </div>
    </nav>
  );
}
