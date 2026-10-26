// Periods the student list can show mental status for: the latest result as
// of today, a semester or a whole academic year (from the dates the school set
// for that year), or a custom date range.
import { bangkokDateKey } from "../../../utils/caseDateFilter";
import { formatThaiDate } from "./schoolUi";

export const LATEST_PERIOD = "latest";
export const CUSTOM_PERIOD = "custom";

// Whole-year range when the school set no semester dates: a Thai academic
// year runs from mid-May to mid-May.
const defaultYearRange = (year) => ({
  from: `${year - 543}-05-16`,
  to: `${year - 542}-05-15`,
});

// Options for the period select, newest year first.
export function periodOptions({ years = [], terms = {} } = {}) {
  const options = [{ value: LATEST_PERIOD, label: "ล่าสุด ณ วันนี้" }];
  for (const year of [...years].sort((a, b) => b - a)) {
    const set = terms[year];
    for (const semester of [2, 1])
      if (
        set?.[`term${semester}_starts_on`] &&
        set?.[`term${semester}_ends_on`]
      )
        options.push({
          value: `term:${year}:${semester}`,
          label: `ภาคเรียนที่ ${semester}/${year}`,
        });
    options.push({ value: `year:${year}`, label: `ทั้งปีการศึกษา ${year}` });
  }
  options.push({ value: CUSTOM_PERIOD, label: "กำหนดช่วงวันเอง" });
  return options;
}

// { from, to } for a period, or null while a custom range is incomplete.
// "latest" leaves both empty so the server reads up to today.
export function periodRange(value, academic = {}, custom = {}) {
  if (!value || value === LATEST_PERIOD) return { from: "", to: "" };
  if (value === CUSTOM_PERIOD) {
    if (!custom.to && !custom.from) return null;
    return { from: custom.from || "", to: custom.to || "" };
  }
  const [kind, yearText, semester] = value.split(":");
  const year = Number(yearText);
  const set = academic.terms?.[year];
  if (kind === "term" && set)
    return {
      from: set[`term${semester}_starts_on`],
      to: set[`term${semester}_ends_on`],
    };
  if (kind === "year")
    return set?.term1_starts_on && set?.term2_ends_on
      ? { from: set.term1_starts_on, to: set.term2_ends_on }
      : defaultYearRange(year);
  return { from: "", to: "" };
}

// One line telling staff which results the list is showing.
export function periodSummary(value, range, options) {
  const today = bangkokDateKey(new Date());
  if (!range || value === LATEST_PERIOD)
    return `ผลประเมินสุขภาพจิตครั้งล่าสุด ณ วันนี้ (${formatThaiDate(today)})`;
  const label =
    value === CUSTOM_PERIOD
      ? "ช่วงที่เลือก"
      : options.find((o) => o.value === value)?.label || "";
  const from = range.from ? formatThaiDate(range.from) : "เริ่มต้น";
  const to = formatThaiDate(range.to || today);
  return `ผลประเมินสุขภาพจิตครั้งล่าสุดใน${label} (${from} – ${to})`;
}
