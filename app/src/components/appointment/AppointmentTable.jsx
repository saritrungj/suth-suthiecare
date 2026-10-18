import { toDisplayText } from "../../utils/textPresentation.js";
import { useModuleActions } from "../../permissions/useModuleActions";
import "./AppointmentTable.css";
import { FiCalendar } from "react-icons/fi";
import { formatBangkokDate } from "../../utils/caseDateFilter";
import TablePagination from "../table/TablePagination";
import usePagedRows from "../table/usePagedRows";
import ResultSummary from "../table/ResultSummary";

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
  // 🟢 กรองเอาเฉพาะเคสที่ "ยังไม่ปิดเคส" มาแสดงในตาราง
  const activeAppointments = appointments.filter((a) => {
    const safeStatus = a.status || "";
    const isClosedCase =
      safeStatus.includes("ปิดเคส") ||
      safeStatus.includes("สำเร็จ") ||
      safeStatus === "Closed";
    return !isClosedCase; // คืนค่า true เฉพาะเคสที่ยังไม่ถูกปิด
  });
  const { pageRows, pagination, setPage, setLimit } = usePagedRows(
    activeAppointments,
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

  const stripHtml = (html) => {
    return toDisplayText(html);
  };

  const getRiskBadge = (riskLevel) => {
    if (riskLevel === "สูง")
      return <span className="aptt-risk-tag aptt-risk-high">สูง</span>;
    if (riskLevel === "ปานกลาง")
      return <span className="aptt-risk-tag aptt-risk-medium">ปานกลาง</span>;
    return <span className="aptt-risk-tag aptt-risk-low">ต่ำ</span>;
  };

  if (isLoading) {
    return (
      <>
        {summary}
        <div
          className="aptt-wrapper-card aptt-empty-state"
          style={{
            minHeight: "350px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            border: "2px dashed var(--suth-line)",
            boxShadow: "none",
          }}
        >
          <div className="aptt-spinner"></div>
          กำลังโหลดข้อมูล...
        </div>
      </>
    );
  }

  if (activeAppointments.length === 0) {
    return (
      <>
        {summary}
        <div
          className="aptt-wrapper-card aptt-empty-state"
          style={{
            minHeight: "350px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            border: "2px dashed var(--suth-line)",
            boxShadow: "none",
          }}
        >
          <FiCalendar
            style={{
              fontSize: "var(--suth-fs-display-lg)",
              color: "var(--suth-control-line)",
              marginBottom: "16px",
            }}
          />
          <h3
            style={{
              fontSize: "var(--suth-fs-section)",
              color: "var(--suth-ink-2)",
              margin: "0 0 8px 0",
              fontWeight: "bold",
            }}
          >
            ไม่มีข้อมูลในขณะนี้
          </h3>
          <p
            style={{
              fontSize: "var(--suth-fs-body)",
              color: "var(--suth-muted)",
              margin: 0,
              fontWeight: "normal",
            }}
          >
            ยังไม่มีข้อมูลในคลินิกนี้ หรือในช่วงเวลาที่เลือก
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {summary}
      <div className="aptt-wrapper-card">
        <div
          className="aptt-scroll-container"
          tabIndex={0}
          role="region"
          aria-label="รายการนัดหมาย"
        >
          <table
            className="aptt-main-table admin-data-table"
            aria-label="ตารางนัดหมาย"
          >
            <thead>
              <tr>
                <th className="aptt-col-queue">ลำดับ</th>
                <th className="aptt-col-case">Case ID</th>
                <th className="aptt-col-name">ชื่อผู้รับบริการ</th>
                <th className="aptt-col-age">อายุ</th>
                <th className="aptt-col-service">บริการ</th>
                <th className="aptt-col-date">วันนัด</th>
                <th className="aptt-col-appt-status">สถานะนัด</th>
                <th className="aptt-col-risk">ความเสี่ยง</th>
                <th className="aptt-col-phone">เบอร์ติดต่อ</th>
                <th className="aptt-col-note">หมายเหตุ</th>
                <th className="aptt-col-status">สถานะเคส</th>
                {/* 🟢 คอลัมน์นี้จะติดหนึบขอบขวา เพราะมี class aptt-col-action */}
                <th className="aptt-col-action">จัดการคิว</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((a, i) => {
                const summary = a.summary_data || {};
                const caseIdStr = `CASE-${String(a.case_id).padStart(4, "0")}`;
                const name =
                  summary.display_name && summary.display_name !== "-"
                    ? summary.display_name
                    : caseIdStr;
                const age = summary.age || summary.display_age || "-";
                const phone = summary.phone || summary.display_phone || "-";

                let dateStr = "-";
                if (a.appointment_date) {
                  dateStr = formatBangkokDate(a.appointment_date, "th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                }

                const safeStatus = a.status || "";
                const apptStatus = a.appt_status || "Scheduled";

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
                  <tr key={a.appointment_id || a.id}>
                    <td>{(pagination.page - 1) * pagination.limit + i + 1}</td>
                    <td>
                      {a.master_case_id
                        ? `MC-${String(a.master_case_id).padStart(4, "0")}`
                        : `RES-${String(a.case_id).padStart(4, "0")}`}
                    </td>
                    <td className="aptt-col-name">
                      <button
                        className="aptt-name-btn"
                        onClick={() => onSelectCase(caseDataForModal)}
                        title="คลิกเพื่อดูรายละเอียดเคส"
                      >
                        {name}
                      </button>
                    </td>
                    <td>{stripHtml(age)}</td>
                    <td className="aptt-col-service">
                      {a.service_name || "-"}
                    </td>
                    <td className="aptt-col-date">{dateStr} น.</td>

                    <td>
                      <span
                        className={
                          "aptt-status-tag " +
                          (apptStatus === "Completed"
                            ? "is-success"
                            : apptStatus === "Cancelled"
                              ? "is-danger"
                              : "is-warning")
                        }
                      >
                        {apptStatus === "Completed"
                          ? "เสร็จสิ้น"
                          : apptStatus === "Cancelled"
                            ? "ยกเลิก"
                            : "รอเข้ารับบริการ"}
                      </span>
                    </td>

                    <td>
                      {getRiskBadge(a.overall_risk || a.risk_level || "ต่ำ")}
                    </td>
                    <td>{stripHtml(phone)}</td>
                    <td className="aptt-col-note" title={toDisplayText(a.note)}>
                      {toDisplayText(a.note || "-")}
                    </td>

                    <td>
                      <span
                        className={
                          "aptt-status-tag " +
                          (safeStatus.includes("ปิดเคส") ||
                          safeStatus.includes("สำเร็จ")
                            ? "is-success"
                            : "is-neutral")
                        }
                      >
                        {safeStatus || "-"}
                      </span>
                    </td>

                    {/* 🟢 คอลัมน์นี้ใส่ class aptt-col-action เพื่อให้ติดหนึบขอบขวา */}
                    <td className="aptt-col-action">
                      {apptStatus === "Scheduled" ? (
                        <div className="aptt-acts">
                          <button
                            hidden={!apptRights.update}
                            className="aptt-act aptt-act--ok"
                            type="button"
                            onClick={() =>
                              onUpdateApptStatus(
                                a.appointment_id || a.id,
                                "Completed",
                              )
                            }
                            title="บันทึกว่าผู้รับบริการมาตามนัด"
                          >
                            มาตามนัด
                          </button>
                          <button
                            hidden={!apptRights.delete}
                            className="aptt-act aptt-act--cancel"
                            type="button"
                            onClick={() =>
                              onUpdateApptStatus(
                                a.appointment_id || a.id,
                                "Cancelled",
                              )
                            }
                            title="ยกเลิกการนัดหมายนี้"
                          >
                            ยกเลิกนัด
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: "var(--suth-fs-label)",
                            color: "var(--suth-muted)",
                            fontWeight: "600",
                            background: "var(--suth-surface-2)",
                            padding: "8px 16px",
                            borderRadius: "var(--suth-radius-card)",
                            display: "inline-block",
                            border: "1px dashed var(--suth-control-line)",
                          }}
                        >
                          จัดการแล้ว
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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
