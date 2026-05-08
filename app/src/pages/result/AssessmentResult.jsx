import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiActivity, FiInfo, FiCheck, FiSend, FiClock } from "react-icons/fi";
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
  if (!hex.startsWith('#')) hex = '#' + hex;
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
const getLevelConfig = (result) => {
  if (!result) {
    return {
      title: "ผลการประเมิน",
      score: 0,
      label: "บันทึกสำเร็จ",
      advice: ["ไม่มีคำแนะนำเพิ่มเติมในขณะนี้"],
      color: "#2d7d81",
      textColor: "#2d7d81",
      rgb: "45, 125, 129",
      colorBg: "rgba(45, 125, 129, 0.08)",
      colorBorder: "rgba(45, 125, 129, 0.25)",
      colorBanner: "linear-gradient(135deg, rgba(45, 125, 129, 0.7) 0%, rgba(45, 125, 129, 1) 100%)",
      visualImage: riskLow,
    };
  }

  const hexCriteriaColor = result.color || "#2d7d81";
  const rgbString = hexToRgbArray(hexCriteriaColor).join(', ');
  const lowerColor = hexCriteriaColor.toLowerCase();

  const isTooBright = isColorTooBright(hexCriteriaColor);
  const readableTextColor = isTooBright ? "#2d7d81" : hexCriteriaColor;

  let visualImage = riskLow;
  if (lowerColor.includes('d93025') || lowerColor.includes('e53935') || lowerColor.includes('f44336') || lowerColor.includes('ef4444') || lowerColor.includes('d32f2f')) {
    visualImage = riskHigh;
  } else if (lowerColor.includes('fbbc04') || lowerColor.includes('ff9800') || lowerColor.includes('ffb300') || lowerColor.includes('f59e0b') || lowerColor.includes('f57c00')) {
    visualImage = riskMedium;
  }

  const rgbColor = hexToRgbArray(hexCriteriaColor);

  return {
    title: result.title || "ผลการประเมิน",
    score: result.score,
    label: result.label || "ประเมินเสร็จสิ้น",
    advice: result.advice ? (Array.isArray(result.advice) ? result.advice : result.advice.split('\n')) : ["ไม่มีคำแนะนำเพิ่มเติมในขณะนี้"],
    color: hexCriteriaColor,
    textColor: readableTextColor,
    rgb: rgbColor.join(', '),
    colorBg: `rgba(${rgbString}, 0.08)`,
    colorBorder: `rgba(${rgbString}, 0.25)`,
    colorBanner: `linear-gradient(135deg, rgba(${rgbString}, 0.7) 0%, rgba(${rgbString}, 1) 100%)`,
    visualImage: visualImage,
  };
};

export default function AssessmentResult() {
  const location = useLocation();
  const navigate = useNavigate();

  // 🟢 รับ Payload ที่ถูกส่งมาจาก FormView
  const results = location.state?.results || [];
  const formId = location.state?.formId;
  const payload = location.state?.payload;

  // 🟢 State ควบคุมสถานะการส่งข้อมูล
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    // ถ้าไม่มีผลลัพธ์ (เช่น ผู้ใช้เข้าหน้านี้โดยตรง) ให้เด้งกลับหน้าแรก
    if (!results.length) {
      navigate("/");
    }
  }, [navigate, results.length]);

  // 🟢 ฟังก์ชันจัดการการยิง API
  const handleSendToStaff = () => {
    if (!formId || !payload) {
      Swal.fire('ข้อผิดพลาด', 'ไม่พบข้อมูลสำหรับการส่ง กรุณาทำแบบประเมินใหม่อีกครั้ง', 'error');
      return;
    }

    Swal.fire({
      title: 'คุณยินยอมให้เจ้าหน้าที่<br/>ติดต่อกลับหรือไม่?',
      html: `ข้อมูลของท่านจะถูกเก็บเป็นความลับ<br/>
         และส่งต่อให้เจ้าหน้าที่ที่เกี่ยวข้องเท่านั้น<br/>
         เพื่อการดูแลและให้คำแนะนำเบื้องต้น`,
      icon: 'question',
      showCloseButton: true,
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#ef4444',
      confirmButtonText: 'ยินยอม',
      cancelButtonText: 'ปฏิเสธ',
      width: '500px',
      padding: '2.5em',
      background: '#ffffff',
      borderRadius: '20px'
    }).then(async (result) => {
      if (result.isConfirmed) {
        setIsSubmitting(true);

        Swal.fire({
          title: 'กำลังส่งข้อมูล...',
          text: 'กรุณารอสักครู่',
          allowOutsideClick: false,
          didOpen: () => { Swal.showLoading(); }
        });

        try {
          await submitFormAnswers(formId, payload);
          setIsSaved(true);
          Swal.fire({
            icon: 'success',
            title: 'ส่งข้อมูลสำเร็จ!',
            text: 'เจ้าหน้าที่ได้รับข้อมูลของท่านแล้ว ท่านสามารถตรวจสอบประวัติได้',
            confirmButtonColor: '#10b981'
          });
        } catch (error) {
          console.error("Submit Error:", error);
          Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถส่งข้อมูลได้',
            text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง',
            confirmButtonColor: '#ef4444'
          });
        } finally {
          setIsSubmitting(false);
        }
      }
    });
  };

  const [hasEvaluated, setHasEvaluated] = useState(false);
  useEffect(() => {
    const status = sessionStorage.getItem('eval_done');
    if (status === 'true') {
      setHasEvaluated(true);
    }
  }, []);
  const handleOpenEvaluation = () => {
    if (hasEvaluated) {
      Swal.fire({
        title: 'ขอบคุณสำหรับคำแนะนำ',
        text: 'คุณได้ตอบแบบประเมินการใช้งานระบบเรียบร้อยแล้ว',
        icon: 'success',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#7c3aed'
      });
      return;
    }
    const renderScale = (name) => `
      <div style="display:flex; justify-content:space-between; margin-top:10px">
        ${[1, 2, 3, 4, 5].map(v => `
          <label style="text-align:center; flex:1; cursor:pointer display:flex; flex-direction:column; align-items:center; gap:6px;">
            <input type="radio" name="${name}" value="${v}" style="margin:0"/>
            <div style="font-size:12px font-weight:600; color:#475569;">${v}</div>
          </label>
        `).join("")}
      </div>
      <div class="evaluation-labels-wrap">
        <span>น้อยที่สุด</span>
        <span>มากที่สุด</span>
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
        "คุณอยากใช้แอปพลิเคชันนี้บ่อย ๆ",
        "คุณคิดว่าระบบไม่ควรซับซ้อนขนาดนี้",
        "คุณคิดว่าระบบใช้งานง่าย",
        "คุณคิดว่าคุณต้องการความช่วยเหลือจากผู้เชี่ยวชาญเพื่อที่จะใช้งานระบบนี้ได้",
        "คุณพบว่ามีหลายฟังก์ชันที่ทำงานได้ดี",
        "คุณคิดว่าระบบไม่ค่อยมีความสม่ำเสมอ",
        "คุณคิดว่าคนอื่นๆ น่าจะเข้าใจวิธีใช้ระบบนี้ได้เร็วเหมือนกัน",
        "คุณพบว่าการใช้งานระบบนี้ยุ่งยาก/ซับซ้อนมากๆ",
        "คุณรู้สึกมั่นใจตอนใช้งาน",
        "คุณต้องการฝึกใช้งานก่อนถึงจะเริ่มใช้งานระบบนี้ได้"
      ];

      return questions.map((q, i) => `
        <div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:12px; box-shadow:0 2px 6px rgba(0,0,0,0.05)">
          <p style="font-weight:600">${i + 1}. ${q}</p>
          ${renderScale(`sus${i + 1}`)}
        </div>
      `).join('');
    };

    Swal.fire({
      title: ' แบบประเมินการใช้งานระบบ',
      width: window.innerWidth < 768 ? '95%' : 700,
      showCloseButton: true,
      closeButtonHtml: '✕',
      html: `
        <div style="text-align:left; max-height:450px; overflow:auto overflow-x:hidden;">
         
        <div style="background:#fff; border-radius:12px; padding:20px; margin-bottom:15px; border-top:6px solid #7c3aed; box-shadow:0 4px 12px rgba(0,0,0,0.06)">
            <h3 style="margin-bottom:15px"> ส่วนที่ 1: ความพึงพอใจ</h3>
            ${renderQuestionBox(1, "คุณมีความพึงพอใจต่อหน้าตาของระบบ โทนสี และขนาดตัวอักษรที่อ่านง่ายและทันสมัย", "q1")}
            ${renderQuestionBox(2, "ระบบมีการตอบสนองและประมวลผลข้อมูล (เช่น การโหลดหน้าเว็บหรือการส่งฟอร์ม) ได้อย่างรวดเร็ว", "q2")}
            ${renderQuestionBox(3, "ข้อมูลและคำแนะนำเบื้องต้นที่ได้รับจากระบบมีความชัดเจนและเป็นประโยชน์ต่อคุณ", "q3")}
            ${renderQuestionBox(4, "ระบบมีความชัดเจน เข้าใจง่าย ไม่สับสนในการใช้งาน", "q4")}
            ${renderQuestionBox(5, "โดยรวมแล้วคุณมีความพึงพอใจต่อการใช้งานระบบ", "q5")}
          </div>

          <div style="background:#fff; border-radius:12px; padding:20px; border-top:6px solid #6366f1; box-shadow:0 4px 12px rgba(0,0,0,0.06)">
            <h3 style="margin-bottom:15px"> ส่วนที่ 2: ความสามารถในการใช้งาน (System Usability Scale )</h3>
            ${renderSUS()}
          </div>

          <div style="margin-top:20px; background:#fff; border-radius:12px; padding:20px; border-top:6px solid #10b981; box-shadow:0 4px 12px rgba(0,0,0,0.06)">
            <p><b> ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</b></p>
            <textarea id="comment" class="swal2-textarea" placeholder="พิมพ์ความคิดเห็น..." style="height:80px; width: 250px; font-size:14px; padding:10px; margin-right:10px; border-radius:10px; box-sizing: border-box;"></textarea>
          </div>
        </div>
      `,
      confirmButtonText: 'ส่งแบบประเมิน',
      confirmButtonColor: '#7c3aed',
      preConfirm: () => {
        const getRadio = (name) => {
          const el = document.querySelector(`input[name="${name}"]:checked`);
          return el ? el.value : null;
        };
        // 1. ตรวจสอบส่วนที่ 1: ความพึงพอใจ (q1 - q5)
        for (let i = 1; i <= 5; i++) {
          if (!getRadio(`q${i}`)) {
            Swal.showValidationMessage(`กรุณาตอบส่วนที่ 1 ข้อที่ ${i} ให้ครบถ้วน`);
            document.getElementsByName(`q${i}`)[0]?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return false;
          }
        }

        // 2. ตรวจสอบส่วนที่ 2: SUS (sus1 - sus10)
        let susAnswers = [];
        for (let i = 1; i <= 10; i++) {
          const val = getRadio(`sus${i}`);
          if (!val) {
            Swal.showValidationMessage(`กรุณาตอบส่วนที่ 2 (SUS) ข้อที่ ${i} ให้ครบถ้วน`);
            document.getElementsByName(`sus${i}`)[0]?.closest('div')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return false;
          }
          susAnswers.push(Number(val));
        }

        const comment = document.getElementById('comment').value;

        // คืนค่าข้อมูลทั้งหมดเมื่อกรอกครบแล้ว (ยกเว้น comment ที่เป็น optional)
        return {
          q1: getRadio("q1"),
          q2: getRadio("q2"),
          q3: getRadio("q3"),
          q4: getRadio("q4"),
          q5: getRadio("q5"),
          comment,
          susAnswers
        };
      }
    }).then(async (result) => { // 🟢 3. เพิ่ม async และยิง API ตรงนี้เลย
      if (result.isConfirmed) {
        const { q1, q2, q3, q4, q5, comment, susAnswers } = result.value;

        // คำนวณคะแนน SUS
        let score = 0;
        susAnswers.forEach((val, i) => {
          score += (i % 2 === 0) ? (val - 1) : (5 - val);
        });
        const susScore = score * 2.5;

        // จัดเตรียมข้อมูลส่ง API
        const payloadData = {
          sat_ui: Number(q1),
          sat_speed: Number(q2),
          sat_content: Number(q3),
          sat_access: Number(q4),
          sat_overall: Number(q5),
          sus1: susAnswers[0], sus2: susAnswers[1], sus3: susAnswers[2], sus4: susAnswers[3], sus5: susAnswers[4],
          sus6: susAnswers[5], sus7: susAnswers[6], sus8: susAnswers[7], sus9: susAnswers[8], sus10: susAnswers[9],
          sus_total_score: susScore,
          suggestions: comment
        };

        try {
          Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
          });

          // ยิง API
          await api.post('/submit-system-feedback', payloadData);

          // บันทึกสถานะลงเครื่องผู้ใช้ทันที
          sessionStorage.setItem('eval_done', 'true');
          setHasEvaluated(true);

          Swal.fire({
            icon: 'success',
            title: 'ส่งสำเร็จ',
            html: `
              <p>ขอบคุณสำหรับการประเมิน</p>
            `,
            confirmButtonColor: '#10b981'
          });
        } catch (error) {
          Swal.fire("ผิดพลาด", "ไม่สามารถส่งข้อมูลได้ กรุณาลองใหม่อีกครั้ง", "error");
        }
      }
    });
  };

  return (
    <div className="ar-page">

      {/* ─── NAV ─── */}
      <nav className="ar-nav">
        <div className="ar-nav__logo-wrap">
          <img
            src={logoSUTH}
            alt="SUTH Healthcare"
            className="ar-nav__logo"
          />
        </div>
        <div className="ar-nav__actions">
          <button className="ar-btn-close" onClick={() => navigate("/")}>
            ✕ ปิดหน้าต่าง
          </button>
        </div>
      </nav>

      {/* ─── CONTENT ─── */}
      <div className="ar-container">

        {/* 🟡 HERO HEADER */}
        <div
          className="ar-success-hero"
          style={{
            backgroundColor: isSaved ? '#ecfdf5' : '#f8fafc',
            borderColor: isSaved ? '#10b981' : '#e2e8f0'
          }}
        >
          <div
            className="ar-success-icon"
            style={{ backgroundColor: isSaved ? '#10b981' : '#3b82f6' }}
          >
            {isSaved ? <FiCheckCircle size={40} color="#fff" /> : <FiCheck size={40} color="#fff" />}
          </div>
          <h2 className="ar-hero-title">
            {isSaved ? "ส่งข้อมูลให้เจ้าหน้าที่สำเร็จ" : "ประเมินผลเบื้องต้นเสร็จสิ้น"}
          </h2>
          <p className="ar-hero-subtitle" style={{ color: '#475569' }}>
            {isSaved
              ? "ข้อมูลของท่านได้รับการบันทึกเรียบร้อยแล้ว และระบบได้แจ้งให้เจ้าหน้าที่ที่เกี่ยวข้องทราบแล้ว"
              : <span>ด้านล่างนี้คือสรุปผลการวิเคราะห์เบื้องต้น <br />หากต้องการรับการดูแลต่อ กรุณากดปุ่ม <b>“ส่งข้อมูลให้เจ้าหน้าที่”</b> ด้านล่าง</span>
            }
          </p>
        </div>

        {/* ✅ แสดงการ์ดผลการประเมิน */}
        {results.length > 0 && results.map((res, index) => {
          const level = getLevelConfig(res);
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
                  </div>
                  <div className="ar-card-title">{level.title}</div>
                </div>

                <div className="ar-score-wrapper" style={{ backgroundColor: level.colorBg, borderColor: level.colorBorder }}>
                  <span className="ar-score__label" style={{ color: '#64748b' }}>คะแนน</span>
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
                  <div className="ar-visual__frame" style={{ background: `radial-gradient(circle at 50% 50%, rgba(${level.rgb}, 0.25), transparent 70%)` }}>
                    <img src={level.visualImage} alt={level.label} />
                  </div>
                </div>

              </div>
            </div>
          );
        })}

        {/* 🟢 ACTIONS BUTTONS ควบคุมการแสดงผลตาม State */}
        <div className="ar-actions">

          {/* ปุ่มกลับหน้าหลัก (แสดงตลอด) */}
          <button
            className="ar-btn ar-btn--ghost"
            onClick={() => navigate("/")}
            disabled={isSubmitting}
          >
            ← กลับหน้าหลัก
          </button>

          {/* ปุ่มส่งข้อมูลให้เจ้าหน้าที่ (แสดงตอนยังไม่ส่ง) */}
          {!isSaved && (
            <button
              className="ar-btn"
              style={{ background: "#3b82f6", display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}
              onClick={handleSendToStaff}
              disabled={isSubmitting}
            >
              <FiSend /> {isSubmitting ? "กำลังส่ง..." : "ส่งข้อมูลให้เจ้าหน้าที่"}
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
                display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center'
              }}
              onClick={() => navigate("/history")}
            >
              <FiClock /> ตรวจสอบประวัติ
            </button>
          )}

          {/* ปุ่มประเมินระบบ */}
          <button
            className="ar-btn"
            style={{
              background: "#7c3aed",
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={handleOpenEvaluation}
          >
            ประเมินการใช้งานระบบ
          </button>

        </div>

      </div>
    </div>
  );
}