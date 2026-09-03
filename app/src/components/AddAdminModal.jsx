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

const MAX_NAME_LENGTH = 255;
const normaliseText = (value) => value.normalize("NFC").trim().replace(/\s+/g, " ");
const charLength = (value) => Array.from(value).length;

export default function AddAdminModal({
  onClose,
  onSave,
  initialData,
  canViewPassword,
  organizations = [],
  roles = [],
}) {
  const currentUserStr =
    sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const currentRoleId = currentUser ? Number(currentUser.role_id) : 3;

  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState(
    initialData
      ? { ...initialData, password: "", memberships: initialData.memberships || [] }
      : {
          username: "",
          password: "",
          name: "",
          email: "",
          role_id: 2,
          status: "active",
          memberships: [],
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
    const username = normaliseText(formData.username || "");
    const name = normaliseText(formData.name || "");
    const email = normaliseText(formData.email || "");
    if (charLength(username) < 3 || charLength(username) > 100 || /\s/.test(username))
      newErrors.username = "ชื่อผู้ใช้งานต้องยาว 3-100 ตัวอักษร และห้ามมีช่องว่าง";
    if (!initialData && (!formData.password || formData.password.length < 8))
      newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (formData.password && (formData.password.length < 8 || formData.password.length > 200))
      newErrors.password = "รหัสผ่านต้องมี 8-200 ตัวอักษร";
    if (charLength(name) < 2 || charLength(name) > MAX_NAME_LENGTH)
      newErrors.name = `ชื่อ-นามสกุลต้องยาว 2-${MAX_NAME_LENGTH} ตัวอักษร`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || charLength(email) > 254)
      newErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    const dataToSend = {
      id: initialData?.id, // ✅ เพิ่ม id
      username: normaliseText(formData.username),
      name: normaliseText(formData.name),
      email: normaliseText(formData.email),
      role_id: Number(formData.role_id),
      status: formData.status,
      memberships: (formData.memberships || []).map(({ organization_id, role_id, status = "active", is_primary = false, id }) => ({ id, organization_id: Number(organization_id), role_id: Number(role_id), status, is_primary: Boolean(is_primary) })),
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
              maxLength={MAX_NAME_LENGTH}
              aria-describedby={errors.name ? "admin-name-error" : undefined}
            />
            {errors.name && (
              <span id="admin-name-error" className="adm-error-text">{errors.name}</span>
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
                {currentRoleId === 1 && <option value="1">System Admin</option>}
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
          <section className="adm-membership-section" aria-labelledby="membership-heading">
            <div className="adm-membership-heading"><FiShield className="label-icon" /><div><h4 id="membership-heading">หน่วยงานและบทบาท</h4><p>เลือกหน่วยงานที่เจ้าหน้าที่เข้าถึง และกำหนดบทบาทในแต่ละหน่วยงาน</p></div></div>
            {organizations.filter((organization) => organization.status === "active").length === 0 ? <p className="adm-no-perm-text">ยังไม่มีหน่วยงานที่เปิดใช้งาน กรุณาสร้างหน่วยงานก่อน</p> : organizations.filter((organization) => organization.status === "active").map((organization) => {
              const membership = (formData.memberships || []).find((item) => Number(item.organization_id) === Number(organization.id));
              const setMembership = (next) => setFormData({ ...formData, memberships: next });
              return <div className="adm-membership-row" key={organization.id}>
                <label className="adm-org-check"><input type="checkbox" checked={Boolean(membership)} onChange={(event) => setMembership(event.target.checked ? [...formData.memberships, { organization_id: organization.id, role_id: roles[0]?.id || "", status: "active" }] : formData.memberships.filter((item) => Number(item.organization_id) !== Number(organization.id)))} /> <span>{organization.name}</span></label>
                {membership && <select className="adm-select" aria-label={`บทบาทของ ${organization.name}`} value={membership.role_id} onChange={(event) => setMembership(formData.memberships.map((item) => Number(item.organization_id) === Number(organization.id) ? { ...item, role_id: Number(event.target.value) } : item))}>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select>}
              </div>;
            })}
          </section>
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
