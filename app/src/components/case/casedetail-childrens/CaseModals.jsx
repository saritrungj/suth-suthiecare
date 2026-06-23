import React from "react";
import {
  FaShareSquare,
  FaTimes,
  FaLink,
  FaArchive,
  FaExclamationTriangle,
  FaGlobe,
  FaUsers,
  FaBrain,
  FaSyringe,
  FaHeartbeat,
  FaCheckCircle,
} from "react-icons/fa";

// 🟢 ฟังก์ชันสำหรับดึงสีและไอคอนตามประเภทคลินิก (ปรับชื่อ label ให้ถูกต้อง)
const getClinicStyling = (type) => {
  switch (type) {
    case "general":
      return {
        icon: <FaGlobe size={18} />,
        color: "#64748b",
        bg: "#f1f5f9",
        label: "ทั่วไป",
      };
    case "teenager":
      return {
        icon: <FaUsers size={18} />,
        color: "#0284c7",
        bg: "#e0f2fe",
        label: "คลินิกวัยรุ่น",
      };
    case "behavior":
      return {
        icon: <FaBrain size={18} />,
        color: "#16a34a",
        bg: "#dcfce3",
        label: "คลินิกพฤติกรรม",
      };
    case "sti":
      return {
        icon: <FaSyringe size={18} />,
        color: "#be185d",
        bg: "#fce7f3",
        label: "คลินิกโรคติดต่อฯ",
      };
    default:
      return {
        icon: <FaHeartbeat size={18} />,
        color: "#64748b",
        bg: "#f1f5f9",
        label: "ทั่วไป",
      };
  }
};

export default function CaseModals({
  showFollowupModal,
  setShowFollowupModal,
  formsList,
  selectedFollowupForm,
  handleSelectFollowup,
  followupLink,
  copyFollowupLink,
  showCloseCaseConfirm,
  setShowCloseCaseConfirm,
  handleCloseMasterCase,
  isDeleting,
  showSelectModal,
  setShowSelectModal,
  rawAnswers,
  copySelections,
  toggleQuestionCheck,
  setCopySelections,
  handleCopySelected,
  stripHtml,
  showDeleteConfirm,
  setShowDeleteConfirm,
  handleDeleteCase,
}) {
  return (
    <>
      {/* 🟢 1. Modal ส่งแบบประเมินให้คนไข้ (ดีไซน์ใหม่เป็นแบบ Card เลือก) */}
      {showFollowupModal && (
        <div
          className="cdm-sub-modal-overlay"
          style={{ zIndex: 999999 }}
          onClick={() => setShowFollowupModal(false)}
        >
          <div
            className="cdm-sub-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px", width: "100%", padding: "24px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "8px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  color: "#1e40af",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "20px",
                }}
              >
                <FaShareSquare /> ส่งแบบประเมินให้คนไข้
              </h3>
              <button
                className="cdm-close-btn"
                style={{
                  position: "static",
                  padding: "4px",
                  background: "#f1f5f9",
                  borderRadius: "50%",
                }}
                onClick={() => setShowFollowupModal(false)}
              >
                <FaTimes color="#64748b" />
              </button>
            </div>

            <p
              style={{
                color: "#64748b",
                fontSize: "14px",
                marginBottom: "20px",
                lineHeight: "1.5",
              }}
            >
              เลือกแบบฟอร์มที่ต้องการให้คนไข้ทำ ระบบจะสร้างลิงก์ที่เชื่อมกับ
              Case นี้ (การรักษาต่อเนื่อง) โดยอัตโนมัติ
            </p>

            {/* 🟢 1.1 กล่องเลือกแบบฟอร์ม (Custom Card Selection) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "280px",
                overflowY: "auto",
                paddingRight: "4px",
                marginBottom: "20px",
              }}
            >
              {formsList.length > 0 ? (
                formsList.map((form) => {
                  const style = getClinicStyling(form.clinic_type);
                  const isSelected = selectedFollowupForm === form.id;
                  return (
                    <div
                      key={form.id}
                      onClick={() => handleSelectFollowup(form.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        padding: "12px 16px",
                        borderRadius: "12px",
                        cursor: "pointer",
                        border: isSelected
                          ? `2px solid ${style.color}`
                          : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? style.bg : "#ffffff",
                        boxShadow: isSelected
                          ? `0 4px 12px ${style.color}20`
                          : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {/* ไอคอนคลินิก */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: "42px",
                          height: "42px",
                          borderRadius: "10px",
                          backgroundColor: style.color,
                          color: "white",
                          marginRight: "16px",
                          boxShadow: `0 4px 10px ${style.color}40`,
                        }}
                      >
                        {style.icon}
                      </div>

                      {/* ชื่อฟอร์ม */}
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: "700",
                            color: "#1e293b",
                            fontSize: "15px",
                            lineHeight: "1.2",
                          }}
                        >
                          {form.title}
                        </div>
                        {/* 🟢 เรียกใช้ style.label ตรงๆ โดยไม่ต้องใส่คำว่าคลินิกนำหน้าแล้ว */}
                        <div
                          style={{
                            fontSize: "13px",
                            color: style.color,
                            fontWeight: "600",
                            marginTop: "4px",
                          }}
                        >
                          {style.label}
                        </div>
                      </div>

                      {/* สถานะการเลือก */}
                      {isSelected ? (
                        <div
                          style={{
                            color: style.color,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontWeight: "bold",
                            fontSize: "14px",
                          }}
                        >
                          <FaCheckCircle size={18} /> เลือก
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            border: "2px solid #cbd5e1",
                          }}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    padding: "30px",
                    textAlign: "center",
                    color: "#94a3b8",
                    background: "#f8fafc",
                    borderRadius: "12px",
                    border: "1px dashed #cbd5e1",
                  }}
                >
                  ไม่พบแบบฟอร์มที่เปิดใช้งาน
                </div>
              )}
            </div>

            {/* 🟢 1.2 กล่องแสดงลิงก์ที่พร้อมส่ง */}
            {followupLink && (
              <div
                style={{
                  background: "#eff6ff",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #bfdbfe",
                  animation: "dbFadeInUp 0.3s ease",
                }}
              >
                <label
                  style={{
                    fontSize: "13px",
                    color: "#1e40af",
                    fontWeight: "bold",
                    display: "block",
                    marginBottom: "8px",
                  }}
                >
                  ลิงก์สำหรับส่งให้คนไข้ (คลิกปุ่มคัดลอก)
                </label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    type="text"
                    readOnly
                    value={followupLink}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #93c5fd",
                      fontSize: "13px",
                      background: "#fff",
                      color: "#334155",
                    }}
                  />
                  <button
                    onClick={copyFollowupLink}
                    style={{
                      background: "#2563eb",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "0 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: "bold",
                      fontSize: "14px",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) => (e.target.style.background = "#1d4ed8")}
                    onMouseOut={(e) => (e.target.style.background = "#2563eb")}
                  >
                    <FaLink /> คัดลอก
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCloseCaseConfirm && (
        <div
          className="cdm-sub-modal-overlay"
          style={{ zIndex: 999999 }}
          onClick={() => setShowCloseCaseConfirm(false)}
        >
          <div className="cdm-sub-modal-card" style={{ textAlign: "center" }}>
            <FaArchive size={48} color="#dc2626" />
            <h3 style={{ marginTop: "16px" }}>ยืนยันสิ้นสุดการรักษา?</h3>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "24px",
              }}
            >
              หากปิดเคสแล้ว จะไม่สามารถเพิ่มการนัดหมายหรือเปลี่ยนสถานะได้อีก
              (แต่ยังดูประวัติย้อนหลังได้) และหากคนไข้มากรอกฟอร์มใหม่
              ระบบจะเปิดเป็นเคสการรักษาใหม่
            </p>
            <div
              className="cdm-sub-modal-actions"
              style={{ justifyContent: "center" }}
            >
              <button
                className="cdm-btn-cancel"
                onClick={() => setShowCloseCaseConfirm(false)}
              >
                ยกเลิก
              </button>
              <button
                className="cdm-btn-confirm"
                style={{ background: "#dc2626" }}
                onClick={handleCloseMasterCase}
                disabled={isDeleting}
              >
                {isDeleting ? "กำลังปิดเคส..." : "ยืนยันปิดเคส"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showSelectModal && (
        <div
          className="cdm-sub-modal-overlay"
          style={{ zIndex: 999999 }}
          onClick={() => setShowSelectModal(false)}
        >
          <div
            className="cdm-sub-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>เลือกข้อมูลคัดลอก</h3>
            <div className="cdm-copy-check-list">
              {Object.keys(rawAnswers).map((q, i) => (
                <label key={i} className="cdm-check-item">
                  <input
                    type="checkbox"
                    checked={copySelections.selectedQuestions.includes(q)}
                    onChange={() => toggleQuestionCheck(q)}
                  />{" "}
                  {stripHtml(q)}
                </label>
              ))}
              <label
                className="cdm-check-item"
                style={{
                  paddingBottom: "10px",
                  marginBottom: "10px",
                  color: "#334155",
                  border: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={copySelections.includeNote}
                  onChange={() =>
                    setCopySelections((prev) => ({
                      ...prev,
                      includeNote: !prev.includeNote,
                    }))
                  }
                />
                บันทึกทั่วไป
              </label>
            </div>
            <div className="cdm-sub-modal-actions">
              <button
                className="cdm-btn-cancel"
                onClick={() => setShowSelectModal(false)}
              >
                ยกเลิก
              </button>
              <button className="cdm-btn-confirm" onClick={handleCopySelected}>
                คัดลอก
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          className="cdm-sub-modal-overlay"
          style={{ zIndex: 999999 }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="cdm-sub-modal-card" style={{ textAlign: "center" }}>
            <FaExclamationTriangle size={48} color="#ef4444" />
            <h3 style={{ marginTop: "16px" }}>ยืนยันลบแบบฟอร์มนี้ทิ้ง?</h3>
            <p
              style={{
                fontSize: "14px",
                color: "#64748b",
                marginBottom: "24px",
              }}
            >
              เฉพาะแบบประเมินนี้เท่านั้นที่จะหายไปจาก Timeline (ประวัติอื่นๆ
              จะยังคงอยู่)
            </p>
            <div
              className="cdm-sub-modal-actions"
              style={{ justifyContent: "center" }}
            >
              <button
                className="cdm-btn-cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                ยกเลิก
              </button>
              <button
                className="cdm-btn-confirm"
                style={{ background: "#ef4444" }}
                onClick={handleDeleteCase}
                disabled={isDeleting}
              >
                {isDeleting ? "กำลังลบ..." : "ยืนยันลบฟอร์ม"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
