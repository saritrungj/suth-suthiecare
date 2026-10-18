import { toDisplayText } from "../../utils/textPresentation.js";
import { usePageExport } from "../../components/ExcelExport";
import React, { useState, useEffect, useRef, useMemo } from "react";
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
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
} from "../../utils/caseDateFilter";
import { usePermissions } from "../../permissions/PermissionsProvider";
import "./dashboard.css";
import FormChartWorkspace from "../../components/FormChartWorkspace";
import { useNavigate } from "react-router-dom";
import { FiArrowRight, FiLayers, FiChevronDown } from "react-icons/fi";
import ClinicKpiSummary from "../../components/dashboard/ClinicKpiSummary";
import AllOrganizationsOverview from "../../components/dashboard/AllOrganizationsOverview";
import {
  DashboardHero,
  DateRangePills,
  DzSection,
  describeRange,
  formatCount,
} from "../../components/dashboard/DashboardKit";
import ActiveOrganizationScope from "../../components/OrganizationScope";
import {
  getClinicName,
  pickInitialClinic,
} from "../../permissions/organizationProfile";

const CustomDropdown = ({ icon: Icon, value, options, onChange, label }) => {
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
      className={"db-custom-select" + (isOpen ? " is-open" : "")}
      ref={ref}
      style={{ zIndex: isOpen ? "var(--z-dropdown)" : 1 }}
    >
      <button
        type="button"
        className="db-custom-select__trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={
          label ? label + ": " + toDisplayText(displayLabel) : undefined
        }
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon className="db-filter-icon" aria-hidden="true" />
        <span className="db-select-value">{toDisplayText(displayLabel)}</span>
        <FiChevronDown
          className={`db-dropdown-icon ${isOpen ? "open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="db-select-menu" role="listbox">
          {options.map((opt) => (
            <button
              type="button"
              role="option"
              aria-selected={String(value) === String(opt.value)}
              key={opt.value}
              className={`db-select-option ${String(value) === String(opt.value) ? "selected" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {toDisplayText(opt.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Forms with no clinic belong to "general", as on the forms page.
const formClinic = (form) => form.clinic_type || "general";

// The dashboard route: the system admin's "all organizations" scope gets the
// cross-organization overview; one organization gets its own dashboard.
export default function Dashboard() {
  const { activeOrganization } = usePermissions();
  if (activeOrganization === "all") return <AllOrganizationsOverview />;
  return <OrganizationDashboard />;
}

function OrganizationDashboard() {
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
  const [selectedClinic, setSelectedClinic] = useState("all");
  const [selectedFormId, setSelectedFormId] = useState("");
  const [currentFormDetails, setCurrentFormDetails] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [range, setRange] = useState(getCurrentMonthDateRange);
  const { startDate, endDate } = range;
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
  // Holds every request until the saved form and clinic are known.
  const [isInitialSetup, setIsInitialSetup] = useState(true);

  const filteredForms = useMemo(() => {
    let list = forms;
    if (selectedClinic !== "all") {
      list = list.filter((f) => formClinic(f) === selectedClinic);
    }
    if (formStatusFilter === "published") {
      list = list.filter((f) => f.status === "published");
    } else if (formStatusFilter === "draft") {
      list = list.filter((f) => f.status !== "published");
    }
    return list;
  }, [forms, selectedClinic, formStatusFilter]);

  // Counts cover the whole clinic in the date range; the form picker below
  // only chooses which form the recent-cases table shows.
  useEffect(() => {
    if (isInitialSetup) return;
    let alive = true;
    const fetchMasterCaseStats = async () => {
      setIsStatsLoading(true);
      try {
        const res = await getMasterCaseStats(
          selectedClinic,
          "",
          startDate,
          endDate,
        );
        if (
          alive &&
          res.data &&
          typeof res.data === "object" &&
          !res.data.error
        ) {
          setMasterCaseStats((prev) => ({ ...prev, ...res.data }));
        }
      } catch (err) {
      } finally {
        if (alive) setIsStatsLoading(false);
      }
    };
    fetchMasterCaseStats();
    return () => {
      alive = false;
    };
  }, [
    selectedClinic,
    startDate,
    endDate,
    statsRefetchTrigger,
    isInitialSetup,
    activeOrganization,
  ]);

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
        const orgClinics = clinicRes.data.data || [];
        setForms(formRes.data);
        setClinics(orgClinics);
        const savedSettings = settingsRes.data;
        let savedClinic = null;

        if (savedSettings?.last_selected_form_id) {
          const lastId = savedSettings.last_selected_form_id;
          const lastForm = formRes.data.find(
            (f) => String(f.id) === String(lastId),
          );

          if (lastForm) {
            savedClinic = formClinic(lastForm);
            if (lastForm.status === "published") {
              setSelectedFormId(lastId);
            }
          }
        }
        setSelectedClinic(pickInitialClinic(orgClinics, savedClinic));
      } catch (err) {
      } finally {
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

  // Recent cases of the selected form, so each row has answers for the
  // table's question columns.
  useEffect(() => {
    if (isInitialSetup) return;
    if (!selectedFormId) {
      setCases([]);
      setIsLoading(false);
      return;
    }
    let alive = true;
    const fetchRecentCasesForClinic = async () => {
      setIsLoading(true);
      try {
        const res = await getRecentCases(
          selectedClinic,
          startDate,
          endDate,
          selectedFormId,
        );
        if (alive) setCases(res.data);
      } catch (err) {
        if (alive) setCases([]);
      } finally {
        if (alive) setIsLoading(false);
      }
    };
    fetchRecentCasesForClinic();
    return () => {
      alive = false;
    };
  }, [
    selectedClinic,
    selectedFormId,
    startDate,
    endDate,
    activeOrganization,
    isInitialSetup,
  ]);

  const filteredData = useMemo(() => {
    return cases.filter((item) => isCaseInDateRange(item, startDate, endDate));
  }, [cases, startDate, endDate]);

  const selectedClinicName =
    getClinicName(selectedClinic, clinics) || selectedClinic;
  const clinicOptions = [
    // "general" is always offered once, even when it is also a clinic row.
    ...clinics
      .filter((c) => c.slug !== "general")
      .map((c) => ({ value: c.slug, label: c.name })),
    { value: "general", label: "ทั่วไป" },
    { value: "all", label: "ทุกคลินิก" },
  ];
  const handleClinicChange = (val) => {
    if (val === selectedClinic) return;
    setSelectedClinic(val);
    setIsLoading(true);
    setIsStatsLoading(true);
  };

  const openCases = () =>
    navigate("/admin/cases", {
      state: { defaultFormId: selectedFormId },
    });

  const highRisk = Number(masterCaseStats.highRisk || 0);
  const waiting = Number(masterCaseStats.waitingContact || 0);
  const ready = !isInitialSetup && !isStatsLoading;
  const heroNote = !ready
    ? null
    : highRisk > 0
      ? toDisplayText(selectedClinicName) +
        " มีเคสเสี่ยงสูงที่ยังไม่ปิด " +
        formatCount(highRisk) +
        " เคส รอให้คุณดูแลอยู่นะ"
      : waiting > 0
        ? toDisplayText(selectedClinicName) +
          " ไม่มีเคสเสี่ยงสูงค้าง มี " +
          formatCount(waiting) +
          " เคสรอติดต่อกลับ"
        : null;
  const heroTone = highRisk > 0 ? "alert" : waiting > 0 ? "warn" : "clear";

  const formOptions =
    forms.length > 0
      ? filteredForms.length > 0
        ? filteredForms.map((form) => ({
            value: form.id,
            label: form.title,
          }))
        : [{ value: "", label: "-- ไม่มีแบบฟอร์มในหมวดนี้ --" }]
      : [{ value: "", label: "กำลังโหลดแบบฟอร์ม..." }];

  return (
    <div className="admin-page dz-surface">
      <main className="dz-page">
        <DashboardHero
          title="แดชบอร์ด"
          scope={<ActiveOrganizationScope />}
          note={heroNote}
          tone={heroTone}
        />

        <div className="dz-toolbar">
          {clinics.length > 0 && (
            <div className="dz-field">
              <span className="dz-field__label" id="db-clinic-label">
                คลินิก
              </span>
              <div
                className="dz-pills"
                role="group"
                aria-labelledby="db-clinic-label"
              >
                {clinicOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className="dz-pill"
                    aria-pressed={selectedClinic === opt.value}
                    onClick={() => handleClinicChange(opt.value)}
                  >
                    {toDisplayText(opt.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DateRangePills value={range} onChange={setRange} />
        </div>

        {isInitialSetup ? (
          <div className="db-loading-state">
            <div className="db-loading-spinner"></div>
            <p>กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <>
            <ClinicKpiSummary
              clinicSlug={selectedClinic}
              clinicName={selectedClinicName}
              stats={masterCaseStats}
              isLoading={isStatsLoading}
              newCaseLabel={newCaseLabel}
              rangeLabel={
                "ข้อมูล " +
                describeRange(range) +
                " นับเคสละหนึ่งครั้งตามผลประเมินล่าสุด"
              }
              onOpenCases={openCases}
            />

            <FormChartWorkspace
              key={activeOrganization}
              startDate={startDate}
              endDate={endDate}
              formId={selectedFormId}
            />

            <DzSection
              className="dash-case-table-wrapper"
              title={"เคสล่าสุด · " + toDisplayText(selectedClinicName)}
              description="15 เคสล่าสุดของแบบฟอร์มที่เลือก ในช่วงเวลาเดียวกับด้านบน"
              aside={
                <div className="dash-case-table-header">
                  <div className="db-form-picker">
                    <CustomDropdown
                      icon={FiLayers}
                      label="แบบฟอร์ม"
                      value={selectedFormId}
                      onChange={(val) => {
                        if (val) setSelectedFormId(val);
                      }}
                      options={formOptions}
                    />
                    <CustomDropdown
                      icon={FiLayers}
                      label="สถานะแบบฟอร์ม"
                      value={formStatusFilter}
                      onChange={setFormStatusFilter}
                      options={[
                        { value: "published", label: "เผยแพร่แล้ว" },
                        { value: "draft", label: "ฉบับร่าง/ซ่อน" },
                        { value: "all", label: "ทุกสถานะ" },
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    className="db-view-all-btn dz-link"
                    onClick={openCases}
                  >
                    ดูทั้งหมด <FiArrowRight aria-hidden="true" />
                  </button>
                </div>
              }
            >
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
            </DzSection>

            <section className="dash-evaluation-wrapper">
              <SystemEvaluationWidget />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
