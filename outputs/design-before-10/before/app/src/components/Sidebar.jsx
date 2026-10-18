import SearchableSelect from "./SearchableSelect";
import { toDisplayText } from "../utils/textPresentation.js";
import React, { useState, useEffect, useRef } from "react";
import "./Sidebar.css";
import logo from "../assets/logoSUTH.png";
import { NavLink, useNavigate, useLocation, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faArrowRightArrowLeft,
  faBars,
  faBookOpen,
  faBuilding,
  faCalendarDays,
  faChevronDown,
  faChevronLeft,
  faChalkboardUser,
  faFilePen,
  faFolderOpen,
  faGaugeHigh,
  faImages,
  faQuestionCircle,
  faSchool,
  faSitemap,
  faTags,
  faTriangleExclamation,
  faUserGraduate,
  faUserPen,
  faUserShield,
  faUsers,
  faUsersGear,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { usePermissions } from "../permissions/PermissionsProvider";
import { filterSidebarItems } from "../permissions/sidebarPolicy";
import {
  getSelectableOrganizations,
  groupOrganizationsByParent,
} from "../permissions/organizationContext";

// 🟢 Import SweetAlert2
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

const DashboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </svg>
);

const CaseIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RiskIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12" y2="17" />
  </svg>
);

const FormIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CalendarIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="14" x2="8" y2="14" />
    <line x1="12" y1="14" x2="12" y2="14" />
    <line x1="16" y1="14" x2="16" y2="14" />
    <line x1="8" y1="18" x2="8" y2="18" />
    <line x1="12" y1="18" x2="12" y2="18" />
    <line x1="16" y1="18" x2="16" y2="18" />
  </svg>
);

const UsersIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ContentIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const ClinicIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 21h18" />
    <path d="M3 7v14" />
    <path d="M21 7v14" />
    <path d="M9 21V11h6v10" />
    <path d="M2 14h20" />
    <path d="M10 3h4v4h-4z" />
  </svg>
);

const ORG_TYPE_LABELS = { hospital: "โรงพยาบาล", school: "โรงเรียน" };

const rawMenuItems = [
  // 🟢 หน้าหลัก
  { type: "header", label: "หน้าหลัก", key: "header-overview" },
  {
    href: "/admin/dashboard",
    icon: <FontAwesomeIcon icon={faGaugeHigh} fixedWidth />,
    label: "แดชบอร์ด",
    key: "dashboard",
    module: "Dashboard",
  },

  // 🔵 หมวดทั่วไป
  { type: "header", label: "ทั่วไป", key: "header-management" },
  {
    href: "/admin/cases",
    icon: <FontAwesomeIcon icon={faFolderOpen} fixedWidth />,
    label: "ข้อมูลเคส",
    key: "cases",
    module: "Case Management",
    // In a school organization the case list is the student health view.
    schoolCheck: (access) => access?.can_view_health,
  },
  {
    href: "/admin/risk-cases",
    icon: <FontAwesomeIcon icon={faTriangleExclamation} fixedWidth />,
    label: "เคสเสี่ยง",
    key: "risk-cases",
    module: "Case Management",
    schoolCheck: (access) => access?.can_view_health,
  },
  {
    href: "/admin/schedule",
    icon: <FontAwesomeIcon icon={faCalendarDays} fixedWidth />,
    label: "ตารางนัดหมาย",
    key: "schedule",
    module: "Appointments",
    orgTypes: ["hospital"],
  },
  {
    href: "/admin/referrals",
    icon: <FontAwesomeIcon icon={faArrowRightArrowLeft} fixedWidth />,
    label: "ส่งต่อระหว่างหน่วยงาน",
    key: "referrals",
    module: "Case Management",
  },

  // 🏫 หน่วยงานประเภทโรงเรียน
  {
    type: "header",
    label: "โรงเรียน",
    key: "header-school",
    orgTypes: ["school"],
  },
  {
    href: "/admin/school/students",
    icon: <FontAwesomeIcon icon={faUserGraduate} fixedWidth />,
    label: "นักเรียน",
    key: "school-students",
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_view_students,
  },
  {
    href: "/admin/school/teachers",
    icon: <FontAwesomeIcon icon={faChalkboardUser} fixedWidth />,
    label: "ครู",
    key: "school-teachers",
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_view_school,
  },
  {
    href: "/admin/school",
    icon: <FontAwesomeIcon icon={faSchool} fixedWidth />,
    label: "ชั้นปีและห้องเรียน",
    key: "school-structure",
    end: true,
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_view_school,
  },
  {
    href: "/admin/school/types",
    icon: <FontAwesomeIcon icon={faTags} fixedWidth />,
    label: "ประเภทครูและนักเรียน",
    key: "school-types",
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_view_school,
  },

  {
    href: "/admin/school/roles",
    icon: <FontAwesomeIcon icon={faUserShield} fixedWidth />,
    label: "บทบาทโรงเรียน",
    key: "school-roles",
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_manage_staff,
  },
  {
    href: "/admin/school/workflows",
    icon: <FontAwesomeIcon icon={faUserShield} fixedWidth />,
    label: "คัดกรองและติดตามโรงเรียน",
    key: "school-workflows",
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_view_school,
  },

  // 🟠 งานของหน่วยงานที่เลือกอยู่ (ข้อมูลแยกตามหน่วยงาน)
  { type: "header", label: "จัดการหน่วยงาน", key: "header-setup" },
  {
    href: "/admin/forms",
    icon: <FontAwesomeIcon icon={faFilePen} fixedWidth />,
    label: "จัดการฟอร์ม",
    key: "forms",
    module: "Form Management",
  },
  {
    href: "/admin/clinics",
    icon: <FontAwesomeIcon icon={faBuilding} fixedWidth />,
    label: "จัดการคลินิก",
    key: "clinics",
    module: "Clinic Management",
    orgTypes: ["hospital"],
  },
  {
    href: "/admin/members",
    icon: <FontAwesomeIcon icon={faUsers} fixedWidth />,
    label: "ผู้มารับบริการ",
    key: "patient-members",
    module: "User Management",
  },
  {
    href: "/admin/help-center",
    icon: <FontAwesomeIcon icon={faQuestionCircle} fixedWidth />,
    label: "จัดการศูนย์ช่วยเหลือ",
    key: "help-center",
    module: "Help Center Management",
  },

  // 🛡️ ผู้ดูแลระบบ: ตั้งค่าทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก
  {
    type: "header",
    label: "จัดการหลักของระบบ",
    hint: "",
    key: "header-system",
  },
  {
    href: "/admin/master-data",
    icon: <FontAwesomeIcon icon={faTags} fixedWidth />,
    label: "จัดการข้อมูลหลัก",
    key: "master-data",
    module: "master_data.view",
  },
  {
    href: "/admin/organizations",
    icon: <FontAwesomeIcon icon={faSitemap} fixedWidth />,
    label: "หน่วยงานหลักและหน่วยงานย่อย",
    key: "organizations",
    module: "organizations.manage",
    systemAdminOnly: true,
  },
  {
    href: "/admin/users",
    icon: <FontAwesomeIcon icon={faUserShield} fixedWidth />,
    label: "ผู้ดูแลระบบและเจ้าหน้าที่",
    key: "users",
    systemAdminOnly: true,
  },
  {
    href: "/admin/roles",
    icon: <FontAwesomeIcon icon={faUsersGear} fixedWidth />,
    label: "บทบาทและสิทธิ์",
    key: "roles",
    systemAdminOnly: true,
  },
  {
    href: "/admin/banner",
    icon: <FontAwesomeIcon icon={faImages} fixedWidth />,
    label: "จัดการภาพแบนเนอร์",
    key: "banner",
    module: "Content Management",
    systemAdminOnly: true,
  },

  // 🟣 บัญชีของฉัน (ทุกคนเข้าถึงได้ ไม่ต้องมีสิทธิ์)
  { type: "header", label: "บัญชีของฉัน", key: "header-account" },
  {
    href: "/admin/profile",
    icon: <FontAwesomeIcon icon={faUserPen} fixedWidth />,
    label: "ข้อมูลส่วนตัว",
    key: "profile",
  },
  {
    href: "/api/private-files/admin_manual.pdf",
    icon: <FontAwesomeIcon icon={faBookOpen} fixedWidth />,
    label: "คู่มือการใช้งาน",
    key: "manual",
    systemAdminOnly: true,
    isExternal: true,
  },
];

const Sidebar = ({ activeKey = "dashboard" }) => {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  const navigate = useNavigate();
  const location = useLocation();

  const [openMenu, setOpenMenu] = useState(() => {
    if (typeof window !== "undefined" && window.innerWidth > 1024) {
      const parentMenu = rawMenuItems.find((item) =>
        item.children?.some((child) =>
          location.pathname.startsWith(child.href),
        ),
      );
      if (parentMenu) {
        sessionStorage.setItem("sidebarOpenMenu", parentMenu.key);
        return parentMenu.key;
      }
      return sessionStorage.getItem("sidebarOpenMenu") || null;
    }
    return null;
  });

  const [manualActive, setManualActive] = useState(null);

  const menuRef = useRef(null);

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const sidebarRef = useRef(null);
  const menuButtonRef = useRef(null);

  // The mobile drawer owns focus and prevents interaction with the covered page.
  useEffect(() => {
    if (!isMobileOpen) return;
    const drawer = sidebarRef.current;
    const background = document.querySelectorAll(
      ".admin-shell-content, .mobile-header-bar",
    );
    const previousInert = [...background].map((element) => element.inert);
    background.forEach((element) => {
      element.inert = true;
    });
    drawer?.querySelector(".mobile-close-btn")?.focus({ preventScroll: true });
    const keyboard = (event) => {
      if (event.defaultPrevented || !drawer?.contains(event.target)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = [
        ...drawer.querySelectorAll(
          'a[href], button:not(:disabled), select:not(:disabled), [tabindex="0"]',
        ),
      ].filter(
        (element) =>
          element.getClientRects().length &&
          getComputedStyle(element).visibility !== "hidden",
      );
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1025px)");
    const resize = (event) => {
      if (event.matches) setIsMobileOpen(false);
    };
    desktop.addEventListener("change", resize);
    document.addEventListener("keydown", keyboard);
    return () => {
      background.forEach((element, index) => {
        element.inert = previousInert[index];
      });
      document.removeEventListener("keydown", keyboard);
      desktop.removeEventListener("change", resize);
      if (!desktop.matches)
        menuButtonRef.current?.focus({ preventScroll: true });
    };
  }, [isMobileOpen]);

  const {
    can,
    authorization,
    activeOrganization,
    activeOrganizationType,
    schoolAccess,
    setActiveOrganization,
  } = usePermissions();
  const selectableOrganizations = getSelectableOrganizations(authorization);

  const activeUnit = selectableOrganizations.find(
    (organization) => String(organization.id) === String(activeOrganization),
  );
  // const activeOrganizationDetail = activeUnit
  //   ? [
  //       `หน่วยงานย่อยประเภท${ORG_TYPE_LABELS[activeUnit.org_type] || "โรงพยาบาล"}`,
  //       activeUnit.parent_name ? `ภายใต้ ${activeUnit.parent_name}` : null,
  //     ]
  //       .filter(Boolean)
  //       .join(" · ")
  //   : activeOrganization === "all"
  //     ? "ดูข้อมูลรวมทุกหน่วยงาน"
  //     : "";
  // All roles follow the selected unit type; only "all" exposes every type.
  const organizationType = activeOrganizationType || "hospital";
  const menuItems = filterSidebarItems(rawMenuItems, {
    authorization,
    activeOrganization,
    organizationType,
    schoolAccess,
    can,
  });

  useEffect(() => {
    if (window.innerWidth > 1024) {
      const parentMenu = rawMenuItems.find((item) =>
        item.children?.some((child) =>
          location.pathname.startsWith(child.href),
        ),
      );
      if (parentMenu) {
        setOpenMenu(parentMenu.key);
        sessionStorage.setItem("sidebarOpenMenu", parentMenu.key);
      }
    } else {
      setOpenMenu(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isMobileOpen || !menuRef.current) return;
    const container = menuRef.current;
    const active = container.querySelector('[aria-current="page"]');
    if (active) {
      const item = active.getBoundingClientRect();
      const menu = container.getBoundingClientRect();
      if (item.bottom > menu.bottom)
        container.scrollTop += item.bottom - menu.bottom + 12;
      else if (item.top < menu.top)
        container.scrollTop -= menu.top - item.top + 12;
    }
  }, [location.pathname, isMobileOpen]);

  // 🟢 จำตำแหน่งการ Scroll (แนวตั้ง) ของ Sidebar
  useEffect(() => {
    const handleScroll = () => {
      if (menuRef.current && window.innerWidth > 1024) {
        sessionStorage.setItem("sidebarScrollPos", menuRef.current.scrollTop);
      }
    };

    const menuEl = menuRef.current;
    if (menuEl) {
      if (window.innerWidth > 1024) {
        const savedPos = sessionStorage.getItem("sidebarScrollPos");
        if (savedPos !== null) {
          setTimeout(() => {
            if (menuRef.current) {
              menuRef.current.scrollTop = parseInt(savedPos, 10);
            }
          }, 10);
        }
      }
      menuEl.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (menuEl) {
        menuEl.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const handleLogout = () => {
    MySwal.fire({
      title: "ยืนยันการออกจากระบบ",
      text: "คุณต้องการออกจากระบบใช่หรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      customClass: {
        popup: "suth-swal-popup",
      },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await (await import("../services/api")).staffLogoutApi();
        } catch {
          await MySwal.fire({
            icon: "error",
            title: "ออกจากระบบไม่สำเร็จ",
            text: "กรุณาลองอีกครั้งเพื่อยุติ Session บนเซิร์ฟเวอร์",
          });
          return;
        }
        (await import("../utils/authSession")).clearAuthSession("staff");
        localStorage.removeItem("suth_user");
        localStorage.removeItem("suth_token");
        sessionStorage.removeItem("suth_user");
        sessionStorage.removeItem("suth_token");
        localStorage.setItem("SUTH_LOGOUT", Date.now().toString());
        localStorage.removeItem("SUTH_LOGOUT");
        navigate("/login", { replace: true });
      }
    });
  };

  return (
    <>
      {/* 🟢 แถบ Header สีขาวด้านบนสุด (แสดงเฉพาะจอมือถือ) */}
      <div className="mobile-header-bar">
        <button
          className="mobile-hamburger-btn"
          ref={menuButtonRef}
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open Menu"
          aria-expanded={isMobileOpen}
          aria-controls="admin-navigation"
        >
          <FontAwesomeIcon icon={faBars} size="lg" />
        </button>
        <img src={logo} alt="SUTH Logo" className="mobile-header-logo" />
      </div>

      {/* 🟢 พื้นหลังสีดำเบลอเวลาเปิด Sidebar บนมือถือ */}
      <div
        className={`mobile-drawer-overlay ${isMobileOpen ? "show" : ""}`}
        onClick={() => setIsMobileOpen(false)}
      ></div>

      <aside
        id="admin-navigation"
        ref={sidebarRef}
        role={isMobileOpen ? "dialog" : undefined}
        aria-modal={isMobileOpen || undefined}
        aria-label="เมนูหลังบ้าน"
        className={`sidebar ${collapsed ? "collapsed" : ""} ${isMobileOpen ? "mobile-open" : ""}`}
      >
        <button
          className="mobile-close-btn"
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close Menu"
        >
          <FontAwesomeIcon icon={faXmark} size="lg" />
        </button>

        <div className="top">
          <div className="logo">
            <img src={logo} alt="SUTH Logo" className="logo-img" />
          </div>
          <button
            className="toggle-btn"
            onClick={() => {
              setCollapsed((prev) => {
                const newState = !prev;
                localStorage.setItem("sidebarCollapsed", newState);
                return newState;
              });
            }}
            aria-label="Toggle sidebar"
          >
            <FontAwesomeIcon
              icon={faChevronLeft}
              color="currentColor"
              style={{
                transform: collapsed ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
              }}
            />
          </button>
        </div>

        {!collapsed && authorization && (
          <div className="organization-switcher">
            <label htmlFor="active-organization">หน่วยงานที่กำลังใช้งาน</label>
            <SearchableSelect
              id="active-organization"
              value={activeOrganization || ""}
              onChange={(event) => setActiveOrganization(event.target.value)}
            >
              {authorization.is_system_admin === true && (
                <option value="all">ทุกหน่วยงาน</option>
              )}
              {groupOrganizationsByParent(selectableOrganizations).map(
                (group) => (
                  <optgroup
                    key={group.parentId || "ungrouped"}
                    label={group.parentName || "หน่วยงานอื่น"}
                  >
                    {group.organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name} (
                        {ORG_TYPE_LABELS[organization.org_type] || "โรงพยาบาล"})
                        {organization.roleName
                          ? ` · ${organization.roleName}`
                          : ""}
                      </option>
                    ))}
                  </optgroup>
                ),
              )}
            </SearchableSelect>
          </div>
        )}

        <nav className="menu" ref={menuRef}>
          {menuItems.map((item, index) => {
            if (item.type === "header") {
              return (
                <div
                  key={item.key}
                  className={`menu-header-label ${item.system ? "menu-header-label--system" : ""}`}
                  title={toDisplayText(item.hint)}
                >
                  {item.system && (
                    <FontAwesomeIcon icon={faUserShield} fixedWidth />
                  )}
                  {toDisplayText(item.label)}
                  {item.hint && (
                    <small className="menu-header-hint">
                      {toDisplayText(item.hint)}
                    </small>
                  )}
                </div>
              );
            }
            if (item.children) {
              const isOpen = openMenu === item.key;
              const activeChild = item.children.find(
                (child) => location.pathname === child.href,
              );
              const isParentActive = isOpen || activeChild;

              return (
                <div
                  key={item.key}
                  className={`menu-group ${isOpen ? "is-open" : ""}`}
                >
                  <button
                    className={`menu-item ${isParentActive ? "active" : ""}`}
                    onClick={() => {
                      const newOpen = isOpen ? null : item.key;
                      setOpenMenu(newOpen);
                      setManualActive(item.key);
                      if (newOpen) {
                        sessionStorage.setItem("sidebarOpenMenu", newOpen);
                      } else {
                        sessionStorage.removeItem("sidebarOpenMenu");
                      }
                    }}
                  >
                    <span className="icon">{item.icon}</span>
                    <span className="label">{toDisplayText(item.label)}</span>
                    <span className="arrow">
                      <FontAwesomeIcon
                        icon={isOpen ? faChevronDown : faChevronLeft}
                        fixedWidth
                      />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="submenu">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.key}
                          to={child.href}
                          className={({ isActive }) =>
                            `submenu-item ${isActive ? "active" : ""}`
                          }
                          onClick={() => {
                            if (window.innerWidth <= 1024)
                              setIsMobileOpen(false);
                          }}
                        >
                          {child.icon && (
                            <span className="sub-icon">{child.icon}</span>
                          )}
                          {toDisplayText(child.label)}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // 🟢 เงื่อนไขสำหรับปุ่มที่เป็นลิงก์ภายนอก (PDF คู่มือ)
            if (item.isExternal) {
              return (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="menu-item"
                  onClick={() => {
                    if (window.innerWidth <= 1024) setIsMobileOpen(false); // ปิดเมนูอัตโนมัติบนมือถือ
                  }}
                >
                  <span className="icon">{item.icon}</span>
                  <span className="label">{toDisplayText(item.label)}</span>
                </a>
              );
            }

            return (
              <NavLink
                key={item.key}
                to={item.href}
                end={item.end}
                className={({ isActive }) =>
                  `menu-item ${manualActive ? (manualActive === item.key ? "active" : "") : isActive ? "active" : ""}`
                }
                onClick={() => {
                  setManualActive(null);
                  if (window.innerWidth <= 1024) setIsMobileOpen(false); // ปิดเมนูอัตโนมัติ
                }}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{toDisplayText(item.label)}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="menu-item logout-btn"
            onClick={handleLogout}
            data-label="ออกจากระบบ"
          >
            <span className="icon">
              <FontAwesomeIcon icon={faArrowRightFromBracket} fixedWidth />
            </span>
            <span className="label">ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
