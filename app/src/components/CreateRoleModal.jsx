import React, { useEffect, useState } from "react";
import { FiCheckCircle, FiChevronDown, FiChevronRight, FiEdit3, FiShield } from "react-icons/fi";
import "./CreateRoleModal.css";
import { MODULES } from "../permissions/permissionRegistry";

export default function CreateRoleModal({ onClose, onSave, modules = [], permissionTypes = [] }) {
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState({});
  const [expandedModules, setExpandedModules] = useState(() => Object.fromEntries(modules.map((module) => [module, true])));
  const moduleLabels = Object.fromEntries(MODULES.map((module) => [module.id, module.label]));

  useEffect(() => {
    const handleEsc = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const togglePermission = (module, type) => {
    setPermissions((previous) => {
      const current = previous[module] || {};
      const updated = { ...current, [type]: !current[type] };
      return { ...previous, [module]: updated };
    });
  };
  const handleSave = () => {
    if (!roleName.trim()) return;
    onSave({ name: roleName.trim(), description: description.trim(), permissions });
  };

  return <div className="crm-overlay" onClick={onClose}>
    <div className="crm-card" onClick={(event) => event.stopPropagation()}>
      <div className="crm-header"><div className="crm-header-title"><div className="crm-icon-badge"><FiShield /></div><h3>เพิ่มบทบาท</h3></div><button className="crm-close-circle-btn" onClick={onClose} aria-label="ปิด"><span className="crm-close-icon-line" /></button></div>
      <div className="crm-body">
        <div className="crm-role-info-grid"><div className="crm-input-group"><label><FiShield className="label-icon" /> ชื่อบทบาท</label><input className="crm-input" maxLength={100} value={roleName} onChange={(event) => setRoleName(event.target.value)} placeholder="เช่น Manager" /></div><div className="crm-input-group"><label><FiEdit3 className="label-icon" /> คำอธิบาย</label><input className="crm-input" maxLength={255} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="รายละเอียดหน้าที่" /></div></div>
        <h4 className="crm-section-title">กำหนดสิทธิ์การเข้าถึง</h4>
        <div className="crm-permission-area">{modules.map((module) => { const expanded = expandedModules[module]; return <div key={module} className={`crm-module-card ${expanded ? "expanded" : ""}`}><button type="button" className="crm-module-header" onClick={() => setExpandedModules((previous) => ({ ...previous, [module]: !previous[module] }))}><span className="crm-module-title-text">{expanded ? <FiChevronDown /> : <FiChevronRight />}{moduleLabels[module] || module}</span></button>{expanded && <div className="crm-permission-row-container"><div className="crm-permission-row">{permissionTypes.map((type) => { const checked = Boolean(permissions[module]?.[type]); return <label key={type} className={`crm-checkbox-label ${checked ? "active" : ""}`}><input type="checkbox" checked={checked} onChange={() => togglePermission(module, type)} /><span className="crm-custom-checkbox">{checked && <FiCheckCircle />}</span>{type}</label>; })}</div></div>}</div>; })}</div>
      </div>
      <div className="crm-footer"><button className="crm-btn-cancel" onClick={onClose}>ยกเลิก</button><button className="crm-btn-save" onClick={handleSave} disabled={!roleName.trim()}>บันทึก</button></div>
    </div>
  </div>;
}
