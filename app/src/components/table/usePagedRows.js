import { useEffect, useMemo, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "./TablePagination";

// Client-side paging for lists that are already loaded. Returns the rows for
// the current page plus the pagination shape TablePagination expects. The page
// goes back to 1 whenever `resetKeys` change (search or filters) and clamps
// when the list shrinks.
export default function usePagedRows(rows, { resetKeys = [] } = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, resetKeys);

  const pageRows = useMemo(
    () => rows.slice((currentPage - 1) * limit, currentPage * limit),
    [rows, currentPage, limit],
  );

  return {
    pageRows,
    pagination: { page: currentPage, total_pages: totalPages, total, limit },
    setPage,
    setLimit: (next) => {
      setLimit(next);
      setPage(1);
    },
  };
}
