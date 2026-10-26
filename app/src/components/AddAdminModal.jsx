import SearchableSelect from "./SearchableSelect";
import { authSession } from "../utils/authSession";
import React, { useMemo, useState } from "react";
import {
  FiBriefcase,
  FiEye,
  FiEyeOff,
  FiHome,
  FiUser,
  FiLock,
  FiMail,
  FiShield,
  FiCheckCircle,
  FiX,
} from "react-icons/fi";
import "./AddAdminModal.css";
import CounselorGradeScope, { gradeScopeError } from "./CounselorGradeScope";

const MAX_NAME_LENGTH = 255;
const MAX_USERNAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 100;
const normaliseText = (value) =>
  value.normalize("NFC").trim().replace(/\s+/g, " ");
const charLength = (value) => Array.from(value).length;
const teacherSchoolRoles = new Set([
  "counselor",
  "homeroom",
  "subject_teacher",
  "other",
]);
const staffSchoolRoles = new Set([
  "admin",
  "mental_admin",
  "physical_admin",
  "dorm_staff",
]);

export default function AddAdminModal({
  onClose,
  onSave,
  initialData,
  canViewPassword,
  organizations = [],
  organizationRoles = {},
  schoolAssignmentOptions = {},
}) {
  const currentUser = authSession("staff").user;

  const [showPassword, setShowPassword] = useState(false);
  const [organizationToAdd, setOrganizationToAdd] = useState("");
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(
    initialData
      ? {
          ...initialData,
          password: "",
          memberships: (initialData.memberships || []).map((membership) => ({
            ...membership,
            school_assignment: (initialData.school_assignments || []).find(
              (assignment) =>
                Number(assignment.organization_id) ===
                Number(membership.organization_id),
            ),
          })),
        }
      : {
          username: "",
          password: "",
          name: "",
          email: "",
          role_id: 3,
          status: "active",
          memberships: [],
        },
  );

  const [errors, setErrors] = useState({});

  const availableOrganizations = useMemo(
    () =>
      organizations.filter(
        (organization) =>
          organization.status === "active" &&
          organization.org_level !== "main" &&
          organization.kind !== "main",
      ),
    [organizations],
  );

  const isEditingSelf =
    initialData && currentUser && currentUser.id === initialData.id;
  // This modal is only reachable by system admins, so password and status
  // are always editable. Own account is protected from being demoted or
  // suspended so the last admin cannot lock themselves out.
  const canChangePassword = true;
  const canChangeRole = !isEditingSelf;
  const canChangeStatus = !isEditingSelf;
  const isSystemAdminAccount = Number(formData.role_id) === 1;

  const updateMembership = (organizationId, updater) =>
    setFormData((current) => ({
      ...current,
      memberships: current.memberships.map((membership) =>
        Number(membership.organization_id) === Number(organizationId)
          ? updater(membership)
          : membership,
      ),
    }));

  const addOrganization = (organizationId) => {
    const organization = availableOrganizations.find(
      (item) => Number(item.id) === Number(organizationId),
    );
    if (!organization) return;
    const availableRoles = organizationRoles[organization.id] || [];
    if (!availableRoles.length) {
      setErrors((current) => ({
        ...current,
        memberships: `หน่วยงาน "${organization.name}" ยังไม่มีบทบาท กรุณาสร้างบทบาทที่หน้า บทบาทและสิทธิ์ ก่อน`,
      }));
      setOrganizationToAdd("");
      return;
    }
    const schoolOptions = schoolAssignmentOptions[organization.id];
    const firstSchool = schoolOptions?.schools?.[0];
    const firstTeacherType = schoolOptions?.teacher_types?.[0];
    setFormData((current) => ({
      ...current,
      memberships: [
        ...current.memberships,
        {
          organization_id: organization.id,
          role_id: availableRoles[0].id,
          status: "active",
          is_primary: current.memberships.length === 0,
          school_assignment:
            organization.org_type === "school"
              ? {
                  school_id: firstSchool?.id || "",
                  role_code: "other",
                  personnel_kind: "teacher",
                  teacher_type_id: firstTeacherType?.id || "",
                  employee_code: "",
                  position: "",
                }
              : null,
        },
      ],
    }));
    setOrganizationToAdd("");
    setErrors((current) => ({ ...current, memberships: undefined }));
  };

  const removeOrganization = (organizationId) =>
    setFormData((current) => {
      const memberships = current.memberships.filter(
        (membership) =>
          Number(membership.organization_id) !== Number(organizationId),
      );
      if (memberships.length && !memberships.some((item) => item.is_primary))
        memberships[0] = { ...memberships[0], is_primary: true };
      return { ...current, memberships };
    });

  const validateForm = () => {
    const newErrors = {};
    const username = normaliseText(formData.username || "");
    const name = normaliseText(formData.name || "");
    const email = normaliseText(formData.email || "");
    if (
      charLength(username) < 3 ||
      charLength(username) > MAX_USERNAME_LENGTH ||
      /\s/.test(username)
    )
      newErrors.username = `ชื่อผู้ใช้งานต้องยาว 3-${MAX_USERNAME_LENGTH} ตัวอักษร และห้ามมีช่องว่าง`;
    if (!initialData && (!formData.password || formData.password.length < 8))
      newErrors.password = "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    if (
      formData.password &&
      (formData.password.length < 8 || formData.password.length > 200)
    )
      newErrors.password = "รหัสผ่านต้องมี 8-200 ตัวอักษร";
    if (charLength(name) < 2 || charLength(name) > MAX_NAME_LENGTH)
      newErrors.name = `ชื่อ-นามสกุลต้องยาว 2-${MAX_NAME_LENGTH} ตัวอักษร`;
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      charLength(email) > MAX_EMAIL_LENGTH
    )
      newErrors.email = "กรุณากรอกอีเมลให้ถูกต้อง";
    if (Number(formData.role_id) !== 1 && !formData.memberships.length)
      newErrors.memberships = "กรุณาเลือกหน่วยงานอย่างน้อย 1 แห่ง";
    for (const membership of formData.memberships) {
      const organization = availableOrganizations.find(
        (item) => Number(item.id) === Number(membership.organization_id),
      );
      if (!membership.role_id) {
        newErrors.memberships = "กรุณาเลือกบทบาทของทุกหน่วยงาน";
        break;
      }
      if (organization?.org_type === "school") {
        const assignment = membership.school_assignment;
        if (!assignment?.school_id || !assignment?.role_code) {
          newErrors.memberships =
            "กรุณาเลือกโรงเรียนและหน้าที่ของบุคลากรให้ครบถ้วน";
          break;
        }
        if (
          assignment.personnel_kind === "teacher" &&
          !assignment.teacher_type_id
        ) {
          newErrors.memberships = "กรุณาเลือกประเภทครู";
          break;
        }
        const gradeError = gradeScopeError(
          assignment.role_code,
          assignment.grade_level_ids,
        );
        if (gradeError) {
          newErrors.memberships = gradeError;
          break;
        }
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const dataToSend = {
      id: initialData?.id, // ✅ เพิ่ม id
      username: normaliseText(formData.username),
      name: normaliseText(formData.name),
      email: normaliseText(formData.email),
      role_id: Number(formData.role_id) === 1 ? 1 : 3,
      status: formData.status,
      memberships: (formData.memberships || []).map(
        ({
          organization_id,
          role_id,
          status = "active",
          is_primary = false,
          id,
          school_assignment,
        }) => ({
          id,
          organization_id: Number(organization_id),
          role_id: Number(role_id),
          status,
          is_primary: Boolean(is_primary),
          school_assignment: school_assignment
            ? {
                school_id: Number(school_assignment.school_id),
                role_code: school_assignment.role_code,
                personnel_kind: school_assignment.personnel_kind,
                teacher_type_id: school_assignment.teacher_type_id
                  ? Number(school_assignment.teacher_type_id)
                  : null,
                employee_code: school_assignment.employee_code || "",
                position: school_assignment.position || "",
                // Only counselors carry a grade scope; null = whole school.
                ...(school_assignment.role_code === "counselor" && {
                  grade_level_ids: school_assignment.grade_level_ids ?? null,
                }),
              }
            : null,
        }),
      ),
    };

    if (formData.password && formData.password.trim() !== "") {
      dataToSend.password = formData.password;
    }

    setSaving(true);
    try {
      await onSave(dataToSend);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="adm-overlay" role="presentation">
      <div
        className="adm-card"
        role="dialog"
        aria-modal="true"
        aria-label={initialData ? "แก้ไขข้อมูลผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}
      >
        <div className="adm-header">
          <div className="adm-header-title">
            <h3>{initialData ? "แก้ไขข้อมูลผู้ใช้งาน" : "เพิ่มผู้ใช้งาน"}</h3>
          </div>
          <button
            className="ADM-close-circle-btn"
            onClick={onClose}
            type="button"
            aria-label="ปิดหน้าต่าง"
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
                      color: "var(--suth-muted)",
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
              <span id="admin-name-error" className="adm-error-text">
                {errors.name}
              </span>
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
            {!errors.email && (
              <small>
                เจ้าหน้าที่ต้องยืนยันอีเมลนี้ก่อนใช้ OTP เข้าสู่ระบบ
              </small>
            )}
          </div>

          {/* Account authority & status */}
          <div className="adm-grid-2">
            <div className="adm-input-group">
              <label htmlFor="adm-system-admin">
                <FiShield className="label-icon" /> สิทธิ์ผู้ดูแลระบบ
              </label>
              <label className="adm-switch" htmlFor="adm-system-admin">
                <input
                  id="adm-system-admin"
                  type="checkbox"
                  role="switch"
                  checked={isSystemAdminAccount}
                  disabled={!canChangeRole}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      role_id: event.target.checked ? 1 : 3,
                    })
                  }
                />
                <span className="adm-switch__track" aria-hidden="true" />
                <span>ผู้ดูแลระบบทั้งระบบ (System Admin)</span>
              </label>
              <small>
                {isEditingSelf
                  ? "ไม่สามารถถอดสิทธิ์ผู้ดูแลระบบของบัญชีตัวเองได้"
                  : "เข้าถึงการตั้งค่าทั้งระบบ สิทธิ์ทำงานในหน่วยงานกำหนดจากบทบาทในหน่วยงานด้านล่าง"}
              </small>
            </div>

            <div className="adm-input-group">
              <label>
                <FiCheckCircle className="label-icon" /> สถานะการใช้งาน
              </label>
              <div className="adm-status-toggle">
                <button
                  type="button"
                  aria-pressed={formData.status === "active"}
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
                  type="button"
                  aria-pressed={formData.status === "inactive"}
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
          <section
            className="adm-membership-section"
            aria-labelledby="membership-heading"
          >
            <div className="adm-membership-heading">
              <FiBriefcase className="label-icon" />
              <div>
                <h4 id="membership-heading">หน่วยงานและหน้าที่การทำงาน</h4>
                <p>
                  เลือกหน่วยงานและบทบาทครั้งเดียว หากเป็นครู
                  ระบบจะเพิ่มเข้ารายชื่อครูให้อัตโนมัติ
                </p>
              </div>
            </div>
            {availableOrganizations.length === 0 ? (
              <p className="adm-no-perm-text">
                ยังไม่มีหน่วยงานที่เปิดใช้งาน กรุณาสร้างหน่วยงานก่อน
              </p>
            ) : (
              <>
                <div className="adm-add-organization">
                  <label htmlFor="adm-organization-picker">เพิ่มหน่วยงาน</label>
                  <SearchableSelect
                    id="adm-organization-picker"
                    className="adm-select"
                    value={organizationToAdd}
                    onChange={(event) => addOrganization(event.target.value)}
                  >
                    <option value="">+ เพิ่มหน่วยงาน…</option>
                    {availableOrganizations.map((organization) => (
                      <option
                        key={organization.id}
                        value={organization.id}
                        disabled={formData.memberships.some(
                          (membership) =>
                            Number(membership.organization_id) ===
                            Number(organization.id),
                        )}
                      >
                        {organization.name}
                        {organization.org_type === "school"
                          ? " · โรงเรียน"
                          : ""}
                      </option>
                    ))}
                  </SearchableSelect>
                </div>
                {!formData.memberships.length && (
                  <p className="adm-membership-empty">
                    เลือกหน่วยงานเพื่อกำหนดบทบาทและประเภทบุคลากร
                  </p>
                )}
                <div className="adm-membership-list">
                  {formData.memberships.map((membership) => {
                    const organization = availableOrganizations.find(
                      (item) =>
                        Number(item.id) === Number(membership.organization_id),
                    );
                    if (!organization) return null;
                    const availableRoles =
                      organizationRoles[organization.id] || [];
                    const schoolOptions =
                      schoolAssignmentOptions[organization.id];
                    const assignment = membership.school_assignment;
                    return (
                      <div className="adm-membership-row" key={organization.id}>
                        <div className="adm-membership-row__header">
                          <span
                            className="adm-organization-icon"
                            aria-hidden="true"
                          >
                            <FiHome />
                          </span>
                          <div>
                            <strong>{organization.name}</strong>
                            <small>
                              {organization.org_type === "school"
                                ? "หน่วยงานโรงเรียน"
                                : "หน่วยงานบริการ"}
                            </small>
                          </div>
                          <button
                            type="button"
                            className="adm-remove-organization"
                            onClick={() => removeOrganization(organization.id)}
                            aria-label={`นำ ${organization.name} ออกจากผู้ใช้งาน`}
                          >
                            <FiX aria-hidden="true" />
                          </button>
                        </div>
                        <div className="adm-assignment-grid">
                          <div className="adm-input-group">
                            <label>บทบาทในหน่วยงาน</label>
                            <SearchableSelect
                              className="adm-select"
                              aria-label={`บทบาทของ ${organization.name}`}
                              value={membership.role_id}
                              onChange={(event) =>
                                updateMembership(organization.id, (item) => ({
                                  ...item,
                                  role_id: Number(event.target.value),
                                }))
                              }
                            >
                              {availableRoles.map((role) => (
                                <option value={role.id} key={role.id}>
                                  {role.name}
                                </option>
                              ))}
                            </SearchableSelect>
                          </div>
                          {organization.org_type === "school" && (
                            <>
                              <div className="adm-input-group">
                                <label>โรงเรียน</label>
                                <SearchableSelect
                                  className="adm-select"
                                  aria-label={`โรงเรียนของ ${organization.name}`}
                                  value={assignment?.school_id || ""}
                                  onChange={(event) =>
                                    updateMembership(
                                      organization.id,
                                      (item) => ({
                                        ...item,
                                        school_assignment: {
                                          ...item.school_assignment,
                                          school_id: Number(event.target.value),
                                          // Grades belong to one school.
                                          grade_level_ids: null,
                                        },
                                      }),
                                    )
                                  }
                                >
                                  <option value="">เลือกโรงเรียน…</option>
                                  {(schoolOptions?.schools || []).map(
                                    (school) => (
                                      <option key={school.id} value={school.id}>
                                        {school.name}
                                      </option>
                                    ),
                                  )}
                                </SearchableSelect>
                              </div>
                              <div className="adm-input-group">
                                <label>ประเภทบุคลากร</label>
                                <div
                                  className="adm-personnel-toggle"
                                  role="group"
                                  aria-label={`ประเภทบุคลากรของ ${organization.name}`}
                                >
                                  {[
                                    ["teacher", "ครู"],
                                    ["staff", "บุคลากรสนับสนุน"],
                                  ].map(([value, label]) => (
                                    <button
                                      type="button"
                                      key={value}
                                      className={
                                        assignment?.personnel_kind === value
                                          ? "active"
                                          : ""
                                      }
                                      aria-pressed={
                                        assignment?.personnel_kind === value
                                      }
                                      onClick={() =>
                                        updateMembership(
                                          organization.id,
                                          (item) => ({
                                            ...item,
                                            school_assignment: {
                                              ...item.school_assignment,
                                              personnel_kind: value,
                                              role_code:
                                                value === "teacher"
                                                  ? teacherSchoolRoles.has(
                                                      item.school_assignment
                                                        ?.role_code,
                                                    )
                                                    ? item.school_assignment
                                                        .role_code
                                                    : "other"
                                                  : staffSchoolRoles.has(
                                                        item.school_assignment
                                                          ?.role_code,
                                                      )
                                                    ? item.school_assignment
                                                        .role_code
                                                    : "admin",
                                            },
                                          }),
                                        )
                                      }
                                    >
                                      {label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="adm-input-group">
                                <label>หน้าที่ในโรงเรียน</label>
                                <SearchableSelect
                                  className="adm-select"
                                  aria-label={`หน้าที่ในโรงเรียนของ ${organization.name}`}
                                  value={assignment?.role_code || ""}
                                  onChange={(event) =>
                                    updateMembership(
                                      organization.id,
                                      (item) => ({
                                        ...item,
                                        school_assignment: {
                                          ...item.school_assignment,
                                          role_code: event.target.value,
                                        },
                                      }),
                                    )
                                  }
                                >
                                  {Object.entries(
                                    schoolOptions?.role_labels || {},
                                  )
                                    .filter(([code]) =>
                                      (assignment?.personnel_kind === "staff"
                                        ? staffSchoolRoles
                                        : teacherSchoolRoles
                                      ).has(code),
                                    )
                                    .map(([code, label]) => (
                                      <option key={code} value={code}>
                                        {label}
                                      </option>
                                    ))}
                                </SearchableSelect>
                              </div>
                              {assignment?.role_code === "counselor" && (
                                <CounselorGradeScope
                                  grades={(schoolOptions?.grades || []).filter(
                                    (grade) =>
                                      Number(grade.school_id) ===
                                      Number(assignment.school_id),
                                  )}
                                  value={assignment.grade_level_ids ?? null}
                                  disabled={saving}
                                  onChange={(grade_level_ids) =>
                                    updateMembership(
                                      organization.id,
                                      (item) => ({
                                        ...item,
                                        school_assignment: {
                                          ...item.school_assignment,
                                          grade_level_ids,
                                        },
                                      }),
                                    )
                                  }
                                />
                              )}
                              {assignment?.personnel_kind === "teacher" && (
                                <div className="adm-input-group">
                                  <label>ประเภทครู</label>
                                  <SearchableSelect
                                    className="adm-select"
                                    aria-label={`ประเภทครูของ ${organization.name}`}
                                    value={assignment.teacher_type_id || ""}
                                    onChange={(event) =>
                                      updateMembership(
                                        organization.id,
                                        (item) => ({
                                          ...item,
                                          school_assignment: {
                                            ...item.school_assignment,
                                            teacher_type_id: Number(
                                              event.target.value,
                                            ),
                                          },
                                        }),
                                      )
                                    }
                                  >
                                    <option value="">เลือกประเภทครู…</option>
                                    {(schoolOptions?.teacher_types || []).map(
                                      (type) => (
                                        <option key={type.id} value={type.id}>
                                          {type.name}
                                        </option>
                                      ),
                                    )}
                                  </SearchableSelect>
                                </div>
                              )}
                              <div className="adm-input-group">
                                <label>
                                  รหัสบุคลากร <span>(ถ้ามี)</span>
                                </label>
                                <input
                                  className="adm-input"
                                  value={assignment?.employee_code || ""}
                                  maxLength={50}
                                  onChange={(event) =>
                                    updateMembership(
                                      organization.id,
                                      (item) => ({
                                        ...item,
                                        school_assignment: {
                                          ...item.school_assignment,
                                          employee_code: event.target.value,
                                        },
                                      }),
                                    )
                                  }
                                />
                              </div>
                              <div className="adm-input-group">
                                <label>
                                  ตำแหน่ง <span>(ถ้ามี)</span>
                                </label>
                                <input
                                  className="adm-input"
                                  value={assignment?.position || ""}
                                  maxLength={100}
                                  onChange={(event) =>
                                    updateMembership(
                                      organization.id,
                                      (item) => ({
                                        ...item,
                                        school_assignment: {
                                          ...item.school_assignment,
                                          position: event.target.value,
                                        },
                                      }),
                                    )
                                  }
                                />
                              </div>
                            </>
                          )}
                        </div>
                        {!availableRoles.length && (
                          <small className="adm-no-perm-text">
                            ยังไม่มีบทบาทสำหรับหน่วยงานนี้
                            กรุณาสร้างในหน้าบทบาทและสิทธิ์ก่อน
                          </small>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {errors.memberships && (
              <span className="adm-error-text">{errors.memberships}</span>
            )}
          </section>
        </div>

        <div className="adm-footer">
          <button
            className="adm-btn-cancel"
            onClick={onClose}
            disabled={saving}
          >
            ยกเลิก
          </button>
          <button
            className="adm-btn-save"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </div>
      </div>
    </div>
  );
}
