import { useState, useEffect, useMemo } from "react";
import CaseTable from "../../components/case/CaseTable";
import CaseDetailModal from "../../components/case/CaseDetailModal";
import FilterDropdown from "../../components/FilterDropdown";
import ExportExcelModal from "../../components/case/ExportExcelModal.jsx";
import {
  getForms,
  getFormById,
  getFormResponses,
  createCase,
  getActiveClinics,
} from "../../services/api";
import "./CaseData.css";
import { useLocation } from "react-router-dom";
import {
  FiCalendar,
  FiDownload,
  FiList,
  FiPlus,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import Swal from "sweetalert2";
import {
  getCurrentMonthDateRange,
  isCaseInDateRange,
  normaliseDateRange,
} from "../../utils/caseDateFilter";
import { usePermissions } from "../../permissions/PermissionsProvider";
import { prioritizeCases } from "../../components/case/caseDisplay";
import { useMediaQuery } from "../../components/useMediaQuery";

const FACULTIES = [
  "(1) สำนักวิชาวิทยาศาสตร์",
  "(2) สำนักวิชาเทคโนโลยีสังคม",
  "(3) สำนักวิชาเทคโนโลยีการเกษตร",
  "(4) สำนักวิชาวิศวกรรมศาสตร์",
  "(5) สำนักวิชาแพทยศาสตร์",
  "(6) สำนักวิชาพยาบาลศาสตร์",
  "(7) สำนักวิชาทันตแพทยศาสตร์",
  "(8) สำนักวิชาสาธารณสุขศาสตร์",
  "(9) สำนักวิชาศาสตร์และศิลป์ดิจิทัล",
  "อื่นๆ",
];

const CLINIC_COLORS = [
  "#e0f2fe",
  "#dcfce7",
  "#fce7f3",
  "#fef3c7",
  "#e0e7ff",
  "#f3e8ff",
];
const CLINIC_TEXT_COLORS = [
  "#0284c7",
  "#166534",
  "#be185d",
  "#d97706",
  "#4338ca",
  "#7e22ce",
];
const CLINIC_BORDER_COLORS = [
  "#7dd3fc",
  "#86efac",
  "#f9a8d4",
  "#fcd34d",
  "#a5b4fc",
  "#d8b4fe",
];

function getClinicConfig(slug, clinicsList = []) {
  if (slug === "general")
    return {
      id: "general",
      text: "ทั่วไป",
      color: "#475569",
      bg: "#f1f5f9",
      border: "#cbd5e1",
    };
  const clinic = clinicsList.find((c) => c.slug === slug);
  if (!clinic)
    return {
      id: slug,
      text: slug || "-",
      color: "#475569",
      bg: "#f1f5f9",
      border: "#cbd5e1",
    };

  const index = clinicsList.findIndex((c) => c.slug === slug);
  const colorIndex = index % CLINIC_COLORS.length;
  return {
    id: slug,
    text: clinic.name,
    bg: CLINIC_COLORS[colorIndex],
    color: CLINIC_TEXT_COLORS[colorIndex],
    border: CLINIC_BORDER_COLORS[colorIndex],
  };
}

const caseRiskColors = {
  "น้ำหนักน้อย / ผอม": { bg: "#d0f0fd", color: "#0c4a6e" },
  "ปกติ (สุขภาพดี)": { bg: "#ecfdf5", color: "#065f46" },
  "ท้วม / โรคอ้วนระดับ 1": { bg: "#fef9c3", color: "#713f12" },
  "อ้วน / โรคอ้วนระดับ 2": { bg: "#fff7ed", color: "#7c2d12" },
  "อ้วนมาก / โรคอ้วนระดับ 3": { bg: "#fef2f2", color: "#7f1d1d" },
  "ปกติ / ไม่มีอาการซึมเศร้า": { bg: "#ecfdf5", color: "#065f46" },
  มีอาการซึมเศร้าระดับน้อย: { bg: "#fef9c3", color: "#713f12" },
  มีอาการซึมเศร้าระดับปานกลาง: { bg: "#fff7ed", color: "#7c2d12" },
  มีอาการซึมเศร้าระดับรุนแรง: { bg: "#fef2f2", color: "#7f1d1d" },
};

const CLINIC_RISK_OPTIONS = {
  general: ["ต่ำ", "ปานกลาง", "สูง"],

  teenager: [
    "ปกติ / ไม่มีอาการซึมเศร้า",
    "มีอาการซึมเศร้าระดับน้อย",
    "มีอาการซึมเศร้าระดับปานกลาง",
    "มีอาการซึมเศร้าระดับรุนแรง",
  ],

  behavior: [
    "น้ำหนักน้อย / ผอม",
    "ปกติ (สุขภาพดี)",
    "ท้วม / โรคอ้วนระดับ 1",
    "อ้วน / โรคอ้วนระดับ 2",
    "อ้วนมาก / โรคอ้วนระดับ 3",
  ],

  sti: ["ต่ำ", "ปานกลาง", "สูง"],
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
      c.includes("red") ||
      (s.label && s.label.includes("สูง"))
    );
  });

  const isMedium = scoreResults.some((s) => {
    const c = s.color?.toLowerCase() || "";
    return (
      c.includes("fbbc04") ||
      c.includes("ff9800") ||
      c.includes("f59e0b") ||
      c.includes("orange") ||
      c.includes("yellow") ||
      (s.label && s.label.includes("ปานกลาง"))
    );
  });

  if (isHigh) return "สูง";
  if (isMedium) return "ปานกลาง";
  return "ต่ำ";
}

// A labelled native select for the filter row and the filter menu.
function FilterSelect({ label, value, onChange, options, className = "" }) {
  return (
    <label className={`cw-field ${className}`}>
      <span>{label}</span>
      <select
        className="cw-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Case statuses in follow-up order, for the status strip.
const STATUS_ORDER = [
  "รอติดต่อ (รอดำเนินการ)",
  "ติดต่อไม่ได้ / ไม่รับสาย",
  "ขอเลื่อนนัด",
  "นัดหมายสำเร็จ",
  "อยู่ระหว่างติดตามต่อเนื่อง",
  "ส่งต่อผู้เชี่ยวชาญ",
  "ปฏิเสธบริการ",
  "ปิดเคสเรียบร้อย",
];
const NEW_CASE = "__new";

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

    note: "",
  });

  const handleChange = (field, value) => {
    // ถ้าเปลี่ยนคลินิก → reset risk ตามคลินิกใหม่
    if (field === "clinicType") {
      const firstRisk = CLINIC_RISK_OPTIONS[value]?.[0] || "ต่ำ";

      setFormData((prev) => ({
        ...prev,
        clinicType: value,
        riskLevel: firstRisk,
      }));

      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    const now = new Date().toISOString();

    const clinicText =
      getClinicConfig(formData.clinicType, clinics)?.text || "-";

    const allAnswers = {
      เลขบัตรประชาชน: formData.citizenId || "-",
      คำนำหน้า: formData.prefix || "-",
      "ชื่อ - นามสกุล": formData.name || "-",
      เบอร์โทร: formData.phone || "-",
      สำนักวิชา: formData.faculty || "-",
      คลินิก: clinicText,
      ระดับความเสี่ยง: formData.riskLevel || "-",
      สถานะเคส: formData.status || "-",
      หมายเหตุ: formData.note || "-",
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
            bg: caseRiskColors[formData.riskLevel]?.bg || "#e5e7eb",
            color: caseRiskColors[formData.riskLevel]?.color || "#374151",
          },
        ],
      },
    };

    onSave(newCase);
  };

  return (
    <div className="scd-modal-overlay" role="presentation">
      <div
        className="scd-create-case-modal"
        role="dialog"
        aria-modal="true"
        aria-label="สร้างเคสใหม่"
      >
        <div className="scd-create-case-header">
          <div>
            <h2>เพิ่มเคส Walk-in</h2>
            <p>กรณีผู้รับบริการไม่ได้ตอบแบบสอบถาม</p>
          </div>

          <button
            className="scd-close-btn"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
          />
        </div>

        <div className="scd-create-case-body">
          {/* SECTION 1 */}
          <div className="scd-form-section">
            <div className="scd-section-title">ข้อมูลผู้รับบริการ</div>

            <div className="scd-form-grid">
              <div className="scd-form-group">
                <label htmlFor="create-case-field-1">เลขบัตรประชาชน</label>

                <input
                  id="create-case-field-1"
                  type="text"
                  placeholder="กรอกเลขบัตรประชาชน"
                  value={formData.citizenId}
                  onChange={(e) => handleChange("citizenId", e.target.value)}
                />
              </div>

              <div className="scd-form-group">
                <label htmlFor="create-case-field-2">คำนำหน้า</label>

                <select
                  id="create-case-field-2"
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
                <label htmlFor="create-case-field-3">ชื่อ - นามสกุล</label>

                <input
                  id="create-case-field-3"
                  type="text"
                  placeholder="กรอกชื่อผู้รับบริการ"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                />
              </div>

              <div className="scd-form-group">
                <label htmlFor="create-case-field-4">เบอร์โทร</label>

                <input
                  id="create-case-field-4"
                  type="text"
                  placeholder="กรอกเบอร์โทรศัพท์"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>

              <div className="scd-form-group">
                <label htmlFor="create-case-field-5">สำนักวิชา</label>

                <select
                  id="create-case-field-5"
                  value={formData.faculty}
                  onChange={(e) => handleChange("faculty", e.target.value)}
                >
                  <option value="">เลือกสำนักวิชา</option>

                  {FACULTIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="scd-form-group">
                <label htmlFor="create-case-field-6">คลินิก</label>

                <select
                  id="create-case-field-6"
                  value={formData.clinicType}
                  onChange={(e) => handleChange("clinicType", e.target.value)}
                >
                  <option value="general">ทั่วไป</option>
                  {clinics.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="scd-form-group">
                <label htmlFor="create-case-field-7">ระดับความเสี่ยง</label>

                <select
                  id="create-case-field-7"
                  value={formData.riskLevel}
                  onChange={(e) => handleChange("riskLevel", e.target.value)}
                >
                  {(CLINIC_RISK_OPTIONS[formData.clinicType] || []).map(
                    (risk) => (
                      <option key={risk} value={risk}>
                        {risk}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="scd-form-group">
                <label htmlFor="create-case-field-8">สถานะเคส</label>

                <select
                  id="create-case-field-8"
                  value={formData.status}
                  onChange={(e) => handleChange("status", e.target.value)}
                >
                  <option value="รอติดต่อ (รอดำเนินการ)">
                    รอติดต่อ (รอดำเนินการ)
                  </option>
                  <option value="นัดหมายสำเร็จ">นัดหมายสำเร็จ</option>
                  <option value="ติดต่อไม่ได้ / ไม่รับสาย">
                    ติดต่อไม่ได้ / ไม่รับสาย
                  </option>
                  <option value="ขอเลื่อนนัด">ขอเลื่อนนัด</option>
                  <option value="อยู่ระหว่างติดตามต่อเนื่อง">
                    อยู่ระหว่างติดตามต่อเนื่อง
                  </option>
                  <option value="ปฏิเสธบริการ">ปฏิเสธบริการ</option>
                  <option value="ส่งต่อผู้เชี่ยวชาญ">ส่งต่อผู้เชี่ยวชาญ</option>
                  <option value="ปิดเคสเรียบร้อย">ปิดเคสเรียบร้อย</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2 */}
          <div className="scd-form-section">
            <div className="scd-section-title">รายละเอียดเพิ่มเติม</div>

            <div className="scd-form-group scd-full-width">
              <label htmlFor="create-case-field-9">หมายเหตุ</label>

              <textarea
                id="create-case-field-9"
                rows="5"
                placeholder="บันทึกรายละเอียดเพิ่มเติม..."
                value={formData.note}
                onChange={(e) => handleChange("note", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="scd-create-case-footer">
          <button className="scd-cancel-btn" onClick={onClose}>
            ยกเลิก
          </button>

          <button className="scd-save-btn" onClick={handleSubmit}>
            บันทึกเคส
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CaseData() {
  const { activeOrganization } = usePermissions();
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
  const [statusFilter, setStatusFilter] = useState("");

  const [clinicFilter, setClinicFilter] = useState("all");
  const [formStatusFilter, setFormStatusFilter] = useState("published");
  const [tableViewMode, setTableViewMode] = useState("master");

  const [initialDateRange] = useState(getCurrentMonthDateRange);
  const [startDate, setStartDate] = useState(initialDateRange.startDate);
  const [endDate, setEndDate] = useState(initialDateRange.endDate);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsInitialSetup(true);
      setResponses([]);
      setCurrentFormDetails(null);
      try {
        const [clinicRes, formsRes] = await Promise.all([
          getActiveClinics().catch(() => ({ data: { data: [] } })),
          getForms("latest").catch(() => ({ data: [] })),
        ]);

        setClinics(clinicRes.data.data || []);
        const fetchedForms = formsRes.data || [];
        setForms(fetchedForms);

        if (fetchedForms.length === 0) {
          // There is no form to query, so the table must show its empty state
          // instead of retaining the initial loading indicator.
          setSelectedFormId("");
          setIsLoading(false);
        } else if (initialFormId) {
          const targetForm = fetchedForms.find((f) => f.id === initialFormId);
          if (targetForm) {
            setClinicFilter(targetForm.clinic_type || "general");
            if (targetForm.status !== "published") setFormStatusFilter("draft");
          }
        } else if (fetchedForms.length > 0) {
          const publishedForms = fetchedForms.filter(
            (f) => f.status === "published",
          );
          if (publishedForms.length > 0) {
            setSelectedFormId(publishedForms[0].id);
          } else {
            setSelectedFormId(fetchedForms[0].id);
            setFormStatusFilter("all");
          }
        }
      } finally {
        setIsInitialSetup(false);
      }
    };
    fetchInitialData();
  }, [initialFormId, activeOrganization]);

  const filteredFormsList = useMemo(() => {
    let list = forms;
    if (clinicFilter !== "all")
      list = list.filter((f) => (f.clinic_type || "general") === clinicFilter);
    if (formStatusFilter === "published")
      list = list.filter((f) => f.status === "published");
    else if (formStatusFilter === "draft")
      list = list.filter((f) => f.status !== "published");
    return list;
  }, [forms, clinicFilter, formStatusFilter]);

  useEffect(() => {
    if (forms.length === 0) return;
    if (filteredFormsList.length > 0) {
      const isValid = filteredFormsList.some(
        (f) => String(f.id) === String(selectedFormId),
      );
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
          getFormResponses(selectedFormId, {
            startDate,
            endDate,
            limit: "all",
          }),
        ]);

        let formDetails = formRes.data;
        if (typeof formDetails.questions === "string") {
          formDetails.questions = JSON.parse(formDetails.questions);
        }
        setCurrentFormDetails(formDetails);

        const realQuestions = formDetails.questions.filter(
          (q) => q.type !== "section" && q.type !== "description",
        );
        const savedColumns = localStorage.getItem(
          `visibleColumns_${selectedFormId}`,
        );

        if (savedColumns) {
          setVisibleColumns(JSON.parse(savedColumns));
        } else {
          const defaultVisible = realQuestions.slice(0, 5).map((q) => q.id);
          setVisibleColumns(defaultVisible);
        }

        const parsedResponses = responseRes.data.map((r) => ({
          ...r,
          case_source: r.case_source || "assessment_form",
          summary_data:
            typeof r.summary_data === "string"
              ? JSON.parse(r.summary_data)
              : r.summary_data || {},
        }));
        setResponses(parsedResponses);
        setRisk("");
      } catch (err) {
        setCurrentFormDetails(null);
        setResponses([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFormAndResponses();
  }, [selectedFormId, startDate, endDate]);

  const hasScoring = useMemo(() => {
    if (!currentFormDetails?.questions) return false;
    let scored = false;
    currentFormDetails.questions.forEach((q) => {
      if (q.isScored || (q.scoringRules && q.scoringRules.length > 0))
        scored = true;
      if (q.type === "group" && Array.isArray(q.subQuestions)) {
        q.subQuestions.forEach((sq) => {
          if (sq.isScored || (sq.scoringRules && sq.scoringRules.length > 0))
            scored = true;
        });
      }
    });
    return scored;
  }, [currentFormDetails]);

  const scopedData = useMemo(() => {
    let baseData = responses;
    if (tableViewMode === "master") {
      const uniqueCases = new Map();
      responses.forEach((res) => {
        // One row per person: person_id groups the same human across cases.
        const key = res.person_id
          ? `person_${res.person_id}`
          : res.master_case_id || res.identity_value || `res_${res.id}`;
        if (!uniqueCases.has(key)) {
          uniqueCases.set(key, res);
        } else {
          const existingRes = uniqueCases.get(key);
          const existingDate = new Date(
            existingRes.submitted_at || existingRes.createdAt || 0,
          );
          const newDate = new Date(res.submitted_at || res.createdAt || 0);
          if (newDate > existingDate) {
            uniqueCases.set(key, res);
          }
        }
      });
      baseData = Array.from(uniqueCases.values());
    }

    const mappedData = baseData.map((res) => {
      const summary = res.summary_data || {};
      const realRisk = getRiskLevel(summary);
      return {
        ...res,
        risk_level: realRisk,
        overall_risk: res.overall_risk || summary.overall_risk || realRisk,
      };
    });

    return mappedData.filter((res) => {
      const summary = res.summary_data || {};
      const caseIdStr = `CASE-${String(res.id).padStart(4, "0")}`;
      const name = summary.display_name || "-";
      const resFaculty = summary.display_faculty || "-";

      let currentRisk = res.risk_level;
      if (tableViewMode === "master") currentRisk = res.overall_risk;

      const matchSearch =
        search === "" ||
        caseIdStr.toLowerCase().includes(search.toLowerCase()) ||
        name.toLowerCase().includes(search.toLowerCase()) ||
        String(res.submitted_by?.username || "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        String(res.submitted_by?.account_id || "").includes(search) ||
        (res.identity_value && res.identity_value.includes(search));
      const matchFaculty = faculty === "" || resFaculty.includes(faculty);
      const matchRisk = risk === "" || !hasScoring || currentRisk === risk;

      const matchDate = isCaseInDateRange(res, startDate, endDate);
      return matchSearch && matchFaculty && matchRisk && matchDate;
    });
  }, [
    responses,
    search,
    faculty,
    risk,
    tableViewMode,
    hasScoring,
    startDate,
    endDate,
  ]);

  // Counts per status for the strip (person view), before the status filter.
  const statusCounts = useMemo(() => {
    const counts = new Map();
    scopedData.forEach((row) => {
      const key = row.status || NEW_CASE;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const order = [NEW_CASE, ...STATUS_ORDER];
    return [...counts.entries()].sort(
      ([a], [b]) =>
        (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) -
        (order.indexOf(b) === -1 ? 99 : order.indexOf(b)),
    );
  }, [scopedData]);

  // The person view is a work queue: open cases, highest risk first.
  const filteredData = useMemo(() => {
    if (tableViewMode !== "master") return scopedData;
    const rows = statusFilter
      ? scopedData.filter((row) =>
          statusFilter === NEW_CASE ? !row.status : row.status === statusFilter,
        )
      : scopedData;
    return prioritizeCases(rows, "master");
  }, [scopedData, statusFilter, tableViewMode]);

  useEffect(() => {
    if (
      statusFilter &&
      !statusCounts.some(([status]) => status === statusFilter)
    )
      setStatusFilter("");
  }, [statusCounts, statusFilter]);

  // Previous/next inside the drawer follow the queue as shown.
  const selectedIndex = selectedCase
    ? filteredData.findIndex((row) => row.id === selectedCase.id)
    : -1;
  const caseNav =
    selectedIndex === -1
      ? undefined
      : {
          position: selectedIndex + 1,
          total: filteredData.length,
          onPrev:
            selectedIndex > 0
              ? () => setSelectedCase(filteredData[selectedIndex - 1])
              : undefined,
          onNext:
            selectedIndex < filteredData.length - 1
              ? () => setSelectedCase(filteredData[selectedIndex + 1])
              : undefined,
        };

  const toggleColumn = (qId) => {
    setVisibleColumns((prev) => {
      const newVisible = prev.includes(qId)
        ? prev.filter((id) => id !== qId)
        : [...prev, qId];
      if (selectedFormId)
        localStorage.setItem(
          `visibleColumns_${selectedFormId}`,
          JSON.stringify(newVisible),
        );
      return newVisible;
    });
  };

  const allDynamicQuestions = (currentFormDetails?.questions || []).filter(
    (q) => q.type !== "section" && q.type !== "description",
  );
  const selectedFormObj = forms.find((f) => f.id === selectedFormId);
  const cInfo = selectedFormObj
    ? getClinicConfig(selectedFormObj.clinic_type || "general", clinics)
    : null;

  const displayThaiDate = (dateString) => {
    if (!dateString) return "";
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${parseInt(year) + 543}`;
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

  const pageTitle =
    currentFormDetails?.title ||
    (isInitialSetup
      ? "กำลังโหลด..."
      : filteredFormsList.length === 0
        ? "ไม่มีข้อมูลแบบฟอร์ม"
        : "กำลังโหลด...");
  const isPhone = useMediaQuery("(max-width: 760px)");
  const moreFilterCount = [
    clinicFilter !== "all" ? clinicFilter : "",
    faculty,
    risk,
    formStatusFilter !== "published" ? formStatusFilter : "",
  ].filter(Boolean).length;

  // Form and date range: visible in the filter row on a computer, inside
  // the filter menu on a phone so the queue starts in the first screen.
  const formAndDates = (
    <>
      <FilterSelect
        label="แบบฟอร์ม"
        className="cw-field--form"
        value={selectedFormId}
        onChange={setSelectedFormId}
        options={
          isInitialSetup
            ? [{ value: "", label: "กำลังโหลดแบบฟอร์ม..." }]
            : filteredFormsList.length > 0
              ? filteredFormsList.map((f) => ({
                  value: f.id,
                  label: f.title,
                }))
              : [{ value: "", label: "-- ไม่มีแบบฟอร์ม --" }]
        }
      />
      <div className="cw-field" role="group" aria-labelledby="cw-dates-label">
        <span id="cw-dates-label">ช่วงวันที่</span>
        <span className="cw-dates">
          <FiCalendar aria-hidden="true" />
          <span className="cw-date">
            <output aria-hidden="true">
              {displayThaiDate(startDate) || "วัน/เดือน/ปี"}
            </output>
            <input
              type="date"
              aria-label={`ตั้งแต่วันที่ ${displayThaiDate(startDate)}`}
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </span>
          <span>ถึง</span>
          <span className="cw-date">
            <output aria-hidden="true">
              {displayThaiDate(endDate) || "วัน/เดือน/ปี"}
            </output>
            <input
              type="date"
              aria-label={`ถึงวันที่ ${displayThaiDate(endDate)}`}
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => handleEndDateChange(e.target.value)}
              onClick={(e) => e.target.showPicker && e.target.showPicker()}
            />
          </span>
        </span>
      </div>
    </>
  );

  return (
    <div className="cw-wrapper">
      <main className="cw-page">
        <header className="cw-header">
          <div className="cw-header-text">
            <h1 title={pageTitle}>
              {pageTitle}
              {cInfo && <span className="cw-clinic-tag">{cInfo.text}</span>}
            </h1>
            <p>ระบบจัดการข้อมูลและติดตามเคสผู้รับบริการ</p>
          </div>
          <div className="cw-header-actions">
            <div className="cw-mode" role="group" aria-label="มุมมองรายการ">
              <button
                type="button"
                aria-pressed={tableViewMode === "master"}
                onClick={() => setTableViewMode("master")}
              >
                <FiUsers aria-hidden="true" /> ภาพรวมเคสผู้ป่วย
              </button>
              <button
                type="button"
                aria-pressed={tableViewMode === "form"}
                onClick={() => setTableViewMode("form")}
              >
                <FiList aria-hidden="true" /> คำตอบแบบฟอร์ม
              </button>
            </div>
            <button
              type="button"
              className="cw-btn-secondary"
              onClick={() => setIsExportModalOpen(true)}
            >
              <FiDownload aria-hidden="true" /> Export Excel
            </button>
            <button
              type="button"
              className="cw-btn"
              onClick={() => setIsCreateCaseModalOpen(true)}
            >
              <FiPlus aria-hidden="true" /> เพิ่มเคส
            </button>
          </div>
        </header>

        <section className="cw-surface" aria-label="รายการเคส">
          {tableViewMode === "master" && statusCounts.length > 0 && isPhone && (
            <label className="cw-field cw-status-select">
              <span>สถานะเคส</span>
              <select
                className="cw-select"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">ทั้งหมด ({scopedData.length})</option>
                {statusCounts.map(([status, count]) => (
                  <option key={status} value={status}>
                    {status === NEW_CASE ? "เคสใหม่" : status} ({count})
                  </option>
                ))}
              </select>
            </label>
          )}
          {tableViewMode === "master" &&
            statusCounts.length > 0 &&
            !isPhone && (
              <ul className="cw-strip" aria-label="กรองตามสถานะเคส">
                <li>
                  <button
                    type="button"
                    className="cw-chip"
                    aria-pressed={statusFilter === ""}
                    onClick={() => setStatusFilter("")}
                  >
                    ทั้งหมด <strong>{scopedData.length}</strong>
                  </button>
                </li>
                {statusCounts.map(([status, count]) => (
                  <li key={status}>
                    <button
                      type="button"
                      className="cw-chip"
                      aria-pressed={statusFilter === status}
                      onClick={() =>
                        setStatusFilter(statusFilter === status ? "" : status)
                      }
                    >
                      {status === NEW_CASE ? "เคสใหม่" : status}
                      <strong>{count}</strong>
                    </button>
                  </li>
                ))}
              </ul>
            )}

          <div className="cw-filters">
            <label className="cw-field cw-field--grow">
              <span>ค้นหา</span>
              <span className="cw-search">
                <FiSearch aria-hidden="true" />
                <input
                  type="search"
                  placeholder="ค้นหาชื่อ, Case ID หรือเลขบัตร"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </span>
            </label>
            {!isPhone && formAndDates}
            <FilterDropdown
              activeCount={moreFilterCount}
              label={isPhone ? "ตัวกรอง" : undefined}
            >
              {isPhone && formAndDates}
              <FilterSelect
                label="คลินิก"
                value={clinicFilter}
                onChange={setClinicFilter}
                options={[
                  { value: "all", label: "ทุกคลินิก" },
                  { value: "general", label: "ทั่วไป" },
                  ...clinics.map((c) => ({ value: c.slug, label: c.name })),
                ]}
              />
              <FilterSelect
                label="สำนักวิชา"
                value={faculty}
                onChange={setFaculty}
                options={[
                  { value: "", label: "ทุกสำนักวิชา" },
                  ...FACULTIES.map((f) => ({ value: f, label: f })),
                ]}
              />
              {hasScoring && (
                <FilterSelect
                  label="ระดับความเสี่ยง"
                  value={risk}
                  onChange={setRisk}
                  options={[
                    { value: "", label: "ทุกระดับความเสี่ยง" },
                    { value: "สูง", label: "เสี่ยงสูง" },
                    { value: "ปานกลาง", label: "เสี่ยงปานกลาง" },
                    { value: "ต่ำ", label: "เสี่ยงต่ำ" },
                  ]}
                />
              )}
              <FilterSelect
                label="สถานะฟอร์ม"
                value={formStatusFilter}
                onChange={setFormStatusFilter}
                options={[
                  { value: "published", label: "ฟอร์มที่เผยแพร่แล้ว" },
                  { value: "draft", label: "ฟอร์มฉบับร่าง/ซ่อนอยู่" },
                  { value: "all", label: "สถานะฟอร์มทั้งหมด" },
                ]}
              />
              {tableViewMode === "form" && allDynamicQuestions.length > 0 && (
                <fieldset className="cw-columns">
                  <legend>คอลัมน์ที่แสดง ({visibleColumns.length})</legend>
                  {allDynamicQuestions.map((q) => {
                    const cleanTitle = q.title
                      .replace(/<[^>]+>/g, "")
                      .replace(/&nbsp;/gi, " ")
                      .replace(/\s+/g, " ")
                      .trim();
                    return (
                      <label key={q.id} title={cleanTitle}>
                        <input
                          type="checkbox"
                          checked={visibleColumns.includes(q.id)}
                          onChange={() => toggleColumn(q.id)}
                        />
                        <span>{cleanTitle}</span>
                      </label>
                    );
                  })}
                </fieldset>
              )}
            </FilterDropdown>
          </div>

          {isPhone && (
            <p className="cw-result-note">
              ช่วงวันที่ {displayThaiDate(startDate)} –{" "}
              {displayThaiDate(endDate)}
            </p>
          )}

          <CaseTable
            data={filteredData}
            questions={currentFormDetails?.questions || []}
            visibleColumns={visibleColumns}
            isLoading={isLoading || isInitialSetup}
            onSelectCase={setSelectedCase}
            viewMode={tableViewMode}
            hasScoring={hasScoring}
            selectedId={selectedCase?.id}
          />

          {selectedCase && (
            <CaseDetailModal
              key={selectedCase.id}
              data={selectedCase}
              nav={caseNav}
              onClose={() => setSelectedCase(null)}
              onCaseUpdated={(updatedCase) => {
                setResponses((prev) =>
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
                  }),
                );
              }}
              onCaseDeleted={(deletedId) => {
                setResponses((prev) => prev.filter((r) => r.id !== deletedId));
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
                    เบอร์โทร: newCase.phone || "",
                    เลขบัตรประชาชน: newCase.citizenId || "",
                    คำนำหน้า: newCase.prefix || "",
                    สำนักวิชา: newCase.faculty || "",
                  };
                  const caseWithFormId = {
                    ...newCase,
                    form_id: selectedFormId || 1,
                    summary_data: {
                      display_name: newCase.name || "",
                      display_phone: newCase.phone || "",
                      display_faculty: newCase.faculty || "",
                      note: newCase.note || "",
                      raw_answers: customRawAnswers,
                    },
                  };
                  await createCase(caseWithFormId);
                  if (selectedFormId) {
                    const responseRes = await getFormResponses(selectedFormId, {
                      startDate,
                      endDate,
                      limit: "all",
                    });
                    const responseData = responseRes.data
                      ? responseRes.data
                      : responseRes;

                    if (Array.isArray(responseData)) {
                      const parsedResponses = responseData.map((r) => ({
                        ...r,
                        case_source: r.case_source || "assessment_form",
                        summary_data:
                          typeof r.summary_data === "string"
                            ? JSON.parse(r.summary_data)
                            : r.summary_data || {},
                      }));
                      setResponses(parsedResponses);
                    }
                  }

                  setIsCreateCaseModalOpen(false);

                  Swal.fire({
                    icon: "success",
                    title: "สำเร็จ",
                    text: "บันทึกเคสเรียบร้อยแล้ว",
                    confirmButtonColor: "#c2410c",
                  });
                } catch (err) {
                  console.error(err);
                  Swal.fire({
                    icon: "error",
                    title: "เกิดข้อผิดพลาด",
                    text: "ไม่สามารถบันทึกเคสได้",
                    confirmButtonColor: "#c2410c",
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
        </section>
      </main>
    </div>
  );
}
