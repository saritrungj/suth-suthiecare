import "./TemplateManagerModal.css";
import React, { useState, useEffect, useCallback } from "react";
import { FaCog, FaTimes, FaPlus, FaTrashAlt, FaSave } from "react-icons/fa";
import {
  getNoteTemplates,
  createNoteTemplate,
  updateNoteTemplate,
  deleteNoteTemplate,
} from "../../../services/api";
import Swal from "sweetalert2";

export default function TemplateManagerModal({
  clinicType,
  onClose,
  onRefresh,
  showToast,
}) {
  const [templates, setTemplates] = useState([]);
  const [editingTplId, setEditingTplId] = useState(null);
  const [newTplLabel, setNewTplLabel] = useState("");
  const [tplQuestions, setTplQuestions] = useState([
    { id: Date.now(), title: "", type: "text", options: "" },
  ]);

  const fetchData = useCallback(async () => {
    try {
      const res = await getNoteTemplates(clinicType);
      setTemplates(res.data);
    } catch (err) {}
  }, [clinicType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ฟังก์ชันเพิ่ม/ลบข้อคำถาม
  const addQuestionField = () =>
    setTplQuestions([
      ...tplQuestions,
      {
        id: Date.now(),
        title: "",
        type: "text",
        options: "",
        hasAmount: false,
        hasComment: false,
        isSubQuestion: false,
      },
    ]);

  const removeQuestionField = (id) =>
    setTplQuestions(tplQuestions.filter((q) => q.id !== id));

  const handleEditClick = (tpl) => {
    setEditingTplId(tpl.id);
    setNewTplLabel(tpl.label);
    try {
      setTplQuestions(JSON.parse(tpl.text));
    } catch (e) {
      setTplQuestions(
        tpl.text
          .split("\n")
          .map((t, i) => ({ id: i, title: t, type: "text", options: "" })),
      );
    }
  };

  const handleSave = async () => {
    if (!newTplLabel.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบถ้วน.",
        text: "กรุณาระบุชื่อชุดคำถาม",
        confirmButtonColor: "#3b82f6",
      });
    }

    const jsonData = JSON.stringify(tplQuestions);
    try {
      if (editingTplId) {
        await updateNoteTemplate(editingTplId, {
          label: newTplLabel,
          text: jsonData,
        });
      } else {
        await createNoteTemplate({
          clinic_type: clinicType,
          label: newTplLabel,
          text: jsonData,
        });
      }

      setEditingTplId(null);
      setNewTplLabel("");
      setTplQuestions([
        { id: Date.now(), title: "", type: "text", options: "" },
      ]);
      fetchData();
      onRefresh();
      showToast("บันทึกสำเร็จ");
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#3b82f6",
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ?",
      text: "คุณต้องการลบชุดคำถามนี้ใช่หรือไม่ (ไม่สามารถกู้คืนได้)",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ใช่, ลบทิ้งเลย!",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      try {
        await deleteNoteTemplate(id);
        if (editingTplId === id) {
          setEditingTplId(null);
          setNewTplLabel("");
          setTplQuestions([
            { id: Date.now(), title: "", type: "text", options: "" },
          ]);
        }
        fetchData();
        onRefresh();
        showToast("ลบเรียบร้อยแล้ว");
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "เกิดข้อผิดพลาด",
          text: "ลบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  //เรียงข้อคำถามอัตโนมัติ
  const displayNums = React.useMemo(() => {
    const numbers = {};
    const childCounts = {};
    let mainCount = 0;
    tplQuestions.forEach((q) => {
      if (!q.parentId) {
        mainCount++;
        numbers[q.id] = String(mainCount);
      } else {
        if (!childCounts[q.parentId]) childCounts[q.parentId] = 0;
        childCounts[q.parentId]++;
        const parentNum = numbers[q.parentId] || "0";
        numbers[q.id] = `${parentNum}.${childCounts[q.parentId]}`;
      }
    });
    return numbers;
  }, [tplQuestions]);

  const getLevel = useCallback((question, all) => {
    let level = 0;
    let curr = question;
    while (curr && curr.parentId) {
      level++;
      // 🟢 แก้ไข Warning no-loop-func โดยการดึงค่า parentId มาเก็บใน const ก่อนเรียก find()
      const currentParentId = curr.parentId;
      curr = all.find((it) => it.id === currentParentId);
    }
    return level;
  }, []);

  return (
    <div className="cdm-tpl-modal-overlay" onClick={onClose}>
      <div
        className="cdm-tpl-modal-card cdm-tpl-popup"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cdm-interactive-header">
          <h3
            style={{
              margin: 0,
              color: "#0f766e",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <FaCog /> จัดการชุดคำถาม
          </h3>
          <button className="cdm-tpl-close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="cdm-tpl-manager-layout">
          {/* Sidebar */}
          <div className="cdm-tpl-sidebar">
            <div className="cdm-tpl-sidebar-list">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className={`cdm-tpl-sidebar-item ${editingTplId === tpl.id ? "active" : ""}`}
                  onClick={() => handleEditClick(tpl)}
                >
                  <span className="cdm-tpl-item-label">{tpl.label}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(tpl.id);
                    }}
                    className="cdm-tpl-btn-delete"
                    title="ลบชุดคำถามนี้"
                  >
                    <FaTrashAlt />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="cdm-btn-add-q-dotted"
              style={{ marginTop: "10px", borderWidth: "1px" }}
              onClick={() => {
                setEditingTplId(null);
                setNewTplLabel("");
                setTplQuestions([
                  { id: Date.now(), title: "", type: "text", options: "" },
                ]);
              }}
            >
              <FaPlus /> สร้างชุดใหม่
            </button>
          </div>

          {/* Editor */}
          <div className="cdm-tpl-editor-main">
            <label className="cdm-tpl-label-title">ชื่อชุดคำถาม</label>
            <input
              type="text"
              className="cdm-tpl-field-input"
              placeholder="เช่น ซักประวัติเบื้องต้น..."
              value={newTplLabel}
              onChange={(e) => setNewTplLabel(e.target.value)}
            />

            <div className="cdm-tpl-questions-builder-box">
              {tplQuestions.map((q, idx) => {
                const indentLevel = getLevel(q, tplQuestions);
                const displayNum = displayNums[q.id];

                return (
                  <div
                    key={q.id}
                    className={`cdm-tpl-q-field-row ${indentLevel > 0 ? "is-sub" : ""}`}
                    style={{
                      marginLeft: `${indentLevel * 30}px`,
                      borderLeft:
                        indentLevel > 0
                          ? `4px solid ${indentLevel === 1 ? "#34d399" : "#94a3b8"}`
                          : "1px solid #e2e8f0",
                    }}
                  >
                    <div className="cdm-tpl-q-input-group">
                      {/* 🟢 วงกลมหมายเลขข้อ เฟรนลี่ขึ้น */}
                      <span
                        className="cdm-q-number"
                        style={{
                          background: indentLevel > 0 ? "#d1fae5" : "#e0f2fe",
                          color: indentLevel > 0 ? "#059669" : "#0ea5e9",
                        }}
                      >
                        {displayNum}
                      </span>

                      <input
                        style={{ flex: 1 }}
                        placeholder={
                          indentLevel > 0
                            ? "พิมพ์หัวข้อย่อยตรงนี้.."
                            : "พิมพ์คำถามหลักตรงนี้..."
                        }
                        value={q.title}
                        onChange={(e) => {
                          const newQs = [...tplQuestions];
                          newQs[idx].title = e.target.value;
                          setTplQuestions(newQs);
                        }}
                      />

                      <select
                        style={{ width: "180px" }}
                        value={q.type}
                        onChange={(e) => {
                          const newQs = [...tplQuestions];
                          newQs[idx].type = e.target.value;
                          setTplQuestions(newQs);
                        }}
                      >
                        <option value="text">พิมพ์ตอบ (Text)</option>
                        <option value="radio">เลือกตอบ (Radio)</option>
                        <option value="header">เฉพาะหัวข้อ (Header)</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => removeQuestionField(q.id)}
                        className="cdm-icon-btn-red-sm"
                        title="ลบคำถามนี้"
                      >
                        <FaTrashAlt />
                      </button>
                    </div>

                    {/* แถบตั้งค่าพิเศษ (Extra Checkboxes) ปรับให้ดูนุ่มนวล */}
                    <div className="cdm-tpl-q-extras-row">
                      {/* เลือกความสัมพันธ์ (Parent Question) */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "13px",
                            color: "#475569",
                            fontWeight: "700",
                          }}
                        >
                          อยู่ภายใต้หัวข้อ:
                        </span>
                        <select
                          style={{
                            fontSize: "13px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            background: "#fff",
                            minWidth: "150px",
                          }}
                          value={q.parentId || ""}
                          onChange={(e) => {
                            const newQs = [...tplQuestions];
                            const pId = e.target.value
                              ? Number(e.target.value)
                              : null;
                            newQs[idx].parentId = pId;
                            newQs[idx].isSubQuestion = pId !== null;
                            setTplQuestions(newQs);
                          }}
                        >
                          <option value="">
                            -- ไม่ระบุ (เป็นหัวข้อหลัก) --
                          </option>
                          {tplQuestions.map(
                            (optQ, optIdx) =>
                              optIdx < idx && (
                                <option key={optQ.id} value={optQ.id}>
                                  ข้อ {optIdx + 1}:{" "}
                                  {optQ.title
                                    ? optQ.title.substring(0, 20)
                                    : "ยังไม่ได้ตั้งชื่อ"}
                                </option>
                              ),
                          )}
                        </select>
                      </div>

                      {/* เพิ่มช่องจำนวน / หมายเหตุ */}
                      <div className="cdm-extra-group">
                        {/* 🔹 จำนวน */}
                        <div className="cdm-extra-item">
                          <label className="cdm-extra-chk">
                            <input
                              type="checkbox"
                              checked={q.hasAmount || false}
                              onChange={(e) => {
                                const newQs = [...tplQuestions];
                                newQs[idx].hasAmount = e.target.checked;
                                setTplQuestions(newQs);
                              }}
                            />
                            เพิ่มช่องระบุตัวเลข (จำนวน)
                          </label>

                          {q.hasAmount && (
                            <input
                              type="text"
                              placeholder="ระบุหน่วย (เช่น นาที, เม็ด)"
                              style={{
                                width: "150px",
                                fontSize: "12px",
                                padding: "6px 10px",
                                border: "1px dashed #0ea5e9",
                                borderRadius: "6px",
                                background: "#ffffff",
                              }}
                              value={q.amountUnit || ""}
                              onChange={(e) => {
                                const newQs = [...tplQuestions];
                                newQs[idx].amountUnit = e.target.value;
                                setTplQuestions(newQs);
                              }}
                            />
                          )}
                        </div>

                        {/* 🔹 หมายเหตุ (ต้องห่อ div ด้วย!) */}
                        <div className="cdm-extra-item">
                          <label className="cdm-extra-chk">
                            <input
                              type="checkbox"
                              checked={q.hasComment || false}
                              onChange={(e) => {
                                const newQs = [...tplQuestions];
                                newQs[idx].hasComment = e.target.checked;
                                setTplQuestions(newQs);
                              }}
                            />
                            เพิ่มช่องหมายเหตุ
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* ส่วนพิมพ์รายละเอียดเริ่มต้น (Default Comment) */}
                    {q.hasComment && (
                      <div
                        style={{
                          marginTop: "12px",
                          animation: "cdmModalFadeIn 0.2s ease",
                        }}
                      >
                        <textarea
                          placeholder="พิมพ์ข้อความโครงร่าง (Template) สำหรับช่องหมายเหตุที่นี่..."
                          style={{
                            width: "100%",
                            fontSize: "13px",
                            padding: "12px",
                            border: "1px dashed #0ea5e9",
                            borderRadius: "10px",
                            background: "#f0f9ff",
                            minHeight: "60px",
                            fontFamily: "inherit",
                            resize: "vertical",
                          }}
                          value={q.defaultComment || ""}
                          onChange={(e) => {
                            const newQs = [...tplQuestions];
                            newQs[idx].defaultComment = e.target.value;
                            setTplQuestions(newQs);
                          }}
                        />
                      </div>
                    )}

                    {/* ส่วนจัดการ Radio (Options) */}
                    {q.type === "radio" && (
                      <div
                        className="cdm-tpl-options-builder"
                        style={{
                          marginTop: "16px",
                          marginLeft: "45px",
                          padding: "16px",
                          background: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          {(q.options || "")
                            .split(",")
                            .filter((opt) => opt.trim() !== "")
                            .map((opt, optIdx) => (
                              <div
                                key={optIdx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "12px",
                                }}
                              >
                                <div
                                  style={{
                                    width: "12px",
                                    height: "12px",
                                    borderRadius: "50%",
                                    border: "3px solid #94a3b8",
                                    background: "#fff",
                                  }}
                                ></div>
                                <input
                                  type="text"
                                  placeholder="พิมพ์ตัวเลือก..."
                                  style={{
                                    flex: 1,
                                    border: "none",
                                    borderBottom: "2px solid #cbd5e1",
                                    fontSize: "14px",
                                    background: "transparent",
                                    padding: "4px 8px",
                                  }}
                                  value={opt}
                                  onChange={(e) => {
                                    const newOptions = (q.options || "").split(
                                      ",",
                                    );
                                    newOptions[optIdx] = e.target.value;
                                    const newQs = [...tplQuestions];
                                    newQs[idx].options = newOptions.join(",");
                                    setTplQuestions(newQs);
                                  }}
                                  onFocus={(e) =>
                                    (e.target.style.borderBottomColor =
                                      "#0ea5e9")
                                  }
                                  onBlur={(e) =>
                                    (e.target.style.borderBottomColor =
                                      "#cbd5e1")
                                  }
                                />
                                <button
                                  type="button"
                                  className="cdm-opt-del-btn"
                                  title="ลบตัวเลือกนี้"
                                  onClick={() => {
                                    const newOptions = (q.options || "")
                                      .split(",")
                                      .filter((_, index) => index !== optIdx);
                                    const newQs = [...tplQuestions];
                                    newQs[idx].options = newOptions.join(",");
                                    setTplQuestions(newQs);
                                  }}
                                >
                                  <FaTimes size={12} />
                                </button>
                              </div>
                            ))}
                        </div>
                        <button
                          type="button"
                          style={{
                            background: "#e0f2fe",
                            border: "none",
                            color: "#0369a1",
                            fontSize: "13px",
                            fontWeight: "700",
                            padding: "6px 12px",
                            borderRadius: "20px",
                            cursor: "pointer",
                            marginTop: "16px",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                          onClick={() => {
                            const current = q.options
                              ? q.options.split(",")
                              : [];
                            const newQs = [...tplQuestions];
                            newQs[idx].options = [
                              ...current,
                              `ตัวเลือกใหม่`,
                            ].join(",");
                            setTplQuestions(newQs);
                          }}
                        >
                          <FaPlus size={10} /> เพิ่มตัวเลือก
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* ปุ่มเพิ่มข้อคำถาม (ดูใหญ่และน่าคลิก) */}
              <button
                type="button"
                className="cdm-btn-add-q-dotted"
                onClick={addQuestionField}
              >
                <FaPlus /> เพิ่มข้อคำถาม
              </button>
            </div>

            <button
              type="button"
              className="cdm-btn-save-tpl"
              style={{ marginTop: "24px" }}
              onClick={handleSave}
            >
              <FaSave size={18} /> บันทึกและอัปเดตชุดคำถาม
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
