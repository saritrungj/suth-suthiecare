import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  FiEye,
  FiEyeOff,
  FiCheck,
  FiX,
  FiEdit2,
  FiUser,
  FiPhone,
  FiFileText,
} from "react-icons/fi";
import { FaWeight, FaRuler } from "react-icons/fa";

// ดึงการตั้งค่าจากไฟล์ Utils ที่เราเพิ่งสร้าง
<<<<<<< Updated upstream
import { API_BASE, axiosConfig, formatAnswerValue, stripHtml, formatDate } from '../historyUtils';
import { useTranslation } from 'react-i18next';
=======
import {
  API_BASE,
  axiosConfig,
  formatAnswerValue,
  stripHtml,
  formatDate,
} from "../historyUtils";
>>>>>>> Stashed changes

const IconMap = {
  user: FiUser,
  phone: FiPhone,
  weight: FaWeight,
  ruler: FaRuler,
  file: FiFileText,
};

export function MaskedIdField({ value }) {
  const [show, setShow] = useState(false);
  if (!value) return <span className="hr-answer-v">-</span>;
  const clean = String(value).replace(/\D/g, "");
  const masked =
    clean.length >= 4
      ? clean.slice(0, -4).replace(/\d/g, "●") + clean.slice(-4)
      : "●".repeat(clean.length);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
      <span
        className="hr-answer-v"
        style={{ fontFamily: "monospace", letterSpacing: 1 }}
      >
        {show ? clean : masked}
      </span>
      <button
        onClick={() => setShow((s) => !s)}
        className="hr-eye-btn"
        title={show ? "ซ่อน" : "แสดง"}
      >
        {show ? <FiEyeOff size={12} /> : <FiEye size={12} />}{" "}
        {show ? "ซ่อน" : "แสดง"}
      </button>
    </div>
  );
}

<<<<<<< Updated upstream
export function EditableAnswerField({ responseId, questionId, questionLabel, answerValue, type = 'text', onSave }) {
  const { t } = useTranslation();
=======
export function EditableAnswerField({
  responseId,
  questionId,
  questionLabel,
  answerValue,
  type = "text",
  onSave,
}) {
>>>>>>> Stashed changes
  const cleanVal = formatAnswerValue(answerValue);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(cleanVal);
  const [saving, setSaving] = useState(false);
  const [savedVal, setSavedVal] = useState(cleanVal);

  const handleSave = async () => {
    if (!val.trim()) return;
    setSaving(true);
    try {
      await axios.patch(
        `${API_BASE}/api/history/answer/${responseId}/${questionId}`,
        { value: val.trim() },
        axiosConfig,
      );
      setSavedVal(val.trim());
      onSave && onSave(questionId, val.trim());
      setEditing(false);
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => {
    setVal(savedVal);
    setEditing(false);
  };

  return (
    <div className="hr-answer-row hr-answer-row--editable">
      <span className="hr-answer-q">{questionLabel}</span>
      <span className="hr-answer-sep">→</span>
      {editing ? (
        <div className="hr-inline-edit">
          <input
            className="hr-field-input hr-inline-input"
            type={type}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            autoFocus
          />
          <button
            className="hr-action-btn save"
            onClick={handleSave}
            disabled={saving}
          >
            <FiCheck size={13} />
          </button>
          <button className="hr-action-btn cancel" onClick={handleCancel}>
            <FiX size={13} />
          </button>
        </div>
      ) : (
        <div className="hr-answer-editable-view">
<<<<<<< Updated upstream
          <span className="hr-answer-v">{savedVal || '-'}</span>
          <button className="hr-edit-btn hr-edit-btn--sm" onClick={() => { setVal(savedVal); setEditing(true); }} title={t('history.result.edit_data')}>
            <FiEdit2 size={11} /><span>{t('history.result.edit_btn')}</span>
=======
          <span className="hr-answer-v">{savedVal || "-"}</span>
          <button
            className="hr-edit-btn hr-edit-btn--sm"
            onClick={() => {
              setVal(savedVal);
              setEditing(true);
            }}
          >
            <FiEdit2 size={11} />
            <span>แก้ไข</span>
>>>>>>> Stashed changes
          </button>
        </div>
      )}
    </div>
  );
}

<<<<<<< Updated upstream
export function EditableField({ responseId, field, label, value, type = 'text', icon, onSave, updatedAt }) {
  const { t } = useTranslation();
  const cleanValue = stripHtml(value || '');
=======
export function EditableField({
  responseId,
  field,
  label,
  value,
  updatedAt,
  type = "text",
  icon,
  onSave,
}) {
  const cleanValue = stripHtml(value || "");
>>>>>>> Stashed changes
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(cleanValue);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setVal(stripHtml(value || ""));
  }, [value]);

  const IconComponent = icon ? IconMap[icon] : null;

  const handleSave = async () => {
    if (!val.trim()) return;
    setSaving(true);
    try {
      const res = await axios.patch(
        `${API_BASE}/api/history/response/${responseId}`,
        { field, value: val.trim() },
        axiosConfig,
      );
      onSave && onSave(field, val.trim(), res.data?.updated_at);
      setEditing(false);
    } catch (err) {
      alert(`บันทึกไม่สำเร็จ: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setSaving(false);
    }
  };
  const handleCancel = () => {
    setVal(cleanValue);
    setEditing(false);
  };

  return (
    <div className={`hr-field ${editing ? "editing" : ""}`}>
      <div className="hr-field-label">
        {IconComponent && <IconComponent size={11} />} {label}
      </div>
      {editing ? (
        <div className="hr-field-edit">
          <input
            className="hr-field-input"
            type={type}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            autoFocus
          />
          <button
            className="hr-action-btn save"
            onClick={handleSave}
            disabled={saving}
          >
            <FiCheck size={13} />
          </button>
          <button className="hr-action-btn cancel" onClick={handleCancel}>
            <FiX size={13} />
          </button>
        </div>
      ) : (
        <div className="hr-field-view">
<<<<<<< Updated upstream
          <span className={`hr-field-val ${!cleanValue ? 'empty' : ''}`}>{cleanValue || '-'}</span>
          <button className="hr-edit-btn" onClick={() => { setVal(cleanValue); setEditing(true); }} title={t('history.result.edit_data')}>
            <FiEdit2 size={12} /><span>{t('history.result.edit_btn')}</span>
          </button>
        </div>
      )}
      {updatedAt && <span className="hr-field-updated">✎ {t('history.result.edit_last')}: {formatDate(updatedAt)}</span>}
=======
          <span className={`hr-field-val ${!cleanValue ? "empty" : ""}`}>
            {cleanValue || "ยังไม่ระบุ"}
          </span>
          <button
            className="hr-edit-btn"
            onClick={() => {
              setVal(cleanValue);
              setEditing(true);
            }}
          >
            <FiEdit2 size={12} />
            <span>แก้ไข</span>
          </button>
        </div>
      )}
      {updatedAt && (
        <span className="hr-field-updated">
          ✎ แก้ไขล่าสุด: {formatDate(updatedAt)}
        </span>
      )}
>>>>>>> Stashed changes
    </div>
  );
}

<<<<<<< Updated upstream
export function HeroEditableField({ value, type = 'text', icon, isTitle = false, onSave }) {
  const { t } = useTranslation();
=======
export function HeroEditableField({
  value,
  onSave,
  type = "text",
  isTitle = false,
  icon = null,
}) {
>>>>>>> Stashed changes
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [saving, setSaving] = useState(false);

  const Icon = icon ? IconMap[icon] : null;

  useEffect(() => {
    setVal(value);
  }, [value]);

  const handleSave = async () => {
    if (!val.trim()) return;
    setSaving(true);
    await onSave(val.trim());
    setSaving(false);
    setEditing(false);
  };
  const handleCancel = () => {
    setVal(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="hr-hero-edit-wrap">
<<<<<<< Updated upstream
        {Icon && <Icon size={12} color="rgba(255,255,255,0.7)" />}
=======
        {IconComponent && (
          <IconComponent size={12} color="rgba(255,255,255,0.7)" />
        )}
>>>>>>> Stashed changes
        <input
          type={type}
          className={`hr-hero-input ${isTitle ? "title-input" : "pill-input"}`}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          autoFocus
        />
<<<<<<< Updated upstream
        <button className="hr-hero-action-btn save" onClick={handleSave} disabled={saving} title={t('history.result.save')}>
          <FiCheck size={14} />
        </button>
        <button className="hr-hero-action-btn cancel" onClick={handleCancel} disabled={saving} title={t('history.result.cancel')}>
=======
        <button
          className="hr-hero-action-btn save"
          onClick={handleSave}
          disabled={saving}
          title="บันทึก"
        >
          <FiCheck size={14} />
        </button>
        <button
          className="hr-hero-action-btn cancel"
          onClick={handleCancel}
          disabled={saving}
          title="ยกเลิก"
        >
>>>>>>> Stashed changes
          <FiX size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="hr-hero-view-wrap">
<<<<<<< Updated upstream
      {Icon && <Icon size={12} color="rgba(255,255,255,0.8)" />}
      <span className={isTitle ? "hr-name" : "hr-id-value"}>{value}</span>
      <button className="hr-hero-edit-btn" onClick={() => setEditing(true)} title={t('history.result.edit_data')}>
=======
      {IconComponent && (
        <IconComponent size={12} color="rgba(255,255,255,0.8)" />
      )}
      <span className={isTitle ? "hr-name" : "hr-id-value"}>{value}</span>
      <button
        className="hr-hero-edit-btn"
        onClick={() => setEditing(true)}
        title="แก้ไขข้อมูล"
      >
>>>>>>> Stashed changes
        <FiEdit2 size={12} />
      </button>
    </div>
  );
}

export function Toast({ msg, type }) {
  if (!msg) return null;
  return (
    <div className={`hr-toast ${type || ""}`}>
      {type === "success" ? "✓" : "✕"} {msg}
    </div>
  );
}
