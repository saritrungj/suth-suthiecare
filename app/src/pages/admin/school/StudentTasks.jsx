// Follow-up tasks of one student, in the student file (group screening is
// done by screening rounds). Each
// task shows the form to complete, who is responsible, the due date and, once
// done, the risk level of its result. Staff with the health "assign" right
// close a task with the student's newest matching assessment, or cancel it.
import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiClipboard, FiSlash } from "react-icons/fi";
import api from "../../../services/api";
import { confirmAlert, showErrorAlert } from "../../../utils/alerts";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { RiskBadge, formatThaiDate } from "./schoolUi";

// Both kinds are follow-ups of one student: "rescreen" was made from an
// earlier result on the follow-up page, "follow_up" from a guidance record.
export const TASK_KIND_LABELS = {
  rescreen: "ติดตาม (ประเมินซ้ำ)",
  follow_up: "ติดตาม",
};
const STATUS_LABELS = {
  pending: "รอดำเนินการ",
  completed: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

// The newest assessment of the task's form submitted after it was created.
const resultFor = (task, assessments) =>
  assessments.find(
    (a) =>
      Number(a.form_id) === Number(task.target_form_id) &&
      Number(a.id) !== Number(task.source_response_id) &&
      new Date(a.submitted_at) >= new Date(task.created_at),
  );

export default function StudentTasks({
  studentId,
  assessments = [],
  canAssign,
  refreshKey,
}) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/school/rescreen-tasks", {
        params: { student_id: studentId },
      });
      setTasks(Array.isArray(data) ? [...data].reverse() : []);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "โหลดงานติดตามไม่สำเร็จ");
    }
  }, [studentId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const close = async (task, status, response) => {
    if (
      status === "cancelled" &&
      !(await confirmAlert({
        title: "ยกเลิกงานนี้?",
        text: "งานจะไม่อยู่ในรายการที่ต้องทำอีก",
        confirmText: "ยกเลิกงาน",
        danger: true,
      }))
    )
      return;
    try {
      await api.put(`/school/rescreen-tasks/${task.id}`, {
        status,
        ...(response ? { completed_response_id: response.id } : {}),
      });
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "ปรับสถานะงานไม่สำเร็จ" });
    }
  };

  return (
    <section
      className="sch-insights-section"
      aria-labelledby="student-tasks-title"
    >
      <header className="sch-insights-section-head">
        <span className="sch-insights-section-icon" aria-hidden="true">
          <FiClipboard />
        </span>
        <div>
          <h2 id="student-tasks-title">งานติดตามรายบุคคล</h2>
          <p>
            แบบประเมินที่มอบให้นักเรียนคนนี้ทำ พร้อมผลเมื่อเสร็จ
            (การคัดกรองทั้งกลุ่มดูได้ที่รอบประเมิน)
          </p>
        </div>
      </header>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {tasks && !tasks.length && (
        <p className="sch-insights-empty">ยังไม่มีงานติดตาม</p>
      )}
      {tasks?.length > 0 && (
        <ol className="sch-timeline sch-task-list">
          {tasks.map((task) => {
            const result =
              task.status === "pending" ? resultFor(task, assessments) : null;
            return (
              <li key={task.id}>
                <div className="sch-timeline-body">
                  <span className="sch-name">
                    <span className={`sch-badge mental-task-${task.task_kind}`}>
                      {TASK_KIND_LABELS[task.task_kind] || "งานติดตาม"}
                    </span>
                    {toDisplayText(task.target_form_title)}
                  </span>
                  <span className="sch-sub">
                    ผู้รับผิดชอบ {task.assigned_username || "-"} · กำหนด{" "}
                    {formatThaiDate(task.due_on)}
                    {task.overdue && (
                      <strong className="sch-overdue"> · เลยกำหนด</strong>
                    )}
                  </span>
                  {canAssign && task.status === "pending" && (
                    <div className="sch-task-actions">
                      <button
                        type="button"
                        className="sch-btn-secondary"
                        disabled={!result}
                        title={
                          result
                            ? undefined
                            : "ยังไม่มีผลแบบประเมินนี้หลังสร้างงาน"
                        }
                        onClick={() => close(task, "completed", result)}
                      >
                        <FiCheck aria-hidden="true" />
                        {result
                          ? `ปิดงานด้วยผลวันที่ ${formatThaiDate(result.submitted_at)}`
                          : "รอผลประเมิน"}
                      </button>
                      <button
                        type="button"
                        className="sch-btn-ghost"
                        onClick={() => close(task, "cancelled")}
                      >
                        <FiSlash aria-hidden="true" /> ยกเลิกงาน
                      </button>
                    </div>
                  )}
                </div>
                <div className="sch-task-state">
                  <span
                    className={`sch-badge ${task.status === "completed" ? "status-active" : task.status === "cancelled" ? "status-inactive" : "status-pending"}`}
                  >
                    {STATUS_LABELS[task.status]}
                  </span>
                  {task.result_risk && <RiskBadge risk={task.result_risk} />}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
