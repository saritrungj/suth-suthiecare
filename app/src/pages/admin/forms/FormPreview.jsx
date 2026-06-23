import React, { useEffect, useState } from "react";
import "./styles/FormPreview.css";

// 🟢 ฟังก์ชันจัดฟอร์แมตเลขบัตร (x-xxxx-xxxxx-xx-x)
const formatThaiID = (value) => {
  const val = value.replace(/\D/g, "");
  if (val.length <= 1) return val;
  if (val.length <= 5) return `${val.slice(0, 1)}-${val.slice(1)}`;
  if (val.length <= 10)
    return `${val.slice(0, 1)}-${val.slice(1, 5)}-${val.slice(5)}`;
  if (val.length <= 12)
    return `${val.slice(0, 1)}-${val.slice(1, 5)}-${val.slice(5, 10)}-${val.slice(10)}`;
  return `${val.slice(0, 1)}-${val.slice(1, 5)}-${val.slice(5, 10)}-${val.slice(10, 12)}-${val.slice(12, 13)}`;
};

// 🟢 ฟังก์ชันตรวจสอบความถูกต้องของเลขบัตร 13 หลัก
const validateThaiID = (id) => {
  let val = id.replace(/\D/g, "");
  if (val.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseFloat(val.charAt(i)) * (13 - i);
  let checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseFloat(val.charAt(12));
};

// 🟢 ฟังก์ชันจัดฟอร์แมตเบอร์โทรศัพท์ (0xx-xxx-xxxx)
const formatPhoneNumber = (value) => {
  const val = value.replace(/\D/g, "");
  if (val.length <= 3) return val;
  if (val.length <= 6) return `${val.slice(0, 3)}-${val.slice(3)}`;
  return `${val.slice(0, 3)}-${val.slice(3, 6)}-${val.slice(6, 10)}`;
};

const FormPreview = () => {
  const [formData, setFormData] = useState(null);
  const [groupedSteps, setGroupedSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const [consents, setConsents] = useState({});

  // 🟢 1. สร้าง State สำหรับเก็บข้อความที่ผู้ใช้พิมพ์ในช่อง "อื่นๆ: ___"
  const [optionInputValues, setOptionInputValues] = useState({});

  useEffect(() => {
    // โหลดข้อมูลจาก LocalStorage
    let dataStr = null;
    if (window.__formPreviewData) {
      dataStr = JSON.stringify(window.__formPreviewData);
    } else {
      dataStr = localStorage.getItem("formPreviewData");
    }

    if (dataStr) {
      try {
        const data = JSON.parse(dataStr);
        setFormData(data);

        // แบ่ง Section
        const steps = [];
        let currentGroup = {
          id: "main",
          title: data.title,
          stepName: data.formStepName || "ส่วนที่ 1",
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
      } catch (err) {
        console.error("Preview parse error:", err);
      }
    }
  }, []);

  // 🟢 2. ปรับปรุง handleAnswer ให้เคลียร์ค่า Input เมื่อยกเลิกการติ๊ก
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
        if (key.startsWith(`${qId}_`) && key !== `${qId}_${val}`) {
          delete updatedInputValues[key];
        }
      });
      setOptionInputValues(updatedInputValues);
      setAnswers((prev) => ({ ...prev, [qId]: val }));
    }
  };

  // 🟢 3. ฟังก์ชันสำหรับรับค่าจากช่อง Input ที่แนบมากับตัวเลือก
  const handleOptionInputChange = (qId, optValue, text) => {
    setOptionInputValues((prev) => ({
      ...prev,
      [`${qId}_${optValue}`]: text,
    }));
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
      } else {
        return { ...prev, [qId]: { ...currentQAns, [rowIndex]: val } };
      }
    });
  };

  const validateStep = () => {
    const newErrors = {};
    let isValid = true;
    const stepData = groupedSteps[currentStep];

    stepData.items.forEach((q) => {
      const ans = answers[q.id];

      if (q.type === "national_id") {
        if (q.required && (!ans || ans.length !== 17)) {
          newErrors[q.id] = "กรุณากรอกเลขบัตรประชาชนให้ครบ 13 หลัก";
          isValid = false;
        } else if (ans && ans.length === 17 && !validateThaiID(ans)) {
          newErrors[q.id] = "เลขบัตรประชาชนไม่ถูกต้อง";
          isValid = false;
        } else if (ans && ans.length === 17 && consents[q.id] === undefined) {
          newErrors[q.id] = "กรุณาเลือกความยินยอมในการเก็บข้อมูล";
          isValid = false;
        }
        return;
      }

      if (q.type === "phone_number") {
        if (q.required && (!ans || ans.replace(/\D/g, "").length !== 10)) {
          newErrors[q.id] = "กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก";
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
            hasAnswer = answeredRowsCount === q.rows.length;
          }
        } else {
          hasAnswer = !!ans && String(ans).trim() !== "";
        }

        if (!hasAnswer) {
          newErrors[q.id] = "คำถามนี้จำเป็นต้องตอบ";
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const renderQuestion = (q, index) => {
    const ans = answers[q.id];
    const hasError = !!errors[q.id];

    return (
      <div
        key={q.id}
        className={`preview-sec ${hasError ? "preview-sec--error" : ""}`}
      >
        <div className="preview-sec__head">
          <div style={{ flex: 1 }}>
            <h3
              className="preview-sec__title"
              dangerouslySetInnerHTML={{
                __html: q.title || "คำถามที่ไม่มีชื่อ",
              }}
            />
            {q.required && <span className="req">*</span>}
            {q.hasDescription && q.text && (
              <div
                className="preview-hint"
                dangerouslySetInnerHTML={{ __html: q.text }}
              />
            )}
          </div>
        </div>

        <div className="preview-sec__body">
          {q.image && (
            <div className="preview-q-img">
              <img src={q.image} alt="question" />
            </div>
          )}

          {(q.type === "short_text" || q.type === "full_name") && (
            <input
              type="text"
              className={`preview-input ${hasError ? "preview-input--error" : ""}`}
              placeholder="คำตอบของคุณ"
              value={ans || ""}
              onChange={(e) => handleAnswer(q.id, e.target.value)}
            />
          )}

          {(q.type === "paragraph" || q.type === "main_issue") && (
            <textarea
              className={`preview-input ${hasError ? "preview-input--error" : ""}`}
              placeholder="คำตอบของคุณ"
              rows="4"
              value={ans || ""}
              onChange={(e) => handleAnswer(q.id, e.target.value)}
            ></textarea>
          )}

          {q.type === "phone_number" && (
            <input
              type="tel"
              className={`preview-input ${hasError ? "preview-input--error" : ""}`}
              placeholder="0xx-xxx-xxxx"
              value={ans || ""}
              onChange={(e) =>
                handleAnswer(q.id, formatPhoneNumber(e.target.value))
              }
              maxLength={12}
            />
          )}

          {q.type === "date" && (
            <input
              type="date"
              className={`preview-input ${hasError ? "preview-input--error" : ""}`}
              value={ans || ""}
              onChange={(e) => handleAnswer(q.id, e.target.value)}
            />
          )}

          {q.type === "national_id" &&
            (() => {
              const val = answers[q.id] || "";
              const isTyping = val.length > 0;
              const isFullLength = val.length === 17;
              const isValid = isFullLength ? validateThaiID(val) : true;

              return (
                <div className="national-id-wrapper">
                  <input
                    type="text"
                    className={`preview-input id-mask-input ${hasError || !isValid ? "preview-input--error" : ""}`}
                    placeholder="x-xxxx-xxxxx-xx-x"
                    value={val}
                    onChange={(e) =>
                      handleAnswer(q.id, formatThaiID(e.target.value))
                    }
                    maxLength={17}
                  />

                  {isFullLength && !isValid && (
                    <div className="error-msg">
                      ❌ เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง
                    </div>
                  )}

                  {isTyping && (
                    <div className="pdpa-box ">
                      <div className="pdpa-header">
                        {" "}
                        ยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)
                      </div>
                      <p className="pdpa-desc">
                        ระบบจำเป็นต้องใช้เลขบัตรประชาชนของคุณ
                        เพื่อใช้ในการบันทึกและแสดงประวัติการประเมินย้อนหลัง
                        เพื่อให้คุณสามารถติดตามผลการดูแลตัวเองได้อย่างต่อเนื่อง
                        <span className="pdpa-sub-desc">
                          (ข้อมูลนี้จะถูกเก็บรักษาเป็นความลับ)
                        </span>
                      </p>
                      <div className="pdpa-options">
                        <label
                          className={`pdpa-radio ${consents[q.id] === true ? "active" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`pdpa_${q.id}`}
                            checked={consents[q.id] === true}
                            onChange={() => handleConsent(q.id, true)}
                          />
                          <span>รับทราบ</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          {/* 🟢 4. อัปเดต UI สำหรับ Multiple Choice */}
          {q.type === "multiple_choice" && (
            <div className="preview-chip-col">
              {q.options.map((opt, i) => {
                const isSelected = ans === opt;
                const showInput = q.optionHasInput?.[i] === true;

                return (
                  <div key={i} className="preview-option-wrapper">
                    <label
                      className={`preview-chip ${isSelected ? "active" : ""}`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={isSelected}
                        onChange={() => handleAnswer(q.id, opt)}
                      />
                      <span dangerouslySetInnerHTML={{ __html: opt }} />
                    </label>

                    {isSelected && showInput && (
                      <div
                        style={{
                          marginLeft: "30px",
                          animation: "fadeIn 0.2s ease-out",
                        }}
                      >
                        <input
                          type="text"
                          className="preview-input"
                          placeholder="โปรดระบุรายละเอียด..."
                          value={optionInputValues[`${q.id}_${opt}`] || ""}
                          onChange={(e) =>
                            handleOptionInputChange(q.id, opt, e.target.value)
                          }
                          style={{
                            fontSize: "14px",
                            padding: "6px 0",
                            borderBottomColor: "var(--theme-color)",
                            maxWidth: "300px",
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                    {q.optionImages && q.optionImages[i] && (
                      <img
                        src={q.optionImages[i]}
                        alt="option"
                        className="preview-opt-img"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 🟢 5. อัปเดต UI สำหรับ Checkboxes */}
          {q.type === "checkboxes" && (
            <div className="preview-check-col">
              {q.options.map((opt, i) => {
                const isChecked = (ans || []).includes(opt);
                const showInput = q.optionHasInput?.[i] === true;

                return (
                  <div key={i} className="preview-option-wrapper">
                    <label
                      className={`preview-check ${isChecked ? "active" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleAnswer(q.id, opt, true)}
                      />
                      <span className="preview-check__mark">
                        {isChecked ? "✓" : ""}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: opt }} />
                    </label>

                    {isChecked && showInput && (
                      <div
                        style={{
                          marginLeft: "34px",
                          animation: "fadeIn 0.2s ease-out",
                        }}
                      >
                        <input
                          type="text"
                          className="preview-input"
                          placeholder="โปรดระบุรายละเอียด..."
                          value={optionInputValues[`${q.id}_${opt}`] || ""}
                          onChange={(e) =>
                            handleOptionInputChange(q.id, opt, e.target.value)
                          }
                          style={{
                            fontSize: "14px",
                            padding: "6px 0",
                            borderBottomColor: "var(--theme-color)",
                            maxWidth: "300px",
                          }}
                          autoFocus
                        />
                      </div>
                    )}
                    {q.optionImages && q.optionImages[i] && (
                      <img
                        src={q.optionImages[i]}
                        alt="option"
                        className="preview-opt-img"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {(q.type === "dropdown" || q.type === "faculty") && (
            <select
              className={`preview-input ${hasError ? "preview-input--error" : ""}`}
              value={ans || ""}
              onChange={(e) => handleAnswer(q.id, e.target.value)}
            >
              <option value="" disabled>
                เลือกคำตอบ
              </option>
              {q.options.map((opt, i) => {
                const textOnly = opt.replace(/<[^>]+>/g, "");
                return (
                  <option key={i} value={textOnly}>
                    {textOnly}
                  </option>
                );
              })}
            </select>
          )}

          {(q.type === "grid_multiple" || q.type === "grid_checkbox") && (
            <div className="preview-grid-wrapper">
              <table className="preview-grid-table">
                <thead>
                  <tr>
                    <th></th>
                    {q.cols.map((col, i) => (
                      <th key={i} dangerouslySetInnerHTML={{ __html: col }} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {q.rows.map((row, i) => (
                    <tr
                      key={i}
                      className={
                        hasError &&
                        (!ans ||
                          (q.type === "grid_multiple"
                            ? !ans[i]
                            : !ans[i]?.length))
                          ? "grid-row-error"
                          : ""
                      }
                    >
                      <td dangerouslySetInnerHTML={{ __html: row }} />
                      {q.cols.map((col, j) => {
                        const key = String(i);
                        const rowAns =
                          ans?.[key] ||
                          (q.type === "grid_multiple" ? null : []);
                        const isChecked =
                          q.type === "grid_multiple"
                            ? rowAns === col
                            : (rowAns || []).includes(col);
                        return (
                          <td key={j} style={{ textAlign: "center" }}>
                            <input
                              type={
                                q.type === "grid_multiple"
                                  ? "radio"
                                  : "checkbox"
                              }
                              name={`grid-${q.id}-${i}`}
                              checked={isChecked}
                              onChange={() =>
                                handleGridAnswer(
                                  q.id,
                                  i,
                                  col,
                                  q.type === "grid_checkbox",
                                )
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {hasError && (
            <div className="preview-error-msg">
              <svg
                focusable="false"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="#d93025"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"></path>
              </svg>
              {errors[q.id]}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!formData)
    return <div className="preview-loading">กำลังโหลดแบบฟอร์ม...</div>;

  const theme = formData.theme || {};
  const bannerType = theme.bannerType || "none";
  const bannerBgColor = theme.bannerBgColor || "#4285f4";
  const headerImage = theme.headerImage || null;
  const bannerText = theme.bannerText || "";
  const bannerTextAlign = theme.bannerTextAlign || "center";

  const stepData = groupedSteps[currentStep];

  return (
    <div
      className="preview-page"
      style={{
        "--theme-color": theme.color || "#673ab7",
        "--bg-color": theme.bg || "#f0f2f5",
      }}
    >
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
        <div className="preview-stepbar">
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
                    {i < currentStep ? "✓" : i + 1}
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
                __html: stepData?.title || "ส่วนที่ไม่มีชื่อ",
              }}
            />
            {stepData?.desc && (
              <p dangerouslySetInnerHTML={{ __html: stepData.desc }} />
            )}
            <p className="req" style={{ marginTop: "10px" }}>
              * แสดงว่าเป็นคำถามที่จำเป็น
            </p>
          </div>

          {stepData?.items.map((q, idx) => renderQuestion(q, idx))}

          <div className="preview-actions">
            {currentStep > 0 ? (
              <button
                type="button"
                className="preview-btn preview-btn--ghost"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                  setCurrentStep((s) => s - 1);
                }}
              >
                ← ย้อนกลับ
              </button>
            ) : (
              <div></div>
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
                ถัดไป →
              </button>
            ) : (
              <button
                type="button"
                className="preview-btn preview-btn--primary"
                onClick={() => {
                  if (validateStep()) {
                    alert(
                      "นี่คือโหมดแสดงตัวอย่าง (Preview) - ข้อมูลครบถ้วนพร้อมส่ง!",
                    );
                  }
                }}
              >
                ✓ ส่งคำตอบ
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default FormPreview;
