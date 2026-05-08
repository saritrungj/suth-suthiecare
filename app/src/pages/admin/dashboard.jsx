import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import { getForms, getChartData, getFormById, getDashboardSettings, saveDashboardSettings, getMasterCaseStats, getRecentCases } from "../../services/api";
import SystemEvaluationWidget from "../../components/dashboard/SystemEvaluationWidget";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import Sidebar from '../../components/Sidebar';
import './dashboard.css';
import AddChartModal from "../../components/AddChartModal";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useNavigate } from 'react-router-dom';
import {
  FiArrowRight, FiUsers, FiActivity,
  FiAlertCircle, FiArchive, FiDroplet, FiBriefcase, FiPlusSquare, FiShield,
  FiLayers, FiChevronDown, FiBarChart2
} from "react-icons/fi";

const COLORS = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF8FAB",
  "#C77DFF", "#00C2A8", "#FFA94D", "#A0E7E5", "#B4F8C8",
  "#FBE7C6", "#FFAEBC", "#A0C4FF", "#BDB2FF", "#FFC6FF",
  "#9BF6FF", "#CAFFBF", "#FDFFB6", "#FFD6A5", "#E4C1F9"
];

function StatBoxModern({ icon: Icon, label, value, urgent, color, bgColor }) {
  return (
    <div
      className={`stat-box-modern ${urgent ? "urgent" : ""}`}
      style={{ borderBottom: `4px solid ${urgent ? '#ef4444' : color}` }}
    >
      {Icon && <Icon size={80} color={color} style={{ position: 'absolute', bottom: '-15px', right: '-15px', opacity: 0.05, transform: 'rotate(-10deg)' }} />}
      <div className="stat-modern-header">
        <div className="stat-modern-icon" style={{ backgroundColor: bgColor || `${color}15` }}>
          {Icon && <Icon size={20} color={urgent ? '#ef4444' : color} />}
        </div>
        <span className="stat-modern-label" style={{ color: urgent ? '#b91c1c' : '#475569', fontWeight: 700 }}>{label}</span>
      </div>
      <span className="stat-modern-value" style={{ color: urgent ? '#ef4444' : '#1e293b' }}>{value}</span>
    </div>
  );
}

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
      className="db-custom-select"
      ref={ref}
      style={{ ...style, zIndex: isOpen ? 999 : 1 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className="db-filter-icon" style={iconStyle} />
      <span className="db-select-value" style={textStyle}>{displayLabel}</span>
      <FiChevronDown className={`db-dropdown-icon ${isOpen ? 'open' : ''}`} style={iconStyle} />

      {isOpen && (
        <div className="db-select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`db-select-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
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

export default function Dashboard() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);

  const [masterCaseStats, setMasterCaseStats] = useState({
    totalActive: 0, newToday: 0, highRisk: 0, closed: 0,
    waitingContact: 0, forwardSafeClinic: 0,
    totalStudent: 0, totalGeneral: 0,
    bloodTestNegative: 0, bloodTestPositive: 0,
    prepWithBlood: 0, prepWithoutBlood: 0
  });

  const [chartToDelete, setChartToDelete] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [chartsByForm, setChartsByForm] = useState({});
  const [forms, setForms] = useState([]);

  const [formStatusFilter, setFormStatusFilter] = useState("published");
  const [selectedClinic, setSelectedClinic] = useState("teenager");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [currentFormDetails, setCurrentFormDetails] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const charts = useMemo(() => chartsByForm[selectedFormId] || [], [chartsByForm, selectedFormId]);

  const filteredForms = useMemo(() => {
    let list = forms;
    if (selectedClinic !== "all") {
      list = list.filter(f => f.clinic_type === selectedClinic);
    }
    if (formStatusFilter === 'published') {
      list = list.filter(f => f.status === 'published');
    } else if (formStatusFilter === 'draft') {
      list = list.filter(f => f.status !== 'published');
    }
    return list;
  }, [forms, selectedClinic, formStatusFilter]);

  useEffect(() => {
    const fetchMasterCaseStats = async () => {
      try {
        const res = await getMasterCaseStats(selectedClinic, selectedFormId);
        if (res.data && typeof res.data === 'object' && !res.data.error) {
          setMasterCaseStats(prev => ({ ...prev, ...res.data }));
        }
      } catch (err) {

      }
    };
    fetchMasterCaseStats();
  }, [selectedClinic, selectedCase, selectedFormId]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [formRes, settingsRes] = await Promise.all([
          getForms("latest"),
          getDashboardSettings()
        ]);
        setForms(formRes.data);
        const savedSettings = settingsRes.data;

        if (savedSettings?.last_selected_form_id) {
          const lastId = savedSettings.last_selected_form_id;
          const lastForm = formRes.data.find(f => String(f.id) === String(lastId));

          if (lastForm) {
            setSelectedClinic(lastForm.clinic_type);
            if (lastForm.status === 'published') {
              setSelectedFormId(lastId);
              const parsedCharts = typeof savedSettings.active_charts === 'string'
                ? JSON.parse(savedSettings.active_charts)
                : (savedSettings.active_charts || {});
              setChartsByForm(parsedCharts);
            }
          }
        }
      } catch (err) { }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (filteredForms.length > 0) {
      const isStillInList = filteredForms.some(f => String(f.id) === String(selectedFormId));
      if (!isStillInList) {
        setSelectedFormId(filteredForms[0].id);
      }
    } else {
      setSelectedFormId("");
    }
  }, [selectedClinic, formStatusFilter, filteredForms, selectedFormId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 15 } })
  );

  const prevFetchRef = useRef({ startDate: null, endDate: null, formId: null });
  useEffect(() => {
    if (!selectedFormId || charts.length === 0) return;

    // 🟢 ตรวจสอบว่าต้องโหลดข้อมูลใหม่หรือไม่ (ถ้า Form ID หรือ วันที่เปลี่ยน)
    const needsFetch =
      prevFetchRef.current.startDate !== startDate ||
      prevFetchRef.current.endDate !== endDate ||
      prevFetchRef.current.formId !== selectedFormId;

    if (!needsFetch) return;

    prevFetchRef.current = { startDate, endDate, formId: selectedFormId };

    const refetchCharts = async () => {
      try {
        const freshCharts = await Promise.all(
          charts.map(async (chart) => {
            const res = await getChartData(selectedFormId, chart.question, startDate, endDate);
            return { ...chart, data: Array.isArray(res.data) ? res.data : res.data.data };
          })
        );
        setChartsByForm(prev => ({ ...prev, [selectedFormId]: freshCharts }));
      } catch (err) { }
    };
    refetchCharts();
  }, [startDate, endDate, selectedFormId, charts]);

  useEffect(() => {
    if (!selectedFormId) {
      setCurrentFormDetails(null);
      setVisibleColumns([]);
      return;
    }
    const fetchFormDetails = async () => {
      try {
        const formRes = await getFormById(selectedFormId);
        let formDetails = formRes.data;
        if (typeof formDetails.questions === 'string') {
          formDetails.questions = JSON.parse(formDetails.questions);
        }
        setCurrentFormDetails(formDetails);
        const realQuestions = formDetails.questions.filter(q => q.type !== 'section' && q.type !== 'description');
        setVisibleColumns(realQuestions.slice(0, 5).map(q => q.id));
      } catch (err) {
        setCurrentFormDetails(null);
        setVisibleColumns([]);
      }
    };
    fetchFormDetails();
  }, [selectedFormId]);

  useEffect(() => {
    const fetchRecentCasesForClinic = async () => {
      setIsLoading(true);
      try {
        const res = await getRecentCases(selectedClinic);
        setCases(res.data);
      } catch (err) {

        setCases([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecentCasesForClinic();
  }, [selectedClinic, selectedCase]);

  const handleFormChange = useCallback(async (newFormId) => {
    setSelectedFormId(newFormId);
    await saveDashboardSettings({ formId: newFormId, charts: chartsByForm });
  }, [chartsByForm]);

  const filteredData = useMemo(() => {
    if (!startDate && !endDate) return cases;
    return cases.filter(item => {
      const dateString = item.submitted_at || item.appointment;
      if (!dateString) return false;
      const itemDate = new Date(dateString);
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (itemDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (itemDate > end) return false;
      }
      return true;
    });
  }, [cases, startDate, endDate]);

  const removeChart = useCallback((id) => setChartToDelete(id), []);

  const confirmDelete = useCallback(async () => {
    const updatedCharts = charts.filter(c => c.id !== chartToDelete);
    const updatedChartsByForm = { ...chartsByForm, [selectedFormId]: updatedCharts };
    setChartsByForm(updatedChartsByForm);
    setChartToDelete(null);
    await saveDashboardSettings({ formId: selectedFormId, charts: updatedChartsByForm });
  }, [charts, chartToDelete, chartsByForm, selectedFormId]);

  const handleSaveChart = useCallback(async (newChartData) => {
    try {
      const res = await getChartData(selectedFormId, newChartData.question, startDate, endDate);
      const newChart = {
        id: newChartData.id, title: newChartData.title, type: newChartData.type, question: newChartData.question,
        data: Array.isArray(res.data) ? res.data : res.data.data
      };
      const updatedCharts = [...(chartsByForm[selectedFormId] || []), newChart];
      const updatedChartsByForm = { ...chartsByForm, [selectedFormId]: updatedCharts };
      setChartsByForm(updatedChartsByForm);
      setIsModalOpen(false);
      await saveDashboardSettings({ formId: selectedFormId, charts: updatedChartsByForm });
    } catch (err) { }
  }, [chartsByForm, selectedFormId, startDate, endDate]);

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = charts.findIndex(i => i.id === active.id);
    const newIndex = charts.findIndex(i => i.id === over.id);
    const updatedCharts = arrayMove(charts, oldIndex, newIndex);
    const updatedChartsByForm = { ...chartsByForm, [selectedFormId]: updatedCharts };
    setChartsByForm(updatedChartsByForm);
    await saveDashboardSettings({ formId: selectedFormId, charts: updatedChartsByForm });
  }, [charts, chartsByForm, selectedFormId]);

  const clinicNameMap = {
    'all': 'ทั้งหมด',
    'general': 'ทั่วไป',
    'teenager': 'วัยรุ่น',
    'behavior': 'ปรับเปลี่ยนพฤติกรรม',
    'sti': 'โรคติดต่อทางเพศสัมพันธ์'
  };

  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="admin-page">
      <Sidebar />
      <main className="admin-content">
        <header className="content-header">
          <h1>แดชบอร์ด</h1>
          <div className="dashboard-filters">

            <div className="select-wrapper status-select-wrap">
              <span className="select-label">สถานะแบบฟอร์ม</span>
              <CustomDropdown
                icon={FiLayers}
                value={formStatusFilter}
                onChange={setFormStatusFilter}
                options={[
                  { value: 'published', label: '✓ ฟอร์มที่เผยแพร่แล้ว' },
                  { value: 'draft', label: '✎ ฟอร์มฉบับร่าง/ซ่อน' },
                  { value: 'all', label: '☰ สถานะฟอร์มทั้งหมด' }
                ]}
                style={{ borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }}
                iconStyle={{ color: '#2563eb' }}
                textStyle={{ color: '#1e40af', fontWeight: '600' }}
              />
            </div>

            <div className="select-wrapper clinic-select-wrap">
              <span className="select-label">ประเภทคลินิก</span>
              <CustomDropdown
                icon={FiLayers}
                value={selectedClinic}
                onChange={setSelectedClinic}
                options={[
                  { value: 'all', label: 'ทุกคลินิก (All)' },
                  { value: 'general', label: 'ทั่วไป' },
                  { value: 'teenager', label: 'คลินิกวัยรุ่น' },
                  { value: 'behavior', label: 'คลินิกLSM' },
                  { value: 'sti', label: 'คลินิกโรคติดต่อ' }
                ]}
              />
            </div>

            <div className="select-wrapper form-select-wrap">
              <span className="select-label">แบบฟอร์มสำหรับดูกราฟ</span>
              <CustomDropdown
                icon={FiLayers}
                value={selectedFormId}
                onChange={(val) => { if (val) handleFormChange(val); }}
                options={
                  forms.length > 0 ? (
                    filteredForms.length > 0
                      ? filteredForms.map((form) => ({ value: form.id, label: form.title }))
                      : [{ value: '', label: '-- ไม่มีแบบฟอร์มในหมวดนี้ --' }]
                  ) : [{ value: '', label: 'กำลังโหลดแบบฟอร์ม...' }]
                } />
            </div>

            <div className="select-wrapper filter-date-group">
              <span className="select-label">ช่วงเวลาที่ต้องการดู</span>
              <div className="db-date-range-premium">
                <div className="date-input-box" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="วัน/เดือน/ปี"
                    value={displayThaiDate(startDate)}
                    readOnly
                    style={{ width: '100%', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      opacity: 0, cursor: 'pointer', zIndex: 10
                    }}
                  />
                </div>

                <span className="date-separator-premium">ถึง</span>

                <div className="date-input-box" style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="วัน/เดือน/ปี"
                    value={displayThaiDate(endDate)}
                    readOnly
                    style={{ width: '100%', backgroundColor: 'transparent' }}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    onClick={(e) => e.target.showPicker && e.target.showPicker()}
                    style={{
                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                      opacity: 0, cursor: 'pointer', zIndex: 10
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="main-dashboard-container">

          {selectedClinic === 'sti' ? (
            <div className="sti-dashboard-wrapper">
              <div className="sti-hero-box">
                <div>
                  <div className="sti-hero-title">
                    <FiUsers size={24} color="#93c5fd" />
                    ผู้ลงทะเบียนทั้งหมด
                  </div>
                  <div className="sti-hero-value">{(masterCaseStats?.totalActive || 0) + (masterCaseStats?.closed || 0)}</div>
                </div>
                <div className="sti-hero-stats">
                  <div className="sti-hero-stat-item">
                    <div className="label">นักศึกษา</div>
                    <div className="value">{masterCaseStats?.totalStudent || 0}</div>
                  </div>
                  <div className="sti-hero-stat-item">
                    <div className="label">บุคคลทั่วไป</div>
                    <div className="value">{masterCaseStats?.totalGeneral || 0}</div>
                  </div>
                </div>
              </div>

              <div className="sti-stat-row">
                <StatBoxModern icon={FiActivity} label="เคสใหม่วันนี้" value={(masterCaseStats?.newToday || 0).toString().padStart(2, '0')} color="#3b82f6" />
                <StatBoxModern icon={FiBriefcase} label="เคสที่รอติดต่อกลับ" value={(masterCaseStats?.waitingContact || 0).toString().padStart(2, '0')} color="#f59e0b" />
                <StatBoxModern icon={FiAlertCircle} label="เคสเสี่ยงสูง (ฉุกเฉิน)" value={(masterCaseStats?.highRisk || 0).toString().padStart(2, '0')} color="#ef4444" urgent />
              </div>

              <div className="sti-stat-row">
                <div className="sti-blood-box">
                  <div>
                    <div className="sti-blood-title">
                      <FiDroplet size={20} color="#be185d" />
                      สถิติเจาะเลือดรวม
                    </div>
                    <div className="sti-blood-value">{(masterCaseStats?.bloodTestNegative || 0) + (masterCaseStats?.bloodTestPositive || 0)}</div>
                  </div>
                  <div className="sti-blood-stats">
                    <div className="sti-blood-stat-item">
                      <div style={{ fontSize: '13px', color: '#10b981', fontWeight: '700' }}>Negative (-)</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#047857' }}>{masterCaseStats?.bloodTestNegative || 0}</div>
                    </div>
                    <div className="sti-blood-stat-item" style={{ border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '13px', color: '#ef4444', fontWeight: '700' }}>Positive (+)</div>
                      <div style={{ fontSize: '22px', fontWeight: '800', color: '#b91c1c' }}>{masterCaseStats?.bloodTestPositive || 0}</div>
                    </div>
                  </div>
                </div>
                <StatBoxModern icon={FiPlusSquare} label="รับยา PrEP (เจาะเลือดที่นี่)" value={(masterCaseStats?.prepWithBlood || 0).toString().padStart(2, '0')} color="#8b5cf6" />
                <StatBoxModern icon={FiShield} label="รับยา PrEP (มีผลเลือดมา)" value={(masterCaseStats?.prepWithoutBlood || 0).toString().padStart(2, '0')} color="#10b981" />
              </div>

              <div className="sti-stat-row">
                <StatBoxModern icon={FiArrowRight} label="ส่งต่อ Safe Clinic" value={(masterCaseStats?.forwardSafeClinic || 0).toString().padStart(2, '0')} color="#ec4899" />
                <StatBoxModern icon={FiArchive} label="เคสที่ปิดแล้ว (Closed)" value={(masterCaseStats?.closed || 0).toString().padStart(2, '0')} color="#64748b" />
              </div>
            </div>
          ) : selectedClinic === 'behavior' ? (
            <div className="stats-grid">
              <StatBoxModern icon={FiUsers} label="ผู้ลงทะเบียนทั้งหมด" value={((masterCaseStats?.totalActive || 0) + (masterCaseStats?.closed || 0)).toString().padStart(2, '0')} color="#14b8a6" />
              <StatBoxModern icon={FiActivity} label="เคสใหม่วันนี้" value={(masterCaseStats?.newToday || 0).toString().padStart(2, '0')} color="#3b82f6" />
              <StatBoxModern icon={FiBriefcase} label="เคสที่รอติดต่อกลับ" value={(masterCaseStats?.waitingContact || 0).toString().padStart(2, '0')} color="#f59e0b" />
              <StatBoxModern icon={FiArchive} label="เคสที่ปิดแล้ว (Closed)" value={(masterCaseStats?.closed || 0).toString().padStart(2, '0')} color="#64748b" />
            </div>
          ) : (
            <div className="stats-grid">
              <StatBoxModern icon={FiUsers} label="เคสที่กำลังดูแล (Active)" value={(masterCaseStats?.totalActive || 0).toString().padStart(2, '0')} color="#14b8a6" />
              <StatBoxModern icon={FiActivity} label="เคสใหม่วันนี้" value={(masterCaseStats?.newToday || 0).toString().padStart(2, '0')} color="#3b82f6" />
              <StatBoxModern icon={FiAlertCircle} label="เคสที่มีความเสี่ยงสูง" value={(masterCaseStats?.highRisk || 0).toString().padStart(2, '0')} color="#ef4444" urgent />
              <StatBoxModern icon={FiArchive} label="ปิดเคสแล้ว (Closed)" value={(masterCaseStats?.closed || 0).toString().padStart(2, '0')} color="#64748b" />
            </div>
          )}

          <hr className="divider" />

          <div className="block overflow-hidden mb-10">
            <button className="btn-add" onClick={() => setIsModalOpen(true)}>
              <span>+</span> สร้างกราฟสรุปแบบประเมิน
            </button>
          </div>

          {filteredData.length === 0 ? (
            <div className="db-empty-state-card">
              <div className="db-empty-icon-wrap">
                <FiBarChart2 size={48} strokeWidth={1.5} />
              </div>

              <h3 style={{ fontSize: "20px", fontWeight: "600", color: "#64748B" }}>ไม่มีข้อมูลสถิติในช่วงวันที่เลือก</h3>
              <p style={{ color: "#94A3B8", marginTop: "8px" }}>กรุณาลองปรับเปลี่ยนช่วงเวลา หรือเลือกแบบฟอร์มใหม่อีกครั้ง</p>
            </div>
          ) : (
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToParentElement]} sensors={sensors}>
              <SortableContext items={charts.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="charts-grid">
                  {charts.map(chart => (
                    <SortableChart
                      key={chart.id}
                      id={chart.id}
                      title={chart.title}
                      type={chart.type}
                      question={chart.question}
                      data={chart.data}
                      colors={COLORS}
                      formQuestions={currentFormDetails?.questions || []}
                      onRemove={removeChart}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <hr className="divider" />

          <section className="dash-case-table-wrapper">
            <div className="dash-case-table-header">
              <h2 className="text-2xl font-semibold" style={{ fontSize: 'clamp(18px, 5vw, 24px)' }}>
                ตารางเคสล่าสุด (คลินิก{clinicNameMap[selectedClinic] || ''})
              </h2>
              <button
                className="db-view-all-btn"
                onClick={() => navigate('/admin/cases', { state: { defaultFormId: selectedFormId } })}
              >
                ดูทั้งหมด <FiArrowRight />
              </button>
            </div>
            <div className="dash-case-table-scroll-area">
              
              <CaseTable
                data={filteredData.slice(0, 10)}
                questions={currentFormDetails?.questions || []}
                visibleColumns={visibleColumns}
                isLoading={isLoading}
                onSelectCase={setSelectedCase}
              />
            </div>
            {selectedCase && <CaseDetailModal data={selectedCase} onClose={() => setSelectedCase(null)} />}
          </section>

          <hr className="divider" />

          {/* 🟢 เรียกใช้ Component ประเมินระบบตรงนี้ */}
          <section className="dash-evaluation-wrapper">
            <SystemEvaluationWidget />
          </section>

        </div>

        {chartToDelete && (
          <div className="modal-overlay">
            <div className="modal-box">
              <h3>ยืนยันการลบกราฟ</h3>
              <p>คุณต้องการลบกราฟนี้ใช่หรือไม่?</p>
              <div className="modal-actions">
                <button className="btn-cancel" onClick={() => setChartToDelete(null)}>ยกเลิก</button>
                <button className="btn-confirm" onClick={confirmDelete}>ลบ</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AddChartModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveChart}
        formId={selectedFormId}
        getChartData={getChartData}
      />
    </div>
  );
}

// ✅ label ยื่นออกนอกวง + เส้นชี้ 
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.03) return null;

  const RADIAN = Math.PI / 180;

  // จุดปลายเส้น (อยู่นอกวง)
  const outerEdgeRadius = outerRadius + 8;
  const labelRadius = outerRadius + 20;

  const sx = cx + outerRadius * Math.cos(-midAngle * RADIAN);
  const sy = cy + outerRadius * Math.sin(-midAngle * RADIAN);
  const ex = cx + outerEdgeRadius * Math.cos(-midAngle * RADIAN);
  const ey = cy + outerEdgeRadius * Math.sin(-midAngle * RADIAN);
  const lx = cx + labelRadius * Math.cos(-midAngle * RADIAN);
  const ly = cy + labelRadius * Math.sin(-midAngle * RADIAN);

  const textAnchor = lx > cx ? 'start' : 'end';

  return (
    <g>
      {/* เส้นชี้จาก slice ออกนอก */}
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#94a3b8" strokeWidth={1} />
      {/* จุดกลม */}
      <circle cx={ex} cy={ey} r={2} fill="#94a3b8" />
      {/* ตัวเลข % */}
      <text
        x={lx}
        y={ly}
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ fontSize: '12px', fontWeight: '700', fill: '#374151' }}
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    </g>
  );
};

const SortableChart = React.memo(function SortableChart({ id, title, type, question, data, colors, formQuestions, onRemove }) {
  const [isSelected, setIsSelected] = useState(false);
  const cardRef = useRef(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 50 : "auto"
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cardRef.current && !cardRef.current.contains(event.target)) {
        setIsSelected(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const processedPieData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // 🟢 ดึงเกณฑ์คะแนนของคำถามนี้มาเตรียมไว้
    const questionDetails = formQuestions?.find(q => String(q.id) === String(question));
    const scoringRules = questionDetails?.scoringRules || [];

    const counts = {};
    data.forEach(item => {
      let resultText = "";

      // 🟢 1. ตรวจสอบหาผลสรุปคะแนนจากฟิลด์ "result" ที่ Backend ส่งมาตรงๆ
      if (item.result) {
        resultText = item.result;
      }
      // 🟢 2. หากไม่มีใน result ให้ลองหาใน summary_data เผื่อไว้
      else if (item.summary_data) {
        try {
          const summary = typeof item.summary_data === 'string' ? JSON.parse(item.summary_data) : item.summary_data;

          if (summary.score_results && Array.isArray(summary.score_results)) {
            const sr = summary.score_results.find(s =>
              String(s.question_id) === String(question) ||
              String(s.id) === String(question) ||
              String(s.questionId) === String(question)
            );
            if (sr && sr.label) resultText = sr.label;
          }

          if (!resultText) {
            resultText = summary[`${question}_label`] || summary[`${question}_result`] || "";
          }

          if (!resultText) {
            if (question === "food_1774859637605") resultText = summary.food_result_text;
            else if (question === "exercise_1774859637605") resultText = summary.exercise_result_text;
            else if (question === "emotion_1774859637605") resultText = summary.emotion_result_text;
          }
        } catch (e) { }
      }

      // 🟢 3. กรณีไม่มีคะแนนสรุป ให้ดึงจากคำตอบดิบ
      if (!resultText) {
        let rawName = item.name;

        if (typeof rawName === 'string' && rawName.trim().startsWith('{')) {
          try { rawName = JSON.parse(rawName); } catch (e) { }
        }

        if (typeof rawName === "object" && rawName !== null) {
          Object.values(rawName).forEach(val => {
            if (val) {
              const cleanVal = String(val).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
              counts[cleanVal] = (counts[cleanVal] || 0) + 1;
            }
          });
          return;
        } else if (rawName) {
          resultText = String(rawName).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
        }
      }

      // 🟢 4. บันทึกผลลง counts
      if (resultText && resultText !== "-" && !resultText.includes("รอผลสรุปคะแนน")) {
        counts[resultText] = (counts[resultText] || 0) + (Number(item.value || 1));
      }
    });

    // 🟢 5. แปลงเป็น Array และใส่สีตามเกณฑ์
    return Object.keys(counts).map((k, index) => {
      // ค้นหาเกณฑ์ที่ตรงกับชื่อ
      const matchedRule = scoringRules.find(r => r.label === k);
      return {
        name: k,
        value: counts[k],
        color: matchedRule?.color || colors[index % colors.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [data, question, colors, formQuestions]);

  return (
    <div
      ref={(node) => { setNodeRef(node); cardRef.current = node; }}
      style={style}
      onClick={() => setIsSelected(true)}
      className={`chart-card ${isSelected ? "ring-4 ring-blue-400 shadow-md" : ""}`}
    >
      <div className="drag-indicator">
        <div {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="drag-handle">⋮⋮</div>
      </div>

      {isSelected && (
        <div className="delete-btn" onClick={(e) => { e.stopPropagation(); onRemove(id); }}>✕</div>
      )}

      <h4 className="chart-title" style={{ marginTop: "10px" }}>{title}</h4>

      <div className="chart-wrapper">
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>

          {/* ✅ PIE CHART — แก้บัคตัวเลข % ทับกันบนมือถือ */}
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              {type?.toLowerCase() === "pie" ? (
                <PieChart margin={{ top: 0, right: 35, bottom: 0, left: 35 }}>
                  <Pie
                    data={processedPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius="65%"
                    label={renderCustomizedLabel}
                    labelLine={false}
                  >
                    {processedPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value} ราย`, name]} />
                </PieChart>
              ) : (
                <BarChart data={processedPieData} margin={{ top: 25, right: 30, left: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis dataKey="name" hide />

                  <YAxis
                    tick={{ fontSize: 12, fill: '#1e293b', fontWeight: '500' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} />

                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                    {processedPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* 🟢 5. ส่วนคำอธิบายแบบป้าย (Badges) และจุดสีวงกลม */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "10px",
            marginTop: "15px",
            width: "100%",
            padding: "0 10px"
          }}>
            {processedPieData.map((item, index) => (
              <div key={index} style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                background: '#f8fafc',
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  background: item.color,
                  borderRadius: "50%"
                }} />
                <span style={{ color: "#475569" }}>
                  {item.name}: <strong>{item.value} คน</strong>
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
});