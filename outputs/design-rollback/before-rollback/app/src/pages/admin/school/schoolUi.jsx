import { Badge as UiBadge } from '../../../components/ui/index.jsx';
import { TextInput as UiTextInput, PageHeader as UiPageHeader, Button as UiButton } from '../../../components/ui/index.jsx';
import { Dialog, EmptyRow, LoadingRows } from '../../../components/ui/index.jsx';
import SearchableSelect from '../../../components/SearchableSelect';
import { toDisplayText } from '../../../utils/textPresentation.js';
import {useMasterOptions} from "../../../components/MasterSelect";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMediaQuery } from "../../../components/useMediaQuery";
import { RiskPill } from "../../../components/case/CaseDrawer";
import {
  FiChevronLeft,
  FiChevronRight,
  FiSearch,
} from "react-icons/fi";
import FilterDropdown from "../../../components/FilterDropdown";
import { getSchools } from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  isoToThai,
  maskThaiDate,
  parseThaiDate,
} from "../../../utils/thaiDate";

export const RISK_LABELS = {
  high: "เสี่ยงสูง",
  medium: "เฝ้าระวัง",
  normal: "ปกติ",
  none: "ยังไม่มีผลประเมิน",
};

export const GENDER_LABELS = { male: "ชาย", female: "หญิง", other: "อื่น ๆ" };

export const STUDENT_STATUS_LABELS = {
  active: "กำลังศึกษา",
  graduated: "จบการศึกษา",
  on_leave: "ลาพัก",
  withdrawn: "ลาออก",
  waived: "สละสิทธิ์",
  transferred: "ย้ายโรงเรียน",
  inactive: "ปิดใช้งาน",
};

export function useStudentStatusLabels(){
 const options=useMasterOptions("student_status",Object.entries(STUDENT_STATUS_LABELS).filter(([code])=>!["inactive","transferred"].includes(code)).map(([code,label])=>({code,label})));
 const labels=Object.fromEntries(options.map(o=>[o.code,o.label]));
 for(const [code,label] of Object.entries(STUDENT_STATUS_LABELS))if(!Object.hasOwn(labels,code))labels[code]=label;
 return labels;
}

export const TEACHER_ROLE_LABELS = {
  homeroom: "ครูประจำชั้น",
  co_homeroom: "ครูประจำชั้นร่วม",
  counselor: "ครูแนะแนว",
};

// Current Thai academic year: a new year starts in mid-May.
export const currentAcademicYear = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric' }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return Number(parts.year) + 543 - (Number(parts.month) < 5 ? 1 : 0);
};

export const formatThaiDate = (value) => {
  if (!value) return "-";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// For values placed into SweetAlert html.
export const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export const studentName = (student) =>
  [student?.prefix, student?.first_name, student?.last_name]
    .filter(Boolean)
    .join(" ") || "-";

export const classroomLabel = (student) =>
  student?.classroom_name
    ? `${student.grade_name || ""} ห้อง ${student.classroom_name}`.trim()
    : "ยังไม่ระบุห้อง";

const RISK_PILL_LEVEL = {
  high: "high",
  medium: "medium",
  normal: "low",
  none: "none",
};

// Risk as icon shape + word + color, the same pill as the case lists.
export function RiskBadge({ risk }) {
  const options=useMasterOptions("risk_level",Object.entries(RISK_LABELS).map(([code,label])=>({code,label})));
  if (!risk) return <UiBadge className="sch-badge">-</UiBadge>;
  return (
    <RiskPill
      level={RISK_PILL_LEVEL[risk] || "none"}
      label={options.find(o=>o.code===risk)?.label || RISK_LABELS[risk] || risk}
    />
  );
}

// Filter bar pieces, laid out by the shared filter system
// (styles/filter-system.css): the search and the most used selects stay
// visible, the rest go into "ตัวกรองเพิ่มเติม".
export function SearchField({ label, placeholder, value, onChange }) {
  return (
    <label className="sch-search-group">
      <FiSearch className="sch-filter-icon" aria-hidden="true" />
      <span className="sr-only">{toDisplayText(label)}</span>
      <UiTextInput
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 80))}
      />
    </label>
  );
}

// A select shown in the filter row: the first option names what it filters.
export function BarSelect({ label, value, onChange, disabled, children }) {
  return (
    <label className="sch-bar-select">
      <span className="sr-only">{toDisplayText(label)}</span>
      <SearchableSelect
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </SearchableSelect>
    </label>
  );
}

// A labelled select inside the "ตัวกรองเพิ่มเติม" menu.
export function MenuSelect({ label, value, onChange, children }) {
  return (
    <label className="sch-native-filter">
      <span>{toDisplayText(label)}</span>
      <SearchableSelect value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </SearchableSelect>
    </label>
  );
}

export { FilterDropdown };

export function PageHeader({ title, description, children }) {
  return <UiPageHeader className="sch-header" title={title} description={description} actions={children} />;
}

// Table states match the user management table (pulse bars, centered empty
// message with an icon).
export { EmptyRow, LoadingRows };

// Dialog shell on top of the shared .ui-modal styles, rendered at the end of
// <body>. Focus handling (first field, Tab trap, inert page, focus return,
// Escape for the top dialog) comes from useDialogFocus. A click on the
// backdrop closes it.
export function SchoolModal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "large",
}) {
  return <Dialog title={title} subtitle={subtitle} onClose={onClose} footer={footer}
    size={size} className="sch-modal">{children}</Dialog>;
}

// Horizontal scroll area for a wide table: focusable so keyboard users can
// scroll it, and named so screen readers announce what it holds.
export function TableScroll({ label, children, className = "" }) {
  return (
    <div
      className={`sch-table-wrap ${className}`}
      tabIndex={0}
      role="region"
      aria-label={toDisplayText(label)}
    >
      {children}
    </div>
  );
}

export { useMediaQuery };

// Visible "*" for a required field; the input itself carries aria-required.
export function RequiredMark() {
  return (
    <span className="sch-required" aria-hidden="true">
      *
    </span>
  );
}

export function RequiredNote() {
  return (
    <p className="sch-required-note sch-full">
      ช่องที่มีเครื่องหมาย <RequiredMark /> ต้องกรอก
    </p>
  );
}

// Inline errors for required fields. The browser's own bubble still shows
// and focuses the first invalid field; this keeps the message next to the
// field and links it with aria-describedby / aria-invalid.
export function useFieldErrors() {
  const baseId = useId();
  const [errors, setErrors] = useState({});
  const errorId = (name) => `${baseId}-${name}-error`;
  const bind = (name, message) => ({
    "aria-required": true,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": errors[name] ? errorId(name) : undefined,
    onInvalid: () => setErrors((current) => ({ ...current, [name]: message })),
    onInput: () =>
      setErrors((current) =>
        current[name] ? { ...current, [name]: undefined } : current,
      ),
  });
  const errorFor = (name) =>
    errors[name] ? (
      <small className="sch-field-error" id={errorId(name)}>
        {errors[name]}
      </small>
    ) : null;
  return { bind, errorFor, setErrors, errorId, errors };
}

const DATE_ERRORS = {
  format: "กรอกวันที่เป็น วว/ดด/ปปปป เช่น 31/05/2556",
  invalid: "ไม่มีวันที่นี้ในปฏิทิน ตรวจสอบวันและเดือนอีกครั้ง",
  future: "วันที่ต้องไม่เกินวันนี้",
  required: "กรุณากรอกวันที่",
};

// Date typed as วว/ดด/ปปปป (พ.ศ.). `value` and onChange use the API format
// YYYY-MM-DD (ค.ศ.); an incomplete or impossible date blocks the form
// submit through setCustomValidity and shows the reason under the field.
export function ThaiDateField({
  label,
  value,
  onChange,
  required = false,
  allowFuture = false,
  className = "sch-field",
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const inputRef = useRef(null);
  const [text, setText] = useState(() => isoToThai(value));
  const [touched, setTouched] = useState(false);
  const lastIso = useRef(value || "");

  // A new value from outside (another record opened) replaces the text.
  useEffect(() => {
    if ((value || "") !== lastIso.current) {
      lastIso.current = value || "";
      setText(isoToThai(value));
    }
  }, [value]);

  const parsed = parseThaiDate(text, { allowFuture });
  const errorKey = parsed.error || (required && !text.trim() ? "required" : "");
  const message = errorKey ? DATE_ERRORS[errorKey] : "";

  useEffect(() => {
    inputRef.current?.setCustomValidity(message);
  }, [message]);

  const showError = touched && Boolean(message);
  return (
    <div className={className}>
      <label htmlFor={inputId}>
        {toDisplayText(label)}
        {required && <RequiredMark />}
      </label>
      <UiTextInput
        ref={inputRef}
        id={inputId}
        inputMode="numeric"
        autoComplete="off"
        placeholder="วว/ดด/ปปปป"
        maxLength={10}
        value={text}
        required={required}
        aria-required={required || undefined}
        aria-invalid={showError || undefined}
        aria-describedby={showError ? `${errorId} ${hintId}` : hintId}
        onChange={(event) => {
          const next = maskThaiDate(event.target.value);
          setText(next);
          const result = parseThaiDate(next, { allowFuture });
          const iso = result.error ? "" : result.iso;
          lastIso.current = iso;
          onChange(iso);
        }}
        onBlur={() => setTouched(true)}
        onInvalid={() => setTouched(true)}
      />
      <small className="sch-field-hint" id={hintId}>
        ปีพุทธศักราช เช่น 31/05/2556
      </small>
      {showError && (
        <small className="sch-field-error" id={errorId}>
          {message}
        </small>
      )}
    </div>
  );
}

// Schools of the active organization plus the remembered selection.
export function useSchools() {
  const { activeOrganization } = usePermissions();
  const storageKey = `sch_selected_school_${activeOrganization}`;
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolId, setSchoolIdState] = useState(() => {
    try {
      return localStorage.getItem(storageKey) || "";
    } catch {
      return "";
    }
  });
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getSchools();
      setSchools(data || []);
      setSchoolIdState((current) => {
        if (current && data.some((school) => String(school.id) === current))
          return current;
        const first = data.find((school) => school.status === "active");
        return first ? String(first.id) : "";
      });
    } catch (err) {
      setError(
        err.response?.data?.message || "ไม่สามารถโหลดรายชื่อโรงเรียนได้",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  const setSchoolId = (value) => {
    setSchoolIdState(String(value || ""));
    try {
      localStorage.setItem(storageKey, String(value || ""));
    } catch {
      /* storage may be unavailable */
    }
  };
  return { schools, loading, error, schoolId, setSchoolId, reload };
}

export function Pagination({ pagination, onPage, onLimit }) {
  if (!pagination || !pagination.total) return null;
  const { page, total_pages: totalPages, total, limit } = pagination;
  return (
    <footer className="sch-pagination">
      <div className="sch-pagination-info">
        <span>แสดง</span>
        <SearchableSelect
          value={limit}
          onChange={(event) => onLimit(Number(event.target.value))}
          aria-label="จำนวนรายการต่อหน้า"
        >
          {[20, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </SearchableSelect>
        <span>จากทั้งหมด {total.toLocaleString("th-TH")} รายการ</span>
      </div>
      <div className="sch-pagination-controls">
        <UiButton variant="secondary" size="icon"
          type="button"
          className="sch-page-btn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="หน้าก่อนหน้า"
        >
          <FiChevronLeft aria-hidden="true" />
        </UiButton>
        <span>
          หน้า <strong>{page}</strong> จาก {Math.max(totalPages, 1)}
        </span>
        <UiButton variant="secondary" size="icon"
          type="button"
          className="sch-page-btn"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          aria-label="หน้าถัดไป"
        >
          <FiChevronRight aria-hidden="true" />
        </UiButton>
      </div>
    </footer>
  );
}
