import { toDisplayText } from "../../../utils/textPresentation.js";
// ตัวแปรการตั้งค่า API
export const API_BASE = (import.meta.env?.VITE_API_URL || "/api").replace(
  /\/api$/,
  "",
);

export const axiosConfig = {
  headers: {
    "ngrok-skip-browser-warning": "69420",
    "Bypass-Tunnel-Reminder": "true",
    "x-tunnel-skip-anti-phishing-page": "true",
  },
};

// ข้อมูลคลินิก
export const CLINIC_INFO = {
  general: {
    id: "general",
    text: "ทั่วไป",
    bg: "#f1f5f9",
    color: "var(--suth-ink-2)",
    border: "var(--suth-line)",
  },
  teenager: {
    id: "teenager",
    text: "คลินิกวัยรุ่น",
    bg: "#e0f2fe",
    color: "var(--suth-care)",
    border: "var(--suth-info-line)",
  },
  behavior: {
    id: "behavior",
    text: "คลินิกปรับเปลี่ยนพฤติกรรม",
    bg: "#dcfce7",
    color: "var(--suth-success)",
    border: "var(--suth-success-line)",
  },
  sti: {
    id: "sti",
    text: "คลินิกโรคติดต่อฯ",
    bg: "#fce7f3",
    color: "var(--suth-danger)",
    border: "var(--suth-danger-line)",
  },
};

// ฟังก์ชันช่วยเหลือต่างๆ (Helpers)
export const stripHtml = toDisplayText;

export const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getRiskInfo = (scoreResults = []) => {
  if (!scoreResults.length)
    return { label: "ปกติ", color: "var(--suth-success)", bg: "#e8f5e9" };
  const isHigh = scoreResults.some((s) => {
    const c = (s.color || "").toLowerCase().replace(/[^a-f0-9]/g, "");
    const l = (s.label || "").toLowerCase();
    return (
      c.includes("d93025") ||
      c.includes("e53935") ||
      c.includes("f44336") ||
      l.includes("สูง") ||
      l.includes("รุนแรง")
    );
  });
  const isMed = scoreResults.some((s) => {
    const c = (s.color || "").toLowerCase().replace(/[^a-f0-9]/g, "");
    const l = (s.label || "").toLowerCase();
    return (
      c.includes("fbbc04") ||
      c.includes("ff9800") ||
      l.includes("ปานกลาง") ||
      l.includes("เฝ้าระวัง")
    );
  });
  if (isHigh)
    return { label: "เสี่ยงสูง", color: "var(--suth-danger)", bg: "#fce4ec" };
  if (isMed)
    return {
      label: "เฝ้าระวัง",
      color: "var(--suth-action-ink)",
      bg: "#fff3e0",
    };
  return { label: "ปกติ", color: "var(--suth-success)", bg: "#e8f5e9" };
};

export const formatAnswerValue = (raw) => {
  if (raw === null || raw === undefined) return "-";
  let val = raw;
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {}
  }
  if (Array.isArray(val))
    return val.map((v) => stripHtml(String(v))).join(", ");
  if (typeof val === "object" && val !== null) {
    const entries = Object.entries(val);
    if (entries.length === 0) return "-";
    return entries
      .map(([k, v]) => `${stripHtml(String(k))}: ${stripHtml(String(v))}`)
      .join("  |  ");
  }
  return stripHtml(String(val));
};

export const isDisplayableTableAnswer = (value) =>
  Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0,
  );

// เช็คประเภทคำถาม
const PHONE_KEYWORDS = ["เบอร์", "โทรศัพท์", "phone", "tel", "mobile"];
const APPT_KEYWORDS = [
  "นัดหมาย",
  "ช่วงเวลา",
  "สะดวก",
  "appointment",
  "รับบริการ",
];

export const isPhoneQuestion = (title) =>
  PHONE_KEYWORDS.some((k) => (title || "").toLowerCase().includes(k));
export const isApptQuestion = (title) =>
  !isPhoneQuestion(title) &&
  APPT_KEYWORDS.some((k) => (title || "").toLowerCase().includes(k));
export const isEditableAnswer = (title) =>
  isPhoneQuestion(title) || isApptQuestion(title);
