import { toDisplayText } from "../../../utils/textPresentation.js";
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
        color: "var(--suth-muted)",
        bg: "var(--suth-surface-2)",
        label: "ทั่วไป",
      };
    case "teenager":
      return {
        icon: <FaUsers size={18} />,
        color: "var(--suth-info)",
        bg: "var(--suth-info-tint)",
        label: "คลินิกวัยรุ่น",
      };
    case "behavior":
      return {
        icon: <FaBrain size={18} />,
        color: "var(--suth-success)",
        bg: "var(--suth-success-tint)",
        label: "คลินิกพฤติกรรม",
      };
    case "sti":
      return {
        icon: <FaSyringe size={18} />,
        color: "var(--suth-danger)",
        bg: "var(--suth-danger-tint)",
        label: "คลินิกโรคติดต่อฯ",
      };
    default:
      return {
        icon: <FaHeartbeat size={18} />,
        color: "var(--suth-muted)",
        bg: "var(--suth-surface-2)",
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
          style={{ zIndex: "var(--z-modal-nested)" }}
          onClick={() => setShowFollowupModal(false)}
          role="presentation"
        >
          <div
            className="cdm-sub-modal-card"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "500px", width: "100%", padding: "24px" }}
            role="dialog"
            aria-modal="true"
            aria-label="ส่งแบบประเมินให้คนไข้"
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
                  color: "var(--suth-info)",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "var(--suth-fs-title)",
                }}
              >
                <FaShareSquare /> ส่งแบบประเมินให้คนไข้
              </h3>
              <button
                className="cdm-close-btn"
                style={{
                  position: "static",
                  padding: "4px",
                  background: "var(--suth-surface-2)",
                  borderRadius: "50%",
                }}
                onClick={() => setShowFollowupModal(false)}
                aria-label="ปิดหน้าต่าง"
              >
                <FaTimes color="var(--suth-muted)" />
              </button>
            </div>

            <p
              style={{
                color: "var(--suth-muted)",
                fontSize: "var(--suth-fs-sm)",
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
                        borderRadius: "var(--suth-radius)",
                        cursor: "pointer",
                        border: isSelected
                          ? `2px solid ${style.color}`
                          : "1px solid var(--suth-line-soft)",
                        backgroundColor: isSelected
                          ? style.bg
                          : "var(--suth-surface)",
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
                          borderRadius: "var(--suth-radius)",
                          backgroundColor: style.color,
                          color: "var(--suth-on-action)",
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
                            color: "var(--suth-ink)",
                            fontSize: "var(--suth-fs-body)",
                            lineHeight: "1.2",
                          }}
                        >
                          {toDisplayText(form.title)}
                        </div>
                        {/* 🟢 เรียกใช้ style.label ตรงๆ โดยไม่ต้องใส่คำว่าคลินิกนำหน้าแล้ว */}
                        <div
                          style={{
                            fontSize: "var(--suth-fs-label)",
                            color: style.color,
                            fontWeight: "600",
                            marginTop: "4px",
                          }}
                        >
                          {toDisplayText(style.label)}
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
                            fontSize: "var(--suth-fs-sm)",
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
                            border: "2px solid var(--suth-control-line)",
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
                    color: "var(--suth-muted)",
                    background: "var(--suth-surface-2)",
                    borderRadius: "var(--suth-radius)",
                    border: "1px dashed var(--suth-control-line)",
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
                  background: "var(--suth-surface-2)",
                  padding: "16px",
                  borderRadius: "var(--suth-radius)",
                  border: "1px solid var(--suth-info-line)",
                  animation: "dbFadeInUp 0.3s ease",
                }}
              >
                <label
                  style={{
                    fontSize: "var(--suth-fs-label)",
                    color: "var(--suth-info)",
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
                      borderRadius: "var(--suth-radius)",
                      border: "1px solid var(--suth-info-line)",
                      fontSize: "var(--suth-fs-label)",
                      background: "var(--suth-surface)",
                      color: "var(--suth-ink-2)",
                    }}
                  />
                  <button
                    onClick={copyFollowupLink}
                    style={{
                      background: "var(--suth-action-pressed)",
                      color: "var(--suth-on-action)",
                      border: "none",
                      borderRadius: "var(--suth-radius)",
                      padding: "0 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: "bold",
                      fontSize: "var(--suth-fs-sm)",
                      transition: "background 0.2s",
                    }}
                    onMouseOver={(e) =>
                      (e.target.style.background = "var(--suth-action-ink)")
                    }
                    onMouseOut={(e) =>
                      (e.target.style.background = "var(--suth-action-pressed)")
                    }
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
          style={{ zIndex: "var(--z-modal-nested)" }}
          onClick={() => setShowCloseCaseConfirm(false)}
          role="presentation"
        >
          <div
            className="cdm-sub-modal-card"
            style={{ textAlign: "center" }}
            role="dialog"
            aria-modal="true"
            aria-label="ยืนยันสิ้นสุดการรักษา"
          >
            <FaArchive size={48} color="var(--suth-danger)" />
            <h3 style={{ marginTop: "16px" }}>ยืนยันสิ้นสุดการรักษา?</h3>
            <p
              style={{
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-muted)",
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
                style={{ background: "var(--suth-risk-dot-high)" }}
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
          style={{ zIndex: "var(--z-modal-nested)" }}
          onClick={() => setShowSelectModal(false)}
          role="presentation"
        >
          <div
            className="cdm-sub-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="เลือกข้อมูลคัดลอก"
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
                  color: "var(--suth-ink-2)",
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
          style={{ zIndex: "var(--z-modal-nested)" }}
          onClick={() => setShowDeleteConfirm(false)}
          role="presentation"
        >
          <div
            className="cdm-sub-modal-card"
            style={{ textAlign: "center" }}
            role="dialog"
            aria-modal="true"
            aria-label="ยืนยันลบแบบฟอร์ม"
          >
            <FaExclamationTriangle size={48} color="var(--suth-danger)" />
            <h3 style={{ marginTop: "16px" }}>ยืนยันลบแบบฟอร์มนี้ทิ้ง?</h3>
            <p
              style={{
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-muted)",
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
                style={{ background: "var(--suth-risk-dot-high)" }}
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
