import React, { useState } from "react";
import {
  FaExchangeAlt,
  FaStickyNote,
  FaUserCircle,
  FaChevronDown,
  FaChevronUp,
} from "react-icons/fa";
import { FiCalendar } from "react-icons/fi";

export default function CaseHistoryTab({
  groupedLogs,
  renderLogDetail,
  staffOptions,
}) {
  const [expandedDates, setExpandedDates] = useState(() => {
    const dates = Object.keys(groupedLogs);
    return dates.length > 0 ? [dates[0]] : [];
  });
  const toggleDate = (date) => {
    setExpandedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date],
    );
  };
  const [expandedLogs, setExpandedLogs] = useState({});
  const toggleLog = (logId) => {
    setExpandedLogs((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  return (
    <div className="cdm-hist-container">
      {Object.keys(groupedLogs).length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: "#94a3b8",
          }}
        >
          ยังไม่มีประวัติการติดตาม
        </div>
      ) : (
        Object.entries(groupedLogs).map(([dateStr, logs]) => {
          const isExpanded = expandedDates.includes(dateStr);

          return (
            <div
              key={dateStr}
              className="cdm-hist-date-section"
              style={{ marginBottom: "15px" }}
            >
              <div
                className={`cdm-hist-date-divider ${isExpanded ? "active" : ""}`}
                onClick={() => toggleDate(dateStr)}
              >
                <div className="cdm-hist-date-badge-wrapper">
                  <span className="cdm-hist-date-badge">
                    {dateStr}
                    <span
                      style={{
                        marginLeft: "8px",
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      {isExpanded ? (
                        <FaChevronUp size={12} />
                      ) : (
                        <FaChevronDown size={12} />
                      )}
                    </span>
                  </span>
                </div>
              </div>
              {isExpanded && (
                <div className="cdm-hist-items-wrapper animate-fade-in">
                  {logs.map((log) => {
                    let IconCmp = FaStickyNote;
                    let typeLabel = "บันทึกข้อความ";
                    let dotClass = "note";
                    if (log.type === "status") {
                      IconCmp = FaExchangeAlt;
                      typeLabel = "อัปเดตสถานะ";
                      dotClass = "status";
                    } else if (log.type === "appoint") {
                      IconCmp = FiCalendar;
                      typeLabel = "นัดหมาย";
                      dotClass = "appoint";
                    }
                    const isLogExpanded = expandedLogs[log.id];
                    return (
                      <div key={log.id} className="cdm-hist-item">
                        <div className={`cdm-hist-icon ${dotClass}`}>
                          <IconCmp />
                        </div>
                        <div className="cdm-hist-card">
                          <div className="cdm-hist-card-header">
                            <div className="cdm-hist-time-label">
                              <span className="cdm-time">
                                {log.date.toLocaleTimeString("th-TH", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                น.
                              </span>
                              <span className={`cdm-type-badge ${dotClass}`}>
                                {typeLabel}
                              </span>
                            </div>
                            <span className="cdm-hist-staff-badge">
                              <FaUserCircle />{" "}
                              {staffOptions?.find((s) => s.id === log.staff_id)
                                ?.fullname || log.staff}
                            </span>
                          </div>
                          <div className="cdm-hist-card-body">
                            <div
                              className={`cdm-log-content-wrapper ${isLogExpanded ? "expanded" : "collapsed"}`}
                            >
                              {renderLogDetail(log.detail)}
                            </div>
                            <button
                              className="cdm-log-toggle-btn"
                              onClick={() => toggleLog(log.id)}
                            >
                              {isLogExpanded
                                ? "ย่อข้อความ"
                                : "อ่านเพิ่มเติม..."}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
