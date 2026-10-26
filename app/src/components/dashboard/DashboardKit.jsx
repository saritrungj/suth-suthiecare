import { useId } from "react";
import { FiCalendar, FiCheck } from "react-icons/fi";
import {
  bangkokDateKey,
  formatBangkokDate,
  getCurrentMonthDateRange,
  normaliseDateRange,
} from "../../utils/caseDateFilter";
import { isoToThai } from "../../utils/thaiDate";
import ThaiDatePicker from "../ThaiDatePicker";
import "./DashboardKit.css";

// Shared pieces of the three dashboards (all organizations, hospital,
// school): a warm greeting band with a mood face, the date range pills and the
// count tiles. Counts come from the pages; nothing here fetches.

export const formatCount = (n) => Number(n || 0).toLocaleString("th-TH");

const greeting = (date = new Date()) => {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
  if (hour < 11) return "สวัสดีตอนเช้า";
  if (hour < 13) return "สวัสดีตอนเที่ยง";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
};

export function DashboardHero({ title, scope, note, tone = "calm", children }) {
  const today = formatBangkokDate(new Date(), "th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const frown = Boolean(note) && (tone === "alert" || tone === "warn");
  return (
    <header className="dz-hero">
      <div className="dz-hero__text">
        <p className="dz-hero__hello">
          {greeting()} · <span>{today}</span>
        </p>
        <h1 className="dz-hero__title">{title}</h1>
        {scope}
        {note && (
          <p className={"dz-hero__note tone-" + tone} role="status">
            {tone === "clear" && <FiCheck aria-hidden="true" />}
            {note}
          </p>
        )}
        {children}
      </div>
      {/* Both faces float side by side; the one that fits the moment is
          bright (smile when nothing waits, sad while high-risk or
          uncontacted cases remain), the other fades. The note carries the
          meaning in words. */}
      <div className="dz-hero__moods" aria-hidden="true">
        <span className={"dz-mood is-smile" + (frown ? "" : " is-on")}>😊</span>
        <span className={"dz-mood is-sad" + (frown ? " is-on" : "")}>😢</span>
      </div>
    </header>
  );
}

// Compact greeting band for every other admin page: title, description,
// organization scope and the page's own actions. No greeting line or mood
// faces; those belong to the dashboards.
export function PageHero({
  title,
  description,
  scope,
  actions,
  children,
  className = "",
  titleId,
}) {
  return (
    <header className={("dz-hero dz-hero--compact " + className).trim()}>
      <div className="dz-hero__text">
        <h1 className="dz-hero__title" id={titleId}>
          {title}
        </h1>
        {description && <p className="dz-hero__desc">{description}</p>}
        {scope}
        {children}
      </div>
      {actions && <div className="dz-hero__actions">{actions}</div>}
    </header>
  );
}

const shiftDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return bangkokDateKey(date);
};

export const DATE_PRESETS = [
  {
    key: "today",
    label: "วันนี้",
    range: () => ({ startDate: shiftDays(0), endDate: shiftDays(0) }),
  },
  {
    key: "7d",
    label: "7 วันล่าสุด",
    range: () => ({ startDate: shiftDays(6), endDate: shiftDays(0) }),
  },
  { key: "month", label: "เดือนนี้", range: () => getCurrentMonthDateRange() },
  {
    key: "30d",
    label: "30 วันล่าสุด",
    range: () => ({ startDate: shiftDays(29), endDate: shiftDays(0) }),
  },
  {
    key: "all",
    label: "ทุกช่วงเวลา",
    range: () => ({ startDate: "", endDate: "" }),
  },
];

export const describeRange = ({ startDate, endDate }) => {
  if (!startDate && !endDate) return "ทุกช่วงเวลา";
  if (startDate && startDate === endDate)
    return "วันที่ " + isoToThai(startDate);
  return (
    (isoToThai(startDate) || "เริ่มต้น") +
    " ถึง " +
    (isoToThai(endDate) || "ปัจจุบัน")
  );
};

// Preset pills plus a Buddhist-era from/to pair. `value` and `onChange` use
// ISO dates ({ startDate, endDate }); empty strings mean open-ended.
export function DateRangePills({ value, onChange, label = "ช่วงเวลา" }) {
  const id = useId();
  const active = DATE_PRESETS.find((p) => {
    const r = p.range();
    return r.startDate === value.startDate && r.endDate === value.endDate;
  });
  const set = (startDate, endDate) => {
    const [s, e] = normaliseDateRange(startDate, endDate);
    onChange({ startDate: s, endDate: e });
  };
  return (
    <div className="dz-range" role="group" aria-labelledby={id}>
      <span className="dz-range__label" id={id}>
        <FiCalendar aria-hidden="true" /> {label}
      </span>
      {/* Transparent by default; row toolbars lay the controls out as one line. */}
      <div className="dz-range__controls">
        <div className="dz-pills">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="dz-pill"
              aria-pressed={active?.key === p.key}
              onClick={() => onChange(p.range())}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className={active ? "dz-dates" : "dz-dates is-custom"}>
          <ThaiDatePicker
            label="ตั้งแต่วันที่"
            value={value.startDate}
            max={value.endDate}
            rangeStart={value.startDate}
            rangeEnd={value.endDate}
            onChange={(v) => set(v, value.endDate)}
          />
          <span className="dz-dates__sep">ถึง</span>
          <ThaiDatePicker
            label="ถึงวันที่"
            value={value.endDate}
            min={value.startDate}
            rangeStart={value.startDate}
            rangeEnd={value.endDate}
            align="end"
            onChange={(v) => set(value.startDate, v)}
          />
        </div>
      </div>
    </div>
  );
}

// One count. `tone` colors the icon bubble; urgent tiles fill with their
// tint only while the count is above zero, and say so in words when it is
// zero (risk is never color alone).
export function KpiTile({
  icon: Icon,
  label,
  value,
  unit,
  hint,
  tone = "neutral",
  urgent = false,
  clearText,
  isLoading,
  onClick,
}) {
  const clear = !isLoading && urgent && Number(value || 0) === 0;
  const Tag = onClick ? "button" : "div";
  const classes = ["dz-kpi", "tone-" + tone];
  if (urgent) classes.push("is-urgent");
  if (clear) classes.push("is-clear");
  if (onClick) classes.push("is-link");
  const hintText = clear ? clearText : hint;
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={classes.join(" ")}
    >
      <span className="dz-kpi__icon" aria-hidden="true">
        {clear ? <FiCheck /> : <Icon />}
      </span>
      <span className="dz-kpi__label">{label}</span>
      {isLoading ? (
        <span className="dz-skeleton" aria-hidden="true" />
      ) : (
        <strong className="dz-kpi__value">
          {formatCount(value)}
          {unit && <small>{unit}</small>}
        </strong>
      )}
      {hintText && !isLoading && (
        <span className="dz-kpi__hint">{hintText}</span>
      )}
    </Tag>
  );
}

export function DzSection({
  title,
  aside,
  description,
  children,
  className = "",
  ...rest
}) {
  return (
    <section className={("dz-section " + className).trim()} {...rest}>
      {(title || aside) && (
        <div className="dz-section__head">
          <div>
            {title && <h2 className="dz-section__title">{title}</h2>}
            {description && <p className="dz-section__desc">{description}</p>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
