import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import logo from "../assets/logoSUTH.png";
import { FiArrowLeft, FiMenu, FiX } from "react-icons/fi";
import PatientAccountMenu from "./PatientAccountMenu";
import LanguageSwitcher from "./LanguageSwitcher";
import PublicNavLinks from "./public/PublicNavLinks";
import "./Navbar.css";

// Navbar for public (patient-facing) pages; mirrors the homepage navbar.
export default function Navbar({
  showLogin = false,
  showBack = false,
  showPatientAccount = false,
  showLanguage = false,
  backText = "กลับ",
  onBack,
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`main-nav ${scrolled ? "is-scrolled" : ""}`}>
      <button
        type="button"
        className="main-nav__brand"
        onClick={() => navigate("/")}
        aria-label="ไปหน้าแรก"
      >
        <span className="main-nav__logo-frame" aria-hidden="true">
          <img src={logo} alt="" className="main-nav__logo-img" />
        </span>
      </button>

      <div
        id="main-nav-menu"
        className={`main-nav__menu ${menuOpen ? "is-open" : ""}`}
      >
        <PublicNavLinks
          className="main-nav__links"
          onNavigate={() => setMenuOpen(false)}
        />
        <div className="main-nav__actions">
          {showLanguage && <LanguageSwitcher darkText />}
          {showLogin && (
            <button
              type="button"
              className="main-nav__login"
              onClick={() => navigate("/login")}
            >
              เข้าสู่ระบบ
            </button>
          )}
          {showPatientAccount && (
            <PatientAccountMenu
              onNavigate={() => setMenuOpen(false)}
              stackOnMobile
            />
          )}
        </div>
      </div>

      <div className="main-nav__end">
        {showBack && (
          <button
            type="button"
            className="main-nav__back"
            onClick={onBack ? onBack : () => navigate(-1)}
            aria-label={backText}
          >
            <FiArrowLeft size={16} aria-hidden="true" /> <span>{backText}</span>
          </button>
        )}
        <button
          type="button"
          className="main-nav__toggle"
          aria-label={
            menuOpen
              ? t("public_nav.close_menu", "ปิดเมนู")
              : t("public_nav.open_menu", "เปิดเมนู")
          }
          aria-expanded={menuOpen}
          aria-controls="main-nav-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
        </button>
      </div>
    </nav>
  );
}
