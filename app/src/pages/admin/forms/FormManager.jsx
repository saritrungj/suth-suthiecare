import SearchableSelect from "../../../components/SearchableSelect";
import { useModuleActions } from "../../../permissions/useModuleActions";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { usePageExport } from "../../../components/ExcelExport";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getForms,
  deleteFormInDb,
  renameFormInDb,
  updateFormImageOnly,
  updateFormStatus,
  updateFormClinicType,
  duplicateFormInDb,
  getActiveClinics,
} from "../../../services/api";
import "./styles/FormManager.css";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import { confirmAlert } from "../../../utils/alerts";
import ActiveOrganizationScope from "../../../components/OrganizationScope";
import {
  HEALTH_DOMAINS,
  getClinicName,
  getFormDomain,
  getHealthDomainLabel,
  getOrganizationProfile,
  groupForms,
} from "../../../permissions/organizationProfile";
import FilterDropdown, {
  FilterField,
} from "../../../components/FilterDropdown";
import ResultSummary from "../../../components/table/ResultSummary";

import {
  FaFolderOpen,
  FaTrash,
  FaCheckCircle,
  FaSort,
  FaFileAlt,
  FaGlobe,
  FaEyeSlash,
  FaTimesCircle,
  FaFilter,
  FaCopy,
  FaChevronDown,
  FaSearch,
  FaEdit,
  FaImage,
  FaClinicMedical,
  FaExternalLinkAlt,
  FaTrashAlt,
  FaLock,
  FaExclamationTriangle,
} from "react-icons/fa";
import { PageHero } from "../../../components/dashboard/DashboardKit";

// 🟢 Component สำหรับ Dropdown
const CustomDropdown = ({
  icon: Icon,
  value,
  options,
  onChange,
  style,
  iconStyle,
  textStyle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );
  const displayLabel = selectedOption
    ? selectedOption.label
    : options[0]?.label || "โปรดเลือก...";

  return (
    <div
      className={"fm-custom-select" + (isOpen ? " is-open" : "")}
      ref={ref}
      style={{ ...style, zIndex: isOpen ? "var(--z-dropdown)" : 1 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className="fm-filter-icon" style={iconStyle} />
      <span className="fm-select-value" style={textStyle}>
        {displayLabel}
      </span>
      <FaChevronDown
        className={`fm-dropdown-icon ${isOpen ? "open" : ""}`}
        style={iconStyle}
      />

      {isOpen && (
        <div className="fm-select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`fm-select-option ${String(value) === String(opt.value) ? "selected" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              {toDisplayText(opt.label)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FormManager = () => {
  const { activeOrganization, activeOrganizationType } = usePermissions();
  const profile = getOrganizationProfile(
    activeOrganization === "all" ? null : activeOrganizationType,
  );
  const usesClinics = profile.formGroupAxis !== "health_domain";
  const formRights = useModuleActions("forms");
  const [forms, setForms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [sortBy, setSortBy] = useState("เปิดล่าสุด");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const fileInputRef = useRef(null);
  const [selectedFormForImage, setSelectedFormForImage] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // 🟢 จัดการการเปิด/ปิดเมนู
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renamingForm, setRenamingForm] = useState({ id: null, title: "" });

  const [isClinicModalOpen, setIsClinicModalOpen] = useState(false);
  const [editingClinicForm, setEditingClinicForm] = useState({
    id: null,
    clinic_type: "general",
  });

  // 🟢 เพิ่ม State สำหรับคลินิก
  const [clinics, setClinics] = useState([]);
  // Label of a form on the active grouping axis (clinic or health domain),
  // shown with the organization in the all-organizations view.
  const formAxisLabel = (form) =>
    [
      form.organization_name || "ยังไม่ระบุหน่วยงาน",
      form.health_domain
        ? getHealthDomainLabel(form.health_domain)
        : getClinicName(form.clinic_type || "general", clinics),
    ]
      .filter(Boolean)
      .join(" · ");

  const [toastMessage, setToastMessage] = useState(null);
  const toastTimer = useRef(null);

  const showToast = (content) => {
    setToastMessage(content);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchForms = useCallback(async () => {
    setIsLoading(true);
    try {
      let sortParam = "lastOpened";
      if (sortBy === "แก้ไขล่าสุด") sortParam = "lastModified";
      if (sortBy === "ชื่อ") sortParam = "title";

      const [formRes, clinicRes] = await Promise.all([
        getForms(sortParam),
        getActiveClinics(),
      ]);
      setForms(formRes.data);
      setClinics(clinicRes.data.data || []);
    } catch (error) {
      setForms([]);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy, activeOrganization]);

  useEffect(() => {
    fetchForms();
  }, [fetchForms]);

  // Filter values belong to one organization type; start fresh on a switch.
  useEffect(() => {
    setClinicFilter("all");
  }, [activeOrganization]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // ปิดเมนูการ์ดฟอร์ม
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredForms = forms.filter((f) => {
    const matchSearch = f.title
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const groupValue =
      profile.formGroupAxis === "health_domain"
        ? getFormDomain(f)
        : f.clinic_type || "general";
    const matchClinic = clinicFilter === "all" || groupValue === clinicFilter;
    const currentStatus = f.status || "draft";
    const matchStatus =
      statusFilter === "all" || currentStatus === statusFilter;
    return matchSearch && matchClinic && matchStatus;
  });

  const formGroups = groupForms(filteredForms, profile, clinics);

  usePageExport({
    title: "แบบประเมิน",
    sources: [{ resource: "forms", ids: filteredForms.map((r) => r.id) }],
  });
  const handleToggleMenu = (e, formId) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === formId ? null : formId);
  };

  const handleOpenNewTab = (e, formId) => {
    e.stopPropagation();
    window.open(`/admin/forms/edit/${formId}`, "_blank");
    setOpenMenuId(null);
  };

  const handleOpenImageModal = (e, formId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setSelectedFormForImage(formId);
    setPreviewImage(null);
    setIsImageModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      setPreviewImage(reader.result);
    };
    e.target.value = null;
  };

  const handleConfirmImageUpload = async () => {
    if (!selectedFormForImage || !previewImage) return;
    try {
      await updateFormImageOnly(selectedFormForImage, { image: previewImage });
      setForms(
        forms.map((f) =>
          f.id === selectedFormForImage ? { ...f, image: previewImage } : f,
        ),
      );
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCheckCircle /> อัปเดตภาพปกเรียบร้อยแล้ว
        </span>,
      );
    } catch (error) {
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaTimesCircle /> ไม่สามารถอัปโหลดภาพได้ กรุณาลองใหม่อีกครั้ง
        </span>,
      );
    } finally {
      setPreviewImage(null);
      setSelectedFormForImage(null);
      setIsImageModalOpen(false);
    }
  };

  const handleDeleteForm = async (e, formId) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const confirmed = await confirmAlert({
      title: "ลบฟอร์ม?",
      text: "การลบฟอร์มไม่สามารถย้อนกลับได้",
      confirmText: "ลบฟอร์ม",
      danger: true,
    });
    if (confirmed) {
      try {
        await deleteFormInDb(formId);
        setForms(forms.filter((f) => f.id !== formId));
        showToast(
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaTrash /> ลบฟอร์มเรียบร้อยแล้ว
          </span>,
        );
      } catch (error) {
        showToast(
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FaTimesCircle /> ไม่สามารถลบฟอร์มได้ กรุณาลองใหม่อีกครั้ง
          </span>,
        );
      }
    }
  };

  const handleOpenRenameModal = (e, form) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setRenamingForm({ id: form.id, title: form.title || "ชื่อฟอร์ม" });
    setIsRenameModalOpen(true);
  };

  const handleSaveRename = async () => {
    if (!renamingForm.title.trim()) return;
    try {
      await renameFormInDb(renamingForm.id, renamingForm.title);
      setForms(
        forms.map((f) =>
          f.id === renamingForm.id ? { ...f, title: renamingForm.title } : f,
        ),
      );
      setIsRenameModalOpen(false);
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCheckCircle /> เปลี่ยนชื่อฟอร์มเรียบร้อยแล้ว
        </span>,
      );
    } catch (error) {
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaTimesCircle /> ไม่สามารถเปลี่ยนชื่อได้ กรุณาลองใหม่อีกครั้ง
        </span>,
      );
    }
  };

  const handleOpenClinicModal = (e, form) => {
    e.stopPropagation();
    setOpenMenuId(null);
    setEditingClinicForm({
      id: form.id,
      clinic_type: form.clinic_type || "general",
    });
    setIsClinicModalOpen(true);
  };

  const handleSaveClinic = async () => {
    try {
      await updateFormClinicType(editingClinicForm.id, {
        clinic_type: editingClinicForm.clinic_type,
      });
      setForms(
        forms.map((f) =>
          f.id === editingClinicForm.id
            ? { ...f, clinic_type: editingClinicForm.clinic_type }
            : f,
        ),
      );
      setIsClinicModalOpen(false);
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCheckCircle /> เปลี่ยนประเภทคลินิกเรียบร้อยแล้ว
        </span>,
      );
    } catch (error) {
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaTimesCircle /> ไม่สามารถเปลี่ยนประเภทคลินิกได้ กรุณาลองใหม่อีกครั้ง
        </span>,
      );
    }
  };

  const handleToggleStatus = async (e, form) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const currentStatus = form.status || "draft";
    const newStatus = currentStatus === "published" ? "draft" : "published";

    try {
      await updateFormStatus(form.id, { status: newStatus });
      setForms(
        forms.map((f) => (f.id === form.id ? { ...f, status: newStatus } : f)),
      );
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCheckCircle /> เปลี่ยนสถานะเป็น{" "}
          {newStatus === "published" ? "เผยแพร่" : "ฉบับร่าง"} เรียบร้อย
        </span>,
      );
    } catch (error) {
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaTimesCircle /> ไม่สามารถเปลี่ยนสถานะได้
        </span>,
      );
    }
  };

  const handleSortChange = (val) => {
    setSortBy(val);
    showToast(
      <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <FaSort /> จัดเรียงข้อมูล: {val}
      </span>,
    );
  };

  const handleDuplicateForm = async (e, form) => {
    e.stopPropagation();
    setOpenMenuId(null);
    try {
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          ⏳ กำลังทำสำเนาฟอร์ม...
        </span>,
      );
      await duplicateFormInDb(form.id);
      await fetchForms();
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaCopy /> ทำสำเนา "{toDisplayText(form.title)}" เรียบร้อยแล้ว
        </span>,
      );
    } catch (error) {
      showToast(
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FaTimesCircle /> ไม่สามารถทำสำเนาฟอร์มได้ กรุณาลองใหม่อีกครั้ง
        </span>,
      );
    }
  };

  return (
    <div className="fm-admin-layout">
      <main className="fm-main-content">
        <PageHero
          title="จัดการฟอร์ม"
          description={profile.formsHint}
          scope={<ActiveOrganizationScope />}
          actions={
            <button
              hidden={!formRights.create}
              className="fm-btn-add-form"
              onClick={() => navigate("/admin/forms/create")}
            >
              + สร้างฟอร์ม
            </button>
          }
        />

        <div className="fm-action-bar">
          {/* 🟢 ช่องค้นหาดีไซน์ใหม่ */}
          <div className="fm-search-group">
            <FaSearch
              className="fm-filter-icon"
              style={{ color: "var(--suth-muted)" }}
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อฟอร์ม..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* 🟢 กลุ่มเครื่องมือขวามือ */}
          <div className="fm-action-tools">
            <FilterDropdown
              activeCount={
                [
                  clinicFilter !== "all" ? clinicFilter : "",
                  statusFilter !== "all" ? statusFilter : "",
                  sortBy !== "เปิดล่าสุด" ? sortBy : "",
                ].filter(Boolean).length
              }
              onClear={() => {
                setClinicFilter("all");
                setStatusFilter("all");
                setSortBy("เปิดล่าสุด");
              }}
            >
              <FilterField
                label={
                  profile.formGroupAxis === "health_domain"
                    ? "ด้านสุขภาพ"
                    : "คลินิก"
                }
              >
                <CustomDropdown
                  icon={FaFilter}
                  value={clinicFilter}
                  onChange={setClinicFilter}
                  options={
                    profile.formGroupAxis === "health_domain"
                      ? [
                          {
                            value: "all",
                            label: `ทุกด้านสุขภาพ (${forms.length})`,
                          },
                          ...HEALTH_DOMAINS,
                        ]
                      : [
                          {
                            value: "all",
                            label: `ทุกคลินิก (${forms.length})`,
                          },
                          { value: "general", label: "ทั่วไป" },
                          ...clinics.map((c) => ({
                            value: c.slug,
                            label: c.name,
                          })),
                        ]
                  }
                />
              </FilterField>

              <FilterField label="สถานะ">
                <CustomDropdown
                  icon={FaFileAlt}
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "ทุกสถานะ" },
                    { value: "published", label: "เผยแพร่แล้ว" },
                    { value: "draft", label: "ฉบับร่าง" },
                  ]}
                />
              </FilterField>

              <FilterField label="เรียงลำดับ">
                <CustomDropdown
                  icon={FaSort}
                  value={sortBy}
                  onChange={handleSortChange}
                  options={[
                    { value: "เปิดล่าสุด", label: "เปิดล่าสุด" },
                    { value: "แก้ไขล่าสุด", label: "แก้ไขล่าสุด" },
                    { value: "ชื่อ", label: "เรียงตามชื่อ" },
                  ]}
                />
              </FilterField>
            </FilterDropdown>

            {/* สลับมุมมอง */}
            <div
              className="cw-mode fm-view-toggle"
              role="group"
              aria-label="มุมมองแบบฟอร์ม"
            >
              <button
                type="button"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              >
                แบบตาราง
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                แบบรายการ
              </button>
            </div>
          </div>
        </div>

        <ResultSummary
          pagination={{
            page: 1,
            total: filteredForms.length,
            limit: filteredForms.length || 1,
          }}
          chips={[
            {
              key: "group",
              label:
                profile.formGroupAxis === "health_domain"
                  ? "ด้านสุขภาพ"
                  : "คลินิก",
              value:
                clinicFilter === "all"
                  ? ""
                  : clinicFilter === "general"
                    ? "ทั่วไป"
                    : [
                        ...HEALTH_DOMAINS,
                        ...clinics.map((c) => ({
                          value: c.slug,
                          label: c.name,
                        })),
                      ].find((o) => o.value === clinicFilter)?.label ||
                      clinicFilter,
              onRemove: () => setClinicFilter("all"),
            },
            {
              key: "status",
              label: "สถานะ",
              value:
                statusFilter === "published"
                  ? "เผยแพร่แล้ว"
                  : statusFilter === "draft"
                    ? "ฉบับร่าง"
                    : "",
              onRemove: () => setStatusFilter("all"),
            },
            {
              key: "sort",
              label: "เรียง",
              value: sortBy === "เปิดล่าสุด" ? "" : sortBy,
              onRemove: () => setSortBy("เปิดล่าสุด"),
            },
          ]}
          onClearAll={() => {
            setClinicFilter("all");
            setStatusFilter("all");
            setSortBy("เปิดล่าสุด");
          }}
        />

        {isLoading ? (
          <div className="fm-loading-state">
            <div className="fm-loading-spinner"></div>
            <p>กำลังโหลดฟอร์ม...</p>
          </div>
        ) : (
          <div className="fm-groups">
            {formGroups.length === 0 && (
              <p className="fm-empty-note">
                {forms.length === 0
                  ? "ยังไม่มีแบบประเมินในหน่วยงานนี้"
                  : "ไม่พบแบบประเมินที่ตรงกับการค้นหาหรือตัวกรอง"}
              </p>
            )}
            {formGroups.map((group, groupIndex) => (
              <section
                key={group.key}
                className="fm-group"
                aria-labelledby={`fm-group-${group.key}`}
              >
                <h2 className="fm-group-title" id={`fm-group-${group.key}`}>
                  {toDisplayText(group.label)}
                  <span className="fm-group-count">
                    {group.forms.length.toLocaleString("th-TH")} ฟอร์ม
                  </span>
                  {group.missing && (
                    <span className="fm-group-warning">
                      <FaExclamationTriangle aria-hidden="true" />
                      ไม่พบคลินิกนี้แล้ว กรุณาเปลี่ยนคลินิกของฟอร์ม
                    </span>
                  )}
                </h2>
                <div className={`fm-forms-container ${viewMode}`}>
                  {group.forms.map((form) => {
                    const currentStatus = form.status || "draft";
                    return (
                      <div
                        key={form.id}
                        className="fm-form-card"
                        onClick={() => navigate(`/admin/forms/edit/${form.id}`)}
                        style={{
                          zIndex:
                            openMenuId === form.id ? "var(--z-raised)" : 1,
                        }}
                      >
                        <div className="fm-card-image-box">
                          <div className="fm-card-pills">
                            {form.login_enforcement === "strict" && (
                              <span
                                className="fm-pill fm-pill--login"
                                title="ต้องเข้าสู่ระบบก่อนทำแบบประเมิน"
                              >
                                <FaLock aria-hidden="true" /> ต้องเข้าสู่ระบบ
                              </span>
                            )}
                            {form.login_enforcement === "optional" && (
                              <span
                                className="fm-pill fm-pill--neutral"
                                title="แนะนำให้เข้าสู่ระบบ"
                              >
                                <FaLock aria-hidden="true" /> แนะนำเข้าสู่ระบบ
                              </span>
                            )}
                            <span
                              className={`fm-pill fm-pill--status is-${currentStatus === "published" ? "published" : "draft"}`}
                            >
                              {currentStatus === "published"
                                ? "เผยแพร่แล้ว"
                                : "ฉบับร่าง"}
                            </span>
                          </div>
                          {form.image ? (
                            <img
                              src={form.image}
                              alt=""
                              loading="lazy"
                              decoding="async"
                            />
                          ) : (
                            <div className="fm-img-placeholder" />
                          )}
                        </div>

                        <div className="fm-card-body">
                          <h3>{toDisplayText(form.title || "ชื่อฟอร์ม")}</h3>
                          <p className="fm-last-opened">
                            แก้ไขล่าสุด {form.lastOpenedDate || "วว/ดด/ปป"}
                          </p>
                          {profile.kind === "all" && (
                            <span
                              className="fm-organization-tag"
                              title={form.organization_code || undefined}
                            >
                              {toDisplayText(formAxisLabel(form))}
                            </span>
                          )}

                          <button
                            className="fm-card-menu-btn"
                            aria-label={`ตัวเลือกของ ${toDisplayText(form.title || "ฟอร์ม")}`}
                            onClick={(e) => handleToggleMenu(e, form.id)}
                          >
                            ⋮
                          </button>

                          {openMenuId === form.id && (
                            <div className="fm-dropdown-menu" ref={menuRef}>
                              <button
                                hidden={!formRights.assign}
                                onClick={(e) => handleToggleStatus(e, form)}
                              >
                                {currentStatus === "published" ? (
                                  <>
                                    <FaEyeSlash /> ซ่อนเป็นฉบับร่าง
                                  </>
                                ) : (
                                  <>
                                    <FaGlobe /> เปิดเผยแพร่
                                  </>
                                )}
                              </button>
                              <div className="fm-dropdown-divider"></div>
                              <button
                                hidden={!formRights.update}
                                onClick={(e) => handleOpenRenameModal(e, form)}
                              >
                                <FaEdit /> เปลี่ยนชื่อ
                              </button>
                              <button
                                hidden={!formRights.update}
                                onClick={(e) =>
                                  handleOpenImageModal(e, form.id)
                                }
                              >
                                <FaImage /> เปลี่ยนรูปปก
                              </button>
                              <button
                                hidden={!formRights.assign || !usesClinics}
                                onClick={(e) => handleOpenClinicModal(e, form)}
                              >
                                <FaClinicMedical /> เปลี่ยนคลินิก
                              </button>
                              <button
                                hidden={!formRights.create}
                                onClick={(e) => handleDuplicateForm(e, form)}
                              >
                                <FaCopy /> ทำสำเนา
                              </button>
                              <button
                                onClick={(e) => handleOpenNewTab(e, form.id)}
                              >
                                <FaExternalLinkAlt /> เปิดในแท็บใหม่
                              </button>
                              <div className="fm-dropdown-divider"></div>
                              <button
                                hidden={!formRights.delete}
                                className="fm-dropdown-danger"
                                onClick={(e) => handleDeleteForm(e, form.id)}
                              >
                                <FaTrashAlt /> ลบทิ้ง
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {formRights.create &&
                    groupIndex === formGroups.length - 1 && (
                      <div
                        className="fm-form-card fm-add-empty-card"
                        onClick={() => navigate("/admin/forms/create")}
                      >
                        <div className="fm-plus-icon">+</div>
                        <p>สร้างฟอร์มใหม่</p>
                      </div>
                    )}
                </div>
              </section>
            ))}
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/*"
          onChange={handleFileChange}
        />
      </main>

      {/* Modal ต่างๆ คงเดิม */}
      {isImageModalOpen && (
        <div className="fm-modal-overlay" role="presentation">
          <div
            className="fm-modal-content"
            style={{ maxWidth: "500px" }}
            role="dialog"
            aria-modal="true"
            aria-label="เปลี่ยนรูปแบบประเมิน"
          >
            <h3 style={{ marginBottom: "15px" }}>เปลี่ยนรูปภาพปก</h3>
            <div
              style={{
                width: "100%",
                height: "250px",
                borderRadius: "var(--suth-radius)",
                overflow: "hidden",
                marginBottom: "20px",
                border: previewImage ? "none" : "2px dashed var(--suth-control-line)",
                backgroundColor: "var(--suth-canvas)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Preview"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--suth-muted)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaFolderOpen size={32} color="var(--suth-control-line)" />
                  <p>ยังไม่ได้เลือกรูปภาพ</p>
                </div>
              )}
            </div>
            <div
              className="fm-modal-actions"
              style={{ justifyContent: "space-between" }}
            >
              <button
                className="fm-btn-cancel"
                style={{
                  backgroundColor: "var(--suth-tint)",
                  color: "var(--suth-action-ink)",
                  border: "none",
                  fontWeight: "bold",
                }}
                onClick={() => fileInputRef.current.click()}
              >
                {previewImage ? "เปลี่ยนรูปอื่น" : "+ เลือกรูปภาพ"}
              </button>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="fm-btn-cancel"
                  onClick={() => {
                    setIsImageModalOpen(false);
                    setPreviewImage(null);
                    setSelectedFormForImage(null);
                  }}
                >
                  ยกเลิก
                </button>
                <button
                  className="fm-btn-save"
                  onClick={handleConfirmImageUpload}
                  disabled={!previewImage}
                  style={{
                    opacity: !previewImage ? 0.5 : 1,
                    cursor: !previewImage ? "not-allowed" : "pointer",
                  }}
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isRenameModalOpen && (
        <div className="fm-modal-overlay" role="presentation">
          <div
            className="fm-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="เปลี่ยนชื่อแบบประเมิน"
          >
            <h3>เปลี่ยนชื่อฟอร์ม</h3>
            <input
              type="text"
              className="fm-modal-input"
              value={renamingForm.title}
              onChange={(e) =>
                setRenamingForm({ ...renamingForm, title: e.target.value })
              }
              autoFocus
            />
            <div className="fm-modal-actions">
              <button
                className="fm-btn-cancel"
                onClick={() => setIsRenameModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button className="fm-btn-save" onClick={handleSaveRename}>
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {isClinicModalOpen && (
        <div className="fm-modal-overlay" role="presentation">
          <div
            className="fm-modal-content"
            role="dialog"
            aria-modal="true"
            aria-label="เปลี่ยนคลินิกของแบบประเมิน"
          >
            <h3>เปลี่ยนประเภทคลินิก</h3>
            <SearchableSelect
              className="fm-modal-input"
              style={{
                padding: "10px",
                borderRadius: "var(--suth-radius)",
                border: "1px solid var(--suth-control-line)",
                fontSize: "var(--suth-fs-body)",
                width: "100%",
                marginTop: "10px",
                boxSizing: "border-box",
              }}
              value={editingClinicForm.clinic_type}
              onChange={(e) =>
                setEditingClinicForm({
                  ...editingClinicForm,
                  clinic_type: e.target.value,
                })
              }
            >
              <option value="general">ทั่วไป (ใช้ร่วมกัน)</option>
              {clinics.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </SearchableSelect>
            <div className="fm-modal-actions" style={{ marginTop: "20px" }}>
              <button
                className="fm-btn-cancel"
                onClick={() => setIsClinicModalOpen(false)}
              >
                ยกเลิก
              </button>
              <button className="fm-btn-save" onClick={handleSaveClinic}>
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fm-toast-notification">{toastMessage}</div>
      )}
    </div>
  );
};

export default FormManager;
