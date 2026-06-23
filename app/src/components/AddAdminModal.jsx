import React, { useState } from "react";
import {
  FiEye,
  FiEyeOff,
  FiUser,
  FiLock,
  FiMail,
  FiShield,
  FiCheckCircle,
} from "react-icons/fi";
import "./AddAdminModal.css";

export default function AddAdminModal({
  onClose,
  onSave,
  initialData,
  canViewPassword,
}) {
  const currentUserStr =
    sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const currentRoleId = currentUser ? Number(currentUser.role_id) : 3;

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(
    initialData
      ? { ...initialData, password: "" }
      : {
          username: "",
          password: "",
          name: "",
          email: "",
          role_id: 2,
          status: "active",
        },
  );

  const [errors, setErrors] = useState({});

  const isEditingSelf =
    initialData && currentUser && currentUser.id === initialData.id;
  const targetRoleId = initialData
    ? Number(initialData.role_id)
    : Number(formData.role_id);

  const canChangePassword =
    currentRoleId === 1 || isEditingSelf || currentRoleId < targetRoleId;
  const canChangeRole =
    currentRoleId === 1 || (currentRoleId < targetRoleId && !isEditingSelf);
  const canChangeStatus =
    currentRoleId === 1 || (currentRoleId < targetRoleId && !isEditingSelf);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.username?.trim())
      newErrors.username = "กรุณากรอกชื่อผู้ใช้งาน";
    if (!initialData && !formData.password)
      newErrors.password = "กรุณากรอกรหัสผ่าน";
    if (!formData.name?.trim()) newErrors.name = "กรุณากรอกชื่อ-นามสกุล";
    if (!formData.email?.trim()) newErrors.email = "กรุณากรอกอีเมล";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const dataToSend = {
      id: initialData?.id, // ✅ เพิ่ม id
      username: formData.username,
      name: formData.name,
      email: formData.email,
      role_id: Number(formData.role_id),
      status: formData.status,
    };

    if (formData.password && formData.password.trim() !== "") {
      dataToSend.password = formData.password;
    }

    onSave(dataToSend);
  };
  return (
    <div className="adm-overlay">
      <div className="adm-card">
        <div className="adm-header">
          <div className="adm-header-title">
            <div className="adm-icon-badge">
              <FiUser />
            </div>
            <h3>{initialData ? "แก้ไขข้อมูลผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</h3>
          </div>
          <button
            className="ADM-close-circle-btn"
            onClick={onClose}
            type="button"
          >
            <span className="adm-close-icon-line"></span>
          </button>
        </div>

        <div className="adm-body">
          {/* Username */}
          <div className="adm-input-group">
            <label>
              <FiUser className="label-icon" /> ชื่อผู้ใช้งาน (Username)
            </label>
            <input
              type="text"
              placeholder="เช่น admin_01"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className={errors.username ? "adm-input error" : "adm-input"}
              disabled={!!initialData}
            />
            {errors.username && (
              <span className="adm-error-text">{errors.username}</span>
            )}
          </div>

          {/* Password */}
          {canChangePassword ? (
            <div className="adm-input-group">
              <label>
                <FiLock className="label-icon" /> รหัสผ่าน
                {initialData && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#94a3b8",
                      fontWeight: 400,
                      marginLeft: 8,
                    }}
                  >
                    (เว้นว่างถ้าไม่ต้องการเปลี่ยน)
                  </span>
                )}
              </label>
              <div className="adm-password-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    initialData
                      ? "ใส่รหัสใหม่ถ้าต้องการเปลี่ยน"
                      : "ตั้งรหัสผ่าน"
                  }
                  value={formData.password || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className={errors.password ? "adm-input error" : "adm-input"}
                />
                {canViewPassword && (
                  <button
                    type="button"
                    className="adm-view-pw-btn"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                )}
              </div>
              {errors.password && (
                <span className="adm-error-text">{errors.password}</span>
              )}
            </div>
          ) : (
            <p className="adm-no-perm-text">* คุณไม่มีสิทธิ์เปลี่ยนรหัสผ่าน</p>
          )}

          {/* Name */}
          <div className="adm-input-group">
            <label>
              <FiUser className="label-icon" /> ชื่อ - นามสกุล
            </label>
            <input
              type="text"
              placeholder="กรอกชื่อ-นามสกุล"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className={errors.name ? "adm-input error" : "adm-input"}
            />
            {errors.name && (
              <span className="adm-error-text">{errors.name}</span>
            )}
          </div>

          {/* Email */}
          <div className="adm-input-group">
            <label>
              <FiMail className="label-icon" /> อีเมล
            </label>
            <input
              type="email"
              placeholder="example@mail.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className={errors.email ? "adm-input error" : "adm-input"}
            />
            {errors.email && (
              <span className="adm-error-text">{errors.email}</span>
            )}
          </div>

          {/* Role & Status */}
          <div className="adm-grid-2">
            <div className="adm-input-group">
              <label>
                <FiShield className="label-icon" /> ระดับสิทธิ์ (Role)
              </label>
              <select
                className="adm-select"
                value={formData.role_id}
                onChange={(e) =>
                  setFormData({ ...formData, role_id: Number(e.target.value) })
                }
                disabled={!canChangeRole}
              >
                {currentRoleId === 1 && <option value="1">Super Admin</option>}
                <option value="2">Admin</option>
                <option value="3">Staff</option>
              </select>
            </div>

            <div className="adm-input-group">
              <label>
                <FiCheckCircle className="label-icon" /> สถานะการใช้งาน
              </label>
              <div className="adm-status-toggle">
                <button
                  className={`adm-status-btn ${formData.status === "active" ? "active" : ""}`}
                  onClick={() =>
                    canChangeStatus &&
                    setFormData({ ...formData, status: "active" })
                  }
                  disabled={!canChangeStatus}
                >
                  ใช้งาน
                </button>
                <button
                  className={`adm-status-btn ${formData.status === "inactive" ? "inactive" : ""}`}
                  onClick={() =>
                    canChangeStatus &&
                    setFormData({ ...formData, status: "inactive" })
                  }
                  disabled={!canChangeStatus}
                >
                  ระงับ
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-footer">
          <button className="adm-btn-cancel" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="adm-btn-save" onClick={handleSubmit}>
            บันทึกข้อมูล
          </button>
        </div>
      </div>
    </div>
  );
}
