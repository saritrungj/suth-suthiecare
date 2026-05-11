import React, { useState, useEffect } from "react";
import { FiClock, FiAlertCircle, FiUser, FiActivity, FiList, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./CaseTable.css";

export default function CaseTable({ data = [], questions = [], visibleColumns = [], isLoading, onSelectCase, viewMode = 'master', hasScoring = true }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => { setCurrentPage(1); }, [data]);

  const stripHtml = (html) => {
    if (html === undefined || html === null) return '';
    if (typeof html !== 'string') return String(html);
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  };

  const getRiskBadge = (riskLevel) => {
    if (!riskLevel) return <span className="risk-badge default">ไม่ระบุ</span>;
    if (riskLevel.includes('สูง')) return <span className="risk-badge high"><FiAlertCircle /> สูง</span>;
    if (riskLevel.includes('ปานกลาง')) return <span className="risk-badge medium">ปานกลาง</span>;
    return <span className="risk-badge low">ต่ำ</span>;
  };

  const getStatusBadge = (status) => {
    if (!status) return <span className="status-badge new">เคสใหม่</span>;
    if (status.includes('ปิดเคส')) return <span className="status-badge closed">{status}</span>;
    if (status.includes('รอ')) return <span className="status-badge pending">{status}</span>;
    return <span className="status-badge active">{status}</span>;
  };

  const findAnswerFlexible = (rawAnswers, qTitle) => {
    if (!rawAnswers || !qTitle) return undefined;
    const exactKey = qTitle.replace(/<[^>]+>/g, '');
    if (rawAnswers[exactKey] !== undefined) return rawAnswers[exactKey];
    const targetClean = stripHtml(qTitle).replace(/\s+/g, '').toLowerCase();
    for (const key in rawAnswers) {
      const keyClean = stripHtml(key).replace(/\s+/g, '').toLowerCase();
      if (keyClean === targetClean) { return rawAnswers[key]; }
    }
    return undefined;
  };

  const formatAnswer = (ans) => {
    if (ans === undefined || ans === null || ans === '') return '-';
    if (Array.isArray(ans)) return ans.join(', ');
    if (typeof ans === 'object') {
      return Object.entries(ans).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' | ');
    }
    return stripHtml(String(ans));
  };

  const dynamicQuestions = questions.filter(q => q.type !== 'section' && q.type !== 'description' && visibleColumns.includes(q.id));
  const showMasterRiskCol = hasScoring || data.some(row => row.overall_risk || (row.summary_data && row.summary_data.overall_risk));

  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentData = data.slice(startIndex, startIndex + rowsPerPage);

  const goToNextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const goToPrevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  if (isLoading) {
    return (
      <div className="table-box loading-state-box">
        <div className="spinner-container"><div className="spinner"></div><p>กำลังโหลดข้อมูล...</p></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="table-box empty-state-box">
        {viewMode === 'master' ? <FiUser className="empty-icon" /> : <FiList className="empty-icon" />}
        <h3>ไม่มีข้อมูลในขณะนี้</h3><p>ยังไม่มีข้อมูลในคลินิกนี้ หรือในช่วงเวลาที่เลือก</p>
      </div>
    );
  }

  return (
    <div className="table-box">
      <div className="table-scroll-wrapper table-scroll-with-footer">
        <table className={`case-table ${viewMode === 'form' ? 'form-view-mode' : ''}`}>
          <thead>
            <tr>
              <th className="th-seq">ลำดับ</th>
              <th className="th-date"><FiClock /> {viewMode === 'form' ? 'ส่งฟอร์มเมื่อ' : 'อัปเดตล่าสุด'}</th>
              <th className="th-caseid">รหัสเคส</th>
              <th>ชื่อผู้รับบริการ</th>
              {viewMode === 'master' ? (
                <>
                  <th className="th-action">การดำเนินการล่าสุด</th>
                  <th className="th-status">สถานะ</th>
                  {showMasterRiskCol && <th className="th-risk"><FiActivity /> ความเสี่ยงคลินิก</th>}
                </>
              ) : (
                <>
                  {hasScoring && <th className="th-score"><FiActivity /> ผลประเมินระบบ</th>}
                  {dynamicQuestions.map(q => (
                    <th key={q.id} title={stripHtml(q.title)} className="fixed-col">{stripHtml(q.title)}</th>
                  ))}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {currentData.map((row, index) => {
              const summary = row.summary_data || {};
              const rawAnswers = summary.raw_answers || {};
              const scoreResults = summary.score_results || [];
              
              const dateObj = new Date(row.submitted_at || row.updated_at || row.createdAt);
              const dateStr = dateObj.toLocaleDateString('th-TH', { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

              let calculatedRisk = null;
              if (scoreResults.length > 0) {
                  const isHigh = scoreResults.some(s => {
                    const c = s.color?.toLowerCase() || '';
                    return c.includes('d93025') || c.includes('e53935') || c.includes('f44336') ||
                      c.includes('ef4444') || c.includes('dc2626') || c.includes('ff0000') || c.includes('red') ||
                      (s.label && s.label.includes('สูง'));
                  });

                  const isMedium = scoreResults.some(s => {
                    const c = s.color?.toLowerCase() || '';
                    return c.includes('fbbc04') || c.includes('ff9800') || c.includes('f59e0b') ||
                      c.includes('orange') || c.includes('yellow') ||
                      (s.label && s.label.includes('ปานกลาง'));
                  });

                  if (isHigh) calculatedRisk = 'สูง';
                  else if (isMedium) calculatedRisk = 'ปานกลาง';
                  else calculatedRisk = 'ต่ำ';
              }

              let riskToDisplay = viewMode === 'master' ? (calculatedRisk || row.overall_risk || row.risk_level || summary.overall_risk || "ประเมินใหม่") : (calculatedRisk || row.risk_level || "ไม่ระบุ");
              const patientName = summary.display_name && summary.display_name !== '-' ? stripHtml(summary.display_name) : 'ไม่ระบุชื่อผู้ป่วย';

              return (
                <tr key={row.id}>
                  <td className="td-seq">{startIndex + index + 1}</td>
                  <td className="td-date">{dateStr} น.</td>
                  <td className="td-caseid">{row.master_case_id ? `MC-${String(row.master_case_id).padStart(4,'0')}` : `CASE-${String(row.id).padStart(4,'0')}`}</td>
                  <td>
                    <button className="case-name-link" onClick={() => onSelectCase(row)} title="คลิกเพื่อเปิดแฟ้มประวัติการรักษา">{patientName}</button>
                    {summary.display_faculty && summary.display_faculty !== '-' && viewMode === 'master' && (
                      <div className="faculty-desc">{stripHtml(summary.display_faculty)}</div>
                    )}
                  </td>

                  {viewMode === 'master' ? (
                    <>
                      <td className="td-action"><span className="action-badge">{row.form_title || "ส่งแบบฟอร์มประเมิน"}</span></td>
                      <td className="td-center">{getStatusBadge(row.status)}</td>
                      {showMasterRiskCol && <td className="td-center">{getRiskBadge(riskToDisplay)}</td>}
                    </>
                  ) : (
                    <>
                      {hasScoring && <td className="td-center">{getRiskBadge(riskToDisplay)}</td>}
                      {dynamicQuestions.map(q => {
                        const answerVal = findAnswerFlexible(rawAnswers, q.title);
                        const answerStr = formatAnswer(answerVal);
                        const sResult = scoreResults.find(sr => sr.title === stripHtml(q.title) || sr.question_id === q.id);
                        const hoverText = sResult ? `ผลประเมิน: ${sResult.label} (${sResult.score} คะแนน)\nคำตอบที่เลือก: ${answerStr !== '-' ? answerStr : 'ไม่ได้ตอบ'}` : (answerStr !== '-' ? answerStr : 'ไม่ได้ตอบคำถามนี้');

                        return (
                          <td key={q.id} className="dynamic-col" title={hoverText}>
                            {sResult ? (
                                <div className="result-badge" style={{ backgroundColor: sResult.color ? `${sResult.color}15` : '#f1f5f9', border: `1px solid ${sResult.color || '#cbd5e1'}` }}>
                                  <div className="result-dot" style={{ backgroundColor: sResult.color || '#64748b' }}></div>
                                  <span className="truncate-text">{sResult.label} ({sResult.score})</span>
                                </div>
                            ) : (
                                <span className="truncate-text dynamic-ans">{answerStr.length > 40 ? answerStr.substring(0, 40) + '...' : answerStr}</span>
                            )}
                          </td>
                        );
                      })}
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="table-pagination-footer">
          <div className="pagination-info">
            <span>แสดง</span>
            <select value={rowsPerPage} onChange={handleRowsPerPageChange} className="pagination-select">
              <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
            </select>
            <span>รายการ (รวมทั้งหมด {totalItems} รายการ)</span>
          </div>
          <div className="pagination-controls">
            <button className="page-btn" onClick={goToPrevPage} disabled={currentPage === 1} title="หน้าก่อนหน้า"><FiChevronLeft size={22} className="page-icon" /></button>
            <span className="page-indicator">หน้า <strong className="page-highlight">{currentPage}</strong> จาก {totalPages || 1}</span>
            <button className="page-btn" onClick={goToNextPage} disabled={currentPage === totalPages || totalPages === 0} title="หน้าถัดไป"><FiChevronRight size={22} className="page-icon" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}