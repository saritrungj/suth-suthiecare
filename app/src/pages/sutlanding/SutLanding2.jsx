import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FiArrowDown,
  FiClipboard,
  FiDownload,
  FiEdit3,
  FiExternalLink,
  FiGrid,
  FiHome,
  FiLock,
  FiMenu,
  FiPhoneCall,
  FiSmartphone,
  FiSmile,
  FiX,
  FiZap,
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
import peeHom from "../../assets/pee-hom-ai.webp";
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

function scrollToId(id) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

// Four-point twinkle used as decoration around the hero.
function Sparkle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 0c.9 6.6 4.5 10.6 12 12-7.5 1.4-11.1 5.4-12 12-.9-6.6-4.5-10.6-12-12C7.5 10.6 11.1 6.6 12 0Z" />
    </svg>
  );
}

export default function SutLanding2() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
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

  const stepItems = [
    { icon: FiClipboard, tone: "orange" },
    { icon: FiEdit3, tone: "teal" },
    { icon: FiSmile, tone: "blue" },
    { icon: FiPhoneCall, tone: "amber" },
  ];

  return (
    <div className="sut2-page">
      {/* NAVBAR */}
      <nav className={`sut2-nav ${isScrolled ? "sut2-nav--scrolled" : ""}`}>
        <div className="sut2-nav__bar">
          <Link to="/" className="sut2-nav__logo" aria-label="SUTHie Care">
            <img src={logo} alt="SUTH Logo" />
          </Link>
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
            <LanguageSwitcher className="sut2-nav__language" darkText />
            <PatientAccountMenu
              onNavigate={() => setMenuOpen(false)}
              stackOnMobile
            />
          </div>
        </div>
      </nav>

      <main className="sut2-main-wrapper">
        {/* ================= 1. HERO ================= */}
        <section className="sut2-hero" aria-labelledby="sut2-hero-title">
          <span className="sut2-hero__blob sut2-hero__blob--a" aria-hidden="true" />
          <span className="sut2-hero__blob sut2-hero__blob--b" aria-hidden="true" />
          <Sparkle className="sut2-sparkle sut2-sparkle--1" />
          <Sparkle className="sut2-sparkle sut2-sparkle--2" />
          <Sparkle className="sut2-sparkle sut2-sparkle--3" />

          <div className="sut2-hero__content">
            <div className="sut2-hero__text-box">
              <h1 id="sut2-hero-title" className="sut2-hero__title">
                {t("sutlanding.title")}
                <span className="sut2-hero__highlight">
                  {t("sutlanding.subtitle_highlight")}
                </span>
              </h1>
              <p className="sut2-hero__subtitle">
                {t("sutlanding.description")}
              </p>
              <div className="sut2-hero__cta-group">
                <button
                  type="button"
                  className="sut2-hero__cta"
                  onClick={() => scrollToId("services")}
                >
                  {t("sutlanding.btn_start")}
                  <FiArrowDown aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="sut2-hero__cta sut2-hero__cta--secondary"
                  onClick={() => scrollToId("steps")}
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
                      <FiHome aria-hidden="true" />
                      <strong>{organizationCount}</strong>
                      {t("sutlanding.stat_orgs")}
                    </li>
                  )}
                  <li>
                    <FiGrid aria-hidden="true" />
                    <strong>{clinics.length}</strong>
                    {t("sutlanding.stat_clinics")}
                  </li>
                  {!loading && (
                    <li>
                      <FiClipboard aria-hidden="true" />
                      <strong>{forms.length}</strong>
                      {t("sutlanding.stat_forms")}
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Pee Hom with the promises she makes, as floating stickers */}
            <div className="sut2-mascot" aria-hidden="true">
              <p className="sut2-mascot__bubble">
                {t("sutlanding.hero_greeting")}
              </p>
              <div className="sut2-mascot__stage">
                <span className="sut2-mascot__ring" />
                <img
                  className="sut2-mascot__img"
                  src={peeHom}
                  alt=""
                  width="256"
                  height="256"
                />
              </div>
              <span className="sut2-chip sut2-chip--1">
                <FiZap /> {t("sutlanding.chip_instant")}
              </span>
              <span className="sut2-chip sut2-chip--2">
                <FiLock /> {t("sutlanding.chip_private")}
              </span>
              <span className="sut2-chip sut2-chip--3">
                <FiSmartphone /> {t("sutlanding.chip_anywhere")}
              </span>
            </div>
          </div>
        </section>

        {/* ================= 2. ORGANIZATION / CLINIC / FORM PICKER ================= */}
        <section
          id="services"
          ref={pickerSectionRef}
          className="sut2-picker-section"
          aria-label={t("clinic_picker.title")}
        >
          <ClinicFormPicker
            clinics={clinics}
            forms={forms}
            counts={counts}
            loading={loading || loadingClinics}
          />
        </section>

        {/* ================= 3. NEWS BANNERS ================= */}
        {slides.length > 0 && (
          <section
            className="sut2-news"
            aria-labelledby="sut2-news-title"
          >
            <h2 id="sut2-news-title" className="sut2-section-title">
              {t("sutlanding.news_title")}
            </h2>
            <div className="sut2-banner-slider">
              {slides.map((slide, i) => {
                const image = (
                  <img
                    src={slide.image}
                    alt={slide.alt || t("sutlanding.news_title")}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                );
                const className = `sut2-banner-slide ${i === currentSlide ? "active" : ""}`;
                return slide.link ? (
                  <a
                    key={i}
                    href={slide.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                    aria-hidden={i !== currentSlide}
                    tabIndex={i === currentSlide ? 0 : -1}
                  >
                    {image}
                  </a>
                ) : (
                  <div
                    key={i}
                    className={className}
                    aria-hidden={i !== currentSlide}
                  >
                    {image}
                  </div>
                );
              })}
              {slides.length > 1 && (
                <div className="sut2-banner-dots">
                  {slides.map((_, i) => (
                    <button
                      type="button"
                      key={i}
                      className={`sut2-banner-dot ${i === currentSlide ? "active" : ""}`}
                      aria-label={`${i + 1} / ${slides.length}`}
                      aria-current={i === currentSlide}
                      onClick={() => setCurrentSlide(i)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* ================= 4. HOW IT WORKS ================= */}
        <section
          id="steps"
          className="sut2-steps-section"
          aria-labelledby="sut2-steps-title"
        >
          <h2 id="sut2-steps-title" className="sut2-section-title">
            {t("sutlanding.steps_title")}
          </h2>
          <ol className="sut2-steps">
            {stepItems.map(({ icon: Icon, tone }, index) => (
              <li key={tone} className={`sut2-step sut2-step--${tone}`}>
                <span className="sut2-step__icon" aria-hidden="true">
                  <Icon />
                  <span className="sut2-step__num">{index + 1}</span>
                </span>
                <h3>{t(`sutlanding.step${index + 1}_title`)}</h3>
                <p>{t(`sutlanding.step${index + 1}_desc`)}</p>
              </li>
            ))}
          </ol>
          <a
            className="sut2-manual-link"
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
          >
            <FiDownload aria-hidden="true" />
            {t("sutlanding.download_manual")}
          </a>
        </section>

        {/* ================= 5. OUR OTHER WEBSITES ================= */}
        <section
          className="sut2-sites-section"
          aria-labelledby="sut2-sites-title"
        >
          <h2 id="sut2-sites-title" className="sut2-section-title">
            {t("sutlanding.sites_title")}
          </h2>
          <div className="sut2-sites-grid">
            {[
              {
                href: "https://vitalcare.suth.go.th",
                image: siteVitalcare,
                alt: "SUTH Vitalcare",
                key: "vitalcare",
              },
              {
                href: "https://act.suth.go.th/",
                image: siteAct,
                alt: "SUTH Activities",
                key: "act",
              },
            ].map((site) => (
              <a
                key={site.key}
                href={site.href}
                target="_blank"
                rel="noopener noreferrer"
                className="sut2-site-card"
              >
                <img
                  className="sut2-site-banner"
                  src={site.image}
                  alt={site.alt}
                  loading="lazy"
                  decoding="async"
                />
                <div className="sut2-site-body">
                  <h3 className="sut2-site-name">
                    {t(`sutlanding.sites_${site.key}_name`)}
                  </h3>
                  <p className="sut2-site-desc">
                    {t(`sutlanding.sites_${site.key}_desc`)}
                  </p>
                  <span className="sut2-site-link">
                    {t("sutlanding.sites_visit")}
                    <FiExternalLink aria-hidden="true" />
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </main>

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
