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
import { getActiveOrganizationLabel } from "../../../permissions/organizationContext";

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
      className="fm-custom-select"
      ref={ref}
      style={{ ...style, zIndex: isOpen ? 999 : 1 }}
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
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FormManager = () => {
  const { activeOrganization, authorization } = usePermissions();
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
  const activeOrganizationLabel = getActiveOrganizationLabel(
    authorization,
    activeOrganization,
  );
  const clinicColors = [
    "#e0f2fe",
    "#dcfce7",
    "#fce7f3",
    "#fef3c7",
    "#e0e7ff",
    "#f3e8ff",
  ];
  const clinicTextColors = [
    "#0284c7",
    "#166534",
    "#be185d",
    "#d97706",
    "#4338ca",
    "#7e22ce",
  ];

  const getClinicLabel = (slug) => {
    if (slug === "general")
      return { text: "ทั่วไป", bg: "#f1f5f9", color: "#475569" };
    const clinic = clinics.find((c) => c.slug === slug);
    if (!clinic)
      return { text: slug, bg: "#f1f5f9", color: "#475569", isDeleted: true };

    const index = clinics.findIndex((c) => c.slug === slug);
    const colorIndex = index % clinicColors.length;

    return {
      text: clinic.name,
      bg: clinicColors[colorIndex],
      color: clinicTextColors[colorIndex],
    };
  };

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
    const matchClinic =
      clinicFilter === "all" || (f.clinic_type || "general") === clinicFilter;
    const currentStatus = f.status || "draft";
    const matchStatus =
      statusFilter === "all" || currentStatus === statusFilter;
    return matchSearch && matchClinic && matchStatus;
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
      showToast(<span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaTimesCircle /> ไม่สามารถอัปโหลดภาพได้ กรุณาลองใหม่อีกครั้ง</span>);
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
        showToast(<span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaTimesCircle /> ไม่สามารถลบฟอร์มได้ กรุณาลองใหม่อีกครั้ง</span>);
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
      showToast(<span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaTimesCircle /> ไม่สามารถเปลี่ยนชื่อได้ กรุณาลองใหม่อีกครั้ง</span>);
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
      showToast(<span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaTimesCircle /> ไม่สามารถเปลี่ยนประเภทคลินิกได้ กรุณาลองใหม่อีกครั้ง</span>);
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
          <FaCopy /> ทำสำเนา "{form.title}" เรียบร้อยแล้ว
        </span>,
      );
    } catch (error) {
      showToast(<span style={{ display: "flex", alignItems: "center", gap: "8px" }}><FaTimesCircle /> ไม่สามารถทำสำเนาฟอร์มได้ กรุณาลองใหม่อีกครั้ง</span>);
    }
  };

  return (
    <div className="fm-admin-layout">
      <main className="fm-main-content">
        <header className="fm-content-header">
          <div className="fm-header-info">
            <h2>จัดการฟอร์ม</h2>
            <p className="fm-header-hint">
              สร้าง แก้ไข และจัดการสถานะของแบบประเมินในแต่ละคลินิกบริการ
            </p>
            <p className="fm-context-indicator"><span>ขอบเขตข้อมูล</span>{activeOrganizationLabel}</p>
          </div>
          <button
            className="fm-btn-add-form"
            onClick={() => navigate("/admin/forms/create")}
          >
            + สร้างฟอร์ม
          </button>
        </header>

        <div className="fm-action-bar">
            {/* 🟢 ช่องค้นหาดีไซน์ใหม่ */}
            <div className="fm-search-group">
              <FaSearch
                className="fm-filter-icon"
                style={{ color: "#64748b" }}
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
              <CustomDropdown
                icon={FaFilter}
                value={clinicFilter}
                onChange={setClinicFilter}
                options={[
                  { value: "all", label: `ทุกคลินิก (${forms.length})` },
                  { value: "general", label: "ทั่วไป" },
                  ...clinics.map((c) => ({ value: c.slug, label: c.name })),
                ]}
              />

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

              {/* สลับมุมมอง */}
              <div className="fm-view-toggle">
                <span className="fm-toggle-label">
                  {viewMode === "grid" ? "แบบตาราง" : "แบบรายการ"}
                </span>

                <label className="fm-switch">
                  <input
                    type="checkbox"
                    checked={viewMode === "grid"}
                    onChange={() =>
                      setViewMode(viewMode === "grid" ? "list" : "grid")
                    }
                  />
                  <span className="fm-slider fm-round"></span>
                </label>
              </div>

            </div>
        </div>

        {isLoading ? (
          <div className="fm-loading-state">
            <div className="fm-loading-spinner"></div>
            <p>กำลังโหลดฟอร์ม...</p>
          </div>
        ) : (
          <section className={`fm-forms-container ${viewMode}`}>
            {filteredForms.map((form) => {
              const currentStatus = form.status || "draft";
              const clinicType = form.clinic_type || "general";
              const clinicInfo = getClinicLabel(clinicType);

              return (
                <div
                  key={form.id}
                  className="fm-form-card"
                  onClick={() => navigate(`/admin/forms/edit/${form.id}`)}
                  style={{ zIndex: openMenuId === form.id ? 50 : 1 }}
                >
                  <div
                    className="fm-card-image-box"
                    style={{ position: "relative" }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        left: "10px",
                        background: clinicInfo.bg,
                        color: clinicInfo.color,
                        padding: "4px 10px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        zIndex: 2,
                        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {clinicInfo.text}
                      {clinicInfo.isDeleted && (
                        <div
                          title="คลินิกของฟอร์มนี้เกิดปัญหาหรือถูกลบออก กรุณาเลือกใหม่อีกครั้ง"
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "help",
                          }}
                        >
                          {/* สีพื้นหลังดำสำหรับตัวเครื่องหมายตกใจตรงกลาง */}
                          <div
                            style={{
                              position: "absolute",
                              backgroundColor: "#000",
                              width: "4px",
                              height: "8px",
                              top: "4px",
                              zIndex: 0,
                            }}
                          ></div>
                          <FaExclamationTriangle
                            style={{
                              color: "#fbbf24",
                              fontSize: "14px",
                              position: "relative",
                              zIndex: 1,
                            }}
                          />
                        </div>
                      )}
                    </div>
                    {/* ป้ายกำกับสถานะ */}
                    <div
                      style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        zIndex: 2,
                      }}
                    >
                      {form.login_enforcement === "strict" && (
                        <div
                          title="ต้องเข้าสู่ระบบก่อนทำแบบประเมิน"
                          style={{
                            background: "#fef3c7",
                            color: "#92400e",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FaLock /> ต้องเข้าสู่ระบบ
                        </div>
                      )}
                      {form.login_enforcement === "optional" && (
                        <div
                          title="แนะนำให้เข้าสู่ระบบ"
                          style={{
                            background: "#dcfce7",
                            color: "#166534",
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "bold",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FaLock /> แนะนำเข้าสู่ระบบ
                        </div>
                      )}
                      <div
                        style={{
                          background:
                            currentStatus === "published" ? "#dcfce7" : "#fff3e0",
                          color:
                            currentStatus === "published" ? "#166534" : "#e65100",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontSize: "11px",
                          fontWeight: "bold",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {currentStatus === "published" ? (
                          <>
                            <FaCheckCircle /> เผยแพร่แล้ว
                          </>
                        ) : (
                          <>
                            <FaFileAlt /> ฉบับร่าง
                          </>
                        )}
                      </div>
                    </div>
                    {form.image ? (
                      <img
                        src={form.image}
                        alt="Form Cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="fm-img-placeholder" />
                    )}
                  </div>

                  <div className="fm-card-body">
                    <h3>{form.title || "ชื่อฟอร์ม"}</h3>
                    <p className="fm-last-opened">
                      แก้ไขล่าสุด {form.lastOpenedDate || "วว/ดด/ปป"}
                    </p>
                    <span className="fm-organization-tag" title={form.organization_code || "ยังไม่ระบุหน่วยงาน"}>
                      {form.organization_name || "โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี"}
                    </span>

                    <button
                      className="fm-card-menu-btn"
                      onClick={(e) => handleToggleMenu(e, form.id)}
                    >
                      ⋮
                    </button>

                    {openMenuId === form.id && (
                      <div className="fm-dropdown-menu" ref={menuRef}>
                        <button
                          onClick={(e) => handleToggleStatus(e, form)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
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
                          onClick={(e) => handleOpenRenameModal(e, form)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FaEdit /> เปลี่ยนชื่อ
                        </button>
                        <button
                          onClick={(e) => handleOpenImageModal(e, form.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FaImage /> เปลี่ยนรูปปก
                        </button>
                        <button
                          onClick={(e) => handleOpenClinicModal(e, form)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FaClinicMedical /> เปลี่ยนคลินิก
                        </button>
                        <button
                          onClick={(e) => handleDuplicateForm(e, form)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FaCopy /> ทำสำเนา
                        </button>
                        <button
                          onClick={(e) => handleOpenNewTab(e, form.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FaExternalLinkAlt /> เปิดในแท็บใหม่
                        </button>
                        <div className="fm-dropdown-divider"></div>
                        <button
                          className="fm-dropdown-danger"
                          onClick={(e) => handleDeleteForm(e, form.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <FaTrashAlt /> ลบทิ้ง
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <div
              className="fm-form-card fm-add-empty-card"
              onClick={() => navigate("/admin/forms/create")}
            >
              <div className="fm-plus-icon">+</div>
              <p>สร้างฟอร์มใหม่</p>
            </div>
          </section>
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
        <div className="fm-modal-overlay">
          <div className="fm-modal-content" style={{ maxWidth: "500px" }}>
            <h3 style={{ marginBottom: "15px" }}>เปลี่ยนรูปภาพปก</h3>
            <div
              style={{
                width: "100%",
                height: "250px",
                borderRadius: "8px",
                overflow: "hidden",
                marginBottom: "20px",
                border: previewImage ? "none" : "2px dashed #ccc",
                backgroundColor: "#f8f9fa",
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
                    color: "#666",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <FaFolderOpen size={32} color="#a0aec0" />
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
                  backgroundColor: "#e8f0fe",
                  color: "#1a73e8",
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
        <div className="fm-modal-overlay">
          <div className="fm-modal-content">
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
        <div className="fm-modal-overlay">
          <div className="fm-modal-content">
            <h3>เปลี่ยนประเภทคลินิก</h3>
            <select
              className="fm-modal-input"
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #ccc",
                fontSize: "15px",
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
            </select>
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
