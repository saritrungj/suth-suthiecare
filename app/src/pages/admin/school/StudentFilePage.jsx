// The student file as its own page. The tab and the mental-health period
// come from the query string; previous/next walk the list the file was
// opened from (history state), and "กลับ" returns to that list.
import { useCallback, useMemo } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import StudentDetailModal from "./StudentDetailModal";
import { studentFilePath } from "./studentFileLink";
import "./school.css";

export default function StudentFilePage() {
  const { studentId: rawId } = useParams();
  const studentId = Number.parseInt(rawId, 10);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const listState = location.state || {};
  const tab = searchParams.get("tab") || "general";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const periodLabel = searchParams.get("period");
  const period = useMemo(
    () =>
      from || to
        ? {
            range: { from: from || "", to: to || "" },
            label: periodLabel || "แสดงผลประเมินในช่วงที่เลือก",
          }
        : null,
    [from, to, periodLabel],
  );

  const changeTab = useCallback(
    (next) =>
      setSearchParams(
        (params) => {
          if (next === "general") params.delete("tab");
          else params.set("tab", next);
          return params;
        },
        { replace: true, state: listState },
      ),
    [setSearchParams, listState],
  );

  const ids = Array.isArray(listState.ids) ? listState.ids : [];
  const index = ids.indexOf(studentId);
  const go = (id) =>
    navigate(studentFilePath(id, { tab, period }), {
      replace: true,
      state: listState,
    });
  const nav =
    index === -1
      ? undefined
      : {
          position: index + 1,
          total: ids.length,
          onPrev: index > 0 ? () => go(ids[index - 1]) : undefined,
          onNext: index < ids.length - 1 ? () => go(ids[index + 1]) : undefined,
        };

  if (!studentId)
    return (
      <div className="sch-wrapper">
        <main className="sch-page">
          <p className="sch-error" role="alert">
            ไม่พบนักเรียนที่ต้องการ
          </p>
        </main>
      </div>
    );

  return (
    <div className="sch-wrapper">
      <main className="sch-page sch-file-page">
        <StudentDetailModal
          key={studentId}
          variant="page"
          studentId={studentId}
          initialTab={tab}
          onTabChange={changeTab}
          nav={nav}
          period={period}
          backLabel={listState.back ? "กลับไปรายการ" : "รายชื่อนักเรียน"}
          onClose={() => navigate(listState.back || "/admin/school/students")}
        />
      </main>
    </div>
  );
}
