import { useEffect, useRef } from "react";
import { toDisplayText } from "../utils/textPresentation.js";
import { FiChevronDown, FiSliders } from "react-icons/fi";

// Secondary filters for a list page. Filters apply as soon as they change;
// this menu only holds them. `onClear` resets every secondary filter, and the
// menu closes on an outside click or Escape, handing focus back to the trigger.
export default function FilterDropdown({
  children,
  activeCount = 0,
  label = "ตัวกรองเพิ่มเติม",
  title = "ตัวกรองเพิ่มเติม",
  onClear,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      const el = ref.current;
      if (el?.open && !el.contains(event.target)) el.open = false;
    };
    const onKeyDown = (event) => {
      const el = ref.current;
      if (event.key !== "Escape" || !el?.open) return;
      el.open = false;
      el.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const close = () => {
    if (!ref.current) return;
    ref.current.open = false;
    ref.current.querySelector("summary")?.focus();
  };

  return (
    <details
      ref={ref}
      className={"filter-more" + (activeCount > 0 ? " has-active" : "")}
    >
      <summary className="filter-more__trigger">
        <span className="filter-more__icon" aria-hidden="true">
          <FiSliders />
        </span>
        <span className="filter-more__label">{toDisplayText(label)}</span>
        {activeCount > 0 && (
          <strong aria-label={`กำลังใช้ตัวกรอง ${activeCount} รายการ`}>
            {activeCount}
          </strong>
        )}
        <FiChevronDown className="filter-more__chevron" aria-hidden="true" />
      </summary>
      <div
        className="filter-more__menu"
        role="group"
        aria-label={toDisplayText(title)}
      >
        <div className="filter-more__head">
          <strong>{toDisplayText(title)}</strong>
          {activeCount > 0 && (
            <span className="filter-more__count">ใช้อยู่ {activeCount}</span>
          )}
        </div>
        <div className="filter-more__fields">{children}</div>
        <div className="filter-more__foot">
          <button
            type="button"
            className="filter-more__clear"
            onClick={onClear}
            disabled={!activeCount || !onClear}
          >
            ล้างตัวกรอง
          </button>
          <button type="button" className="filter-more__done" onClick={close}>
            ปิด
          </button>
        </div>
      </div>
    </details>
  );
}

// A labelled control inside the menu: the label sits above the field.
export function FilterField({ label, children }) {
  return (
    <div className="filter-more__field">
      <span>{toDisplayText(label)}</span>
      {children}
    </div>
  );
}
