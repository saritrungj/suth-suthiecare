// src/components/case/casedetail-childrens/exportUtils.js
//โค้ดสร้างรายงาน PDF

// 1. ฟังก์ชันทำความสะอาด HTML
export const stripHtml = (html) =>
  html
    ? String(html)
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .trim()
    : "";

// 2. ฟังก์ชันจัดรูปแบบคำตอบ
export const formatAnswer = (ans) => {
  if (!ans) return "-";
  if (Array.isArray(ans)) return ans.map(stripHtml).join(", ");
  if (typeof ans === "object")
    return Object.entries(ans)
      .map(
        ([k, v]) =>
          `${stripHtml(k)}: ${Array.isArray(v) ? v.map(stripHtml).join(", ") : stripHtml(v)}`,
      )
      .join(" | ");
  return stripHtml(String(ans));
};

// 3. ฟังก์ชันสร้างข้อความสำหรับคัดลอก (Copy)
export const generateCopyText = ({
  selections,
  viewedResponse,
  leftPanelRawAnswers,
  leftPanelScoreResults,
  riskLevel,
  staffNote,
  status,
  currentStaff,
}) => {
  let text = `📌 [รายงานเคส] ${viewedResponse?.form_title || ""}\n--------------------------------\n`;
  if (selections.selectedQuestions.length > 0) {
    selections.selectedQuestions.forEach((q, idx) => {
      text += `${idx + 1}. ${stripHtml(q)}\n   => ${formatAnswer(leftPanelRawAnswers[q])}\n`;
    });
  }
  if (selections.includeScores && leftPanelScoreResults.length > 0) {
    text += `\n[ผลประเมิน]\n• ความเสี่ยงรวม: ${viewedResponse?.risk_level || riskLevel}\n`;
    leftPanelScoreResults.forEach((s) => {
      text += `• ${s.title}: ${s.score} (${s.label})\n`;
    });
  }
  if (selections.includeNote && staffNote && staffNote.trim() !== "") {
    text += `\n[บันทึกเพิ่มเติม]\n${staffNote.trim()}\n`;
  }
  text += `--------------------------------\nสถานะ: ${status}\nคัดลอกโดย: ${currentStaff}\nเวลา: ${new Date().toLocaleString("th-TH")} น.\n`;
  return text;
};

// 4. ฟังก์ชันสร้างและเปิดหน้าต่าง PDF
export const executeExportPDF = ({
  displayName,
  viewedResponse,
  data,
  leftPanelSummary,
  leftPanelRawAnswers,
  leftPanelScoreResults,
  riskLevel,
  status,
  currentStaff,
  submittedDate,
  showToast,
  setShowExportMenu,
  setShowExportCopySubmenu,
}) => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset='utf-8'>
      <title>รายงานเคส — ${displayName}</title>
      <style>
        @media print {
          @page { size: A4; margin: 2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'TH SarabunPSK', 'Angsana New', 'Sarabun', sans-serif; font-size: 14pt; margin: 0; color: #1e293b; background: #fff; }
        h2 { color: #1e40af; font-size: 18pt; border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 12px; }
        .meta { font-size: 11pt; color: #64748b; margin-bottom: 18px; line-height: 1.8; }
        .section-title { font-size: 13pt; font-weight: bold; color: #1e40af; margin-top: 18px; margin-bottom: 8px; border-left: 4px solid #3b82f6; padding-left: 10px; }
        .qa-block { margin-bottom: 8px; padding: 7px 12px; background: #f8fafc; border-radius: 5px; page-break-inside: avoid; }
        .qa-question { font-weight: bold; color: #334155; font-size: 13pt; }
        .qa-answer { color: #1e293b; font-size: 13pt; margin-left: 14px; margin-top: 3px; }
        .score-block { background: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #3b82f6; padding: 10px 14px; border-radius: 6px; margin-top: 6px; page-break-inside: avoid; }
        .risk-overall { font-size: 14pt; font-weight: bold; color: #1e40af; margin-bottom: 6px; }
        .score-row { font-size: 12pt; margin-bottom: 3px; }
        .footer { margin-top: 28px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 10pt; color: #94a3b8; }
      </style>
    </head>
    <body>
      <h2>📌 รายงานเคส — ${viewedResponse?.form_title || ""}</h2>
      <div class="meta">
        Response ID: RE-${String(data?.id || "0").padStart(4, "0")} &nbsp;|&nbsp;
        ผู้ป่วย: ${leftPanelSummary.display_name || displayName} &nbsp;|&nbsp;
        วันที่: ${submittedDate} น.
      </div>

      <div class="section-title">📝 ข้อมูลแบบประเมิน</div>
      ${Object.keys(leftPanelRawAnswers)
        .map(
          (q, i) => `
        <div class="qa-block">
          <div class="qa-question">${i + 1}. ${stripHtml(q)}</div>
          <div class="qa-answer">➤ ${formatAnswer(leftPanelRawAnswers[q])}</div>
        </div>
      `,
        )
        .join("")}

      ${
        leftPanelScoreResults.length > 0
          ? `
        <div class="section-title">📊 ผลการประเมิน</div>
        <div class="score-block">
          <div class="risk-overall">ความเสี่ยงรวม: ${riskLevel}</div>
          ${leftPanelScoreResults
            .map(
              (s) => `
            <div class="score-row">• ${s.title}: <b>${s.score}</b> คะแนน (${s.label})</div>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }

      <div class="footer">
        สถานะเคส: ${status} &nbsp;|&nbsp; ส่งออกโดย: ${currentStaff} &nbsp;|&nbsp; วันที่ส่งออก: ${new Date().toLocaleString("th-TH")} น.
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=800,height=900");
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };

  setShowExportMenu(false);
  setShowExportCopySubmenu(false);
  showToast("เปิดหน้าต่างพิมพ์แล้ว — เลือก 'บันทึกเป็น PDF' ได้เลย 🖨️");
};
