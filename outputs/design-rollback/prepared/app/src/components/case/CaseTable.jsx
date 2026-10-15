import SearchableSelect from '../SearchableSelect';
import { toDisplayText } from '../../utils/textPresentation.js';
import { useEffect, useId, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiInbox } from "react-icons/fi";
import { RiskPill, StatusPill } from "./CaseDrawer";
import CasePerson from "./CasePerson";
import {
  caseCode,
  formatCaseDate,
  rowRisk,
  stripHtml,
} from "./caseDisplay";
import { useMediaQuery } from "../useMediaQuery";

const findAnswerFlexible = (rawAnswers, qTitle) => {
  if (!rawAnswers || !qTitle) return undefined;
  const exactKey = toDisplayText(qTitle);
  if (rawAnswers[exactKey] !== undefined) return rawAnswers[exactKey];
  const targetClean = stripHtml(qTitle).replace(/\s+/g, "").toLowerCase();
  for (const key in rawAnswers) {
    const keyClean = stripHtml(key).replace(/\s+/g, "").toLowerCase();
    if (keyClean === targetClean) return rawAnswers[key];
  }
  return undefined;
};

const formatAnswer = (ans) => {
  if (ans === undefined || ans === null || ans === "") return "-";
  if (Array.isArray(ans)) return ans.join(", ");
  if (typeof ans === "object")
    return Object.entries(ans)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(" | ");
  return stripHtml(String(ans));
};

// One answer cell: a scored question shows its result, others the answer.
function Answer({ row, question }) {
  const summary = row.summary_data || {};
  const answer = formatAnswer(
    findAnswerFlexible(summary.raw_answers || {}, question.title),
  );
  const result = (summary.score_results || []).find(
    (sr) =>
      sr.title === stripHtml(question.title) || sr.question_id === question.id,
  );
  if (result)
    return (
      <span
        className="cw-score"
        title={`ผลประเมิน: ${result.label} (${result.score} คะแนน)\nคำตอบที่เลือก: ${answer !== "-" ? answer : "ไม่ได้ตอบ"}`}
      >
        <i
          aria-hidden="true"
          style={{ backgroundColor: result.color || "#64748b" }}
        />
        {toDisplayText(result.label)} ({result.score})
      </span>
    );
  return (
    <span title={answer !== "-" ? answer : "ไม่ได้ตอบคำถามนี้"}>{answer}</span>
  );
}

// The case list. Person view ("master"): a follow-up queue with person,
// risk, status and a single update date. Answer view ("form"): one row per form
// submission with the chosen question columns. Phones get one card per row
// in both views, never a sideways-scrolling table.
export default function CaseTable({
  data = [],
  questions = [],
  visibleColumns = [],
  isLoading,
  onSelectCase,
  viewMode = "master",
  hasScoring = true,
  selectedId,
}) {
  const isPhone = useMediaQuery("(max-width: 760px)");
  const rowsId = useId();
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [data.length, viewMode]);

  const dynamicQuestions = questions.filter(
    (q) =>
      q.type !== "section" &&
      q.type !== "description" &&
      visibleColumns.includes(q.id),
  );
  const showRisk =
    viewMode === "master"
      ? hasScoring ||
        data.some((row) => row.overall_risk || row.summary_data?.overall_risk)
      : hasScoring;

  const totalItems = data.length;
  const totalPages = Math.max(Math.ceil(totalItems / rowsPerPage), 1);
  const page = Math.min(currentPage, totalPages);
  const startIndex = (page - 1) * rowsPerPage;
  const currentData = data.slice(startIndex, startIndex + rowsPerPage);

  if (isLoading)
    return (
      <div className="cw-skeleton" role="status" aria-label="กำลังโหลดข้อมูล">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    );

  if (!data.length)
    return (
      <div className="cw-empty" role="status">
        <FiInbox aria-hidden="true" />
        <strong>ไม่มีข้อมูลในขณะนี้</strong>
        <p>ยังไม่มีข้อมูลในคลินิกนี้ หรือในช่วงเวลาที่เลือก</p>
      </div>
    );

  const nameButton = (row) => (
    <CasePerson id={row.id} name={row.first_name || "ไม่ระบุชื่อ"} code={caseCode(row)} onOpen={() => onSelectCase(row)} />
  );
  const dateOf = (row) => {
    const value = (viewMode === "master" && row.latest_activity?.occurred_at) || row.submitted_at || row.updated_at || row.created_at || row.createdAt;
    const date = formatCaseDate(value);
    return date === "-" ? "—" : `${date} น.`;
  };

  let list;
  if (isPhone) {
    list = (
      <ul className="cw-cards">
        {currentData.map((row) => (
          <li
            key={row.id}
            className={`cw-card ${String(row.id) === String(selectedId) ? "is-open" : ""}`}
          >
            <div className="cw-card-top">
              {nameButton(row)}
              {showRisk && <RiskPill risk={rowRisk(row, viewMode)} short />}
            </div>
            <div className="cw-card-summary">
              {viewMode === "master" && <StatusPill status={row.status} />}
              <span className="cw-card-date">{dateOf(row)}</span>
            </div>
            {viewMode !== "master" && (
              dynamicQuestions.length > 0 && (
                <dl className="cw-card-facts cw-card-facts--answers">
                  {dynamicQuestions.map((q) => (
                    <div key={q.id}>
                      <dt>{stripHtml(q.title)}</dt>
                      <dd>
                        <Answer row={row} question={q} />
                      </dd>
                    </div>
                  ))}
                </dl>
              )
            )}
          </li>
        ))}
      </ul>
    );
  } else if (viewMode === "master") {
    list = (
      <div
        className="cw-scroll"
        tabIndex={0}
        role="region"
        aria-label="รายการเคส"
      >
        <table className="cw-queue cw-queue--compact">
          <thead>
            <tr>
              <th className="cw-col-person">ผู้รับบริการ</th>
              {showRisk && <th>ความเสี่ยง</th>}
              <th>สถานะ</th>
              <th className="cw-col-date">อัปเดตล่าสุด</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row) => (
              <tr
                key={row.id}
                className={
                  String(row.id) === String(selectedId) ? "is-open" : ""
                }
              >
                <td className="cw-col-person">
                  {nameButton(row)}
                </td>
                {showRisk && (
                  <td>
                    <RiskPill risk={rowRisk(row, "master")} short />
                  </td>
                )}
                <td className="cw-col-status"><StatusPill status={row.status} /></td>
                <td className="cw-col-date">{dateOf(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    list = (
      <div
        className="cw-scroll"
        tabIndex={0}
        role="region"
        aria-label="ตารางคำตอบแบบฟอร์ม"
      >
        <table className="cw-queue cw-answers">
          <thead>
            <tr>
              <th className="cw-sticky cw-col-person">ผู้รับบริการ</th>
              {hasScoring && <th>ผลประเมินระบบ</th>}
              {dynamicQuestions.map((q) => (
                <th key={q.id} className="cw-answer" title={stripHtml(q.title)}>
                  {stripHtml(q.title)}
                </th>
              ))}
              <th className="cw-col-date">ส่งฟอร์มเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row) => (
              <tr
                key={row.id}
                className={
                  String(row.id) === String(selectedId) ? "is-open" : ""
                }
              >
                <td className="cw-sticky cw-col-person">
                  {nameButton(row)}
                </td>
                {hasScoring && (
                  <td>
                    <RiskPill risk={rowRisk(row, "form")} short />
                  </td>
                )}
                {dynamicQuestions.map((q) => (
                  <td key={q.id} className="cw-answer">
                    <Answer row={row} question={q} />
                  </td>
                ))}
                <td className="cw-col-date">{dateOf(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {list}
      <footer className="cw-pagination">
        <div>
          <label htmlFor={rowsId}>แสดง</label>
          <SearchableSelect
            id={rowsId}
            value={rowsPerPage}
            onChange={(event) => {
              setRowsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </SearchableSelect>
          <span>
            รายการ (รวมทั้งหมด {totalItems.toLocaleString("th-TH")} รายการ)
          </span>
        </div>
        <div>
          <button
            type="button"
            className="cw-icon-btn"
            onClick={() => setCurrentPage(Math.max(page - 1, 1))}
            disabled={page === 1}
            aria-label="หน้าก่อนหน้า"
          >
            <FiChevronLeft aria-hidden="true" />
          </button>
          <span>
            หน้า <strong>{page}</strong> จาก {totalPages}
          </span>
          <button
            type="button"
            className="cw-icon-btn"
            onClick={() => setCurrentPage(Math.min(page + 1, totalPages))}
            disabled={page === totalPages}
            aria-label="หน้าถัดไป"
          >
            <FiChevronRight aria-hidden="true" />
          </button>
        </div>
      </footer>
    </>
  );
}
