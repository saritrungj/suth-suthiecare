import React, { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import { FiChevronRight, FiClipboard } from "react-icons/fi";
import { getPatientAssessmentTasks } from "../../services/api";
import { toDisplayText } from "../../utils/textPresentation.js";
import "./AssessmentTasksPanel.css";

const formatDate = (value, en) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString(en ? "en-GB" : "th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// What the student's school asks them to do, in two groups: the screening
// rounds for their class or school, and their own follow-ups. Hidden when
// there is nothing to do; an item disappears once the form is sent.
export default function AssessmentTasksPanel({ language = "th" }) {
  const en = language === "en";
  const titleId = useId();
  const [tasks, setTasks] = useState([]);
  const [rounds, setRounds] = useState([]);

  useEffect(() => {
    let alive = true;
    getPatientAssessmentTasks()
      .then(({ data }) => {
        if (!alive) return;
        setTasks(data?.tasks || []);
        setRounds(data?.rounds || []);
      })
      .catch(() => {
        if (!alive) return;
        setTasks([]);
        setRounds([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const total = tasks.length + rounds.length;
  if (!total) return null;

  const item = (entry, key, subtitle) => (
    <li key={key} className="at-item">
      <div className="at-item__text">
        <strong>{toDisplayText(entry.title)}</strong>
        {subtitle && <span className="at-round">{subtitle}</span>}
        <span className={entry.overdue ? "at-due is-overdue" : "at-due"}>
          {entry.overdue
            ? en
              ? `Past due · ${formatDate(entry.due_on, en)}`
              : `เลยกำหนด · ${formatDate(entry.due_on, en)}`
            : en
              ? `Due ${formatDate(entry.due_on, en)}`
              : `ทำภายใน ${formatDate(entry.due_on, en)}`}
        </span>
      </div>
      {entry.available ? (
        <Link className="at-start" to={`/assessment/${entry.form_id}`}>
          {en ? "Start" : "เริ่มทำ"}
          <FiChevronRight aria-hidden="true" />
        </Link>
      ) : (
        <span className="at-closed">
          {en ? "Not open yet" : "ยังไม่เปิดรับ"}
        </span>
      )}
    </li>
  );

  return (
    <section className="at-panel" aria-labelledby={titleId}>
      <header className="at-head">
        <span className="at-icon" aria-hidden="true">
          <FiClipboard />
        </span>
        <div className="at-heading">
          <p className="at-eyebrow">
            {en ? "From your school" : "จากโรงเรียนของคุณ"}
          </p>
          <h2 id={titleId} className="at-title">
            {en ? "Assessments to do" : "แบบประเมินที่ต้องทำ"}
            <span className="at-count">{total}</span>
          </h2>
        </div>
      </header>
      {rounds.length > 0 && (
        <div className="at-group">
          <h3 className="at-group-title">
            {en ? "School screening" : "แบบคัดกรองประจำภาคเรียน"}
          </h3>
          <ul className="at-list">
            {rounds.map((round) =>
              item(round, `round-${round.id}`, round.round_name),
            )}
          </ul>
        </div>
      )}
      {tasks.length > 0 && (
        <div className="at-group">
          <h3 className="at-group-title">
            {en ? "Your follow-up" : "แบบประเมินติดตาม"}
          </h3>
          <ul className="at-list">
            {tasks.map((task) => item(task, `task-${task.id}`))}
          </ul>
        </div>
      )}
    </section>
  );
}
