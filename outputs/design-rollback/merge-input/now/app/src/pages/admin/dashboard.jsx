import {
  PageHeader as UiPageHeader,
  FilterBar as UiFilterBar,
  TextInput as UiTextInput,
  Button as UiButton,
} from "../../components/ui/index.jsx";
import IconSelect from "../../components/IconSelect";
import { toDisplayText } from "../../utils/textPresentation.js";
import { usePageExport } from "../../components/ExcelExport";
import React, { useState, useEffect, useRef, useMemo } from "react";
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import FilterDropdown from "../../components/FilterDropdown";
import {
  getForms,
  getFormById,
  getDashboardSettings,
  getMasterCaseStats,
  getRecentCases,
  getActiveClinics,
} from "../../services/api";
import SystemEvaluationWidget from "../../components/dashboard/SystemEvaluationWidget";
import {
  getCurrentMonthDateRange,
  isCaseInDateRange,
  normaliseDateRange,
  parseCaseDate,
} from "../../utils/caseDateFilter";
import { usePermissions } from "../../permissions/PermissionsProvider";
import "./dashboard.css";
import FormChartWorkspace from "../../components/FormChartWorkspace";
import { useNavigate } from "react-router-dom";
import {
  FiArrowRight,
  FiUsers,
  FiActivity,
  FiAlertCircle,
  FiArchive,
  FiDroplet,
  FiBriefcase,
  FiPlusSquare,
  FiShield,
  FiLayers,
  FiChevronDown,
} from "react-icons/fi";

function StatBoxModern({
  icon: Icon,
  label,
  value,
  urgent,
  color,
  bgColor,
  isLoading,
}) {
  return (
    <div className={`stat-box-modern ${urgent ? "urgent" : ""}`}>
      <div className="stat-modern-header">
        <div
          className="stat-modern-icon"
          style={{ backgroundColor: bgColor || `${color}15` }}
        >
          {Icon && <Icon size={20} color={urgent ? "#ef4444" : color} />}
        </div>
        <span
          className="stat-modern-label"
          style={{ color: urgent ? "#b91c1c" : "#475569", fontWeight: 700 }}
        >
          {toDisplayText(label)}
        </span>
      </div>
      {isLoading ? (
        <div className="db-stat-skeleton"></div>
      ) : (
        <span
          className="stat-modern-value"
          style={{ color: urgent ? "#ef4444" : "#1e293b" }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

const CustomDropdown = (props) => (
  <IconSelect {...props} className="db-custom-select" />
);

export default function Dashboard() {
  const { activeOrganization, can } = usePermissions();
  const canManageDashboardSettings = Boolean(
    activeOrganization && activeOrganization !== "all",
  );
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [clinics, setClinics] = useState([]);

  const [masterCaseStats, setMasterCaseStats] = useState({
    totalActive: 0,
    newToday: 0,
    highRisk: 0,
    closed: 0,
    waitingContact: 0,
    forwardSafeClinic: 0,
    totalStudent: 0,
    totalGeneral: 0,
    bloodTestNegative: 0,
    bloodTestPositive: 0,
    prepWithBlood: 0,
    prepWithoutBlood: 0,
  });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [statsRefetchTrigger, setStatsRefetchTrigger] = useState(0);

  const [forms, setForms] = useState([]);

  const [formStatusFilter, setFormStatusFilter] = useState("published");
  const [selectedClinic, setSelectedClinic] = useState("teenager");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [currentFormDetails, setCurrentFormDetails] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [initialDateRange] = useState(getCurrentMonthDateRange);
  const [startDate, setStartDate] = useState(initialDateRange.startDate);
  const [endDate, setEndDate] = useState(initialDateRange.endDate);
  usePageExport({
    title: "แดชบอร์ด",
    sources: [
      ...(can("clinical.view")
        ? [
            {
              resource: "dashboard_stats",
              filters: {
                startDate,
                endDate,
                form_id: selectedFormId,
                clinic: selectedClinic,
              },
            },
          ]
        : [{ resource: "dashboard" }]),
      ...(selectedFormId && can("cases.view") && can("cases.export")
        ? [
            {
              resource: "responses",
              id: selectedFormId,
              filters: { startDate, endDate },
            },
          ]
        : []),
    ],
  });
  const hasDateRange = Boolean(startDate || endDate);
  const newCaseLabel = hasDateRange ? "เคสใหม่ในช่วงที่เลือก" : "เคสใหม่วันนี้";
  // 🟢 1. เพิ่ม State นี้เพื่อกั้นการโหลดข้อมูลก่อนเวลาอันควร
  const [isInitialSetup, setIsInitialSetup] = useState(true);

  const filteredForms = useMemo(() => {
    let list = forms;
    if (selectedClinic !== "all") {
      list = list.filter((f) => f.clinic_type === selectedClinic);
    }
    if (formStatusFilter === "published") {
      list = list.filter((f) => f.status === "published");
    } else if (formStatusFilter === "draft") {
      list = list.filter((f) => f.status !== "published");
    }
    return list;
  }, [forms, selectedClinic, formStatusFilter]);

  useEffect(() => {
    if (isInitialSetup) return; // 🟢 3.4 สั่งให้หยุดรอ
    const fetchMasterCaseStats = async () => {
      setIsStatsLoading(true);
      try {
        const res = await getMasterCaseStats(
          selectedClinic,
          selectedFormId,
          startDate,
          endDate,
        );
        if (res.data && typeof res.data === "object" && !res.data.error) {
          setMasterCaseStats((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
      } finally {
        setIsStatsLoading(false);
      }
    };
    fetchMasterCaseStats();
  }, [
    selectedClinic,
    selectedFormId,
    startDate,
    endDate,
    statsRefetchTrigger,
    isInitialSetup,
    activeOrganization,
  ]); // 🟢 3.3 เพิ่ม isInitialSetup เป็น dependency

  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitialSetup(true);
      setCases([]);
      setCurrentFormDetails(null);
      try {
        const settingsRequest = canManageDashboardSettings
          ? getDashboardSettings()
          : Promise.resolve({ data: null });
        const [formRes, settingsRes, clinicRes] = await Promise.all([
          getForms("latest"),
          settingsRequest,
          getActiveClinics(),
        ]);
        setForms(formRes.data);
        setClinics(clinicRes.data.data || []);
        const savedSettings = settingsRes.data;

        if (savedSettings?.last_selected_form_id) {
          const lastId = savedSettings.last_selected_form_id;
          const lastForm = formRes.data.find(
            (f) => String(f.id) === String(lastId),
          );

          if (lastForm) {
            setSelectedClinic(lastForm.clinic_type);
            if (lastForm.status === "published") {
              setSelectedFormId(lastId);
            }
          }
        }
      } catch (err) {
      } finally {
        // 🟢 2. โหลดตั้งค่าเริ่มต้นเสร็จแล้ว ปลดล็อคได้!
        setIsInitialSetup(false);
      }
    };
    loadInitialData();
  }, [activeOrganization, canManageDashboardSettings]);

  useEffect(() => {
    if (filteredForms.length > 0) {
      const isStillInList = filteredForms.some(
        (f) => String(f.id) === String(selectedFormId),
      );
      if (!isStillInList) {
        setSelectedFormId(filteredForms[0].id);
      }
    } else {
      setSelectedFormId("");
    }
  }, [selectedClinic, formStatusFilter, filteredForms, selectedFormId]);

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
        if (typeof formDetails.questions === "string") {
          formDetails.questions = JSON.parse(formDetails.questions);
        }
        setCurrentFormDetails(formDetails);
        const realQuestions = formDetails.questions.filter(
          (q) => q.type !== "section" && q.type !== "description",
        );
        setVisibleColumns(realQuestions.slice(0, 5).map((q) => q.id));
      } catch (err) {
        setCurrentFormDetails(null);
        setVisibleColumns([]);
      }
    };
    fetchFormDetails();
  }, [selectedFormId, activeOrganization]);

  useEffect(() => {
    const fetchRecentCasesForClinic = async () => {
      setIsLoading(true);
      try {
        const res = await getRecentCases(selectedClinic, startDate, endDate);
        setCases(res.data);
      } catch (err) {
        setCases([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecentCasesForClinic();
  }, [selectedClinic, startDate, endDate, activeOrganization]);

  const handleFormChange = (newFormId) => setSelectedFormId(newFormId);

  const filteredData = useMemo(() => {
    return cases.filter((item) => isCaseInDateRange(item, startDate, endDate));
  }, [cases, startDate, endDate]);

  const clinicNameMap = {
    all: "ทั้งหมด",
    general: "ทั่วไป",
    teenager: "วัยรุ่น",
    behavior: "ปรับเปลี่ยนพฤติกรรม",
    sti: "โรคติดต่อทางเพศสัมพันธ์",
  };

  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const date = parseCaseDate(dateString);
    if (!date) return "";
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleStartDateChange = (nextStartDate) => {
    const [safeStartDate, safeEndDate] = normaliseDateRange(
      nextStartDate,
      endDate,
    );
    setStartDate(safeStartDate);
    setEndDate(safeEndDate);
  };

  const handleEndDateChange = (nextEndDate) => {
    const [safeStartDate, safeEndDate] = normaliseDateRange(
      startDate,
      nextEndDate,
    );
    setStartDate(safeStartDate);
    setEndDate(safeEndDate);
  };

  return (
    <div className="admin-page dashboard-page">
      <main className="admin-content">
        <UiPageHeader className="content-header">
          <h1>แดชบอร์ด</h1>
          <UiFilterBar className="dashboard-filters">
            <FilterDropdown
              activeCount={
                [
                  formStatusFilter !== "published" ? formStatusFilter : "",
                  selectedClinic !== "all" ? selectedClinic : "",
                ].filter(Boolean).length
              }
            >
              <div className="select-wrapper status-select-wrap">
                <span className="select-label">สถานะแบบฟอร์ม</span>
                <CustomDropdown
                  icon={FiLayers}
                  value={formStatusFilter}
                  onChange={setFormStatusFilter}
                  options={[
                    { value: "published", label: "✓ ฟอร์มที่เผยแพร่แล้ว" },
                    { value: "draft", label: "✎ ฟอร์มฉบับร่าง/ซ่อน" },
                    { value: "all", label: "☰ สถานะฟอร์มทั้งหมด" },
                  ]}
                  style={{ borderColor: "#bfdbfe", backgroundColor: "#eff6ff" }}
                  iconStyle={{ color: "#2563eb" }}
                  textStyle={{ color: "#1e40af", fontWeight: "600" }}
                />
              </div>

              <div className="select-wrapper clinic-select-wrap">
                <span className="select-label">ประเภทคลินิก</span>
                <CustomDropdown
                  icon={FiLayers}
                  value={selectedClinic}
                  onChange={(val) => {
                    setSelectedClinic(val);
                    setIsLoading(true);
                    setIsStatsLoading(true);
                  }}
                  options={[
                    { value: "all", label: "ทุกคลินิก (All)" },
                    { value: "general", label: "ทั่วไป" },
                    ...clinics.map((c) => ({ value: c.slug, label: c.name })),
                  ]}
                />
              </div>
            </FilterDropdown>

            <div className="select-wrapper form-select-wrap">
              <span className="select-label">แบบฟอร์มสำหรับดูกราฟ</span>
              <CustomDropdown
                icon={FiLayers}
                value={selectedFormId}
                onChange={(val) => {
                  if (val) {
                    handleFormChange(val);
                    setIsStatsLoading(true);
                  }
                }}
                options={
                  forms.length > 0
                    ? filteredForms.length > 0
                      ? filteredForms.map((form) => ({
                          value: form.id,
                          label: form.title,
                        }))
                      : [{ value: "", label: "-- ไม่มีแบบฟอร์มในหมวดนี้ --" }]
                    : [{ value: "", label: "กำลังโหลดแบบฟอร์ม..." }]
                }
              />
            </div>

            <div className="select-wrapper filter-date-group">
              <span className="select-label">ช่วงเวลาที่ต้องการดู</span>
              <div className="db-date-range-premium">
                <div
                  className="date-input-box"
                  style={{ position: "relative" }}
                >
                  <UiTextInput
                    type="text"
                    placeholder="วัน/เดือน/ปี"
                    value={displayThaiDate(startDate)}
                    readOnly
                    style={{ width: "100%", backgroundColor: "transparent" }}
                  />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    onClick={(e) =>
                      e.target.showPicker && e.target.showPicker()
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                  />
                </div>

                <span className="date-separator-premium">ถึง</span>

                <div
                  className="date-input-box"
                  style={{ position: "relative" }}
                >
                  <UiTextInput
                    type="text"
                    placeholder="วัน/เดือน/ปี"
                    value={displayThaiDate(endDate)}
                    readOnly
                    style={{ width: "100%", backgroundColor: "transparent" }}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    min={startDate || undefined}
                    onClick={(e) =>
                      e.target.showPicker && e.target.showPicker()
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                      zIndex: 10,
                    }}
                  />
                </div>
              </div>
            </div>
          </UiFilterBar>
        </UiPageHeader>

        {isInitialSetup ? (
          <div className="db-loading-state">
            <div className="db-loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <div className="main-dashboard-container">
            {selectedClinic === "sti" ? (
              <div className="sti-dashboard-wrapper">
                <div className="sti-hero-box">
                  <div>
                    <div className="sti-hero-title">
                      <FiUsers size={24} color="#93c5fd" />
                      ผู้ลงทะเบียนทั้งหมด
                    </div>
                    <div className="sti-hero-value">
                      {(masterCaseStats?.totalActive || 0) +
                        (masterCaseStats?.closed || 0)}
                    </div>
                  </div>
                  <div className="sti-hero-stats">
                    <div className="sti-hero-stat-item">
                      <div className="label">นักศึกษา</div>
                      <div className="value">
                        {masterCaseStats?.totalStudent || 0}
                      </div>
                    </div>
                    <div className="sti-hero-stat-item">
                      <div className="label">บุคคลทั่วไป</div>
                      <div className="value">
                        {masterCaseStats?.totalGeneral || 0}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="sti-stat-row">
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiActivity}
                    label={newCaseLabel}
                    value={(masterCaseStats?.newToday || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#3b82f6"
                  />
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiBriefcase}
                    label="เคสที่รอติดต่อกลับ"
                    value={(masterCaseStats?.waitingContact || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#f59e0b"
                  />
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiAlertCircle}
                    label="เคสเสี่ยงสูง (ฉุกเฉิน)"
                    value={(masterCaseStats?.highRisk || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#ef4444"
                    urgent
                  />
                </div>

                <div className="sti-stat-row">
                  <div className="sti-blood-box">
                    <div>
                      <div className="sti-blood-title">
                        <FiDroplet size={20} color="#be185d" />
                        สถิติเจาะเลือดรวม
                      </div>
                      <div className="sti-blood-value">
                        {(masterCaseStats?.bloodTestNegative || 0) +
                          (masterCaseStats?.bloodTestPositive || 0)}
                      </div>
                    </div>
                    <div className="sti-blood-stats">
                      <div className="sti-blood-stat-item">
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#10b981",
                            fontWeight: "700",
                          }}
                        >
                          Negative (-)
                        </div>
                        <div
                          style={{
                            fontSize: "22px",
                            fontWeight: "800",
                            color: "#047857",
                          }}
                        >
                          {masterCaseStats?.bloodTestNegative || 0}
                        </div>
                      </div>
                      <div
                        className="sti-blood-stat-item"
                        style={{ border: "1px solid #fecaca" }}
                      >
                        <div
                          style={{
                            fontSize: "13px",
                            color: "#ef4444",
                            fontWeight: "700",
                          }}
                        >
                          Positive (+)
                        </div>
                        <div
                          style={{
                            fontSize: "22px",
                            fontWeight: "800",
                            color: "#b91c1c",
                          }}
                        >
                          {masterCaseStats?.bloodTestPositive || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiPlusSquare}
                    label="รับยา PrEP (เจาะเลือดที่นี่)"
                    value={(masterCaseStats?.prepWithBlood || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#8b5cf6"
                  />
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiShield}
                    label="รับยา PrEP (มีผลเลือดมา)"
                    value={(masterCaseStats?.prepWithoutBlood || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#10b981"
                  />
                </div>

                <div className="sti-stat-row">
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiArrowRight}
                    label="ส่งต่อ Safe Clinic"
                    value={(masterCaseStats?.forwardSafeClinic || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#ec4899"
                  />
                  <StatBoxModern
                    isLoading={isStatsLoading}
                    icon={FiArchive}
                    label="เคสที่ปิดแล้ว (Closed)"
                    value={(masterCaseStats?.closed || 0)
                      .toString()
                      .padStart(2, "0")}
                    color="#64748b"
                  />
                </div>
              </div>
            ) : selectedClinic === "behavior" ? (
              <div className="stats-grid">
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiUsers}
                  label="ผู้ลงทะเบียนทั้งหมด"
                  value={(
                    (masterCaseStats?.totalActive || 0) +
                    (masterCaseStats?.closed || 0)
                  )
                    .toString()
                    .padStart(2, "0")}
                  color="#14b8a6"
                />
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiActivity}
                  label={newCaseLabel}
                  value={(masterCaseStats?.newToday || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#3b82f6"
                />
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiBriefcase}
                  label="เคสที่รอติดต่อกลับ"
                  value={(masterCaseStats?.waitingContact || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#f59e0b"
                />
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiArchive}
                  label="เคสที่ปิดแล้ว (Closed)"
                  value={(masterCaseStats?.closed || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#64748b"
                />
              </div>
            ) : (
              <div className="stats-grid">
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiUsers}
                  label="เคสที่กำลังดูแล (Active)"
                  value={(masterCaseStats?.totalActive || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#14b8a6"
                />
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiActivity}
                  label={newCaseLabel}
                  value={(masterCaseStats?.newToday || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#3b82f6"
                />
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiAlertCircle}
                  label="เคสที่มีความเสี่ยงสูง"
                  value={(masterCaseStats?.highRisk || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#ef4444"
                  urgent
                />
                <StatBoxModern
                  isLoading={isStatsLoading}
                  icon={FiArchive}
                  label="ปิดเคสแล้ว (Closed)"
                  value={(masterCaseStats?.closed || 0)
                    .toString()
                    .padStart(2, "0")}
                  color="#64748b"
                />
              </div>
            )}

            <hr className="divider" />

            <FormChartWorkspace
              key={activeOrganization}
              startDate={startDate}
              endDate={endDate}
              formId={selectedFormId}
            />

            <hr className="divider" />

            <section className="dash-case-table-wrapper">
              <div className="dash-case-table-header">
                <h2
                  className="text-2xl font-semibold"
                  style={{ fontSize: "clamp(18px, 5vw, 24px)" }}
                >
                  ตารางเคสล่าสุด (คลินิก{clinicNameMap[selectedClinic] || ""})
                </h2>
                <UiButton
                  variant="ghost"
                  type="submit"
                  className="db-view-all-btn"
                  onClick={() =>
                    navigate("/admin/cases", {
                      state: { defaultFormId: selectedFormId },
                    })
                  }
                >
                  ดูทั้งหมด <FiArrowRight />
                </UiButton>
              </div>
              <div className="dash-case-table-scroll-area">
                <CaseTable
                  data={filteredData}
                  questions={currentFormDetails?.questions || []}
                  visibleColumns={visibleColumns}
                  isLoading={isLoading}
                  onSelectCase={(c) => {
                    setSelectedCase(c);
                  }}
                />
              </div>
              {selectedCase && (
                <CaseDetailModal
                  data={selectedCase}
                  onClose={() => {
                    setSelectedCase(null);
                  }}
                  onCaseUpdated={(updatedCase) => {
                    const updateFn = (prev) =>
                      prev.map((r) => {
                        if (
                          r.id === updatedCase.id ||
                          (r.master_case_id &&
                            updatedCase.master_case_id &&
                            r.master_case_id === updatedCase.master_case_id)
                        ) {
                          return { ...r, ...updatedCase };
                        }
                        return r;
                      });
                    setCases(updateFn);
                    setStatsRefetchTrigger((prev) => prev + 1);
                  }}
                  onCaseDeleted={(deletedId) => {
                    setCases((prev) => prev.filter((r) => r.id !== deletedId));
                    setSelectedCase(null);
                    setStatsRefetchTrigger((prev) => prev + 1);
                  }}
                />
              )}
            </section>

            <hr className="divider" />

            {/* 🟢 เรียกใช้ Component ประเมินระบบตรงนี้ */}
            <section className="dash-evaluation-wrapper">
              <SystemEvaluationWidget />
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
