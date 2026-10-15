// Shared presentation helpers for the case queue, the answer table and the
// case drawer. Risk is read from the score colors and labels the form
// builder writes (red/orange/green and the words สูง / ปานกลาง).

import { toDisplayText } from '../../utils/textPresentation.js';

const HIGH_COLORS = [
  "d93025",
  "e53935",
  "f44336",
  "ef4444",
  "dc2626",
  "ff0000",
  "red",
];
const MEDIUM_COLORS = ["fbbc04", "ff9800", "f59e0b", "orange", "yellow"];

export const stripHtml = toDisplayText;

// "สูง" | "ปานกลาง" | "ต่ำ" from the score results, or null when unscored.
export function riskFromScores(scoreResults = []) {
  if (!scoreResults.length) return null;
  const hit = (colors, word) =>
    scoreResults.some((s) => {
      const c = s.color?.toLowerCase() || "";
      return colors.some((x) => c.includes(x)) || s.label?.includes(word);
    });
  if (hit(HIGH_COLORS, "สูง")) return "สูง";
  if (hit(MEDIUM_COLORS, "ปานกลาง")) return "ปานกลาง";
  return "ต่ำ";
}

// The risk a row shows: the person view prefers the staff-set overall risk.
export function rowRisk(row, viewMode = "master") {
  const summary = row.summary_data || {};
  const scored = riskFromScores(summary.score_results || []);
  if (viewMode === "master")
    return (
      scored ||
      row.overall_risk ||
      row.risk_level ||
      summary.overall_risk ||
      "ประเมินใหม่"
    );
  return scored || row.risk_level || "ไม่ระบุ";
}

// Level used for styling and ordering: high, medium, low, or none.
export function riskLevel(risk) {
  if (!risk) return "none";
  const text = String(risk);
  if (
    text.includes("สูง") ||
    text.includes("รุนแรง") ||
    text.includes("ระดับ 3")
  )
    return "high";
  if (text.includes("ปานกลาง") || text.includes("ระดับ 2")) return "medium";
  if (
    text.includes("ต่ำ") ||
    text.includes("ปกติ") ||
    text.includes("น้อย") ||
    text.includes("ระดับ 1")
  )
    return "low";
  return "none";
}

export const RISK_SHORT = {
  high: "สูง",
  medium: "ปานกลาง",
  low: "ต่ำ",
};

// Status tone for the badge: new, waiting, closed, or active follow-up.
export function statusTone(status) {
  if (!status) return "new";
  if (status.includes("ปิดเคส")) return "closed";
  if (status.includes("รอ")) return "waiting";
  if (status.includes("ติดต่อไม่ได้") || status.includes("ปฏิเสธ"))
    return "attention";
  return "active";
}

export const caseCode = (row) =>
  row.master_case_id
    ? `MC-${String(row.master_case_id).padStart(4, "0")}`
    : `CASE-${String(row.id).padStart(4, "0")}`;

export const personName = (row) => {
  const summary = row.summary_data || {};
  return summary.display_name && summary.display_name !== "-"
    ? stripHtml(summary.display_name)
    : row.submitted_by?.display_name || "ไม่ระบุชื่อผู้ป่วย";
};

export const formatCaseDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    year: "2-digit",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const RISK_ORDER = { high: 0, medium: 1, low: 2, none: 3 };

// Work order for the follow-up queue: open cases before closed ones, higher
// risk first, then the most recent submission.
export function prioritizeCases(rows, viewMode = "master") {
  const time = (row) =>
    new Date(
      row.submitted_at || row.updated_at || row.createdAt || 0,
    ).getTime();
  return [...rows].sort((a, b) => {
    const closed = (row) => (statusTone(row.status) === "closed" ? 1 : 0);
    return (
      closed(a) - closed(b) ||
      RISK_ORDER[riskLevel(rowRisk(a, viewMode))] -
        RISK_ORDER[riskLevel(rowRisk(b, viewMode))] ||
      time(b) - time(a)
    );
  });
}
