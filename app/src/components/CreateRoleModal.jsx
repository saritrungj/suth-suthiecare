import React, { useState, useEffect } from "react";
import {
  FiShield,
  FiEdit3,
  FiChevronDown,
  FiCheckCircle,
  FiChevronRight,
} from "react-icons/fi";
import "./CreateRoleModal.css";

export default function CreateRoleModal({
  onClose,
  onSave,
  modules,
  permissionTypes,
}) {
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState({});
  const [expandedModules, setExpandedModules] = useState(
    modules.reduce((acc, curr) => ({ ...acc, [curr]: true }), {}),
  );

  const moduleLabels = {
    Dashboard: "แดชบอร์ด",
    "Case Management": "จัดการเคส",
    "Form Management": "จัดการฟอร์ม",
    Appointments: "ตารางนัดหมาย",
    "User Management": "จัดการผู้ใช้",
    "Roles & Permissions": "บทบาทและสิทธิ์",
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // หุบ-ขยาย
  const toggleModuleHeader = (moduleName) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  const togglePermission = (module, type) => {
    setPermissions((prev) => {
      const current = prev[module] || {};
      if (type === "Full Control") {
        const value = !current["Full Control"];
        return {
          ...prev,
          [module]: {
            View: value,
            Manage: value,
            "Full Control": value,
            "View Password":
              module === "จัดการผู้ใช้ (Users)"
                ? value
                : current["View Password"],
          },
        };
      }
      const updated = { ...current, [type]: !current[type] };
      updated["Full Control"] = updated.View && updated.Manage;
      return { ...prev, [module]: updated };
    });
  };

  const handleSaveClick = () => {
    if (!roleName.trim()) {
      alert("กรุณากรอกชื่อบทบาท (Role Name)");
      return;
    }
    onSave({
      name: roleName,
      description: description,
      permissions: permissions,
    });
  };

  return (
    <div className="crm-overlay" onClick={onClose}>
      <div className="crm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="crm-header">
          <div className="crm-header-title">
            <div className="crm-icon-badge">
              {" "}
              <FiShield />{" "}
            </div>
            <h3>เพิ่มบทบาท</h3>
          </div>
          <button className="crm-close-circle-btn" onClick={onClose}>
            <span className="crm-close-icon-line"></span>
          </button>
        </div>

        <div className="crm-body">
          {/* ส่วนกรอกข้อมูลหลัก */}
          <div className="crm-role-info-grid">
            <div className="crm-input-group">
              <label>
                <FiShield className="label-icon" /> ชื่อบทบาท
              </label>
              <input
                className="crm-input"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="เช่น Manager, Supervisor..."
              />
            </div>
            <div className="crm-input-group">
              <label>
                <FiEdit3 className="label-icon" /> คำอธิบาย
              </label>
              <input
                className="crm-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ระบุรายละเอียดหน้าที่ของบทบาทนี้"
              />
            </div>
          </div>

          <h4 className="crm-section-title">กำหนดสิทธิ์การเข้าถึง</h4>

          <div className="crm-permission-area">
            {modules.map((module) => {
              const isExpanded = expandedModules[module]; // เช็คว่ากางอยู่ไหม
              return (
                <div
                  key={module}
                  className={`crm-module-card ${isExpanded ? "expanded" : ""}`}
                >
                  <div
                    className="crm-module-header"
                    onClick={() => toggleModuleHeader(module)}
                  >
                    <span className="crm-module-title-text">
                      {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                      {moduleLabels[module] || module}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="crm-permission-row-container">
                      <div className="crm-permission-row">
                        {permissionTypes.map((type) => {
                          if (
                            type === "ดูรหัสผ่าน" &&
                            module !== "User Management" &&
                            module !== "จัดการผู้ใช้"
                          )
                            return null;
                          const isChecked =
                            permissions[module]?.[type] || false;
                          return (
                            <label
                              key={type}
                              className={`crm-checkbox-label ${isChecked ? "active" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => togglePermission(module, type)}
                              />
                              <span className="crm-custom-checkbox">
                                {isChecked && <FiCheckCircle />}
                              </span>
                              {type}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="crm-footer">
          <button className="crm-btn-cancel" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="crm-btn-save" onClick={handleSaveClick}>
            บันทึก
          </button>
        </div>
      </div>
    </div>
  );
}
