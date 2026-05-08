import React, { useState } from "react";
import { FaArchive, FaCog, FaTrashAlt, FaPlus, FaChartBar, FaPencilAlt, FaTimes, FaCheckSquare, FaSave, FaRegEdit } from "react-icons/fa";
import { FiCalendar } from "react-icons/fi";
import Swal from 'sweetalert2';

export default function CaseActionTab(props) {

  const {
    masterCaseInfo, selectedStaff, setSelectedStaff, staffOptions, isManagingStaff, setIsManagingStaff, newStaffName, setNewStaffName, handleAddStaff, handleDeleteStaff,
    isManagingStatus, setIsManagingStatus, status, setStatus, statusOptions, handleDeleteStatus,
    newStatusName, setNewStatusName, handleAddStatus, formRules, showSubMetrics, setShowSubMetrics,
    dynamicRisks, scoreResults, editingRiskId, setEditingRiskId, tempRiskChange, setTempRiskChange,
    handleDynamicRiskChange, overallOptions, riskLevel, setRiskLevel, clinicalImpression, setClinicalImpression,
    clinicType, setIsManagingTemplates, activeTemplate, setActiveTemplate, templates,
    templateAnswers, setTemplateAnswers, finalizeTemplate, staffNote, setStaffNote, isAppointing, setIsAppointing,
    appointmentNo, setAppointmentNo, tempDate, setTempDate, isManagingService, setIsManagingService,
    selectedServiceId, setSelectedServiceId, services, editingServiceId, setEditingServiceId,
    editingServiceName, setEditingServiceName, handleEditService, handleDeleteService, newServiceName,
    setNewServiceName, handleAddService, handleSaveAll, stripHtml,
    clinicalData = {}, setClinicalData = () => { },
    templateSessionNo, setTemplateSessionNo, handleSelectTemplate,
  } = props;

  const hasScoring = formRules.length > 0;
  const hasExistingAssessment = !!masterCaseInfo?.overall_risk || !!clinicalImpression;
  const [showRiskSection, setShowRiskSection] = useState(hasScoring || hasExistingAssessment);


  const getQuestionLevel = (question, allQuestions) => {
    let level = 0;
    let current = question;
    while (current && current.parentId) {
      level++;
      const parentId = current.parentId;
      current = allQuestions.find(it => it.id === parentId);
    }
    return level;
  };

  const templateDisplayNums = React.useMemo(() => {
    if (!activeTemplate?.questions) return {};
    const numbers = {};
    const childCounts = {};
    let mainCount = 0;
    activeTemplate.questions.forEach(q => {
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
  }, [activeTemplate]);

  return (
    <>
      {masterCaseInfo?.status === 'Closed' && (
        <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px', marginBottom: '20px', textAlign: 'center', color: '#64748b' }}>
          <FaArchive size={24} style={{ marginBottom: '8px', color: '#94a3b8' }} />
          <h4 style={{ margin: '0 0 4px 0', color: '#334155' }}>เคสนี้ถูกปิดไปแล้ว (Closed Case)</h4>
          <p style={{ margin: 0, fontSize: '13px' }}>คุณไม่สามารถเพิ่มนัดหมายใหม่ หรือเปลี่ยนสถานะได้ แต่ยังคงดูประวัติย้อนหลังได้</p>
        </div>
      )}

      <div className="cdm-management-box" style={{ opacity: masterCaseInfo?.status === 'Closed' ? 0.5 : 1, pointerEvents: masterCaseInfo?.status === 'Closed' ? 'none' : 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
  <div className="cdm-status-header-row">
    <label className="cdm-form-label">ผู้รับผิดชอบ</label>
    <button type="button" className="cdm-text-btn-manage" onClick={() => setIsManagingStaff(!isManagingStaff)}>
      <FaCog /> {isManagingStaff ? "ปิด" : "จัดการ"}
    </button>
  </div>

  {!isManagingStaff ? (
    <select className="cdm-form-input" value={selectedStaff} onChange={(e) => setSelectedStaff(e.target.value)}>
      {staffOptions.length === 0 && <option value="">ไม่มีข้อมูล</option>}
      {staffOptions.map((opt, i) => (
        <option key={i} value={opt}>{opt}</option>
      ))}
    </select>
  ) : (
    <div className="cdm-service-manage-box">
      <div className="cdm-service-list">
        {staffOptions.map((opt, i) => (
          <div key={i} className="cdm-service-item">
            <span>{opt}</span>
            <button
              type="button"
              className="cdm-action-icon delete"
              onClick={() => {
  Swal.fire({
    title: 'ยืนยันการลบ?',
    text: `ต้องการลบ ${opt} ใช่หรือไม่`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'ลบ',
    cancelButtonText: 'ยกเลิก',
    confirmButtonColor: '#ef4444'
  }).then((result) => {
    if (result.isConfirmed) {
      handleDeleteStaff(opt);
    }
  });
}}
            >
              <FaTrashAlt />
            </button>
          </div>
        ))}
      </div>

      <div className="cdm-service-add-row">
        <input
          type="text"
          value={newStaffName}
          onChange={(e) => setNewStaffName(e.target.value)}
          placeholder="เพิ่มผู้รับผิดชอบ..."
        />
        <button type="button" onClick={handleAddStaff}>
          <FaPlus />
        </button>
      </div>
    </div>
  )}
</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="cdm-status-header-row">
              <label className="cdm-form-label">สถานะปัจจุบัน</label>
              <button type="button" className="cdm-text-btn-manage" onClick={() => setIsManagingStatus(!isManagingStatus)}>
                <FaCog /> {isManagingStatus ? "ปิด" : "จัดการ"}
              </button>
            </div>
            {!isManagingStatus ? (
              <select className="cdm-form-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                {statusOptions.length === 0 && <option value="">กำลังโหลด...</option>}
                {statusOptions.map((opt) => <option key={opt.id} value={opt.name}>{opt.name}</option>)}
              </select>
            ) : (
              <div className="cdm-service-manage-box">
                <div className="cdm-service-list">
                  {statusOptions.map(opt => (
                    <div key={opt.id} className="cdm-service-item">
                      <span>{opt.name}</span>
                      <button type="button" className="cdm-action-icon delete" onClick={() => handleDeleteStatus(opt.id, opt.name)}>
                        <FaTrashAlt />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="cdm-service-add-row">
                  <input type="text" value={newStatusName} onChange={(e) => setNewStatusName(e.target.value)} placeholder="เพิ่ม..." />
                  <button type="button" onClick={handleAddStatus}><FaPlus /></button>
                </div>
              </div>
            )}
          </div>
        </div>

        {formRules.length > 0 && (
          <div className="cdm-dynamic-container-wrapper">
            {!showSubMetrics ? (
              <button type="button" className="cdm-btn-toggle-metrics" onClick={() => setShowSubMetrics(true)}>
                <FaPlus /> แสดงตัวชี้วัดรายข้อ (เช่น BMI, 3อ.2ส.)
              </button>
            ) : (
              <div className="cdm-dynamic-container">
                <div className="cdm-dynamic-header-row">
                  <label className="cdm-form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0f766e', marginBottom: '8px' }}>
                    <FaChartBar /> ความเสี่ยงรายหัวข้อ
                  </label>
                  <button type="button" className="cdm-btn-hide-metrics" onClick={() => setShowSubMetrics(false)}>ซ่อน</button>
                </div>
                <div className="cdm-dynamic-list">
                  {formRules.map(fr => {
                    const currentRisk = dynamicRisks[fr.id];
                    const selectedRule = fr.rules.find(r => r.label === currentRisk?.label) || fr.rules[0];
                    const systemOriginal = scoreResults.find(sr => sr.question_id === fr.id);
                    const isEditing = editingRiskId === fr.id;
                    return (
                      <div key={fr.id} className="cdm-dynamic-risk-item">
                        <div className="cdm-dynamic-risk-header">
                          <div className="cdm-dynamic-risk-title">{stripHtml(fr.title)}</div>
                          {!isEditing && (
                            <button type="button" className="cdm-text-btn-manage" onClick={() => {
                              setEditingRiskId(fr.id);
                              setTempRiskChange({ label: currentRisk?.label || '', reason: '' });
                            }}>
                              <FaPencilAlt /> ปรับแก้
                            </button>
                          )}
                        </div>
                        {!isEditing ? (
                          <div className="cdm-dynamic-risk-view">
                            <div className="cdm-dynamic-risk-badge" style={{ backgroundColor: `${selectedRule?.color}20`, color: selectedRule?.color, border: `1px solid ${selectedRule?.color}` }}>
                              <div className="cdm-dynamic-risk-color-dot" style={{ backgroundColor: selectedRule?.color }}></div>
                              {currentRisk?.label || 'ยังไม่ระบุ'}
                            </div>
                            {systemOriginal && systemOriginal.label !== currentRisk?.label && (
                              <div className="cdm-dynamic-risk-system-note">
                                (ผลคำนวณเดิม: {systemOriginal.label})
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="cdm-dynamic-risk-edit-box">
                            <select
                              className="cdm-form-input" style={{ height: '36px', marginBottom: '8px' }}
                              value={tempRiskChange.label} onChange={(e) => setTempRiskChange({ ...tempRiskChange, label: e.target.value })}
                            >
                              <option value="" disabled>เลือกผลประเมิน...</option>
                              {fr.rules.map((rule, idx) => <option key={idx} value={rule.label}>{rule.label}</option>)}
                            </select>
                            <input
                              type="text" className="cdm-form-input" style={{ height: '36px', fontSize: '13px', marginBottom: '8px' }}
                              placeholder="ระบุเหตุผลที่เปลี่ยนระดับความเสี่ยง (จำเป็น)..."
                              value={tempRiskChange.reason} onChange={(e) => setTempRiskChange({ ...tempRiskChange, reason: e.target.value })}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button type="button" className="cdm-btn-confirm-sm" onClick={() => {
                                if (!tempRiskChange.reason.trim()) {
                                  return Swal.fire({
                                    icon: 'warning',
                                    title: 'ข้อมูลไม่ครบถ้วน',
                                    text: 'กรุณาระบุเหตุผลการเปลี่ยนระดับความเสี่ยง',
                                    confirmButtonColor: '#3085d6'
                                  });
                                }
                                const newRule = fr.rules.find(r => r.label === tempRiskChange.label);
                                handleDynamicRiskChange(fr.id, newRule, fr.title, tempRiskChange.reason);
                                setEditingRiskId(null);
                              }}>ยืนยัน</button>
                              <button type="button" className="cdm-btn-cancel-sm" onClick={() => setEditingRiskId(null)}>ยกเลิก</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {!showRiskSection ? (
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', textAlign: 'center' }}>
            <button type="button" className="cdm-btn cdm-btn-outline" onClick={() => setShowRiskSection(true)}>
              <FaPlus /> เพิ่มการประเมินของเจ้าหน้าที่
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{
              marginTop: formRules.length > 0 ? '16px' : '24px',
              marginBottom: '8px',
              paddingTop: formRules.length > 0 ? '0' : '16px',
              borderTop: formRules.length > 0 ? 'none' : '1px dashed #cbd5e1',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
            }}>
              <div>
                <label className="cdm-form-label" style={{ marginBottom: '2px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ระดับความเสี่ยงภาพรวมของเคสนี้
                </label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  * ประเมินโดยเจ้าหน้าที่ (การปรับแก้ตรงนี้จะไม่กระทบผลคะแนนเดิมของฟอร์ม)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRiskSection(false)}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', fontSize: '13px', display: 'flex',
                  alignItems: 'center', gap: '4px', padding: '4px', marginTop: '4px'
                }}
                title="ซ่อนส่วนประเมินคลินิก"
              >
                <FaTimes /> ซ่อน
              </button>
            </div>

            <div className="cdm-risk-radio-group">
              {overallOptions.map(opt => (
                <label key={opt.label} className="cdm-risk-item" style={{ border: `1px solid ${riskLevel === opt.label ? opt.color : "#d1d5db"}`, background: riskLevel === opt.label ? `${opt.color}20` : "#fff", color: "#000" }}>
                  <input type="radio" value={opt.label} checked={riskLevel === opt.label} onChange={(e) => setRiskLevel(e.target.value)} style={{ accentColor: opt.color }} />
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "inherit" }}>{opt.label}</span>
                </label>
              ))}
            </div>

            <label className="cdm-form-label" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>การประเมินทางคลินิก</label>
            <textarea
              className="cdm-form-input" style={{ minHeight: '70px', marginBottom: '0' }}
              placeholder="ระบุข้อบ่งชี้ อาการ หรือสาเหตุของระดับความเสี่ยงในปัจจุบัน..."
              value={clinicalImpression} onChange={(e) => setClinicalImpression(e.target.value)}
            />
          </div>
        )}
      </div>

      {clinicType === 'sti' && (
        <div className="cdm-management-box" style={{ background: '#fff1f2', border: '1px solid #fecdd3', opacity: masterCaseInfo?.status === 'Closed' ? 0.5 : 1, pointerEvents: masterCaseInfo?.status === 'Closed' ? 'none' : 'auto' }}>
          <h4 style={{ color: '#be185d', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px' }}>
            🩸 บันทึกผลทางคลินิก (เฉพาะโรคติดต่อทางเพศสัมพันธ์)
          </h4>

          <div style={{ marginBottom: '16px' }}>
            <label className="cdm-form-label" style={{ color: '#9d174d' }}>ผลเจาะเลือด</label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" value="none" name="blood_test" checked={(clinicalData.blood_test || 'none') === 'none'}
                  onChange={(e) => setClinicalData({ ...clinicalData, blood_test: e.target.value })} style={{ accentColor: '#be185d' }} />
                ยังไม่มีข้อมูล
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" value="negative" name="blood_test" checked={clinicalData.blood_test === 'negative'}
                  onChange={(e) => setClinicalData({ ...clinicalData, blood_test: e.target.value })} style={{ accentColor: '#be185d' }} />
                <span style={{ color: '#10b981', fontWeight: 'bold' }}>Negative</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" value="positive" name="blood_test" checked={clinicalData.blood_test === 'positive'}
                  onChange={(e) => setClinicalData({ ...clinicalData, blood_test: e.target.value })} style={{ accentColor: '#be185d' }} />
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Positive</span>
              </label>
            </div>
          </div>

          <div>
            <label className="cdm-form-label" style={{ color: '#9d174d' }}>การรับยา PrEP</label>
            <div style={{ display: 'flex', gap: '16px', marginTop: '6px', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" value="none" name="prep" checked={(clinicalData.prep || 'none') === 'none'}
                  onChange={(e) => setClinicalData({ ...clinicalData, prep: e.target.value })} style={{ accentColor: '#be185d' }} />
                ไม่ได้รับ
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" value="prep_with_blood" name="prep" checked={clinicalData.prep === 'prep_with_blood'}
                  onChange={(e) => setClinicalData({ ...clinicalData, prep: e.target.value })} style={{ accentColor: '#be185d' }} />
                รับยา (เจาะเลือดที่นี่)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="radio" value="prep_without_blood" name="prep" checked={clinicalData.prep === 'prep_without_blood'}
                  onChange={(e) => setClinicalData({ ...clinicalData, prep: e.target.value })} style={{ accentColor: '#be185d' }} />
                รับยา (มีประวัติตรวจแล้ว)
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 🟢 ส่วนบันทึกการติดตาม (Redesigned) */}
      <div className="cdm-tracking-box" style={{ opacity: masterCaseInfo?.status === 'Closed' ? 0.5 : 1, pointerEvents: masterCaseInfo?.status === 'Closed' ? 'none' : 'auto' }}>
        <div className="cdm-tracking-header">
          <h4 className="cdm-tracking-title"><FaPencilAlt /> บันทึกการติดตาม</h4>
          <button type="button" className="cdm-text-btn-manage" onClick={() => setIsManagingTemplates(true)}>
            <FaCog /> จัดการชุดคำถาม
          </button>
        </div>

        {!activeTemplate && (
          <select
            className="cdm-tpl-selector"
            onChange={(e) => {
              const selected = templates.find(t => t.id === parseInt(e.target.value));
              if (selected) handleSelectTemplate(selected);
              e.target.value = "";
            }}
          >
            <option value="">+ คลิกเพื่อเลือกชุดคำถาม / แบบฟอร์มติดตาม</option>
            {Array.isArray(templates) && templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.label}</option>)}
          </select>
        )}

        {activeTemplate && (
          <div className="cdm-active-tpl-container">
            <div className="cdm-active-tpl-header">
              <h4 className="cdm-active-tpl-name">
                {/* 🟢 เพิ่ม flexShrink: 0 ไม่ให้ไอคอนโดนบีบ */}
                <div style={{ background: '#ccfbf1', color: '#0f766e', padding: '8px', borderRadius: '10px', display: 'flex', flexShrink: 0 }}>
                  <FaRegEdit size={18} />
                </div>

                {/* 🟢 เพิ่ม title={activeTemplate.label} ตรงนี้ เพื่อให้แสดงชื่อเต็มตอนเมาส์ชี้ */}
                <span
                  title={activeTemplate.label}
                  style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                >
                  {activeTemplate.label}
                </span>
              </h4>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                <div className="cdm-session-input-wrapper">
                  <span className="cdm-session-label">ครั้งที่</span>
                  <input
                    type="text"
                    placeholder="1"
                    className="cdm-session-input"
                    value={templateSessionNo || ""}
                    onChange={(e) => setTemplateSessionNo(e.target.value)}
                  />
                </div>
                <button type="button" className="cdm-tpl-close-btn-alt" onClick={() => setActiveTemplate(null)} title="ปิดชุดคำถาม">
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="cdm-active-tpl-body">
              {activeTemplate?.questions && activeTemplate.questions.map((q, i) => {
                const level = getQuestionLevel(q, activeTemplate.questions);
                return (
                  <div key={i} className="cdm-q-row" style={{ marginLeft: `${level * 24}px` }}>
                    <div className="cdm-q-title">
                      <span className="cdm-q-num-badge">{templateDisplayNums[q.id]}</span>
                      <span>{q.title}</span>
                    </div>

                    {q.hasAmount && (
                      <div className="cdm-amt-wrapper">
                        <input
                          type="text"
                          className="cdm-amt-input"
                          placeholder="จำนวน"
                          value={templateAnswers[`amt-${i}`] || ""}
                          onChange={(e) => setTemplateAnswers({ ...templateAnswers, [`amt-${i}`]: e.target.value })}
                        />
                        {q.amountUnit && <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>{q.amountUnit}</span>}
                      </div>
                    )}

                    {q.type === 'radio' ? (
                      <div className="cdm-radio-pill-group">
                        {(q.options || "").split(',').map((opt, idx) => {
                          const optVal = opt.trim();
                          const isActive = templateAnswers[i] === optVal;
                          return (
                            <label key={idx} className={`cdm-radio-pill ${isActive ? 'active' : ''}`}>
                              <input
                                type="radio"
                                name={`q-${i}`}
                                value={optVal}
                                checked={isActive}
                                onChange={(e) => setTemplateAnswers({ ...templateAnswers, [i]: e.target.value })}
                              />
                              <div className="cdm-radio-pill-indicator"></div>
                              <span>{optVal}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : q.type === 'text' ? (
                      <input
                        type="text"
                        className="cdm-text-ans-input"
                        placeholder="ระบุข้อมูล..."
                        value={templateAnswers[i] || ""}
                        onChange={(e) => setTemplateAnswers({ ...templateAnswers, [i]: e.target.value })}
                      />
                    ) : null}

                    {q.hasComment && (
                      <textarea
                        className="cdm-text-ans-input cdm-comment-input"
                        style={{ marginTop: '10px', background: '#fffbeb', borderStyle: 'dashed' }}
                        placeholder="รายละเอียดเพิ่มเติม (หมายเหตุ)..."
                        rows="2"
                        value={templateAnswers[`note-${i}`] || ""}
                        onChange={(e) => setTemplateAnswers({ ...templateAnswers, [`note-${i}`]: e.target.value })}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button type="button" className="cdm-btn-unified-save" onClick={finalizeTemplate} style={{ marginTop: '20px', background: '#0f766e' }}>
              <FaCheckSquare size={16} /> บันทึกลงตารางสรุป
            </button>
          </div>
        )}

        <div className="cdm-general-note-wrapper">
          <label className="cdm-general-note-label">
            <FaPencilAlt color="#94a3b8" /> บันทึกรายละเอียดการติดตาม (เพิ่มเติม)
          </label>
          <textarea
            className="cdm-form-input"
            style={{ minHeight: '80px', background: '#f8fafc', marginBottom: '0' }}
            placeholder="ระบุรายละเอียดการติดตาม หรือสรุปอาการในครั้งนี้..."
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
          />
        </div>
      </div>

      <div className="cdm-management-box" style={{ opacity: masterCaseInfo?.status === 'Closed' ? 0.5 : 1, pointerEvents: masterCaseInfo?.status === 'Closed' ? 'none' : 'auto' }}>
        <label className="cdm-appoint-toggle">
          <input type="checkbox" checked={isAppointing} onChange={(e) => setIsAppointing(e.target.checked)} />
          <span><FiCalendar /> นัดหมายครั้งถัดไป</span>
        </label>
        {isAppointing && (
          <div className="cdm-appoint-content">
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <div style={{ width: '100px' }}>
                <label className="cdm-form-label">ครั้งที่</label>
                <input type="number" className="cdm-form-input" value={appointmentNo} onChange={(e) => setAppointmentNo(Number(e.target.value))} min="1" />
              </div>
              <div style={{ flex: 1 }}>
                <label className="cdm-form-label">วันที่และเวลา</label>
                <input type="datetime-local" className="cdm-form-input" value={tempDate} onChange={(e) => setTempDate(e.target.value)} />
              </div>
            </div>
            <div className="cdm-status-header-row" style={{ marginTop: '4px' }}>
              <label className="cdm-form-label" style={{ marginBottom: 0 }}>ประเภทบริการ</label>
              <button type="button" className="cdm-text-btn-manage" onClick={() => setIsManagingService(!isManagingService)}>
                <FaCog /> {isManagingService ? "เสร็จสิ้น" : "จัดการบริการ"}
              </button>
            </div>
            {!isManagingService ? (
              <select className="cdm-form-input" value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}>
                {services.length === 0 && <option value="">ไม่มีบริการในระบบ</option>}
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <div className="cdm-service-manage-box" style={{ marginBottom: '12px' }}>
                <div className="cdm-service-list">
                  {services.map(s => (
                    <div key={s.id} className="cdm-service-item">
                      {editingServiceId === s.id ? (
                        <input
                          type="text" value={editingServiceName} onChange={(e) => setEditingServiceName(e.target.value)}
                          onBlur={() => handleEditService(s.id)} onKeyDown={(e) => e.key === 'Enter' && handleEditService(s.id)}
                          autoFocus style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', width: '70%' }}
                        />
                      ) : <span>{s.name}</span>}
                      <div className="cdm-service-actions">
                        <button type="button" className="cdm-action-icon edit" onClick={() => { setEditingServiceId(s.id); setEditingServiceName(s.name); }}><FaRegEdit /></button>
                        <button type="button" className="cdm-action-icon delete" onClick={() => handleDeleteService(s.id, s.name)}><FaTrashAlt /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cdm-service-add-row">
                  <input type="text" value={newServiceName} onChange={(e) => setNewServiceName(e.target.value)} placeholder="เพิ่มบริการใหม่..." />
                  <button type="button" onClick={handleAddService}><FaPlus /></button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 🟢 ห่อปุ่มบันทึกด้วย Wrapper เพื่อให้มันสามารถติดหนึบ (Sticky) ด้านล่างสุดได้บนมือถือ */}
      {masterCaseInfo?.status !== 'Closed' && (
        <div className="cdm-sticky-save-wrapper">
          <button className="cdm-btn-unified-save" onClick={handleSaveAll}>
            <FaSave size={18} /> บันทึกการดำเนินการทั้งหมด
          </button>
        </div>
      )}
    </>
  );
}