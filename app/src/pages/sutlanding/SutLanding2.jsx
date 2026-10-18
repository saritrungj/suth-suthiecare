import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FiCheckCircle,
  FiShield,
  FiHeart,
  FiPhoneCall,
  FiMenu,
  FiX,
  FiExternalLink,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import PatientAccountMenu from "../../components/PatientAccountMenu.jsx";
import { getPatientSession } from "../../utils/patientSession";
import { authSession } from "../../utils/authSession";
import FloatingActions from "../../components/floating/FloatingActions.jsx";
// Page styles load first so the picker's rules win over the page-wide reset.
import "./SutLanding2.css";
import ClinicFormPicker from "./ClinicFormPicker.jsx";

import logo from "../../assets/logoSUTH.png";
import bgHealth from "../../assets/bg-health.jpg";
import bgClinic from "../../assets/bg-new.jpg";
import siteVitalcare from "../../assets/vitalcare.png";
import siteAct from "../../assets/act.suth.png";
import { formCache } from "../../services/cache";
import api, {
  getForms,
  getBanners,
  getActiveClinics,
} from "../../services/api";

const SLIDE_INTERVAL = 6000;
const PROJECT_START_YEAR = 2026;

export default function SutLanding2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [appVersion, setAppVersion] = useState("");
  const currentYear = new Date().getFullYear();
  const copyrightYears =
    currentYear > PROJECT_START_YEAR
      ? `${PROJECT_START_YEAR}–${currentYear}`
      : `${PROJECT_START_YEAR}`;

  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [forms, setForms] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);

  const pickerSectionRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    let isActive = true;
    fetch("/version.json", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (isActive && data?.version) setAppVersion(data.version);
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          setIsScrolled(window.scrollY > 40);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Load Clinics
    getActiveClinics()
      .then((res) => {
        const sorted = (res.data.data || []).sort(
          (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999),
        );
        setClinics(sorted);
        setLoadingClinics(false);
      })
      .catch((err) => {
        console.error("Failed to load clinics", err);
        setLoadingClinics(false);
      });

    // Load Banners
    getBanners().then((res) =>
      setSlides(
        res.data.map((b) => ({
          image: b.image,
          alt: b.filename,
          link: b.link,
        })),
      ),
    );

    // Load Forms
    const cachedForms = formCache.get("forms");
    if (cachedForms) {
      setForms(cachedForms);
      setLoading(false);
      return;
    }

    getForms("lastOpened")
      .then((res) => {
        const activeForms = res.data.filter((f) => {
          if (!f.status || f.status !== "published") return false;
          const now = new Date();
          const start = f.publish_start_date
            ? new Date(f.publish_start_date)
            : null;
          const end = f.publish_end_date ? new Date(f.publish_end_date) : null;
          if (start && now < start) return false;
          if (end && now > end) return false;
          return true;
        });
        const reversed = [...activeForms].reverse();
        setForms(reversed);
        formCache.set("forms", reversed);
        setLoading(false);
      })
      .catch(() => {
        setForms([]);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!slides.length) return;
    const t = setInterval(
      () => setCurrentSlide((c) => (c + 1) % slides.length),
      SLIDE_INTERVAL,
    );
    return () => clearInterval(t);
  }, [slides]);

  const organizationCount = useMemo(
    () =>
      new Set(
        clinics
          .map((c) => c.organization_code || c.organization_id)
          .filter((key) => key != null && key !== ""),
      ).size,
    [clinics],
  );

  const fetchAllCounts = useCallback(async (formList) => {
    if (!formList.length) return;
    try {
      const response = await api.post("/counts", {
        formIds: formList.map((f) => f.id),
      });
      setCounts(response.data.data);
    } catch (err) {}
  }, []);

  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    if (!forms.length || !isInViewport) return;
    fetchAllCounts(forms);
    pollRef.current = setInterval(() => fetchAllCounts(forms), 60000);
    return () => clearInterval(pollRef.current);
  }, [forms, fetchAllCounts, isInViewport]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting);
    });
    if (pickerSectionRef.current) observer.observe(pickerSectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sut2-page">
      {/* NAVBAR */}
      <nav className={`sut2-nav ${isScrolled ? "sut2-nav--scrolled" : ""}`}>
        <div className="sut2-nav__logo">
          <img src={logo} alt="SUTH Logo" />
        </div>
        <button
          type="button"
          className="sut2-nav__menu-btn"
          aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={menuOpen}
          aria-controls="sut2-nav-actions"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? (
            <FiX aria-hidden="true" />
          ) : (
            <FiMenu aria-hidden="true" />
          )}
        </button>
        <div
          id="sut2-nav-actions"
          className={`sut2-nav__actions ${menuOpen ? "sut2-open" : ""}`}
        >
          <LanguageSwitcher
            className="sut2-nav__language"
            darkText={isScrolled || menuOpen}
          />
          <PatientAccountMenu
            onDark={!isScrolled && !menuOpen}
            onNavigate={() => setMenuOpen(false)}
            stackOnMobile
          />
        </div>
      </nav>

      <div className="sut2-main-wrapper">
        {/* ================= 1. HERO SPLIT SECTION ================= */}
        <section className="sut2-hero">
          <div
            className="sut2-hero__bg"
            style={{
              backgroundImage: `url(${bgHealth})`,
              transform: `translateY(${scrollY * 0.4}px)`,
            }}
          />
          <div className="sut2-hero__overlay"></div>

          <div className="sut2-hero__content">
            <div
              className="sut2-hero__text-box"
              style={{ transform: `translateY(${scrollY * -0.15}px)` }}
            >
              <h1 className="sut2-hero__title">
                {t("sutlanding.title")}
                <br />
                <span className="sut2-hero__highlight">
                  {t("sutlanding.subtitle_highlight")}
                </span>
              </h1>
              <p className="sut2-hero__subtitle">
                {t("sutlanding.description")}
              </p>
              <div className="sut2-hero__cta-group">
                <button
                  className="sut2-hero__cta"
                  onClick={() =>
                    document
                      .getElementById("services")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {t("sutlanding.btn_start")}
                </button>
                <button
                  className="sut2-hero__cta sut2-hero__cta--secondary"
                  onClick={() =>
                    document
                      .getElementById("steps")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  {t("sutlanding.btn_steps")}
                </button>
              </div>
              {!loadingClinics && clinics.length > 0 && (
                <ul
                  className="sut2-hero__stats"
                  aria-label={t("sutlanding.stats_label")}
                >
                  {organizationCount > 1 && (
                    <li>
                      <strong>{organizationCount}</strong>
                      {t("sutlanding.stat_orgs")}
                    </li>
                  )}
                  <li>
                    <strong>{clinics.length}</strong>
                    {t("sutlanding.stat_clinics")}
                  </li>
                  {!loading && (
                    <li>
                      <strong>{forms.length}</strong>
                      {t("sutlanding.stat_forms")}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* ===== Banner ==== */}
            <div
              className="sut2-hero__banner-box"
              style={{ transform: `translateY(${scrollY * 0.1}px)` }}
            >
              {slides.length > 0 ? (
                <div className="sut2-banner-slider">
                  {slides.map((slide, i) =>
                    slide.link ? (
                      <a
                        href={slide.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={i}
                        className={`sut2-banner-slide ${i === currentSlide ? "active" : ""}`}
                        style={{
                          display: i === currentSlide ? "block" : "none",
                        }}
                      >
                        <img
                          src={slide.image}
                          alt={slide.alt || "banner"}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      </a>
                    ) : (
                      <img
                        key={i}
                        src={slide.image}
                        alt={slide.alt || "banner"}
                        className={`sut2-banner-slide ${i === currentSlide ? "active" : ""}`}
                      />
                    ),
                  )}
                  <div className="sut2-banner-dots">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        className={`sut2-banner-dot ${i === currentSlide ? "active" : ""}`}
                        onClick={() => setCurrentSlide(i)}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sut2-banner-placeholder">
                  <FiHeart size={48} color="rgba(255,255,255,0.5)" />
                  <p>{t("sutlanding.banner_placeholder")}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================= 2. ORGANIZATION / CLINIC / FORM PICKER ================= */}
        <section
          id="services"
          ref={pickerSectionRef}
          className="sut2-3d-section sut2-picker-section"
          aria-label={t("clinic_picker.title")}
        >
          <ClinicFormPicker
            clinics={clinics}
            forms={forms}
            counts={counts}
            loading={loading || loadingClinics}
          />
        </section>

        {/* ================= 3. HOW IT WORKS ================= */}
        <section id="steps" className="sut2-steps-section">
          <div
            className="sut2-steps__bg"
            style={{
              backgroundImage: `url(${bgClinic})`,
              transform: `translateY(${(scrollY - window.innerHeight) * 0.25}px)`,
            }}
          />
          <div className="sut2-steps-overlay"></div>

          <div className="sut2-steps-content">
            <h2 className="sut2-steps-title">{t("sutlanding.steps_title")}</h2>
            <div className="sut2-steps-grid">
              <div className="sut2-step-glass">
                <div className="sut2-step-icon">
                  <FiCheckCircle />
                </div>
                <h3>{t("sutlanding.step1_title")}</h3>
                <p>{t("sutlanding.step1_desc")}</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon">
                  <FiShield />
                </div>
                <h3>{t("sutlanding.step2_title")}</h3>
                <p>{t("sutlanding.step2_desc")}</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon">
                  <FiHeart />
                </div>
                <h3>{t("sutlanding.step3_title")}</h3>
                <p>{t("sutlanding.step3_desc")}</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon">
                  <FiPhoneCall />
                </div>
                <h3>{t("sutlanding.step4_title")}</h3>
                <p>{t("sutlanding.step4_desc")}</p>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "45px" }}>
              <a
                href="/api/private-files/user_manual.pdf"
                onClick={(event) => {
                  if (
                    !getPatientSession().authenticated &&
                    !authSession("staff").user
                  ) {
                    event.preventDefault();
                    navigate("/account/login?returnTo=%2F");
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "var(--suth-on-action)",
                  textDecoration: "underline",
                  fontSize: "var(--suth-fs-body)",
                  fontWeight: "500",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  opacity: 0.9,
                  transition: "opacity 0.2s",
                }}
                onMouseOver={(e) => (e.target.style.opacity = 1)}
                onMouseOut={(e) => (e.target.style.opacity = 0.9)}
              >
                {t("sutlanding.download_manual")}
              </a>
            </div>
          </div>
        </section>

        {/* ================= 4. OUR OTHER WEBSITES ================= */}
        <section
          className="sut2-sites-section"
          aria-labelledby="sut2-sites-title"
        >
          <div className="sut2-sites-content">
            <h2 id="sut2-sites-title" className="sut2-sites-title">
              {t("sutlanding.sites_title")}
            </h2>
            <div className="sut2-sites-grid">
              <a
                href="https://vitalcare.suth.go.th"
                target="_blank"
                rel="noopener noreferrer"
                className="sut2-site-card"
              >
                {/* Banner image: vitalcare.suth.go.th screenshot (imported from /assets/vitalcare.png) */}
                <img
                  className="sut2-site-banner"
                  src={siteVitalcare}
                  alt="SUTH Vitalcare"
                  loading="lazy"
                  decoding="async"
                />
                <div className="sut2-site-body">
                  <h3 className="sut2-site-name">
                    {t("sutlanding.sites_vitalcare_name")}
                  </h3>
                  <p className="sut2-site-desc">
                    {t("sutlanding.sites_vitalcare_desc")}
                  </p>
                  <span className="sut2-site-link">
                    {t("sutlanding.sites_visit")}
                    <FiExternalLink aria-hidden="true" />
                  </span>
                </div>
              </a>

              <a
                href="https://act.suth.go.th/"
                target="_blank"
                rel="noopener noreferrer"
                className="sut2-site-card"
              >
                {/* Banner image: act.suth.go.th screenshot (imported from /assets/act.suth.png) */}
                <img
                  className="sut2-site-banner"
                  src={siteAct}
                  alt="Vaccine Registration"
                  loading="lazy"
                  decoding="async"
                />
                <div className="sut2-site-body">
                  <h3 className="sut2-site-name">
                    {t("sutlanding.sites_act_name")}
                  </h3>
                  <p className="sut2-site-desc">
                    {t("sutlanding.sites_act_desc")}
                  </p>
                  <span className="sut2-site-link">
                    {t("sutlanding.sites_visit")}
                    <FiExternalLink aria-hidden="true" />
                  </span>
                </div>
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ================= 4. REVEAL FOOTER ================= */}
      <footer className="sut2-footer">
        <div className="sut2-footer-content">
          <section className="sut2-footer-col sut2-footer-brand">
            <img src={logo} alt="SUTH Logo" className="sut2-footer-logo" />
            <p>{t("sutlanding.footer_desc")}</p>
          </section>
          <section
            className="sut2-footer-col sut2-footer-contact"
            aria-labelledby="sut2-footer-contact-title"
          >
            <h2 id="sut2-footer-contact-title">{t("sutlanding.contact_us")}</h2>
            <p className="sut2-footer-organization">{t("sutlanding.pcu")}</p>
            <address>
              {t("sutlanding.address_1")}
              <br />
              {t("sutlanding.address_2")}
            </address>
            <div className="sut2-footer-links">
              <a href="tel:+6644376555">{t("sutlanding.tel1")}</a>
              <a href="tel:+6644376555">{t("sutlanding.tel2")}</a>
              <a href="https://www.suth.go.th" target="_blank" rel="noreferrer">
                {t("sutlanding.website")}
              </a>
            </div>
          </section>
        </div>
        <div className="sut2-footer-bottom">
          <p>{t("sutlanding.copyright", { year: copyrightYears })}</p>
          <nav className="sut2-footer-legal" aria-label={t("sutlanding.legal")}>
            <Link to="/terms">{t("sutlanding.terms")}</Link>
            <Link to="/privacy-policy">{t("sutlanding.privacy_policy")}</Link>
          </nav>
          {appVersion && (
            <span className="sut2-footer-version">v{appVersion}</span>
          )}
        </div>
      </footer>

      <FloatingActions />
    </div>
  );
}
