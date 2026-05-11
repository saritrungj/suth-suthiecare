import { useState, useEffect, useMemo, useRef } from "react";
import Sidebar from "../../components/Sidebar";
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import ExportExcelModal from "../../components/case/ExportExcelModal";
import { getForms, getFormById, getFormResponses } from "../../services/api";
import "./CaseData.css";
import { useLocation } from "react-router-dom";
import { FiFolder, FiUsers, FiList, FiSettings, FiSearch, FiChevronDown, FiLayers, FiActivity, FiCalendar, FiDownload } from 'react-icons/fi';

const FACULTIES = [
  "(1) สำนักวิชาวิทยาศาสตร์", "(2) สำนักวิชาเทคโนโลยีสังคม", "(3) สำนักวิชาเทคโนโลยีการเกษตร",
  "(4) สำนักวิชาวิศวกรรมศาสตร์", "(5) สำนักวิชาแพทยศาสตร์", "(6) สำนักวิชาพยาบาลศาสตร์",
  "(7) สำนักวิชาทันตแพทยศาสตร์", "(8) สำนักวิชาสาธารณสุขศาสตร์", "(9) สำนักวิชาศาสตร์และศิลป์ดิจิทัล", "อื่นๆ"
];

const CLINIC_INFO = {
  general: { id: 'general', text: 'ทั่วไป', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
  teenager: { id: 'teenager', text: 'คลินิกวัยรุ่น', color: '#0284c7', bg: '#e0f2fe', border: '#7dd3fc' },
  behavior: { id: 'behavior', text: 'คลินิกLSM', color: '#166534', bg: '#dcfce7', border: '#86efac' },
  sti: { id: 'sti', text: 'คลินิกโรคติดต่อฯ', color: '#be185d', bg: '#fce7f3', border: '#f9a8d4' }
};

function getRiskLevel(summary_data) {
  const scoreResults = summary_data?.score_results || [];
  if (scoreResults.length === 0) return "ต่ำ";

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

  if (isHigh) return "สูง";
  if (isMedium) return "ปานกลาง";
  return "ต่ำ";
}

// 🟢 คอมโพเนนต์ Custom Dropdown
const CustomDropdown = ({ icon: Icon, value, options, onChange, styleClass, iconClass, textClass }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : (options[0]?.label || "โปรดเลือก...");

  return (
    <div
      className={`scd-custom-select ${styleClass || ''}`}
      ref={ref}
      style={{ zIndex: isOpen ? 999 : 1 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className={`scd-filter-icon ${iconClass || ''}`} />
      <span className={`scd-select-value ${textClass || ''}`}>{displayLabel}</span>
      <FiChevronDown className={`scd-dropdown-icon ${isOpen ? 'open' : ''}`} />

      {isOpen && (
        <div className="scd-select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`scd-select-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function CaseData() {
  const location = useLocation();
  const initialFormId = location.state?.defaultFormId || "";

  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState("");
  const [risk, setRisk] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(initialFormId);
  const [currentFormDetails, setCurrentFormDetails] = useState(null);
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState([]);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef(null);

  const [clinicFilter, setClinicFilter] = useState('all');
  const [formStatusFilter, setFormStatusFilter] = useState('published');
  const [tableViewMode, setTableViewMode] = useState('master');

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colMenuRef.current && !colMenuRef.current.contains(event.target)) {
        setShowColMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchForms = async () => {
      try {
        const res = await getForms("latest");
        setForms(res.data);

        if (initialFormId) {
          const targetForm = res.data.find(f => f.id === initialFormId);
          if (targetForm) {
            setClinicFilter(targetForm.clinic_type || 'general');
            if (targetForm.status !== 'published') setFormStatusFilter('draft');
          }
        } else if (res.data.length > 0) {
          const publishedForms = res.data.filter(f => f.status === 'published');
          if (publishedForms.length > 0) {
            setSelectedFormId(publishedForms[0].id);
          } else {
            setSelectedFormId(res.data[0].id);
            setFormStatusFilter('all');
          }
        }
      } catch (err) { }
    };
    fetchForms();
  }, [initialFormId]);

  const filteredFormsList = useMemo(() => {
    let list = forms;
    if (clinicFilter !== 'all') list = list.filter(f => (f.clinic_type || 'general') === clinicFilter);
    if (formStatusFilter === 'published') list = list.filter(f => f.status === 'published');
    else if (formStatusFilter === 'draft') list = list.filter(f => f.status !== 'published');
    return list;
  }, [forms, clinicFilter, formStatusFilter]);

  useEffect(() => {
    if (forms.length === 0) return;
    if (filteredFormsList.length > 0) {
      const isValid = filteredFormsList.some(f => String(f.id) === String(selectedFormId));
      if (!isValid) setSelectedFormId(filteredFormsList[0].id);
    } else {
      setSelectedFormId("");
      setCurrentFormDetails(null);
      setResponses([]);
    }
  }, [filteredFormsList, selectedFormId, forms.length]);

  useEffect(() => {
    const fetchFormAndResponses = async () => {
      if (!selectedFormId) return;
      setIsLoading(true);
      try {
        const [formRes, responseRes] = await Promise.all([
          getFormById(selectedFormId),
          getFormResponses(selectedFormId)
        ]);

        let formDetails = formRes.data;
        if (typeof formDetails.questions === 'string') {
          formDetails.questions = JSON.parse(formDetails.questions);
        }
        setCurrentFormDetails(formDetails);

        const realQuestions = formDetails.questions.filter(q => q.type !== 'section' && q.type !== 'description');
        const savedColumns = localStorage.getItem(`visibleColumns_${selectedFormId}`);

        if (savedColumns) {
          setVisibleColumns(JSON.parse(savedColumns));
        } else {
          const defaultVisible = realQuestions.slice(0, 5).map(q => q.id);
          setVisibleColumns(defaultVisible);
        }

        const parsedResponses = responseRes.data.map(r => ({
          ...r,
          summary_data: typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : (r.summary_data || {})
        }));
        setResponses(parsedResponses);
        setRisk("");

      } catch (err) {
        
        setCurrentFormDetails(null); setResponses([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFormAndResponses();
  }, [selectedFormId]);

  const hasScoring = useMemo(() => {
    if (!currentFormDetails?.questions) return false;
    let scored = false;
    currentFormDetails.questions.forEach(q => {
      if (q.isScored || (q.scoringRules && q.scoringRules.length > 0)) scored = true;
      if (q.type === 'group' && Array.isArray(q.subQuestions)) {
        q.subQuestions.forEach(sq => {
          if (sq.isScored || (sq.scoringRules && sq.scoringRules.length > 0)) scored = true;
        });
      }
    });
    return scored;
  }, [currentFormDetails]);

  const filteredData = useMemo(() => {
    let baseData = responses;
    if (tableViewMode === 'master') {
      const uniqueCases = new Map();
      responses.forEach(res => {
        const key = res.master_case_id || res.identity_value || `res_${res.id}`;
        if (!uniqueCases.has(key)) {
          uniqueCases.set(key, res);
        } else {
          const existingRes = uniqueCases.get(key);
          const existingDate = new Date(existingRes.submitted_at || existingRes.createdAt || 0);
          const newDate = new Date(res.submitted_at || res.createdAt || 0);
          if (newDate > existingDate) {
            uniqueCases.set(key, res);
          }
        }
      });
      baseData = Array.from(uniqueCases.values());
    }

    const mappedData = baseData.map(res => {
      const summary = res.summary_data || {};
      const realRisk = getRiskLevel(summary);
      return {
        ...res,
        risk_level: realRisk,
        overall_risk: res.overall_risk || summary.overall_risk || realRisk
      };
    });

    return mappedData.filter(res => {
      const summary = res.summary_data || {};
      const caseIdStr = `CASE-${String(res.id).padStart(4, '0')}`;
      const name = summary.display_name || "-";
      const resFaculty = summary.display_faculty || "-";

      let currentRisk = res.risk_level;
      if (tableViewMode === 'master') currentRisk = res.overall_risk;

      const matchSearch = search === "" || caseIdStr.toLowerCase().includes(search.toLowerCase()) || name.toLowerCase().includes(search.toLowerCase()) || (res.identity_value && res.identity_value.includes(search));
      const matchFaculty = faculty === "" || resFaculty.includes(faculty);
      const matchRisk = risk === "" || !hasScoring || currentRisk === risk;
      
      let matchDate = true;
      if (res.submitted_at) {
        const submitDate = new Date(res.submitted_at);
        submitDate.setHours(0, 0, 0, 0);

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (submitDate < start) matchDate = false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (submitDate > end) matchDate = false;
        }
      } else if (startDate || endDate) {
        matchDate = false;
      }
      return matchSearch && matchFaculty && matchRisk && matchDate;
    });
  }, [responses, search, faculty, risk, tableViewMode, hasScoring,startDate, endDate]);

  const toggleColumn = (qId) => {
    setVisibleColumns(prev => {
      const newVisible = prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId];
      if (selectedFormId) localStorage.setItem(`visibleColumns_${selectedFormId}`, JSON.stringify(newVisible));
      return newVisible;
    });
  };

  const allDynamicQuestions = (currentFormDetails?.questions || []).filter(q => q.type !== 'section' && q.type !== 'description');
  const selectedFormObj = forms.find(f => f.id === selectedFormId);
  const cInfo = selectedFormObj ? CLINIC_INFO[selectedFormObj.clinic_type || 'general'] : null;

  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${parseInt(year) + 543}`;
  };

  return (
    <div className="scd-admin-wrapper">
      <Sidebar activeKey="case" />
      <main className="scd-main-content">
        <div className="scd-risk-container">

          <div className="scd-header-flex">
            <div className="scd-title-group">
              <div className="scd-title-meta">
                <FiList size={16} />
                <span>ระบบจัดการข้อมูลและติดตามเคสผู้รับบริการ</span>
                {cInfo && (
                  <span className="scd-title-badge" style={{ backgroundColor: cInfo.bg, color: cInfo.color, border: `1px solid ${cInfo.border}` }}>
                    {cInfo.text}
                  </span>
                )}
              </div>
              <h2 className="scd-main-title" title={currentFormDetails?.title || (filteredFormsList.length === 0 ? "ไม่มีข้อมูลแบบฟอร์ม" : "กำลังโหลด...")}>
                {currentFormDetails?.title || (filteredFormsList.length === 0 ? "ไม่มีข้อมูลแบบฟอร์ม" : "กำลังโหลด...")}
              </h2>
            </div>

            <div className="scd-header-actions">
              <div className="scd-view-mode-group">
                <button
                  onClick={() => setTableViewMode('master')}
                  className={`scd-view-mode-btn ${tableViewMode === 'master' ? 'active-master' : ''}`}
                >
                  <FiUsers size={16} /> ภาพรวมเคสผู้ป่วย
                </button>
                <button
                  onClick={() => setTableViewMode('form')}
                  className={`scd-view-mode-btn ${tableViewMode === 'form' ? 'active-form' : ''}`}
                >
                  <FiList size={16} /> คำตอบแบบฟอร์ม
                </button>
              </div>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="scd-export-excel-btn"
                title="ส่งออกข้อมูลเป็น Excel"
              >
                <FiDownload size={16} /> Export Excel
              </button>
            </div>
          </div>


          {/* ✅ FILTER BAR (จัดเรียงลำดับตาม User Flow) */}
          <div className="scd-filter-bar">
            
            {/* 1. ค้นหา */}
            <div className="scd-search-group scd-filter-search">
              <FiSearch className="scd-filter-icon" />
              <input
                type="text"
                placeholder="ค้นหา Case ID, เลขบัตร หรือชื่อ"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* 2. เลือกฟอร์ม */}
            <CustomDropdown
              icon={FiLayers}
              value={selectedFormId}
              onChange={setSelectedFormId}
              options={
                filteredFormsList.length > 0
                  ? filteredFormsList.map(f => ({ value: f.id, label: f.title }))
                  : [{ value: '', label: '-- ไม่มีแบบฟอร์ม --' }]
              }
              styleClass="scd-select-form scd-filter-form"
              textClass="scd-text-form"
            />

            {/* 3. ช่วงวันที่ */}
            <div className="scd-date-range-container scd-filter-date">
              <div className={`scd-date-container`}>
                <FiCalendar className="scd-date-main-icon" />
                <div className="scd-date-field">
                  <input type="text" className="scd-date-text-display" placeholder="วัน/เดือน/ปี" value={displayThaiDate(startDate)} readOnly />
                  <input type="date" className="scd-date-native-hidden" value={startDate} onChange={(e) => setStartDate(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                </div>
                <span className="scd-date-separator">ถึง</span>
                <div className="scd-date-field">
                  <input type="text" className="scd-date-text-display" placeholder="วัน/เดือน/ปี" value={displayThaiDate(endDate)} readOnly />
                  <input type="date" className="scd-date-native-hidden" value={endDate} onChange={(e) => setEndDate(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} />
                </div>
              </div>
            </div>

            {/* 4. คลินิก */}
<CustomDropdown
  icon={FiFolder}
  value={clinicFilter}
  onChange={setClinicFilter}
  options={[
    { value: 'all', label: 'ทุกคลินิก' },
    ...Object.values(CLINIC_INFO).map(c => ({
      value: c.id,
      label: c.text
    }))
  ]}
  styleClass="scd-filter-clinic"
/>

            {/* 5. สำนักวิชา */}
            <CustomDropdown
              icon={FiLayers}
              value={faculty}
              onChange={setFaculty}
              options={[
                { value: '', label: 'ทุกสำนักวิชา' },
                ...FACULTIES.map(f => ({ value: f, label: f }))
              ]}
              styleClass="scd-filter-faculty"
            />

            {/* 6. ระดับความเสี่ยง (โชว์เฉพาะฟอร์มที่มีคะแนน) */}
            {hasScoring && (
              <CustomDropdown
                icon={FiActivity}
                value={risk}
                onChange={setRisk}
                options={[
                  { value: '', label: 'ทุกระดับความเสี่ยง' },
                  { value: 'ต่ำ', label: 'เสี่ยงต่ำ (สีเขียว)' },
                  { value: 'ปานกลาง', label: 'เสี่ยงปานกลาง (สีเหลือง)' },
                  { value: 'สูง', label: 'เสี่ยงสูง (สีแดง)' }
                ]}
                styleClass="scd-filter-risk"
              />
            )}

            {/* 7. สถานะฟอร์ม */}
            <CustomDropdown
              icon={FiLayers}
              value={formStatusFilter}
              onChange={setFormStatusFilter}
              options={[
                { value: 'published', label: '✓ ฟอร์มที่เผยแพร่แล้ว' },
                { value: 'draft', label: '✎ ฟอร์มฉบับร่าง/ซ่อนอยู่' },
                { value: 'all', label: '☰ สถานะฟอร์มทั้งหมด' }
              ]}
              styleClass="scd-select-status scd-filter-status"
              iconClass="scd-icon-status"
              textClass="scd-text-status"
            />

            {/* 8. เลือกคอลัมน์ (โชว์เฉพาะตอนดูแบบฟอร์ม) */}
            {tableViewMode === 'form' && (
              <div className="scd-col-selector-wrapper scd-filter-columns" ref={colMenuRef}>
                <button className="scd-custom-select scd-col-select-btn" onClick={() => setShowColMenu(!showColMenu)}>
                  <FiSettings className="scd-filter-icon" />
                  <span className="scd-select-value">เลือกคอลัมน์ ({visibleColumns.length})</span>
                  <FiChevronDown className="scd-dropdown-icon" />
                </button>
                {showColMenu && (
                  <div className="scd-col-dropdown-menu">
                    <div className="scd-col-menu-header">เลือกคำถามที่ต้องการแสดง</div>
                    <div className="scd-col-menu-list">
                      {allDynamicQuestions.map(q => {
                        const cleanTitle = q.title.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
                        return (
                          <label key={q.id} className="scd-col-menu-item" title={cleanTitle}>
                            <input type="checkbox" checked={visibleColumns.includes(q.id)} onChange={() => toggleColumn(q.id)} />
                            <span className="scd-col-text">{cleanTitle}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          <CaseTable
            data={filteredData}
            questions={currentFormDetails?.questions || []}
            visibleColumns={visibleColumns}
            isLoading={isLoading}
            onSelectCase={setSelectedCase}
            viewMode={tableViewMode}
            hasScoring={hasScoring}
          />

          {selectedCase && (
            <CaseDetailModal
              data={selectedCase}
              onClose={() => setSelectedCase(null)}
              onCaseUpdated={(updatedCase) => {
                setResponses(prev => prev.map(r => {
                  if (r.id === updatedCase.id || (r.master_case_id && updatedCase.master_case_id && r.master_case_id === updatedCase.master_case_id)) {
                    return { ...r, ...updatedCase };
                  }
                  return r;
                }));
              }}
              onCaseDeleted={(deletedId) => {
                setResponses(prev => prev.filter(r => r.id !== deletedId));
                setSelectedCase(null);
              }}
            />
          )}

          {isExportModalOpen && (
            <ExportExcelModal
              isOpen={isExportModalOpen}
              onClose={() => setIsExportModalOpen(false)}
              questions={currentFormDetails?.questions || []}
              data={filteredData}
              formTitle={currentFormDetails?.title}
            />
          )}

        </div>
      </main>
    </div>
  );
}