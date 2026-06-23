import React, { useState, useEffect, useRef } from 'react';
import './Sidebar.css';
import logo from "../assets/logoSUTH.png";
import { NavLink, useNavigate, useLocation , Link } from 'react-router-dom';
import { FiChevronLeft, FiChevronDown, FiLogOut, FiCircle, FiX, FiBook } from "react-icons/fi";
import { getRolePermissions } from "../services/api";
import { FaHospital, FaQuestionCircle } from 'react-icons/fa';

// 🟢 Import SweetAlert2
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const RiskIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12" y2="17" />
  </svg>
);

const FormIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ContentIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

const ClinicIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M3 7v14" />
    <path d="M21 7v14" />
    <path d="M9 21V11h6v10" />
    <path d="M2 14h20" />
    <path d="M10 3h4v4h-4z" />
  </svg>
);

const rawMenuItems = [
  // 🟢 หน้าหลัก
  { type: 'header', label: 'หน้าหลัก', key: 'header-overview' },
  { href: '/admin/dashboard', icon: <DashboardIcon />, label: 'แดชบอร์ด', key: 'dashboard' },

  // 🔵 หมวดทั่วไป
  { type: 'header', label: 'ทั่วไป', key: 'header-management' },
  { href: '/admin/cases', icon: <CaseIcon />, label: 'ข้อมูลเคส', key: 'cases' },
  { href: '/admin/risk-cases', icon: <RiskIcon />, label: 'เคสเสี่ยง', key: 'risk-cases' },
  { href: '/admin/schedule', icon: <CalendarIcon />, label: 'ตารางนัดหมาย', key: 'schedule' },

  // 🟠 หมวดจัดการระบบ
  { type: 'header', label: 'การจัดการ', key: 'header-setup' },
  { href: '/admin/forms', icon: <FormIcon />, label: 'จัดการฟอร์ม', key: 'forms' },
  { href: '/admin/clinics', icon: <ClinicIcon />, label: 'จัดการคลินิก', key: 'clinics' },
  { 
    href: '/admin/help-center', 
    icon: <FaQuestionCircle size={22} />, 
    label: 'จัดการศูนย์ช่วยเหลือ', 
    key: 'help-center' 
  },
  { href: '/admin/banner', icon: <ContentIcon />, label: 'จัดการภาพแบนเนอร์', key: 'banner' },
  // 🟢 เพิ่มคู่มือการใช้งานตรงนี้ พร้อมกำหนด isExternal เป็น true
  { href: `${process.env.PUBLIC_URL}/docs/admin_manual.pdf`, icon: <FiBook size={22} />, label: 'คู่มือการใช้งาน', key: 'manual', isExternal: true },
  {
    href: '/admin/users',
    icon: <UsersIcon />,
    label: 'จัดการผู้ใช้งาน',
    key: 'users',
    children: [
      { href: '/admin/users', icon: <FiCircle size={8} />, label: 'ผู้ใช้งานทั้งหมด', key: 'users-list' },
      { href: '/admin/roles', icon: <FiCircle size={8} />, label: 'บทบาทและสิทธิ์', key: 'roles' },
    ]
  },
];

const Sidebar = ({ activeKey = 'dashboard' }) => {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem("sidebarCollapsed");
    return saved === "true";
  });
  const navigate = useNavigate();
  const location = useLocation();

  const [openMenu, setOpenMenu] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 768) {
      const parentMenu = rawMenuItems.find(item =>
        item.children?.some(child => location.pathname.startsWith(child.href))
      );
      if (parentMenu) {
        sessionStorage.setItem('sidebarOpenMenu', parentMenu.key);
        return parentMenu.key;
      }
      return sessionStorage.getItem('sidebarOpenMenu') || null;
    }
    return null;
  });

  const [manualActive, setManualActive] = useState(null);

  const menuRef = useRef(null);

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const currentUserStr = sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const currentRoleId = currentUser ? Number(currentUser.role_id) : 3;

  const [allowedRolesPage, setAllowedRolesPage] = useState(currentRoleId === 1);

  useEffect(() => {
    if (currentRoleId !== 1) {
      getRolePermissions(currentRoleId).then(res => {
        const hasAccess = res.data.some(p =>
          p.module === "Roles & Permissions" && (p.can_view || p.can_manage || p.can_full)
        );
        setAllowedRolesPage(hasAccess);
      }).catch(() => {});
    }
  }, [currentRoleId]);

  const menuItems = rawMenuItems.map(item => {
    if (item.children) {
      const filteredChildren = item.children.filter(child => {
        if (child.key === 'roles' && !allowedRolesPage) return false;
        return true;
      });
      if (filteredChildren.length === 0) return null;
      return { ...item, children: filteredChildren };
    }
    return item;
  }).filter(Boolean);

  useEffect(() => {
    if (window.innerWidth > 768) {
      const parentMenu = rawMenuItems.find(item =>
        item.children?.some(child => location.pathname.startsWith(child.href))
      );
      if (parentMenu) {
        setOpenMenu(parentMenu.key);
        sessionStorage.setItem('sidebarOpenMenu', parentMenu.key);
      }
    } else {
      setOpenMenu(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (window.innerWidth <= 768 && menuRef.current) {
      setTimeout(() => {
        const container = menuRef.current;
        const activeEl = container.querySelector('.active');

        if (activeEl) {
          const scrollLeftPos = activeEl.offsetLeft - (container.offsetWidth / 2) + (activeEl.offsetWidth / 2);

          container.scrollTo({
            left: scrollLeftPos,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [location.pathname, activeKey]);

  // 🟢 จำตำแหน่งการ Scroll (แนวตั้ง) ของ Sidebar
  useEffect(() => {
    const handleScroll = () => {
      if (menuRef.current && window.innerWidth > 768) {
        sessionStorage.setItem('sidebarScrollPos', menuRef.current.scrollTop);
      }
    };

    const menuEl = menuRef.current;
    if (menuEl) {
      if (window.innerWidth > 768) {
        const savedPos = sessionStorage.getItem('sidebarScrollPos');
        if (savedPos !== null) {
          setTimeout(() => {
            if (menuRef.current) {
              menuRef.current.scrollTop = parseInt(savedPos, 10);
            }
          }, 10);
        }
      }
      menuEl.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (menuEl) {
        menuEl.removeEventListener('scroll', handleScroll);
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
        popup: 'suth-swal-popup',
      }
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem("suth_user");
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
          onClick={() => setIsMobileOpen(true)}
          aria-label="Open Menu"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e36414" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        <img src={logo} alt="SUTH Logo" className="mobile-header-logo" />
      </div>

      {/* 🟢 พื้นหลังสีดำเบลอเวลาเปิด Sidebar บนมือถือ */}
      <div 
        className={`mobile-drawer-overlay ${isMobileOpen ? 'show' : ''}`} 
        onClick={() => setIsMobileOpen(false)}
      ></div>

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
      <button 
          className="mobile-close-btn" 
          onClick={() => setIsMobileOpen(false)}
          aria-label="Close Menu"
        >
          <FiX size={26} /> 
        </button>

        <div className="top">
          <div className="logo">
            <img src={logo} alt="SUTH Logo" className="logo-img" />
          </div>
          <button
            className="toggle-btn"
            onClick={() => {
              setCollapsed(prev => {
                const newState = !prev;
                localStorage.setItem("sidebarCollapsed", newState);
                return newState;
              });
            }}
            aria-label="Toggle sidebar"
          >
            <FiChevronLeft size={22} color="#c94e07" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
          </button>
        </div>

        <nav className="menu" ref={menuRef}>
          {menuItems.map((item, index) => {
            if (item.type === 'header') {
              return (
                <div key={item.key} className="menu-header-label">
                  {item.label} 
                </div>
              );
            }
            if (item.children) {
              const isOpen = openMenu === item.key;
              const activeChild = item.children.find(child => location.pathname === child.href);
              const isParentActive = isOpen || activeChild;

              return (
                <div key={item.key} className={`menu-group ${isOpen ? 'is-open' : ''}`}>
                  <button
                    className={`menu-item ${isParentActive ? 'active' : ''}`}
                    onClick={() => {
                      const newOpen = isOpen ? null : item.key;
                      setOpenMenu(newOpen);
                      setManualActive(item.key);
                      if (newOpen) {
                        sessionStorage.setItem('sidebarOpenMenu', newOpen);
                      } else {
                        sessionStorage.removeItem('sidebarOpenMenu');
                      }
                    }}
                  >
                    <span className="icon">{item.icon}</span>
                    <span className="label">{item.label}</span>
                    <span className="arrow">
                      {isOpen ? <FiChevronDown /> : <FiChevronLeft />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="submenu">
                      {item.children.map(child => (
                        <NavLink
                          key={child.key}
                          to={child.href}
                          className={({ isActive }) => `submenu-item ${isActive ? 'active' : ''}`}
                          onClick={() => {
                            if (window.innerWidth <= 1024) setIsMobileOpen(false);
                          }}
                        >
                          {child.icon && <span className="sub-icon">{child.icon}</span>}
                          {child.label}
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
                  <span className="label">{item.label}</span>
                </a>
              );
            }

            return (
              <NavLink
                key={item.key}
                to={item.href}
                className={({ isActive }) => `menu-item ${manualActive ? (manualActive === item.key ? 'active' : '') : (isActive ? 'active' : '')}`}
                onClick={() => {
                  setManualActive(null);
                  if (window.innerWidth <= 1024) setIsMobileOpen(false); // ปิดเมนูอัตโนมัติ
                }}
              >
                <span className="icon">{item.icon}</span>
                <span className="label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="menu-item logout-btn" onClick={handleLogout} data-label="ออกจากระบบ">
            <span className="icon"><FiLogOut /></span>
            <span className="label">ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;