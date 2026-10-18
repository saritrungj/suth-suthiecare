import { toDisplayText } from "../../../utils/textPresentation.js";
import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Navbar from "../../../components/Navbar";
import PublicBackdrop from "../../../components/public/PublicBackdrop";
import { CLINIC_INFO } from "./historyUtils";
import { bmiCategory, buildClinicDetail } from "./clinicDetailData";
import "./ClinicDetail.css";
import {
  FiActivity,
  FiCalendar,
  FiChevronRight,
  FiClipboard,
  FiFileText,
  FiMessageCircle,
  FiTrendingDown,
  FiTrendingUp,
  FiMinus,
} from "react-icons/fi";

const CLINIC_COPY = {
  th: {
    behavior: ["คลินิกปรับเปลี่ยนพฤติกรรม", "ปรับพฤติกรรมเพื่อสุขภาพที่ดีขึ้น"],
    sti: ["คลินิกโรคติดต่อฯ", "ป้องกัน ดูแล และเฝ้าระวังโรคติดต่อ"],
    teenager: [
      "คลินิกวัยรุ่น",
      "ดูแล เข้าใจ ปรับเปลี่ยน เพื่อวัยรุ่นที่แข็งแรงทั้งใจ",
    ],
    general: ["บริการทั่วไป", "ดูแลสุขภาพอย่างครบวงจร"],
  },
  en: {
    behavior: ["Behavioral Clinic", "Behavior modification for better health"],
    sti: [
      "STI Clinic",
      "Prevention, care and monitoring of communicable diseases",
    ],
    teenager: [
      "Teen Clinic",
      "Care, understand and adapt for healthy teenagers",
    ],
    general: ["General Services", "Comprehensive health care"],
  },
};

const BMI_LABELS = {
  th: {
    underweight: "น้ำหนักน้อย",
    normal: "ปกติ",
    overweight: "น้ำหนักเกิน",
    obese: "อ้วน",
  },
  en: {
    underweight: "Underweight",
    normal: "Normal",
    overweight: "Overweight",
    obese: "Obese",
  },
};

const STATUS_EN = [
  ["รอติดต่อ", "Pending contact"],
  ["กำลังดำเนินการ", "In progress"],
  ["เสร็จสิ้น", "Completed"],
];

export default function ClinicDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const state = location.state;
  const clinicType = state?.clinicType;
  const lang = i18n.language === "en" ? "en" : "th";
  const L = (th, en) => (lang === "en" ? en : th);

  // The page is built from the history page's data; opened on its own (a
  // typed URL or a bookmark) it has nothing to show, so go back there.
  useEffect(() => {
    if (!clinicType) navigate("/history/result", { replace: true });
  }, [clinicType, navigate]);

  const detail = useMemo(() => buildClinicDetail(state || {}), [state]);
  if (!clinicType) return null;

  const clinic = CLINIC_INFO[clinicType] || CLINIC_INFO.general;
  const [clinicName, clinicDescription] =
    CLINIC_COPY[lang][clinicType] || CLINIC_COPY[lang].general;
  const isBmi = detail.metric === "bmi";

  const formatDate = (value, options = { dateStyle: "medium" }) =>
    value
      ? new Date(value).toLocaleString(
          lang === "en" ? "en-GB" : "th-TH",
          options,
        )
      : "-";
  const formatStatus = (status) => {
    if (!status) return L("รอดำเนินการ", "Pending");
    if (lang !== "en") return status;
    return STATUS_EN.find(([th]) => status.includes(th))?.[1] || status;
  };
  const valueLabel = (record) => {
    if (!record) return null;
    if (isBmi) return BMI_LABELS[lang][bmiCategory(record.value)];
    return record.label ? toDisplayText(record.label) : null;
  };

  const trendCopy = {
    better: [FiTrendingDown, L("แนวโน้มดีขึ้น", "Improving")],
    worse: [FiTrendingUp, L("ควรติดตามใกล้ชิด", "Needs attention")],
    same: [FiMinus, L("คงที่", "No change")],
  }[detail.trend];
  const TrendIcon = trendCopy?.[0];

  const chartMax = isBmi
    ? Math.max(40, ...detail.series.map((r) => r.value))
    : Math.max(1, ...detail.series.map((r) => r.value)) * 1.15;

  const latestLabel = valueLabel(detail.latest);

  return (
    <div
      className="clinic-detail-shell"
      style={{ "--clinic": clinic.color, "--clinic-bg": clinic.bg }}
    >
      <PublicBackdrop />
      <Navbar
        showBack
        showLanguage
        showPatientAccount
        backText={t("history.result.back") || L("ย้อนกลับ", "Back")}
        onBack={() => navigate(-1)}
      />

      <main className="clinic-detail-page">
        {/* HEADER */}
        <section className="cd-hero" aria-labelledby="cd-title">
          <div className="cd-hero__top">
            <span className="cd-hero__icon" aria-hidden="true">
              <FiActivity />
            </span>
            <div className="cd-hero__text">
              <h1 id="cd-title">{clinicName}</h1>
              <p>{clinicDescription}</p>
            </div>
            {detail.caseInfo && (
              <div className="cd-case-badge">
                <span className="cd-case-badge__code">
                  {detail.caseInfo.code}
                </span>
                <span className="cd-case-badge__status">
                  {formatStatus(detail.caseInfo.status)}
                </span>
              </div>
            )}
          </div>

          <dl className="cd-stats">
            <div className="cd-stat cd-stat--main">
              <dt>
                {isBmi
                  ? L("BMI ล่าสุด", "Latest BMI")
                  : L("คะแนนล่าสุด", "Latest score")}
              </dt>
              <dd>
                <strong>{detail.latest ? detail.latest.value : "-"}</strong>
                {latestLabel && (
                  <span
                    className="cd-chip"
                    style={
                      detail.latest?.color
                        ? { "--chip": detail.latest.color }
                        : undefined
                    }
                  >
                    {latestLabel}
                  </span>
                )}
              </dd>
            </div>
            <div className="cd-stat">
              <dt>{L("จำนวนการประเมิน", "Assessments")}</dt>
              <dd>
                <strong>{detail.assessmentCount}</strong>
                <span>{L("ครั้ง", "times")}</span>
              </dd>
            </div>
            <div className="cd-stat">
              <dt>{L("เข้ารับบริการล่าสุด", "Last visit")}</dt>
              <dd>
                <strong className="cd-stat__date">
                  {formatDate(detail.lastVisit)}
                </strong>
              </dd>
            </div>
          </dl>
        </section>

        <div className="cd-grid">
          {/* TREND */}
          <section
            className="cd-card cd-card--trend"
            aria-labelledby="cd-trend"
          >
            <header className="cd-card__head">
              <span className="cd-card__icon" aria-hidden="true">
                <FiTrendingUp />
              </span>
              <div>
                <h2 id="cd-trend">
                  {isBmi
                    ? L("แนวโน้ม BMI", "BMI trend")
                    : L("แนวโน้มคะแนนประเมิน", "Score trend")}
                </h2>
                <p>
                  {detail.series.length
                    ? L(
                        `${detail.series.length} ครั้งล่าสุด เรียงตามวันที่`,
                        `Last ${detail.series.length} results by date`,
                      )
                    : L("ยังไม่มีผลที่มีคะแนน", "No scored results yet")}
                </p>
              </div>
              {trendCopy && (
                <span className={`cd-trend cd-trend--${detail.trend}`}>
                  <TrendIcon aria-hidden="true" /> {trendCopy[1]}
                </span>
              )}
            </header>

            {detail.series.length ? (
              <>
                <ol className="cd-chart">
                  {detail.series.map((record, index) => (
                    <li key={`${record.date}-${index}`} className="cd-bar">
                      <span className="cd-bar__value">{record.value}</span>
                      <span className="cd-bar__track" aria-hidden="true">
                        <span
                          className="cd-bar__fill"
                          style={{
                            height: `${Math.max((record.value / chartMax) * 100, 4)}%`,
                            background: record.color || "var(--clinic)",
                          }}
                        />
                      </span>
                      <span className="cd-bar__date">
                        {formatDate(record.date, {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      {isBmi ? (
                        <span className="cd-bar__meta">
                          {record.weight ? `${record.weight} kg` : "-"}
                          <br />
                          {record.height ? `${record.height} cm` : "-"}
                        </span>
                      ) : (
                        record.label && (
                          <span className="cd-bar__meta">
                            {toDisplayText(record.label)}
                          </span>
                        )
                      )}
                    </li>
                  ))}
                </ol>
                {detail.series.length === 1 && (
                  <p className="cd-note">
                    {L(
                      "ต้องมีผลประเมินอย่างน้อย 2 ครั้งจึงจะแสดงแนวโน้ม",
                      "At least two results are needed to show a trend",
                    )}
                  </p>
                )}
              </>
            ) : (
              <p className="cd-empty">
                {L("ยังไม่มีข้อมูลผลประเมิน", "No assessment data yet")}
              </p>
            )}
          </section>

          {/* ADVICE */}
          <section className="cd-card" aria-labelledby="cd-advice">
            <header className="cd-card__head">
              <span className="cd-card__icon" aria-hidden="true">
                <FiMessageCircle />
              </span>
              <div>
                <h2 id="cd-advice">
                  {L("คำแนะนำจากผู้เชี่ยวชาญ", "Expert advice")}
                </h2>
                <p>{clinicName}</p>
              </div>
            </header>
            {detail.advice.length ? (
              <ul className="cd-notes">
                {detail.advice.map((log, index) => (
                  <li key={log.id || index} className="cd-note-item">
                    <p>{toDisplayText(log.detail)}</p>
                    <span>
                      {log.staff ? `${log.staff} · ` : ""}
                      {formatDate(log.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cd-empty">
                {L(
                  "ยังไม่มีคำแนะนำจากผู้เชี่ยวชาญ กรุณาติดตามผลครั้งถัดไป",
                  "No expert advice yet. Please check back later.",
                )}
              </p>
            )}
          </section>

          {/* CASE PROGRESS */}
          {detail.caseInfo && (
            <section className="cd-card" aria-labelledby="cd-case">
              <header className="cd-card__head">
                <span className="cd-card__icon" aria-hidden="true">
                  <FiClipboard />
                </span>
                <div>
                  <h2 id="cd-case">
                    {L("ความคืบหน้าการดูแล", "Care progress")}
                  </h2>
                  <p>
                    {detail.caseInfo.code}
                    {detail.caseInfo.openedAt &&
                      ` · ${L("เปิดเคส", "Opened")} ${formatDate(detail.caseInfo.openedAt)}`}
                  </p>
                </div>
              </header>
              {detail.caseInfo.updates.length ? (
                <ol className="cd-steps">
                  {detail.caseInfo.updates.map((log, index) => (
                    <li key={log.id || index}>
                      <p>{toDisplayText(log.detail)}</p>
                      <span>
                        {log.staff ? `${log.staff} · ` : ""}
                        {formatDate(log.created_at, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="cd-empty">
                  {L(
                    "เจ้าหน้าที่ได้รับข้อมูลแล้ว และจะติดต่อกลับเพื่อวางแผนการดูแล",
                    "Staff have your information and will contact you to plan your care.",
                  )}
                </p>
              )}
            </section>
          )}

          {/* HISTORY */}
          <section
            className="cd-card cd-card--wide"
            aria-labelledby="cd-history"
          >
            <header className="cd-card__head">
              <span className="cd-card__icon" aria-hidden="true">
                <FiCalendar />
              </span>
              <div>
                <h2 id="cd-history">
                  {L("ประวัติการเข้ารับบริการ", "Service history")}
                </h2>
                <p>
                  {detail.history.length} {L("รายการ", "records")}
                </p>
              </div>
            </header>
            {detail.history.length ? (
              <ul className="cd-history">
                {detail.history.map((record) => (
                  <li key={record.id}>
                    <button
                      type="button"
                      className="cd-history__item"
                      onClick={() =>
                        navigate("/history/result", {
                          state: { expandResponseId: record.id },
                        })
                      }
                    >
                      <span className="cd-history__icon" aria-hidden="true">
                        <FiFileText />
                      </span>
                      <span className="cd-history__text">
                        <strong>{toDisplayText(record.title)}</strong>
                        <span>
                          {formatDate(record.date, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </span>
                      {record.label && (
                        <span
                          className="cd-chip"
                          style={
                            record.color
                              ? { "--chip": record.color }
                              : undefined
                          }
                        >
                          {toDisplayText(record.label)}
                        </span>
                      )}
                      <span className="cd-history__more">
                        {L("ดูเพิ่มเติม", "View")}
                        <FiChevronRight aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cd-empty">
                {L("ไม่มีประวัติการเข้ารับบริการ", "No service history")}
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
