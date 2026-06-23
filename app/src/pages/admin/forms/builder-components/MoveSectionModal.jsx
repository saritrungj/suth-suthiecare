import React from "react";
import { FaGripVertical, FaChevronUp, FaChevronDown } from "react-icons/fa";

const MoveSectionModal = ({ isOpen, onClose, sections, onMoveSection }) => {
  if (!isOpen) return null;

  return (
    <div className="sfb-modal-overlay">
      <div className="sfb-modal-content sfb-move-section-modal">
        <h3>จัดเรียงส่วนใหม่</h3>
        <div className="sfb-modal-body">
          {sections.map((sec, index) => (
            <div key={sec.id} className="sfb-move-section-item">
              <div className="sfb-form-drag-handle">
                <FaGripVertical />
              </div>
              <div className="sfb-section-info">
                <strong>{sec.title || "ส่วนที่ไม่มีชื่อ"}</strong>
                <span>
                  ส่วนที่ {index + 1} จาก {sections.length}
                </span>
              </div>
              <div className="sfb-section-actions">
                <button
                  disabled={index === 0}
                  onClick={() => onMoveSection(index, index - 1)}
                >
                  <FaChevronUp />
                </button>
                <button
                  disabled={index === sections.length - 1}
                  onClick={() => onMoveSection(index, index + 1)}
                >
                  <FaChevronDown />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="sfb-modal-footer">
          <button className="sfb-btn-cancel" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="sfb-btn-save-modal" onClick={onClose}>
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveSectionModal;
