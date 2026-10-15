import { toDisplayText } from '../../utils/textPresentation.js';
import {ExportButton} from "../ExcelExport";
import CaseActivity, { responseActivity, logActivity } from "./CaseActivity";
import { exportCaseData } from "../../services/api";
import "./CaseDetailModal.css";
import TemplateManagerModal from "./casedetail-childrens/TemplateManagerModal";
import CaseLeftPanel from "./casedetail-childrens/CaseLeftPanel";
import CaseHistoryTab from "./casedetail-childrens/CaseHistoryTab";
import CaseModals from "./casedetail-childrens/CaseModals";
import CaseActionTab from "./casedetail-childrens/CaseActionTab";
import CaseReferralPanel from "./CaseReferralPanel";

// 🟢 นำเข้า Utility Functions ที่เราแยกไฟล์ไว้
import {
  stripHtml,
  formatAnswer,
  generateCopyText,
  executeExportPDF,
} from "./casedetail-childrens/exportUtils";
import {
  groupLogsByDate,
  renderLogDetail,
} from "./casedetail-childrens/logUtils";

import CaseDrawer, { RiskPill, StatusPill } from "./CaseDrawer";
import Swal from "sweetalert2";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  getCaseLogs,
  addCaseLog,
  saveAppointment,
  getServices,
  createService,
  updateService,
  deleteService,
  getCaseAppointments,
  deleteCase,
  getStatusOptions,
  createStatusOption,
  deactivateStatusOption,
  getFormById,
  getNoteTemplates,
  getForms,
  getMasterCasesById,
  getPersonTimeline,
  closeMasterCase,
  updateClinicalData,
  generateSecureToken,
  getStaffs,
  createStaff,
  deleteStaff,
  getCaseAnswers,
} from "../../services/api";

import {
  FaTrashAlt,
  FaChevronDown,
  FaCheck,
  FaCog,
  FaShareSquare,
  FaArchive,
  FaPrint,
  FaClipboardList,
  FaCheckSquare,
} from "react-icons/fa";
import { FiEdit3, FiUser, FiCornerUpRight, FiClock } from "react-icons/fi";

const SYSTEM_STATUSES = [
  "รอติดต่อ (รอดำเนินการ)",
  "นัดหมายสำเร็จ",
  "ติดต่อไม่ได้ / ไม่รับสาย",
  "ขอเลื่อนนัด",
  "อยู่ระหว่างติดตามต่อเนื่อง",
  "ปฏิเสธบริการ",
  "ส่งต่อผู้เชี่ยวชาญ",
  "ปิดเคสเรียบร้อย",
];

export default function CaseDetailModal({
  data,
  onClose,
  onCaseUpdated,
  onCaseDeleted,
  nav,
}) {
  const summary = data?.summary_data || {};
  const scoreResults = useMemo(
    () => summary.score_results || [],
    [summary.score_results],
  );

  const displayName =
    summary.display_name && summary.display_name !== "-"
      ? summary.display_name
      : `CASE-${String(data?.id || "0").padStart(4, "0")}`;
  const submittedDate = data?.submitted_at
    ? new Date(data.submitted_at).toLocaleString("th-TH", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

  let defaultRisk = data?.risk_level || "ต่ำ";
  if (!data?.risk_level) {
    if (scoreResults.some((s) => s.color?.toLowerCase().includes("d93025")))
      defaultRisk = "สูง";
    else if (
      scoreResults.some(
        (s) =>
          s.color?.toLowerCase().includes("ff9800") ||
          s.color?.toLowerCase().includes("fbbc04"),
      )
    )
      defaultRisk = "ปานกลาง";
  }

  // Tabs of the drawer: follow-up actions, the person's data, history.
  const [activeTab, setActiveTab] = useState("action");

  const [historyLogs, setHistoryLogs] = useState([]);
  const [latestActivity, setLatestActivity] = useState(responseActivity(data));

  const [isManagingStatus, setIsManagingStatus] = useState(false);
  const [statusOptions, setStatusOptions] = useState([]);
  const [newStatusName, setNewStatusName] = useState("");
  const [savedStatus, setSavedStatus] = useState(data?.status || "");
  const [status, setStatus] = useState(savedStatus);

  const [staffOptions, setStaffOptions] = useState([]);
  const fetchStaffs = async () => {
    try {
      const res = await getStaffs();
      setStaffOptions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStaffs();
  }, []);

  useEffect(() => {
    if (data?.staff_id) {
      setSelectedStaff(data.staff_id);
    }
  }, [data]);

  const [isManagingStaff, setIsManagingStaff] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [savedStaff, setSavedStaff] = useState("");
  const [customStaff, setCustomStaff] = useState("");

  useEffect(() => {
    if (data?.staff_id) {
      setSelectedStaff(data.staff_id);
      setSavedStaff(data.staff_id);
    }
  }, [data]);

  // save ทุกครั้งที่ staffOptions เปลี่ยน
  useEffect(() => {
    localStorage.setItem("staffOptions", JSON.stringify(staffOptions));
  }, [staffOptions]);

  // กัน selected ค้าง
  useEffect(() => {
    if (selectedStaff && !staffOptions.some((s) => s.id === selectedStaff)) {
      setSelectedStaff("");
    }
  }, [staffOptions, selectedStaff]);

  const [savedRisk, setSavedRisk] = useState(defaultRisk);
  const [riskLevel, setRiskLevel] = useState(savedRisk);
  const [clinicalImpression, setClinicalImpression] = useState("");
  const [staffNote, setStaffNote] = useState("");
  const [patientVisible, setPatientVisible] = useState(false);

  const [clinicType, setClinicType] = useState(data?.clinic_type || "general");

  const [showSubMetrics, setShowSubMetrics] = useState(false);
  const [formQuestions, setFormQuestions] = useState([]);
  const [formRules, setFormRules] = useState([]);
  const [dynamicRisks, setDynamicRisks] = useState({});
  const [savedDynamicRisks, setSavedDynamicRisks] = useState({});
  const [editingRiskId, setEditingRiskId] = useState(null);
  const [tempRiskChange, setTempRiskChange] = useState({
    label: "",
    reason: "",
  });

  const [isAppointing, setIsAppointing] = useState(false);
  const [tempDate, setTempDate] = useState("");
  const [appointmentNo, setAppointmentNo] = useState(1);
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [isManagingService, setIsManagingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editingServiceName, setEditingServiceName] = useState("");

  const [clinicalData, setClinicalData] = useState({
    blood_test: "none",
    prep: "none",
  });
  const [savedClinicalData, setSavedClinicalData] = useState({
    blood_test: "none",
    prep: "none",
  });

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportCopySubmenu, setShowExportCopySubmenu] = useState(false);
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState(null);
  const [templateAnswers, setTemplateAnswers] = useState({});
  const [templateSessionNo, setTemplateSessionNo] = useState("");

  const [journeyResponses, setJourneyResponses] = useState([]);
  const [masterCaseInfo, setMasterCaseInfo] = useState(null);
  const [formsList, setFormsList] = useState([]);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [selectedFollowupForm, setSelectedFollowupForm] = useState("");
  const [followupLink, setFollowupLink] = useState("");
  const [showCloseCaseConfirm, setShowCloseCaseConfirm] = useState(false);

  const [showManageMenu, setShowManageMenu] = useState(false);
  const manageMenuRef = useRef(null);
  const exportMenuRef = useRef(null);

  const [leftViewMode, setLeftViewMode] = useState("profile");
  const [viewingResponseId, setViewingResponseId] = useState(data?.id);

  const viewedResponse = useMemo(() => {
    if (!journeyResponses || journeyResponses.length === 0) return data;
    return journeyResponses.find((r) => r.id === viewingResponseId) || data;
  }, [viewingResponseId, data, journeyResponses]);

  const [fullAnswersMap, setFullAnswersMap] = useState({});

  useEffect(() => {
    if (viewingResponseId) {
      getCaseAnswers(viewingResponseId)
        .then((res) => {
          const mapped = {};
          res.data.forEach((ans) => {
            mapped[ans.question_id] = ans.answer_value;
          });
          setFullAnswersMap(mapped);
        })
        .catch((err) => console.error("Failed to fetch full answers", err));
    }
  }, [viewingResponseId]);

  const handleAddStaff = async () => {
    if (!newStaffName.trim()) return;

    try {
      await createStaff({
        fullname: newStaffName,
      });

      await fetchStaffs();

      setNewStaffName("");

      showToast("เพิ่มผู้รับผิดชอบสำเร็จ");
    } catch (err) {
      console.error(err);
      showToast("เพิ่มไม่สำเร็จ");
    }
  };

  const handleDeleteStaff = async (id) => {
    try {
      await deleteStaff(id);

      setStaffOptions((prev) => prev.filter((s) => s.id !== id));

      if (selectedStaff === id) {
        setSelectedStaff("");
      }

      showToast("ลบผู้รับผิดชอบสำเร็จ");
    } catch (err) {
      console.error(err);
      showToast("ลบไม่สำเร็จ");
    }
  };

  const leftPanelSummary = viewedResponse?.summary_data || {};
  const leftPanelRawAnswers = useMemo(() => {
    const foundStaff = staffOptions.find((s) => s.id === selectedStaff);

    return {
      ...(leftPanelSummary.raw_answers || {}),
      สถานะเคส: status,
      ระดับความเสี่ยง: riskLevel,
      เจ้าหน้าที่: foundStaff
        ? foundStaff.fullname
        : staffOptions.find((s) => s.id === data.staff_id)?.fullname ||
          "เจ้าหน้าที่",
      คลินิก: clinicType,
    };
  }, [
    leftPanelSummary.raw_answers,
    status,
    riskLevel,
    clinicType,
    selectedStaff,
    staffOptions,
    data.staff_id,
  ]);
  const leftPanelScoreResults = useMemo(
    () => leftPanelSummary.score_results || [],
    [leftPanelSummary.score_results],
  );

  useEffect(() => {
    if (data?.id) {
      setViewingResponseId(data.id);
      setLeftViewMode("profile");
    }
  }, [data?.id]);

  useEffect(() => {
    let active = true;
    let personTimelineLoaded = false;
    setMasterCaseInfo(null);
    setJourneyResponses([]);
    getForms("latest")
      .then((res) => {
        if (active) setFormsList(res.data);
      })
      .catch(() => {});
    if (data?.master_case_id) {
      getMasterCasesById(data.master_case_id)
        .then((res) => {
          if (!active) return;
          if (!personTimelineLoaded)
            setJourneyResponses(res.data.responses || []);
          if (res.data.masterCases && res.data.masterCases.length > 0) {
            const masterData = res.data.masterCases[0];
            setMasterCaseInfo(masterData);
            if (masterData.overall_risk) {
              setRiskLevel(masterData.overall_risk);
              setSavedRisk(masterData.overall_risk);
            }
            if (masterData.clinical_data) {
              const cData =
                typeof masterData.clinical_data === "string"
                  ? JSON.parse(masterData.clinical_data)
                  : masterData.clinical_data;
              setClinicalData(cData || { blood_test: "none", prep: "none" });
              setSavedClinicalData(
                cData || { blood_test: "none", prep: "none" },
              );
            }
          }
        })
        .catch((err) => {
          if (!active) return;
          setMasterCaseInfo(null);
          if (!personTimelineLoaded) setJourneyResponses([]);
        });
      // The timeline shows the whole person file (every form and clinic). The
      // clinic actions above still work on this Master Case only. Once loaded,
      // the person timeline must win regardless of request completion order.
      getPersonTimeline(data.master_case_id)
        .then((res) => {
          if (!active) return;
          if (Array.isArray(res.data?.responses) && res.data.responses.length) {
            personTimelineLoaded = true;
            setJourneyResponses(res.data.responses);
          }
        })
        .catch(() => {});
    } else {
      setMasterCaseInfo(null);
      setJourneyResponses([]);
    }
    return () => {
      active = false;
    };
  }, [data?.master_case_id]);

  const handleSelectFollowup = async (formId) => {
    setSelectedFollowupForm(formId);
    if (!formId) {
      setFollowupLink("");
      return;
    }
    const baseUrl = window.location.origin;
    try {
      const res = await generateSecureToken({
        response_id: data.id,
        form_id: formId,
      });
      const link = res.data.link;
      setFollowupLink(link);
    } catch (err) {
      showToast("เกิดข้อผิดพลาด ไม่สามารถสร้างลิงก์ที่ปลอดภัยได้");
    }
  };

  const copyFollowupLink = () => {
    navigator.clipboard.writeText(followupLink);
    showToast("คัดลอกลิงก์เรียบร้อย ส่งให้คนไข้ได้เลย!");
    setShowFollowupModal(false);
  };

  useEffect(() => {
    const currentClinic =
      viewedResponse?.clinic_type || data?.clinic_type || "general";
    const currentFormId = viewedResponse?.form_id || data?.form_id;

    setClinicType(currentClinic);
    setShowSubMetrics(currentClinic === "behavior");

    if (currentFormId) {
      getFormById(currentFormId).then((res) => {
        const cType = res.data.clinic_type || currentClinic;
        setClinicType(cType);
        setShowSubMetrics(cType === "behavior");

        let q = res.data.questions;
        if (typeof q === "string") q = JSON.parse(q);

        setFormQuestions(q);

        const scoredQs = q.filter((x) => x.isScored);
        const rules = scoredQs.map((x) => ({
          id: x.id,
          title: x.title,
          rules: x.scoringRules || [],
        }));
        setFormRules(rules);
      });
    }
  }, [
    viewedResponse?.form_id,
    viewedResponse?.clinic_type,
    data?.form_id,
    data?.clinic_type,
  ]);

  useEffect(() => {
    if (scoreResults && scoreResults.length > 0) {
      const initRisks = {};
      scoreResults.forEach((sr) => {
        initRisks[sr.question_id] = {
          label: sr.label,
          color: sr.color,
          advice: sr.advice,
          title: sr.title,
          reason: "",
        };
      });
      setDynamicRisks(initRisks);
      setSavedDynamicRisks(initRisks);
    }
  }, [scoreResults]);

  const handleDynamicRiskChange = (qId, ruleObj, qTitle, reasonText) => {
    const newRisks = {
      ...dynamicRisks,
      [qId]: {
        label: ruleObj.label,
        color: ruleObj.color,
        advice: ruleObj.advice,
        title: qTitle,
        reason: reasonText,
      },
    };
    setDynamicRisks(newRisks);
  };

  const fetchStatusList = useCallback(async () => {
    try {
      const res = await getStatusOptions(clinicType);
      let options = res.data;
      if (savedStatus && !options.some((o) => o.name === savedStatus)) {
        options = [
          { id: "legacy", name: savedStatus, color: "#94a3b8" },
          ...options,
        ];
      }
      setStatusOptions(options);
      if (!savedStatus && options.length > 0) setStatus(options[0].name);
    } catch (err) {
      if (err.response?.status === 404)
        setStatusOptions(
          SYSTEM_STATUSES.map((name, idx) => ({
            id: `local-${idx}`,
            name: name,
          })),
        );
    }
  }, [savedStatus, clinicType]);

  const fetchServicesList = useCallback(async () => {
    try {
      const res = await getServices();
      setServices(res.data);
      if (res.data.length > 0 && !selectedServiceId)
        setSelectedServiceId(res.data[0].id);
    } catch (err) {}
  }, [selectedServiceId]);

  const fetchData = useCallback(async () => {
    if (!data?.id) return;
    try {
      const targetId = masterCaseInfo ? masterCaseInfo.id : data.id;
      const targetType = masterCaseInfo ? "master" : "response";
      const logsRes = await getCaseLogs(targetId, targetType);
      const activity = logActivity(logsRes.data, data);
      setLatestActivity(activity);
      setHistoryLogs(
        logsRes.data.map((log) => ({
          id: log.id,
          type: log.type,
          date: new Date(log.created_at),
          staff: log.staff,
          detail: log.detail,
        })),
      );
      const apptRes = await getCaseAppointments(targetId, targetType).catch(() => ({ data: [] }));
      setAppointmentNo(apptRes.data.length + 1);
      await fetchServicesList();
      return activity;
    } catch (err) {}
  }, [data?.id, masterCaseInfo, fetchServicesList]);

  useEffect(() => {
    fetchData();
    fetchStatusList();
  }, [fetchData, fetchStatusList]);

  const handleAddStatus = async () => {
    if (!newStatusName.trim()) return;
    try {
      await createStatusOption({
        name: newStatusName.trim(),
        clinic_type: clinicType,
      });
      const currentName = newStatusName.trim();
      setNewStatusName("");
      const res = await getStatusOptions(clinicType);
      setStatusOptions(res.data);
      setStatus(currentName);
      showToast("เพิ่มสถานะใหม่เรียบร้อย");
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "เพิ่มสถานะไม่สำเร็จ",
        text: err.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const handleDeleteStatus = async (id, name) => {
    const result = await Swal.fire({
      title: "ยกเลิกสถานะ?",
      text: `ยืนยันการเลิกใช้งานสถานะ "${name}"? (ข้อมูลเก่าจะไม่หายไป)`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
    });
    if (result.isConfirmed) {
      try {
        await deactivateStatusOption(id);
        await fetchStatusList();
        showToast("เลิกใช้งานสถานะแล้ว");
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ไม่สามารถยกเลิกได้ในขณะนี้",
        });
      }
    }
  };

  const handleAddService = async () => {
    if (!newServiceName.trim()) return;
    try {
      const res = await createService({ name: newServiceName.trim() });
      const newService = { id: res.data.id, name: newServiceName.trim() };
      setServices([...services, newService]);
      setSelectedServiceId(newService.id);
      setNewServiceName("");
      showToast("เพิ่มบริการสำเร็จ");
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "เพิ่มบริการไม่สำเร็จ",
        text: err.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const handleEditService = async (id) => {
    if (!editingServiceName.trim()) return;
    try {
      await updateService(id, { name: editingServiceName.trim() });
      setServices(
        services.map((s) =>
          s.id === id ? { ...s, name: editingServiceName.trim() } : s,
        ),
      );
      setEditingServiceId(null);
      showToast("แก้ไขบริการสำเร็จ");
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "แก้ไขบริการไม่สำเร็จ",
        text: err.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const handleDeleteService = async (id, name) => {
    const result = await Swal.fire({
      title: "ลบบริการ?",
      text: `ยืนยันการลบบริการ "${name}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
    });
    if (result.isConfirmed) {
      try {
        await deleteService(id);
        setServices(services.filter((s) => s.id !== id));
        if (selectedServiceId === id)
          setSelectedServiceId(services[0]?.id || "");
        showToast("ลบบริการสำเร็จ");
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "ลบไม่ได้",
          text: "อาจมีการนัดหมายที่ใช้บริการนี้อยู่",
        });
      }
    }
  };

  const handleDeleteCase = async () => {
    try {
      setIsDeleting(true);
      await deleteCase(data.id);
      showToast("ลบเคสสำเร็จแล้ว!");
      setTimeout(() => {
        if (onCaseDeleted) onCaseDeleted(data.id);
      }, 800);
    } catch (err) {
      await Swal.fire({
        icon: "error",
        title: "ลบเคสไม่สำเร็จ",
        text: err.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#f47932",
      });
      setIsDeleting(false);
    }
  };

  const handleCloseMasterCase = async () => {
    if (!masterCaseInfo || !masterCaseInfo.id) {
      return Swal.fire({
        icon: "error",
        title: "ข้อผิดพลาด",
        text: "ไม่พบข้อมูล Master Case",
      });
    }
    try {
      setIsDeleting(true);
      const staffName = getCurrentStaff();
      await closeMasterCase(masterCaseInfo.id, { staff: staffName });
      await addCaseLog(data.id, {
        master_case_id: masterCaseInfo.id,
        type: "status",
        staff: staffName,
        detail: `🔒 ทำการปิดเคสการรักษา (Closed Case)`,
        status: "ปิดเคสเรียบร้อย",
        risk_level: riskLevel,
      });
      showToast("ปิดเคสสำเร็จแล้ว");
      setShowCloseCaseConfirm(false);
      setMasterCaseInfo({ ...masterCaseInfo, status: "Closed" });
      setStatus("ปิดเคสเรียบร้อย");
      setSavedStatus("ปิดเคสเรียบร้อย");
      const latest_activity = await fetchData();
      if (onCaseUpdated)
        onCaseUpdated({
          latest_activity,
          id: data.id,
          master_case_id: masterCaseInfo.id,
          status: "ปิดเคสเรียบร้อย",
          overall_risk: riskLevel,
          risk_level: data.risk_level,
        });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "ข้อผิดพลาด",
        text: "ไม่สามารถปิดเคสได้",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getCurrentStaff = () => {
    const found = staffOptions.find((s) => s.id === selectedStaff);

    return found?.fullname || "เจ้าหน้าที่";
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3000);
  };

  const handleSaveAll = async () => {
    if (isAppointing && (!tempDate || !selectedServiceId)) {
      return Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบ",
        text: "กรุณาระบุวันที่และเลือกบริการนัดหมายให้ครบถ้วน",
      });
    }
    const isStatusChanged = status !== savedStatus;
    const isStaffChanged = selectedStaff !== savedStaff;
    const isOverallRiskChanged = riskLevel !== savedRisk;
    const hasImpression = clinicalImpression.trim() !== "";
    const hasNote = staffNote.trim() !== "";
    const isClinicalDataChanged =
      clinicalData.blood_test !== savedClinicalData.blood_test ||
      clinicalData.prep !== savedClinicalData.prep;

    const subRiskChanges = [];
    const newSavedDynamicRisks = { ...savedDynamicRisks };

    Object.keys(dynamicRisks).forEach((qId) => {
      const current = dynamicRisks[qId];
      const saved = savedDynamicRisks[qId];
      if (saved && current.label !== saved.label) {
        subRiskChanges.push(
          `ประเมินย่อย: "${stripHtml(current.title)}" | ${saved.label} ➔ ${current.label} | เหตุผล: ${current.reason || "ไม่ได้ระบุ"}`,
        );
        newSavedDynamicRisks[qId] = { ...current, reason: "" };
      }
    });
    const isDynamicChanged = subRiskChanges.length > 0;

    if (
      !isStatusChanged &&
      !isStaffChanged &&
      !isOverallRiskChanged &&
      !hasImpression &&
      !hasNote &&
      !isAppointing &&
      !isDynamicChanged &&
      !isClinicalDataChanged
    ) {
      return Swal.fire({
        icon: "info",
        title: "ไม่มีการเปลี่ยนแปลง",
        text: "ไม่มีข้อมูลใหม่ให้บันทึก",
      });
    }

    try {
      const staffName = getCurrentStaff();
      const targetMasterId = masterCaseInfo?.id || null;

      // isStaffChanged must be included: the log request is also what persists
      // staff_id on the response, otherwise a staff-only change is lost.
      if (
        isStatusChanged ||
        isStaffChanged ||
        isOverallRiskChanged ||
        hasImpression ||
        isDynamicChanged ||
        isClinicalDataChanged
      ) {
        const logParts = [];
        if (isStatusChanged)
          logParts.push(
            `เปลี่ยนสถานะ: "${savedStatus || "ไม่ได้ระบุ"}" ➔ "${status}"`,
          );
        if (isStaffChanged) {
          const oldStaff = staffOptions.find((s) => s.id === savedStaff);
          const newStaff = staffOptions.find((s) => s.id === selectedStaff);

          logParts.push(
            `เปลี่ยนผู้รับผิดชอบ: "${oldStaff?.fullname || "-"}" ➔ "${newStaff?.fullname || "-"}"`,
          );
        }
        if (isOverallRiskChanged)
          logParts.push(
            `เปลี่ยนความเสี่ยงรวม: "${savedRisk}" ➔ "${riskLevel}"`,
          );
        if (isDynamicChanged) logParts.push(...subRiskChanges);

        if (isClinicalDataChanged) {
          const btLabels = {
            none: "ยังไม่มีข้อมูล",
            negative: "Negative",
            positive: "Positive",
          };
          const prepLabels = {
            none: "ไม่ได้รับ",
            prep_with_blood: "รับยา (เจาะเลือดที่นี่)",
            prep_without_blood: "รับยา (มีประวัติตรวจแล้ว)",
          };
          if (clinicalData.blood_test !== savedClinicalData.blood_test)
            logParts.push(
              `ผลเจาะเลือด: ${btLabels[savedClinicalData.blood_test] || "ยังไม่มีข้อมูล"} ➔ ${btLabels[clinicalData.blood_test] || "ยังไม่มีข้อมูล"}`,
            );
          if (clinicalData.prep !== savedClinicalData.prep)
            logParts.push(
              `การรับยา PrEP: ${prepLabels[savedClinicalData.prep] || "ไม่ได้รับ"} ➔ ${prepLabels[clinicalData.prep] || "ไม่ได้รับ"}`,
            );
          if (targetMasterId)
            await updateClinicalData(targetMasterId, {
              clinical_data: clinicalData,
            });
        }

        if (hasImpression)
          logParts.push(`ข้อบ่งชี้ทางคลินิก: ${clinicalImpression.trim()}`);
        const logDetailString = logParts.join(" ⟡ ");

        await addCaseLog(data.id, {
          master_case_id: targetMasterId,
          type: "status",
          staff: getCurrentStaff(),
          staff_id: selectedStaff ? Number(selectedStaff) : null,
          detail: logDetailString,
          status,
          risk_level: riskLevel,
        });
        setSavedStatus(status);
        setSavedStaff(selectedStaff);
        setSavedRisk(riskLevel);
        setSavedDynamicRisks(newSavedDynamicRisks);
        setSavedClinicalData(clinicalData);
        setClinicalImpression("");

        const clearedDynamicRisks = {};
        Object.keys(newSavedDynamicRisks).forEach((k) => {
          clearedDynamicRisks[k] = { ...newSavedDynamicRisks[k], reason: "" };
        });
        setDynamicRisks(clearedDynamicRisks);
      }

      if (hasNote) {
        const formattedNote = staffNote
          .split("\n")
          .filter((line) => line.trim() !== "")
          .join("\n");
        let detailWithSession = formattedNote;

        if (activeTemplate && templateSessionNo) {
          detailWithSession = formattedNote.replace(
            `[สรุป LSM] ${activeTemplate.label}`,
            `[สรุป LSM ครั้งที่ ${templateSessionNo}] ${activeTemplate.label}`,
          );
        }
        await addCaseLog(data.id, {
          master_case_id: targetMasterId,
          type: "note",
          patient_visible: patientVisible,
          staff: getCurrentStaff(),
          staff_id: selectedStaff ? Number(selectedStaff) : null,
          detail: detailWithSession,
          template_id: activeTemplate?.id || null,
          answers: activeTemplate ? JSON.stringify(templateAnswers) : null,
          template_text: activeTemplate?.text || null,
          session_no: templateSessionNo || null,
        });
      }

      if (isAppointing) {
        let finalSqlDate = tempDate.replace("T", " ");
        if (finalSqlDate.split(":").length === 2) finalSqlDate += ":00";
        const serviceObj = services.find(
          (s) => String(s.id) === String(selectedServiceId),
        );
        await saveAppointment({
          case_id: data.id,
          master_case_id: targetMasterId,
          service_id: selectedServiceId,
          appointment_no: appointmentNo,
          appointment_date: finalSqlDate,
          staff: staffName,
          note: staffNote,
        });
        await addCaseLog(data.id, {
          master_case_id: targetMasterId,
          type: "appoint",
          staff: staffName,
          detail: `ลงคิวนัดหมายครั้งที่ ${appointmentNo} [${serviceObj ? serviceObj.name : "ไม่ระบุบริการ"}]`,
        });
      }

      setStaffNote("");
      setIsAppointing(false);
      setTempDate("");
      const latest_activity = await fetchData();
      if (onCaseUpdated)
        onCaseUpdated({
          latest_activity,
          id: data.id,
          master_case_id: targetMasterId,
          status: status,
          overall_risk: riskLevel,
          risk_level: data.risk_level,
          staff_id: selectedStaff ? Number(selectedStaff) : null,
        });

      setActiveTab("history");
      Swal.fire({
        icon: "success",
        title: "สำเร็จ",
        text: "บันทึกข้อมูลเรียบร้อยแล้ว",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "ข้อผิดพลาด",
        text: "เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง",
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target))
        setShowManageMenu(false);
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
        setShowExportCopySubmenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [copySelections, setCopySelections] = useState({
    includeScores: true,
    includeNote: true,
    selectedQuestions: Object.keys(leftPanelRawAnswers),
  });

  useEffect(() => {
    setCopySelections((prev) => ({
      ...prev,
      selectedQuestions: Object.keys(leftPanelRawAnswers),
    }));
  }, [leftPanelRawAnswers]);

  const toggleQuestionCheck = (qTitle) => {
    setCopySelections((prev) => ({
      ...prev,
      selectedQuestions: prev.selectedQuestions.includes(qTitle)
        ? prev.selectedQuestions.filter((q) => q !== qTitle)
        : [...prev.selectedQuestions, qTitle],
    }));
  };

  const authorizedExport = async (format) => {
    try {
      const { data: exported } = await exportCaseData(
        viewedResponse?.id || data.id,
        format,
      );
      const record = exported.case;
      return {
        viewedResponse: record,
        data: record,
        displayName: record.summary_data?.display_name || "",
        leftPanelSummary: record.summary_data || {},
        leftPanelRawAnswers: record.summary_data?.raw_answers || {},
        leftPanelScoreResults: record.summary_data?.score_results || [],
        riskLevel: record.risk_level,
        status: record.status,
        staffNote: exported.logs[0]?.detail || "",
      };
    } catch (error) {
      await Swal.fire({
        icon: "error",
        title: "ส่งออกไม่สำเร็จ",
        text:
          error.response?.data?.message ||
          "ไม่สามารถตรวจสิทธิ์และบันทึกการส่งออกได้",
      });
      return null;
    }
  };
  const handleCopyAll = async () => {
    const exported = await authorizedExport("copy");
    if (!exported) return;
    const text = generateCopyText({
      selections: {
        includeScores: true,
        includeNote: true,
        selectedQuestions: Object.keys(leftPanelRawAnswers),
      },
      viewedResponse,
      leftPanelRawAnswers,
      leftPanelScoreResults,
      riskLevel,
      staffNote,
      status,
      currentStaff: getCurrentStaff(),
      ...exported,
    });
    navigator.clipboard.writeText(text);
    setShowExportMenu(false);
    setShowExportCopySubmenu(false);
    showToast("คัดลอกทั้งหมดแล้ว!");
  };

  const handleCopySelected = async () => {
    const exported = await authorizedExport("copy");
    if (!exported) return;
    const text = generateCopyText({
      selections: copySelections,
      viewedResponse,
      leftPanelRawAnswers,
      leftPanelScoreResults,
      riskLevel,
      staffNote,
      status,
      currentStaff: getCurrentStaff(),
      ...exported,
    });
    navigator.clipboard.writeText(text);
    setShowSelectModal(false);
    showToast("คัดลอกข้อมูลที่เลือกแล้ว!");
  };

  const onExportPDF = async () => {
    const targetWindow = window.open("", "_blank", "width=800,height=900");
    const exported = await authorizedExport("pdf");
    if (!exported) {
      targetWindow?.close();
      return;
    }
    executeExportPDF({
      displayName,
      viewedResponse,
      data,
      leftPanelSummary,
      leftPanelRawAnswers,
      leftPanelScoreResults,
      riskLevel,
      status,
      currentStaff: getCurrentStaff(),
      submittedDate,
      showToast,
      setShowExportMenu,
      setShowExportCopySubmenu,
      ...exported,
      targetWindow,
    });
  };

  const fetchTemplates = useCallback(async () => {
    if (!clinicType) return;
    try {
      const res = await getNoteTemplates(clinicType);
      setTemplates(res.data);
    } catch (err) {}
  }, [clinicType]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSelectTemplate = (tpl) => {
    try {
      const questions = JSON.parse(tpl.text);
      setActiveTemplate({ ...tpl, questions });
      const initialAnswers = {};
      questions.forEach((q, i) => {
        if (q.defaultValue) {
          initialAnswers[i] = q.defaultValue;
        }
        if (q.hasComment && q.defaultComment)
          initialAnswers[`note-${i}`] = q.defaultComment;
      });
      setTemplateAnswers(initialAnswers);
      setTemplateSessionNo("");
    } catch (e) {
      const legacyQs = tpl.text
        .split("\n")
        .map((q, i) => ({ id: i, title: q, type: "text" }));
      setActiveTemplate({ ...tpl, questions: legacyQs });
      setTemplateAnswers({});
      setTemplateSessionNo("");
    }
  };

  const finalizeTemplate = () => {
    if (!activeTemplate) return;
    const sessionText = templateSessionNo
      ? ` ครั้งที่ ${templateSessionNo}`
      : "";
    let finalNote = `📌 [สรุป LSM${sessionText}] ${activeTemplate.label}\n`;

    const numbers = {};
    const childCounts = {};
    let mainCount = 0;

    activeTemplate.questions.forEach((q) => {
      if (q.parentId) {
        childCounts[q.parentId] = (childCounts[q.parentId] || 0) + 1;
        numbers[q.id] = `${numbers[q.parentId]}.${childCounts[q.parentId]}`;
      } else {
        mainCount++;
        numbers[q.id] = mainCount.toString();
      }
    });
    activeTemplate.questions.forEach((q, i) => {
      const ans = templateAnswers[i] || "-";
      const amt = templateAnswers[`amt-${i}`];
      const note = templateAnswers[`note-${i}`];
      const displayNum = numbers[q.id] || "";
      const level = displayNum.split(".").length - 1;
      const indent = "   ".repeat(level);

      let line = `${indent}${displayNum}. ${q.title}`;
      if (q.type !== "header") line += ` : ${ans}`;

      if (amt) {
        line += ` (จำนวน: ${amt}${q.amountUnit ? ` ${q.amountUnit}` : ""})`;
      }
      let notePart = "";
      if (note && note.trim() !== "" && note.trim() !== "-") {
        notePart = `\n${indent}   ↳ หมายเหตุ: ${note.trim()}`;
      }

      finalNote += line + notePart + "\n";
    });

    setStaffNote((prev) => prev + (prev ? "\n" : "") + finalNote);
    setActiveTemplate(null);
    setTemplateAnswers({});
  };

  const overallOptions = (() => {
    if (!scoreResults || scoreResults.length === 0)
      return [
        { label: "ต่ำ", color: "#10b981" },
        { label: "ปานกลาง", color: "#f59e0b" },
        { label: "สูง", color: "#ef4444" },
      ];
    const bmiScore = scoreResults.find((s) =>
      (s.title || "").toLowerCase().includes("bmi"),
    );
    if (bmiScore) {
      const ruleSource = formRules.find((f) => f.id === bmiScore.question_id);
      if (ruleSource?.rules?.length > 0)
        return ruleSource.rules.map((r) => ({
          label: r.label,
          color: r.color || "#64748b",
        }));
      return [{ label: bmiScore.label, color: bmiScore.color || "#64748b" }];
    }
    const first = scoreResults[0];
    const ruleSource = formRules.find((f) => f.id === first.question_id);
    if (ruleSource?.rules?.length > 0)
      return ruleSource.rules.map((r) => ({
        label: r.label,
        color: r.color || "#64748b",
      }));
    return scoreResults.map((s) => ({
      label: s.label,
      color: s.color || "#64748b",
    }));
  })();

  const relevantForms = useMemo(() => {
    if (!formsList) return [];
    return formsList.filter(
      (f) =>
        (f.clinic_type === clinicType || f.clinic_type === "general") &&
        f.status === "published",
    );
  }, [formsList, clinicType]);

  const groupedLogs = groupLogsByDate(historyLogs);

  // Where the case stands in the follow-up, derived from what is saved.
  // Steps are sequential: a later step only counts once the earlier ones
  // are done. An unreachable person is an attempted contact, not a contact.
  const isClosed =
    masterCaseInfo?.status === "Closed" || savedStatus === "ปิดเคสเรียบร้อย";
  const REACHED = [
    "นัดหมายสำเร็จ",
    "ขอเลื่อนนัด",
    "อยู่ระหว่างติดตามต่อเนื่อง",
    "ส่งต่อผู้เชี่ยวชาญ",
    "ปฏิเสธบริการ",
    "ปิดเคสเรียบร้อย",
  ];
  const contactAttempted =
    !isClosed && savedStatus === "ติดต่อไม่ได้ / ไม่รับสาย";
  const reached = {
    contact: isClosed || REACHED.includes(savedStatus),
    note: isClosed || historyLogs.some((log) => log.type === "note"),
    appoint:
      isClosed ||
      historyLogs.some((log) => log.type === "appoint") ||
      [
        "นัดหมายสำเร็จ",
        "ส่งต่อผู้เชี่ยวชาญ",
        "อยู่ระหว่างติดตามต่อเนื่อง",
      ].includes(savedStatus),
    close: isClosed,
  };
  const STEP_DEFS = [
    { id: "contact", label: "ติดต่อ", target: "case-step-contact" },
    { id: "note", label: "บันทึกติดตาม", target: "case-step-note" },
    { id: "appoint", label: "นัด/ส่งต่อ", target: "case-step-appoint" },
    { id: "close", label: "ปิดเคส" },
  ];
  const steps = STEP_DEFS.reduce((list, step) => {
    const previousDone = list.every((item) => item.done);
    return [...list, { ...step, done: previousDone && reached[step.id] }];
  }, []);
  const currentStep = steps.find((step) => !step.done)?.id;
  const goToStep = (step) => {
    if (step.id === "close") {
      if (masterCaseInfo?.status === "Open") setShowCloseCaseConfirm(true);
      return;
    }
    setActiveTab("action");
    requestAnimationFrame(() => {
      const section = document.getElementById(step.target);
      if (!section) return;
      section.scrollIntoView({ block: "start", behavior: "smooth" });
      section.querySelector("select, input, textarea, button")?.focus({
        preventScroll: true,
      });
    });
  };

  const caseCode = data?.master_case_id
    ? `MC-${String(data.master_case_id).padStart(4, "0")}`
    : `CASE-${String(data?.id || "0").padStart(4, "0")}`;
  const canManage = !masterCaseInfo || masterCaseInfo.status === "Open";
  const closeMenus = () => {
    setShowManageMenu(false);
    setShowExportMenu(false);
    setShowExportCopySubmenu(false);
  };
  const menuKeys = (event) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeMenus();
      event.currentTarget.parentElement?.querySelector("button")?.focus();
    }
  };

  const tabPanels = {
    referrals: <CaseReferralPanel sourceResponseId={data.id} />,
    profile: (
      <CaseLeftPanel
        leftViewMode={leftViewMode}
        setLeftViewMode={setLeftViewMode}
        viewingResponseId={viewingResponseId}
        setViewingResponseId={setViewingResponseId}
        journeyResponses={journeyResponses}
        data={data}
        scoreResults={leftPanelScoreResults}
        rawAnswers={leftPanelRawAnswers}
        stripHtml={stripHtml}
        formatAnswer={formatAnswer}
        formQuestions={formQuestions}
        selectedStaff={selectedStaff}
        staffOptions={staffOptions}
        fullAnswers={fullAnswersMap}
      />
    ),
    action: (
      <CaseActionTab
        masterCaseInfo={masterCaseInfo}
        selectedStaff={selectedStaff}
        setSelectedStaff={setSelectedStaff}
        staffList={staffOptions}
        customStaff={customStaff}
        setCustomStaff={setCustomStaff}
        isManagingStatus={isManagingStatus}
        setIsManagingStatus={setIsManagingStatus}
        status={status}
        setStatus={setStatus}
        statusOptions={statusOptions}
        handleDeleteStatus={handleDeleteStatus}
        newStatusName={newStatusName}
        setNewStatusName={setNewStatusName}
        handleAddStatus={handleAddStatus}
        formRules={formRules}
        showSubMetrics={showSubMetrics}
        setShowSubMetrics={setShowSubMetrics}
        dynamicRisks={dynamicRisks}
        scoreResults={scoreResults}
        editingRiskId={editingRiskId}
        setEditingRiskId={setEditingRiskId}
        tempRiskChange={tempRiskChange}
        setTempRiskChange={setTempRiskChange}
        handleDynamicRiskChange={handleDynamicRiskChange}
        overallOptions={overallOptions}
        riskLevel={riskLevel}
        setRiskLevel={setRiskLevel}
        clinicalImpression={clinicalImpression}
        setClinicalImpression={setClinicalImpression}
        clinicType={clinicType}
        setIsManagingTemplates={setIsManagingTemplates}
        activeTemplate={activeTemplate}
        setActiveTemplate={setActiveTemplate}
        templates={templates}
        handleSelectTemplate={handleSelectTemplate}
        templateAnswers={templateAnswers}
        setTemplateAnswers={setTemplateAnswers}
        finalizeTemplate={finalizeTemplate}
        staffNote={staffNote}
        patientVisible={patientVisible}
        setPatientVisible={setPatientVisible}
        setStaffNote={setStaffNote}
        isAppointing={isAppointing}
        setIsAppointing={setIsAppointing}
        appointmentNo={appointmentNo}
        setAppointmentNo={setAppointmentNo}
        tempDate={tempDate}
        setTempDate={setTempDate}
        isManagingService={isManagingService}
        setIsManagingService={setIsManagingService}
        selectedServiceId={selectedServiceId}
        setSelectedServiceId={setSelectedServiceId}
        services={services}
        editingServiceId={editingServiceId}
        setEditingServiceId={setEditingServiceId}
        editingServiceName={editingServiceName}
        setEditingServiceName={setEditingServiceName}
        handleEditService={handleEditService}
        handleDeleteService={handleDeleteService}
        newServiceName={newServiceName}
        setNewServiceName={setNewServiceName}
        handleAddService={handleAddService}
        handleSaveAll={handleSaveAll}
        stripHtml={stripHtml}
        clinicalData={clinicalData}
        setClinicalData={setClinicalData}
        templateSessionNo={templateSessionNo}
        setTemplateSessionNo={setTemplateSessionNo}
        groupedLogs={groupedLogs}
        staffOptions={staffOptions}
        setStaffOptions={setStaffOptions}
        isManagingStaff={isManagingStaff}
        setIsManagingStaff={setIsManagingStaff}
        newStaffName={newStaffName}
        setNewStaffName={setNewStaffName}
        handleAddStaff={handleAddStaff}
        handleDeleteStaff={handleDeleteStaff}
      />
    ),
    history: (
      <CaseHistoryTab
        groupedLogs={groupedLogs}
        renderLogDetail={renderLogDetail}
        staffOptions={staffOptions}
      />
    ),
  };

  return (
    <CaseDrawer
      title={displayName}
      meta={`${caseCode} · ฟอร์มล่าสุดเข้าระบบเมื่อ ${submittedDate} น. · Response ID: RE-${String(data?.id || "0").padStart(4, "0")}`}
      nav={nav}
      onClose={onClose}
      badges={
        <>
          {(!masterCaseInfo || masterCaseInfo.status !== "Open") && (
            <span className="cw-case-state">
              {masterCaseInfo ? "ปิดเคสแล้ว" : "เคสทั่วไป (Legacy)"}
            </span>
          )}
          <RiskPill risk={savedRisk} label={`ความเสี่ยง ${savedRisk || "-"}`} />
          <StatusPill status={savedStatus} />
        </>
      }
      tools={
        <>
          <div className="cw-menu" ref={manageMenuRef}>
            <button
              type="button"
              className="cw-btn-secondary"
              aria-haspopup="true"
              aria-expanded={showManageMenu}
              onClick={() => {
                setShowManageMenu(!showManageMenu);
                setShowExportMenu(false);
              }}
            >
              <FaCog aria-hidden="true" /> จัดการเคส
              <FaChevronDown aria-hidden="true" className="cw-caret" />
            </button>
            {showManageMenu && (
              <ul className="cw-menu-list" onKeyDown={menuKeys}>
                {canManage && (
                  <li>
                    <button
                      type="button"
                      className="cw-menu-item"
                      onClick={() => {
                        setShowFollowupModal(true);
                        closeMenus();
                      }}
                    >
                      <FaShareSquare aria-hidden="true" /> ส่งแบบประเมินให้คนไข้
                    </button>
                  </li>
                )}
                {masterCaseInfo?.status === "Open" && (
                  <li>
                    <button
                      type="button"
                      className="cw-menu-item"
                      onClick={() => {
                        setShowCloseCaseConfirm(true);
                        closeMenus();
                      }}
                    >
                      <FaArchive aria-hidden="true" /> สิ้นสุดการรักษา (ปิดเคส)
                    </button>
                  </li>
                )}
                <li className="cw-menu-sep" role="separator" />
                <li>
                  <button
                    type="button"
                    className="cw-menu-item is-danger"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      closeMenus();
                    }}
                  >
                    <FaTrashAlt aria-hidden="true" /> ลบแบบประเมินนี้ทิ้ง
                  </button>
                </li>
              </ul>
            )}
          </div>
          <div className="cw-menu" ref={exportMenuRef}>
            <button
              type="button"
              className="cw-btn-secondary"
              aria-haspopup="true"
              aria-expanded={showExportMenu}
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowExportCopySubmenu(false);
                setShowManageMenu(false);
              }}
            >
              <FaPrint aria-hidden="true" /> ส่งออก
              <FaChevronDown aria-hidden="true" className="cw-caret" />
            </button>
            {showExportMenu && (
              <ul className="cw-menu-list" onKeyDown={menuKeys}>
                <li>
                  <button
                    type="button"
                    className="cw-menu-item"
                    onClick={onExportPDF}
                  >
                    <FaPrint aria-hidden="true" /> ปริ้น / ส่งออก PDF
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cw-menu-item"
                    onClick={handleCopyAll}
                  >
                    <FaClipboardList aria-hidden="true" /> คัดลอกทั้งหมด
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="cw-menu-item"
                    onClick={() => {
                      closeMenus();
                      setShowSelectModal(true);
                    }}
                  >
                    <FaCheckSquare aria-hidden="true" /> คัดลอกเฉพาะข้อที่เลือก
                  </button>
                </li>
              </ul>
            )}
          </div>
        </>
      }
      steps={
        <ol className="cw-steps" aria-label="ขั้นตอนการติดตามเคส">
          {steps.map((step, index) => (
            <li key={step.id} className={step.done ? "is-complete" : undefined}>
              <button
                type="button"
                className={`cw-step ${step.done ? "is-done" : ""} ${currentStep === step.id ? "is-current" : ""} ${step.id === "contact" && contactAttempted ? "is-attempted" : ""}`}
                aria-current={currentStep === step.id ? "step" : undefined}
                disabled={
                  step.id === "close" && masterCaseInfo?.status !== "Open"
                }
                onClick={() => goToStep(step)}
              >
                <span className="cw-step-mark" aria-hidden="true">
                  {step.done ? (
                    <FaCheck />
                  ) : step.id === "contact" && contactAttempted ? (
                    "!"
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="cw-step-text">
                  {toDisplayText(step.label)}
                  {step.id === "contact" && contactAttempted && (
                    <small>ติดต่อไม่ได้</small>
                  )}
                </span>
                <span className="cw-sr-only">
                  {step.done ? " (เสร็จแล้ว)" : ""}
                </span>
              </button>
            </li>
          ))}
        </ol>
      }
      tabs={[
        { id: "action", label: "ติดตาม", icon: FiEdit3 },
        { id: "profile", label: "ข้อมูล", icon: FiUser },
        { id: "referrals", label: "ส่งต่อ", icon: FiCornerUpRight },
        {
          id: "history",
          label: "ประวัติ",
          icon: FiClock,
          count: historyLogs.length,
        },
      ]}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      after={
        <>
          <CaseModals
            showFollowupModal={showFollowupModal}
            setShowFollowupModal={setShowFollowupModal}
            formsList={relevantForms}
            selectedFollowupForm={selectedFollowupForm}
            handleSelectFollowup={handleSelectFollowup}
            followupLink={followupLink}
            copyFollowupLink={copyFollowupLink}
            showCloseCaseConfirm={showCloseCaseConfirm}
            setShowCloseCaseConfirm={setShowCloseCaseConfirm}
            handleCloseMasterCase={handleCloseMasterCase}
            isDeleting={isDeleting}
            showSelectModal={showSelectModal}
            setShowSelectModal={setShowSelectModal}
            rawAnswers={leftPanelRawAnswers}
            copySelections={copySelections}
            toggleQuestionCheck={toggleQuestionCheck}
            setCopySelections={setCopySelections}
            handleCopySelected={handleCopySelected}
            stripHtml={stripHtml}
            showDeleteConfirm={showDeleteConfirm}
            setShowDeleteConfirm={setShowDeleteConfirm}
            handleDeleteCase={handleDeleteCase}
          />
          {isManagingTemplates && (
            <TemplateManagerModal
              clinicType={clinicType}
              onClose={() => setIsManagingTemplates(false)}
              onRefresh={fetchTemplates}
              showToast={showToast}
            />
          )}
          {toastMsg && (
            <div className="cdm-toast-msg" role="status">
              {toastMsg}
            </div>
          )}
        </>
      }
    >
      <ExportButton sources={[{resource:"case",id:data.id}]} title="รายละเอียดเคส" />
      <CaseActivity full activity={latestActivity} />
      {tabPanels[activeTab]}
    </CaseDrawer>
  );
}
