import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  saveFormToDb,
  getFormById,
  updateFormInDb,
  getActiveClinics,
} from "../../../services/api";
import "./styles/FormBuilder.css";
import Swal from "sweetalert2";

import {
  FaPalette,
  FaEye,
  FaUndo,
  FaRedo,
  FaPlusCircle,
  FaFont,
  FaThList,
  FaArrowLeft,
  FaFileMedical,
  FaCog,
  FaFileAlt,
  FaSpinner,
  FaWeight,
  FaClipboardList,
  FaHeartbeat,
  FaCopy,
} from "react-icons/fa";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import RichTextInput from "./builder-components/RichTextInput";
import MoveSectionModal from "./builder-components/MoveSectionModal";
import SortableQuestion from "./builder-components/SortableQuestion";

import PublishSettingsModal from "./builder-components/PublishSettingsModal";
import ThemeSidebar from "./builder-components/ThemeSidebar";
import QuestionBody from "./builder-components/QuestionBody";

import {
  getTemplate9Q,
  getTemplateBMI,
  getTemplateLSM,
  getTemplateSTI,
} from "./builder-components/FormTemplates";

const DEFAULT_FACULTIES = [
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

// 🟢 เพิ่มชุดตัวเลือกสำเร็จรูปสำหรับ อาชีพ/สถานะ
const DEFAULT_USER_STATUSES = ["นักศึกษา", "บุคคลทั่วไป"];

const SECTION_COLORS = [
  "#e8eaf6",
  "#fff8e1",
  "#e8f5e9",
  "#e3f2fd",
  "#fce4ec",
  "#f3e5f5",
];
const SECTION_BORDER_COLORS = [
  "#9fa8da",
  "#ffe082",
  "#a5d6a7",
  "#90caf9",
  "#f48fb1",
  "#ce93d8",
];

const formatDateTimeForInput = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date - tzOffset).toISOString().slice(0, 16);
};

const formatDateTimeForMySQL = (localDateTime) => {
  if (!localDateTime) return null;
  return localDateTime.replace("T", " ") + ":00";
};

const cleanHTMLGarbage = (str) => {
  if (typeof str !== "string") return str;
  let cleaned = str;
  cleaned = cleaned.replace(/<span[\s\S]*?>/gi, "");
  cleaned = cleaned.replace(/<\/span>/gi, "");
  cleaned = cleaned.replace(/&lt;span[\s\S]*?&gt;/gi, "");
  cleaned = cleaned.replace(/&lt;\/span&gt;/gi, "");
  cleaned = cleaned.replace(/<font[\s\S]*?>/gi, "");
  cleaned = cleaned.replace(/<\/font>/gi, "");
  cleaned = cleaned.replace(/&lt;font[\s\S]*?&gt;/gi, "");
  cleaned = cleaned.replace(/&lt;\/font&gt;/gi, "");
  return cleaned;
};

const deeplyCleanData = (items) => {
  if (Array.isArray(items)) {
    return items.map((item) => deeplyCleanData(item));
  } else if (items !== null && typeof items === "object") {
    const cleaned = {};
    for (const key in items) {
      cleaned[key] = deeplyCleanData(items[key]);
    }
    return cleaned;
  } else if (typeof items === "string") {
    return cleanHTMLGarbage(items);
  }
  return items;
};

const FormBuilder = () => {
  const navigate = useNavigate();
  const { id } = useParams();

  const [activeQuestionId, setActiveQuestionId] = useState("main-header");

  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);

  const [formTitle, setFormTitle] = useState("แบบฟอร์มไม่มีชื่อ");
  const [formDesc, setFormDesc] = useState("");
  const [formStepName, setFormStepName] = useState("ส่วนที่ 1");
  const [formStatus, setFormStatus] = useState("draft");
  const [clinicType, setClinicType] = useState("general");
  const [formType, setFormType] = useState("Registration");
  const [clinics, setClinics] = useState([]);

  useEffect(() => {
    getActiveClinics().then(res => setClinics(res.data.data || [])).catch(console.error);
  }, []);

  const [isScheduled, setIsScheduled] = useState(false);
  const [publishStartDate, setPublishStartDate] = useState("");
  const [publishEndDate, setPublishEndDate] = useState("");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [themeColor, setThemeColor] = useState("#673ab7");
  const [bgColor, setBgColor] = useState("#f0f2f5");
  const [bannerType, setBannerType] = useState("none");
  const [bannerBgColor, setBannerBgColor] = useState("#4285f4");
  const [headerImage, setHeaderImage] = useState(null);
  const [bannerText, setBannerText] = useState("");
  const [bannerTextAlign, setBannerTextAlign] = useState("center");

  const [questions, setQuestions] = useState([
    {
      id: "q1",
      type: "multiple_choice",
      title: "คำถามใหม่",
      options: ["ตัวเลือก 1"],
      optionScores: [0],
      optionImages: [null],
      optionHasInput: [false],
      rows: ["แถวที่ 1"],
      cols: ["คอลัมน์ 1"],
      colScores: [0],
      required: false,
      hasDescription: false,
      text: "",
      image: null,
      isScored: false,
      scoringRules: [],
    },
  ]);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: { delay: 100, tolerance: 5 },
    }),
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  useEffect(() => {
    if (id) {
      const fetchForm = async () => {
        try {
          const response = await getFormById(id);
          const data = response.data;

          setFormTitle(cleanHTMLGarbage(data.title) || "แบบฟอร์มไม่มีชื่อ");
          setFormDesc(cleanHTMLGarbage(data.description) || "");
          setFormStepName(cleanHTMLGarbage(data.step_name) || "ส่วนที่ 1");
          setFormStatus(data.status || "draft");
          setClinicType(data.clinic_type || "general");
          setFormType(data.form_type || "Registration");

          if (data.publish_start_date || data.publish_end_date) {
            setIsScheduled(true);
            setPublishStartDate(
              formatDateTimeForInput(data.publish_start_date),
            );
            setPublishEndDate(formatDateTimeForInput(data.publish_end_date));
          }
          if (data.theme) {
            let t =
              typeof data.theme === "string"
                ? JSON.parse(data.theme)
                : data.theme;
            t = deeplyCleanData(t);
            setThemeColor(t.color || "#673ab7");
            setBgColor(t.bg || "#f0f2f5");
            setBannerType(t.bannerType || "none");
            setBannerBgColor(t.bannerBgColor || "#4285f4");
            setHeaderImage(t.headerImage || null);
            setBannerText(t.bannerText || "");
            setBannerTextAlign(t.bannerTextAlign || "center");
          }
          if (data.questions) {
            let q =
              typeof data.questions === "string"
                ? JSON.parse(data.questions)
                : data.questions;
            q = deeplyCleanData(q);
            setQuestions(q);
          }
        } catch (error) {
          navigate("/admin/forms");
        } finally {
          setIsLoading(false);
        }
      };
      fetchForm();
    }
  }, [id, navigate]);

  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const isRestoring = useRef(false);
  const [editingCell, setEditingCell] = useState(null);

  const currentState = useMemo(
    () => ({
      formTitle,
      formDesc,
      formStepName,
      themeColor,
      bgColor,
      bannerType,
      bannerBgColor,
      headerImage,
      bannerText,
      bannerTextAlign,
      questions,
      formStatus,
      clinicType,
      formType,
      publishStartDate,
      publishEndDate,
      isScheduled,
    }),
    [
      formTitle,
      formDesc,
      formStepName,
      themeColor,
      bgColor,
      bannerType,
      bannerBgColor,
      headerImage,
      bannerText,
      bannerTextAlign,
      questions,
      formStatus,
      clinicType,
      formType,
      publishStartDate,
      publishEndDate,
      isScheduled,
    ],
  );

  const lastSavedState = useRef(currentState);

  useEffect(() => {
    if (isRestoring.current) {
      isRestoring.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const hasChanged =
        JSON.stringify(currentState) !== JSON.stringify(lastSavedState.current);
      if (hasChanged) {
        setPast((prev) => [...prev, lastSavedState.current].slice(-30));
        lastSavedState.current = currentState;
        setFuture([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [currentState]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const hasChanged =
        JSON.stringify(currentState) !== JSON.stringify(lastSavedState.current);
      if (hasChanged && !isSaving) {
        e.preventDefault();
        e.returnValue =
          "คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้โดยไม่บันทึกหรือไม่?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [currentState, isSaving]);

  const handleUndo = () => {
    if (past.length === 0) return;
    isRestoring.current = true;
    const previous = past[past.length - 1];
    setFuture((prev) => [lastSavedState.current, ...prev]);
    setPast(past.slice(0, -1));
    lastSavedState.current = previous;
    setFormTitle(previous.formTitle);
    setFormDesc(previous.formDesc);
    setFormStepName(previous.formStepName);
    setThemeColor(previous.themeColor);
    setBgColor(previous.bgColor);
    setBannerType(previous.bannerType);
    setBannerBgColor(previous.bannerBgColor);
    setHeaderImage(previous.headerImage);
    setBannerText(previous.bannerText);
    setBannerTextAlign(previous.bannerTextAlign);
    setQuestions(previous.questions);
    setFormStatus(previous.formStatus);
    setClinicType(previous.clinicType);
    setFormType(previous.formType);
    setPublishStartDate(previous.publishStartDate);
    setPublishEndDate(previous.publishEndDate);
    setIsScheduled(previous.isScheduled);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    isRestoring.current = true;
    const next = future[0];
    setPast((prev) => [...prev, lastSavedState.current]);
    setFuture(future.slice(1));
    lastSavedState.current = next;
    setFormTitle(next.formTitle);
    setFormDesc(next.formDesc);
    setFormStepName(next.formStepName);
    setThemeColor(next.themeColor);
    setBgColor(next.bgColor);
    setBannerType(next.bannerType);
    setBannerBgColor(next.bannerBgColor);
    setHeaderImage(next.headerImage);
    setBannerText(next.bannerText);
    setBannerTextAlign(next.bannerTextAlign);
    setQuestions(next.questions);
    setFormStatus(next.formStatus);
    setClinicType(next.clinicType);
    setFormType(next.formType);
    setPublishStartDate(next.publishStartDate);
    setPublishEndDate(next.publishEndDate);
    setIsScheduled(next.isScheduled);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) document.getElementById("btn-redo")?.click();
        else document.getElementById("btn-undo")?.click();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        document.getElementById("btn-redo")?.click();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sectionsOnly = questions.filter((q) => q.type === "section");
  const totalSections = sectionsOnly.length + 1;

  const getSectionIndex = (questionId) => {
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return 1;
    return (
      questions.slice(0, idx).filter((q) => q.type === "section").length + 2
    );
  };

  const getSectionOfQuestion = (questionId) => {
    const idx = questions.findIndex((q) => q.id === questionId);
    if (idx === -1) return 1;
    return (
      questions.slice(0, idx).filter((q) => q.type === "section").length + 1
    );
  };

  const allSectionsForModal = [
    { id: "main-header", title: formTitle, type: "header" },
    ...sectionsOnly,
  ];

  const handleHeaderImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeaderImage(reader.result);
        setBannerType("image");
      };
      reader.readAsDataURL(file);
    }
    e.target.value = null;
  };

  const insertItemsAtActive = useCallback(
    (newItems) => {
      setQuestions((prev) => {
        if (activeQuestionId && activeQuestionId !== "main-header") {
          const idx = prev.findIndex((q) => q.id === activeQuestionId);
          if (idx !== -1) {
            const arr = [...prev];
            arr.splice(idx + 1, 0, ...newItems);
            return arr;
          }
        }
        return [...prev, ...newItems];
      });
      setTimeout(() => {
        setActiveQuestionId(newItems[newItems.length - 1].id);
        const el = document.getElementById(
          `question-${newItems[newItems.length - 1].id}`,
        );
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    },
    [activeQuestionId],
  );

  const addTemplate = (templateFunction) => {
    const templateItems = templateFunction();
    insertItemsAtActive(templateItems);
  };

  const addQuestion = () => {
    const newQ = {
      id: `q${Date.now()}`,
      type: "multiple_choice",
      title: "",
      options: ["ตัวเลือก 1"],
      optionScores: [0],
      optionImages: [null],
      optionHasInput: [false],
      rows: ["แถวที่ 1"],
      cols: ["คอลัมน์ที่ 1"],
      colScores: [0],
      required: false,
      hasDescription: false,
      text: "",
      image: null,
      isScored: false,
      scoringRules: [],
    };
    insertItemsAtActive([newQ]);
  };

  const addDescription = () => {
    const newDesc = {
      id: `q${Date.now()}`,
      type: "description",
      title: "",
      text: "เขียนคำอธิบายที่นี่...",
      hasDescription: true,
      required: false,
      image: null,
    };
    insertItemsAtActive([newDesc]);
  };

  const addSection = () => {
    const newSec = {
      id: `sec${Date.now()}`,
      type: "section",
      title: "",
      text: "",
      stepName: "",
      options: [],
      hasDescription: true,
      required: false,
    };
    insertItemsAtActive([newSec]);
  };

  const duplicateSection = (sectionId) => {
    const secIndex = questions.findIndex((q) => q.id === sectionId);
    if (secIndex === -1) return;
    let endIndex = secIndex + 1;
    while (
      endIndex < questions.length &&
      questions[endIndex].type !== "section"
    )
      endIndex++;
    const itemsToDuplicate = questions.slice(secIndex, endIndex);
    const newItems = itemsToDuplicate.map((item) => ({
      ...item,
      id: `${item.type === "section" ? "sec" : "q"}${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    }));
    const newQuestions = [...questions];
    newQuestions.splice(endIndex, 0, ...newItems);
    setQuestions(newQuestions);
    setActiveQuestionId(newItems[0].id);
  };

  const removeSection = (sectionId) => {
    if (
      window.confirm(
        "คุณต้องการลบส่วนนี้ และคำถามทั้งหมดที่อยู่ในส่วนนี้ใช่หรือไม่?",
      )
    ) {
      const secIndex = questions.findIndex((q) => q.id === sectionId);
      if (secIndex === -1) return;
      let endIndex = secIndex + 1;
      while (
        endIndex < questions.length &&
        questions[endIndex].type !== "section"
      )
        endIndex++;
      const newQuestions = [...questions];
      newQuestions.splice(secIndex, endIndex - secIndex);
      setQuestions(newQuestions);
      if (activeQuestionId === sectionId) setActiveQuestionId("main-header");
    }
  };

  const handleMoveSection = (oldSecIdx, newSecIdx) => {
    if (oldSecIdx === 0 || newSecIdx === 0) return;
    const actualOldId = allSectionsForModal[oldSecIdx].id;
    const actualNewId = allSectionsForModal[newSecIdx].id;
    const oldStart = questions.findIndex((q) => q.id === actualOldId);
    let oldEnd = oldStart + 1;
    while (oldEnd < questions.length && questions[oldEnd].type !== "section")
      oldEnd++;
    const blockToMove = questions.slice(oldStart, oldEnd);
    let tempQuestions = [...questions];
    tempQuestions.splice(oldStart, oldEnd - oldStart);
    const newStart = tempQuestions.findIndex((q) => q.id === actualNewId);
    tempQuestions.splice(newStart, 0, ...blockToMove);
    setQuestions(tempQuestions);
  };

  const handleSaveForm = async () => {
    let finalStatus = formStatus;

    // 🟢 1. เช็คว่าเป็นการ "สร้างฟอร์มใหม่" หรือไม่ (!id)
    if (!id) {
      const result = await Swal.fire({
        title: 'บันทึกแบบฟอร์ม',
        text: 'คุณต้องการเปิดใช้งาน (เผยแพร่) ฟอร์มนี้ทันที หรือเก็บไว้เป็นแบบร่างก่อน?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'เผยแพร่ทันที',
        denyButtonText: 'เก็บเป็นแบบร่าง',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#1967d2', // สีน้ำเงิน
        denyButtonColor: '#f59e0b',  // สีส้ม
      });

      // ถ้ากดปุ่ม "ยกเลิก" ให้หยุดการเซฟทันที
      if (result.isDismissed) {
        return;
      }

      // เซ็ตสถานะตามที่เลือก
      finalStatus = result.isConfirmed ? "published" : "draft";
      setFormStatus(finalStatus); // อัปเดต state ของ React ด้วย
    }

    setIsSaving(true);
    const formData = {
      title: cleanHTMLGarbage(formTitle),
      description: cleanHTMLGarbage(formDesc),
      formStepName: cleanHTMLGarbage(formStepName),
      theme: deeplyCleanData({
        color: themeColor,
        bg: bgColor,
        bannerType,
        bannerBgColor,
        headerImage,
        bannerText,
        bannerTextAlign,
      }),
      questions: deeplyCleanData(questions),
      status: finalStatus, // 🟢 2. ใช้ค่า finalStatus ที่ได้จากการเลือกใน Pop-up
      clinic_type: clinicType,
      form_type: formType,
      publish_start_date:
        isScheduled && publishStartDate
          ? formatDateTimeForMySQL(publishStartDate)
          : null,
      publish_end_date:
        isScheduled && publishEndDate
          ? formatDateTimeForMySQL(publishEndDate)
          : null,
    };
    
    try {
      if (id) {
        await updateFormInDb(id, formData);
        setIsSaving(false);
        navigate("/admin/forms");
      } else {
        await saveFormToDb(formData);
        lastSavedState.current = currentState;
        setIsSaving(false);
        
        // 🟢 3. แสดงแจ้งเตือนเมื่อสร้างฟอร์มเสร็จ แล้วค่อยพากลับหน้าแรก
        Swal.fire({
          icon: 'success',
          title: 'บันทึกข้อมูลสำเร็จ!',
          showConfirmButton: false,
          timer: 1500
        }).then(() => {
          navigate("/admin/forms");
        });
      }
    } catch (error) {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง', 'error');
      setIsSaving(false);
    }
  };

  const handlePreview = () => {
    const previewData = {
      title: formTitle,
      description: formDesc,
      step_name: formStepName, // 🟢 ใช้ชื่อคีย์ให้ตรงกับ FormView
      theme: {
        color: themeColor,
        bg: bgColor,
        bannerType,
        bannerBgColor,
        headerImage,
        bannerText,
        bannerTextAlign,
      },
      questions: questions,
    };
    window.__formPreviewData = previewData;
    try {
      localStorage.setItem("formPreviewData", JSON.stringify(previewData));
    } catch (e) { }

    // 🟢 เปลี่ยนพาธให้ไปเรียกหน้า FormView แต่ส่ง ID ไปเป็นคำว่า 'preview' แทน
    window.open("/assessment/preview", "_blank");
  };

  const handleCopyQuestions = () => {
    try {
      const dataToCopy = JSON.stringify(questions, null, 2);
      navigator.clipboard.writeText(dataToCopy).then(() => {
        alert(
          "คัดลอกข้อมูลคำถาม (JSON) เรียบร้อยแล้ว! สามารถนำไปวางให้ AI วิเคราะห์ได้เลยครับ",
        );
      });
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการคัดลอกข้อมูล");
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id)
      setQuestions((items) =>
        arrayMove(
          items,
          items.findIndex((i) => i.id === active.id),
          items.findIndex((i) => i.id === over.id),
        ),
      );
  };

  const questionHandlers = {
    addOption: (qId) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              options: [...q.options, `ตัวเลือก ${q.options.length + 1}`],
              optionScores: [...(q.optionScores || []), 0],
              optionLimits: [...(q.optionLimits || Array(q.options.length).fill(null)), null],
              optionImages: [...(q.optionImages || []), null],
              optionHasInput: [
                ...(q.optionHasInput || Array(q.options.length).fill(false)),
                false,
              ],
            }
            : q,
        ),
      ),

    updateOption: (qId, optIdx, val) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              options: q.options.map((o, i) => (i === optIdx ? val : o)),
            }
            : q,
        ),
      ),
    updateDisplayAs: (qId, val) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId ? { ...q, displayAs: val } : q,
        ),
      ),
    updateOptionLimit: (qId, optIdx, val) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              optionLimits: (q.optionLimits || Array(q.options.length).fill(null)).map((l, i) =>
                i === optIdx ? (val === '' ? null : parseInt(val)) : l
              ),
            }
            : q,
        ),
      ),
    updateOptionScore: (qId, optIdx, val) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              optionScores: (q.optionScores || []).map((s, i) =>
                i === optIdx ? val : s,
              ),
            }
            : q,
        ),
      ),

    removeOption: (qId, optIdx) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId && q.options.length > 1
            ? {
              ...q,
              options: q.options.filter((_, i) => i !== optIdx),
              optionScores: (q.optionScores || []).filter(
                (_, i) => i !== optIdx,
              ),
              optionLimits: (q.optionLimits || []).filter(
                (_, i) => i !== optIdx,
              ),
              optionImages: (q.optionImages || []).filter(
                (_, i) => i !== optIdx,
              ),
              optionHasInput: (q.optionHasInput || []).filter(
                (_, i) => i !== optIdx,
              ),
            }
            : q,
        ),
      ),

    toggleOptionInput: (qId, optIdx) =>
      setQuestions(
        questions.map((q) => {
          if (q.id === qId) {
            const newHasInput = [
              ...(q.optionHasInput || Array(q.options.length).fill(false)),
            ];
            newHasInput[optIdx] = !newHasInput[optIdx];
            return { ...q, optionHasInput: newHasInput };
          }
          return q;
        }),
      ),

    addGridItem: (qId, field) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              [field]: [
                ...q[field],
                `${field === "rows" ? "แถวที่" : "คอลัมน์ที่"} ${q[field].length + 1}`,
              ],
              ...(field === "cols"
                ? { colScores: [...(q.colScores || []), 0] }
                : {}),
            }
            : q,
        ),
      ),
    updateGridItem: (qId, field, idx, val) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? { ...q, [field]: q[field].map((o, i) => (i === idx ? val : o)) }
            : q,
        ),
      ),
    updateGridColScore: (qId, idx, val) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              colScores: (q.colScores || Array(q.cols.length).fill(0)).map(
                (s, i) => (i === idx ? val : s),
              ),
            }
            : q,
        ),
      ),
    updateScoreMode: (qId, mode) =>
      setQuestions(
        questions.map((q) => (q.id === qId ? { ...q, scoreMode: mode } : q)),
      ),
    updateRowScore: (qId, index, value) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId
            ? {
              ...q,
              rowScores: (q.rowScores || []).map((s, i) =>
                i === index ? value : s,
              ),
            }
            : q,
        ),
      ),
    updateCellScore: (qId, rowIndex, colIndex, value) =>
      setQuestions(
        questions.map((q) => {
          if (q.id !== qId) return q;
          const newCellScores = [...(q.cellScores || [])];
          if (!newCellScores[rowIndex]) newCellScores[rowIndex] = [];
          newCellScores[rowIndex][colIndex] = value;
          return { ...q, cellScores: newCellScores };
        }),
      ),
    updateVideoUrl: (qId, url) =>
      setQuestions(
        questions.map((q) => (q.id === qId ? { ...q, videoUrl: url } : q)),
      ),
    removeGridItem: (qId, field, idx) =>
      setQuestions(
        questions.map((q) =>
          q.id === qId && q[field].length > 1
            ? {
              ...q,
              [field]: q[field].filter((_, i) => i !== idx),
              ...(field === "cols"
                ? {
                  colScores: (q.colScores || []).filter(
                    (_, i) => i !== idx,
                  ),
                }
                : {}),
            }
            : q,
        ),
      ),
    updateQuestionImage: (id, imgBase64) =>
      setQuestions(
        questions.map((q) => (q.id === id ? { ...q, image: imgBase64 } : q)),
      ),
    updateOptionImage: (id, optIdx, imgBase64) =>
      setQuestions(
        questions.map((q) => {
          if (q.id === id) {
            const newOptImgs = [
              ...(q.optionImages || Array(q.options.length).fill(null)),
            ];
            newOptImgs[optIdx] = imgBase64;
            return { ...q, optionImages: newOptImgs };
          }
          return q;
        }),
      ),

    addSubQuestion: (groupId, newQ) =>
      setQuestions(
        questions.map((q) =>
          q.id === groupId
            ? {
              ...q,
              subQuestions: [
                ...(q.subQuestions || []),
                {
                  ...newQ,
                  optionHasInput: Array(newQ.options.length).fill(false),
                },
              ],
            }
            : q,
        ),
      ),
    updateSubQuestion: (groupId, subId, field, val) =>
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== groupId) return q;
          return {
            ...q,
            subQuestions: (q.subQuestions || []).map((sq) => {
              if (sq.id !== subId) return sq;
              return { ...sq, [field]: Array.isArray(val) ? [...val] : val };
            }),
          };
        }),
      ),
    removeSubQuestion: (groupId, subId) =>
      setQuestions(
        questions.map((q) =>
          q.id === groupId
            ? {
              ...q,
              subQuestions: (q.subQuestions || []).filter(
                (sq) => sq.id !== subId,
              ),
            }
            : q,
        ),
      ),
  };

  const updateDescriptionPresence = (id, hasDesc) =>
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, hasDescription: hasDesc } : q)),
    );
  const updateRequired = (id, isRequired) =>
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, required: isRequired } : q)),
    );
  const updateIsScored = (id, isScored) =>
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id === id) {
          const newRules =
            isScored && (!q.scoringRules || q.scoringRules.length === 0)
              ? [{ min: 0, max: 0, label: "", color: "#4caf50", advice: "" }]
              : q.scoringRules;
          return { ...q, isScored, scoringRules: newRules };
        }
        return q;
      }),
    );
  const updateScoringRules = (id, rules) =>
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, scoringRules: rules } : q)),
    );

  const updateIsEditable = (id, val) =>
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, isEditable: val } : q)),
    );

  const updateQuestionType = (id, newType) => {
    setQuestions(
      questions.map((q) => {
        if (q.id === id) {
          let updates = { type: newType, isUserStatus: false };
          const isDefaultTitle =
            !q.title || q.title === "คำถามใหม่" || q.title.trim() === "";

          if (newType === "group" && !q.subQuestions) {
            updates.subQuestions = [];
            if (isDefaultTitle) updates.title = "ชื่อกลุ่มคำถาม...";
          }
          if (newType === "full_name" && isDefaultTitle)
            updates.title = "ชื่อ-นามสกุล";

          // 🟢 บังคับให้เบอร์โทรตั้งค่าแก้ไขได้ และบัตร ปชช. แก้ไม่ได้
          if (newType === "phone_number") {
            if (isDefaultTitle) updates.title = "เบอร์โทรศัพท์ติดต่อ";
            updates.isEditable = true;
          }
          if (newType === "national_id") {
            updates.isEditable = false;
          }

          if (newType === "main_issue" && isDefaultTitle)
            updates.title = "ปัญหา/ความต้องการหลัก";
          if (newType === "bmi" && isDefaultTitle)
            updates.title = "การประเมินดัชนีมวลกาย (BMI)";

          if (newType === "faculty") {
            if (isDefaultTitle) updates.title = "สำนักวิชา / หน่วยงาน";
            if (
              !["dropdown", "multiple_choice", "checkboxes"].includes(q.type) ||
              (q.options?.length <= 1 && q.options?.[0] === "ตัวเลือก 1")
            ) {
              updates.options = [...DEFAULT_FACULTIES];
            }
          }

          if (newType === "user_status") {
            if (isDefaultTitle) updates.title = "สถานะผู้เข้ารับบริการ / อาชีพ";
            if (
              !["dropdown", "multiple_choice", "checkboxes"].includes(q.type) ||
              (q.options?.length <= 1 && q.options?.[0] === "ตัวเลือก 1")
            ) {
              updates.options = [...DEFAULT_USER_STATUSES];
            }
            updates.type = "multiple_choice";
            updates.isUserStatus = true;
            updates.required = true;
          }

          const scoreableTypes = [
            "multiple_choice",
            "checkboxes",
            "dropdown",
            "grid_multiple",
            "grid_checkbox",
            "bmi",
            "group",
          ];
          if (scoreableTypes.includes(updates.type)) {
            updates.isScored =
              newType !== "user_status" && newType !== "faculty" ? true : false;
            if (
              updates.isScored &&
              (!q.scoringRules || q.scoringRules.length === 0)
            ) {
              updates.scoringRules = [
                { min: 0, max: 0, label: "", color: "#4caf50", advice: "" },
              ];
            }
          } else {
            updates.isScored = false;
          }
          return { ...q, ...updates };
        }
        return q;
      }),
    );
  };

  const duplicateQuestion = (id) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const q = prev[idx];
      let clonedType = q.type;
      if (["national_id", "full_name", "phone_number"].includes(q.type))
        clonedType = "short_text";
      if (q.type === "main_issue") clonedType = "paragraph";
      if (q.type === "faculty") clonedType = "dropdown";

      const clone = { ...q, id: `q${Date.now()}`, type: clonedType };
      if (q.isUserStatus) clone.isUserStatus = true;

      const newArr = [...prev];
      newArr.splice(idx + 1, 0, clone);

      setTimeout(() => setActiveQuestionId(clone.id), 50);
      return newArr;
    });
  };

  const removeQuestion = (id) => {
    setQuestions(questions.filter((q) => q.id !== id));
    if (activeQuestionId === id) setActiveQuestionId("main-header");
  };
  const renderQuestionBody = (q, isActive) => (
    <QuestionBody
      q={q}
      editingCell={editingCell}
      setEditingCell={setEditingCell}
      handlers={questionHandlers}
      isActive={isActive}
    />
  );

  return (
    <div
      className="sfb-main-container"
      style={{ "--theme-color": themeColor, "--bg-color": bgColor }}
    >
      <div
        className="sfb-admin-layout"
        style={{ backgroundColor: "var(--bg-color)" }}
      >
{isLoading ? (
          <main
            className="sfb-builder-container"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100vh",
            }}
          >
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            <FaSpinner
              size={40}
              style={{ animation: "spin 1s linear infinite", color: "#1967d2" }}
            />
            <h3 style={{ marginTop: "16px", color: "#5f6368" }}>
              กำลังโหลดแบบฟอร์ม...
            </h3>
          </main>
        ) : (
          <main
            className="sfb-builder-container"
            onClick={(e) => {
              if (
                e.target.classList?.contains("sfb-form-canvas") ||
                e.target.classList?.contains("sfb-form-content")
              ) {
                setActiveQuestionId(null);
              }
            }}
          >
            <header className="sfb-builder-header">
              <div className="sfb-header-left">
                <button
                  className="sfb-btn-back"
                  onClick={() => {
                    const hasChanged =
                      JSON.stringify(currentState) !==
                      JSON.stringify(lastSavedState.current);
                    if (
                      !hasChanged ||
                      window.confirm(
                        "คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการย้อนกลับโดยไม่บันทึกหรือไม่?",
                      )
                    )
                      navigate("/admin/forms");
                  }}
                >
                  <FaArrowLeft />
                </button>
                <h3>
                  {id ? "แก้ไขฟอร์ม" : "สร้างฟอร์มใหม่"}
                  {formStatus === "draft" && (
                    <span
                      style={{
                        fontSize: "14px",
                        color: "#ff9800",
                        marginLeft: "8px",
                        fontWeight: "bold",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        verticalAlign: "middle",
                      }}
                    >
                      [<FaFileAlt /> แบบร่าง]
                    </span>
                  )}
                  <span
                    className="sfb-badge-clinic"
                    style={{
                      fontSize: "12px",
                      background: "#e3f2fd",
                      color: "#1976d2",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      marginLeft: "10px",
                      fontWeight: "bold",
                      display: "inline-flex",
                      alignItems: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    {(() => {
                      if (!clinicType || clinicType === "general") return "ทั่วไป";
                      const c = clinics.find(x => x.slug === clinicType);
                      if (c) return c.name;
                      if (clinicType === "teenager") return "คลินิกวัยรุ่น";
                      if (clinicType === "behavior") return "คลินิกปLSM";
                      if (clinicType === "sti") return "คลินิกโรคติดต่อฯ";
                      return clinicType;
                    })()}
                  </span>
                  <span
                    className="sfb-badge-type"
                    style={{
                      fontSize: "12px",
                      background:
                        formType === "Follow-up" ? "#fce7f3" : "#f1f5f9",
                      color: formType === "Follow-up" ? "#be185d" : "#475569",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      marginLeft: "6px",
                      fontWeight: "bold",
                      display: "inline-flex",
                      alignItems: "center",
                      verticalAlign: "middle",
                    }}
                  >
                    {formType === "Follow-up"
                      ? "ฟอร์มติดตามผล"
                      : "ฟอร์มลงทะเบียน"}
                  </span>
                </h3>
              </div>
              <div className="sfb-header-actions">
                <div className="sfb-action-icons">
                  <div className="sfb-icon-group" onClick={handleCopyQuestions}>
                    <FaCopy />
                    <p>คัดลอก JSON</p>
                  </div>
                  <div
                    className="sfb-icon-group"
                    onClick={() => setIsSettingsModalOpen(true)}
                  >
                    <FaCog />
                    <p>ตั้งค่าเผยแพร่</p>
                  </div>
                  <div
                    className="sfb-icon-group"
                    onClick={() => setIsThemePanelOpen(true)}
                  >
                    <FaPalette />
                    <p>ธีม</p>
                  </div>
                  <div className="sfb-icon-group" onClick={handlePreview}>
                    <FaEye />
                    <p>แสดงตัวอย่าง</p>
                  </div>
                  <div
                    id="btn-undo"
                    className="sfb-icon-group"
                    onClick={handleUndo}
                    style={{
                      opacity: past.length === 0 ? 0.4 : 1,
                      pointerEvents: past.length === 0 ? "none" : "auto",
                    }}
                  >
                    <FaUndo />
                    <p>Undo</p>
                  </div>
                  <div
                    id="btn-redo"
                    className="sfb-icon-group"
                    onClick={handleRedo}
                    style={{
                      opacity: future.length === 0 ? 0.4 : 1,
                      pointerEvents: future.length === 0 ? "none" : "auto",
                    }}
                  >
                    <FaRedo />
                    <p>Redo</p>
                  </div>
                </div>
                <button
                  className="sfb-btn-save"
                  onClick={handleSaveForm}
                  disabled={isSaving}
                  style={{
                    backgroundColor:
                      formStatus === "draft" ? "#fbbc04" : "#1967d2",
                    color: formStatus === "draft" ? "#000" : "#fff",
                    opacity: isSaving ? 0.7 : 1,
                    cursor: isSaving ? "not-allowed" : "pointer",
                  }}
                >
                  {isSaving ? (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <FaSpinner
                        style={{ animation: "spin 1s linear infinite" }}
                      />{" "}
                      กำลังบันทึก...
                    </span>
                  ) : formStatus === "draft" ? (
                    "บันทึก"
                  ) : id ? (
                    "อัปเดตเผยแพร่"
                  ) : (
                    "บันทึกและเผยแพร่"
                  )}
                </button>
              </div>
            </header>

            {bannerType !== "none" && (
              <div
                className="sfb-builder-full-banner"
                style={{
                  backgroundColor:
                    bannerType === "color" ? bannerBgColor : "transparent",
                  backgroundImage:
                    bannerType === "image" && headerImage
                      ? `url(${headerImage})`
                      : "none",
                }}
              >
                <div className="sfb-banner-overlay"></div>
                <RichTextInput
                  className="sfb-banner-text-input"
                  value={bannerText}
                  onChange={setBannerText}
                  placeholder="คลิกเพื่อพิมพ์ข้อความส่วนหัวที่นี่..."
                  showLists={false}
                  style={{ textAlign: bannerTextAlign }}
                />
              </div>
            )}

            <div className="sfb-form-content">
              <div className="sfb-form-canvas">
                <div
                  className={`sfb-form-card sfb-header-card ${totalSections > 1 ? "sfb-section-card" : "sfb-border-top-suth"} ${activeQuestionId === "main-header" ? "active" : "inactive"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveQuestionId("main-header");
                  }}
                >
                  {totalSections > 1 && (
                    <div className="sfb-section-header-bar sfb-theme-bg">
                      <div className="sfb-section-header-left">
                        <div className="sfb-section-indicator">
                          ส่วนที่ 1 จาก {totalSections} :
                        </div>
                        <input
                          type="text"
                          className="sfb-step-name-input-inline"
                          placeholder="ชื่อแถบสถานะ"
                          value={formStepName}
                          onChange={(e) => setFormStepName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                  <RichTextInput
                    tagName="h1"
                    className="sfb-input-title sfb-theme-text"
                    value={formTitle}
                    onChange={setFormTitle}
                    placeholder="แบบฟอร์มไม่มีชื่อ"
                    showLists={false}
                  />
                  <RichTextInput
                    className="sfb-input-desc"
                    value={formDesc}
                    onChange={setFormDesc}
                    placeholder="คำอธิบายแบบฟอร์ม"
                    showLists={true}
                  />
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={questions.map((q) => q.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {questions.map((q, index) => {
                      const secNum = getSectionOfQuestion(q.id);
                      const badgeColor =
                        SECTION_COLORS[(secNum - 1) % SECTION_COLORS.length];
                      const badgeBorder =
                        SECTION_BORDER_COLORS[
                        (secNum - 1) % SECTION_BORDER_COLORS.length
                        ];
                      return (
                        <div
                          key={q.id}
                          id={`question-${q.id}`}
                          style={{ position: "relative" }}
                        >
                          {q.type !== "section" && totalSections > 1 && (
                            <div
                              className="sfb-section-badge"
                              style={{
                                background: badgeColor,
                                borderColor: badgeBorder,
                              }}
                            >
                              ส่วนที่ {secNum}
                            </div>
                          )}
                          <SortableQuestion
                            key={q.id}
                            q={q}
                            questions={questions}
                            setQuestions={setQuestions}
                            updateQuestionType={updateQuestionType}
                            removeQuestion={removeQuestion}
                            duplicateQuestion={duplicateQuestion}
                            renderQuestionBody={renderQuestionBody}
                            updateDescriptionPresence={
                              updateDescriptionPresence
                            }
                            updateRequired={updateRequired}
                            updateIsScored={updateIsScored}
                            updateScoringRules={updateScoringRules}
                            updateQuestionImage={
                              questionHandlers.updateQuestionImage
                            }
                            index={questions.findIndex(
                              (item) => item.id === q.id,
                            )}
                            totalSections={totalSections}
                            sectionIndex={
                              q.type === "section"
                                ? getSectionIndex(q.id)
                                : null
                            }
                            onOpenMoveModal={() => setIsMoveModalOpen(true)}
                            duplicateSection={duplicateSection}
                            removeSection={removeSection}
                            updateIsEditable={updateIsEditable}
                            isActive={activeQuestionId === q.id}
                            onSetActive={() => setActiveQuestionId(q.id)}
                          />
                        </div>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              </div>

              <aside className="sfb-floating-toolbar">
                <button onClick={addQuestion} title="เพิ่มคำถาม">
                  <FaPlusCircle className="sfb-tool-icon" />
                  <span>เพิ่มคำถาม</span>
                </button>
                <button onClick={addDescription} title="เพิ่มคำอธิบาย">
                  <FaFont className="sfb-tool-icon" />
                  <span>เพิ่มคำอธิบาย</span>
                </button>
                <button onClick={addSection} title="แบ่งส่วน">
                  <FaThList className="sfb-tool-icon" />
                  <span>แบ่งส่วน</span>
                </button>
                <div
                  style={{
                    width: "100%",
                    height: "1px",
                    background: "#dadce0",
                    margin: "8px 0",
                  }}
                ></div>
                <button
                  onClick={() => addTemplate(getTemplate9Q)}
                  title="เพิ่มชุดประเมินโรคซึมเศร้า 9Q"
                >
                  <FaFileMedical
                    className="sfb-tool-icon"
                    style={{ color: "#d93025" }}
                  />
                  <span style={{ color: "#d93025", fontWeight: "bold" }}>
                    เพิ่ม 9Q
                  </span>
                </button>
                <button
                  onClick={() => addTemplate(getTemplateBMI)}
                  title="เพิ่มชุดคำนวณ BMI อัตโนมัติ"
                >
                  <FaWeight
                    className="sfb-tool-icon"
                    style={{ color: "#00bcd4" }}
                  />
                  <span style={{ color: "#00bcd4", fontWeight: "bold" }}>
                    เพิ่ม BMI
                  </span>
                </button>
                <button
                  onClick={() => addTemplate(getTemplateLSM)}
                  title="เพิ่มชุดประเมินพฤติกรรมสุขภาพ 3อ."
                >
                  <FaClipboardList
                    className="sfb-tool-icon"
                    style={{ color: "#4caf50" }}
                  />
                  <span style={{ color: "#4caf50", fontWeight: "bold" }}>
                    เพิ่ม 3อ.
                  </span>
                </button>
                <button
                  onClick={() => addTemplate(getTemplateSTI)}
                  title="เพิ่มชุดคัดกรองโรคติดต่อทางเพศสัมพันธ์ (STIs)"
                >
                  <FaHeartbeat
                    className="sfb-tool-icon"
                    style={{ color: "#e91e63" }}
                  />
                  <span style={{ color: "#e91e63", fontWeight: "bold" }}>
                    เพิ่ม STIs
                  </span>
                </button>
              </aside>
            </div>
          </main>
        )}
      </div>

      <MoveSectionModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        sections={allSectionsForModal}
        onMoveSection={handleMoveSection}
      />

      <PublishSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        formStatus={formStatus}
        setFormStatus={setFormStatus}
        clinicType={clinicType}
        setClinicType={setClinicType}
        formType={formType}
        setFormType={setFormType}
        isScheduled={isScheduled}
        setIsScheduled={setIsScheduled}
        publishStartDate={publishStartDate}
        setPublishStartDate={setPublishStartDate}
        publishEndDate={publishEndDate}
        setPublishEndDate={setPublishEndDate}
      />

      <ThemeSidebar
        isOpen={isThemePanelOpen}
        onClose={() => setIsThemePanelOpen(false)}
        bannerType={bannerType}
        setBannerType={setBannerType}
        bannerBgColor={bannerBgColor}
        setBannerBgColor={setBannerBgColor}
        headerImage={headerImage}
        setHeaderImage={setHeaderImage}
        handleHeaderImageUpload={handleHeaderImageUpload}
        bannerText={bannerText}
        setBannerText={setBannerText}
        bannerTextAlign={bannerTextAlign}
        setBannerTextAlign={setBannerTextAlign}
        themeColor={themeColor}
        setThemeColor={setThemeColor}
        bgColor={bgColor}
        setBgColor={setBgColor}
      />
    </div>
  );
};

export default FormBuilder;
