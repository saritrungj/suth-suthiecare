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
  faFileImport,
  faFolderOpen,
  faGaugeHigh,
  faImage,
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
    href: "/admin/school/import",
    icon: <FontAwesomeIcon icon={faFileImport} fixedWidth />,
    label: "นำเข้าข้อมูล",
    key: "school-import",
    orgTypes: ["school"],
    schoolCheck: (access) =>
      access?.can_create_students || access?.staff_actions?.create,
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
    href: "/admin/users",
    hideForSystemAdmin: true,
    icon: <FontAwesomeIcon icon={faUserShield} fixedWidth />,
    label: "บุคลากรและผู้ปกครอง",
    key: "school-staff-access",
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
    href: "/admin/result-images",
    icon: <FontAwesomeIcon icon={faImage} fixedWidth />,
    label: "ภาพผลลัพธ์การประเมิน",
    key: "result-images",
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
    // Patient accounts belong to hospital services; schools work with students.
    orgTypes: ["hospital"],
    // System admins manage every patient account from the system section.
    hideForSystemAdmin: true,
  },
  {
    href: "/admin/help-center",
    icon: <FontAwesomeIcon icon={faQuestionCircle} fixedWidth />,
    label: "จัดการศูนย์ช่วยเหลือ",
    key: "help-center",
    module: "Help Center Management",
    // FAQ categories belong to clinics, which only hospital units have.
    orgTypes: ["hospital"],
  },
  {
    href: "/admin/master-data",
    icon: <FontAwesomeIcon icon={faTags} fixedWidth />,
    label: "จัดการข้อมูลหลัก",
    key: "master-data",
    module: "master_data.view",
  },

  // 🛡️ ผู้ดูแลระบบ: ตั้งค่าทั้งระบบ ไม่ขึ้นกับหน่วยงานที่เลือก
  {
    type: "header",
    label: "จัดการหลักของระบบ",
    hint: "",
    key: "header-system",
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
    href: "/admin/members",
    icon: <FontAwesomeIcon icon={faUsers} fixedWidth />,
    label: "ผู้มารับบริการ",
    key: "system-patient-members",
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
    if (typeof window !== "undefined" && window.innerWidth > 768) {
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
    const desktop = window.matchMedia("(min-width: 769px)");
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
    if (window.innerWidth > 768) {
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
      if (menuRef.current && window.innerWidth > 768) {
        sessionStorage.setItem("sidebarScrollPos", menuRef.current.scrollTop);
      }
    };

    const menuEl = menuRef.current;
    if (menuEl) {
      if (window.innerWidth > 768) {
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
      confirmButtonColor: "var(--suth-risk-dot-high)",
      cancelButtonColor: "var(--suth-control-line)",
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
              color="var(--suth-action-ink)"
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
