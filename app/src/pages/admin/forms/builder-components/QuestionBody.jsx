import React, { useState } from 'react';
import { 
  FaCalendarAlt, FaPhoneAlt, FaIdCard, FaRegCircle, FaRegCheckSquare, 
  FaTimes, FaImage, FaChartBar, FaPlus, FaLayerGroup, FaTable, FaFont, FaCloudUploadAlt 
} from 'react-icons/fa';
import RichTextInput from './RichTextInput';

const QuestionBody = ({ q, editingCell, setEditingCell, handlers, isActive = true }) => {
  const {
    updateScoreMode, updateRowScore, updateGridItem, removeGridItem, addGridItem,
    updateGridColScore, updateCellScore, updateOption, updateOptionScore, updateOptionLimit,
    updateOptionImage, removeOption, addOption, addSubQuestion, updateSubQuestion, removeSubQuestion,
    toggleOptionInput, updateVideoUrl
  } = handlers;

  const [gridScoreExpanded, setGridScoreExpanded] = useState(false);
  const MAX_PREVIEW = 3; 

  if (q.type === 'group') {
    const subs = q.subQuestions || [];
    const visibleSubs = isActive ? subs : subs.slice(0, MAX_PREVIEW);
    const hiddenSubsCount = subs.length - visibleSubs.length;
    
    const handleAddSub = (type) => {
      const newSq = {
        id: `sq${Date.now()}`, groupId: q.id, type: type, title: 'คำถามย่อยใหม่...',
        options: ['ตัวเลือก 1', 'ตัวเลือก 2'], optionScores: [1, 0], isScored: true,
        optionHasInput: [false, false]
      };
      addSubQuestion(q.id, newSq);
    };

    return (
      <div className="sfb-group-container">
        <p className="sfb-group-header">
          <FaLayerGroup size={16} color="#1967d2" /> คำถามย่อยในกลุ่มนี้ ({subs.length} ข้อ)
        </p>

        {subs.length > 0 ? (
          <div className="sfb-group-subs-wrapper">
            {visibleSubs.map((sq, idx) => {
              const visibleSqOptions = isActive ? sq.options : sq.options.slice(0, MAX_PREVIEW);
              const hiddenSqOptionsCount = sq.options.length - visibleSqOptions.length;

              return (
                <div key={sq.id} className="sfb-sub-question-card">
                  <div className="sfb-sub-question-header">
                    <span className="sfb-sub-question-number">{idx + 1}.</span>
                    <RichTextInput 
                      className="sfb-opt-input sfb-editable" value={sq.title} 
                      onChange={(val) => updateSubQuestion(q.id, sq.id, 'title', val)} 
                      placeholder="พิมพ์คำถามย่อยที่นี่..." showLists={false} 
                    />
                    {isActive && (
                      <button onClick={() => removeSubQuestion(q.id, sq.id)} className="sfb-btn-remove-sub">
                        <FaTimes />
                      </button>
                    )}
                  </div>

                  {['multiple_choice', 'checkboxes'].includes(sq.type) && (
                    <div className="sfb-sub-options-wrapper">
                      {visibleSqOptions.map((opt, oIdx) => (
                        <div key={oIdx} className="sfb-sub-option-row">
                          {sq.type === 'multiple_choice' ? <FaRegCircle color="#ccc" /> : <FaRegCheckSquare color="#ccc" />}
                          
                          {/* 🟢 ห่อ Input กับ Dashed Line เข้าด้วยกัน */}
                          <div className="sfb-sub-opt-input-wrapper">
                            <input 
                              type="text" value={opt} 
                              onChange={(e) => {
                                const newOpts = [...sq.options]; newOpts[oIdx] = e.target.value;
                                updateSubQuestion(q.id, sq.id, 'options', newOpts);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && isActive) {
                                  e.preventDefault();
                                  const newOpts = [...sq.options, `ตัวเลือก ${sq.options.length + 1}`];
                                  const newScores = [...(sq.optionScores || []), 0];
                                  const newHasInput = [...(sq.optionHasInput || []), false];
                                  updateSubQuestion(q.id, sq.id, 'options', newOpts);
                                  updateSubQuestion(q.id, sq.id, 'optionScores', newScores);
                                  updateSubQuestion(q.id, sq.id, 'optionHasInput', newHasInput);
                                }
                              }}
                              className="sfb-sub-opt-input"
                              placeholder={`ตัวเลือก ${oIdx + 1}`}
                              // 🟢 ทริค: บังคับความกว้างให้เท่ากับตัวหนังสือพอดี เฉพาะตอนเปิดเส้นประ
                              style={sq.optionHasInput?.[oIdx] ? { flex: 'none', width: `${Math.max(opt.length, 3) + 2}ch`, minWidth: '40px' } : {}}
                            />

                            {sq.optionHasInput && sq.optionHasInput[oIdx] && (
                              <span className="sfb-dashed-line"></span>
                            )}
                          </div>
                          
                          {isActive && (
                            <>
                              <input 
                                type="number" value={sq.optionScores?.[oIdx] ?? 0}
                                onChange={(e) => {
                                  const newScores = [...(sq.optionScores || [])]; newScores[oIdx] = parseInt(e.target.value) || 0;
                                  updateSubQuestion(q.id, sq.id, 'optionScores', newScores);
                                }}
                                className="sfb-sub-score-input"
                                title="คะแนน"
                              />

                              <button 
                                onClick={() => {
                                  const currentHasInput = [...(sq.optionHasInput || Array(sq.options.length).fill(false))];
                                  currentHasInput[oIdx] = !currentHasInput[oIdx];
                                  updateSubQuestion(q.id, sq.id, 'optionHasInput', currentHasInput);
                                }}
                                className={`sfb-btn-toggle-input ${sq.optionHasInput?.[oIdx] ? 'active' : 'inactive'}`}
                                title="เพิ่มช่องกรอกข้อความในตัวเลือกนี้"
                              >
                                <FaFont />
                              </button>

                              <button
                                onClick={() => {
                                  const newOpts = sq.options.filter((_, i) => i !== oIdx);
                                  const newScores = (sq.optionScores || []).filter((_, i) => i !== oIdx);
                                  const newHasInput = (sq.optionHasInput || []).filter((_, i) => i !== oIdx);
                                  updateSubQuestion(q.id, sq.id, 'options', newOpts);
                                  updateSubQuestion(q.id, sq.id, 'optionScores', newScores);
                                  updateSubQuestion(q.id, sq.id, 'optionHasInput', newHasInput);
                                }}
                                className="sfb-btn-remove-sub-opt"
                                title="ลบตัวเลือกนี้"
                              ><FaTimes /></button>
                            </>
                          )}
                        </div>
                      ))}
                      
                      {hiddenSqOptionsCount > 0 && !isActive && (
                         <div className="sfb-hidden-options-hint">
                           <FaPlus size={10} /> มีตัวเลือกอื่นอีก {hiddenSqOptionsCount} รายการ...
                         </div>
                      )}

                      {isActive && (
                        <button 
                          className="sfb-smooth-element sfb-btn-add-sub-opt"
                          onClick={() => {
                            const newOpts = [...(sq.options || []), `ตัวเลือก ${sq.options.length + 1}`];
                            const newScores = [...(sq.optionScores || []), 0];
                            const newHasInput = [...(sq.optionHasInput || []), false];
                            updateSubQuestion(q.id, sq.id, 'options', newOpts);
                            updateSubQuestion(q.id, sq.id, 'optionScores', newScores);
                            updateSubQuestion(q.id, sq.id, 'optionHasInput', newHasInput);
                          }}
                        >
                          + เพิ่มตัวเลือก
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {hiddenSubsCount > 0 && !isActive && (
               <div className="sfb-hidden-subs-hint">
                 <FaPlus size={10} /> มีคำถามย่อยอื่นอีก {hiddenSubsCount} ข้อ... (คลิกการ์ดนี้เพื่อดูทั้งหมด)
               </div>
            )}
          </div>
        ) : (
          <div className="sfb-empty-subs-state">
            ยังไม่มีคำถามย่อยในกลุ่มนี้
          </div>
        )}

        <div className="sfb-smooth-element sfb-sub-actions-footer">
          <button onClick={() => handleAddSub('multiple_choice')} className="sfb-btn-add-sub-type">
            <FaRegCircle /> เพิ่มแบบหลายตัวเลือก
          </button>
          <button onClick={() => handleAddSub('checkboxes')} className="sfb-btn-add-sub-type">
            <FaRegCheckSquare /> เพิ่มแบบเช็คบ็อกซ์
          </button>
        </div>
      </div>
    );
  }

  // 🟢 2. UI พรีวิวสำหรับคำถามประเภทอื่นๆ
  if (q.type === 'description') return null;
  if (q.type === 'file_upload') return (
    <div className="sfb-dummy-input sfb-text-underlined" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#5f6368' }}>
      <FaCloudUploadAlt size={20} />
      <span>ผู้ตอบสามารถอัปโหลดไฟล์รูปภาพหรือเสียงได้ที่นี่</span>
    </div>
  );
  if (q.type === 'short_text' || q.type === 'full_name') return <div className="sfb-dummy-input sfb-text-underlined">ข้อความคำตอบสั้นๆ</div>;
  if (q.type === 'paragraph' || q.type === 'main_issue') return <div className="sfb-dummy-input sfb-text-underlined" style={{ width: '80%' }}>ข้อความคำตอบแบบยาว</div>;
  if (q.type === 'date') return <div className="sfb-dummy-input sfb-text-underlined sfb-dummy-date"><span>เดือน วัน ปี</span><FaCalendarAlt className="sfb-dummy-date-icon" /></div>;
  if (q.type === 'bmi') return (
    <div className="sfb-dummy-input sfb-dummy-bmi-container">
      <div className="sfb-dummy-bmi-box">น้ำหนัก (กิโลกรัม)</div>
      <div className="sfb-dummy-bmi-box">ส่วนสูง (เซนติเมตร)</div>
    </div>
  );

  if (q.type === 'phone_number') return (
    <div className="sfb-dummy-input sfb-text-underlined sfb-dummy-phone">
      <FaPhoneAlt size={16} /> 
      <div><div className="sfb-dummy-phone-hint">รูปแบบการกรอก: 0xx-xxx-xxxx (ตัวเลข 10 หลัก)</div><div className="sfb-dummy-phone-sub">* ระบบจะใส่ขีดคั่นให้โดยอัตโนมัติเมื่อผู้ใช้พิมพ์</div></div>
    </div>
  );

  if (q.type === 'national_id') return (
    <div className="sfb-dummy-input sfb-text-underlined sfb-dummy-id">
      <FaIdCard size={20} /> 
      <div><div className="sfb-dummy-phone-hint">รูปแบบช่องกรอก: x-xxxx-xxxxx-xx-x</div><div className="sfb-dummy-phone-sub">* กล่องยินยอม PDPA จะแสดงอัตโนมัติในหน้าผู้กรอกฟอร์ม</div></div>
    </div>
  );

  if (q.type === 'video') {
    const getYoutubeEmbedUrl = (url) => {
      if (!url) return '';
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
      const match = url.match(regExp);
      const videoId = (match && match[2].length === 11) ? match[2] : '';
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    };

    const embedUrl = getYoutubeEmbedUrl(q.videoUrl);

    return (
      <div className="sfb-video-container">
        {isActive && (
          <div style={{ marginBottom: '15px' }}>
            <input 
              type="text" 
              className="sfb-opt-input sfb-editable" 
              placeholder="วางลิ้งก์ YouTube ที่นี่ (เช่น https://www.youtube.com/watch?v=...)" 
              value={q.videoUrl || ''} 
              onChange={(e) => updateVideoUrl && updateVideoUrl(q.id, e.target.value)} 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
            />
          </div>
        )}
        {embedUrl ? (
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px' }}>
            <iframe 
              src={embedUrl} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen 
              referrerPolicy="strict-origin-when-cross-origin"
              title="YouTube Video"
            />
          </div>
        ) : (
          <div style={{ padding: '30px', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px', border: '1px dashed #ccc', color: '#666' }}>
            {isActive ? 'กรุณาวางลิ้งก์ YouTube เพื่อแสดงตัวอย่างวิดีโอ' : 'วิดีโอ (ไม่มีลิ้งก์)'}
          </div>
        )}
      </div>
    );
  }

  // 🟢 3. UI สำหรับคำถามแบบ Grid
  if (q.type === 'grid_multiple' || q.type === 'grid_checkbox') {
    const scoreModeUI = isActive && q.isScored && (
      <div className="sfb-smooth-element sfb-grid-score-toggle">
        <span className="sfb-grid-score-label">รูปแบบการให้คะแนน</span>
        <select className="sfb-grid-score-select sfb-type-selector" value={q.scoreMode || "column"} onChange={(e) => updateScoreMode(q.id, e.target.value)}>
          <option value="column">ให้คะแนนตามคอลัมน์</option>
          <option value="cell">ให้คะแนนตามช่อง</option>
        </select>
      </div>
    );

    const visibleRows = isActive ? q.rows : q.rows.slice(0, MAX_PREVIEW);
    const hiddenRowsCount = q.rows.length - visibleRows.length;
    
    const visibleCols = isActive ? q.cols : q.cols.slice(0, MAX_PREVIEW);
    const hiddenColsCount = q.cols.length - visibleCols.length;

    return (
      <>
        {scoreModeUI}
        <div className="sfb-grid-setup-container">
          <div className="sfb-grid-section">
            <p className="sfb-grid-label">แถว (คำถามย่อย)</p>
            {visibleRows.map((row, i) => (
              <div key={i} className="sfb-grid-item-row">
                <span className="sfb-idx-num">{i + 1}.</span>
                <RichTextInput className="sfb-opt-input sfb-editable" value={row} onChange={(val) => updateGridItem(q.id, 'rows', i, val)} showLists={false} />
                {isActive && q.isScored && q.scoreMode === "row" && (
                  <input type="number" className="sfb-opt-score-input" value={q.rowScores?.[i] ?? ""} onChange={(e) => updateRowScore(q.id, i, e.target.value === "" ? "" : parseInt(e.target.value))} placeholder="คะแนน" />
                )}
                {isActive && <button className="sfb-btn-remove-opt sfb-smooth-element" onClick={() => removeGridItem(q.id, 'rows', i)}><FaTimes /></button>}
              </div>
            ))}
            {hiddenRowsCount > 0 && !isActive && <div className="sfb-grid-item-row"><span className="sfb-idx-num sfb-muted"></span><span className="sfb-hidden-options-main"><FaPlus size={10} /> มีอีก {hiddenRowsCount} แถว...</span></div>}
            <div className="sfb-grid-item-row sfb-add-row-trigger sfb-smooth-element" onClick={() => addGridItem(q.id, 'rows')}><span className="sfb-idx-num sfb-muted">{q.rows.length + 1}.</span><span className="sfb-add-opt-text">เพิ่มแถว</span></div>
          </div>
          
          <div className="sfb-grid-section">
            <p className="sfb-grid-label">คอลัมน์ (ตัวเลือก)</p>
            {visibleCols.map((col, i) => (
              <div key={i} className="sfb-grid-item-row">
                {q.type === 'grid_multiple' ? <FaRegCircle className="sfb-opt-icon" /> : <FaRegCheckSquare className="sfb-opt-icon" />}
                <RichTextInput className="sfb-opt-input sfb-editable" value={col} onChange={(val) => updateGridItem(q.id, 'cols', i, val)} showLists={false} />
                {isActive && q.isScored && (q.scoreMode || "column") === "column" && (
                  <input type="number" className="sfb-opt-score-input" value={q.colScores?.[i] ?? 0} onChange={(e) => updateGridColScore(q.id, i, parseInt(e.target.value) || 0)} title="คะแนน" />
                )}
                {isActive && <button className="sfb-btn-remove-opt sfb-smooth-element" onClick={() => removeGridItem(q.id, 'cols', i)}><FaTimes /></button>}
              </div>
            ))}
            {hiddenColsCount > 0 && !isActive && <div className="sfb-grid-item-row"><span className="sfb-idx-num sfb-muted"></span><span className="sfb-hidden-options-main"><FaPlus size={10} /> มีอีก {hiddenColsCount} คอลัมน์...</span></div>}
            <div className="sfb-grid-item-row sfb-add-row-trigger sfb-smooth-element" onClick={() => addGridItem(q.id, 'cols')}>
              {q.type === 'grid_multiple' ? <FaRegCircle className="sfb-opt-icon sfb-muted" /> : <FaRegCheckSquare className="sfb-opt-icon sfb-muted" />}
              <span className="sfb-add-opt-text">เพิ่มคอลัมน์</span>
            </div>
          </div>
        </div>

        {isActive && q.isScored && q.scoreMode === "cell" && (
          <div className="sfb-scoring-accordion-wrapper sfb-smooth-element sfb-cell-scoring-wrapper">
            <button className="sfb-btn-toggle-rules" onClick={() => setGridScoreExpanded(!gridScoreExpanded)}>
              {gridScoreExpanded ? <><FaChartBar /> ซ่อนตารางกำหนดคะแนน</> : <><FaTable /> กำหนดคะแนนรายช่อง (Cell Scoring)</>}
            </button>
            <div className={`sfb-scoring-rules-collapse ${gridScoreExpanded ? 'open' : ''}`}>
              <table className="sfb-cell-score-table">
                <thead>
                  <tr><th></th>{q.cols.map((col, colIndex) => (<th key={colIndex}>{col}</th>))}</tr>
                </thead>
                <tbody>
                  {q.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td>{row}</td>
                      {q.cols.map((col, colIndex) => (
                        <td key={colIndex}>
                          <input type="number" className="sfb-cell-input"
                            value={editingCell === `${rowIndex}-${colIndex}` ? (q.cellScores?.[rowIndex]?.[colIndex] ?? "") : (q.cellScores?.[rowIndex]?.[colIndex] ?? 0)}
                            onFocus={() => setEditingCell(`${rowIndex}-${colIndex}`)}
                            onBlur={() => setEditingCell(null)}
                            onChange={(e) => updateCellScore(q.id, rowIndex, colIndex, e.target.value === "" ? "" : parseInt(e.target.value))}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    );
  }

  // 🟢 4. UI สำหรับตัวเลือกปกติ (Multiple Choice / Checkbox / Dropdown)
  const visibleOptions = isActive ? q.options : q.options.slice(0, MAX_PREVIEW);
  const hiddenOptionsCount = q.options.length - visibleOptions.length;

  return (
    <>
      {isActive && q.type === 'booking' && (
        <div className="sfb-smooth-element sfb-grid-score-toggle" style={{ marginBottom: '15px' }}>
          <span className="sfb-grid-score-label">รูปแบบการแสดงผล</span>
          <select 
            className="sfb-grid-score-select sfb-type-selector" 
            value={q.displayAs || "radio"} 
            onChange={(e) => handlers.updateDisplayAs && handlers.updateDisplayAs(q.id, e.target.value)}
          >
            <option value="radio">หลายตัวเลือก (Radio)</option>
            <option value="dropdown">เลื่อนลง (Dropdown)</option>
          </select>
        </div>
      )}
      <div className="sfb-options-container">
      {visibleOptions.map((opt, i) => {
        const handleOptImgUpload = (e) => {
          const file = e.target.files[0];
          if (file) { const reader = new FileReader(); reader.onloadend = () => updateOptionImage(q.id, i, reader.result); reader.readAsDataURL(file); }
          e.target.value = null;
        };
        return (
          <div key={i} className="sfb-option-wrapper">
            <div className="sfb-option-row" style={{ flexWrap: 'nowrap' }}>
              {(q.type === 'multiple_choice' || q.type === 'booking') && <FaRegCircle className="sfb-opt-icon" />}
              {q.type === 'checkboxes' && <FaRegCheckSquare className="sfb-opt-icon" />}
              {(q.type === 'dropdown' || q.type === 'faculty') && <span className="sfb-opt-number">{i + 1}.</span>}
              
              {/* 🟢 ห่อ Input กับ Dashed Line เข้าด้วยกัน */}
              <div className="sfb-opt-input-wrapper">
                <input 
                  type="text" className="sfb-opt-input sfb-editable" value={opt} 
                  onChange={(e) => updateOption(q.id, i, e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && isActive) { e.preventDefault(); addOption(q.id); } }}
                  placeholder={`ตัวเลือก ${i + 1}`} 
                  // 🟢 ทริค: บังคับความกว้างให้เท่ากับตัวหนังสือพอดี เฉพาะตอนเปิดเส้นประ
                  style={q.optionHasInput?.[i] ? { flex: 'none', width: `${Math.max(opt.length, 3) + 2}ch`, minWidth: '40px' } : {}}
                />

                {q.optionHasInput && q.optionHasInput[i] && (
                  <div className="sfb-option-dashed-line"></div>
                )}
              </div>

              {isActive && q.isScored && <input type="number" className="sfb-opt-score-input" value={q.optionScores?.[i] ?? 0} onChange={(e) => updateOptionScore(q.id, i, parseInt(e.target.value) || 0)} title="คะแนน" placeholder="คะแนน" />}
              
              {isActive && q.type === 'booking' && (
                <input type="number" className="sfb-opt-score-input" value={q.optionLimits?.[i] ?? ''} onChange={(e) => updateOptionLimit(q.id, i, e.target.value)} title="จำนวนโควต้า/ลิมิต" placeholder="ลิมิตจำนวน" style={{ minWidth: '90px' }} />
              )}

              {isActive && (
                <div className="sfb-option-actions sfb-smooth-element">
                  
                  {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'booking') && (
                    <button 
                      className={`sfb-btn-add-image-opt sfb-btn-toggle-input ${q.optionHasInput?.[i] ? 'active' : 'inactive'}`} 
                      title={q.optionHasInput?.[i] ? "ปิดช่องกรอกข้อความ" : "เพิ่มช่องให้ผู้ใช้พิมพ์ข้อความ (เช่น อื่นๆ: ___)"}
                      onClick={() => toggleOptionInput(q.id, i)}
                    >
                      <FaFont />
                    </button>
                  )}

                  {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'booking') && (
                    <>
                      <input type="file" accept="image/*" id={`file-opt-${q.id}-${i}`} hidden onChange={handleOptImgUpload} />
                      <button className="sfb-btn-add-image-opt" title="เพิ่มรูปภาพ" onClick={() => document.getElementById(`file-opt-${q.id}-${i}`).click()}><FaImage /></button>
                    </>
                  )}
                  <button className="sfb-btn-remove-opt" onClick={() => removeOption(q.id, i)}><FaTimes /></button>
                </div>
              )}
            </div>
            {q.optionImages && q.optionImages[i] && (
              <div className="sfb-option-image-preview">
                <img src={q.optionImages[i]} alt={`Option ${i + 1}`} />
                {isActive && <button className="sfb-btn-remove-image sfb-smooth-element" title="ลบรูปภาพ" onClick={() => updateOptionImage(q.id, i, null)}><FaTimes /></button>}
              </div>
            )}
          </div>
        );
      })}
      
      {hiddenOptionsCount > 0 && !isActive && (
        <div className="sfb-option-row">
          <span style={{ width: '24px' }}></span>
          <span className="sfb-hidden-options-main">
            <FaPlus size={10} /> มีตัวเลือกอื่นอีก {hiddenOptionsCount} รายการ... (คลิกเพื่อแก้ไข)
          </span>
        </div>
      )}

      <div className="sfb-option-row sfb-add-opt-row sfb-smooth-element" onClick={() => addOption(q.id)}>
        {(q.type === 'multiple_choice' || q.type === 'booking') && <FaRegCircle className="sfb-opt-icon sfb-muted" />}
        {q.type === 'checkboxes' && <FaRegCheckSquare className="sfb-opt-icon sfb-muted" />}
        {(q.type === 'dropdown' || q.type === 'faculty') && <span className="sfb-opt-number sfb-muted">{q.options.length + 1}.</span>}
        <span className="sfb-add-opt-text">เพิ่มตัวเลือก (หรือกด Enter)</span>
      </div>
      </div>
    </>
  );
}; 

export default QuestionBody;