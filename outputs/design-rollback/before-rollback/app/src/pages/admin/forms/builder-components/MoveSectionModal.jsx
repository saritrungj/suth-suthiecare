import { Dialog } from '../../../../components/ui/index.jsx';
import { Button as UiButton } from '../../../../components/ui/index.jsx';
import { toDisplayText } from '../../../../utils/textPresentation.js';
import React from "react";
import { FaGripVertical, FaChevronUp, FaChevronDown } from "react-icons/fa";

const MoveSectionModal = ({ isOpen, onClose, sections, onMoveSection }) => {
  if (!isOpen) return null;

  return (
    <Dialog title="จัดเรียงส่วนใหม่" size="small" className="sfb-move-section-dialog"
        aria-label="ย้ายส่วนคำถาม" onClose={onClose}>
        <div className="sfb-modal-body">
          {sections.map((sec, index) => (
            <div key={sec.id} className="sfb-move-section-item">
              <div className="sfb-form-drag-handle">
                <FaGripVertical />
              </div>
              <div className="sfb-section-info">
                <strong>{toDisplayText(sec.title || "ส่วนที่ไม่มีชื่อ")}</strong>
                <span>
                  ส่วนที่ {index + 1} จาก {sections.length}
                </span>
              </div>
              <div className="sfb-section-actions">
                <button
                  type="button"
                  aria-label={`ย้ายส่วนที่ ${index + 1} ขึ้น`}
                  disabled={index === 0}
                  onClick={() => onMoveSection(index, index - 1)}
                >
                  <FaChevronUp />
                </button>
                <button
                  type="button"
                  aria-label={`ย้ายส่วนที่ ${index + 1} ลง`}
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
          <UiButton variant="secondary" type="button" className="sfb-btn-cancel" onClick={onClose}>
            ยกเลิก
          </UiButton>
          <UiButton variant="primary" type="button" className="sfb-btn-save-modal" onClick={onClose}>
            บันทึก
          </UiButton>
        </div>
      </Dialog>
  );
};

export default MoveSectionModal;
