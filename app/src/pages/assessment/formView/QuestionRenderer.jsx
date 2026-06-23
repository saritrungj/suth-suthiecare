import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FiRefreshCw, FiCheck, FiXCircle } from 'react-icons/fi';
import { formatThaiID, validateThaiID, formatPhoneNumber } from './formUtils';
import { translateTextSmart } from '../../../utils/translator';
import Swal from 'sweetalert2';

const QuestionRenderer = ({
  q,
  index,
  answers,
  errors,
  verifiedIdentity,
  optionInputValues,
  optionUsage,
  handleClearQuestionAnswer,
  handleAnswer,
  handleOptionInputChange,
  handleGridAnswer
}) => {
  const { i18n } = useTranslation();
  const [translatedQ, setTranslatedQ] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const translateQuestion = async () => {
      if (i18n.language !== 'en') {
        if (isMounted) setTranslatedQ(null);
        return;
      }
      const tq = {};
      if (q.title) tq.title = await translateTextSmart(q.title);
      if (q.text) tq.text = await translateTextSmart(q.text);
      if (q.options) tq.options = await Promise.all(q.options.map(opt => translateTextSmart(opt)));
      if (q.rows) tq.rows = await Promise.all(q.rows.map(row => translateTextSmart(row)));
      if (q.cols) tq.cols = await Promise.all(q.cols.map(col => translateTextSmart(col)));
      if (isMounted) setTranslatedQ(tq);
    };
    translateQuestion();
    return () => { isMounted = false; };
  }, [q, i18n.language]);

  const displayTitle = translatedQ?.title || q.title;
  const displayText = translatedQ?.text || q.text;

  // กรณีเป็นคำถามกลุ่ม (Group)
  if (q.type === 'group') {
    const subs = q.subQuestions || [];
    return (
      <div id={`question-${q.id}`} className="preview-group-wrapper" style={{ animationDelay: `${index * 0.05}s` }}>
        <div className="preview-group-header">
          <h3 className="preview-sec__title" dangerouslySetInnerHTML={{ __html: displayTitle || 'กลุ่มคำถาม' }} />
          {displayText && <div className="preview-hint" dangerouslySetInnerHTML={{ __html: displayText }} />}
        </div>
        <div className="preview-group-body">
          {subs.map((sq, sIdx) => {
            const displayTitle = `<span style="color: var(--theme-color); margin-right: 4px;">${sIdx + 1}.</span> ${sq.title || ''}`;
            return (
              <QuestionRenderer
                key={sq.id}
                q={{ ...sq, title: displayTitle, isSubQuestion: true }}
                index={sIdx}
                answers={answers}
                errors={errors}
                verifiedIdentity={verifiedIdentity}
                optionInputValues={optionInputValues}
                handleClearQuestionAnswer={handleClearQuestionAnswer}
                handleAnswer={handleAnswer}
                handleOptionInputChange={handleOptionInputChange}
                handleGridAnswer={handleGridAnswer}
              />
            );
          })}
        </div>
      </div>
    );
  }

  const ans = answers[q.id];
  const hasError = !!errors[q.id];

  // เช็คว่าข้อนี้ถูกตอบไปหรือยัง
  let hasAnswer = false;
  if (q.type === 'checkboxes') {
    hasAnswer = ans && ans.length > 0;
  } else if (q.type === 'grid_multiple' || q.type === 'grid_checkbox') {
    if (ans) {
      const answeredRowsCount = Object.keys(ans).filter(rowIndex => {
        if (q.type === 'grid_checkbox') return ans[rowIndex] && ans[rowIndex].length > 0;
        return !!ans[rowIndex];
      }).length;
      hasAnswer = answeredRowsCount > 0;
    }
  } else if (q.type === 'bmi') {
    hasAnswer = ans && (ans.weight || ans.height);
  } else if (q.type === 'file_upload') {
    hasAnswer = ans && ans.data;
  } else {
    hasAnswer = !!ans && String(ans).trim() !== '';
  }

  return (
    <div id={`question-${q.id}`} className={`preview-sec ${hasError ? 'preview-sec--error' : ''} ${q.isSubQuestion ? 'preview-sec--sub' : ''}`} style={{ animationDelay: `${index * 0.05}s` }}>
      
      <div className="preview-sec__head_wrap">
        <div style={{ flex: 1 }}>
          <h3 className="preview-sec__title" dangerouslySetInnerHTML={{ __html: displayTitle || 'คำถามที่ไม่มีชื่อ' }} />
          {q.required && <span className="req">*</span>}
          {q.hasDescription && displayText && <div className="preview-hint" dangerouslySetInnerHTML={{ __html: displayText }} />}
        </div>
        
        {hasAnswer && !(q.type === 'national_id' && verifiedIdentity) && (
          <button 
            type="button" 
            className="clear-question-btn" 
            onClick={() => handleClearQuestionAnswer(q.id)}
            title="ล้างคำตอบข้อนี้"
          >
            <FiRefreshCw /> ล้างคำตอบ
          </button>
        )}
      </div>

      <div className="preview-sec__body">
        {q.image && <div className="preview-q-img"><img src={q.image} alt="question" /></div>}

        {q.type === 'video' && (() => {
          const getYoutubeEmbedUrl = (url) => {
            if (!url) return '';
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
            const match = url.match(regExp);
            const videoId = (match && match[2].length === 11) ? match[2] : '';
            return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
          };
          const embedUrl = getYoutubeEmbedUrl(q.videoUrl);
          if (!embedUrl) return null;
          return (
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', marginBottom: '15px' }}>
              <iframe 
                src={embedUrl} 
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }} 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen 
                referrerPolicy="strict-origin-when-cross-origin"
                title="YouTube Video"
              />
            </div>
          );
        })()}

        {q.type === 'file_upload' && (
          <div className="preview-file-upload-wrapper">
            <input 
              type="file" 
              accept="image/*,audio/*" 
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const isAudio = file.type.startsWith('audio/');
                  const maxSize = isAudio ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
                  const maxSizeLabel = isAudio ? '10 MB' : '5 MB';

                  if (file.size > maxSize) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'ไฟล์ขนาดใหญ่เกินไป',
                      text: `กรุณาอัปโหลดไฟล์ที่มีขนาดไม่เกิน ${maxSizeLabel}`,
                      confirmButtonColor: 'var(--theme-color)'
                    });
                    e.target.value = ''; // Reset input
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    handleAnswer(q.id, {
                      name: file.name,
                      type: file.type,
                      data: reader.result
                    });
                  };
                  reader.readAsDataURL(file);
                }
              }} 
              style={{ marginBottom: '10px' }}
            />
            {ans && ans.data && (
              <div className="preview-file-display" style={{ marginTop: '10px' }}>
                {ans.type.startsWith('image/') ? (
                  <img src={ans.data} alt="uploaded" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px' }} />
                ) : ans.type.startsWith('audio/') ? (
                  <audio controls src={ans.data} style={{ width: '100%' }} />
                ) : (
                  <div>ไฟล์ที่อัปโหลด: {ans.name}</div>
                )}
                <button 
                  type="button"
                  onClick={() => handleAnswer(q.id, null)}
                  style={{ display: 'block', marginTop: '10px', padding: '6px 12px', background: '#f44336', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  <FiXCircle style={{ verticalAlign: 'middle', marginRight: '4px' }}/> ลบไฟล์
                </button>
              </div>
            )}
          </div>
        )}

        {(q.type === 'short_text' || q.type === 'full_name') && (
          <input type="text" className={`preview-input ${hasError ? 'preview-input--error' : ''}`} placeholder="คำตอบของคุณ" value={ans || ''} onChange={(e) => handleAnswer(q.id, e.target.value)} />
        )}
        
        {(q.type === 'paragraph' || q.type === 'main_issue') && (
          <textarea className={`preview-input ${hasError ? 'preview-input--error' : ''}`} placeholder="คำตอบของคุณ" rows="4" value={ans || ''} onChange={(e) => handleAnswer(q.id, e.target.value)}></textarea>
        )}
        
        {q.type === 'phone_number' && (
          <input type="tel" className={`preview-input ${hasError ? 'preview-input--error' : ''}`} placeholder="0xx-xxx-xxxx" value={ans || ''} onChange={(e) => handleAnswer(q.id, formatPhoneNumber(e.target.value))} maxLength={12} />
        )}
        
        {q.type === 'date' && (
          <input type="date" className={`preview-input ${hasError ? 'preview-input--error' : ''}`} value={ans || ''} onChange={(e) => handleAnswer(q.id, e.target.value)} />
        )}

        {q.type === 'bmi' && (() => {
          const bmiAns = ans || { weight: '', height: '' };
          return (
            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '14px', color: '#5f6368', marginBot: '6px', display: 'block', fontWeight: 600 }}>น้ำหนัก (กิโลกรัม)</label>
                <input type="number" step="0.1" min="0" className={`preview-input ${hasError ? 'preview-input--error' : ''}`} placeholder="เช่น 65.5" value={bmiAns.weight || ''} onChange={(e) => handleAnswer(q.id, { ...bmiAns, weight: e.target.value })} />
              </div>
              <div style={{ flex: 1, minWidth: '120px' }}>
                <label style={{ fontSize: '14px', color: '#5f6368', marginBot: '6px', display: 'block', fontWeight: 600 }}>ส่วนสูง (เซนติเมตร)</label>
                <input type="number" step="0.1" min="0" className={`preview-input ${hasError ? 'preview-input--error' : ''}`} placeholder="เช่น 170" value={bmiAns.height || ''} onChange={(e) => handleAnswer(q.id, { ...bmiAns, height: e.target.value })} />
              </div>
            </div>
          );
        })()}

        {q.type === 'national_id' && (() => {
          const val = answers[q.id] || '';
          const isFullLength = val.length === 17;
          const isValid = isFullLength ? validateThaiID(val) : true;
          const isLocked = !!verifiedIdentity; 
          
          return (
            <div className="national-id-wrapper">
              <input 
                type="text" 
                className={`preview-input id-mask-input ${(hasError || (!isValid && !isLocked)) ? 'preview-input--error' : ''}`} 
                placeholder="x-xxxx-xxxxx-xx-x" 
                value={val} 
                onChange={(e) => {
                  if (!isLocked) handleAnswer(q.id, formatThaiID(e.target.value))
                }} 
                maxLength={17} 
                disabled={isLocked}
                style={isLocked ? { backgroundColor: '#f1f5f9', color: '#64748b', cursor: 'not-allowed', opacity: 0.8 } : {}}
              />
              {isLocked && (
                <div style={{ fontSize: '12.5px', color: '#2563eb', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                  <FiCheck /> ดึงข้อมูลจากประวัติเดิมอัตโนมัติ (เชื่อมโยงเคสแล้ว)
                </div>
              )}
              {isFullLength && !isValid && !isLocked && <div className="error-msg"><FiXCircle style={{ display: 'inline', transform: 'translateY(2px)' }} /> เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง</div>}
            </div>
          );
        })()}

        {q.type === 'booking' && q.displayAs === 'dropdown' && (
          <select className={`preview-input ${hasError ? 'preview-input--error' : ''}`} value={ans || ''} onChange={(e) => handleAnswer(q.id, e.target.value)}>
            <option value="" disabled>{i18n.language === 'en' ? 'Select an option' : 'เลือกคำตอบ'}</option>
            {q.options.map((opt, i) => {
              const displayOpt = translatedQ?.options?.[i] || opt;
              const textOnly = displayOpt.replace(/<[^>]+>/g, '');
              const originalTextOnly = opt.replace(/<[^>]+>/g, '');
              const limit = q.optionLimits?.[i];
              const usageCount = optionUsage?.[q.id]?.[opt] || 0;
              const isLimited = limit !== undefined && limit !== null && limit !== '';
              const remaining = isLimited ? Math.max(0, limit - usageCount) : null;
              const isFull = isLimited && remaining === 0;
              const fullText = i18n.language === 'en' ? 'Full' : 'เต็ม';
              const leftText = i18n.language === 'en' ? 'Left' : 'เหลือ';
              const optionLabel = isFull ? `[ ${fullText} ] - ${textOnly}` : (isLimited ? `[ ${leftText} ${remaining} ] - ${textOnly}` : textOnly);
              return <option key={i} value={originalTextOnly} disabled={isFull}>{optionLabel}</option>;
            })}
          </select>
        )}

        {q.type === 'booking' && q.displayAs !== 'dropdown' && (
          <div className="preview-chip-col">
            {q.options.map((opt, i) => {
              const isSelected = ans === opt;
              const showInput = q.optionHasInput?.[i] === true;
              const displayOpt = translatedQ?.options?.[i] || opt;
              
              const limit = q.optionLimits?.[i];
              const usageCount = optionUsage?.[q.id]?.[opt] || 0;
              const isLimited = limit !== undefined && limit !== null && limit !== '';
              const remaining = isLimited ? Math.max(0, limit - usageCount) : null;
              const isFull = isLimited && remaining === 0;
              const fullText = i18n.language === 'en' ? 'Full' : 'เต็มแล้ว';
              const leftText = i18n.language === 'en' ? 'Left' : 'เหลือ';

              return (
                <div key={i} className="preview-option-wrapper">
                  <label className={`preview-chip ${isSelected ? 'active' : ''}`} style={isFull ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: '#f1f5f9' } : {}}>
                    <input type="radio" name={`q-${q.id}`} checked={isSelected} disabled={isFull} onChange={() => { if (!isFull) handleAnswer(q.id, opt); }} />
                    <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                      <div style={{ display: 'inline' }} dangerouslySetInnerHTML={{ __html: displayOpt }} />
                      {isLimited && (
                        <span style={{ marginLeft: '8px', fontSize: '0.85em', color: isFull ? '#d32f2f' : '#2e7d32', fontWeight: 'bold', background: isFull ? '#ffebee' : '#e8f5e9', padding: '2px 8px', borderRadius: '12px', flexShrink: 0 }}>
                          {isFull ? fullText : `${leftText} ${remaining}`}
                        </span>
                      )}
                    </span>
                  </label>
                  
                  {isSelected && showInput && (
                    <div style={{ marginLeft: '30px', animation: 'fadeIn 0.2s ease-out' }}>
                      <input 
                        type="text" 
                        className="preview-input" 
                        placeholder="โปรดระบุรายละเอียด..." 
                        value={optionInputValues[`${q.id}_${opt}`] || ''}
                        onChange={(e) => handleOptionInputChange(q.id, opt, e.target.value)}
                        style={{ fontSize: '14px', padding: '6px 0', borderBottomColor: 'var(--theme-color)', maxWidth: '300px' }}
                        autoFocus
                      />
                    </div>
                  )}
                  
                  {q.optionImages && q.optionImages[i] && <img src={q.optionImages[i]} alt="option" className="preview-opt-img" style={isFull ? { opacity: 0.5 } : {}} />}
                </div>
              );
            })}
          </div>
        )}

        {q.type === 'multiple_choice' && (
          <div className="preview-chip-col">
            {q.options.map((opt, i) => {
              const isSelected = ans === opt;
              const showInput = q.optionHasInput?.[i] === true;
              const displayOpt = translatedQ?.options?.[i] || opt;
              
              return (
                <div key={i} className="preview-option-wrapper">
                  <label className={`preview-chip ${isSelected ? 'active' : ''}`}>
                    <input type="radio" name={`q-${q.id}`} checked={isSelected} onChange={() => handleAnswer(q.id, opt)} />
                    <div style={{ display: 'inline' }} dangerouslySetInnerHTML={{ __html: displayOpt }} />
                  </label>
                  
                  {isSelected && showInput && (
                    <div style={{ marginLeft: '30px', animation: 'fadeIn 0.2s ease-out' }}>
                      <input 
                        type="text" 
                        className="preview-input" 
                        placeholder="โปรดระบุรายละเอียด..." 
                        value={optionInputValues[`${q.id}_${opt}`] || ''}
                        onChange={(e) => handleOptionInputChange(q.id, opt, e.target.value)}
                        style={{ fontSize: '14px', padding: '6px 0', borderBottomColor: 'var(--theme-color)', maxWidth: '300px' }}
                        autoFocus
                      />
                    </div>
                  )}
                  
                  {q.optionImages && q.optionImages[i] && <img src={q.optionImages[i]} alt="option" className="preview-opt-img" />}
                </div>
              );
            })}
          </div>
        )}

        {q.type === 'checkboxes' && (
          <div className="preview-check-col">
            {q.options.map((opt, i) => {
              const isChecked = (ans || []).includes(opt);
              const showInput = q.optionHasInput?.[i] === true;
              const displayOpt = translatedQ?.options?.[i] || opt;
              
              return (
                <div key={i} className="preview-option-wrapper">
                  <label className={`preview-check ${isChecked ? 'active' : ''}`}>
                    <input type="checkbox" checked={isChecked} onChange={() => handleAnswer(q.id, opt, true)} />
                    <span className="preview-check__mark">{isChecked ? <FiCheck strokeWidth={3} /> : ""}</span>
                    <div style={{ display: 'inline' }} dangerouslySetInnerHTML={{ __html: displayOpt }} />
                  </label>
                  
                  {isChecked && showInput && (
                    <div style={{ marginLeft: '34px', animation: 'fadeIn 0.2s ease-out' }}>
                      <input 
                        type="text" 
                        className="preview-input" 
                        placeholder="โปรดระบุรายละเอียด..." 
                        value={optionInputValues[`${q.id}_${opt}`] || ''}
                        onChange={(e) => handleOptionInputChange(q.id, opt, e.target.value)}
                        style={{ fontSize: '14px', padding: '6px 0', borderBottomColor: 'var(--theme-color)', maxWidth: '300px' }}
                        autoFocus
                      />
                    </div>
                  )}

                  {q.optionImages && q.optionImages[i] && <img src={q.optionImages[i]} alt="option" className="preview-opt-img" />}
                </div>
              );
            })}
          </div>
        )}

        {(q.type === 'dropdown' || q.type === 'faculty') && (
          <select className={`preview-input ${hasError ? 'preview-input--error' : ''}`} value={ans || ''} onChange={(e) => handleAnswer(q.id, e.target.value)}>
            <option value="" disabled>{i18n.language === 'en' ? 'Select an option' : 'เลือกคำตอบ'}</option>
            {q.options.map((opt, i) => {
              const displayOpt = translatedQ?.options?.[i] || opt;
              const textOnly = displayOpt.replace(/<[^>]+>/g, '');
              const originalTextOnly = opt.replace(/<[^>]+>/g, '');
              return <option key={i} value={originalTextOnly}>{textOnly}</option>;
            })}
          </select>
        )}

        {(q.type === 'grid_multiple' || q.type === 'grid_checkbox') && (
          <div className="preview-grid-wrapper">
            <table className="preview-grid-table">
              <thead>
                <tr>
                  <th></th>
                  {q.cols.map((col, i) => <th key={i} dangerouslySetInnerHTML={{ __html: translatedQ?.cols?.[i] || col }} />)}
                </tr>
              </thead>
              <tbody>
                {q.rows.map((row, i) => (
                  <tr key={i} className={hasError && (!ans || (q.type === 'grid_multiple' ? !ans[i] : !ans[i]?.length)) ? 'grid-row-error' : ''}>
                    <td dangerouslySetInnerHTML={{ __html: translatedQ?.rows?.[i] || row }} />
                    {q.cols.map((col, j) => {
                      const key = String(i);
                      const rowAns = ans?.[key] || (q.type === 'grid_multiple' ? null : []);
                      const isChecked = q.type === 'grid_multiple' ? rowAns === col : (rowAns || []).includes(col);
                      return (
                        <td key={j} style={{ textAlign: 'center' }}>
                          <input type={q.type === 'grid_multiple' ? 'radio' : 'checkbox'} name={`grid-${q.id}-${i}`} checked={isChecked} onChange={() => handleGridAnswer(q.id, i, col, q.type === 'grid_checkbox')} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasError && (
          <div className="preview-error-msg">
            <FiXCircle size={18} />
            {errors[q.id]}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionRenderer;