Plan: Date-driven dashboard + form-ordered case answers + PDF export
Context
Three related gaps in the admin tooling:

Dashboard date filtering is partial. On dashboard.jsx only the charts and the recent-cases table react to the date pickers. The stat boxes (getMasterCaseStats) and the recent-cases fetch (getRecentCases) ignore dates entirely, and the default range is empty on load. The requirement is that every metric/chart/table reacts to the selected range, with a default of the 1st → last day of the current month.

Case answers display in API/object order, not form order. Both the modal answers section (CaseLeftPanel.jsx) and the export (exportUtils.js) iterate Object.entries(rawAnswers), which follows insertion order. They must follow the form definition order (the parsed formQuestions array — the single source of truth).

No real PDF download. The current "ปริ้น / ส่งออก PDF" only opens window.print(). We need a separate downloadable PDF action alongside the unchanged Print.

Decisions (confirmed with user): edit backend + frontend for accurate date-filtered stats; use html2pdf.js for PDF.

Part 1 — Dashboard date filtering (all data reactive)
Backend — server/routes/dashboardRoutes.js
/admin/master-cases/stats (line 151): read startDate, endDate from req.query; when both present append AND DATE(r.submitted_at) BETWEEN ? AND ? to the SQL (push params). Mirrors the existing pattern already used in /charts/:formId/:questionId (lines 76-79).
/dashboard/recent (line 303): same — add startDate/endDate, append AND DATE(r.submitted_at) BETWEEN ? AND ? before the ORDER BY ... LIMIT.
API layer — app/src/services/api.js
getMasterCaseStats(clinic, formId, startDate, endDate) → add startDate, endDate to params (line 123).
getRecentCases(clinic, startDate, endDate) → add startDate, endDate to params (line 24).
Dashboard component — app/src/pages/admin/dashboard.jsx
Default range on load: initialize startDate/endDate (lines 118-119) to 1st and last day of current month. Compute dynamically: new Date(y, m, 1) and new Date(y, m+1, 0) (day 0 of next month = last day, leap-year safe), formatted YYYY-MM-DD to match the <input type="date"> value contract. Use a small toInputDate(d) helper.
Stats refetch: add startDate, endDate to the getMasterCaseStats call and to the effect deps (lines 140-154). Keep the existing isStatsLoading guard so the loading skeleton shows while refetching.
Recent cases refetch: pass startDate, endDate to getRecentCases and add them to the effect deps (lines 259-272). isLoading already drives the table loading state.
Charts: already reactive (lines 207-233) — no change needed; prevFetchRef already keys on start/end/formId.
Client table filter: filteredData (lines 279-297) can stay as a belt-and-suspenders client filter; with the server now date-bounded it becomes a no-op safety net. Leave intact so nothing breaks.
Empty/loading states: existing isInitialSetup spinner, isStatsLoading skeletons, isLoading table state, and the db-empty-state-card (lines 554-562) all remain and now correctly reflect each refetch.
Note on newToday: it is computed server-side as "today" within the queried set; once the range filter is applied it naturally counts only cases that are both today and in range. No special-casing needed.

Part 2 — Answer ordering driven by form definition (modal + export)
rawAnswers is keyed by question title (built in FormView via getQuestionTitles); formQuestions is the parsed form-definition array (objects with title, id, type, rows). Order = formQuestions array order.

New shared helper — add to exportUtils.js
// Returns [key, value] entries ordered by form definition, with any
// non-form keys (injected meta like สถานะเคส/ระดับความเสี่ยง/เจ้าหน้าที่/คลินิก
// and legacy unmatched answers) appended in their original order.
export const getOrderedAnswerEntries = (rawAnswers = {}, formQuestions = []) => {
const keys = Object.keys(rawAnswers);
const used = new Set();
const ordered = [];
formQuestions.forEach(q => {
const match = keys.find(k => !used.has(k) && stripHtml(k) === stripHtml(q.title));
if (match) { used.add(match); ordered.push([match, rawAnswers[match]]); }
});
keys.forEach(k => { if (!used.has(k)) ordered.push([k, rawAnswers[k]]); });
return ordered;
};
Single source of truth → both modal and export call it.

Modal — CaseLeftPanel.jsx
Import/receive the helper and replace the answers loop (lines 215-222): iterate getOrderedAnswerEntries(rawAnswers, formQuestions) instead of Object.entries(rawAnswers). formQuestions is already passed in (line 9 / line 831). Keep renderAnswerContent unchanged.
Export — exportUtils.js
executeExportPDF and the new PDF function build their answer rows from getOrderedAnswerEntries(leftPanelRawAnswers, formQuestions) instead of Object.keys(...) (lines 70-75).
Thread formQuestions into the export call: add it to onExportPDF payload in CaseDetailModal.jsx (lines 652-658) — formQuestions state already exists.
For consistency, generateCopyText ordering and the default copySelections.selectedQuestions also use the ordered keys (low-risk, keeps copy output matching the form order too).
Part 3 — Separate downloadable PDF export (html2pdf.js)
Install html2pdf.js in app/ (npm i html2pdf.js). Framework-agnostic; works with React 19. Renders the existing HTML report (Sarabun/Noto Sans Thai already loaded globally) to canvas → real .pdf, preserving Thai text.
Refactor exportUtils.js: extract the report HTML string (lines 37-92) into a shared buildReportHtml(payload) so Print and PDF share identical, form-ordered content. executeExportPDF keeps its current window.open/print behavior unchanged.
Add executeDownloadPDF(payload): build an off-screen container with buildReportHtml(...), run html2pdf().set({ filename: 'รายงานเคส-<displayName>.pdf', jsPDF:{ format:'a4' }, html2canvas:{ scale:2 } }).from(el).save(), then toast and close the menu. Add onDownloadPDF in CaseDetailModal.jsx mirroring onExportPDF.
UI — export dropdown (CaseDetailModal.jsx lines 790-808): keep the existing "ปริ้น / ส่งออก PDF" (Print) item; add a new distinct item, e.g. "⬇ ดาวน์โหลด PDF", calling onDownloadPDF. Two separate actions; copy submenu untouched.
Files to modify
server/routes/dashboardRoutes.js — date params on stats + recent endpoints
app/src/services/api.js — getMasterCaseStats, getRecentCases signatures
app/src/pages/admin/dashboard.jsx — default range + pass dates to stats/recent
app/src/components/case/casedetail-childrens/exportUtils.js — getOrderedAnswerEntries, buildReportHtml, executeDownloadPDF
app/src/components/case/casedetail-childrens/CaseLeftPanel.jsx — ordered answer loop
app/src/components/case/CaseDetailModal.jsx — thread formQuestions, add PDF action + menu item
app/package.json — add html2pdf.js
Verification
cd app && npm i html2pdf.js, start client + server.
Dashboard: on load the date pickers show 1st→last of current month; stat boxes, charts, and the recent table all reflect that range. Change the start/end date → confirm stats, charts, and table all refetch (skeletons/spinner show, then update); pick a range with no data → empty state appears. Switch clinic/form → still consistent.
Ordering: open a case whose form has a known field order; confirm the modal "ข้อมูลคำตอบ" lists fields in form order. Reorder a field in the form builder → confirm the modal order follows.
Print: "ปริ้น / ส่งออก PDF" still opens the print dialog, answers in form order — behavior unchanged.
PDF: new "ดาวน์โหลด PDF" downloads a .pdf with readable Thai text and answers in the same form order.
