import { FiChevronDown, FiSliders } from "react-icons/fi";

/** Groups secondary filters without hiding the active, high-frequency controls. */
export default function FilterDropdown({
  children,
  activeCount = 0,
  label = "ตัวกรองเพิ่มเติม",
}) {
  return (
    <details className="filter-more">
      <summary className="filter-more__trigger">
        <span className="filter-more__icon" aria-hidden="true">
          <FiSliders />
        </span>
        <span className="filter-more__label">{label}</span>
        {activeCount > 0 && (
          <strong aria-label={`กำลังใช้ตัวกรอง ${activeCount} รายการ`}>
            {activeCount}
          </strong>
        )}
        <FiChevronDown className="filter-more__chevron" aria-hidden="true" />
      </summary>
      <div className="filter-more__menu">{children}</div>
    </details>
  );
}
