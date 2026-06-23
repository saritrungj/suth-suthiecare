import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FiClock, FiLogIn, FiChevronLeft, FiChevronRight, FiCheckCircle, FiShield, FiHeart, FiPhoneCall, FiArrowLeft, FiHelpCircle } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import "./SutLanding2.css";

import logo from "../../assets/logoSUTH.png";
import bgHealth from "../../assets/bg-health.jpg";
import bgClinic from "../../assets/bg-new.jpg";
import { formCache } from "../../services/cache";
import api, { getForms, getBanners, getActiveClinics } from "../../services/api";
import { translateTextSmart } from "../../utils/translator";

const SLIDE_INTERVAL = 6000;
const CARD_THEMES = ["sut2-card--blue", "sut2-card--pink", "sut2-card--green"];

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}



// ✅ FormCard ที่แก้ไขแล้ว
function FormCard({ form, themeClass, count, isLoaded }) {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const displayImage = form.image;

  const [displayTitle, setDisplayTitle] = useState(form.title || t('form_card.no_title'));
  const [displayDesc, setDisplayDesc] = useState(stripHtml(form.description || t('form_card.default_desc')));

  useEffect(() => {
    const title = form.title || t('form_card.no_title');
    const desc = stripHtml(form.description || t('form_card.default_desc'));

    if (i18n.language === 'en') {
      translateTextSmart(title).then(setDisplayTitle);
      translateTextSmart(desc).then(setDisplayDesc);
    } else {
      setDisplayTitle(title);
      setDisplayDesc(desc);
    }
  }, [i18n.language, form.title, form.description, t]);

  return (
    <article
      className={`sut2-card ${themeClass}`}
      onClick={() => navigate(`/assessment/${form.id}`)}
      role="button"
      tabIndex={0}
    >
      {/* ===== Band ด้านบน ===== */}
      <div className={`sut2-card__band ${displayImage ? "sut2-card__band--has-img" : ""}`}>
        {displayImage && (
          <img className="sut2-card__band-img" src={displayImage} alt={form.title} />
        )}
      </div>

      {/* ===== Body ตัวหนังสือ ===== */}
      <div className="sut2-card__body">
        <h3 className="sut2-card__title">{displayTitle}</h3>
        <p className="sut2-card__desc">{displayDesc}</p>
      </div>

      {/* ===== Count ด้านล่าง ===== */}
      <div className="sut2-card__count">
        {!isLoaded ? (
          <span className="sut2-card__count-text">{t('form_card.loading')}</span>
        ) : (
          <span className="sut2-card__count-text">
            {t('form_card.participants', { count: Number(count).toLocaleString() })}
          </span>
        )}
      </div>
    </article>
  );
}

export default function SutLanding2() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [forms, setForms] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [animatingClinic, setAnimatingClinic] = useState(null);
  const [animationStage, setAnimationStage] = useState("idle");

  const pollRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => { };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    getActiveClinics().then(res => {
      const sorted = (res.data.data || []).sort(
        (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999)
      );
      setClinics(sorted);
      setLoadingClinics(false);
    }).catch(err => {
      console.error("Failed to load clinics", err);
      setLoadingClinics(false);
    });

    // Load Banners
    getBanners().then(res => setSlides(res.data.map(b => ({ image: b.image, alt: b.filename, link: b.link }))));

    // Load Forms
    const cachedForms = formCache.get('forms');
    if (cachedForms) {
      setForms(cachedForms);
      setLoading(false);
      return;
    }

    getForms("lastOpened").then(res => {
      const activeForms = res.data.filter(f => {
        if (!f.status || f.status !== 'published') return false;
        const now = new Date();
        const start = f.publish_start_date ? new Date(f.publish_start_date) : null;
        const end = f.publish_end_date ? new Date(f.publish_end_date) : null;
        if (start && now < start) return false;
        if (end && now > end) return false;
        return true;
      });
      const reversed = [...activeForms].reverse();
      setForms(reversed);
      formCache.set('forms', reversed);
      setLoading(false);
    }).catch(() => {
      setForms([]);
      setLoading(false);
    });
  }, []);

  const filteredForms = useMemo(() =>
    selectedClinic
      ? forms.filter(f => (f.clinic_type || "general") === selectedClinic)
      : []
    , [selectedClinic, forms]);

  useEffect(() => {
    if (activeIdx >= filteredForms.length && filteredForms.length > 0) {
      setActiveIdx(0);
    }
  }, [filteredForms, activeIdx]);

  useEffect(() => {
    setActiveIdx(0);
    if (scrollContainerRef.current) {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [selectedClinic]);

  const handleNextForm = useCallback(() => {
    const maxLength = !selectedClinic ? clinics.length : filteredForms.length;
    if (activeIdx < maxLength - 1) {
      setActiveIdx(prev => prev + 1);
      if (scrollContainerRef.current) {
        const cardWidth = window.innerWidth <= 768 ? 280 : 340;
        scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }
  }, [activeIdx, filteredForms.length, selectedClinic, clinics.length]);

  const handlePrevForm = useCallback(() => {
    if (activeIdx > 0) {
      setActiveIdx(prev => prev - 1);
      if (scrollContainerRef.current) {
        const cardWidth = window.innerWidth <= 768 ? 280 : 340;
        scrollContainerRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    }
  }, [activeIdx]);

  useEffect(() => {
    if (!slides.length) return;
    const t = setInterval(() => setCurrentSlide(c => (c + 1) % slides.length), SLIDE_INTERVAL);
    return () => clearInterval(t);
  }, [slides]);

  const fetchAllCounts = useCallback(async (formList) => {
    if (!formList.length) return;
    try {
      const response = await api.post('/counts', {
        formIds: formList.map(f => f.id)
      });
      setCounts(response.data.data);
    } catch (err) { }
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
    const section = document.querySelector('.sut2-3d-section');
    if (section) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="sut2-page">

      {/* NAVBAR */}
      <nav className={`sut2-nav ${isScrolled ? "sut2-nav--scrolled" : ""}`}>
        <div className="sut2-nav__logo">
          <img src={logo} alt="SUTH Logo" />
        </div>
        <div className="sut2-nav__menu-btn" onClick={() => setMenuOpen(!menuOpen)}>☰</div>
        <div className={`sut2-nav__actions ${menuOpen ? "sut2-open" : ""}`}>
          <LanguageSwitcher darkText={isScrolled || menuOpen} />
          <button className="sut2-nav__btn sut2-nav__btn--history" onClick={() => navigate("/history")}>
            <FiClock /> <span>{t('nav.history')}</span>
          </button>
          <button className="sut2-nav__btn sut2-nav__btn--login" onClick={() => navigate("/admin/dashboard")}>
            <FiLogIn /> <span>{t('nav.staff')}</span>
          </button>
        </div>
      </nav>

      <div className="sut2-main-wrapper">

        {/* ================= 1. HERO SPLIT SECTION ================= */}
        <section className="sut2-hero">
          <div
            className="sut2-hero__bg"
            style={{
              backgroundImage: `url(${bgHealth})`,
              transform: `translateY(${scrollY * 0.4}px)`
            }}
          />
          <div className="sut2-hero__overlay"></div>

          <div className="sut2-hero__content">
            <div className="sut2-hero__text-box" style={{ transform: `translateY(${scrollY * -0.15}px)` }}>
              <h1 className="sut2-hero__title">
                {t('sutlanding.title')}<br />
                <span className="sut2-hero__highlight">{t('sutlanding.subtitle_highlight')}</span>
              </h1>
              <p className="sut2-hero__subtitle">
                {t('sutlanding.description')}
              </p>
              <div className="sut2-hero__cta-group">
                <button
                  className="sut2-hero__cta"
                  onClick={() => window.scrollTo({ top: window.innerHeight * 0.9, behavior: "smooth" })}>{t('sutlanding.btn_start')}
                </button>
                <button
                  className="sut2-hero__cta sut2-hero__cta--secondary"
                  onClick={() => document.getElementById("steps")?.scrollIntoView({ behavior: "smooth" })}>{t('sutlanding.btn_steps')}
                </button>
              </div>
            </div>

            {/* ===== Banner ==== */}
            <div className="sut2-hero__banner-box" style={{ transform: `translateY(${scrollY * 0.1}px)` }}>
              {slides.length > 0 ? (
                <div className="sut2-banner-slider">
                  {slides.map((slide, i) => (
                    slide.link ? (
                      <a
                        href={slide.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={i}
                        className={`sut2-banner-slide ${i === currentSlide ? 'active' : ''}`}
                        style={{ display: i === currentSlide ? 'block' : 'none' }}
                      >
                        <img src={slide.image} alt={slide.alt || 'banner'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </a>
                    ) : (
                      <img
                        key={i} src={slide.image} alt={slide.alt || 'banner'}
                        className={`sut2-banner-slide ${i === currentSlide ? 'active' : ''}`}
                      />
                    )))}
                  <div className="sut2-banner-dots">
                    {slides.map((_, i) => (
                      <button key={i} className={`sut2-banner-dot ${i === currentSlide ? 'active' : ''}`} onClick={() => setCurrentSlide(i)} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="sut2-banner-placeholder">
                  <FiHeart size={48} color="rgba(255,255,255,0.5)" />
                  <p>ห่วงใยทุกสุขภาพของคุณ</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================= 2. STACKED SLIDER SECTION ================= */}
        <section className="sut2-3d-section">
          <div className="sut2-3d-layout-container" ref={scrollContainerRef}>

            {/* ด้านซ้าย: Static Promo Card */}
            <div className="sut2-left-column">
              <div className={`sut2-promo-static-card ${isFlipped ? "promo-flip" : ""}`}>
                <div className="promo-inner">

                  {/* ด้านหน้า */}
                  <div className="promo-front">
                    <div className="sut2-promo-content">
                      <h2 className="sut2-promo-title">{t('sutlanding.select_clinic')}</h2>
                      <p className="sut2-promo-desc">{t('sutlanding.select_clinic_desc')}</p>
                    </div>
                  </div>

                  {/* ด้านหลัง (ตอน flip) */}
                  <div className="promo-back">
                    <div className="sut2-promo-content">
                      <h2 className="sut2-promo-title">{t('sutlanding.assessment_form')}</h2>
                      <p className="sut2-promo-desc">{t('sutlanding.assessment_form_desc')}</p>
                      {selectedClinic && (
                        <button
                          className="back-btn"
                          onClick={() => {
                            setSelectedClinic(null);
                            setActiveIdx(0);
                            setAnimationStage("idle");
                            setIsFlipped(false);
                          }}
                        >
                          <FiArrowLeft style={{ fontSize: '18px', flexShrink: 0 }} /> <span>{t('sutlanding.btn_back')}</span>
                        </button>
                      )}
                    </div>
                    {filteredForms.length > 0 && (
                      <div className="promo-back-forms">
                        {filteredForms.map((form, index) => (
                          <FormCard
                            key={form.id}
                            form={form}
                            themeClass={CARD_THEMES[index % CARD_THEMES.length]}
                            count={counts[form.id] || 0}
                            isLoaded={counts[form.id] !== undefined}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`sut2-dots-wrapper-left ${!selectedClinic ? 'show' : ''}`}>
                <div className="sut2-3d-dots">
                  {(!selectedClinic ? clinics : filteredForms).map((_, i) => (
                    <span
                      key={i}
                      className={`sut2-3d-dot ${activeIdx === i ? 'active' : ''}`}
                      onClick={() => setActiveIdx(i)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ด้านขวา */}
            <div className="sut2-3d-main-content">
              <div className={`sut2-stacked-viewport ${selectedClinic ? "is-form-mode" : ""} ${animationStage === "flip" ? "show-forms" : ""}`}>
                <div className="sut2-stacked-list" key={selectedClinic ? "forms" : "clinics"}>
                  {loading || loadingClinics ? (
                    <p style={{ textAlign: 'center', width: '100%', color: 'white' }}>{t('sutlanding.loading')}</p>
                  ) : !selectedClinic ? (
                    clinics.length === 0 ? (
                      <p style={{ textAlign: 'center', width: '100%', color: 'white' }}>{t('sutlanding.no_clinic')}</p>
                    ) : (
                      clinics.map((clinic, index) => {
                        const offset = index - activeIdx;
                        let statusClass = offset === 0 ? "active" : offset < 0 ? "exit" : offset < 3 ? "visible" : "hidden";

                        return (
                          <div
                            key={clinic.slug}
                            className={`sut2-stacked-item ${statusClass}`}
                            style={{ '--display-index': offset, zIndex: clinics.length - index }}
                            onClick={() => {
                              if (animatingClinic) return;
                              setAnimatingClinic(clinic.slug);
                              setAnimationStage("flying");

                              setTimeout(() => {
                                setAnimationStage("flip");
                                setSelectedClinic(clinic.slug);
                                setActiveIdx(0);
                                setIsFlipped(true);
                              }, 500);

                              setTimeout(() => {
                                setAnimatingClinic(null);
                                setAnimationStage("done");
                              }, 1100);
                            }}
                          >
                            <div
                              className={`clinic-card ${animatingClinic === clinic.slug && animationStage === "flying" ? 'clinic-fly' : ''}`}
                              style={{ backgroundImage: `url(${clinic.bg || bgClinic})` }}
                            >
                              {(clinic.show_icon === 1 || clinic.show_icon === undefined) && clinic.image && (
                                <div className="clinic-icon">
                                  <img src={clinic.image} alt={clinic.name} />
                                </div>
                              )}
                              <h3>{i18n.language === 'en' && clinic.name_en ? clinic.name_en : clinic.name}</h3>
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : filteredForms.length === 0 ? (
                    <p style={{ textAlign: 'center', width: '100%', color: 'white' }}>{t('sutlanding.no_form_in_clinic')}</p>
                  ) : (
                    filteredForms.map((form, index) => {
                      const offset = index - activeIdx;
                      let statusClass = offset === 0 ? "active" : offset < 0 ? "exit" : offset < 3 ? "visible" : "hidden";

                      return (
                        <div
                          key={form.id}
                          className={`sut2-stacked-item ${statusClass}`}
                          style={{ '--display-index': offset, zIndex: filteredForms.length - index }}
                        >
                          <FormCard
                            form={form}
                            themeClass={CARD_THEMES[index % CARD_THEMES.length]}
                            count={counts[form.id] || 0}
                            isLoaded={counts[form.id] !== undefined}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedClinic && (
                <div className="sut2-compact-controls">
                  <button className="sut2-control-btn" onClick={handlePrevForm} disabled={activeIdx === 0}><FiChevronLeft /></button>
                  <button className="sut2-control-btn" onClick={handleNextForm} disabled={activeIdx >= filteredForms.length - 1}><FiChevronRight /></button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ================= 3. HOW IT WORKS ================= */}
        <section id="steps" className="sut2-steps-section">
          <div
            className="sut2-steps__bg"
            style={{
              backgroundImage: `url(${bgClinic})`,
              transform: `translateY(${(scrollY - window.innerHeight) * 0.25}px)`
            }}
          />
          <div className="sut2-steps-overlay"></div>

          <div className="sut2-steps-content">
            <h2 className="sut2-steps-title">{t('sutlanding.steps_title')}</h2>
            <div className="sut2-steps-grid">
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiCheckCircle /></div>
                <h3>{t('sutlanding.step1_title')}</h3>
                <p>{t('sutlanding.step1_desc')}</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiShield /></div>
                <h3>{t('sutlanding.step2_title')}</h3>
                <p>{t('sutlanding.step2_desc')}</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiHeart /></div>
                <h3>{t('sutlanding.step3_title')}</h3>
                <p>{t('sutlanding.step3_desc')}</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiPhoneCall /></div>
                <h3>{t('sutlanding.step4_title')}</h3>
                <p>{t('sutlanding.step4_desc')}</p>
              </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '45px' }}>
              <a
                href={`${process.env.PUBLIC_URL}/docs/user_manual.pdf`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#ffffff',
                  textDecoration: 'underline',
                  fontSize: '15px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  opacity: 0.9,
                  transition: 'opacity 0.2s'
                }}
                onMouseOver={(e) => e.target.style.opacity = 1}
                onMouseOut={(e) => e.target.style.opacity = 0.9}
              >
                {t('sutlanding.download_manual')}
              </a>
            </div>

          </div>
        </section>

      </div>

      {/* ================= 4. REVEAL FOOTER ================= */}
      <footer className="sut2-footer">
        <div className="sut2-footer-content">
          <div className="sut2-footer-col">
            <img src={logo} alt="SUTH Logo" className="sut2-footer-logo" />
            <p>{t('sutlanding.footer_desc')}</p>
          </div>
          <div className="sut2-footer-col">
            <h4>{t('sutlanding.contact_us')}</h4>
            <p>{t('sutlanding.pcu')}</p>
            <p>{t('sutlanding.address_1')}<br />{t('sutlanding.address_2')}</p>
            <p>{t('sutlanding.tel1')}</p>
            <p>{t('sutlanding.tel2')}</p>
            <p>{t('sutlanding.website')}</p>
          </div>
        </div>
        <div className="sut2-footer-bottom">
          <p>{t('sutlanding.copyright', { year: new Date().getFullYear() })}</p>
        </div>
      </footer>

      <button
        className="sut2-floating-help-btn"
        onClick={() => navigate("/help-center")}
        title="ศูนย์ช่วยเหลือ"
      >
        <FiHelpCircle />
      </button>

    </div>
  );
}
