import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  FiArrowLeft,
  FiArrowRight,
  FiTrash2,
  FiCheck,
  FiArrowUp,
  FiInfo,
} from "react-icons/fi";
import {
  getFormById,
  decodeSecureToken,
} from "../../../services/api";
import Swal from "sweetalert2";
import "../../admin/forms/styles/FormPreview.css";
import LanguageSwitcher from "../../../components/LanguageSwitcher.jsx";

// 🟢 นำเข้า Component และ Helper ที่แยกออกไป
import {
  formatThaiID,
  validateThaiID,
  getQuestionTitles,
  calculateQuestionScore,
} from "./formUtils";
import QuestionRenderer from "./QuestionRenderer";
import { useTranslation } from "react-i18next";
import { translateTextSmart } from "../../../utils/translator";

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

  useEffect(() => {
    let isMounted = true;
    const translateStep = async () => {
      const stepData = groupedSteps[currentStep];
      if (!stepData) return;
      
      if (i18n.language !== 'en') {
        if (isMounted) setTranslatedStep(null);
        return;
      }
      
      const tTitle = stepData.title ? await translateTextSmart(stepData.title) : '';
      const tDesc = stepData.desc ? await translateTextSmart(stepData.desc) : '';
      
      if (isMounted) setTranslatedStep({ title: tTitle, desc: tDesc });
    };
    translateStep();
    return () => { isMounted = false; };
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
              icon: 'error',
              title: 'ไม่พบข้อมูล',
              text: 'ไม่พบข้อมูลแบบร่างสำหรับการแสดงตัวอย่าง',
              confirmButtonColor: 'var(--theme-color)'
            }).then(() => {
              navigate(-1);
            });
          }
        } catch (e) {
          Swal.fire({
            icon: 'warning',
            title: 'ข้อมูลผิดพลาด',
            text: 'ข้อมูลแบบร่างมีความเสียหาย ไม่สามารถแสดงตัวอย่างได้',
            confirmButtonColor: '#f59e0b'
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
          icon: 'error',
          title: 'ข้อผิดพลาด',
          text: 'ไม่พบแบบฟอร์มนี้ หรือเกิดข้อผิดพลาด',
          confirmButtonColor: 'var(--theme-color)'
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
          newErrors[q.id] =
            "กรุณากดรับทราบในการเก็บข้อมูล (ด้านล่างฟอร์ม)";
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

    try {
      const qTitles = getQuestionTitles(groupedSteps);
      let idValue = "-";
      let consentGiven = false;
      const roleName = [],
        roleFaculty = [],
        roleIssue = [],
        rolePhone = [],
        scoreResultsArray = [];

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

        if (q.isIdentity || q.type === "national_id") {
          if (q.type === "national_id") {
            if (consents[q.id] === true) {
              idValue = rawAns.replace(/-/g, "");
              consentGiven = true;
            } else {
              idValue = "Anonymous";
            }
          } else {
            idValue = rawAns;
          }
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
          textVal = mergedAnswers[q.id] ? `ไฟล์: ${mergedAnswers[q.id].name}` : "";
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

      formData.questions.forEach((q) => {
        if (q.type === "group") {
          if (q.isScored) {
            let groupTotalScore = 0;
            let groupHasAnswer = false;

            (q.subQuestions || []).forEach((sq) => {
              const ans = answers[sq.id];
              if (ans !== undefined && ans !== null && ans !== "") {
                groupHasAnswer = true;
                groupTotalScore += calculateQuestionScore(sq, ans);
              }
            });

            if (groupHasAnswer) {
              let matchedLabel = "ประเมินผลเสร็จสิ้น",
                matchedColor = "#1967d2",
                matchedAdvice = "";
              if (q.scoringRules && q.scoringRules.length > 0) {
                const rule = q.scoringRules.find(
                  (r) => groupTotalScore >= r.min && groupTotalScore <= r.max,
                );
                if (rule) {
                  matchedLabel = rule.label || matchedLabel;
                  matchedColor = rule.color || matchedColor;
                  matchedAdvice = rule.advice || matchedAdvice;
                }
              }
              scoreResultsArray.push({
                question_id: q.id,
                title: q.title ? q.title.replace(/<[^>]+>/g, "") : "กลุ่มคำถาม",
                score: groupTotalScore,
                label: matchedLabel,
                color: matchedColor,
                advice: matchedAdvice,
              });
            }
          } else {
            (q.subQuestions || []).forEach((sq) => {
              const ans = answers[sq.id];
              if (
                ans !== undefined &&
                ans !== null &&
                ans !== "" &&
                sq.isScored
              ) {
                const totalScore = calculateQuestionScore(sq, ans);
                let matchedLabel = "ประเมินผลเสร็จสิ้น",
                  matchedColor = "#1967d2",
                  matchedAdvice = "";
                if (sq.scoringRules && sq.scoringRules.length > 0) {
                  const rule = sq.scoringRules.find(
                    (r) => totalScore >= r.min && totalScore <= r.max,
                  );
                  if (rule) {
                    matchedLabel = rule.label || matchedLabel;
                    matchedColor = rule.color || matchedColor;
                    matchedAdvice = rule.advice || matchedAdvice;
                  }
                }
                scoreResultsArray.push({
                  question_id: sq.id,
                  title: sq.title ? sq.title.replace(/<[^>]+>/g, "") : "คำถาม",
                  score: totalScore,
                  label: matchedLabel,
                  color: matchedColor,
                  advice: matchedAdvice,
                });
              }
            });
          }
        } else {
          const ans = answers[q.id];
          if (ans !== undefined && ans !== null && ans !== "" && q.isScored) {
            const totalScore = calculateQuestionScore(q, ans);
            let matchedLabel = "ประเมินผลเสร็จสิ้น",
              matchedColor = "#1967d2",
              matchedAdvice = "";
            if (q.scoringRules && q.scoringRules.length > 0) {
              const rule = q.scoringRules.find(
                (r) => totalScore >= r.min && totalScore <= r.max,
              );
              if (rule) {
                matchedLabel = rule.label || matchedLabel;
                matchedColor = rule.color || matchedColor;
                matchedAdvice = rule.advice || matchedAdvice;
              }
            }
            scoreResultsArray.push({
              question_id: q.id,
              title: q.title ? q.title.replace(/<[^>]+>/g, "") : "คำถาม",
              score: totalScore,
              label: matchedLabel,
              color: matchedColor,
              advice: matchedAdvice,
            });
          }
        }
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
          rawAnswersToSave[qTitle] = mergedAnswers[key] ? `ไฟล์: ${mergedAnswers[key].name}` : "-";
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
        consent_given: consentGiven,
      };

      const hasBooking = formData?.questions?.some(q => q.type === 'booking' || (q.type === 'group' && q.subQuestions?.some(sq => sq.type === 'booking')));

      // 🟢 นำ Payload ทั้งหมดส่งไปหน้า AssessmentResult โดยที่ยังไม่ต้องยิง API บันทึกข้อมูล
      navigate("/assessment-result", { 
        state: { 
          results: scoreResultsArray,
          formId: id,
          hasBooking: hasBooking,
          payload: {
            answers: mergedAnswers,
            questionTitles: qTitles,
            identityValue: idValue,
            summaryData: sumData
          }
        } 
      });

    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'ข้อผิดพลาด',
        text: 'เกิดข้อผิดพลาดในการประมวลผลข้อมูล กรุณาลองใหม่อีกครั้ง',
        confirmButtonColor: 'var(--theme-color)'
      });
    }
  };

  const theme = formData?.theme || {};
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
      className="preview-page"
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
    <div style={{ position: 'fixed', top: '15px', right: '15px', zIndex: 1000 }}>
      <LanguageSwitcher darkText={true} />
    </div>
  </>
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

      <div className="preview-container">
        <form className="preview-form" onSubmit={(e) => e.preventDefault()}>
          <div className="preview-step-intro">
            <h2
              className="preview-step-intro__title"
              dangerouslySetInnerHTML={{
                __html: translatedStep?.title || stepData?.title || "ส่วนที่ไม่มีชื่อ",
              }}
            />
            {(translatedStep?.desc || stepData?.desc) && (
              <p dangerouslySetInnerHTML={{ __html: translatedStep?.desc || stepData.desc }} />
            )}
            <p className="req" style={{ marginTop: "10px" }}>
              * {t('form_view.req_asterisk')}
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

          {nationalIdQuestions.some(
            (q) => (answers[q.id] || "").length === 17,
          ) &&
            !verifiedIdentity && (
              <div className="preview-sec pdpa-friendly-wrapper" >
                <div className="pdpa-header">
                  <FiInfo /> {t('form_view.pdpa_title')}
                </div>
                <p className="pdpa-desc">
                  {t('form_view.pdpa_desc')}
                  <span style={{ fontSize: '12px', color: '#9aa0a6', fontStyle: 'italic' }}> {t('form_view.pdpa_secret')} </span>
                </p>
                {nationalIdQuestions
                  .filter((q) => (answers[q.id] || "").length === 17)
                  .map((q) => (
                    <div key={q.id} className="pdpa-options" style={{ marginTop: '16px' }}>
                      <label className={`pdpa-status-card ${consents[q.id] === true ? "active" : ""}`}>
                        <input
                          type="checkbox"
                          style={{ display: 'none' }}
                          name={`pdpa_${q.id}`}
                          checked={consents[q.id] === true}
                          onChange={() => handleConsent(q.id, true)}
                        />
                        <div className="pdpa-check-circle">
                          {consents[q.id] === true && <FiCheck />}
                        </div>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>{t('form_view.pdpa_ack')}</span>
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
                  title: t('form_view.clear_form_confirm_title'),
                  text: t('form_view.clear_form_confirm_desc'),
                  icon: 'warning',
                  showCancelButton: true,
                  confirmButtonColor: '#d93025',
                  cancelButtonColor: '#64748b',
                  confirmButtonText: t('form_view.clear_form_yes'),
                  cancelButtonText: t('form_view.clear_form_cancel')
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
              <FiTrash2 /> {t('form_view.clear_form')}
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
                  <FiArrowLeft style={{ marginRight: "6px" }} /> {t('form_view.btn_prev')}
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
                  {t('form_view.btn_next')} <FiArrowRight style={{ marginLeft: "6px" }} />
                </button>
              ) : (
                <button
                  type="button"
                  className="preview-btn preview-btn--primary"
                  onClick={handleFinalSubmit}
                >
                  <FiCheck style={{ marginRight: "6px" }} /> {t('form_view.btn_submit')}
                </button>
              )}
            </div>
          </div>
        </form>
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
          title={t('form_view.scroll_top')}
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