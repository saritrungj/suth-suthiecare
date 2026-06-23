import React, { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FaEllipsisV, FaGripHorizontal, FaGripVertical, FaImage, FaTimes, 
  FaChartBar, FaPlus, FaClone, FaTrashAlt, FaIdCard, FaUser, 
  FaPhoneAlt, FaBuilding, FaClipboardList,
  FaMinus, FaAlignLeft, FaRegCircle, FaRegCheckSquare, 
  FaCaretSquareDown, FaThList, FaTh, FaChevronDown,
  FaCalendarAlt, FaWeight, FaTrophy, FaCog, FaBriefcase, FaYoutube, FaFileAlt
} from 'react-icons/fa';
import RichTextInput from './RichTextInput';

// 🟢 โครงสร้างข้อมูลประเภทคำถามพร้อม Icon 
const QUESTION_TYPES = [
  {
    group: 'คำถามทั่วไป',
    options: [
      { value: 'short_text', label: 'คำตอบสั้นๆ', icon: <FaMinus /> },
      { value: 'paragraph', label: 'ย่อหน้า', icon: <FaAlignLeft /> },
      { value: 'multiple_choice', label: 'หลายตัวเลือก', icon: <FaRegCircle /> },
      { value: 'checkboxes', label: 'ช่องทำเครื่องหมาย', icon: <FaRegCheckSquare /> },
      { value: 'dropdown', label: 'เลื่อนลง', icon: <FaCaretSquareDown /> },
      { value: 'file_upload', label: 'อัปโหลดไฟล์ (รูปภาพ/เสียง)', icon: <FaFileAlt /> },
      { value: 'booking', label: 'ตัวเลือกแบบกำหนดจำนวน', icon: <FaClipboardList /> },
      { value: 'date', label: 'วันที่', icon: <FaCalendarAlt /> },
      { value: 'video', label: 'วิดีโอ (YouTube)', icon: <FaYoutube /> },
    ]
  },
  {
    group: 'โครงสร้างและคะแนน',
    options: [
      { value: 'group', label: 'กลุ่มคำถาม (จัดกลุ่ม+รวมคะแนน)', icon: <FaThList /> }, 
      { value: 'grid_multiple', label: 'ตารางหลายตัวเลือก', icon: <FaTh /> },
      { value: 'grid_checkbox', label: 'ตารางช่องทำเครื่องหมาย', icon: <FaTh /> },
    ]
  },
  {
    group: 'ข้อมูลส่วนบุคคล (PDPA)',
    options: [
      { value: 'full_name', label: 'ชื่อ-นามสกุล', icon: <FaUser /> },
      { value: 'phone_number', label: 'เบอร์โทรศัพท์', icon: <FaPhoneAlt /> },
      { value: 'national_id', label: 'เลขบัตรประชาชน', icon: <FaIdCard /> },
      { value: 'faculty', label: 'สำนักวิชา / หน่วยงาน', icon: <FaBuilding /> },
      { value: 'user_status', label: 'สถานะ / อาชีพ', icon: <FaBriefcase /> },
      { value: 'main_issue', label: 'ปัญหา/ความต้องการหลัก', icon: <FaClipboardList /> },
    ]
  },
  {
    group: 'ระบบคำนวณอัตโนมัติ',
    options: [
      { value: 'bmi', label: 'ระบบคำนวณ BMI', icon: <FaWeight /> },
    ]
  }
];

const CustomTypeSelector = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOpt = QUESTION_TYPES.flatMap(g => g.options).find(o => o.value === value);

  return (
    <div className="sfb-custom-select-container" ref={ref}>
      <div className={`sfb-custom-select-trigger ${isOpen ? 'open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <div className="sfb-custom-select-val">
          <span className="sfb-opt-icon-sm">{selectedOpt?.icon || <FaMinus />}</span>
          <span>{selectedOpt?.label || 'เลือกประเภท'}</span>
        </div>
        <FaChevronDown className="sfb-custom-select-arrow" />
      </div>
      {isOpen && (
        <div className="sfb-custom-select-dropdown">
          {QUESTION_TYPES.map((group, gIdx) => (
            <React.Fragment key={gIdx}>
              <div className="sfb-select-group-label">{group.group}</div>
              {group.options.map(opt => (
                <div key={opt.value} className={`sfb-select-option ${value === opt.value ? 'selected' : ''}`} onClick={() => { onChange(opt.value); setIsOpen(false); }}>
                  <span className="sfb-opt-icon-sm">{opt.icon}</span>
                  <span>{opt.label}</span>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const SortableQuestion = ({
  q, index, totalSections, sectionIndex,
  questions, setQuestions, updateQuestionType, removeQuestion,
  renderQuestionBody, duplicateQuestion, updateDescriptionPresence,
  updateRequired, updateIsScored, updateScoringRules,
  updateQuestionImage, onOpenMoveModal, duplicateSection, removeSection,
  isActive, onSetActive,
  updateIsEditable
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id });
  
  const style = { 
    transform: CSS.Translate.toString(transform), 
    transition, 
    zIndex: isDragging ? 100 : (isActive ? 50 : 1), 
    opacity: isDragging ? 0.9 : 1, 
    touchAction: 'none',
    boxShadow: isDragging ? '0 15px 30px rgba(0,0,0,0.15)' : 'none'
  };

  const [footerMenuOpen, setFooterMenuOpen] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false); 
  const footerMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (footerMenuRef.current && !footerMenuRef.current.contains(e.target)) setFooterMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleQuestionImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => updateQuestionImage(q.id, reader.result);
      reader.readAsDataURL(file);
    }
    e.target.value = null;
  };

  const handleRuleChange = (idx, field, value) => {
    const newRules = [...(q.scoringRules || [])];
    newRules[idx] = { ...newRules[idx], [field]: field === 'min' || field === 'max' ? parseFloat(value) || 0 : value };
    updateScoringRules(q.id, newRules);
  };
  
  const addRule = () => {
    const newRules = [...(q.scoringRules || []), { min: 0, max: 0, label: '', color: '#4caf50', advice: '' }];
    updateScoringRules(q.id, newRules);
  };
  
  const removeRule = (idx) => {
    const newRules = (q.scoringRules || []).filter((_, i) => i !== idx);
    updateScoringRules(q.id, newRules);
  };

  const renderProfileBadge = (type, isUserStatus) => {
    if (isUserStatus) return <><FaBriefcase /> สถานะ / อาชีพ (ใช้คัดกรองสถิติอัตโนมัติ)</>;
    switch(type) {
      case 'national_id': return <><FaIdCard /> ฟิลด์ระบุตัวตน (PDPA อัตโนมัติ)</>;
      case 'full_name': return <><FaUser /> ชื่อผู้รับบริการ</>;
      case 'phone_number': return <><FaPhoneAlt /> เบอร์โทรศัพท์</>;
      case 'faculty': return <><FaBuilding /> สำนักวิชา / หน่วยงาน</>;
      case 'main_issue': return <><FaClipboardList /> ปัญหา/ความต้องการหลัก</>;
      case 'bmi': return <><FaWeight /> คำนวณ BMI อัตโนมัติ</>;
      default: return null;
    }
  };

  const isProfileField = ['national_id', 'full_name', 'phone_number', 'faculty', 'main_issue', 'bmi'].includes(q.type) || q.isUserStatus;
  const isScoreableType = ['multiple_choice', 'checkboxes', 'dropdown', 'grid_multiple', 'grid_checkbox', 'bmi', 'group'].includes(q.type);
  const isEditableConfigurable = !['section', 'description', 'video', 'booking', 'bmi', 'grid_multiple', 'grid_checkbox', 'group', 'file_upload'].includes(q.type);

  if (q.type === 'section') {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        className={`sfb-form-card sfb-section-card ${isActive ? 'active' : 'inactive'}`}
        onClick={(e) => { e.stopPropagation(); onSetActive && onSetActive(); }}
      >
        <div className="sfb-section-header-bar sfb-theme-bg">
          <div className="sfb-section-header-left">
            <div className="sfb-form-drag-handle-inline sfb-smooth-element" {...attributes} {...listeners}>
              <FaGripVertical />
            </div>
            <div className="sfb-section-indicator">ส่วนที่ {sectionIndex} จาก {totalSections} :</div>
            <input
              type="text"
              className="sfb-step-name-input-inline sfb-smooth-element"
              placeholder="ชื่อแถบสถานะ"
              value={q.stepName || ''}
              onChange={(e) => setQuestions(questions.map(item => item.id === q.id ? { ...item, stepName: e.target.value } : item))}
            />
          </div>
          <div className="sfb-section-menu-container sfb-smooth-element" ref={footerMenuRef}>
            <button className="sfb-btn-section-menu" onClick={() => setFooterMenuOpen(!footerMenuOpen)}><FaEllipsisV /></button>
            {footerMenuOpen && (
              <div className="sfb-section-dropdown-menu">
                <button onClick={() => { duplicateSection(q.id); setFooterMenuOpen(false); }}>ทำสำเนาส่วน</button>
                <button onClick={() => { onOpenMoveModal(); setFooterMenuOpen(false); }}>ย้ายส่วน</button>
                <button onClick={() => { removeSection(q.id); setFooterMenuOpen(false); }}>ลบส่วน</button>
              </div>
            )}
          </div>
        </div>
        <div className="sfb-section-body-content">
          <RichTextInput tagName="h2" className="sfb-input-title" placeholder="ส่วนที่ไม่มีชื่อ" value={q.title} onChange={(val) => setQuestions(questions.map(item => item.id === q.id ? { ...item, title: val } : item))} showLists={false} />
          <RichTextInput className="sfb-input-desc" placeholder="คำอธิบาย (ระบุหรือไม่ก็ได้)" value={q.text || ''} onChange={(val) => setQuestions(questions.map(item => item.id === q.id ? { ...item, text: val } : item))} showLists={true} />
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`sfb-form-card sfb-question-card ${isActive ? 'active' : 'inactive'} ${isProfileField ? 'sfb-identity-highlight' : ''}`}
      onClick={(e) => { e.stopPropagation(); onSetActive && onSetActive(); }}
    >
      {q.isScored && (
        <div className="sfb-score-indicator-badge" title="ข้อนี้เปิดโหมดให้คะแนน">
          <FaTrophy />
        </div>
      )}

      {/* 🟢 Badge สำหรับคำถามที่อนุญาตให้แก้ไขได้ (ไม่โชว์ถ้าเป็นเลขบัตรปชช.) */}
      {(q.isEditable || q.type === 'phone_number') && q.type !== 'national_id' && (
        <div className="sfb-editable-badge">
          <FaUser /> แก้ไขได้ในหน้าประวัติ
        </div>
      )}

      <div className="sfb-form-drag-handle sfb-smooth-element" {...attributes} {...listeners}><FaGripHorizontal /></div>
      
      <input type="file" accept="image/*" id={`file-q-${q.id}`} hidden onChange={handleQuestionImageUpload} />

      {isProfileField && (
        <div className="sfb-profile-badge-header">
          {renderProfileBadge(q.type, q.isUserStatus)}
        </div>
      )}

      <div className="sfb-question-row">
        <div className="sfb-question-input-wrapper">
          <RichTextInput
            className="sfb-input-question-main"
            placeholder={q.type === 'description' ? "ส่วนหัวคำอธิบาย" : "คำถาม"}
            value={q.title}
            onChange={(val) => setQuestions(questions.map(item => item.id === q.id ? { ...item, title: val } : item))}
            showLists={false}
          />
          {q.type !== 'description' && (
            <button className="sfb-btn-add-image sfb-smooth-element" title="เพิ่มรูปภาพ" onClick={() => document.getElementById(`file-q-${q.id}`).click()}>
              <FaImage />
            </button>
          )}
        </div>

        {q.type !== 'description' && (
          <div className="sfb-type-selector-wrapper sfb-smooth-element">
            <CustomTypeSelector value={q.isUserStatus ? 'user_status' : q.type} onChange={(val) => updateQuestionType(q.id, val)} />
          </div>
        )}
      </div>

      {q.type !== 'description' && q.hasDescription && (
        <div className="sfb-description-body sfb-smooth-element sfb-description-box">
          <RichTextInput
            className="sfb-description-input"
            value={q.text || ''}
            onChange={(val) => setQuestions(questions.map(item => item.id === q.id ? { ...item, text: val } : item))}
            placeholder="คำอธิบายเพิ่มเติมสำหรับคำถามนี้..."
            showLists={true}
          />
        </div>
      )}

      {q.image && (
        <div className="sfb-question-image-preview">
          <img src={q.image} alt="Question" />
          <button className="sfb-btn-remove-image sfb-smooth-element" title="ลบรูปภาพ" onClick={() => updateQuestionImage(q.id, null)}><FaTimes /></button>
        </div>
      )}

      <div className="sfb-question-body">{renderQuestionBody(q, isActive)}</div>

      {q.isScored && (
        <div className="sfb-scoring-accordion-wrapper sfb-smooth-element">
          <button 
            className="sfb-btn-toggle-rules" 
            onClick={() => setRulesExpanded(!rulesExpanded)}
          >
            {rulesExpanded ? <><FaChartBar /> ซ่อนการตั้งค่าเกณฑ์แปลผล</> : <><FaCog style={{ marginRight: '6px' }} /> ตั้งค่าเกณฑ์แปลผลลัพธ์</>}
          </button>

          <div className={`sfb-scoring-rules-collapse ${rulesExpanded ? 'open' : ''}`}>
            {(q.scoringRules || []).map((rule, idx) => (
              <div key={idx} className="sfb-scoring-rule-card">
                <button className="sfb-btn-remove-rule" onClick={() => removeRule(idx)} title="ลบเกณฑ์นี้"><FaTimes /></button>
                <div className="sfb-scoring-rule-row">
                  <span className="sfb-scoring-rule-label">คะแนนตั้งแต่</span>
                  <input type="number" step="0.01" className="sfb-rule-score-input" value={rule.min} onChange={(e) => handleRuleChange(idx, 'min', e.target.value)} />
                  <span className="sfb-scoring-rule-label">ถึง</span>
                  <input type="number" step="0.01" className="sfb-rule-score-input" value={rule.max} onChange={(e) => handleRuleChange(idx, 'max', e.target.value)} />
                  <div className="sfb-rule-gap"></div>
                  <input type="color" className="sfb-rule-color-input" value={rule.color} onChange={(e) => handleRuleChange(idx, 'color', e.target.value)} title="สีที่จะใช้แสดงผล" />
                  <input type="text" className="sfb-rule-text-input" placeholder="ข้อความแปลผล เช่น เสี่ยงสูง" value={rule.label} onChange={(e) => handleRuleChange(idx, 'label', e.target.value)} />
                </div>
                <div className="sfb-scoring-rule-row">
                  <input type="text" className="sfb-rule-text-input sfb-rule-advice-input" placeholder="คำแนะนำเพิ่มเติม (แสดงหรือไม่ก็ได้)" value={rule.advice} onChange={(e) => handleRuleChange(idx, 'advice', e.target.value)} />
                </div>
              </div>
            ))}
            <button className="sfb-btn-add-rule" onClick={addRule}>
              <FaPlus /> เพิ่มเกณฑ์ใหม่
            </button>
          </div>
        </div>
      )}

      <div className="sfb-card-footer sfb-smooth-element">
        <button className="sfb-btn-duplicate" title="ทำสำเนา" onClick={() => duplicateQuestion(q.id)}><FaClone /></button>
        <button className="sfb-btn-delete" title="ลบ" onClick={() => removeQuestion(q.id)}><FaTrashAlt /></button>
        <span className="sfb-footer-divider" aria-hidden="true" />

        {q.type !== 'video' && (
          <label className="sfb-required-toggle">
            <input type="checkbox" checked={!!q.required} onChange={(e) => updateRequired && updateRequired(q.id, e.target.checked)} />
            <span>จำเป็นต้องตอบ</span>
          </label>
        )}

        <div className="sfb-question-settings-container" ref={footerMenuRef}>
          <button className="sfb-btn-question-settings" onClick={() => setFooterMenuOpen(!footerMenuOpen)} title="การตั้งค่าเพิ่มเติม">
            <FaEllipsisV />
          </button>
          {footerMenuOpen && (
            <div className="sfb-question-settings-dropdown">
              {q.type !== 'description' && !q.isDescriptionBlock && (
                <label className="sfb-dropdown-toggle-item">
                  <input type="checkbox" checked={!!q.hasDescription} onChange={(e) => updateDescriptionPresence(q.id, e.target.checked)} />
                  <span>แสดงคำอธิบาย</span>
                </label>
              )}
              {isScoreableType && (
                <label className="sfb-dropdown-toggle-item">
                  <input type="checkbox" checked={!!q.isScored} onChange={(e) => updateIsScored(q.id, e.target.checked)} />
                  <span className={q.isScored ? 'sfb-dropdown-highlight-scored' : ''}>
                    เปิดโหมดให้คะแนน
                  </span>
                </label>
              )}
              
              {/* 🟢 เมนูอนุญาตให้แก้ไข (ซ่อนถ้าเป็นบัตร ปชช. / ปิดใช้งานถ้าเป็นเบอร์โทร) */}
              {isEditableConfigurable && q.type !== 'national_id' && (
                <label className={`sfb-dropdown-toggle-item ${q.type === 'phone_number' ? 'sfb-dropdown-item-disabled' : ''}`}>
                  <input 
                    type="checkbox" 
                    checked={q.type === 'phone_number' ? true : !!q.isEditable} 
                    disabled={q.type === 'phone_number'}
                    onChange={(e) => updateIsEditable && updateIsEditable(q.id, e.target.checked)} 
                  />
                  <span className={(q.isEditable || q.type === 'phone_number') ? 'sfb-dropdown-highlight-editable' : ''}>
                    {q.type === 'phone_number' ? 'อนุญาตให้แก้ไข (บังคับเปิด)' : 'อนุญาตให้แก้ไขในประวัติ'}
                  </span>
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SortableQuestion;