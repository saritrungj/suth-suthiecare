import { FiX } from "react-icons/fi";
import "./DataPanel.css";

const fmt = (n) => Number(n || 0).toLocaleString("th-TH");

// The line between a list's toolbar and its table: what range is showing,
// and every active filter as a removable chip, so filters hidden in the
// "ตัวกรองเพิ่มเติม" menu stay visible. `chips` is a list of
// { key, label, value, onRemove }; empty values are skipped.
export default function ResultSummary({
  pagination,
  chips = [],
  onClearAll,
  loading = false,
}) {
  const active = chips.filter((chip) => chip && chip.value);
  const total = Number(pagination?.total || 0);
  const page = Number(pagination?.page || 1);
  const limit = Number(pagination?.limit || total || 1);
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(page * limit, total);
  return (
    <div className="dz-result">
      <p className="dz-result__count" aria-live="polite">
        {loading
          ? "กำลังโหลดรายการ…"
          : total
            ? `แสดง ${fmt(from)}–${fmt(to)} จาก ${fmt(total)} รายการ`
            : "ไม่พบรายการ"}
      </p>
      {active.length > 0 && (
        <ul className="dz-chips" aria-label="ตัวกรองที่ใช้อยู่">
          {active.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                className="dz-chip"
                onClick={chip.onRemove}
                aria-label={`ลบตัวกรอง ${chip.label}: ${chip.value}`}
              >
                <span className="dz-chip__label">{chip.label}:</span>
                <strong>{chip.value}</strong>
                <FiX aria-hidden="true" />
              </button>
            </li>
          ))}
          {active.length > 1 && onClearAll && (
            <li>
              <button
                type="button"
                className="dz-chip-clear"
                onClick={onClearAll}
              >
                ล้างทั้งหมด
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// The option label for a value, for chip text.
export const optionLabel = (options, value) =>
  options.find((option) => String(option.value) === String(value))?.label ??
  value;
