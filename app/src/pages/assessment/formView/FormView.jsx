import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiTrash2,
  FiCheck,
  FiArrowUp,
  FiInfo,
  FiShield,
} from "react-icons/fi";
import {
  getFormById,
  decodeSecureToken,
  submitFormAnswers,
} from "../../../services/api";
import { clearPatientSession } from "../../../utils/patientSession";
import Swal from "sweetalert2";
import "../../admin/forms/styles/FormPreview.css";
import LanguageSwitcher from "../../../components/LanguageSwitcher.jsx";

// 🟢 นำเข้า Component และ Helper ที่แยกออกไป
import {
  formatThaiID,
  validateThaiID,
  withoutNationalIdQuestions,
  getQuestionTitles,
  buildScoreResults,
  canGuestSubmit,
  countScoredTargets,
  normalizeLoginEnforcement,
  normalizeResultDisplayMode,
  shouldShowRealtimeResults,
} from "./formUtils";
import QuestionRenderer from "./QuestionRenderer";
import InteractiveResultPanel from "./InteractiveResultPanel";
import { useTranslation } from "react-i18next";
import { translateTextSmart } from "../../../utils/translator";

const ASSESSMENT_DRAFT_TTL = 4 * 60 * 60 * 1000;

const FormView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const { t, i18n } = useTranslation();

  const urlToken = queryParams.get("token");
  const fallbackIdentity = queryParams.get("identity") || "";

  const isPreviewMode = id === "preview";

  const [formData, setFormData] = useState(null);
  const [loginEnforcement, setLoginEnforcement] = useState("none");
  const [resultDisplayMode, setResultDisplayMode] = useState("realtime");
  const [groupedSteps, setGroupedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [consents, setConsents] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [optionInputValues, setOptionInputValues] = useState({});
  const [verifiedIdentity, setVerifiedIdentity] = useState("");
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [translatedStep, setTranslatedStep] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const guestPromptFormRef = useRef(null);

  const patientToken = sessionStorage.getItem("patient_token");
  const draftKey = `assessment_draft_${id}`;

  const saveAssessmentDraft = () => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({
          answers,
          consents,
          optionInputValues,
          currentStep,
          savedAt: Date.now(),
        }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const continueToPatientAuth = async (mode = "login") => {
    if (!saveAssessmentDraft()) {
      await Swal.fire({
        icon: "error",
        title: t("form_view.draft_save_error_title"),
        text: t("form_view.draft_save_error_desc"),
        confirmButtonColor: "#f47932",
      });
      return;
    }
    const returnTo = `${location.pathname}${location.search}`;
    const authPath = mode === "register" ? "/account/register" : "/account/login";
    navigate(`${authPath}?returnTo=${encodeURIComponent(returnTo)}`);
  };

  const continueToPatientLogin = () => continueToPatientAuth("login");
  const continueToPatientRegister = () => continueToPatientAuth("register");

  // Authentication enforcement: strict → hard redirect, optional → modal,
  // none → no prompt at all.
  useEffect(() => {
    if (
      !formData ||
      isPreviewMode ||
      patientToken ||
      guestPromptFormRef.current === id
    ) {
      return;
    }

    // 'strict': redirect immediately — no guest access allowed
    if (loginEnforcement === "strict") {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(
        `/account/login?returnTo=${encodeURIComponent(returnTo)}`,
        { replace: true },
      );
      return;
    }

    // 'none': no prompt, fully public
    if (loginEnforcement === "none") return;

    // 'optional': show the auth modal with "Try it first" option
    guestPromptFormRef.current = id;
    let isActive = true;

    const showAuthPrompt = async () => {
      const result = await Swal.fire({
        icon: "info",
        title: "คุณยังไม่ได้เข้าสู่ระบบ",
        html: '<div style="text-align:left;line-height:1.6">คุณสามารถทดลองทำแบบประเมินและดูผลเบื้องต้นได้ แต่คำตอบจะยังไม่ถูกส่งถึงเจ้าหน้าที่</div>',
        showDenyButton: true,
        showCancelButton: true,
        allowOutsideClick: false,
        confirmButtonText: t("form_view.guest_prompt_login"),
        denyButtonText: t("form_view.guest_prompt_register"),
        cancelButtonText: "ทดลองประเมินก่อน",
        buttonsStyling: false,
        customClass: {
          popup: "assessment-auth-dialog",
          actions: "assessment-auth-dialog__actions",
          confirmButton:
            "assessment-auth-dialog__button assessment-auth-dialog__button--primary",
          denyButton:
            "assessment-auth-dialog__button assessment-auth-dialog__button--secondary",
          cancelButton:
            "assessment-auth-dialog__button assessment-auth-dialog__button--tertiary",
        },
      });

      if (!isActive) return;
      if (result.isConfirmed) await continueToPatientLogin();
      if (result.isDenied) await continueToPatientRegister();
      // isDismissed = "ทดลองประเมินก่อน" → continue as guest, do nothing
    };

    showAuthPrompt();
    return () => {
      isActive = false;
    };
  }, [formData, id, isPreviewMode, patientToken, loginEnforcement, location.pathname, location.search, navigate, t]);

  useEffect(() => {
    let isMounted = true;
    const translateStep = async () => {
      const stepData = groupedSteps[currentStep];
      if (!stepData) return;

      if (i18n.language !== "en") {
        if (isMounted) setTranslatedStep(null);
        return;
      }

      const tTitle = stepData.title
        ? await translateTextSmart(stepData.title)
        : "";
      const tDesc = stepData.desc
        ? await translateTextSmart(stepData.desc)
        : "";

      if (isMounted) setTranslatedStep({ title: tTitle, desc: tDesc });
    };
    translateStep();
    return () => {
      isMounted = false;
    };
  }, [groupedSteps, currentStep, i18n.language]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchForm = async () => {
      setLoading(true);
      let activeIdentity = fallbackIdentity;

      const setupFormStructure = (data, identity) => {
        if (typeof data.theme === "string") data.theme = JSON.parse(data.theme);
        if (typeof data.questions === "string")
          data.questions = JSON.parse(data.questions);

        data.questions = withoutNationalIdQuestions(data.questions || []);

        if (data.questions && Array.isArray(data.questions)) {
          data.questions.forEach((q, qIdx) => {
            if (!q.id) q.id = `q_${qIdx}`;
            if (q.type === "group" && Array.isArray(q.subQuestions)) {
              q.subQuestions.forEach((sq, sIdx) => {
                const subId = sq.id || String(sIdx);
                // 🟢 ป้องกันการเติม Prefix ซ้ำซ้อน (เช่น q1_q1_sq1) โดยเช็คก่อนว่ามีอยู่แล้วหรือไม่
                if (!String(subId).startsWith(`${q.id}_`)) {
                  sq.id = `${q.id}_${subId}`;
                } else {
                  sq.id = subId;
                }
              });
            }
          });
        }

        setFormData(data);
        setLoginEnforcement(normalizeLoginEnforcement(data.login_enforcement));
        setResultDisplayMode(normalizeResultDisplayMode(data.result_display_mode));

        const steps = [];
        let currentGroup = {
          id: "main",
          title: data.title,
          stepName: data.step_name || data.formStepName || "ส่วนที่ 1",
          desc: data.description,
          items: [],
        };
        if (data.questions && Array.isArray(data.questions)) {
          data.questions.forEach((q) => {
            if (q.type === "section") {
              steps.push(currentGroup);
              currentGroup = {
                id: q.id,
                title: q.title,
                stepName: q.stepName || `ส่วนที่ ${steps.length + 1}`,
                desc: q.text,
                items: [],
              };
            } else {
              currentGroup.items.push(q);
            }
          });
        }
        steps.push(currentGroup);
        setGroupedSteps(steps);

        try {
          const storedDraft = JSON.parse(sessionStorage.getItem(draftKey));
          if (
            storedDraft &&
            Date.now() - Number(storedDraft.savedAt || 0) < ASSESSMENT_DRAFT_TTL
          ) {
            setAnswers((previous) => ({
              ...previous,
              ...(storedDraft.answers || {}),
            }));
            setConsents((previous) => ({
              ...previous,
              ...(storedDraft.consents || {}),
            }));
            setOptionInputValues(storedDraft.optionInputValues || {});
            setCurrentStep(
              Math.min(
                Math.max(0, Number(storedDraft.currentStep) || 0),
                Math.max(0, steps.length - 1),
              ),
            );
            setDraftRestored(true);
          } else if (storedDraft) {
            sessionStorage.removeItem(draftKey);
          }
        } catch {
          sessionStorage.removeItem(draftKey);
        }

        if (identity) {
          const newAnswers = {};
          const newConsents = {};
          steps.forEach((step) => {
            step.items.forEach((q) => {
              if (q.type === "group") {
                (q.subQuestions || []).forEach((sq) => {
                  if (sq.type === "national_id") {
                    newAnswers[sq.id] = formatThaiID(identity);
                    newConsents[sq.id] = true;
                  }
                });
              } else if (q.type === "national_id") {
                newAnswers[q.id] = formatThaiID(identity);
                newConsents[q.id] = true;
              }
            });
          });
          setAnswers((prev) => ({ ...prev, ...newAnswers }));
          setConsents((prev) => ({ ...prev, ...newConsents }));
        }
      };

      if (isPreviewMode) {
        try {
          const storedData = localStorage.getItem("formPreviewData");
          if (storedData) {
            setupFormStructure(JSON.parse(storedData), activeIdentity);
          } else {
            Swal.fire({
              icon: "error",
              title: "ไม่พบข้อมูล",
              text: "ไม่พบข้อมูลแบบร่างสำหรับการแสดงตัวอย่าง",
              confirmButtonColor: "var(--theme-color)",
            }).then(() => {
              navigate(-1);
            });
          }
        } catch (e) {
          Swal.fire({
            icon: "warning",
            title: "ข้อมูลผิดพลาด",
            text: "ข้อมูลแบบร่างมีความเสียหาย ไม่สามารถแสดงตัวอย่างได้",
            confirmButtonColor: "#f59e0b",
          }).then(() => {
            navigate(-1);
          });
        } finally {
          setLoading(false);
        }
        return;
      }

      if (urlToken) {
        setIsVerifyingToken(true);
        try {
          const res = await decodeSecureToken({ token: urlToken });
          if (res.data && res.data.identity) activeIdentity = res.data.identity;
        } catch (err) {
          Swal.fire({
            icon: "error",
            title: "ลิงก์ไม่ถูกต้อง",
            text: "ลิงก์นี้ไม่สามารถใช้งานได้ หรือถูกดัดแปลง",
            confirmButtonText: "ตกลง",
          });
        }
        setIsVerifyingToken(false);
      }

      setVerifiedIdentity(activeIdentity);

      try {
        const response = await getFormById(id);
        setupFormStructure(response.data, activeIdentity);
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "ข้อผิดพลาด",
          text: "ไม่พบแบบฟอร์มนี้ หรือเกิดข้อผิดพลาด",
          confirmButtonColor: "var(--theme-color)",
        }).then(() => {
          navigate("/");
        });
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchForm();
  }, [id, navigate, urlToken, fallbackIdentity, isPreviewMode]);

  const handleClearQuestionAnswer = (qId) => {
    setAnswers((prev) => {
      const newAns = { ...prev };
      delete newAns[qId];
      return newAns;
    });
    setErrors((prev) => {
      const newErr = { ...prev };
      delete newErr[qId];
      return newErr;
    });
    setOptionInputValues((prev) => {
      const newVals = { ...prev };
      Object.keys(newVals).forEach((key) => {
        if (key.startsWith(`${qId}_`)) delete newVals[key];
      });
      return newVals;
    });
  };

  const handleAnswer = (qId, val, isCheckbox = false) => {
    setErrors((prev) => ({ ...prev, [qId]: null }));
    if (isCheckbox) {
      setAnswers((prev) => {
        const current = prev[qId] || [];
        if (current.includes(val)) {
          const updatedInputValues = { ...optionInputValues };
          delete updatedInputValues[`${qId}_${val}`];
          setOptionInputValues(updatedInputValues);
          return { ...prev, [qId]: current.filter((item) => item !== val) };
        }
        return { ...prev, [qId]: [...current, val] };
      });
    } else {
      const updatedInputValues = { ...optionInputValues };
      Object.keys(updatedInputValues).forEach((key) => {
        if (key.startsWith(`${qId}_`) && key !== `${qId}_${val}`)
          delete updatedInputValues[key];
      });
      setOptionInputValues(updatedInputValues);
      setAnswers((prev) => ({ ...prev, [qId]: val }));
    }
  };

  const handleOptionInputChange = (qId, optValue, text) => {
    setOptionInputValues((prev) => ({ ...prev, [`${qId}_${optValue}`]: text }));
  };

  const handleConsent = (qId, value) => {
    setConsents((prev) => ({ ...prev, [qId]: value }));
    setErrors((prev) => ({ ...prev, [qId]: null }));
  };

  const handleGridAnswer = (qId, rowIndex, val, isCheckbox = false) => {
    setErrors((prev) => ({ ...prev, [qId]: null }));
    setAnswers((prev) => {
      const currentQAns = prev[qId] || {};
      if (isCheckbox) {
        const currentRowAns = currentQAns[rowIndex] || [];
        const newRowAns = currentRowAns.includes(val)
          ? currentRowAns.filter((item) => item !== val)
          : [...currentRowAns, val];
        return { ...prev, [qId]: { ...currentQAns, [rowIndex]: newRowAns } };
      }
      return { ...prev, [qId]: { ...currentQAns, [rowIndex]: val } };
    });
  };

  const validateStep = () => {
    const newErrors = {};
    let isValid = true;
    let firstErrorId = null;
    const stepData = groupedSteps[currentStep];

    const itemsToValidate = [];
    stepData.items.forEach((q) => {
      if (q.type === "group") itemsToValidate.push(...(q.subQuestions || []));
      else itemsToValidate.push(q);
    });

    itemsToValidate.forEach((q) => {
      const ans = answers[q.id];

      if (q.type === "national_id") {
        if (q.required && (!ans || ans.length !== 17)) {
          newErrors[q.id] = "กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก";
          if (!firstErrorId) firstErrorId = q.id;
          isValid = false;
        } else if (ans && ans.length === 17 && !validateThaiID(ans)) {
          newErrors[q.id] = "เลขบัตรประชาชนไม่ถูกต้อง";
          if (!firstErrorId) firstErrorId = q.id;
          isValid = false;
        } else if (ans && ans.length === 17 && consents[q.id] === undefined) {
          newErrors[q.id] = "กรุณากดรับทราบในการเก็บข้อมูล (ด้านล่างฟอร์ม)";
          if (!firstErrorId) firstErrorId = q.id;
          isValid = false;
        }
        return;
      }

      if (q.type === "phone_number") {
        if (q.required && (!ans || ans.replace(/\D/g, "").length !== 10)) {
          newErrors[q.id] = "กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก";
          if (!firstErrorId) firstErrorId = q.id;
          isValid = false;
        }
        return;
      }

      if (q.type === "bmi") {
        if (q.required && (!ans || !ans.weight || !ans.height)) {
          newErrors[q.id] = "กรุณากรอกทั้งน้ำหนักและส่วนสูงให้ครบถ้วน";
          if (!firstErrorId) firstErrorId = q.id;
          isValid = false;
        }
        return;
      }

      if (q.required) {
        let hasAnswer = false;
        if (q.type === "checkboxes") {
          hasAnswer = ans && ans.length > 0;
        } else if (q.type === "grid_multiple" || q.type === "grid_checkbox") {
          if (ans) {
            const answeredRowsCount = Object.keys(ans).filter((rowIndex) => {
              if (q.type === "grid_checkbox")
                return ans[rowIndex] && ans[rowIndex].length > 0;
              return !!ans[rowIndex];
            }).length;
            hasAnswer = answeredRowsCount > 0;
          }
        } else if (q.type === "file_upload") {
          hasAnswer = ans && ans.data;
        } else {
          hasAnswer = !!ans && String(ans).trim() !== "";
        }
        if (!hasAnswer) {
          newErrors[q.id] = "คำถามนี้จำเป็นต้องตอบ";
          if (!firstErrorId) firstErrorId = q.id;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    if (firstErrorId) {
      setTimeout(() => {
        const el = document.getElementById(`question-${firstErrorId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
    return isValid;
  };

  const handleFinalSubmit = async () => {
    if (!validateStep()) return;

    if (isPreviewMode) {
      Swal.fire({
        icon: "success",
        title: "จำลองการส่งข้อมูลสำเร็จ!",
        text: "นี่คือโหมดแสดงตัวอย่าง ข้อมูลจะไม่ถูกบันทึกลงฐานข้อมูลจริง",
        confirmButtonColor: "var(--theme-color)",
        confirmButtonText: "ตกลง",
      });
      return;
    }

    if (!patientToken && !canGuestSubmit(loginEnforcement)) {
      const loginResult = await Swal.fire({
        icon: "info",
        title: t("form_view.login_required_title"),
        text: t("form_view.login_required_desc"),
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: t("form_view.login_to_submit"),
        denyButtonText: t("form_view.register_to_submit"),
        cancelButtonText: t("form_view.review_answers"),
        buttonsStyling: false,
        customClass: {
          popup: "assessment-auth-dialog",
          actions: "assessment-auth-dialog__actions",
          confirmButton:
            "assessment-auth-dialog__button assessment-auth-dialog__button--primary",
          denyButton:
            "assessment-auth-dialog__button assessment-auth-dialog__button--secondary",
          cancelButton:
            "assessment-auth-dialog__button assessment-auth-dialog__button--tertiary",
        },
      });
      if (loginResult.isConfirmed) await continueToPatientLogin();
      if (loginResult.isDenied) await continueToPatientRegister();
      return;
    }

    try {
      const qTitles = getQuestionTitles(groupedSteps);
      const roleName = [],
        roleFaculty = [],
        roleIssue = [],
        rolePhone = [],
        scoreResultsArray = buildScoreResults(formData.questions, answers);

      const flatQuestions = [];
      formData.questions.forEach((q) => {
        if (q.type === "group") flatQuestions.push(...(q.subQuestions || []));
        else flatQuestions.push(q);
      });

      const mergedAnswers = { ...answers };

      flatQuestions.forEach((q) => {
        const rawAns = answers[q.id];
        if (!rawAns) return;

        if (q.type === "multiple_choice" && q.optionHasInput) {
          const optIdx = q.options.findIndex((o) => o === rawAns);
          if (optIdx !== -1 && q.optionHasInput[optIdx]) {
            const inputVal = optionInputValues[`${q.id}_${rawAns}`] || "";
            mergedAnswers[q.id] = inputVal ? `${rawAns} : ${inputVal}` : rawAns;
          }
        }

        if (
          q.type === "checkboxes" &&
          Array.isArray(rawAns) &&
          q.optionHasInput
        ) {
          const mergedArr = rawAns.map((checkedOpt) => {
            const optIdx = q.options.findIndex((o) => o === checkedOpt);
            if (optIdx !== -1 && q.optionHasInput[optIdx]) {
              const inputVal = optionInputValues[`${q.id}_${checkedOpt}`] || "";
              return inputVal ? `${checkedOpt} : ${inputVal}` : checkedOpt;
            }
            return checkedOpt;
          });
          mergedAnswers[q.id] = mergedArr;
        }

        let textVal = "";
        if (q.type === "bmi") {
          const w = parseFloat(rawAns.weight) || 0;
          const hCm = parseFloat(rawAns.height) || 0;
          let calcBmi = 0;
          if (w > 0 && hCm > 0)
            calcBmi = Number((w / Math.pow(hCm / 100, 2)).toFixed(2));
          textVal = `น้ำหนัก ${w} กก., ส่วนสูง ${hCm} ซม. (BMI: ${calcBmi})`;
        } else if (q.type === "file_upload") {
          textVal = mergedAnswers[q.id]
            ? `ไฟล์: ${mergedAnswers[q.id].name}`
            : "";
        } else {
          const currentMergedAns = mergedAnswers[q.id];
          textVal = Array.isArray(currentMergedAns)
            ? currentMergedAns.join(", ")
            : typeof currentMergedAns === "object"
              ? JSON.stringify(currentMergedAns)
              : currentMergedAns;
        }

        if (q.type === "full_name" || q.systemRole === "name")
          roleName.push(textVal);
        if (q.type === "faculty" || q.systemRole === "faculty")
          roleFaculty.push(textVal);
        if (q.type === "main_issue" || q.systemRole === "issue")
          roleIssue.push(textVal);
        if (q.type === "phone_number") rolePhone.push(textVal);
      });

      const rawAnswersToSave = {};
      for (const key in mergedAnswers) {
        const qTitle = qTitles[key] || key;
        const qDef = flatQuestions.find((q) => q.id === key);

        if (qDef && qDef.type === "bmi") {
          const w = parseFloat(mergedAnswers[key].weight) || 0;
          const h = parseFloat(mergedAnswers[key].height) || 0;
          let calcBmi = 0;
          if (w > 0 && h > 0)
            calcBmi = Number((w / Math.pow(h / 100, 2)).toFixed(2));
          rawAnswersToSave[qTitle] =
            `น้ำหนัก ${w} กก. | ส่วนสูง ${h} ซม. | BMI: ${calcBmi}`;
        } else if (
          qDef &&
          (qDef.type === "grid_multiple" || qDef.type === "grid_checkbox")
        ) {
          const gridAns = mergedAnswers[key];
          const formattedGrid = {};
          if (typeof gridAns === "object" && gridAns !== null) {
            Object.keys(gridAns).forEach((rowIdx) => {
              const rowTitleText = qDef.rows[rowIdx]
                ? qDef.rows[rowIdx].replace(/<[^>]+>/g, "").trim()
                : `แถวที่ ${Number(rowIdx) + 1}`;
              formattedGrid[rowTitleText] = Array.isArray(gridAns[rowIdx])
                ? gridAns[rowIdx].join(", ")
                : gridAns[rowIdx];
            });
          }
          rawAnswersToSave[qTitle] = formattedGrid;
        } else if (qDef && qDef.type === "file_upload") {
          rawAnswersToSave[qTitle] = mergedAnswers[key]
            ? `ไฟล์: ${mergedAnswers[key].name}`
            : "-";
        } else {
          rawAnswersToSave[qTitle] = Array.isArray(mergedAnswers[key])
            ? mergedAnswers[key].join(", ")
            : mergedAnswers[key];
        }
      }

      const sumData = {
        display_name: roleName.length > 0 ? roleName.join(" ") : "-",
        display_phone: rolePhone.length > 0 ? rolePhone.join(", ") : "-",
        display_faculty: roleFaculty.length > 0 ? roleFaculty.join(", ") : "-",
        main_issue: roleIssue.length > 0 ? roleIssue.join(", ") : "-",
        score_results: scoreResultsArray,
        raw_answers: rawAnswersToSave,
        consent_given: false,
      };

      const hasBooking = formData?.questions?.some(
        (q) =>
          q.type === "booking" ||
          (q.type === "group" &&
            q.subQuestions?.some((sq) => sq.type === "booking")),
      );

      const payload = {
        answers: mergedAnswers,
        questionTitles: qTitles,
        summaryData: sumData,
      };

      const confirmResult = await Swal.fire({
        title: t("assessment_result.consent_title"),
        html: t("assessment_result.consent_html"),
        icon: "question",
        showCloseButton: true,
        showCancelButton: true,
        confirmButtonColor: "#3b82f6",
        cancelButtonColor: "#ef4444",
        confirmButtonText: t("assessment_result.agree"),
        cancelButtonText: t("assessment_result.decline"),
        width: "500px",
        padding: "2.5em",
        background: "#ffffff",
        customClass: {
          popup: "assessment-consent-dialog",
        },
      });

      if (!confirmResult.isConfirmed) return;

      setIsSubmitting(true);
      Swal.fire({
        title: t("assessment_result.sending"),
        text: t("assessment_result.please_wait"),
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      try {
        await submitFormAnswers(id, payload);
      } catch (submitError) {
        setIsSubmitting(false);
        if (submitError.response?.status === 401) {
          Swal.close();
          clearPatientSession();
          await continueToPatientLogin();
          return;
        }
        Swal.fire({
          icon: "error",
          title: t("assessment_result.send_error"),
          text: t("assessment_result.send_error_desc"),
          confirmButtonColor: "#ef4444",
        });
        return;
      }
      setIsSubmitting(false);
      sessionStorage.removeItem(draftKey);

      await Swal.fire({
        icon: "success",
        title: t("assessment_result.send_success"),
        text: t("assessment_result.send_success_desc"),
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false,
      });

      navigate("/assessment-result", {
        state: {
          results: scoreResultsArray,
          formId: id,
          hasBooking: hasBooking,
          isSaved: true,
          resultDisplayMode: normalizeResultDisplayMode(resultDisplayMode),
          payload,
        },
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "ข้อผิดพลาด",
        text: "เกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "var(--theme-color)",
      });
    }
  };

  const theme = formData?.theme || {};
  const interactiveResults = useMemo(
    () => buildScoreResults(formData?.questions || [], answers),
    [formData?.questions, answers],
  );
  const totalScoredTargets = useMemo(
    () => countScoredTargets(formData?.questions || []),
    [formData?.questions],
  );
  const hasInteractiveResults =
    totalScoredTargets > 0 && shouldShowRealtimeResults(resultDisplayMode);
  const bannerType = theme.bannerType || "none";
  const bannerBgColor = theme.bannerBgColor || "#4285f4";
  const headerImage = theme.headerImage || null;
  const bannerText = theme.bannerText || "";
  const bannerTextAlign = theme.bannerTextAlign || "center";

  if (loading || isVerifyingToken)
    return (
      <div className="preview-loading">
        <div style={{ textAlign: "center" }}>
          <div className="spinner"></div>
          <p style={{ marginTop: "16px", color: "#64748b" }}>
            {isVerifyingToken
              ? "กำลังตรวจสอบความปลอดภัยของลิงก์..."
              : "กำลังเตรียมแบบประเมิน..."}
          </p>
        </div>
      </div>
    );

  if (!formData)
    return <div className="preview-loading">ไม่พบข้อมูลแบบประเมิน</div>;

  const nationalIdQuestions = (groupedSteps[currentStep]?.items || [])
    .flatMap((q) => (q.type === "group" ? q.subQuestions || [] : [q]))
    .filter((q) => q.type === "national_id");

  const stepData = groupedSteps[currentStep];

  return (
    <div
      className="preview-page form-view-page"
      style={{
        "--theme-color": theme.color || "#673ab7",
        "--bg-color": theme.bg || "#f0f2f5",
      }}
    >
      {isPreviewMode && (
        <div
          style={{
            background: "#ff9800",
            color: "#fff",
            textAlign: "center",
            padding: "8px 15px",
            position: "sticky",
            top: 0,
            zIndex: 10000,
            fontWeight: "bold",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <FiInfo size={16} /> โหมดแสดงตัวอย่าง (Preview Mode) -
          ข้อมูลจะไม่ถูกบันทึกจริง
        </div>
      )}

      {!isPreviewMode && (
        <>
          <button
            className="form-view-back-btn"
            onClick={() => navigate(-1)}
            title="ย้อนกลับ"
          >
            <FiArrowLeft />
          </button>
          <div
            style={{
              position: "fixed",
              top: "15px",
              right: "15px",
              zIndex: 1000,
            }}
          >
            <LanguageSwitcher darkText={true} />
          </div>
        </>
      )}

      {!isPreviewMode && patientToken && (
        <aside
          className="preview-auth-notice is-authenticated"
          aria-live="polite"
        >
          <div className="preview-auth-notice__inner">
            <span className="preview-auth-notice__icon" aria-hidden="true">
              <FiShield />
            </span>
            <div className="preview-auth-notice__copy">
              <strong>
                {t("form_view.login_notice_ready")}
              </strong>
              <span>
                {draftRestored
                  ? t("form_view.draft_restored")
                  : t("form_view.login_notice_ready_desc")}
              </span>
            </div>
          </div>
        </aside>
      )}

      {bannerType !== "none" && (
        <div
          className="preview-full-banner"
          style={{
            backgroundColor:
              bannerType === "color" ? bannerBgColor : "transparent",
            backgroundImage:
              bannerType === "image" && headerImage
                ? `url(${headerImage})`
                : "none",
          }}
        >
          <div className="preview-banner-overlay"></div>
          {bannerText && (
            <div
              className="preview-banner-text"
              style={{ textAlign: bannerTextAlign }}
              dangerouslySetInnerHTML={{ __html: bannerText }}
            />
          )}
        </div>
      )}

      {groupedSteps.length > 1 && (
        <div
          className="preview-stepbar"
          style={isPreviewMode ? { top: "38px" } : {}}
        >
          <div className="preview-stepbar__inner">
            {groupedSteps.map((group, i) => {
              const state =
                i < currentStep
                  ? "done"
                  : i === currentStep
                    ? "active"
                    : "idle";
              return (
                <div key={i} className="preview-stepbar__item">
                  <div
                    className={`preview-stepbar__dot preview-stepbar__dot--${state}`}
                  >
                    {i < currentStep ? <FiCheck /> : i + 1}
                  </div>
                  <span
                    className={`preview-stepbar__label preview-stepbar__label--${state}`}
                  >
                    {group.stepName}
                  </span>
                  {i < groupedSteps.length - 1 && (
                    <div
                      className={`preview-stepbar__line ${i < currentStep ? "done" : ""}`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        className={`preview-container ${hasInteractiveResults ? "preview-container--interactive" : ""}`}
      >
        <div
          className={`form-view-workspace ${hasInteractiveResults ? "form-view-workspace--interactive" : ""}`}
        >
        <form className="preview-form" onSubmit={(e) => e.preventDefault()}>
          <div className="preview-step-intro">
            <h2
              className="preview-step-intro__title"
              dangerouslySetInnerHTML={{
                __html:
                  translatedStep?.title ||
                  stepData?.title ||
                  "ส่วนที่ไม่มีชื่อ",
              }}
            />
            {(translatedStep?.desc || stepData?.desc) && (
              <p
                dangerouslySetInnerHTML={{
                  __html: translatedStep?.desc || stepData.desc,
                }}
              />
            )}
            <p className="req" style={{ marginTop: "10px" }}>
              * {t("form_view.req_asterisk")}
            </p>
          </div>

          {/* 🟢 เรียกใช้ QuestionRenderer ที่ถูกแยกไฟล์ออกไป */}
          {stepData?.items.map((q, idx) => (
            <QuestionRenderer
              key={q.id}
              q={q}
              index={idx}
              answers={answers}
              errors={errors}
              verifiedIdentity={verifiedIdentity}
              optionInputValues={optionInputValues}
              optionUsage={formData?.optionUsage}
              handleClearQuestionAnswer={handleClearQuestionAnswer}
              handleAnswer={handleAnswer}
              handleOptionInputChange={handleOptionInputChange}
              handleGridAnswer={handleGridAnswer}
            />
          ))}

          {hasInteractiveResults && (
            <InteractiveResultPanel
              className="assessment-live-results--mobile"
              results={interactiveResults}
              totalTargets={totalScoredTargets}
              isAuthenticated={Boolean(patientToken)}
            />
          )}

          {nationalIdQuestions.some(
            (q) => (answers[q.id] || "").length === 17,
          ) &&
            !verifiedIdentity && (
              <div className="preview-sec pdpa-friendly-wrapper">
                <div className="pdpa-header">
                  <FiInfo /> {t("form_view.pdpa_title")}
                </div>
                <p className="pdpa-desc">
                  {t("form_view.pdpa_desc")}
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#9aa0a6",
                      fontStyle: "italic",
                    }}
                  >
                    {" "}
                    {t("form_view.pdpa_secret")}{" "}
                  </span>
                </p>
                {nationalIdQuestions
                  .filter((q) => (answers[q.id] || "").length === 17)
                  .map((q) => (
                    <div
                      key={q.id}
                      className="pdpa-options"
                      style={{ marginTop: "16px" }}
                    >
                      <label
                        className={`pdpa-status-card ${consents[q.id] === true ? "active" : ""}`}
                      >
                        <input
                          type="checkbox"
                          style={{ display: "none" }}
                          name={`pdpa_${q.id}`}
                          checked={consents[q.id] === true}
                          onChange={() => handleConsent(q.id, true)}
                        />
                        <div className="pdpa-check-circle">
                          {consents[q.id] === true && <FiCheck />}
                        </div>
                        <span style={{ fontWeight: "600", fontSize: "15px" }}>
                          {t("form_view.pdpa_ack")}
                        </span>
                      </label>
                    </div>
                  ))}
              </div>
            )}

          <div className="preview-actions-container">
            <button
              type="button"
              className="clear-all-btn"
              onClick={() => {
                // 🟢 เปลี่ยน confirm เป็น SweetAlert2
                Swal.fire({
                  title: t("form_view.clear_form_confirm_title"),
                  text: t("form_view.clear_form_confirm_desc"),
                  icon: "warning",
                  showCancelButton: true,
                  confirmButtonColor: "#d93025",
                  cancelButtonColor: "#64748b",
                  confirmButtonText: t("form_view.clear_form_yes"),
                  cancelButtonText: t("form_view.clear_form_cancel"),
                }).then((result) => {
                  if (result.isConfirmed) {
                    const retainedAnswers = {};
                    const retainedConsents = {};

                    if (verifiedIdentity) {
                      nationalIdQuestions.forEach((q) => {
                        retainedAnswers[q.id] = formatThaiID(verifiedIdentity);
                        retainedConsents[q.id] = true;
                      });
                    }

                    setAnswers(retainedAnswers);
                    setConsents(retainedConsents);
                    setOptionInputValues({});
                    setErrors({});
                  }
                });
              }}
            >
              <FiTrash2 /> {t("form_view.clear_form")}
            </button>

            <div className="preview-actions-nav">
              {currentStep > 0 && (
                <button
                  type="button"
                  className="preview-btn preview-btn--ghost"
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                    setCurrentStep((s) => s - 1);
                  }}
                >
                  <FiArrowLeft style={{ marginRight: "6px" }} />{" "}
                  {t("form_view.btn_prev")}
                </button>
              )}
              {currentStep < groupedSteps.length - 1 ? (
                <button
                  type="button"
                  className="preview-btn preview-btn--primary"
                  onClick={() => {
                    if (validateStep()) {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                      setCurrentStep((s) => s + 1);
                    }
                  }}
                >
                  {t("form_view.btn_next")}{" "}
                  <FiArrowRight style={{ marginLeft: "6px" }} />
                </button>
              ) : (
                <button
                  type="button"
                  className="preview-btn preview-btn--primary"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                >
                  <FiCheck style={{ marginRight: "6px" }} />{" "}
                  {isSubmitting
                    ? t("assessment_result.sending")
                    : t("form_view.btn_submit")}
                </button>
              )}
            </div>
          </div>
        </form>
        {hasInteractiveResults && (
          <InteractiveResultPanel
            className="assessment-live-results--desktop"
            results={interactiveResults}
            totalTargets={totalScoredTargets}
            isAuthenticated={Boolean(patientToken)}
          />
        )}
        </div>
      </div>

      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          style={{
            position: "fixed",
            bottom: "32px",
            right: "32px",
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: theme.color || "#673ab7",
            color: "#fff",
            border: "none",
            padding: "0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            fontSize: "22px",
            lineHeight: "1",
            overflow: "visible",
            zIndex: 999,
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          title={t("form_view.scroll_top")}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px)";
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.2)";
          }}
        >
          <FiArrowUp size={22} />
        </button>
      )}
    </div>
  );
};

export default FormView;
