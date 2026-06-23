import { useState, useEffect, useMemo, useRef } from "react";
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import ExportExcelModal from "../../components/case/ExportExcelModal.jsx";
import { getForms, getFormById, getFormResponses, createCase, getActiveClinics } from "../../services/api";
import "./CaseData.css";
import { useLocation } from "react-router-dom";
import { FiFolder, FiUsers, FiList, FiSettings, FiSearch, FiChevronDown, FiLayers, FiActivity, FiCalendar, FiDownload, FiPlus, FiX } from 'react-icons/fi';
import Swal from "sweetalert2";

const FACULTIES = [
  "(1) สำนักวิชาวิทยาศาสตร์", "(2) สำนักวิชาเทคโนโลยีสังคม", "(3) สำนักวิชาเทคโนโลยีการเกษตร",
  "(4) สำนักวิชาวิศวกรรมศาสตร์", "(5) สำนักวิชาแพทยศาสตร์", "(6) สำนักวิชาพยาบาลศาสตร์",
  "(7) สำนักวิชาทันตแพทยศาสตร์", "(8) สำนักวิชาสาธารณสุขศาสตร์", "(9) สำนักวิชาศาสตร์และศิลป์ดิจิทัล", "อื่นๆ"
];

const CLINIC_COLORS = ['#e0f2fe', '#dcfce7', '#fce7f3', '#fef3c7', '#e0e7ff', '#f3e8ff'];
const CLINIC_TEXT_COLORS = ['#0284c7', '#166534', '#be185d', '#d97706', '#4338ca', '#7e22ce'];
const CLINIC_BORDER_COLORS = ['#7dd3fc', '#86efac', '#f9a8d4', '#fcd34d', '#a5b4fc', '#d8b4fe'];

function getClinicConfig(slug, clinicsList = []) {
  if (slug === 'general') return { id: 'general', text: 'ทั่วไป', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
  const clinic = clinicsList.find(c => c.slug === slug);
  if (!clinic) return { id: slug, text: slug || '-', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' };
  
  const index = clinicsList.findIndex(c => c.slug === slug);
  const colorIndex = index % CLINIC_COLORS.length;
  return {
    id: slug,
    text: clinic.name,
    bg: CLINIC_COLORS[colorIndex],
    color: CLINIC_TEXT_COLORS[colorIndex],
    border: CLINIC_BORDER_COLORS[colorIndex]
  };
}

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

const CLINIC_RISK_OPTIONS = {
  general: [
    "ต่ำ",
    "ปานกลาง",
    "สูง"
  ],

  teenager: [
    "ปกติ / ไม่มีอาการซึมเศร้า",
    "มีอาการซึมเศร้าระดับน้อย",
    "มีอาการซึมเศร้าระดับปานกลาง",
    "มีอาการซึมเศร้าระดับรุนแรง"
  ],

  behavior: [
    "น้ำหนักน้อย / ผอม",
    "ปกติ (สุขภาพดี)",
    "ท้วม / โรคอ้วนระดับ 1",
    "อ้วน / โรคอ้วนระดับ 2",
    "อ้วนมาก / โรคอ้วนระดับ 3"
  ],

  sti: [
    "ต่ำ",
    "ปานกลาง",
    "สูง"
  ]
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

function CreateCaseModal({ onClose, onSave, clinics = [] }) {

  const [formData, setFormData] = useState({
    prefix: "",
    citizenId: "",
    name: "",
    phone: "",
    faculty: "",
    clinicType: "general",
    riskLevel: "ต่ำ",
    visitType: "walkin",
    status: "รอติดต่อ (รอดำเนินการ)",

    note: ""
  });

  const handleChange = (field, value) => {

    // ถ้าเปลี่ยนคลินิก → reset risk ตามคลินิกใหม่
    if (field === "clinicType") {

      const firstRisk =
        CLINIC_RISK_OPTIONS[value]?.[0] || "ต่ำ";

      setFormData(prev => ({
        ...prev,
        clinicType: value,
        riskLevel: firstRisk
      }));

      return;
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {

    const now = new Date().toISOString();

    const clinicText =
      getClinicConfig(formData.clinicType, clinics)?.text || "-";

    const allAnswers = {
      "เลขบัตรประชาชน": formData.citizenId || "-",
      "คำนำหน้า": formData.prefix || "-",
      "ชื่อ - นามสกุล": formData.name || "-",
      "เบอร์โทร": formData.phone || "-",
      "สำนักวิชา": formData.faculty || "-",
      "คลินิก": clinicText,
      "ระดับความเสี่ยง": formData.riskLevel || "-",
      "สถานะเคส": formData.status || "-",
      "หมายเหตุ": formData.note || "-"
    };

    const newCase = {


      master_case_id: null,

      submitted_at: now,
      created_at: now,
      updated_at: now,

      identity_value: formData.citizenId || `walkin_${Date.now()}`,

      clinic_type: formData.clinicType,
      clinicType: formData.clinicType,
      case_source: "walkin",
      overall_risk: formData.riskLevel,
      risk_level: formData.riskLevel,

      status: formData.status,

      visit_type: "walkin",
      is_manual_case: true,

      citizenId: formData.citizenId,
      prefix: formData.prefix,
      name: formData.name,
      phone: formData.phone,
      faculty: formData.faculty,
      note: formData.note,

      answers: allAnswers,

      raw_answers: allAnswers,

      summary_data: {
        prefix: formData.prefix || "-",
        display_name: formData.name || "-",
        display_faculty: formData.faculty || "-",
        overall_risk: formData.riskLevel || "-",
        raw_answers: allAnswers,

        score_results: [
          {
            label: formData.riskLevel,
            bg:
              caseRiskColors[formData.riskLevel]?.bg || "#e5e7eb",
            color:
              caseRiskColors[formData.riskLevel]?.color || "#374151"
          }
        ]
      }
    };

    onSave(newCase);
  };

  return (
    <div className="scd-modal-overlay">
      <div className="scd-create-case-modal">

        <div className="scd-create-case-header">
          <div>
            <h2>เพิ่มเคส Walk-in</h2>
            <p>กรณีผู้รับบริการไม่ได้ตอบแบบสอบถาม</p>
          </div>

          <button
            className="scd-close-btn"
            onClick={onClose}
          />
            
        
        </div>

        <div className="scd-create-case-body">

          {/* SECTION 1 */}
          <div className="scd-form-section">

            <div className="scd-section-title">
              ข้อมูลผู้รับบริการ
            </div>

            <div className="scd-form-grid">

              <div className="scd-form-group">
                <label>เลขบัตรประชาชน</label>

                <input
                  type="text"
                  placeholder="กรอกเลขบัตรประชาชน"
                  value={formData.citizenId}
                  onChange={(e) => handleChange("citizenId", e.target.value)}
                />
              </div>

              <div className="scd-form-group">
                <label>คำนำหน้า</label>

                <select
                  value={formData.prefix}
                  onChange={(e) => handleChange("prefix", e.target.value)}
                >
                  <option value="">เลือกคำนำหน้า</option>
                  <option value="นาย">นาย</option>
                  <option value="นาง">นาง</option>
                  <option value="นางสาว">นางสาว</option>
                  <option value="อื่นๆ">อื่นๆ</option>
                </select>
              </div>

              <div className="scd-form-group">
                <label>ชื่อ - นามสกุล</label>

                <input
                  type="text"
                  placeholder="กรอกชื่อผู้รับบริการ"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>

              <div className="scd-form-group">
                <label>เบอร์โทร</label>

                <input
                  type="text"
                  placeholder="กรอกเบอร์โทรศัพท์"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>

              <div className="scd-form-group">
                <label>สำนักวิชา</label>

                <select
                  value={formData.faculty}
                  onChange={(e) => handleChange("faculty", e.target.value)}
                >
                  <option value="">เลือกสำนักวิชา</option>

                  {FACULTIES.map(f => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="scd-form-group">
                <label>คลินิก</label>

                <select
                  value={formData.clinicType}
                  onChange={(e) => handleChange("clinicType", e.target.value)}
                >
                  {clinics.map(c => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="scd-form-group">
                <label>ระดับความเสี่ยง</label>

                <select
                  value={formData.riskLevel}
                  onChange={(e) => handleChange("riskLevel", e.target.value)}
                >
                  {(CLINIC_RISK_OPTIONS[formData.clinicType] || []).map(risk => (
                    <option key={risk} value={risk}>
                      {risk}
                    </option>
                  ))}
                </select>
              </div>

              <div className="scd-form-group">
                <label>สถานะเคส</label>

                <select
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                >
                  <option value="รอติดต่อ (รอดำเนินการ)">รอติดต่อ (รอดำเนินการ)</option>
                  <option value="นัดหมายสำเร็จ">นัดหมายสำเร็จ</option>
                  <option value="ติดต่อไม่ได้ / ไม่รับสาย">ติดต่อไม่ได้ / ไม่รับสาย</option>
                  <option value="ขอเลื่อนนัด">ขอเลื่อนนัด</option>
                  <option value="อยู่ระหว่างติดตามต่อเนื่อง">อยู่ระหว่างติดตามต่อเนื่อง</option>
                  <option value="ปฏิเสธบริการ">ปฏิเสธบริการ</option>
                  <option value="ส่งต่อผู้เชี่ยวชาญ">ส่งต่อผู้เชี่ยวชาญ</option>
                  <option value="ปิดเคสเรียบร้อย">ปิดเคสเรียบร้อย</option>
                </select>
              </div>

            </div>
          </div>

          {/* SECTION 2 */}
          <div className="scd-form-section">

            <div className="scd-section-title">
              รายละเอียดเพิ่มเติม
            </div>

            <div className="scd-form-group scd-full-width">

              <label>หมายเหตุ</label>

              <textarea
                rows="5"
                placeholder="บันทึกรายละเอียดเพิ่มเติม..."
                value={formData.note}
                onChange={(e) => handleChange("note", e.target.value)}
              />

            </div>

          </div>

        </div>

        <div className="scd-create-case-footer">

          <button
            className="scd-cancel-btn"
            onClick={onClose}
          >
            ยกเลิก
          </button>

          <button
            className="scd-save-btn"
            onClick={handleSubmit}
          >
            บันทึกเคส
          </button>

        </div>

      </div>
    </div>
  );
}

export default function CaseData() {
  const location = useLocation();
  const initialFormId = location.state?.defaultFormId || "";

  const [search, setSearch] = useState("");
  const [faculty, setFaculty] = useState("");
  const [risk, setRisk] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCreateCaseModalOpen, setIsCreateCaseModalOpen] = useState(false);


  const [forms, setForms] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState(initialFormId);
  const [currentFormDetails, setCurrentFormDetails] = useState(null);
  const [responses, setResponses] = useState([]);
  const [isInitialSetup, setIsInitialSetup] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

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
    const fetchInitialData = async () => {
      try {
        const [clinicRes, formsRes] = await Promise.all([
          getActiveClinics().catch(() => ({ data: { data: [] } })),
          getForms("latest").catch(() => ({ data: [] }))
        ]);
        
        setClinics(clinicRes.data.data || []);
        const fetchedForms = formsRes.data || [];
        setForms(fetchedForms);

        if (initialFormId) {
          const targetForm = fetchedForms.find(f => f.id === initialFormId);
          if (targetForm) {
            setClinicFilter(targetForm.clinic_type || 'general');
            if (targetForm.status !== 'published') setFormStatusFilter('draft');
          }
        } else if (fetchedForms.length > 0) {
          const publishedForms = fetchedForms.filter(f => f.status === 'published');
          if (publishedForms.length > 0) {
            setSelectedFormId(publishedForms[0].id);
          } else {
            setSelectedFormId(fetchedForms[0].id);
            setFormStatusFilter('all');
          }
        }
      } finally {
        setIsInitialSetup(false);
      }
    };
    fetchInitialData();
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
      if (isInitialSetup) return;
      if (!selectedFormId) {
        setIsLoading(false);
        setCurrentFormDetails(null);
        setResponses([]);
        return;
      }
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
          case_source: r.case_source || "assessment_form",
          summary_data:
            typeof r.summary_data === 'string'
              ? JSON.parse(r.summary_data)
              : (r.summary_data || {})
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
  }, [responses, search, faculty, risk, tableViewMode, hasScoring, startDate, endDate]);

  const toggleColumn = (qId) => {
    setVisibleColumns(prev => {
      const newVisible = prev.includes(qId) ? prev.filter(id => id !== qId) : [...prev, qId];
      if (selectedFormId) localStorage.setItem(`visibleColumns_${selectedFormId}`, JSON.stringify(newVisible));
      return newVisible;
    });
  };

  const allDynamicQuestions = (currentFormDetails?.questions || []).filter(q => q.type !== 'section' && q.type !== 'description');
  const selectedFormObj = forms.find(f => f.id === selectedFormId);
  const cInfo = selectedFormObj ? getClinicConfig(selectedFormObj.clinic_type || 'general', clinics) : null;

  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${parseInt(year) + 543}`;
  };

  return (
    <div className="scd-admin-wrapper">
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
              <h2 className="scd-main-title" title={currentFormDetails?.title || (isInitialSetup ? "กำลังโหลด..." : filteredFormsList.length === 0 ? "ไม่มีข้อมูลแบบฟอร์ม" : "กำลังโหลด...")}>
                {currentFormDetails?.title || (isInitialSetup ? "กำลังโหลด..." : filteredFormsList.length === 0 ? "ไม่มีข้อมูลแบบฟอร์ม" : "กำลังโหลด...")}
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
                isInitialSetup 
                  ? [{ value: '', label: 'กำลังโหลดแบบฟอร์ม...' }]
                  : filteredFormsList.length > 0
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
                { value: 'general', label: 'ทั่วไป' },
                ...clinics.map(c => ({
                  value: c.slug,
                  label: c.name
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
            <div className="scd-form-status-group">
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

              <button
                className="scd-add-walkin-btn"
                onClick={() => setIsCreateCaseModalOpen(true)}
              >
                <FiPlus />
                เพิ่มเคส
              </button>

            </div>

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
            isLoading={isLoading || isInitialSetup}
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

          {isCreateCaseModalOpen && (
            <CreateCaseModal
              onClose={() => setIsCreateCaseModalOpen(false)}
              onSave={async (newCase) => {
                try {
          
                  const customRawAnswers = {
                    "ชื่อ - นามสกุล": newCase.name || "",
                    "เบอร์โทร": newCase.phone || "",
                    "เลขบัตรประชาชน": newCase.citizenId || "",
                    "คำนำหน้า": newCase.prefix || "",
                    "สำนักวิชา": newCase.faculty || ""
                  };
                  const caseWithFormId = {
                    ...newCase,
                    form_id: selectedFormId || 1,
                    summary_data: {
                      display_name: newCase.name || "",
                      display_phone: newCase.phone || "",
                      display_faculty: newCase.faculty || "",
                      note: newCase.note || "",
                      raw_answers: customRawAnswers 
                    }
                  };
                  await createCase(caseWithFormId);
                  if (selectedFormId) {
                    const responseRes = await getFormResponses(selectedFormId);
                    const responseData = responseRes.data ? responseRes.data : responseRes;

                    if (Array.isArray(responseData)) {
                      const parsedResponses = responseData.map(r => ({
                        ...r,
                        case_source: r.case_source || "assessment_form",
                        summary_data: typeof r.summary_data === 'string' ? JSON.parse(r.summary_data) : (r.summary_data || {})
                      }));
                      setResponses(parsedResponses);
                    }
                  }

                  setIsCreateCaseModalOpen(false);

                  Swal.fire({
                    icon: "success",
                    title: "สำเร็จ",
                    text: "บันทึกเคสเรียบร้อยแล้ว",
                    confirmButtonColor: "#ADFF2F"
                  });
                } catch (err) {
                  console.error(err);
                  Swal.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาด",
                    text: "ไม่สามารถบันทึกเคสได้",
                    confirmButtonColor: "#F47932"
                  });
                }
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