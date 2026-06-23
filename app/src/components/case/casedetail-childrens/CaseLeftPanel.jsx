import React, { useState } from "react";
import { FaStream, FaChartBar, FaClipboardList, FaRegFolderOpen, FaFileAlt, FaChevronDown } from "react-icons/fa";

export default function CaseLeftPanel({
  leftViewMode, setLeftViewMode,
  viewingResponseId, setViewingResponseId,
  journeyResponses, data,
  scoreResults, rawAnswers, stripHtml, formatAnswer,
  formQuestions = [],
  selectedStaff,
  staffOptions,
  fullAnswers = {}
}) {

  const foundStaff = staffOptions.find(s => s.id === Number(selectedStaff));

  // 🟢 State สำหรับควบคุมการย่อ-ขยาย (ค่าเริ่มต้นให้เปิดไว้ทั้งคู่)
  const [isScoreOpen, setIsScoreOpen] = useState(true);
  const [isAnswersOpen, setIsAnswersOpen] = useState(true);

  // 🟢 Mapping ระดับความเสี่ยง → สี
  const caseRiskColors = {
    "น้ำหนักน้อย / ผอม": { bg: '#d0f0fd', color: '#0c4a6e' },
    "ปกติ (สุขภาพดี)": { bg: '#ecfdf5', color: '#065f46' },
    "ท้วม / โรคอ้วนระดับ 1": { bg: '#fef9c3', color: '#713f12' },
    "อ้วน / โรคอ้วนระดับ 2": { bg: '#fff7ed', color: '#7c2d12' },
    "อ้วนมาก / โรคอ้วนระดับ 3": { bg: '#fef2f2', color: '#7f1d1d' },
    "ปกติ / ไม่มีอาการซึมเศร้า": { bg: '#ecfdf5', color: '#065f46' },
    "มีอาการซึมเศร้าระดับน้อย": { bg: '#fef9c3', color: '#713f12' },
    "มีอาการซึมเศร้าระดับปานกลาง": { bg: '#fff7ed', color: '#7c2d12' },
    "มีอาการซึมเศร้าระดับรุนแรง": { bg: '#fef2f2', color: '#7f1d1d' }
  };


  // 🟢 ฟังก์ชันวาดตารางสำหรับคำตอบที่เป็น Object (เช่น Grid)
  const renderAnswerContent = (qTitle, ans) => {
    if (ans === undefined || ans === null || ans === '') return <p>-</p>;

    let qDef = null;
    for (const q of formQuestions) {
      if (stripHtml(q.title) === stripHtml(qTitle)) {
        qDef = q;
        break;
      }
      if (q.type === 'group' && q.subQuestions) {
        const sub = q.subQuestions.find(sq => stripHtml(sq.title) === stripHtml(qTitle));
        if (sub) {
          qDef = sub;
          break;
        }
      }
    }

    if (qDef && qDef.type === 'file_upload') {
      const fullAns = fullAnswers[qDef.id];
      console.log('File Upload Debug:', { qTitle, qDefId: qDef.id, fullAns, fullAnswers });
      
      if (fullAns && fullAns.data) {
        if (fullAns.type.startsWith('image/')) {
          return (
            <div style={{ marginTop: '10px' }}>
              <img src={fullAns.data} alt="uploaded" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', cursor: 'pointer', objectFit: 'cover', border: '1px solid #e2e8f0' }} onClick={() => {
                import('sweetalert2').then(Swal => {
                  Swal.default.fire({
                    imageUrl: fullAns.data,
                    imageAlt: fullAns.name,
                    showConfirmButton: false,
                    showCloseButton: true,
                    width: 'auto',
                    padding: '1em',
                    background: 'transparent',
                    backdrop: 'rgba(0,0,0,0.8)'
                  });
                });
              }} />
              <div style={{ marginTop: '8px' }}>
                <a href={fullAns.data} download={fullAns.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#3b82f6', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                  <FaFileAlt /> บันทึกภาพ
                </a>
              </div>
            </div>
          );
        } else if (fullAns.type.startsWith('audio/')) {
          return (
            <div style={{ marginTop: '10px' }}>
              <audio controls src={fullAns.data} style={{ width: '100%', maxWidth: '300px' }} />
              <div style={{ marginTop: '8px' }}>
                <a href={fullAns.data} download={fullAns.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: '#10b981', color: '#fff', borderRadius: '4px', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
                  <FaFileAlt /> ดาวน์โหลดเสียง
                </a>
              </div>
            </div>
          );
        }
      } else {
        // Fallback: If it's a file upload but data is missing in fullAnswers
        return (
          <div style={{ marginTop: '10px', padding: '10px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
            <FaFileAlt style={{ marginRight: '6px', color: '#64748b' }} /> 
            {formatAnswer(ans)}
            <br />
            <small style={{ color: '#ef4444' }}>*ไม่สามารถดึงข้อมูล Base64 ได้</small>
          </div>
        );
      }
    }

    // ถ้าคำตอบเป็น Object (เช่น ข้อมูลตาราง) ให้วาดเป็น Table แทน Text
    if (typeof ans === 'object' && !Array.isArray(ans)) {
      return (
        <div className="cdm-table-container">
          <table className="cdm-table">
            <tbody>
              {Object.entries(ans).map(([rowKey, rowValue], idx) => {
                let displayRowTitle = rowKey;
                // ดักจับข้อมูลเก่าที่บันทึกเป็นเลข 0, 1, 2
                if (!isNaN(rowKey) && qDef && qDef.rows && qDef.rows[rowKey]) {
                  displayRowTitle = stripHtml(qDef.rows[rowKey]);
                }

                return (
                  <tr key={idx}>
                    <td className="cdm-table-label">{displayRowTitle}</td>
                    <td className="cdm-table-value">
                      {Array.isArray(rowValue) ? rowValue.join(', ') : String(rowValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    // ถ้าเป็นข้อมูลข้อความธรรมดา (Text/Array)
    return <p>{formatAnswer(ans)}</p>;
  };

  return (
    <div className="cdm-left-panel">

      {/* 🟢 Tabs สลับโหมด */}
      <div className="cdm-panel-tabs" style={{ marginBottom: '20px' }}>
        <button
          className={`cdm-tab-btn ${leftViewMode === 'profile' ? 'active' : ''}`}
          onClick={() => setLeftViewMode('profile')}
          style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}
        >
          <FaRegFolderOpen /> ประวัติการทำฟอร์ม
        </button>
        <button
          className={`cdm-tab-btn ${leftViewMode === 'details' ? 'active' : ''}`}
          onClick={() => setLeftViewMode('details')}
          style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px' }}
        >
          <FaFileAlt /> ข้อมูลคำตอบฟอร์ม
        </button>
      </div>

      <div className="cdm-left-content-anim">

        {/* 🟢 โหมด: แฟ้มประวัติ (Profile Timeline) */}
        {leftViewMode === 'profile' && (
          <div>
            <h3 className="cdm-section-title">
              <FaStream /> ประวัติการทำแบบฟอร์ม/ประเมิน
            </h3>

            {journeyResponses && journeyResponses.length > 0 ? (
              <div className="cdm-timeline-list">
                {journeyResponses.map((r, index) => {
                  const isCurrent = r.id === data.id;
                  const isViewing = r.id === viewingResponseId;
                  const d = new Date(r.submitted_at);
                  const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;

                  // กำหนดสีป้ายความเสี่ยง ใช้ mapping ของระดับความเสี่ยง
                  const riskInfo = caseRiskColors[r.risk_level] || { bg: '#f8fafc', color: '#5f6160ff' }; // default เทา

                  return (
                    <div key={r.id}
                      className={`cdm-timeline-card ${isViewing ? 'active' : ''}`}
                      onClick={() => {
                        setViewingResponseId(r.id);
                        setLeftViewMode('details'); // คลิกแล้วเด้งไปหน้าข้อมูลคำตอบทันที
                      }}
                    >
                      <div className="cdm-timeline-info">
                        <div className="cdm-timeline-row">
                          <span className="cdm-timeline-index">#{journeyResponses.length - index}</span>
                          <span className="cdm-timeline-title">{r.form_title}</span>
                        </div>
                        <div className="cdm-timeline-row">
                          <span className="cdm-timeline-date">{dateStr}</span>
                          {isCurrent && <span className="cdm-badge-latest">รายการล่าสุด</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="cdm-timeline-risk-badge" style={{ background: riskInfo.bg, color: riskInfo.color }}>
                          {r.risk_level || 'ไม่ระบุ'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                ไม่พบประวัติการทำแบบประเมินอื่นๆ
              </div>
            )}
          </div>
        )}

        {/* 🟢 โหมด: ข้อมูลคำตอบฟอร์ม (Form Details) */}
        {leftViewMode === 'details' && (
          <div>
            {/* Dropdown สลับดูคำตอบฟอร์มอื่น (กรณีไม่ได้กดจาก Timeline) */}
            <div className="cdm-form-select-box">
              <label className="cdm-form-label">กำลังดูข้อมูลจากฟอร์ม:</label>
              <select
                className="cdm-form-input"
                value={viewingResponseId}
                onChange={(e) => setViewingResponseId(Number(e.target.value))}
              >
                {journeyResponses && journeyResponses.length > 0 ? (
                  journeyResponses.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      #{journeyResponses.length - i} {r.form_title} ({new Date(r.submitted_at).toLocaleDateString('th-TH')})
                    </option>
                  ))
                ) : (
                  <option value={data.id}>{data.form_title || 'แบบประเมินปัจจุบัน'}</option>
                )}

                <strong>เจ้าหน้าที่ผู้รับผิดชอบ:</strong>
                <p>{foundStaff ? foundStaff.fullname : "ยังไม่ระบุ"}</p>
                
              </select>
            </div>

            {/* 🟢 ส่วนของ "ผลประเมินของการตอบครั้งนี้" (พับได้) */}
            {scoreResults && scoreResults.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3
                  className="cdm-section-title cdm-collapse-header"
                  onClick={() => setIsScoreOpen(!isScoreOpen)}
                >
                  <FaChartBar color="#f59e0b" /> ผลประเมินระบบ
                  <FaChevronDown className={`cdm-collapse-icon ${isScoreOpen ? 'open' : ''}`} />
                </h3>

                {isScoreOpen && (
                  <div className="cdm-collapse-content">
                    {scoreResults.map((s, i) => (
                      <div key={i} className="cdm-score-card" style={{ borderLeftColor: s.color }}>
                        <div className="cdm-score-header">
                          <span className="cdm-score-title">{s.title}</span>
                          <span className="cdm-score-value" style={{ color: s.color }}>{s.score}</span>
                        </div>
                        <div className="cdm-score-badge" style={{ background: `${s.color}15`, color: s.color }}>ระดับ: {s.label}</div>
                        {s.advice && <div className="cdm-score-advice"><strong>คำแนะนำ:</strong> {s.advice}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 🟢 ส่วนของ "ข้อมูลคำตอบ" (พับได้) */}
            <div>
              <h3
                className="cdm-section-title cdm-collapse-header"
                onClick={() => setIsAnswersOpen(!isAnswersOpen)}
              >
                <FaClipboardList color="#10b981" /> ข้อมูลคำตอบ
                <FaChevronDown className={`cdm-collapse-icon ${isAnswersOpen ? 'open' : ''}`} />
              </h3>

              {isAnswersOpen && (
                <div className="cdm-collapse-content">
                  {Object.keys(rawAnswers).length > 0 ? (
                    Object.entries(rawAnswers).map(([q, a], i) => (
                      <div key={i} className="cdm-qa-box">
                        <strong>{stripHtml(q)}</strong>
                        {/* 🟢 เรียกใช้ฟังก์ชันวาดตาราง */}
                        {renderAnswerContent(q, a)}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#94a3b8', fontStyle: 'italic', padding: '10px 0' }}>ไม่มีข้อมูลคำตอบ</div>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}