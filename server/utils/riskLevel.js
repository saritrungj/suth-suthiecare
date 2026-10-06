// Risk level of one assessment, read from its score results. Mirrors
// getRiskInfo in app/src/pages/assessment/history/historyUtils.js so the
// server and the patient history agree: the scoring rule colours and labels
// that the form builder writes are the only risk signal stored today.
const HIGH_COLORS = ["d93025", "e53935", "f44336"];
const MEDIUM_COLORS = ["fbbc04", "ff9800"];

const normalizeColor = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-f0-9]/g, "");

function scoreResultsOf(summary) {
  if (!summary || typeof summary !== "object") return [];
  if (Array.isArray(summary.score_results)) return summary.score_results;
  if (Array.isArray(summary.scoreResults)) return summary.scoreResults;
  return [];
}

// Returns "high", "medium" or "normal".
function riskLevelOf(scoreResults = []) {
  const results = Array.isArray(scoreResults) ? scoreResults : [];
  const matches = (colors, words) =>
    results.some((result) => {
      const color = normalizeColor(result?.color);
      const label = String(result?.label || "").toLowerCase();
      return (
        colors.some((code) => color.includes(code)) ||
        words.some((word) => label.includes(word))
      );
    });
  if (matches(HIGH_COLORS, ["สูง", "รุนแรง"])) return "high";
  if (matches(MEDIUM_COLORS, ["ปานกลาง", "เฝ้าระวัง"])) return "medium";
  return "normal";
}

const RISK_RANK = { normal: 0, medium: 1, high: 2 };
const higherRisk = (a, b) => (RISK_RANK[b] > RISK_RANK[a] ? b : a);

module.exports = { riskLevelOf, scoreResultsOf, higherRisk, RISK_RANK };
