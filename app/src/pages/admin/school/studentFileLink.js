// The student file has its own page (/admin/school/students/:id). Lists open
// it with `useOpenStudentFile`, which carries the list's order (for previous/
// next) and its own address (for "กลับ") in the history state, and the tab
// and mental-health period in the query string so a reload keeps them.
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const studentFilePath = (id, { tab, period } = {}) => {
  const params = new URLSearchParams();
  if (tab && tab !== "general") params.set("tab", tab);
  if (period?.range?.from) params.set("from", period.range.from);
  if (period?.range?.to) params.set("to", period.range.to);
  if (period?.label) params.set("period", period.label);
  const query = params.toString();
  return `/admin/school/students/${id}${query ? `?${query}` : ""}`;
};

export function useOpenStudentFile() {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    (id, { ids, tab, period } = {}) =>
      navigate(studentFilePath(id, { tab, period }), {
        state: {
          ids: ids?.length ? ids : undefined,
          back: `${location.pathname}${location.search}`,
        },
      }),
    [navigate, location.pathname, location.search],
  );
}

// useState that survives leaving the page for the student file and coming
// back in the same tab. Storage may be blocked: then it is plain state.
export function useSessionState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = sessionStorage.getItem(key);
      return saved === null ? initial : JSON.parse(saved);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable: the value just isn't remembered.
    }
  }, [key, value]);
  return [value, setValue];
}
