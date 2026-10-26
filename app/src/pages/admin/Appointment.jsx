import { toDisplayText } from "../../utils/textPresentation.js";
import { useModuleActions } from "../../permissions/useModuleActions";
import { usePageExport } from "../../components/ExcelExport";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import AppointmentTable from "../../components/appointment/AppointmentTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import FilterDropdown, { FilterField } from "../../components/FilterDropdown";
import DataPanel from "../../components/table/DataPanel";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import thLocale from "@fullcalendar/core/locales/th";

import {
  getServices,
  getForms,
  getAppointments,
  updateAppointmentStatus,
  getActiveClinics,
} from "../../services/api";

import {
  FiCalendar,
  FiList,
  FiLayers,
  FiActivity,
  FiChevronDown,
  FiSearch,
} from "react-icons/fi";
import {
  bangkokDateKey,
  formatBangkokDate,
  getCurrentMonthDateRange,
} from "../../utils/caseDateFilter";
import { usePermissions } from "../../permissions/PermissionsProvider";
import { showErrorAlert, showSuccessToast } from "../../utils/alerts";
import "./Appointment.css";
import { PageHero } from "../../components/dashboard/DashboardKit";
import ThaiDatePicker from "../../components/ThaiDatePicker";

const CustomDropdown = ({
  icon: Icon,
  value,
  options,
  onChange,
  style,
  iconStyle,
  textStyle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );
  const displayLabel = selectedOption
    ? selectedOption.label
    : options[0]?.label || "โปรดเลือก...";

  return (
    <div
      className={"apt-custom-select" + (isOpen ? " is-open" : "")}
      ref={ref}
      style={{ ...style, zIndex: isOpen ? "var(--z-dropdown)" : 1 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className="apt-filter-icon" style={iconStyle} />
      <span className="apt-select-value" style={textStyle}>
        {displayLabel}
      </span>
      <FiChevronDown
        className={`apt-dropdown-icon ${isOpen ? "open" : ""}`}
        style={iconStyle}
      />

      {isOpen && (
        <div className="apt-select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`apt-select-option ${String(value) === String(opt.value) ? "selected" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              {toDisplayText(opt.label)}
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

  const isHigh = scoreResults.some((s) => {
    const c = s.color?.toLowerCase() || "";
    return (
      c.includes("d93025") ||
      c.includes("e53935") ||
      c.includes("f44336") ||
      c.includes("ef4444") ||
      c.includes("dc2626") ||
      c.includes("ff0000") ||
      c.includes("red")
    );
  });

  const isMedium = scoreResults.some((s) => {
    const c = s.color?.toLowerCase() || "";
    return (
      c.includes("fbbc04") ||
      c.includes("ff9800") ||
      c.includes("f59e0b") ||
      c.includes("orange") ||
      c.includes("yellow")
    );
  });

  if (isHigh) return "สูง";
  if (isMedium) return "ปานกลาง";
  return "ต่ำ";
}

export default function Appointment() {
  const { activeOrganization } = usePermissions();
  // Marking attendance is "update"; cancelling an appointment is "delete".
  const apptRights = useModuleActions("appointments");
  /* ================= STATE ================= */
  const [calendarMode, setCalendarMode] = useState(false);

  const [search, setSearch] = useState("");
  const [filterService, setFilterService] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  // Appointment status tabs above the table; "" shows every status.
  const [filterApptStatus, setFilterApptStatus] = useState("");

  const [initialDateRange] = useState(getCurrentMonthDateRange);
  const [startDate, setStartDate] = useState(initialDateRange.startDate);
  const [endDate, setEndDate] = useState(initialDateRange.endDate);

  const [isInitialSetup, setIsInitialSetup] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);

  // 🟢 State สำหรับจัดการ Popup ลอยของปฏิทิน
  const [quickActionPopup, setQuickActionPopup] = useState({
    isOpen: false,
    x: 0,
    y: 0,
    data: null,
  });

  const [forms, setForms] = useState([]);
  const [selectedFormId, setSelectedFormId] = useState("all");
  const [selectedClinic, setSelectedClinic] = useState("");
  const [formStatusFilter, setFormStatusFilter] = useState("published");

  /* ================= DATA FETCHING ================= */
  const fetchAppointments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getAppointments({ startDate, endDate, limit: "all" });
      setAppointments(
        res.data.map((appointment) => {
          const summary =
            typeof appointment.summary_data === "string"
              ? JSON.parse(appointment.summary_data)
              : appointment.summary_data || {};
          const realRisk = getRiskLevel(summary);

          return {
            ...appointment,
            appointment_id: appointment.appointment_id || appointment.id,
            appt_status: appointment.appt_status || appointment.status,
            status: appointment.case_status || appointment.status,
            risk_level: realRisk,
            overall_risk:
              appointment.overall_risk || summary.overall_risk || realRisk,
            summary_data: summary,
          };
        }),
      );
    } catch (error) {
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  const filteredForms = useMemo(() => {
    let list = forms;
    if (selectedClinic && selectedClinic !== "") {
      list = list.filter(
        (f) => (f.clinic_type || "general") === selectedClinic,
      );
    }
    if (formStatusFilter === "published")
      list = list.filter((f) => f.status === "published");
    else if (formStatusFilter === "draft")
      list = list.filter((f) => f.status !== "published");
    return list;
  }, [forms, selectedClinic, formStatusFilter]);

  useEffect(() => {
    if (forms.length === 0) return;
    if (filteredForms.length > 0) {
      if (selectedFormId === "all") return;
      const isValid = filteredForms.some(
        (f) => String(f.id) === String(selectedFormId),
      );
      if (!isValid) setSelectedFormId(filteredForms[0].id);
    } else {
      setSelectedFormId("all");
    }
  }, [forms.length, filteredForms, selectedFormId]);

  useEffect(() => {
    if (isInitialSetup) return;
    fetchAppointments();
  }, [fetchAppointments, isInitialSetup, activeOrganization]);

  const fetchServices = async () => {
    const res = await getServices();
    setServicesList(res.data);
  };

  const fetchForms = async () => {
    const res = await getForms("latest");
    setForms(res.data);
  };

  const fetchClinics = async () => {
    const res = await getActiveClinics();
    setClinics(res.data.data || []);
  };

  useEffect(() => {
    const loadInitial = async () => {
      setIsInitialSetup(true);
      setAppointments([]);
      await Promise.all([
        fetchServices().catch(() => {}),
        fetchForms().catch(() => {}),
        fetchClinics().catch(() => {}),
      ]);
      setIsInitialSetup(false);
    };
    loadInitial();
  }, [activeOrganization]);

  /* ================= FILTER LOGIC ================= */
  const filteredAppointments = useMemo(() => {
    const mappedAppointments = appointments.map((a) => {
      const serviceObj = servicesList.find(
        (s) => String(s.id) === String(a.service_id),
      );
      return {
        ...a,
        service_name: a.service_name || (serviceObj ? serviceObj.name : "-"),
      };
    });

    return mappedAppointments.filter((a) => {
      // 🟢 1. ซ่อนเคสที่ปิดแล้ว (ไม่แสดงทั้งในตารางและปฏิทิน)
      const safeStatus = a.status || "";
      const isClosedCase =
        safeStatus.includes("ปิดเคส") ||
        safeStatus.includes("สำเร็จ") ||
        safeStatus === "Closed";
      if (isClosedCase) return false;

      const summary = a.summary_data || {};
      const caseIdStr = a.master_case_id
        ? `MC-${String(a.master_case_id).padStart(4, "0")}`
        : `RES-${String(a.case_id).padStart(4, "0")}`;

      const name =
        summary.display_name && summary.display_name !== "-"
          ? summary.display_name
          : caseIdStr;
      const riskLevel = a.overall_risk || a.risk_level || "ต่ำ";
      const searchTerm = search.toLowerCase();
      const safeIdentityValue = a.identity_value
        ? String(a.identity_value).toLowerCase()
        : "";
      const safeName = name ? String(name).toLowerCase() : "";

      const matchSearch =
        search === "" ||
        safeName.includes(searchTerm) ||
        caseIdStr.toLowerCase().includes(searchTerm) ||
        safeIdentityValue.includes(searchTerm);

      const matchService =
        filterService === "" || String(a.service_id) === filterService;
      const matchRisk = filterRisk === "" || riskLevel === filterRisk;
      const matchForm =
        selectedFormId === "all" ||
        String(a.form_id) === String(selectedFormId);
      const matchClinic =
        selectedClinic === "" || a.clinic_type === selectedClinic;
      const matchFormStatus =
        formStatusFilter === "all" ||
        (formStatusFilter === "published"
          ? !a.form_id || a.form_status === "published"
          : a.form_status !== "published");

      const appointmentDateKey = a.appointment_date
        ? bangkokDateKey(a.appointment_date)
        : "";
      const matchDate =
        !appointmentDateKey ||
        ((!startDate || appointmentDateKey >= startDate) &&
          (!endDate || appointmentDateKey <= endDate));

      return (
        matchSearch &&
        matchService &&
        matchRisk &&
        matchForm &&
        matchClinic &&
        matchFormStatus &&
        matchDate
      );
    });
  }, [
    appointments,
    search,
    filterService,
    filterRisk,
    startDate,
    endDate,
    servicesList,
    selectedFormId,
    selectedClinic,
    formStatusFilter,
  ]);

  const apptStatusOf = (a) =>
    ["Completed", "Cancelled"].includes(a.appt_status)
      ? a.appt_status
      : "Scheduled";
  const statusTabs = [
    { value: "", label: "ทั้งหมด" },
    { value: "Scheduled", label: "รอเข้ารับบริการ" },
    { value: "Completed", label: "มาตามนัด" },
    { value: "Cancelled", label: "ยกเลิกนัด" },
  ].map((tab) => ({
    ...tab,
    count: tab.value
      ? filteredAppointments.filter((a) => apptStatusOf(a) === tab.value).length
      : filteredAppointments.length,
  }));
  const listedAppointments = filterApptStatus
    ? filteredAppointments.filter((a) => apptStatusOf(a) === filterApptStatus)
    : filteredAppointments;

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
        title: clickInfo.event.title,
      },
    });
  };

  const handleUpdateApptStatus = async (apptId, newStatus) => {
    try {
      await updateAppointmentStatus(apptId, newStatus);
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.appointment_id === apptId || a.id === apptId) {
            return { ...a, appt_status: newStatus };
          }
          return a;
        }),
      );
      await showSuccessToast("อัปเดตสถานะนัดหมายเรียบร้อยแล้ว");
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "อัปเดตสถานะนัดหมายไม่สำเร็จ",
      });
    }
  };

  // ฟังก์ชันแปลงรูปแบบ YYYY-MM-DD ให้เป็น วว/ดด/ปปปป (พ.ศ.)
  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    return formatBangkokDate(dateString, "th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  /* ================= UI ================= */
  usePageExport({
    title: "นัดหมาย",
    sources: [
      {
        resource: "appointments",
        filters: { startDate, endDate },
        ids: listedAppointments.map((r) => r.appointment_id || r.id),
      },
    ],
  });

  const clearMoreFilters = () => {
    setFormStatusFilter("published");
    setSelectedFormId("all");
    setSelectedClinic("");
    setFilterService("");
    setFilterRisk("");
  };
  const filterChips = [
    {
      key: "formStatus",
      label: "สถานะฟอร์ม",
      value:
        formStatusFilter === "published"
          ? ""
          : formStatusFilter === "draft"
            ? "ฉบับร่าง/ซ่อน"
            : "ทั้งหมด",
      onRemove: () => setFormStatusFilter("published"),
    },
    {
      key: "form",
      label: "แบบฟอร์ม",
      value:
        selectedFormId && selectedFormId !== "all"
          ? filteredForms.find((f) => String(f.id) === String(selectedFormId))
              ?.title || selectedFormId
          : "",
      onRemove: () => setSelectedFormId("all"),
    },
    {
      key: "clinic",
      label: "คลินิก",
      value:
        selectedClinic === "general"
          ? "ทั่วไป"
          : clinics.find((c) => c.slug === selectedClinic)?.name ||
            selectedClinic,
      onRemove: () => setSelectedClinic(""),
    },
    {
      key: "service",
      label: "บริการ",
      value: filterService
        ? servicesList.find((x) => String(x.id) === String(filterService))
            ?.name || filterService
        : "",
      onRemove: () => setFilterService(""),
    },
    {
      key: "risk",
      label: "ความเสี่ยง",
      value: filterRisk ? "เสี่ยง" + filterRisk : "",
      onRemove: () => setFilterRisk(""),
    },
  ];

  return (
    <div className="apt-admin-layout">
      <main className="apt-main-content">
        <PageHero
          title="ตารางนัดหมาย"
          description="ดูและจัดการนัดหมายของผู้รับบริการ เลือกดูแบบรายการหรือแบบปฏิทิน"
          actions={
            <div className="apt-view-toggle" role="group" aria-label="มุมมอง">
              <button
                type="button"
                className={`apt-view-btn ${!calendarMode ? "active" : ""}`}
                aria-pressed={!calendarMode}
                onClick={() => setCalendarMode(false)}
              >
                <FiList size={18} aria-hidden="true" /> แบบรายการ
              </button>
              <button
                type="button"
                className={`apt-view-btn ${calendarMode ? "active" : ""}`}
                aria-pressed={calendarMode}
                onClick={() => setCalendarMode(true)}
              >
                <FiCalendar size={18} aria-hidden="true" /> แบบปฏิทิน
              </button>
            </div>
          }
        />
        <DataPanel as="div" className="apt-container">
          {/* filter bar */}
          <div className="apt-filter-section">
            <div className="apt-search-group">
              <FiSearch
                className="apt-filter-icon"
                style={{ color: "var(--suth-muted)" }}
              />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือ เลขบัตรประชาชน..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <FilterDropdown
              activeCount={
                [
                  formStatusFilter !== "published" ? formStatusFilter : "",
                  selectedFormId !== "all" ? selectedFormId : "",
                  selectedClinic,
                  filterService,
                  filterRisk,
                ].filter(Boolean).length
              }
              onClear={clearMoreFilters}
            >
              {/* สถานะและแบบฟอร์ม: ใช้เมื่อจำเป็น */}
              <FilterField label="สถานะฟอร์ม">
                <CustomDropdown
                  icon={FiLayers}
                  value={formStatusFilter}
                  onChange={setFormStatusFilter}
                  options={[
                    { value: "published", label: "✓ ฟอร์มที่เผยแพร่แล้ว" },
                    { value: "draft", label: "✎ ฟอร์มฉบับร่าง/ซ่อน" },
                    { value: "all", label: "☰ สถานะฟอร์มทั้งหมด" },
                  ]}
                />
              </FilterField>

              <FilterField label="แบบฟอร์ม">
                <CustomDropdown
                  icon={FiLayers}
                  value={selectedFormId}
                  onChange={setSelectedFormId}
                  options={
                    isInitialSetup
                      ? [{ value: "", label: "กำลังโหลดแบบฟอร์ม..." }]
                      : filteredForms.length > 0
                        ? [
                            { value: "all", label: "ทุกแบบฟอร์ม" },
                            ...filteredForms.map((f) => ({
                              value: f.id,
                              label: f.title,
                            })),
                          ]
                        : [{ value: "", label: "-- ไม่มีแบบฟอร์ม --" }]
                  }
                />
              </FilterField>
              <FilterField label="คลินิก">
                <CustomDropdown
                  icon={FiLayers}
                  value={selectedClinic}
                  onChange={setSelectedClinic}
                  options={[
                    { value: "", label: "ทุกคลินิก (All)" },
                    { value: "general", label: "ทั่วไป" },
                    ...clinics
                      .filter((c) => c.slug !== "general")
                      .map((c) => ({ value: c.slug, label: c.name })),
                  ]}
                />
              </FilterField>

              <FilterField label="ช่วงวันที่นัด">
                <div className="apt-date-wrapper apt-date-wrapper--kit">
                  <ThaiDatePicker
                    label="ตั้งแต่วันที่"
                    value={startDate}
                    max={endDate || undefined}
                    rangeStart={startDate}
                    rangeEnd={endDate}
                    onChange={setStartDate}
                  />
                  <span className="apt-date-separator">ถึง</span>
                  <ThaiDatePicker
                    label="ถึงวันที่"
                    value={endDate}
                    min={startDate || undefined}
                    rangeStart={startDate}
                    rangeEnd={endDate}
                    align="end"
                    onChange={setEndDate}
                  />
                </div>
              </FilterField>

              <FilterField label="บริการ">
                <CustomDropdown
                  icon={FiLayers}
                  value={filterService}
                  onChange={setFilterService}
                  options={[
                    { value: "", label: "ทุกบริการ" },
                    ...servicesList.map((s) => ({
                      value: s.id,
                      label: s.name,
                    })),
                  ]}
                />
              </FilterField>

              <FilterField label="ความเสี่ยง">
                <CustomDropdown
                  icon={FiActivity}
                  value={filterRisk}
                  onChange={setFilterRisk}
                  options={[
                    { value: "", label: "ทุกระดับความเสี่ยง" },
                    { value: "ต่ำ", label: "เสี่ยงต่ำ (สีเขียว)" },
                    { value: "ปานกลาง", label: "เสี่ยงปานกลาง (สีเหลือง)" },
                    { value: "สูง", label: "เสี่ยงสูง (สีแดง)" },
                  ]}
                />
              </FilterField>
            </FilterDropdown>
          </div>

          {!calendarMode && (
            <div
              className="dz-pills apt-status-tabs"
              role="group"
              aria-label="สถานะนัดหมาย"
            >
              {statusTabs.map((tab) => (
                <button
                  key={tab.value || "all"}
                  type="button"
                  className="dz-pill"
                  aria-pressed={filterApptStatus === tab.value}
                  onClick={() => setFilterApptStatus(tab.value)}
                >
                  {tab.label}
                  <span className="apt-status-tabs__count">{tab.count}</span>
                </button>
              ))}
            </div>
          )}

          {!calendarMode ? (
            <AppointmentTable
              resetKey={[
                search,
                formStatusFilter,
                selectedFormId,
                selectedClinic,
                filterService,
                filterRisk,
                filterApptStatus,
                startDate,
                endDate,
              ].join("|")}
              appointments={listedAppointments}
              chips={filterChips}
              onClearAll={clearMoreFilters}
              isLoading={isLoading || isInitialSetup}
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
                events={filteredAppointments.map((a) => {
                  let summary = {};
                  try {
                    summary =
                      typeof a.summary_data === "string"
                        ? JSON.parse(a.summary_data)
                        : a.summary_data || {};
                  } catch (e) {
                    summary = {};
                  }

                  const masterIdStr = a.master_case_id
                    ? `MC-${String(a.master_case_id).padStart(4, "0")}`
                    : `RES-${String(a.case_id).padStart(4, "0")}`;

                  const name =
                    summary.display_name && summary.display_name !== "-"
                      ? summary.display_name
                      : masterIdStr;
                  const riskLevel = a.overall_risk || a.risk_level || "ต่ำ";

                  // 🟢 3. อัปเดตสีของอีเวนต์บนปฏิทินตามสถานะการนัดหมาย
                  const apptStatus = a.appt_status || "Scheduled";
                  let bgColor =
                    riskLevel === "ต่ำ"
                      ? "var(--suth-success)"
                      : riskLevel === "ปานกลาง"
                        ? "var(--suth-warning)"
                        : "var(--suth-danger)";
                  let txtColor = "white";

                  if (apptStatus === "Completed") {
                    bgColor = "var(--suth-success-tint)"; // สีเขียวอ่อน
                    txtColor = "var(--suth-success)";
                  } else if (apptStatus === "Cancelled") {
                    bgColor = "var(--suth-danger-tint)"; // สีแดงอ่อน
                    txtColor = "var(--suth-danger)";
                  }

                  return {
                    id: a.appointment_id || a.id,
                    title: `${name} [${a.service_name || "นัดหมาย"}]`,
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
                      appt_status: apptStatus, // 🟢 ส่งพ่วงไปให้ Popup ใช้งาน
                    },
                  };
                })}
                eventClick={handleEventClick}
                headerToolbar={{
                  left: "today",
                  center: "prev title next",
                  right: "",
                }}
              />
            </div>
          )}
        </DataPanel>
      </main>

      {/* 🟢 4. UI ของ Quick Action Popup สำหรับปฏิทิน */}
      {quickActionPopup.isOpen && quickActionPopup.data && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: "var(--z-modal)",
            }}
            onClick={() =>
              setQuickActionPopup({ ...quickActionPopup, isOpen: false })
            }
          />
          <div
            style={{
              position: "fixed",
              left: Math.min(quickActionPopup.x, window.innerWidth - 300),
              top: Math.min(quickActionPopup.y + 20, window.innerHeight - 250),
              background: "var(--suth-surface)",
              boxShadow: "0 15px 40px rgba(31, 47, 63, 0.12)",
              borderRadius: "var(--suth-radius-card)",
              padding: "20px",
              width: "300px",
              zIndex: "var(--z-modal-nested)",
              border: "1px solid var(--suth-surface-2)",
              animation: "aptPopIn 0.3s ease-out forwards",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "16px",
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: "var(--suth-fs-md)",
                  color: "var(--suth-ink)",
                  fontWeight: "700",
                  lineHeight: "1.4",
                }}
              >
                {toDisplayText(quickActionPopup.data.title)}{" "}
              </h4>
              <button
                onClick={() =>
                  setQuickActionPopup({ ...quickActionPopup, isOpen: false })
                }
                style={{
                  background: "var(--suth-surface-2)",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--suth-muted)",
                  fontSize: "var(--suth-fs-caption)",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s",
                  flexShrink: 0,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "var(--suth-line-soft)";
                  e.currentTarget.style.color = "var(--suth-ink)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "var(--suth-surface-2)";
                  e.currentTarget.style.color = "var(--suth-muted)";
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {!quickActionPopup.data.appt_status ||
              quickActionPopup.data.appt_status === "Scheduled" ? (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    hidden={!apptRights.update}
                    style={{
                      flex: 1,
                      background: "var(--suth-success-tint)",
                      color: "var(--suth-success)",
                      border:
                        "1px solid color-mix(in srgb, var(--suth-success) 30%, transparent)",
                      padding: "10px 0",
                      borderRadius: "var(--suth-radius-card)",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "var(--suth-fs-label)",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow:
                        "0 2px 4px color-mix(in srgb, var(--suth-success) 5%, transparent)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background =
                        "color-mix(in srgb, var(--suth-success) 14%, white)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background =
                        "var(--suth-success-tint)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    onClick={() => {
                      handleUpdateApptStatus(
                        quickActionPopup.data.appt_id,
                        "Completed",
                      );
                      setQuickActionPopup({
                        ...quickActionPopup,
                        isOpen: false,
                      });
                    }}
                  >
                    มาตามนัด
                  </button>
                  <button
                    hidden={!apptRights.delete}
                    style={{
                      flex: 1,
                      background: "var(--suth-danger-tint)",
                      color: "var(--suth-danger)",
                      border: "1px solid var(--suth-danger-line)",
                      padding: "10px 0",
                      borderRadius: "var(--suth-radius-card)",
                      cursor: "pointer",
                      fontWeight: "700",
                      fontSize: "var(--suth-fs-label)",
                      transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                      boxShadow:
                        "0 2px 4px color-mix(in srgb, var(--suth-danger) 5%, transparent)",
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background =
                        "color-mix(in srgb, var(--suth-danger) 12%, white)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background =
                        "var(--suth-danger-tint)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    onClick={() => {
                      handleUpdateApptStatus(
                        quickActionPopup.data.appt_id,
                        "Cancelled",
                      );
                      setQuickActionPopup({
                        ...quickActionPopup,
                        isOpen: false,
                      });
                    }}
                  >
                    ยกเลิกนัด
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    background: "var(--suth-surface-2)",
                    border: "1px dashed var(--suth-control-line)",
                    padding: "10px",
                    borderRadius: "var(--suth-radius-panel)",
                    textAlign: "center",
                    color: "var(--suth-muted)",
                    fontSize: "var(--suth-fs-label)",
                    fontWeight: "600",
                  }}
                >
                  สถานะ:{" "}
                  {quickActionPopup.data.appt_status === "Completed"
                    ? "เสร็จสิ้นแล้ว"
                    : "ยกเลิกแล้ว"}
                </div>
              )}

              {/* 🟢 เส้นคั่นแบบไข่ปลาดูซอฟต์ๆ */}
              <hr
                style={{
                  border: "none",
                  borderTop: "2px dotted var(--suth-line)",
                  margin: "4px 0",
                }}
              />

              <button
                style={{
                  background: "var(--suth-surface)",
                  color: "var(--suth-info)",
                  border:
                    "1px solid color-mix(in srgb, var(--suth-info) 30%, transparent)",
                  padding: "10px 12px",
                  borderRadius: "var(--suth-radius-card)",
                  cursor: "pointer",
                  fontWeight: "700",
                  fontSize: "var(--suth-fs-label)",
                  transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow:
                    "0 2px 4px color-mix(in srgb, var(--suth-info) 5%, transparent)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "var(--suth-info-tint)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "var(--suth-surface)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                onClick={() => {
                  setSelectedCase(quickActionPopup.data);
                  setQuickActionPopup({ ...quickActionPopup, isOpen: false });
                }}
              >
                ดูรายละเอียดเคสเต็ม
              </button>
            </div>
          </div>
        </>
      )}

      {selectedCase && (
        <CaseDetailModal
          data={selectedCase}
          onClose={() => setSelectedCase(null)}
          onCaseUpdated={() => {
            fetchAppointments();
          }}
          onCaseDeleted={() => {
            fetchAppointments();
            setSelectedCase(null);
          }}
        />
      )}
    </div>
  );
}
