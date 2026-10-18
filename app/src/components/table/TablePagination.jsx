import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import SearchableSelect from "../SearchableSelect";
import "./TablePagination.css";

// One page-size list and one default for every management table.
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

// Visible page numbers with ellipses, always keeping the first, last and the
// two neighbours of the current page.
const pageWindow = (page, last) => {
  const pages = [];
  for (let p = 1; p <= last; p += 1) {
    if (p === 1 || p === last || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return pages;
};

export default function TablePagination({
  page,
  totalPages,
  total,
  limit,
  onPage,
  onLimit,
  pageSizes = PAGE_SIZES,
  label = "การแบ่งหน้ารายการ",
}) {
  if (!total) return null;
  const last = Math.max(totalPages, 1);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <nav className="tp-pagination" aria-label={label}>
      <div className="tp-pagination__size">
        <span>แสดง</span>
        <SearchableSelect
          value={limit}
          onChange={(event) => onLimit(Number(event.target.value))}
          aria-label="จำนวนรายการต่อหน้า"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </SearchableSelect>
        <span>รายการต่อหน้า</span>
      </div>
      <p className="tp-pagination__range" aria-live="polite">
        {from.toLocaleString("th-TH")}–{to.toLocaleString("th-TH")} จาก{" "}
        {total.toLocaleString("th-TH")} รายการ
      </p>
      <div className="tp-pagination__pages">
        <button
          type="button"
          className="tp-pagination__nav"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="หน้าก่อนหน้า"
        >
          <FiChevronLeft aria-hidden="true" />
        </button>
        {pageWindow(page, last).map((item, index) =>
          item === "…" ? (
            <span className="tp-pagination__gap" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <button
              type="button"
              key={item}
              className="tp-pagination__page"
              aria-current={item === page ? "page" : undefined}
              aria-label={`หน้า ${item}`}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="tp-pagination__nav"
          onClick={() => onPage(page + 1)}
          disabled={page >= last}
          aria-label="หน้าถัดไป"
        >
          <FiChevronRight aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
