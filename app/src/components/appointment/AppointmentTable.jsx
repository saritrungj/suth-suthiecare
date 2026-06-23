import "./AppointmentTable.css";
import { FiCalendar } from "react-icons/fi";

export default function AppointmentTable({
  appointments = [],
  isLoading,
  onSelectCase,
  onUpdateApptStatus,
}) {
  // 🟢 กรองเอาเฉพาะเคสที่ "ยังไม่ปิดเคส" มาแสดงในตาราง
  const activeAppointments = appointments.filter((a) => {
    const safeStatus = a.status || "";
    const isClosedCase =
      safeStatus.includes("ปิดเคส") ||
      safeStatus.includes("สำเร็จ") ||
      safeStatus === "Closed";
    return !isClosedCase; // คืนค่า true เฉพาะเคสที่ยังไม่ถูกปิด
  });

  const stripHtml = (html) => {
    if (!html) return "";
    return String(html)
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
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
      <div
        className="aptt-wrapper-card aptt-empty-state"
        style={{
          minHeight: "350px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          border: "2px dashed #e2e8f0",
          boxShadow: "none",
        }}
      >
        <div className="aptt-spinner"></div>
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  if (activeAppointments.length === 0) {
    return (
      <div
        className="aptt-wrapper-card aptt-empty-state"
        style={{
          minHeight: "350px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          border: "2px dashed #e2e8f0",
          boxShadow: "none",
        }}
      >
        <FiCalendar
          style={{ fontSize: "48px", color: "#cbd5e1", marginBottom: "16px" }}
        />
        <h3
          style={{
            fontSize: "18px",
            color: "#475569",
            margin: "0 0 8px 0",
            fontWeight: "bold",
          }}
        >
          ไม่มีข้อมูลในขณะนี้
        </h3>
        <p
          style={{
            fontSize: "15px",
            color: "#94a3b8",
            margin: 0,
            fontWeight: "normal",
          }}
        >
          ยังไม่มีข้อมูลในคลินิกนี้ หรือในช่วงเวลาที่เลือก
        </p>
      </div>
    );
  }

  return (
    <div className="aptt-wrapper-card">
      <div className="aptt-scroll-container">
        <table className="aptt-main-table">
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
            {activeAppointments.map((a, i) => {
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
                const d = new Date(a.appointment_date);
                dateStr = d.toLocaleDateString("th-TH", {
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
                  <td>{i + 1}</td>
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
                  <td className="aptt-col-service">{a.service_name || "-"}</td>
                  <td className="aptt-col-date">{dateStr} น.</td>

                  <td>
                    <span
                      className="aptt-status-tag"
                      style={{
                        background:
                          apptStatus === "Completed"
                            ? "#dcfce7"
                            : apptStatus === "Cancelled"
                              ? "#fee2e2"
                              : "#fef9c3",
                        color:
                          apptStatus === "Completed"
                            ? "#166534"
                            : apptStatus === "Cancelled"
                              ? "#991b1b"
                              : "#854d0e",
                      }}
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
                  <td className="aptt-col-note" title={a.note}>
                    {a.note || "-"}
                  </td>

                  <td>
                    <span
                      className="aptt-status-tag"
                      style={{
                        background:
                          safeStatus.includes("ปิดเคส") ||
                          safeStatus.includes("สำเร็จ")
                            ? "#dcfce7"
                            : "#f1f5f9",
                        color:
                          safeStatus.includes("ปิดเคส") ||
                          safeStatus.includes("สำเร็จ")
                            ? "#166534"
                            : "#475569",
                      }}
                    >
                      {safeStatus || "-"}
                    </span>
                  </td>

                  {/* 🟢 คอลัมน์นี้ใส่ class aptt-col-action เพื่อให้ติดหนึบขอบขวา */}
                  <td className="aptt-col-action">
                    {apptStatus === "Scheduled" ? (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          style={{
                            background: "#ecfdf5",
                            color: "#059669",
                            border: "1px solid #a7f3d0",
                            padding: "8px 14px",
                            borderRadius: "20px",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                            boxShadow: "0 2px 4px rgba(5, 150, 105, 0.05)",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = "#d1fae5";
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = "#ecfdf5";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
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
                          style={{
                            background: "#fff1f2",
                            color: "#e11d48",
                            border: "1px solid #fecdd3",
                            padding: "8px 14px",
                            borderRadius: "20px",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: "700",
                            whiteSpace: "nowrap",
                            boxShadow: "0 2px 4px rgba(225, 29, 72, 0.05)",
                            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = "#ffe4e6";
                            e.currentTarget.style.transform =
                              "translateY(-2px)";
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = "#fff1f2";
                            e.currentTarget.style.transform = "translateY(0)";
                          }}
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
                          fontSize: "13px",
                          color: "#64748b",
                          fontWeight: "600",
                          background: "#f8fafc",
                          padding: "8px 16px",
                          borderRadius: "20px",
                          display: "inline-block",
                          border: "1px dashed #cbd5e1",
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
    </div>
  );
}
