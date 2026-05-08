import { useState, useEffect, useMemo, useRef } from "react";
import "./RiskCases.css";
import Sidebar from "../../components/Sidebar";
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import { getForms, getFormById, getFormResponses } from "../../services/api";
import { FiFolder, FiSettings, FiSearch, FiChevronDown, FiLayers, FiCalendar } from "react-icons/fi";

const FACULTIES = [
  "(1) สำนักวิชาวิทยาศาสตร์", "(2) สำนักวิชาเทคโนโลยีสังคม", "(3) สำนักวิชาเทคโนโลยีการเกษตร",
  "(4) สำนักวิชาวิศวกรรมศาสตร์", "(5) สำนักวิชาแพทยศาสตร์", "(6) สำนักวิชาพยาบาลศาสตร์",
  "(7) สำนักวิชาทันตแพทยศาสตร์", "(8) สำนักวิชาสาธารณสุขศาสตร์", "(9) สำนักวิชาศาสตร์และศิลป์ดิจิทัล", "อื่นๆ"
];

const RC_CLINIC_INFO = {
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
    // 🔴 ดักจับสีแดงครอบคลุมขึ้น (รวมรหัสสีแดงยอดฮิตและคำว่า red)
    return c.includes('d93025') || c.includes('e53935') || c.includes('f44336') ||
      c.includes('ef4444') || c.includes('dc2626') || c.includes('ff0000') || c.includes('red');
  });

  const isMedium = scoreResults.some(s => {
    const c = s.color?.toLowerCase() || '';
    // 🟡 ดักจับสีส้ม/เหลืองครอบคลุมขึ้น
    return c.includes('fbbc04') || c.includes('ff9800') || c.includes('f59e0b') ||
      c.includes('orange') || c.includes('yellow');
  });

  if (isHigh) return "สูง";
  if (isMedium) return "ปานกลาง";
  return "ต่ำ";
}

// 🟢 คอมโพเนนต์ Custom Dropdown สำหรับ RiskCases
const CustomDropdown = ({ icon: Icon, value, options, onChange, style, iconStyle, textStyle }) => {
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
      className="rc-custom-select"
      ref={ref}
      style={{ ...style, zIndex: isOpen ? 999 : 1 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className="rc-filter-icon" style={iconStyle} />
      <span className="rc-select-value" style={textStyle}>{displayLabel}</span>
      <FiChevronDown className={`rc-dropdown-icon ${isOpen ? 'open' : ''}`} style={iconStyle} />

      {isOpen && (
        <div className="rc-select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`rc-select-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
              onClick={() => onChange(opt.value)} > {opt.label} </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function RiskCases() {
  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [currentFormDetails, setCurrentFormDetails] = useState(null);
  const [responses, setResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef(null);

  const [clinicFilter, setClinicFilter] = useState('all');
  const [formStatusFilter, setFormStatusFilter] = useState('published');

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target)) setShowColMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    getForms("latest").then(res => {
      setForms(res.data);
      const publishedForms = res.data.filter(f => f.status === 'published');
      if (publishedForms.length > 0) {
        setSelectedFormId(publishedForms[0].id);
        setFormStatusFilter('published');
      } else if (res.data.length > 0) {
        setSelectedFormId(res.data[0].id);
        setFormStatusFilter('all');
      }
    }).catch(() => {})
  }, []);

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
    const fetchAllData = async () => {
      if (!forms.length) return;

      let targetFormId = selectedFormId;
      if (!targetFormId && forms.length > 0) {
        targetFormId = forms[0].id;
        setSelectedFormId(targetFormId);
      }

      if (!targetFormId) return;

      setIsLoading(true);
      try {
        const formRes = await getFormById(targetFormId);
        let formDetails = formRes.data;
        if (typeof formDetails.questions === "string") {
          formDetails.questions = JSON.parse(formDetails.questions);
        }
        setCurrentFormDetails(formDetails);

        const allResponsesPromises = forms.map(f => getFormResponses(f.id));
        const allResResults = await Promise.all(allResponsesPromises);
        const allParsedResponses = allResResults.flatMap(responseRes =>
          responseRes.data.map(r => ({
            ...r,
            summary_data: typeof r.summary_data === "string"
              ? JSON.parse(r.summary_data) : (r.summary_data || {}),
          }))
        );
        setResponses(allParsedResponses);

        const realQuestions = formDetails.questions.filter(
          q => q.type !== "section" && q.type !== "description"
        );
        setVisibleColumns(realQuestions.slice(0, 5).map(q => q.id));

      } catch (err) {
        setResponses([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [selectedFormId, forms]);

  const filteredData = useMemo(() => {
    const mappedData = responses.map(res => {
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
      const caseIdStr = `CASE-${String(res.id).padStart(4, "0")}`;
      const name = summary.display_name || "-";
      const resFaculty = summary.display_faculty || "-";

      const matchFormId = res.form_id === parseInt(selectedFormId);
      if (!matchFormId) return false;

      if (res.risk_level !== "สูง" && res.overall_risk !== "สูง") return false;

      const matchSearch = search === "" ||
        caseIdStr.toLowerCase().includes(search.toLowerCase()) ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        (res.identity_value && res.identity_value.includes(search));
      const matchFaculty = faculty === "" || resFaculty.includes(faculty);

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
      return matchSearch && matchFaculty && matchDate;
    });
  }, [responses, search, faculty, selectedFormId, startDate, endDate]);

  const toggleColumn = (qId) =>
    setVisibleColumns(prev => prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId]);

  const selectedFormObj = forms.find(f => String(f.id) === String(selectedFormId));
  const cInfo = selectedFormObj ? RC_CLINIC_INFO[selectedFormObj.clinic_type || 'general'] : null;

  const allDynamicQuestions = (currentFormDetails?.questions || []).filter(
    q => q.type !== "section" && q.type !== "description"
  );



  // ฟังก์ชันแปลงวันที่เป็นรูปแบบไทย (วว/ดด/ปปปป) 
  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${parseInt(year) + 543}`;
  };

  return (
    <div className="admin-wrapper2">
      <Sidebar activeKey="risk-cases" />
      <main className="main-content">
        <div className="risk-container">

          {/* Header */}
          <div className="rc-header">
            <div className="rc-header__left">
              <div>
                <h2 className="rc-title">
                  <label className="rc-inside-title">เคสเสี่ยง:</label> {
                    // 🟢 เช็คก่อนว่ามีฟอร์มในหมวดหมู่ที่เลือกไหม ถ้าไม่มีให้ขึ้น "ไม่มีข้อมูลแบบฟอร์ม" เลย
                    filteredFormsList.length === 0
                      ? "ไม่มีข้อมูลแบบฟอร์ม"
                      : isLoading ? "กำลังโหลด..." : (currentFormDetails?.title || "ไม่พบชื่อแบบฟอร์ม")
                  }
                  
                  {/* 🟢 เช็คด้วยว่าต้องมีฟอร์มถึงจะโชว์ป้ายชื่อคลินิก ป้องกันการแสดงป้ายผิดหมวดหมู่ */}
                  {filteredFormsList.length > 0 && cInfo && (
                    <span className="rc-title-badge" style={{ backgroundColor: cInfo.bg, color: cInfo.color, border: `1px solid ${cInfo.border}` }}>
                      {cInfo.text}
                    </span>
                  )}
                </h2>
                <p className="rc-header__sub">แสดงเฉพาะเคสที่มีความเสี่ยงสูง</p>
              </div>
            </div>
            <div className="rc-count-badge">
              <span className="rc-count-badge__num">{filteredData.length}</span>
              <span className="rc-count-badge__label">เคสเสี่ยง</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            
            {/* 1. ค้นหา */}
            <div className="rc-search-group">
              <FiSearch className="rc-filter-icon" />
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
              style={{ borderColor: '#e53935' }}
            />

            {/* 3. ช่วงวันที่ */}
            <div className="rc-date-range-container">
              <div className={`rc-date-container`}>
                <FiCalendar className="src-date-main-icon" />

                {/* กล่องวันที่เริ่มต้น */}
                <div className="rc-date-field">
                  <input
                    type="text"
                    className="rc-date-text-display"
                    placeholder="วัน/เดือน/ปี"
                    value={displayThaiDate(startDate)}
                    readOnly
                  />
                  <input
                    type="date"
                    className="rc-date-native-hidden"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  />
                </div>

                <span className="rc-date-separator">ถึง</span>

                {/* กล่องวันที่สิ้นสุด */}
                <div className="rc-date-field">
                  <input
                    type="text"
                    className="rc-date-text-display"
                    placeholder="วัน/เดือน/ปี"
                    value={displayThaiDate(endDate)}
                    readOnly
                  />
                  <input
                    type="date"
                    className="rc-date-native-hidden"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  />
                </div>
              </div>
            </div>

            <CustomDropdown
  icon={FiFolder}
  value={clinicFilter}
  onChange={setClinicFilter}
  options={[
    { value: 'all', label: 'ทุกคลินิก' },
    ...Object.values(RC_CLINIC_INFO).map(c => ({
      value: c.id,
      label: c.text
    }))
  ]}
/>
 
            {/* 4. สำนักวิชา */}
            <CustomDropdown
              icon={FiLayers}
              value={faculty}
              onChange={setFaculty}
              options={[
                { value: '', label: 'ทุกสำนักวิชา' },
                ...FACULTIES.map(f => ({ value: f, label: f }))
              ]}
            />

            {/* 5. สถานะฟอร์ม */}
            <CustomDropdown
              icon={FiLayers}
              value={formStatusFilter}
              onChange={setFormStatusFilter}
              options={[
                { value: 'published', label: '✓ ฟอร์มที่เผยแพร่แล้ว' },
                { value: 'draft', label: '✎ ฟอร์มฉบับร่าง/ซ่อนอยู่' },
                { value: 'all', label: '☰ สถานะฟอร์มทั้งหมด' }
              ]}
              style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
              iconStyle={{ color: '#2563eb' }}
              textStyle={{ color: '#1e40af', fontWeight: '600' }}
            />

            {/* 6. เลือกคอลัมน์ */}
            <div className="col-selector-wrapper" ref={colMenuRef}>
              <button
                className="rc-custom-select"
                onClick={() => setShowColMenu(!showColMenu)}
                style={{ width: '100%', border: '1px solid #cbd5e1', background: '#ffffff' }}
              >
                <FiSettings className="rc-filter-icon" />
                <span className="rc-select-value" style={{ textAlign: 'left' }}>เลือกคอลัมน์ ({visibleColumns.length})</span>
                <FiChevronDown className="rc-dropdown-icon" />
              </button>
              {showColMenu && (
                <div className="col-dropdown-menu">
                  <div className="col-menu-header">เลือกคำถามที่ต้องการแสดง</div>
                  <div className="col-menu-list">
                    {allDynamicQuestions.map(q => {
                      const cleanTitle = q.title.replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
                      return (
                        <label key={q.id} className="col-menu-item" title={cleanTitle}>
                          <input type="checkbox"
                            checked={visibleColumns.includes(q.id)}
                            onChange={() => toggleColumn(q.id)} />
                          <span className="col-text">{cleanTitle}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ CaseTable */}
          <CaseTable
            data={filteredData}
            questions={currentFormDetails?.questions || []}
            visibleColumns={visibleColumns}
            isLoading={isLoading}
            onSelectCase={setSelectedCase}
            viewMode="form" /* หน้า Risk ยึดมุมมอง Form เสมอตามโครงสร้างของคุณ */
          />

          {selectedCase && (
            <CaseDetailModal
              data={selectedCase}
              onClose={() => setSelectedCase(null)}
              onCaseUpdated={(updatedCase) => {
                setResponses(prev =>
                  prev.map(r =>
                    r.id === updatedCase.id ? { ...r, ...updatedCase } : r
                  )
                );
              }}
              onCaseDeleted={(deletedId) => {
                setResponses(prev => prev.filter(r => r.id !== deletedId));
                setSelectedCase(null);
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}