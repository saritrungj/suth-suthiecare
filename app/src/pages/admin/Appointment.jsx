import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Sidebar from "../../components/Sidebar";

import AppointmentTable from "../../components/appointment/AppointmentTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import thLocale from "@fullcalendar/core/locales/th";

import { getFormResponses, getServices, getForms, getCaseAppointments, updateAppointmentStatus } from "../../services/api"; 

import { FiCalendar, FiList, FiLayers, FiActivity, FiChevronDown, FiSearch } from "react-icons/fi";
import "./Appointment.css";

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
      className="apt-custom-select" 
      ref={ref} 
      style={{ ...style, zIndex: isOpen ? 999 : 1 }} 
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className="apt-filter-icon" style={iconStyle} />
      <span className="apt-select-value" style={textStyle}>{displayLabel}</span>
      <FiChevronDown className={`apt-dropdown-icon ${isOpen ? 'open' : ''}`} style={iconStyle} />
      
      {isOpen && (
        <div className="apt-select-menu">
          {options.map((opt) => (
            <div 
              key={opt.value} 
              className={`apt-select-option ${String(value) === String(opt.value) ? 'selected' : ''}`}
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

function getRiskLevel(summary_data) {
  const scoreResults = summary_data?.score_results || [];
  if (scoreResults.length === 0) return "ต่ำ";

  const isHigh = scoreResults.some(s => {
    const c = s.color?.toLowerCase() || '';
    return c.includes('d93025') || c.includes('e53935') || c.includes('f44336') || 
           c.includes('ef4444') || c.includes('dc2626') || c.includes('ff0000') || c.includes('red');
  });

  const isMedium = scoreResults.some(s => {
    const c = s.color?.toLowerCase() || '';
    return c.includes('fbbc04') || c.includes('ff9800') || c.includes('f59e0b') || 
           c.includes('orange') || c.includes('yellow');
  });

  if (isHigh) return "สูง";
  if (isMedium) return "ปานกลาง";
  return "ต่ำ";
}

export default function Appointment() {

  /* ================= STATE ================= */
  const [calendarMode, setCalendarMode] = useState(false);
  
  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  // 🟢 State สำหรับจัดการ Popup ลอยของปฏิทิน
  const [quickActionPopup, setQuickActionPopup] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    data: null
  });
  
  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [selectedClinic, setSelectedClinic] = useState(""); 
  const [formStatusFilter, setFormStatusFilter] = useState('published'); 

  /* ================= DATA FETCHING ================= */
  const fetchAppointments = useCallback(async (formId) => {
    if (!formId) return;

    setIsLoading(true);
    try {
      const res = await getFormResponses(formId);
      
      const appointmentPromises = res.data.map(caseData => 
        getCaseAppointments(caseData.id)
          .then(apptRes => {
            const summary = typeof caseData.summary_data === "string" 
              ? JSON.parse(caseData.summary_data) 
              : (caseData.summary_data || {});
            
            const realRisk = getRiskLevel(summary);
            const overallRisk = caseData.overall_risk || summary.overall_risk || realRisk;

            return apptRes.data.map(appt => ({
              ...appt,
              appointment_id: appt.id,           
              appt_status: appt.status,          
              case_id: caseData.id,
              master_case_id: caseData.master_case_id,
              form_id: caseData.form_id || formId,      
              form_title: caseData.form_title,          
              identity_value: caseData.identity_value,
              risk_level: realRisk,
              overall_risk: overallRisk,
              status: caseData.status,           
              submitted_at: caseData.submitted_at,
              summary_data: summary
            }));
          })
          .catch(() => []) 
      );
      
      const appointmentsData = await Promise.all(appointmentPromises);
      const allAppointments = appointmentsData.flat();

      setAppointments(allAppointments);

    } catch (error) {
    
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredForms = useMemo(() => {
    let list = forms;
    if (selectedClinic && selectedClinic !== "") {
      list = list.filter(f => (f.clinic_type || 'general') === selectedClinic);
    }
    if (formStatusFilter === 'published') list = list.filter(f => f.status === 'published');
    else if (formStatusFilter === 'draft') list = list.filter(f => f.status !== 'published');
    return list;
  }, [forms, selectedClinic, formStatusFilter]);

  useEffect(() => {
    if (forms.length === 0) return;
    if (filteredForms.length > 0) {
      const isValid = filteredForms.some(f => String(f.id) === String(selectedFormId));
      if (!isValid) setSelectedFormId(filteredForms[0].id);
    } else {
      setSelectedFormId("");
      setAppointments([]);
    }
  }, [forms.length, filteredForms, selectedFormId]); 

  useEffect(() => {
    fetchAppointments(selectedFormId);
  }, [selectedFormId, fetchAppointments]);

  const fetchServices = async () => {
    try {
      const res = await getServices();
      setServicesList(res.data);
    } catch (err) {}
  };

  const fetchForms = async () => {
    try {
      const res = await getForms("latest");
      setForms(res.data);
    } catch (err) {
      
    }
  };

  useEffect(() => {
    fetchServices();
    fetchForms();
  }, []);

  /* ================= FILTER LOGIC ================= */
  const filteredAppointments = useMemo(() => {
    const mappedAppointments = appointments.map(a => {
      const serviceObj = servicesList.find(s => String(s.id) === String(a.service_id));
      return {
        ...a,
        service_name: a.service_name || (serviceObj ? serviceObj.name : '-')
      };
    });

    return mappedAppointments.filter(a => {
      // 🟢 1. ซ่อนเคสที่ปิดแล้ว (ไม่แสดงทั้งในตารางและปฏิทิน)
      const safeStatus = a.status || '';
      const isClosedCase = safeStatus.includes('ปิดเคส') || safeStatus.includes('สำเร็จ') || safeStatus === 'Closed';
      if (isClosedCase) return false;

      const summary = a.summary_data || {};
      const caseIdStr = a.master_case_id 
        ? `MC-${String(a.master_case_id).padStart(4, '0')}` 
        : `RES-${String(a.case_id).padStart(4, '0')}`;
        
      const name = summary.display_name && summary.display_name !== "-" ? summary.display_name : caseIdStr;
      const riskLevel = a.overall_risk || a.risk_level || "ต่ำ";
      const searchTerm = search.toLowerCase();
      const safeIdentityValue = a.identity_value ? String(a.identity_value).toLowerCase() : "";
      const safeName = name ? String(name).toLowerCase() : "";
      
      const matchSearch = search === "" || 
        safeName.includes(searchTerm) || 
        caseIdStr.toLowerCase().includes(searchTerm) ||
        safeIdentityValue.includes(searchTerm);

      const matchService = filterService === "" || String(a.service_id) === filterService;
      const matchRisk = filterRisk === "" || riskLevel === filterRisk;

      let matchDate = true;
      if (a.appointment_date) {
        const apptDate = new Date(a.appointment_date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (apptDate < start) matchDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (apptDate > end) matchDate = false;
        }
      }

      return matchSearch && matchService && matchRisk && matchDate;
    });
  }, [appointments, search, filterService, filterRisk, startDate, endDate, servicesList]);

  /* ================= HANDLERS ================= */

  // 🟢 2. เมื่อคลิกปฏิทิน ให้โชว์ Quick Action Popup แทนการเปิดหน้าต่างใหญ่เลย
  const handleEventClick = (clickInfo) => {
    const props = clickInfo.event.extendedProps;
    
    // คำนวณพิกัดเมาส์เพื่อวางตำแหน่ง Popup ให้ใกล้ๆ จุดที่คลิก
    const x = clickInfo.jsEvent.clientX;
    const y = clickInfo.jsEvent.clientY;

    setQuickActionPopup({
      isOpen: true,
      x: x,
      y: y,
      data: {
        id: props.case_id, 
        master_case_id: props.master_case_id, 
        form_id: props.form_id,             
        form_title: props.form_title,       
        identity_value: props.identity_value,
        summary_data: props.summary,
        status: props.status,
        risk_level: props.risk_level,
        overall_risk: props.overall_risk,
        submitted_at: props.submitted_at,
        appt_id: clickInfo.event.id,          
        appt_status: props.appt_status,       
        title: clickInfo.event.title          
      }
    });
  };

  const handleUpdateApptStatus = async (apptId, newStatus) => {
    try {
      await updateAppointmentStatus(apptId, newStatus);
      setAppointments(prev => prev.map(a => {
        if (a.appointment_id === apptId || a.id === apptId) {
          return { ...a, appt_status: newStatus };
        }
        return a;
      }));
    } catch (err) {
      
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะคิว');
    }
  };

  // ฟังก์ชันแปลงรูปแบบ YYYY-MM-DD ให้เป็น วว/ดด/ปปปป (พ.ศ.)
  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  /* ================= UI ================= */
  return (
    <div className="apt-admin-layout">
      <Sidebar activeKey="appointment" />

      <main className="apt-main-content">
        
        <div className="apt-container">
          
          <div className="apt-header-wrapper">
            <h2 className="apt-title">ตารางนัดหมาย</h2>
            
            <div className="apt-view-toggle">
              <button 
                className={`apt-view-btn ${!calendarMode ? 'active' : ''}`} 
                onClick={() => setCalendarMode(false)}
              >
                <FiList size={18} /> แบบรายการ
              </button>
              <button 
                className={`apt-view-btn ${calendarMode ? 'active' : ''}`} 
                onClick={() => setCalendarMode(true)}
              >
                <FiCalendar size={18} /> แบบปฏิทิน
              </button>
            </div>
          </div>

          {/* filter bar */}
          <div className="apt-filter-section">
            
            {/* 🟢 แถวที่ 1: สถานะ และ แบบฟอร์ม (ยืดสุดขอบ) */}
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

            <CustomDropdown 
              icon={FiLayers} 
              value={selectedFormId} 
              onChange={setSelectedFormId}
              options={filteredForms.length > 0 ? filteredForms.map(f => ({ value: f.id, label: f.title })) : [{ value: '', label: '-- ไม่มีแบบฟอร์ม --' }]}
              style={{ flex: '1 1 300px' }} /* บังคับยืดสุดขอบ */
            />

            {/* 🟢 แถวที่ 2: ค้นหา (ยืด), คลินิก, วันที่, บริการ, ความเสี่ยง */}
            <div className="apt-search-group">
              <FiSearch className="apt-filter-icon" style={{ color: '#64748b' }} />
              <input 
                type="text" 
                placeholder="ค้นหาชื่อ หรือ เลขบัตรประชาชน..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <CustomDropdown 
              icon={FiLayers} 
              value={selectedClinic} 
              onChange={setSelectedClinic}
              options={[
                { value: '', label: 'ทุกคลินิก (All)' },
                { value: 'general', label: 'ทั่วไป' },
                { value: 'teenager', label: 'คลินิกวัยรุ่น' },
                { value: 'behavior', label: 'คลินิกLSM' },
                { value: 'sti', label: 'คลินิกโรคติดต่อ' }
              ]}
            />

            <div className="apt-date-wrapper">
              <FiCalendar className="apt-filter-icon" style={{ color: '#64748b' }} />
              
              {/* 🟢 กล่องวันที่ 1 (เริ่มต้น) */}
              <div style={{ position: 'relative', flex: 1, display: 'flex', height: '100%' }}>
                <input
                  type="text"
                  className="apt-date-input"
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
                  title="ตั้งแต่วันที่"
                />
              </div>

              <span className="apt-date-separator">ถึง</span>

              {/* 🟢 กล่องวันที่ 2 (สิ้นสุด) */}
              <div style={{ position: 'relative', flex: 1, display: 'flex', height: '100%' }}>
                <input
                  type="text"
                  className="apt-date-input"
                  placeholder="วัน/เดือน/ปี"
                  value={displayThaiDate(endDate)}
                  readOnly
                  style={{ width: '100%', backgroundColor: 'transparent' }}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  onClick={(e) => e.target.showPicker && e.target.showPicker()}
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: 'pointer', zIndex: 10
                  }}
                  title="ถึงวันที่"
                />
              </div>
            </div>

            <CustomDropdown 
              icon={FiLayers} 
              value={filterService} 
              onChange={setFilterService}
              options={[{ value: '', label: 'ทุกบริการ' }, ...servicesList.map(s => ({ value: s.id, label: s.name }))]}
            />

            <CustomDropdown 
              icon={FiActivity} 
              value={filterRisk} 
              onChange={setFilterRisk}
              options={[
                { value: '', label: 'ทุกระดับความเสี่ยง' },
                { value: 'ต่ำ', label: 'เสี่ยงต่ำ (สีเขียว)' },
                { value: 'ปานกลาง', label: 'เสี่ยงปานกลาง (สีเหลือง)' },
                { value: 'สูง', label: 'เสี่ยงสูง (สีแดง)' }
              ]}
            />
          </div>

          {!calendarMode ? (
            <AppointmentTable 
              appointments={filteredAppointments} 
              isLoading={isLoading}
              onSelectCase={setSelectedCase} 
              onUpdateApptStatus={handleUpdateApptStatus}
            />
          ) : (
            <div className="apt-calendar-box">
              <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                initialDate={new Date()}
                height="auto"
                locale={thLocale} 
                events={filteredAppointments.map(a => {
                  let summary = {};
                  try {
                    summary = typeof a.summary_data === 'string' ? JSON.parse(a.summary_data) : (a.summary_data || {});
                  } catch (e) {
                    summary = {};
                  }
                  
                  const masterIdStr = a.master_case_id 
                    ? `MC-${String(a.master_case_id).padStart(4, '0')}` 
                    : `RES-${String(a.case_id).padStart(4, '0')}`;
                    
                  const name = summary.display_name && summary.display_name !== "-" ? summary.display_name : masterIdStr;
                  const riskLevel = a.overall_risk || a.risk_level || "ต่ำ";
                  
                  // 🟢 3. อัปเดตสีของอีเวนต์บนปฏิทินตามสถานะการนัดหมาย
                  const apptStatus = a.appt_status || 'Scheduled';
                  let bgColor = riskLevel === "ต่ำ" ? "#10b981" : riskLevel === "ปานกลาง" ? "#f59e0b" : "#ef4444";
                  let txtColor = "white";

                  if (apptStatus === 'Completed') {
                    bgColor = "#dcfce7"; // สีเขียวอ่อน
                    txtColor = "#166534";
                  } else if (apptStatus === 'Cancelled') {
                    bgColor = "#fee2e2"; // สีแดงอ่อน
                    txtColor = "#991b1b";
                  }

                  return {
                    id: a.appointment_id || a.id,
                    title: `${name} [${a.service_name || 'นัดหมาย'}]`,
                    start: a.appointment_date,
                    backgroundColor: bgColor,
                    borderColor: bgColor,
                    textColor: txtColor,
                    extendedProps: {
                      case_id: a.case_id,
                      master_case_id: a.master_case_id,
                      form_id: a.form_id,             
                      form_title: a.form_title,       
                      identity_value: a.identity_value,
                      summary: summary,
                      status: a.status,
                      risk_level: a.risk_level,
                      overall_risk: a.overall_risk,
                      submitted_at: a.submitted_at,
                      appt_status: apptStatus // 🟢 ส่งพ่วงไปให้ Popup ใช้งาน
                    }
                  };
                })}
                eventClick={handleEventClick}
                headerToolbar={{
                  left: "today",            
                  center: "prev title next", 
                  right: ""
                }}
              />
            </div>
          )}

        </div>
      </main>

      {/* 🟢 4. UI ของ Quick Action Popup สำหรับปฏิทิน */}
      {quickActionPopup.isOpen && quickActionPopup.data && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998 }}
            onClick={() => setQuickActionPopup({ ...quickActionPopup, isOpen: false })}
          />
          <div style={{
            position: 'fixed',
            left: Math.min(quickActionPopup.x, window.innerWidth - 300),
            top: Math.min(quickActionPopup.y + 20, window.innerHeight - 250),
            background: 'white',
            boxShadow: '0 15px 40px rgba(0,0,0,0.12)', 
            borderRadius: '24px',
            padding: '20px',
            width: '300px',
            zIndex: 9999,
            border: '1px solid #f1f5f9',
            animation: 'aptPopIn 0.3s ease-out forwards'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <h4 style={{ margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: '700', lineHeight: '1.4' }}>{quickActionPopup.data.title} </h4>
              <button 
                onClick={() => setQuickActionPopup({ ...quickActionPopup, isOpen: false })}
                style={{ background: '#f1f5f9', border: 'none', cursor: 'pointer', color: '#64748b', 
                  fontSize: '12px', width: '28px', height: '28px', borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0}}
                onMouseOver={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
              >✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(!quickActionPopup.data.appt_status || quickActionPopup.data.appt_status === 'Scheduled') ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    style={{ flex: 1, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', 
                      padding: '10px 0', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(5, 150, 105, 0.05)'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#d1fae5'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#ecfdf5'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    onClick={() => {
                      handleUpdateApptStatus(quickActionPopup.data.appt_id, 'Completed');
                      setQuickActionPopup({ ...quickActionPopup, isOpen: false });
                    }}
                  >มาตามนัด</button>
                  <button 
                    style={{ flex: 1, background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3', 
                      padding: '10px 0', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(225, 29, 72, 0.05)'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.background = '#ffe4e6'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    onClick={() => {
                      handleUpdateApptStatus(quickActionPopup.data.appt_id, 'Cancelled');
                      setQuickActionPopup({ ...quickActionPopup, isOpen: false });
                    }}
                  >ยกเลิกนัด</button>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '10px', borderRadius: '16px', textAlign: 'center', color: '#64748b', fontSize: '13.5px', fontWeight: '600' }}>
                  สถานะ: {quickActionPopup.data.appt_status === 'Completed' ? 'เสร็จสิ้นแล้ว' : 'ยกเลิกแล้ว'}
                </div>
              )}
              
              {/* 🟢 เส้นคั่นแบบไข่ปลาดูซอฟต์ๆ */}
              <hr style={{ border: 'none', borderTop: '2px dotted #e2e8f0', margin: '4px 0' }} />
              
              <button 
                style={{ background: '#ffffff', color: '#0ea5e9', border: '1px solid #bae6fd', 
                  padding: '10px 12px', borderRadius: '20px', cursor: 'pointer', fontWeight: '700', fontSize: '13.5px',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 2px 4px rgba(14, 165, 233, 0.05)'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.transform = 'translateY(0)'; }}
                onClick={() => {
                  setSelectedCase(quickActionPopup.data);
                  setQuickActionPopup({ ...quickActionPopup, isOpen: false });
                }}
              >ดูรายละเอียดเคสเต็ม</button>
            </div>
          </div>
        </>
      )}

      {selectedCase && (
        <CaseDetailModal
          data={selectedCase}
          onClose={() => setSelectedCase(null)}
          onCaseUpdated={() => { fetchAppointments(selectedFormId); }} 
          onCaseDeleted={() => {
            fetchAppointments(selectedFormId);
            setSelectedCase(null);
          }}
        />
      )}

    </div>
  );
}