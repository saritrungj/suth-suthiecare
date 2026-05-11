import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { FiClock, FiLogIn, FiChevronLeft, FiChevronRight, FiCheckCircle, FiShield, FiHeart, FiPhoneCall,FiArrowLeft } from "react-icons/fi";
import "./SutLanding2.css";

import logo from "../../assets/logoSUTH.png";
import bgHealth from "../../assets/bg-health.jpg";
import bgClinic from "../../assets/bg-new.jpg";
import teenLogo from "../../assets/clinic-teen_3.png";
import stiLogo from "../../assets/clinic-sti.png";
import behaviorLogo from "../../assets/clinic-behavior.png";
import teenBg from "../../assets/clinic-teenager.jpg";
import stiBg from "../../assets/clinic-sti.jpg";
import behaviorBg from "../../assets/clinic-behavior.jpg";
import { formCache } from "../../services/cache";
import api, { getForms, getBanners } from "../../services/api";

const SLIDE_INTERVAL = 6000;
const CARD_THEMES = ["sut2-card--blue", "sut2-card--pink", "sut2-card--green"];
const CLINICS = [
  { id: "teenager", name: "คลินิกวัยรุ่น", image: teenLogo, bg: teenBg },
  { id: "sti", name: "คลินิกโรคติดต่อทางเพศสัมพันธ์", image: stiLogo, bg: stiBg },
  { id: "behavior", name: "คลินิกปรับเปลี่ยนพฤติกรรม", image: behaviorLogo, bg: behaviorBg },
];

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

function useImageType(src) {
  const [isBanner, setIsBanner] = useState(false);
  useEffect(() => {
    if (!src) return;
    const img = new Image();
    img.onload = () => setIsBanner(img.naturalWidth / img.naturalHeight >= 1.4);
    img.src = src;
  }, [src]);
  return isBanner;
}

// ✅ FormCard ที่แก้ไขแล้ว
function FormCard({ form, themeClass, count, isLoaded }) {
  const navigate = useNavigate();
  const displayImage = form.image;
  const isBanner = useImageType(displayImage);
  const plainDesc = stripHtml(form.description || "คลิกเพื่อประเมินความเสี่ยง");

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
      
     {/* {displayImage && isBanner && (
    <img className="sut2-card__band-img" src={displayImage} alt={form.title} />
  )} */}
        {/* มีรูปแต่ไม่ใช่ banner → แสดงรูปกลาง band */}
    {/*   {displayImage && !isBanner && (
          <div className="sut2-card__illust-inline">
            <img src={displayImage} alt="Form Cover" />
          </div>
        )}
     */}
        {/* ไม่มีรูป → แสดงแค่สี gradient จาก theme (ไม่มี element เพิ่ม) */}
       
   {/*   </div>  */}

      {/* ===== Body ตัวหนังสือ ===== */}
      <div className="sut2-card__body">
        <h3 className="sut2-card__title">{form.title || "ไม่มีชื่อฟอร์ม"}</h3>
        <p className="sut2-card__desc">{plainDesc}</p>
      </div>

      {/* ===== Count ด้านล่าง ===== */}
      <div className="sut2-card__count">
        {!isLoaded ? (
          <span className="sut2-card__count-text">กำลังโหลด...</span>
        ) : (
          <span className="sut2-card__count-text">
            ผู้เข้ารับการประเมิน <strong>{Number(count).toLocaleString()}</strong> คน
          </span>
        )}
      </div>
    </article>
  );
}

export default function SutLanding2() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const [forms, setForms] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeIdx, setActiveIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [animatingClinic, setAnimatingClinic] = useState(null);
  const [animationStage, setAnimationStage] = useState("idle");

  const pollRef = useRef(null);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {};
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
    getBanners().then(res => setSlides(res.data.map(b => ({ image: b.image, alt: b.filename }))));

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
      setForms([...activeForms].reverse());
      formCache.set('forms', [...activeForms].reverse());
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
    const maxLength = !selectedClinic ? CLINICS.length : filteredForms.length;
    if (activeIdx < maxLength - 1) {
      setActiveIdx(prev => prev + 1);
      if (scrollContainerRef.current) {
        const cardWidth = window.innerWidth <= 768 ? 280 : 340;
        scrollContainerRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }
  }, [activeIdx, filteredForms.length, selectedClinic]);

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
          <button className="sut2-nav__btn sut2-nav__btn--history" onClick={() => navigate("/history")}>
            <FiClock /> <span>ตรวจสอบประวัติ</span>
          </button>
          <button className="sut2-nav__btn sut2-nav__btn--login" onClick={() => navigate("/admin/dashboard")}>
            <FiLogIn /> <span>สำหรับเจ้าหน้าที่</span>
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
                แบบลงทะเบียน<br />
                <span className="sut2-hero__highlight">ขอเข้ารับคำปรึกษาปัญหาสุขภาพ</span>
              </h1>
              <p className="sut2-hero__subtitle">
                ศูนย์รวมการลงทะเบียนขอรับคำปรึกษาทางคลินิก<br />
                โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี
              </p>
              <div className="sut2-hero__cta-group">
                <button
                  className="sut2-hero__cta"
                  onClick={() => window.scrollTo({ top: window.innerHeight * 0.9, behavior: "smooth" })}>เริ่มต้นรับบริการ
                </button>
                <button
                  className="sut2-hero__cta sut2-hero__cta--secondary"
                  onClick={() => document.getElementById("steps")?.scrollIntoView({ behavior: "smooth" })}>ขั้นตอนการรับบริการ
                </button>
              </div>
            </div>

            {/* ===== Banner ==== */}
            <div className="sut2-hero__banner-box" style={{ transform: `translateY(${scrollY * 0.1}px)` }}>
              {slides.length > 0 ? (
                <div className="sut2-banner-slider">
                  {slides.map((slide, i) => (
                    <img
                      key={i} src={slide.image} alt={slide.alt || 'banner'}
                      className={`sut2-banner-slide ${i === currentSlide ? 'active' : ''}`}
                    />
                  ))}
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
                      <h2 className="sut2-promo-title">เลือกคลินิก</h2>
                      <p className="sut2-promo-desc">กรุณาเลือกคลินิกก่อน</p>
                    </div>
                  </div>

                  {/* ด้านหลัง (ตอน flip) */}
                  <div className="promo-back">
                    <div className="sut2-promo-content">
                      <h2 className="sut2-promo-title">แบบประเมิน</h2>
                      <p className="sut2-promo-desc">เลือกแบบประเมินที่ต้องการ</p>
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
                          <FiArrowLeft style={{ fontSize: '18px', flexShrink: 0 }} /> <span>ย้อนกลับ</span>
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
                  {(!selectedClinic ? CLINICS : filteredForms).map((_, i) => (
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
                  {loading ? (
                    <p style={{ textAlign: 'center', width: '100%', color: 'white' }}>กำลังโหลดข้อมูล...</p>
                  ) : !selectedClinic ? (
                    CLINICS.map((clinic, index) => {
                      const offset = index - activeIdx;
                      let statusClass = offset === 0 ? "active" : offset < 0 ? "exit" : offset < 3 ? "visible" : "hidden";

                      return (
                        <div
                          key={clinic.id}
                          className={`sut2-stacked-item ${statusClass}`}
                          style={{ '--display-index': offset, zIndex: CLINICS.length - index }}
                          onClick={() => {
                            if (animatingClinic) return;
                            setAnimatingClinic(clinic.id);
                            setAnimationStage("flying");

                            setTimeout(() => {
                              setAnimationStage("flip");
                              setSelectedClinic(clinic.id);
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
                            className={`clinic-card ${animatingClinic === clinic.id && animationStage === "flying" ? 'clinic-fly' : ''}`}
                            style={{ backgroundImage: `url(${clinic.bg})` }}
                          >
                            <div className="clinic-icon">
                              <img src={clinic.image} alt={clinic.name} />
                            </div>
                            <h3>{clinic.name}</h3>
                          </div>
                        </div>
                      );
                    })
                  ) : filteredForms.length === 0 ? (
                    <p style={{ textAlign: 'center', width: '100%', color: 'white' }}>ไม่มีแบบประเมินในคลินิกนี้</p>
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
            <h2 className="sut2-steps-title">ขั้นตอนการรับบริการง่ายๆ</h2>
            <div className="sut2-steps-grid">
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiCheckCircle /></div>
                <h3>1. เลือกแบบประเมิน</h3>
                <p>ค้นหาแบบฟอร์มที่ตรงกับอาการของคุณจากเมนูด้านบน</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiShield /></div>
                <h3>2. กรอกข้อมูล</h3>
                <p>ตอบคำถามตามความเป็นจริง ข้อมูลของคุณจะถูกเก็บเป็นความลับ</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiHeart /></div>
                <h3>3. ผลลัพธ์การประเมิน</h3>
                <p>ระบบจะวิเคราะห์ข้อมูลของคุณและแสดงผลการประเมินพร้อมคำแนะนำเบื้องต้น</p>
              </div>
              <div className="sut2-step-glass">
                <div className="sut2-step-icon"><FiPhoneCall /></div>
                <h3>4. รอเจ้าหน้าที่ติดต่อกลับ</h3>
                <p>ทีมงานจะตรวจสอบข้อมูลของคุณและติดต่อกลับเพื่อให้คำแนะนำเพิ่มเติมโดยเร็วที่สุด</p>
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
                ดาวน์โหลดคู่มือการใช้งานระบบ (PDF)
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
            <p>ศูนย์รวมการลงทะเบียนขอรับคำปรึกษาทางคลินิก โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี</p>
          </div>
          <div className="sut2-footer-col">
            <h4>ติดต่อเรา</h4>
            <p>111 ถ.มหาวิทยาลัย ต.สุรนารี<br />อ.เมือง จ.นครราชสีมา 30000</p>
            <p>โทรศัพท์: 044-376555</p>
            <p>เว็บไซต์: www.suth.go.th</p>
          </div>
        </div>
        <div className="sut2-footer-bottom">
          <p>© {new Date().getFullYear()} โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี สงวนลิขสิทธิ์</p>
        </div>
      </footer>

    </div>
  );
}