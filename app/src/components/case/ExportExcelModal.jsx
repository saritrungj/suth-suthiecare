import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { FiX, FiDownload, FiCheckSquare, FiSquare } from 'react-icons/fi';
import './ExportExcelModal.css';

const stripHtml = (html) => {
    if (html === undefined || html === null) return '';
    if (typeof html !== 'string') return String(html);
    return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
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
    if (Array.isArray(ans)) return ans.join('\n');
    if (typeof ans === 'object') {
        return Object.entries(ans)
            .map(([k, v]) => `• ${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
            .join('\n');
    }
    return stripHtml(String(ans));
};

export default function ExportExcelModal({ isOpen, onClose, questions, data, formTitle }) {
    const [selectedQIds, setSelectedQIds] = useState([]);

    const allQuestions = useMemo(() => questions.filter(q => q.type !== 'section' && q.type !== 'description'), [questions]);

    useEffect(() => {
        if (isOpen) {
            setSelectedQIds(allQuestions.map(q => q.id));
        }
    }, [isOpen, allQuestions]);

    if (!isOpen) return null;

    const handleToggle = (id) => {
        setSelectedQIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAll = () => setSelectedQIds(allQuestions.map(q => q.id));
    const handleDeselectAll = () => setSelectedQIds([]);

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Responses');

        const selectedQuestions = allQuestions.filter(q => selectedQIds.includes(q.id));

        // Define columns dynamically to handle grid/multi-item questions
        const columns = [
            { header: 'รหัสเคส', key: 'case_id', width: 18 },
            { header: 'ลำดับ', key: 'seq', width: 8 },
            { header: 'วันที่ส่ง', key: 'date', width: 15 },
        ];

        selectedQuestions.forEach(q => {
            if ((q.type === 'grid_multiple' || q.type === 'grid_checkbox') && q.rows && Array.isArray(q.rows)) {
                q.rows.forEach((rowTitle, idx) => {
                    columns.push({
                        header: `${stripHtml(q.title)} [${stripHtml(rowTitle)}]`,
                        key: `${q.id}_${idx}`,
                        width: 40,
                        isScored: q.isScored // Mark as part of a scored question
                    });
                });
            } else if (q.type === 'group' && q.subQuestions && Array.isArray(q.subQuestions)) {
                q.subQuestions.forEach((sq, idx) => {
                    columns.push({
                        header: `${stripHtml(q.title)} - ${stripHtml(sq.title)}`,
                        key: `${q.id}_${idx}`,
                        width: 40,
                        isScored: q.isScored
                    });
                });
            } else {
                columns.push({
                    header: stripHtml(q.title),
                    key: q.id,
                    width: 45,
                    isScored: q.isScored
                });
            }

            // 🟢 Add Score/Result column if the question is scored
            if (q.isScored) {
                columns.push({
                    header: `[ผลประเมิน] ${stripHtml(q.title)}`,
                    key: `${q.id}_score`,
                    width: 30,
                    isScoreCol: true
                });
            }
        });

        worksheet.columns = columns;

        // Style the header
        const headerRow = worksheet.getRow(1);
        headerRow.height = 40;
        headerRow.eachCell((cell, colNumber) => {
            const colDef = columns[colNumber - 1];
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            
            // 🟢 Determine color based on column type
            let bgColor = 'FF4F81BD'; // Default: Professional Blue (Normal Questions)
            if (colDef.isScoreCol) {
                bgColor = 'FFF59E0B'; // Orange (Final Evaluation Results)
            } else if (colDef.isScored) {
                bgColor = 'FF107C41'; // Green/Teal (Questions that contribute to scoring)
            }

            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: bgColor }
            };

            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Add data
        data.forEach((row, index) => {
            const summary = row.summary_data || {};
            const rawAnswers = summary.raw_answers || {};
            const scoreResults = summary.score_results || [];
            const dateObj = new Date(row.submitted_at || row.updated_at || row.createdAt);
            const dateStr = dateObj.toLocaleDateString('th-TH');

            const rowData = {
                seq: index + 1,
                case_id: row.master_case_id ? `MC-${String(row.master_case_id).padStart(4, '0')}` : `CASE-${String(row.id).padStart(4, '0')}`,
                date: dateStr,
            };

            selectedQuestions.forEach(q => {
                const ans = findAnswerFlexible(rawAnswers, q.title);
                
                if ((q.type === 'grid_multiple' || q.type === 'grid_checkbox') && q.rows && Array.isArray(q.rows)) {
                    q.rows.forEach((rowTitle, idx) => {
                        const subAns = (ans && typeof ans === 'object') ? ans[rowTitle] : undefined;
                        rowData[`${q.id}_${idx}`] = formatAnswer(subAns);
                    });
                } else if (q.type === 'group' && q.subQuestions && Array.isArray(q.subQuestions)) {
                    q.subQuestions.forEach((sq, idx) => {
                        const subAns = (ans && typeof ans === 'object') ? ans[sq.title] : undefined;
                        rowData[`${q.id}_${idx}`] = formatAnswer(subAns);
                    });
                } else {
                    rowData[q.id] = formatAnswer(ans);
                }

                if (q.isScored) {
                    const cleanTitle = stripHtml(q.title);
                    const scoreObj = scoreResults.find(s => stripHtml(s.title) === cleanTitle);
                    if (scoreObj) {
                        rowData[`${q.id}_score`] = `${scoreObj.score} (${scoreObj.label})`;
                    } else {
                        rowData[`${q.id}_score`] = '-';
                    }
                }
            });

            const addedRow = worksheet.addRow(rowData);
            addedRow.alignment = { vertical: 'top', wrapText: true }; // Use vertical 'top' for better readability of multi-line cells
            addedRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Auto filter and freeze top row
        worksheet.autoFilter = {
            from: 'A1',
            to: {
                row: 1,
                column: columns.length
            }
        };
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Export_${stripHtml(formTitle || 'Data').replace(/\s+/g, '_')}_${new Date().getTime()}.xlsx`);
        onClose();
    };

    return (
        <div className="eem-modal-overlay" onClick={onClose}>
            <div className="eem-modal-content" onClick={e => e.stopPropagation()}>
                <div className="eem-modal-header">
                    <h3>เลือกคำถามที่ต้องการ Export เป็น Excel</h3>
                    <button className="eem-close-btn" onClick={onClose}><FiX size={20} /></button>
                </div>
                <div className="eem-modal-body">
                    <div className="eem-selection-controls">
                        <button className="eem-text-btn" onClick={handleSelectAll}>เลือกทั้งหมด</button>
                        <button className="eem-text-btn" onClick={handleDeselectAll}>ไม่เลือกเลย</button>
                    </div>
                    <div className="eem-questions-list">
                        {allQuestions.map(q => (
                            <label key={q.id} className="eem-question-item">
                                <input
                                    type="checkbox"
                                    checked={selectedQIds.includes(q.id)}
                                    onChange={() => handleToggle(q.id)}
                                    style={{ display: 'none' }}
                                />
                                {selectedQIds.includes(q.id) ? (
                                    <FiCheckSquare className="eem-checkbox checked" />
                                ) : (
                                    <FiSquare className="eem-checkbox" />
                                )}
                                <span className="eem-question-text">{stripHtml(q.title)}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="eem-modal-footer">
                    <button className="eem-cancel-btn" onClick={onClose}>ยกเลิก</button>
                    <button className="eem-export-btn" onClick={handleExport} disabled={selectedQIds.length === 0}>
                        <FiDownload /> Export Excel ({selectedQIds.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
