import { toDisplayText } from "../../utils/textPresentation.js";
import { useModuleActions } from "../../permissions/useModuleActions";
import "./AppointmentTable.css";
import { FiCalendar, FiCheck, FiX } from "react-icons/fi";
import { formatBangkokDate } from "../../utils/caseDateFilter";
import TablePagination from "../table/TablePagination";
import usePagedRows from "../table/usePagedRows";
import ResultSummary from "../table/ResultSummary";

const APPT_STATUS = {
  Scheduled: { label: "รอเข้ารับบริการ", tone: "is-warning" },
  Completed: { label: "มาตามนัด", tone: "is-success" },
  Cancelled: { label: "ยกเลิกนัด", tone: "is-danger" },
};

const RISK = {
  สูง: "aptt-risk-high",
  ปานกลาง: "aptt-risk-medium",
  ต่ำ: "aptt-risk-low",
};

const caseCode = (a) =>
  a.master_case_id
    ? `MC-${String(a.master_case_id).padStart(4, "0")}`
    : `RES-${String(a.case_id).padStart(4, "0")}`;

const present = (value) => {
  const text = toDisplayText(value);
  return text && text !== "-" ? text : "";
};

// Six columns that fit the panel, so the whole row (and its actions) is
// readable without scrolling sideways. Below 760px each row becomes a card.
export default function AppointmentTable({
  appointments = [],
  isLoading,
  onSelectCase,
  onUpdateApptStatus,
  resetKey = "",
  chips,
  onClearAll,
}) {
  const apptRights = useModuleActions("appointments");
  const { pageRows, pagination, setPage, setLimit } = usePagedRows(
    appointments,
    { resetKeys: [resetKey] },
  );
  // Result line above every state, so active filter chips stay removable
  // even when they empty the list.
  const summary = chips ? (
    <ResultSummary
      loading={isLoading}
      pagination={pagination}
      chips={chips}
      onClearAll={onClearAll}
    />
  ) : null;

  if (isLoading || appointments.length === 0) {
    return (
      <>
        {summary}
        <div className="aptt-state" role="status">
          {isLoading ? (
            <>
              <div className="aptt-spinner" aria-hidden="true" />
              <p>กำลังโหลดนัดหมาย…</p>
            </>
          ) : (
            <>
              <FiCalendar className="aptt-state__icon" aria-hidden="true" />
              <strong>ไม่มีนัดหมายในช่วงนี้</strong>
              <p>ลองเปลี่ยนช่วงวันที่ สถานะ หรือตัวกรองด้านบน</p>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {summary}
      <div className="aptt-frame">
        <table
          className="aptt-table admin-data-table"
          aria-label="ตารางนัดหมาย"
        >
          <colgroup>
            <col className="aptt-w-date" />
            <col className="aptt-w-person" />
            <col className="aptt-w-service" />
            <col className="aptt-w-risk" />
            <col className="aptt-w-status" />
            <col className="aptt-w-action" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">วันนัด</th>
              <th scope="col">ผู้รับบริการ</th>
              <th scope="col">บริการ / หมายเหตุ</th>
              <th scope="col">ความเสี่ยง</th>
              <th scope="col">สถานะ</th>
              <th scope="col" className="aptt-col-action">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a) => {
              const summaryData = a.summary_data || {};
              const code = caseCode(a);
              const name = present(summaryData.display_name) || code;
              const age = present(summaryData.age || summaryData.display_age);
              const phone = present(
                summaryData.phone || summaryData.display_phone,
              );
              const date = a.appointment_date
                ? formatBangkokDate(a.appointment_date, "th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })
                : "-";
              const time = a.appointment_date
                ? formatBangkokDate(a.appointment_date, "th-TH", {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              const apptStatus = APPT_STATUS[a.appt_status]
                ? a.appt_status
                : "Scheduled";
              const risk = RISK[a.overall_risk || a.risk_level]
                ? a.overall_risk || a.risk_level
                : "ต่ำ";
              const note = present(a.note);
              const caseStatus = present(a.status);
              const id = a.appointment_id || a.id;
              const caseDataForModal = {
                id: a.case_id,
                master_case_id: a.master_case_id,
                form_id: a.form_id,
                form_title: a.form_title,
                identity_value: a.identity_value,
                summary_data: a.summary_data,
                status: a.status,
                risk_level: a.risk_level,
                overall_risk: a.overall_risk,
                submitted_at: a.submitted_at,
              };

              return (
                <tr key={id}>
                  <td data-label="วันนัด">
                    <span className="aptt-date">{date}</span>
                    {time && <span className="aptt-sub">{time} น.</span>}
                  </td>
                  <td data-label="ผู้รับบริการ">
                    <button
                      type="button"
                      className="aptt-name-btn"
                      onClick={() => onSelectCase(caseDataForModal)}
                      title="ดูรายละเอียดเคส"
                    >
                      {name}
                    </button>
                    <span className="aptt-sub">
                      {[code, age && `อายุ ${age}`, phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                  <td data-label="บริการ">
                    <span className="aptt-service">
                      {toDisplayText(a.service_name) || "-"}
                    </span>
                    {note && (
                      <span className="aptt-sub aptt-line" title={note}>
                        {note}
                      </span>
                    )}
                  </td>
                  <td data-label="ความเสี่ยง">
                    <span className={`aptt-tag ${RISK[risk]}`}>{risk}</span>
                  </td>
                  <td data-label="สถานะ">
                    <span
                      className={`aptt-tag ${APPT_STATUS[apptStatus].tone}`}
                    >
                      {APPT_STATUS[apptStatus].label}
                    </span>
                    {caseStatus && (
                      <span
                        className="aptt-sub aptt-line"
                        title={`สถานะเคส: ${caseStatus}`}
                      >
                        เคส: {caseStatus}
                      </span>
                    )}
                  </td>
                  <td className="aptt-col-action">
                    {apptStatus === "Scheduled" &&
                    (apptRights.update || apptRights.delete) ? (
                      <div className="aptt-acts">
                        <button
                          hidden={!apptRights.update}
                          className="aptt-act aptt-act--ok"
                          type="button"
                          onClick={() => onUpdateApptStatus(id, "Completed")}
                          title="บันทึกว่าผู้รับบริการมาตามนัด"
                        >
                          <FiCheck aria-hidden="true" /> มาตามนัด
                        </button>
                        <button
                          hidden={!apptRights.delete}
                          className="aptt-act aptt-act--cancel"
                          type="button"
                          onClick={() => onUpdateApptStatus(id, "Cancelled")}
                          title="ยกเลิกนัด"
                          aria-label="ยกเลิกนัด"
                        >
                          <FiX aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <span className="aptt-done">
                        {apptStatus === "Scheduled" ? "—" : "จัดการแล้ว"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <TablePagination
          page={pagination.page}
          totalPages={pagination.total_pages}
          total={pagination.total}
          limit={pagination.limit}
          onPage={setPage}
          onLimit={setLimit}
        />
      </div>
    </>
  );
}
