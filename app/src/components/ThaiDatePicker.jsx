import { useEffect, useId, useRef, useState } from "react";
import {
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiX,
} from "react-icons/fi";
import { bangkokDateKey } from "../utils/caseDateFilter";
import { isoToThai } from "../utils/thaiDate";
import "./ThaiDatePicker.css";

const MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const MONTHS_SHORT = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (iso) => {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
// Moves an ISO date by whole days without touching the time zone.
const shift = (iso, days) => {
  const { y, m, d } = parse(iso);
  const date = new Date(Date.UTC(y, m, d + days));
  return keyOf(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};
const splitValue = (value, withTime) => {
  const text = String(value || "");
  if (!withTime) return { date: text.slice(0, 10), time: "" };
  const m = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  return { date: m?.[1] || "", time: m?.[2] || "" };
};

// A Buddhist-era date field with a calendar in the app's own look.
// - value: "YYYY-MM-DD" (or "YYYY-MM-DDTHH:mm" with `withTime`), or "".
// - rangeStart/rangeEnd tint the days between a from/to pair.
// - allowFuture={false} caps the calendar at today.
// - iconOnly renders just a calendar button, for fields people also type in.
// The header title opens a month grid, and its year a year grid, so far-off
// dates such as birth dates are a few taps away.
export default function ThaiDatePicker({
  label,
  value,
  onChange,
  min,
  max,
  rangeStart,
  rangeEnd,
  align = "start",
  placeholder = "เลือกวันที่",
  allowFuture = true,
  withTime = false,
  iconOnly = false,
  disabled = false,
  defaultTime = "09:00",
}) {
  const today = bangkokDateKey(new Date());
  const { date, time } = splitValue(value, withTime);
  const effectiveMax = !allowFuture && (!max || max > today) ? today : max;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days");
  const [dropUp, setDropUp] = useState(false);
  const [view, setView] = useState(() => parse(date) || parse(today));
  const [focusKey, setFocusKey] = useState(date || today);
  const rootRef = useRef(null);
  const gridRef = useRef(null);
  const triggerRef = useRef(null);
  const dialogId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const start =
      date || (effectiveMax && today > effectiveMax ? effectiveMax : today);
    setView(parse(start));
    setFocusKey(start);
    setMode("days");
    setDropUp(false);
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // Re-centre on the value each time the calendar opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Place the open calendar inside the page's own scroll area (the admin
  // shell keeps a toolbar above it): below the field by default, above it
  // only when it really fits there, otherwise scroll it into view.
  useEffect(() => {
    if (!open) return undefined;
    const frame = requestAnimationFrame(() => {
      const pop = rootRef.current?.querySelector(".tdp-pop");
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!pop || !trigger) return;
      let box = { top: 0, bottom: window.innerHeight };
      for (let el = rootRef.current.parentElement; el; el = el.parentElement) {
        if (/(auto|scroll|hidden)/.test(getComputedStyle(el).overflowY)) {
          const r = el.getBoundingClientRect();
          box = {
            top: Math.max(0, r.top),
            bottom: Math.min(window.innerHeight, r.bottom),
          };
          break;
        }
      }
      const need = pop.getBoundingClientRect().height + 12;
      if (trigger.bottom + need > box.bottom && trigger.top - need >= box.top)
        setDropUp(true);
      else pop.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (open && mode === "days")
      gridRef.current
        ?.querySelector(`[data-day="${focusKey}"]`)
        ?.focus({ preventScroll: true });
  }, [open, focusKey, view, mode]);

  const allowed = (key) =>
    (!min || key >= String(min).slice(0, 10)) &&
    (!effectiveMax || key <= String(effectiveMax).slice(0, 10));
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const emit = (nextDate, nextTime) => {
    if (!nextDate) return onChange("");
    onChange(withTime ? `${nextDate}T${nextTime || defaultTime}` : nextDate);
  };
  const pick = (key) => {
    if (!allowed(key)) return;
    emit(key, time);
    if (!withTime) close();
    else setFocusKey(key);
  };
  const moveFocus = (key) => {
    const p = parse(key);
    setFocusKey(key);
    if (p.y !== view.y || p.m !== view.m) setView({ y: p.y, m: p.m, d: 1 });
  };
  const stepMonth = (delta) => {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1));
    const next = { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: 1 };
    setView(next);
    const f = parse(focusKey);
    const last = new Date(Date.UTC(next.y, next.m + 1, 0)).getUTCDate();
    setFocusKey(keyOf(next.y, next.m, Math.min(f?.d || 1, last)));
  };
  const showMonth = (y, m) => {
    setView({ y, m, d: 1 });
    const f = parse(focusKey);
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    setFocusKey(keyOf(y, m, Math.min(f?.d || 1, last)));
    setMode("days");
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (mode !== "days") setMode("days");
      else close();
      return;
    }
    if (mode !== "days") return;
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves && e.target.dataset?.day) {
      e.preventDefault();
      moveFocus(shift(focusKey, moves[e.key]));
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      stepMonth(e.key === "PageUp" ? -1 : 1);
    }
  };

  // Six weeks starting on the Sunday on or before the 1st.
  const first = new Date(Date.UTC(view.y, view.m, 1));
  const startKey = shift(keyOf(view.y, view.m, 1), -first.getUTCDay());
  const days = Array.from({ length: 42 }, (_, i) => shift(startKey, i));
  const lo = rangeStart ? String(rangeStart).slice(0, 10) : "";
  const hi = rangeEnd ? String(rangeEnd).slice(0, 10) : "";
  const decadeStart = view.y - (view.y % 12);
  const maxYear = effectiveMax ? parse(effectiveMax)?.y : null;
  const minYear = min ? parse(min)?.y : null;
  const shown =
    (isoToThai(date) || "") + (withTime && date && time ? ` ${time} น.` : "");

  return (
    <div
      className={
        "tdp" +
        (open ? " is-open" : "") +
        (iconOnly ? " is-icon" : "") +
        (dropUp ? " is-up" : "") +
        " align-" +
        align
      }
      ref={rootRef}
    >
      <button
        type="button"
        ref={triggerRef}
        className={"tdp-trigger" + (date ? " has-value" : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        aria-label={
          iconOnly
            ? "เปิดปฏิทิน" + label
            : label + ": " + (shown || "ยังไม่เลือก")
        }
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <FiCalendar aria-hidden="true" />
        {!iconOnly && <span>{shown || placeholder}</span>}
      </button>
      {/* Native field kept for forms and tests that set the value directly. */}
      {!iconOnly && (
        <input
          className="tdp-native"
          type={withTime ? "datetime-local" : "date"}
          tabIndex={-1}
          aria-hidden="true"
          value={value || ""}
          min={min || undefined}
          max={effectiveMax || undefined}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {open && (
        <div
          className="tdp-pop"
          id={dialogId}
          role="dialog"
          aria-label={"เลือก" + label}
          onKeyDown={onKeyDown}
        >
          <div className="tdp-head">
            <button
              type="button"
              className="tdp-nav"
              aria-label={
                mode === "days"
                  ? "เดือนก่อนหน้า"
                  : mode === "months"
                    ? "ปีก่อนหน้า"
                    : "ช่วงปีก่อนหน้า"
              }
              onClick={() =>
                mode === "days"
                  ? stepMonth(-1)
                  : setView({
                      ...view,
                      y: view.y - (mode === "months" ? 1 : 12),
                    })
              }
            >
              <FiChevronLeft aria-hidden="true" />
            </button>
            {mode === "days" && (
              <button
                type="button"
                className="tdp-month"
                aria-live="polite"
                aria-label={`${MONTHS[view.m]} ${view.y + 543} เลือกเดือนและปี`}
                onClick={() => setMode("months")}
              >
                {MONTHS[view.m]} {view.y + 543}
              </button>
            )}
            {mode === "months" && (
              <button
                type="button"
                className="tdp-month"
                aria-live="polite"
                aria-label={`ปี ${view.y + 543} เลือกปี`}
                onClick={() => setMode("years")}
              >
                พ.ศ. {view.y + 543}
              </button>
            )}
            {mode === "years" && (
              <strong className="tdp-month" aria-live="polite">
                {decadeStart + 543} – {decadeStart + 11 + 543}
              </strong>
            )}
            <button
              type="button"
              className="tdp-nav"
              aria-label={
                mode === "days"
                  ? "เดือนถัดไป"
                  : mode === "months"
                    ? "ปีถัดไป"
                    : "ช่วงปีถัดไป"
              }
              onClick={() =>
                mode === "days"
                  ? stepMonth(1)
                  : setView({
                      ...view,
                      y: view.y + (mode === "months" ? 1 : 12),
                    })
              }
            >
              <FiChevronRight aria-hidden="true" />
            </button>
          </div>

          {mode === "days" && (
            <div className="tdp-grid" role="grid" ref={gridRef}>
              <div className="tdp-row" role="row">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={w}
                    role="columnheader"
                    className={"tdp-weekday" + (i === 0 ? " is-sun" : "")}
                  >
                    {w}
                  </span>
                ))}
              </div>
              {Array.from({ length: 6 }, (_, row) => (
                <div className="tdp-row" role="row" key={row}>
                  {days.slice(row * 7, row * 7 + 7).map((key) => {
                    const p = parse(key);
                    const outside = p.m !== view.m;
                    const ok = allowed(key);
                    const selected = key === date;
                    const inRange = lo && hi && key > lo && key < hi;
                    const edge = (lo && key === lo) || (hi && key === hi);
                    const cls = ["tdp-day"];
                    if (outside) cls.push("is-outside");
                    if (key === today) cls.push("is-today");
                    if (selected) cls.push("is-selected");
                    else if (edge) cls.push("is-edge");
                    // The range is a band on the cells; start and end close it.
                    const hasRange = lo && hi && lo < hi;
                    // Days of other months stay off the band, so it closes
                    // on the month's first and last day too.
                    const cell = ["tdp-cell"];
                    const banded =
                      hasRange &&
                      !outside &&
                      (inRange || key === lo || key === hi);
                    if (banded) {
                      const col = days.indexOf(key) % 7;
                      const prev = days[days.indexOf(key) - 1];
                      const next = days[days.indexOf(key) + 1];
                      cell.push("in-range");
                      if (key === lo) cell.push("range-start");
                      else if (col === 0 || !prev || parse(prev).m !== view.m)
                        cell.push("cap-start");
                      if (key === hi) cell.push("range-end");
                      else if (col === 6 || !next || parse(next).m !== view.m)
                        cell.push("cap-end");
                    }
                    return (
                      <span
                        role="gridcell"
                        key={key}
                        className={cell.join(" ")}
                      >
                        <button
                          type="button"
                          data-day={key}
                          className={cls.join(" ")}
                          tabIndex={key === focusKey ? 0 : -1}
                          disabled={!ok}
                          aria-pressed={selected}
                          aria-label={
                            p.d +
                            " " +
                            MONTHS[p.m] +
                            " " +
                            (p.y + 543) +
                            (key === today ? " (วันนี้)" : "")
                          }
                          onClick={() => pick(key)}
                          onFocus={() => setFocusKey(key)}
                        >
                          {p.d}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {mode === "months" && (
            <div className="tdp-choices" role="group" aria-label="เลือกเดือน">
              {MONTHS_SHORT.map((name, m) => {
                const lastDay = keyOf(
                  view.y,
                  m,
                  new Date(Date.UTC(view.y, m + 1, 0)).getUTCDate(),
                );
                const firstDay = keyOf(view.y, m, 1);
                const ok = allowed(lastDay) || allowed(firstDay);
                const current = parse(date);
                const isCurrent =
                  current && current.y === view.y && current.m === m;
                return (
                  <button
                    key={name}
                    type="button"
                    className={"tdp-choice" + (isCurrent ? " is-selected" : "")}
                    aria-label={MONTHS[m] + " " + (view.y + 543)}
                    disabled={!ok}
                    onClick={() => showMonth(view.y, m)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {mode === "years" && (
            <div className="tdp-choices" role="group" aria-label="เลือกปี">
              {Array.from({ length: 12 }, (_, i) => decadeStart + i).map(
                (y) => {
                  const ok =
                    (maxYear == null || y <= maxYear) &&
                    (minYear == null || y >= minYear);
                  const isCurrent = parse(date)?.y === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      className={
                        "tdp-choice" + (isCurrent ? " is-selected" : "")
                      }
                      disabled={!ok}
                      onClick={() => {
                        setView({ ...view, y });
                        setMode("months");
                      }}
                    >
                      {y + 543}
                    </button>
                  );
                },
              )}
            </div>
          )}

          {withTime && (
            <label className="tdp-time">
              <FiClock aria-hidden="true" />
              <span>เวลา</span>
              <input
                type="time"
                className="tdp-time__input"
                value={time}
                disabled={!date}
                onChange={(e) => emit(date, e.target.value)}
              />
            </label>
          )}

          <div className="tdp-foot">
            <button
              type="button"
              className="tdp-link"
              onClick={() => {
                onChange("");
                close();
              }}
              disabled={!value}
            >
              <FiX aria-hidden="true" /> ล้างวันที่
            </button>
            {withTime ? (
              <button
                type="button"
                className="tdp-today"
                onClick={() => close()}
              >
                เสร็จ
              </button>
            ) : (
              <button
                type="button"
                className="tdp-today"
                disabled={!allowed(today)}
                onClick={() => pick(today)}
              >
                วันนี้
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
