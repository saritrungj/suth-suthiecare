import { toDisplayText } from "./textPresentation.js";

// Muted orange carries the brand; teal, blue and sage distinguish categories.
// Explicit scoring-rule colors below retain their clinical meaning.
export const CHART_COLORS = ["#c4814f", "#588d88", "#6b8ba6", "#828e60"];
export const chartQuestions = (questions = []) =>
  questions.flatMap((q) => [
    ...(![
      "section",
      "header",
      "description",
      "image",
      "paragraph_description",
    ].includes(q.type) && q.id != null
      ? [q]
      : []),
    ...chartQuestions(q.questions || []),
    ...chartQuestions(q.subQuestions || []),
  ]);
const blank = (value) => value == null || value === "";
function values(value, prefix = "", question = {}) {
  if (Array.isArray(value))
    return [...new Set(value.flatMap((v) => values(v, prefix, question)))];
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, v]) => {
      const label =
        question.rows?.[key] ||
        question.subQuestions?.find((q) => String(q.id) === key)?.title ||
        key;
      return values(v, prefix ? `${prefix} / ${label}` : label, question);
    });
  if (blank(value)) return [];
  const text = toDisplayText(String(value));
  return text ? [prefix ? `${toDisplayText(prefix)}: ${text}` : text] : [];
}
export function aggregateChart(rows = [], config = {}, question = {}) {
  const groups = new Map();
  for (const row of rows) {
    const answer = Object.hasOwn(row, "answer") ? row.answer : row.name;
    const raw = config.answerPath
      ? answer &&
        typeof answer === "object" &&
        Object.hasOwn(answer, config.answerPath)
        ? answer[config.answerPath]
        : config.answerPath
            .split(".")
            .reduce((value, key) => value?.[key], answer)
      : answer;
    let labels =
      config.mode === "result" ? values(row.result) : values(raw, "", question);
    if (config.mode === "result" && !labels.length) labels = ["ยังไม่มีผลสรุป"];
    if (!labels.length && config.includeEmpty) labels = ["ไม่ระบุ"];
    const dateLabel =
      config.groupBy && /^\d{4}-\d{2}-\d{2}$/.test(row.submitted_date || "")
        ? row.submitted_date.slice(0, config.groupBy === "month" ? 7 : 10)
        : null;
    if (config.groupBy) labels = labels.length && dateLabel ? [dateLabel] : [];
    for (const label of new Set(labels)) {
      const item = groups.get(label) || {
        name: label,
        value: 0,
        total: 0,
        count: 0,
      };
      if (["sum", "average"].includes(config.aggregation)) {
        if (typeof raw === "object" || typeof raw === "boolean" || blank(raw))
          continue;
        const number = Number(raw);
        if (!Number.isFinite(number)) continue;
        // Numeric summaries are a single measure, not one group per number.
        const key = dateLabel || "สรุปค่าตัวเลข";
        const numeric = groups.get(key) || {
          name: key,
          value: 0,
          total: 0,
          count: 0,
        };
        numeric.total += number;
        numeric.count++;
        groups.set(key, numeric);
        break;
      }
      item.value += Number.isFinite(row.value) ? row.value : 1;
      groups.set(label, item);
    }
  }
  let data = [...groups.values()].map((item, index) => ({
    name: item.name,
    value:
      config.aggregation === "average"
        ? item.total / item.count
        : config.aggregation === "sum"
          ? item.total
          : item.value,
    color:
      question.scoringRules?.find((r) => toDisplayText(r.label) === item.name)
        ?.color || CHART_COLORS[index % CHART_COLORS.length],
  }));
  if (config.sort === "label")
    data.sort((a, b) => a.name.localeCompare(b.name, "th"));
  else if (config.sort !== "original")
    data.sort((a, b) =>
      config.sort === "asc" ? a.value - b.value : b.value - a.value,
    );
  return data;
}
