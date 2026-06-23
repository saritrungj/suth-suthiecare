import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./ClinicDetail.css";
import {
  FiArrowLeft,
  FiTrendingUp,
  FiActivity,
  FiCalendar,
  FiShield,
  FiFileText,
} from "react-icons/fi";

export default function ClinicDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const {
    clinicType,
    masterCase,

    bmiRecords = [],
    adviceByClinic = {},
    timelineEvents = [],

    responses = [],
    logs = [],
  } = location.state || {};

  const clinicTimeline = timelineEvents.filter(
    (item) => item.clinic_type === clinicType,
  );

  const clinicBMI = bmiRecords.filter((item) => item.clinicId === clinicType);

  const clinicAdvice = adviceByClinic?.[clinicType] || [];

  const advice = clinicAdvice.length > 0 ? clinicAdvice[0] : null;

  const clinicResponses = responses.filter((r) => r.clinic_type === clinicType);

  const riskRecords = clinicResponses.map((r) => {
    const result = r.summary_data?.score_results?.[0];

    return {
      score: result?.score || 0,
      label: result?.label || "-",
      color: result?.color || "#3b82f6",
      date: r.submitted_at,
    };
  });

  const graphData = clinicType === "behavior" ? clinicBMI : riskRecords;

  console.log("riskRecords", riskRecords);
  console.log("graphData", graphData);
  console.log("clinicBMI", clinicBMI);
  const clinicNameMap = {
    en: {
      behavior: "Behavioral Clinic",
      sti: "STI Clinic",
      teenager: "Teen Clinic",
    },
    th: {
      behavior: "คลินิกปรับเปลี่ยนพฤติกรรม",
      sti: "คลินิกโรคติดต่อฯ",
      teenager: "คลินิกวัยรุ่น",
    }
  };

  const clinicDescriptionMap = {
    en: {
      behavior: "Behavior modification for better health",
      sti: "Prevention, care and monitoring of communicable diseases",
      teenager: "Care, understand and adapt for healthy teenagers",
    },
    th: {
      behavior: "ปรับพฤติกรรมเพื่อสุขภาพที่ดีขึ้น",
      sti: "ป้องกัน ดูแล และเฝ้าระวังโรคติดต่อ",
      teenager: "ดูแล เข้าใจ ปรับเปลี่ยน เพื่อวัยรุ่นที่แข็งแรงทั้งใจ",
    }
  };

  const currentLang = i18n.language === 'en' ? 'en' : 'th';
  const clinicDescription = clinicDescriptionMap[currentLang][clinicType] || (currentLang === 'en' ? "Comprehensive health care" : "ดูแลสุขภาพอย่างครบวงจร");
  const clinicName = clinicNameMap[currentLang][clinicType] || clinicType;
  console.log("clinicType", clinicType);
  console.log("clinicBMI", clinicBMI);
  console.log("clinicTimeline", clinicTimeline);
  console.log("advice", advice);

  const latestRecord = graphData[graphData.length - 1];
  const firstRecord = graphData[0];

  const latestValue =
    clinicType === "behavior"
      ? Number(latestRecord?.bmi || 0)
      : Number(latestRecord?.score || 0);

  const firstValue =
    clinicType === "behavior"
      ? Number(firstRecord?.bmi || 0)
      : Number(firstRecord?.score || 0);

  const diff = latestValue - firstValue;

  const trendText =
    diff < 0
      ? (currentLang === 'en' ? "Improving Health Trend" : "แนวโน้มสุขภาพดีขึ้น")
      : diff > 0
        ? (currentLang === 'en' ? "Increased Risk" : "มีความเสี่ยงเพิ่มขึ้น")
        : (currentLang === 'en' ? "No Change" : "ไม่มีการเปลี่ยนแปลง");

  const latestLabel =
    clinicType === "behavior"
      ? latestValue < 18.5
        ? (currentLang === 'en' ? "Underweight" : "น้ำหนักน้อย")
        : latestValue < 23
          ? (currentLang === 'en' ? "Normal" : "ปกติ")
          : latestValue < 25
            ? (currentLang === 'en' ? "Overweight" : "น้ำหนักเกิน")
            : (currentLang === 'en' ? "Obese" : "อ้วน")
      : latestRecord?.label || "-";

  return (
    <div className="clinic-detail-page">
      <button className="clinic-back-btn" onClick={() => navigate(-1)}>
        <FiArrowLeft />
        <span>{t('history.result.back') || (currentLang === 'en' ? 'Back' : 'ย้อนกลับ')}</span>
      </button>

      {/* HERO */}
      <div className="clinic-hero">
        <div className="hero-content">
          <h1>{clinicName}</h1>

          <div className="hero-health-status">
            <div className="hero-main-value">
              {clinicType === "behavior"
                ? `${currentLang === 'en' ? 'Current BMI' : 'BMI ปัจจุบัน'} ${latestValue || "-"}`
                : `${currentLang === 'en' ? 'Latest Score' : 'คะแนนล่าสุด'} ${latestValue || "-"}`}

              <span>({latestLabel})</span>
            </div>

            <div className="hero-trend">{trendText}</div>
          </div>
        </div>
      </div>

      {/* CHART + ADVICE */}

      <div className="clinic-top-section">
        <div className="bmi-card">
          <div className="card-header">
            <div className="card-icon">
              <FiTrendingUp />
            </div>

            <div>
              <h3>
                {clinicType === "behavior"
                  ? (currentLang === 'en' ? "BMI Trend" : "แนวโน้ม BMI")
                  : (currentLang === 'en' ? "Risk Score Trend" : "แนวโน้มคะแนนความเสี่ยง")}
              </h3>

              <span>{currentLang === 'en' ? "All Historical Data" : "ข้อมูลย้อนหลังทั้งหมด"}</span>
            </div>
          </div>

          <div className="hr-trend-chart">
            {graphData.map((item, i) => {
              const value =
                clinicType === "behavior"
                  ? Number(item.bmi || item.score || 0)
                  : Number(item.score || 0);

              const maxValue = clinicType === "behavior" ? 40 : 30;

              const heightPct = Math.min((value / maxValue) * 100, 100);

              return (
                <div key={i} className="hr-trend-bar-wrapper">
                  <div
                    className="hr-trend-bar"
                    style={{
                      height: `${heightPct}%`,
                      background: item.color || "#22c55e",
                    }}
                  >
                    <span className="hr-trend-val">{value}</span>
                  </div>

                  <div className="hr-trend-date">
                    {item.date
                      ? new Date(item.date).toLocaleDateString("th-TH", {
                          month: "short",
                          day: "numeric",
                        })
                      : "-"}
                  </div>

                  {clinicType === "behavior" ? (
                    <div className="hr-trend-wh">
                      <span>{item.weight ? `${item.weight} kg` : "-"}</span>

                      <span>{item.height ? `${item.height} cm` : "-"}</span>
                    </div>
                  ) : (
                    <div
                      className="risk-label"
                      style={{
                        color: item.color || "#22c55e",
                      }}
                    >
                      {item.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="advice-card">
          {/* HEADER */}
          <div className="card-header">
            <div className="card-icon">
              <FiFileText />
            </div>

            <div>
              <h3>{currentLang === 'en' ? "Expert Advice" : "คำแนะนำจากผู้เชี่ยวชาญ"}</h3>
              <span>{clinicName}</span>
            </div>
          </div>

          <div className="advice-box">
            <div className="advice-header">
              <FiShield />
              <span>{currentLang === 'en' ? "Health Recommendations" : "ข้อเสนอแนะด้านสุขภาพ"}</span>
            </div>

            <p>
              {advice?.detail?.trim()
                ? advice.detail
                : (currentLang === 'en' ? "No expert advice available at the moment. Please check back later." : "ยังไม่มีคำแนะนำจากผู้เชี่ยวชาญในขณะนี้ กรุณาติดตามผลครั้งถัดไป")}
            </p>
          </div>

        </div>
      </div>

      {/* TIMELINE */}

      <div className="timeline-section">
        <div className="timeline-header">
          <div className="section-title">
            <FiCalendar />
            <span>{currentLang === 'en' ? "Service History" : "ประวัติการเข้ารับบริการ"}</span>
          </div>

          <span className="timeline-count">{clinicTimeline.length} {currentLang === 'en' ? "records" : "รายการ"}</span>
        </div>

        {clinicTimeline.length > 0 ? (
          clinicTimeline.map((item, index) => (
            <div key={index} className="timeline-card">
              <div className="timeline-icon">
                <FiCalendar />
              </div>

              <div className="timeline-content">
                <div className="timeline-title">
                  {item.title || item.form_title}
                </div>

                <div className="timeline-date">
                  {new Date(item.date || item.submitted_at).toLocaleDateString(
                    "th-TH",
                  )}
                </div>
              </div>

              <button className="timeline-btn">{currentLang === 'en' ? "View More" : "ดูเพิ่มเติม"}</button>
            </div>
          ))
        ) : (
          <div className="empty-timeline">{currentLang === 'en' ? "No service history" : "ไม่มีประวัติการเข้ารับบริการ"}</div>
        )}
      </div>
    </div>
  );
}
