import React, { useState } from "react";
import { FaStickyNote } from "react-icons/fa";

export const groupLogsByDate = (logs) => {
  const groups = {};
  logs.forEach((log) => {
    const dateStr = log.date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[dateStr]) groups[dateStr] = [];
    groups[dateStr].push(log);
  });
  return groups;
};

const LongTextWrapper = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isLong = text.length > 300;

  return (
    <div>
      <div style={{ whiteSpace: "pre-wrap" }}>
        {isLong && !isExpanded ? `${text.substring(0, 300)}...` : text}
      </div>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: "none",
            border: "none",
            color: "#2563eb",
            fontSize: "12px",
            cursor: "pointer",
            padding: "4px 0",
            fontWeight: "600",
          }}
        >
          {isExpanded ? "ย่อรายละเอียด" : "อ่านเพิ่มเติม..."}
        </button>
      )}
    </div>
  );
};

export const renderLogDetail = (detail) => {
  if (!detail) return null;
  if (detail.includes("⟡")) {
    const parts = detail.split("⟡").map((s) => s.trim());
    return parts.map((part, idx) => {
      if (part.includes("เปลี่ยนสถานะ:")) {
        const match = part.match(/เปลี่ยนสถานะ: "(.*?)" ➔ "(.*?)"/);
        if (match)
          return (
            <div key={idx} className="cdm-log-detail-highlight cdm-log-status">
              {match[1]} ➔ <strong>{match[2]}</strong>
            </div>
          );
      }
      if (part.includes("เปลี่ยนความเสี่ยงรวม:")) {
        const match = part.match(/เปลี่ยนความเสี่ยงรวม: "(.*?)" ➔ "(.*?)"/);
        if (match)
          return (
            <div key={idx} className="cdm-log-detail-highlight cdm-log-risk">
              ความเสี่ยงรวม: {match[1]} ➔ <strong>{match[2]}</strong>
            </div>
          );
      }
      if (part.includes("ผลเจาะเลือด:")) {
        const match = part.match(/ผลเจาะเลือด: (.*?) ➔ (.*)/);
        if (match)
          return (
            <div
              key={idx}
              className="cdm-log-detail-highlight"
              style={{
                backgroundColor: "#fce7f3",
                color: "#be185d",
                borderColor: "#fbcfe8",
              }}
            >
              🩸 ผลเจาะเลือด: {match[1]} ➔ <strong>{match[2]}</strong>
            </div>
          );
      }
      if (part.includes("การรับยา PrEP:")) {
        const match = part.match(/การรับยา PrEP: (.*?) ➔ (.*)/);
        if (match)
          return (
            <div
              key={idx}
              className="cdm-log-detail-highlight"
              style={{
                backgroundColor: "#fce7f3",
                color: "#be185d",
                borderColor: "#fbcfe8",
              }}
            >
              💊 การรับยา PrEP: {match[1]} ➔ <strong>{match[2]}</strong>
            </div>
          );
      }
      if (part.includes("ข้อบ่งชี้ทางคลินิก:")) {
        const text = part.replace("ข้อบ่งชี้ทางคลินิก:", "").trim();
        return (
          <div key={idx} className="cdm-log-impression">
            <div className="cdm-impression-title">
              <FaStickyNote style={{ marginRight: "4px" }} />{" "}
              การประเมินทางคลินิก (Clinical Impression)
            </div>
            <div className="cdm-impression-text">"{text}"</div>
          </div>
        );
      }
      if (part.includes("ประเมินย่อย:")) {
        const match = part.match(
          /ประเมินย่อย: "(.*?)" \| (.*?) ➔ (.*?) \| เหตุผล: (.*)/,
        );
        if (match) {
          return (
            <div key={idx} className="cdm-log-sub-risk">
              <div className="cdm-sub-risk-title">• {match[1]}</div>
              <div className="cdm-sub-risk-change">
                {match[2]} ➔ <strong>{match[3]}</strong>
              </div>
              <div className="cdm-sub-risk-reason">"{match[4]}"</div>
            </div>
          );
        }
      }
      return (
        <div key={idx} className="cdm-log-detail-normal">
          {part}
        </div>
      );
    });
  }

  if (
    detail.includes("|") &&
    (detail.includes("อัปเดตสถานะเป็น") || detail.includes("ความเสี่ยงรวม:"))
  ) {
    const oldParts = detail.split("|").map((s) => s.trim());
    return oldParts.map((part, idx) => {
      if (part.includes("อัปเดตสถานะเป็น")) {
        const match = part.match(/อัปเดตสถานะเป็น "(.*?)"/);
        if (match)
          return (
            <div key={idx} className="cdm-log-detail-highlight cdm-log-status">
              สถานะ ➔ <strong>{match[1]}</strong>
            </div>
          );
      }
      if (part.includes("ความเสี่ยงรวม:")) {
        return (
          <div key={idx} className="cdm-log-detail-highlight cdm-log-risk">
            {part}
          </div>
        );
      }
      return (
        <div key={idx} className="cdm-log-detail-normal">
          {part}
        </div>
      );
    });
  }

  return detail.split("\n").map((line, idx) => {
    if (!line.trim()) return null;
    const isHeader = /^\d+\./.test(line.trim());

    return (
      <div
        key={idx}
        style={{
          fontWeight: isHeader ? "700" : "400",
          color: isHeader ? "#1e40af" : "#334155",
          paddingLeft: isHeader ? "0" : "12px",
          marginTop: isHeader && idx > 0 ? "10px" : "2px",
          fontSize: isHeader ? "14.5px" : "14px",
          display: "block",
        }}
      >
        {isHeader ? line : <LongTextWrapper text={line} />}
      </div>
    );
  });
};
