import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
<<<<<<< Updated upstream
import { FiCheckCircle, FiActivity, FiInfo, FiCheck, FiSend, FiClock } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { translateTextSmart } from "../../utils/translator";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
=======
import {
  FiCheckCircle,
  FiActivity,
  FiInfo,
  FiCheck,
  FiSend,
  FiClock,
} from "react-icons/fi";
>>>>>>> Stashed changes
import riskLow from "../../assets/01.png";
import riskMedium from "../../assets/02.png";
import riskHigh from "../../assets/03.png";
import logoSUTH from "../../assets/logoSUTH.png";
import "./AssessmentResult.css";

// 🟢 1. แก้บัค: นำเข้า api ให้ถูกต้อง
import api, { submitFormAnswers } from "../../services/api";
import Swal from "sweetalert2";

// 🟢 ฟังก์ชันผู้ช่วย: แปลงสี HEX เป็น RGB
const hexToRgbArray = (hex) => {
  if (!hex.startsWith("#")) hex = "#" + hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
};

// 🟢 ฟังก์ชันผู้ช่วย: ตรวจสอบว่าสีที่ส่งมา "สว่างเกินไป" หรือไม่
const isColorTooBright = (hex) => {
  const [r, g, b] = hexToRgbArray(hex);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 190;
};

// 🟢 ฟังก์ชันสร้าง Config การ์ดแบบไดนามิก + เลือกรูปภาพ + จัดการ Contrast สี
const getLevelConfig = (result, t) => {
  if (!result) {
    return {
      title: t ? t('assessment_result.score') : "ผลการประเมิน",
      score: 0,
      label: t ? t('assessment_result.send_success') : "บันทึกสำเร็จ",
      advice: [t ? t('assessment_result.advice') : "ไม่มีคำแนะนำเพิ่มเติมในขณะนี้"],
      color: "#2d7d81",
      textColor: "#2d7d81",
      rgb: "45, 125, 129",
      colorBg: "rgba(45, 125, 129, 0.08)",
      colorBorder: "rgba(45, 125, 129, 0.25)",
      colorBanner:
        "linear-gradient(135deg, rgba(45, 125, 129, 0.7) 0%, rgba(45, 125, 129, 1) 100%)",
      visualImage: riskLow,
    };
  }

  const hexCriteriaColor = result.color || "#2d7d81";
  const rgbString = hexToRgbArray(hexCriteriaColor).join(", ");
  const lowerColor = hexCriteriaColor.toLowerCase();

  const isTooBright = isColorTooBright(hexCriteriaColor);
  const readableTextColor = isTooBright ? "#2d7d81" : hexCriteriaColor;

  let visualImage = riskLow;
  if (
    lowerColor.includes("d93025") ||
    lowerColor.includes("e53935") ||
    lowerColor.includes("f44336") ||
    lowerColor.includes("ef4444") ||
    lowerColor.includes("d32f2f")
  ) {
    visualImage = riskHigh;
  } else if (
    lowerColor.includes("fbbc04") ||
    lowerColor.includes("ff9800") ||
    lowerColor.includes("ffb300") ||
    lowerColor.includes("f59e0b") ||
    lowerColor.includes("f57c00")
  ) {
    visualImage = riskMedium;
  }

  const rgbColor = hexToRgbArray(hexCriteriaColor);

  return {
    title: result.title || "ผลการประเมิน",
    score: result.score,
    label: result.label || "ประเมินเสร็จสิ้น",
<<<<<<< Updated upstream
    advice: result.advice ? (Array.isArray(result.advice) ? result.advice : result.advice.split('\n')) : [t ? t('assessment_result.advice') : "ไม่มีคำแนะนำเพิ่มเติมในขณะนี้"],
=======
    advice: result.advice
      ? Array.isArray(result.advice)
        ? result.advice
        : result.advice.split("\n")
      : ["ไม่มีคำแนะนำเพิ่มเติมในขณะนี้"],
>>>>>>> Stashed changes
    color: hexCriteriaColor,
    textColor: readableTextColor,
    rgb: rgbColor.join(", "),
    colorBg: `rgba(${rgbString}, 0.08)`,
    colorBorder: `rgba(${rgbString}, 0.25)`,
    colorBanner: `linear-gradient(135deg, rgba(${rgbString}, 0.7) 0%, rgba(${rgbString}, 1) 100%)`,
    visualImage: visualImage,
  };
};

export default function AssessmentResult() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  // 🟢 รับ Payload ที่ถูกส่งมาจาก FormView
  const results = location.state?.results || [];
  const formId = location.state?.formId;
  const payload = location.state?.payload;
  const hasBooking = location.state?.hasBooking;

  // 🟢 State ควบคุมสถานะการส่งข้อมูล
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [translatedResults, setTranslatedResults] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const translateResults = async () => {
      if (results.length === 0) return;
      if (i18n.language !== 'en') {
        if (isMounted) setTranslatedResults(results);
        return;
      }
      
      const trs = await Promise.all(results.map(async (res) => {
        const tTitle = res.title ? await translateTextSmart(res.title) : res.title;
        const tLabel = res.label ? await translateTextSmart(res.label) : res.label;
        const tAdvice = res.advice ? await translateTextSmart(res.advice) : res.advice;
        return { ...res, title: tTitle, label: tLabel, advice: tAdvice };
      }));
      
      if (isMounted) setTranslatedResults(trs);
    };
    translateResults();
    return () => { isMounted = false; };
  }, [results, i18n.language]);

  useEffect(() => {
    window.scrollTo(0, 0);
    // ถ้าไม่มี formId (เช่น ผู้ใช้เข้าหน้านี้โดยตรงผ่าน URL) ให้เด้งกลับหน้าแรก
    if (!formId) {
      navigate("/");
    }
  }, [navigate, formId]);

  // 🟢 ฟังก์ชันจัดการการยิง API
  const handleSendToStaff = () => {
    if (!formId || !payload) {
<<<<<<< Updated upstream
      Swal.fire(t('assessment_result.error_title'), t('assessment_result.error_desc'), 'error');
=======
      Swal.fire(
        "ข้อผิดพลาด",
        "ไม่พบข้อมูลสำหรับการส่ง กรุณาทำแบบประเมินใหม่อีกครั้ง",
        "error",
      );
>>>>>>> Stashed changes
      return;
    }

    Swal.fire({
<<<<<<< Updated upstream
      title: t('assessment_result.consent_title'),
      html: t('assessment_result.consent_html'),
      icon: 'question',
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: t('assessment_result.agree'),
      cancelButtonText: t('assessment_result.decline'),
      width: '500px',
      padding: '2.5em',
      background: '#ffffff',
      borderRadius: '20px'
=======
      title: "คุณยินยอมให้เจ้าหน้าที่ติดต่อกลับหรือไม่?",
      html: `ข้อมูลของท่านจะถูกเก็บเป็นความลับ
         และส่งต่อให้เจ้าหน้าที่ที่เกี่ยวข้องเท่านั้น
         เพื่อการดูแลและให้คำแนะนำเบื้องต้น`,
      icon: "question",
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "ยินยอม",
      cancelButtonText: "ปฏิเสธ",
      width: "500px",
      padding: "2.5em",
      background: "#ffffff",
      borderRadius: "20px",
>>>>>>> Stashed changes
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSubmitting(true);

        Swal.fire({
<<<<<<< Updated upstream
          title: t('assessment_result.sending'),
          text: t('assessment_result.please_wait'),
=======
          title: "กำลังส่งข้อมูล...",
          text: "กรุณารอสักครู่",
>>>>>>> Stashed changes
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        try {
          await submitFormAnswers(formId, payload);
          setIsSaved(true);
          Swal.fire({
<<<<<<< Updated upstream
            icon: 'success',
            title: t('assessment_result.send_success'),
            text: t('assessment_result.send_success_desc'),
            confirmButtonColor: '#10b981'
=======
            icon: "success",
            title: "ส่งข้อมูลสำเร็จ!",
            text: "เจ้าหน้าที่ได้รับข้อมูลของท่านแล้ว ท่านสามารถตรวจสอบประวัติได้",
            confirmButtonColor: "#10b981",
>>>>>>> Stashed changes
          });
        } catch (error) {
          console.error("Submit Error:", error);
          Swal.fire({
<<<<<<< Updated upstream
            icon: 'error',
            title: t('assessment_result.send_error'),
            text: t('assessment_result.send_error_desc'),
            confirmButtonColor: '#ef4444'
=======
            icon: "error",
            title: "ไม่สามารถส่งข้อมูลได้",
            text: "เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง",
            confirmButtonColor: "#ef4444",
>>>>>>> Stashed changes
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const [hasEvaluated, setHasEvaluated] = useState(false);
  useEffect(() => {
    const status = sessionStorage.getItem("eval_done");
    if (status === "true") {
      setHasEvaluated(true);
    }
  }, []);
  const handleOpenEvaluation = () => {
    if (hasEvaluated) {
      Swal.fire({
<<<<<<< Updated upstream
        title: t('assessment_result.eval_thanks_title'),
        text: t('assessment_result.eval_thanks_desc'),
        icon: 'success',
        confirmButtonText: t('assessment_result.ok'),
        confirmButtonColor: '#7c3aed'
=======
        title: "ขอบคุณสำหรับคำแนะนำ",
        text: "คุณได้ตอบแบบประเมินการใช้งานระบบเรียบร้อยแล้ว",
        icon: "success",
        confirmButtonText: "ตกลง",
        confirmButtonColor: "#7c3aed",
>>>>>>> Stashed changes
      });
      return;
    }
    const renderScale = (name) => `
      <div style="display:flex; justify-content:space-between; margin-top:10px">
        ${[1, 2, 3, 4, 5]
          .map(
            (v) => `
          <label style="text-align:center; flex:1; cursor:pointer display:flex; flex-direction:column; align-items:center; gap:6px;">
            <input type="radio" name="${name}" value="${v}" style="margin:0"/>
            <div style="font-size:12px font-weight:600; color:#475569;">${v}</div>
          </label>
        `,
          )
          .join("")}
      </div>
      <div class="evaluation-labels-wrap">
        <span>${t('assessment_result.eval_min')}</span>
        <span>${t('assessment_result.eval_max')}</span>
      </div>
    `;

    const renderQuestionBox = (index, text, name) => `
      <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px; box-shadow:0 2px 6px rgba(0,0,0,0.05)">
        <p style="font-weight:600">${index}. ${text}</p>
        ${renderScale(name)}
      </div>
    `;

    const renderSUS = () => {
      const questions = [
<<<<<<< Updated upstream
        t('assessment_result.eval_sus1'),
        t('assessment_result.eval_sus2'),
        t('assessment_result.eval_sus3'),
        t('assessment_result.eval_sus4'),
        t('assessment_result.eval_sus5'),
        t('assessment_result.eval_sus6'),
        t('assessment_result.eval_sus7'),
        t('assessment_result.eval_sus8'),
        t('assessment_result.eval_sus9'),
        t('assessment_result.eval_sus10')
=======
        "คุณอยากใช้แอปพลิเคชันนี้บ่อย ๆ",
        "คุณคิดว่าระบบไม่ควรซับซ้อนขนาดนี้",
        "คุณคิดว่าระบบใช้งานง่าย",
        "คุณคิดว่าคุณต้องการความช่วยเหลือจากผู้เชี่ยวชาญเพื่อที่จะใช้งานระบบนี้ได้",
        "คุณพบว่ามีหลายฟังก์ชันที่ทำงานได้ดี",
        "คุณคิดว่าระบบไม่ค่อยมีความสม่ำเสมอ",
        "คุณคิดว่าคนอื่นๆ น่าจะเข้าใจวิธีใช้ระบบนี้ได้เร็วเหมือนกัน",
        "คุณพบว่าการใช้งานระบบนี้ยุ่งยาก/ซับซ้อนมากๆ",
        "คุณรู้สึกมั่นใจตอนใช้งาน",
        "คุณต้องการฝึกใช้งานก่อนถึงจะเริ่มใช้งานระบบนี้ได้",
>>>>>>> Stashed changes
      ];

      return questions
        .map(
          (q, i) => `
        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px; box-shadow:0 2px 6px rgba(0,0,0,0.05)">
          <p style="font-weight:600">${i + 1}. ${q}</p>
          ${renderScale(`sus${i + 1}`)}
        </div>
      `,
        )
        .join("");
    };

    Swal.fire({
<<<<<<< Updated upstream
      title: t('assessment_result.eval_modal_title'),
      width: window.innerWidth < 768 ? '95%' : 700,
=======
      title: " แบบประเมินการใช้งานระบบ",
      width: window.innerWidth < 768 ? "95%" : 700,
>>>>>>> Stashed changes
      showCloseButton: true,
      closeButtonHtml: "✕",
      html: `
        <div style="text-align:left; max-height:450px; overflow:auto overflow-x:hidden;">
         
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:15px; border-top:6px solid #7c3aed; box-shadow:0 4px 12px rgba(0,0,0,0.06)">
            <h3 style="margin-bottom:15px"> ${t('assessment_result.eval_part1')}</h3>
            ${renderQuestionBox(1, t('assessment_result.eval_q1'), "q1")}
            ${renderQuestionBox(2, t('assessment_result.eval_q2'), "q2")}
            ${renderQuestionBox(3, t('assessment_result.eval_q3'), "q3")}
            ${renderQuestionBox(4, t('assessment_result.eval_q4'), "q4")}
            ${renderQuestionBox(5, t('assessment_result.eval_q5'), "q5")}
          </div>

          <div style="background:#fff; border-radius:12px; padding:20px; border-top:6px solid #6366f1; box-shadow:0 4px 12px rgba(0,0,0,0.06)">
            <h3 style="margin-bottom:15px"> ${t('assessment_result.eval_part2')}</h3>
            ${renderSUS()}
          </div>

          <div style="margin-top:20px; background:#fff; border-radius:12px; padding:20px; border-top:6px solid #10b981; box-shadow:0 4px 12px rgba(0,0,0,0.06)">
            <p><b> ${t('assessment_result.eval_comment')}</b></p>
            <textarea id="comment" class="swal2-textarea" placeholder="${t('assessment_result.eval_placeholder')}" style="height:80px; width: 250px; font-size:14px; padding:10px; margin-right:10px; border-radius:10px; box-sizing: border-box;"></textarea>
          </div>
        </div>
      `,
<<<<<<< Updated upstream
      confirmButtonText: t('assessment_result.eval_submit'),
      confirmButtonColor: '#7c3aed',
=======
      confirmButtonText: "ส่งแบบประเมิน",
      confirmButtonColor: "#7c3aed",
>>>>>>> Stashed changes
      preConfirm: () => {
        const getRadio = (name) => {
          const el = document.querySelector(`input[name="${name}"]:checked`);
          return el ? el.value : null;
        };
        // 1. ตรวจสอบส่วนที่ 1: ความพึงพอใจ (q1 - q5)
        for (let i = 1; i <= 5; i++) {
          if (!getRadio(`q${i}`)) {
<<<<<<< Updated upstream
            Swal.showValidationMessage(i18n.language === 'en' ? `Please complete part 1 question ${i}` : `กรุณาตอบส่วนที่ 1 ข้อที่ ${i} ให้ครบถ้วน`);
            document.getElementsByName(`q${i}`)[0]?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
=======
            Swal.showValidationMessage(
              `กรุณาตอบส่วนที่ 1 ข้อที่ ${i} ให้ครบถ้วน`,
            );
            document
              .getElementsByName(`q${i}`)[0]
              ?.closest("div")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
>>>>>>> Stashed changes
            return false;
          }
        }

        // 2. ตรวจสอบส่วนที่ 2: SUS (sus1 - sus10)
        let susAnswers = [];
        for (let i = 1; i <= 10; i++) {
          const val = getRadio(`sus${i}`);
          if (!val) {
<<<<<<< Updated upstream
            Swal.showValidationMessage(i18n.language === 'en' ? `Please complete part 2 (SUS) question ${i}` : `กรุณาตอบส่วนที่ 2 (SUS) ข้อที่ ${i} ให้ครบถ้วน`);
            document.getElementsByName(`sus${i}`)[0]?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
=======
            Swal.showValidationMessage(
              `กรุณาตอบส่วนที่ 2 (SUS) ข้อที่ ${i} ให้ครบถ้วน`,
            );
            document
              .getElementsByName(`sus${i}`)[0]
              ?.closest("div")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
>>>>>>> Stashed changes
            return false;
          }
          susAnswers.push(Number(val));
        }

        const comment = document.getElementById("comment").value;

        // คืนค่าข้อมูลทั้งหมดเมื่อกรอกครบแล้ว (ยกเว้น comment ที่เป็น optional)
        return {
          q1: getRadio("q1"),
          q2: getRadio("q2"),
          q3: getRadio("q3"),
          q4: getRadio("q4"),
          q5: getRadio("q5"),
          comment,
          susAnswers,
        };
      },
    }).then(async (result) => {
      // 🟢 3. เพิ่ม async และยิง API ตรงนี้เลย
      if (result.isConfirmed) {
        const { q1, q2, q3, q4, q5, comment, susAnswers } = result.value;

        // คำนวณคะแนน SUS
        let score = 0;
        susAnswers.forEach((val, i) => {
          score += i % 2 === 0 ? val - 1 : 5 - val;
        });
        const susScore = score * 2.5;

        // จัดเตรียมข้อมูลส่ง API
        const payloadData = {
          sat_ui: Number(q1),
          sat_speed: Number(q2),
          sat_content: Number(q3),
          sat_access: Number(q4),
          sat_overall: Number(q5),
          sus1: susAnswers[0],
          sus2: susAnswers[1],
          sus3: susAnswers[2],
          sus4: susAnswers[3],
          sus5: susAnswers[4],
          sus6: susAnswers[5],
          sus7: susAnswers[6],
          sus8: susAnswers[7],
          sus9: susAnswers[8],
          sus10: susAnswers[9],
          sus_total_score: susScore,
          suggestions: comment,
        };

        try {
          Swal.fire({
<<<<<<< Updated upstream
            title: t('assessment_result.saving'),
=======
            title: "กำลังบันทึกข้อมูล...",
>>>>>>> Stashed changes
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          // ยิง API
          await api.post("/submit-system-feedback", payloadData);

          // บันทึกสถานะลงเครื่องผู้ใช้ทันที
          sessionStorage.setItem("eval_done", "true");
          setHasEvaluated(true);

          Swal.fire({
<<<<<<< Updated upstream
            icon: 'success',
            title: t('assessment_result.eval_success_title'),
=======
            icon: "success",
            title: "ส่งสำเร็จ",
>>>>>>> Stashed changes
            html: `
              <p>${t('assessment_result.eval_success_desc')}</p>
            `,
            confirmButtonColor: "#10b981",
          });
        } catch (error) {
<<<<<<< Updated upstream
          Swal.fire(t('assessment_result.error_title'), t('assessment_result.send_error_desc'), "error");
=======
          Swal.fire(
            "ผิดพลาด",
            "ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง",
            "error",
          );
>>>>>>> Stashed changes
        }
      }
    });
  };

  return (
    <div className="ar-page">
      {/* ─── NAV ─── */}
      <nav className="ar-nav">
        <div className="ar-nav__logo-wrap">
          <img src={logoSUTH} alt="SUTH Healthcare" className="ar-nav__logo" />
        </div>
        <div className="ar-nav__actions" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <LanguageSwitcher darkText={true} />
          <button className="ar-btn-close" onClick={() => navigate("/")}>
            {t('assessment_result.close_window')}
          </button>
        </div>
      </nav>

      {/* ─── CONTENT ─── */}
      <div className="ar-container">
        {/* 🟡 HERO HEADER */}
        <div
          className="ar-success-hero"
          style={{
            backgroundColor: isSaved ? "#ecfdf5" : "#f8fafc",
            borderColor: isSaved ? "#10b981" : "#e2e8f0",
          }}
        >
          <div
            className="ar-success-icon"
            style={{ backgroundColor: isSaved ? "#10b981" : "#3b82f6" }}
          >
            {isSaved ? (
              <FiCheckCircle size={40} color="#fff" />
            ) : (
              <FiCheck size={40} color="#fff" />
            )}
          </div>
          <h2 className="ar-hero-title">
<<<<<<< Updated upstream
            {isSaved ? t('assessment_result.hero_saved_title') : t('assessment_result.hero_done_title')}
          </h2>
          <p className="ar-hero-subtitle" style={{ color: '#475569' }}>
            {isSaved
              ? t('assessment_result.hero_saved_desc')
              : results.length > 0 
                ? <span dangerouslySetInnerHTML={{ __html: t('assessment_result.hero_done_desc1') }} />
                : <span dangerouslySetInnerHTML={{ __html: t('assessment_result.hero_done_desc2') }} />
            }
=======
            {isSaved
              ? "ส่งข้อมูลให้เจ้าหน้าที่สำเร็จ"
              : "ประเมินผลเบื้องต้นเสร็จสิ้น"}
          </h2>
          <p className="ar-hero-subtitle" style={{ color: "#475569" }}>
            {isSaved ? (
              "ข้อมูลของท่านได้รับการบันทึกเรียบร้อยแล้ว และระบบได้แจ้งให้เจ้าหน้าที่ที่เกี่ยวข้องทราบแล้ว"
            ) : results.length > 0 ? (
              <span>
                ด้านล่างนี้คือสรุปผลการวิเคราะห์เบื้องต้น <br />
                หากต้องการรับการดูแลต่อ กรุณากดปุ่ม{" "}
                <b>“ส่งข้อมูลให้เจ้าหน้าที่”</b> ด้านล่าง
              </span>
            ) : (
              <span>
                กรอกข้อมูลเสร็จสิ้น <br />
                กรุณากดปุ่ม <b>“ส่งข้อมูลให้เจ้าหน้าที่”</b> ด้านล่าง
                เพื่อส่งข้อมูลให้เจ้าหน้าที่ต่อไป
              </span>
            )}
>>>>>>> Stashed changes
          </p>
        </div>

        {/* ✅ แสดงการ์ดผลการประเมิน */}
<<<<<<< Updated upstream
        {translatedResults.length > 0 && translatedResults.map((res, index) => {
          const level = getLevelConfig(res, t);
          return (
            <div
              key={index}
              className="ar-result-card"
              style={{
                "--card-color": level.color,
                animationDelay: `${index * 0.15}s`
              }}
            >
              {/* CARD HEAD */}
              <div className="ar-result-card__head">
                <div style={{ flex: 1, paddingRight: '16px' }}>
                  <div className="ar-level-badge" style={{ color: level.textColor }}>
                    <FiActivity size={24} /> <span>{level.label}</span>
=======
        {results.length > 0 &&
          results.map((res, index) => {
            const level = getLevelConfig(res);
            return (
              <div
                key={index}
                className="ar-result-card"
                style={{
                  "--card-color": level.color,
                  animationDelay: `${index * 0.15}s`,
                }}
              >
                {/* CARD HEAD */}
                <div className="ar-result-card__head">
                  <div style={{ flex: 1, paddingRight: "16px" }}>
                    <div
                      className="ar-level-badge"
                      style={{ color: level.textColor }}
                    >
                      <FiActivity size={24} /> <span>{level.label}</span>
                    </div>
                    <div className="ar-card-title">{level.title}</div>
>>>>>>> Stashed changes
                  </div>

<<<<<<< Updated upstream
                <div className="ar-score-wrapper" style={{ backgroundColor: level.colorBg, borderColor: level.colorBorder }}>
                  <span className="ar-score__label" style={{ color: '#64748b' }}>{t('assessment_result.score')}</span>
                  <span className="ar-score__val" style={{ color: level.textColor }}>
                    {level.score}
                  </span>
                </div>
              </div>

              {/* CARD BODY */}
              <div className="ar-result-card__body">

                {/* ADVICE */}
                <div className="ar-advice-box" style={{ backgroundColor: level.colorBg, borderColor: level.colorBorder }}>
                  <h3 className="ar-advice-box__title" style={{ color: level.textColor }}>
                    <FiInfo size={18} /> {t('assessment_result.advice')}
                  </h3>

                  <ul className="ar-advice__list">
                    {level.advice.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>

                {/* VISUAL */}
                <div
                  className="ar-visual"
                  style={{
                    "--grad": level.colorBanner,
                    "--border": level.colorBorder,
                    "--accent": level.color,
                  }}
                >
                  <div className="ar-visual__frame" style={{ background: `radial-gradient(circle at 50% 50%, rgba(${level.rgb}, 0.25), transparent 70%)` }}>
                    <img src={level.visualImage} alt={level.label} />
=======
                  <div
                    className="ar-score-wrapper"
                    style={{
                      backgroundColor: level.colorBg,
                      borderColor: level.colorBorder,
                    }}
                  >
                    <span
                      className="ar-score__label"
                      style={{ color: "#64748b" }}
                    >
                      คะแนน
                    </span>
                    <span
                      className="ar-score__val"
                      style={{ color: level.textColor }}
                    >
                      {level.score}
                    </span>
>>>>>>> Stashed changes
                  </div>
                </div>

                {/* CARD BODY */}
                <div className="ar-result-card__body">
                  {/* ADVICE */}
                  <div
                    className="ar-advice-box"
                    style={{
                      backgroundColor: level.colorBg,
                      borderColor: level.colorBorder,
                    }}
                  >
                    <h3
                      className="ar-advice-box__title"
                      style={{ color: level.textColor }}
                    >
                      <FiInfo size={18} /> คำแนะนำเบื้องต้น
                    </h3>

                    <ul className="ar-advice__list">
                      {level.advice.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>

                  {/* VISUAL */}
                  <div
                    className="ar-visual"
                    style={{
                      "--grad": level.colorBanner,
                      "--border": level.colorBorder,
                      "--accent": level.color,
                    }}
                  >
                    <div
                      className="ar-visual__frame"
                      style={{
                        background: `radial-gradient(circle at 50% 50%, rgba(${level.rgb}, 0.25), transparent 70%)`,
                      }}
                    >
                      <img src={level.visualImage} alt={level.label} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

        {/* 🟢 ACTIONS BUTTONS ควบคุมการแสดงผลตาม State */}
        {hasBooking && !isSaved && (
          <div style={{ color: '#d32f2f', fontSize: '14px', background: '#ffebee', padding: '12px 16px', borderRadius: '12px', margin: '0 auto 20px auto', maxWidth: '600px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <FiInfo style={{ transform: 'translateY(2px)', marginRight: '6px' }} size={16} />
            <b>หมายเหตุ:</b> การเลือกโควต้าจะยังไม่สมบูรณ์จนกว่าคุณจะกด <b>"ส่งข้อมูลให้เจ้าหน้าที่"</b> กรุณากดส่งข้อมูลเพื่อยืนยันสิทธิ์
          </div>
        )}
        <div className="ar-actions">
          {/* ปุ่มกลับหน้าหลัก (แสดงตลอด) */}
          <button
            className="ar-btn ar-btn--ghost"
            onClick={() => navigate("/")}
            disabled={isSubmitting}
          >
            {t('assessment_result.back_home')}
          </button>

          {/* ปุ่มส่งข้อมูลให้เจ้าหน้าที่ (แสดงตอนยังไม่ส่ง) */}
          {!isSaved && (
            <button
              className="ar-btn"
              style={{
                background: "#3b82f6",
                display: "flex",
                gap: "8px",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={handleSendToStaff}
              disabled={isSubmitting}
            >
<<<<<<< Updated upstream
              <FiSend /> {isSubmitting ? t('assessment_result.btn_sending') : t('assessment_result.btn_send')}
=======
              <FiSend />{" "}
              {isSubmitting ? "กำลังส่ง..." : "ส่งข้อมูลให้เจ้าหน้าที่"}
>>>>>>> Stashed changes
            </button>
          )}

          {/* ปุ่มตรวจสอบประวัติ (แสดงหลังจากส่งสำเร็จแล้ว) */}
          {isSaved && (
            <button
              className="ar-btn"
              style={{
                background: isColorTooBright(results[0]?.color || "#2d7d81")
                  ? "#2d7d81"
                  : getLevelConfig(results[0]).color,
                display: "flex",
                gap: "8px",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => navigate("/history")}
            >
              <FiClock /> {t('assessment_result.btn_history')}
            </button>
          )}

          {/* ปุ่มประเมินระบบ */}
          <button
            className="ar-btn"
            style={{
              background: "#7c3aed",
              display: "flex",
              gap: "8px",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={handleOpenEvaluation}
          >
            {t('assessment_result.btn_eval')}
          </button>
        </div>
      </div>
    </div>
  );
}
