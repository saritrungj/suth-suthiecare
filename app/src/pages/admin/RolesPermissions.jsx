import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import CreateRoleModal from "../../components/CreateRoleModal";
import "./RolesPermissions.css";
import {
  FiChevronDown,
  FiChevronRight,
  FiCheckCircle,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import {
  getRoles,
  getRolePermissions,
  saveRolePermissions,
  createRole,
  deleteRole,
} from "../../services/api";

export default function RolesPermissions() {
  const navigate = useNavigate();

  const modules = [
    "Dashboard",
    "Case Management",
    "Form Management",
    "Appointments",
    "User Management",
    "Roles & Permissions",
  ];
  const moduleLabels = {
    Dashboard: "แดชบอร์ด",
    "Case Management": "จัดการเคส",
    "Form Management": "จัดการฟอร์ม",
    Appointments: "ตารางนัดหมาย",
    "User Management": "จัดการผู้ใช้",
    "Roles & Permissions": "บทบาทและสิทธิ์",
  };
  const permissionTypes = [
    "ดูข้อมูล",
    "จัดการ/แก้ไข",
    "ควบคุมทั้งหมด",
    "ดูรหัสผ่าน",
  ];

  const [expandedModules, setExpandedModules] = useState(
    modules.reduce((acc, curr) => ({ ...acc, [curr]: true }), {}),
  );
  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [search, setSearch] = useState("");

  const currentUserStr =
    sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const currentRoleId = currentUser ? Number(currentUser.role_id) : 3;

  // 3. ป้องกันการเข้าถึงหน้า
  useEffect(() => {
    if (currentRoleId !== 1) {
      getRolePermissions(currentRoleId).then((res) => {
        const hasAccess = res.data.some(
          (p) =>
            p.module === "Roles & Permissions" &&
            (p.can_view || p.can_manage || p.can_full),
        );
        if (!hasAccess) {
          alert("คุณไม่มีสิทธิ์เข้าถึงหน้าจัดการบทบาท");
          navigate("/admin/dashboard", { replace: true });
        }
      });
    }
  }, [currentRoleId, navigate]);

  // 4. โหลดข้อมูล Roles และ Permissions
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await getRoles();
        setRoles(res.data);
        if (res.data.length > 0) setSelectedRole(res.data[0].id);
      } catch (err) {
        setRoles([]);
      }
    };
    fetchRoles();
  }, []);

  useEffect(() => {
    if (!selectedRole) return;
    setPermissions({});
    const fetchPermissions = async () => {
      try {
        const res = await getRolePermissions(selectedRole);
        const formatted = {};
        res.data.forEach((p) => {
          formatted[p.module] = {
            ดูข้อมูล: !!p.can_view,
            "จัดการ/แก้ไข": !!p.can_manage,
            ควบคุมทั้งหมด: !!p.can_full,
            ดูรหัสผ่าน: !!p.can_view_password,
          };
        });
        setPermissions(formatted);
      } catch (err) {
        setPermissions({});
      }
    };
    fetchPermissions();
  }, [selectedRole]);

  // 5. Toggle Permission (ล็อก SuperAdmin)
  const togglePermission = (module, type) => {
    if (selectedRole === 1) return;
    setPermissions((prev) => {
      const current = prev[module] || {};
      if (type === "ควบคุมทั้งหมด") {
        const value = !current["ควบคุมทั้งหมด"];
        return {
          ...prev,
          [module]: {
            ดูข้อมูล: value,
            "จัดการ/แก้ไข": value,
            ควบคุมทั้งหมด: value,
            ดูรหัสผ่าน:
              module === "User Management" || module === "จัดการผู้ใช้"
                ? value
                : current["ดูรหัสผ่าน"],
          },
        };
      }
      const updated = { ...current, [type]: !current[type] };
      updated["ควบคุมทั้งหมด"] = updated["ดูข้อมูล"] && updated["จัดการ/แก้ไข"];
      return { ...prev, [module]: updated };
    });
  };

  const toggleModule = (moduleName) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleName]: !prev[moduleName],
    }));
  };

  const isSuperAdminSelected = selectedRole === 1;

  const filteredModules = modules.filter((m) => {
    const keyword = search.toLowerCase();
    return (
      moduleLabels[m].toLowerCase().includes(keyword) ||
      m.toLowerCase().includes(keyword)
    );
  });

  const handleCreateNewRole = async (roleData) => {
    try {
      const res = await createRole({
        name: roleData.name,
        description: roleData.description,
      });
      await saveRolePermissions(res.data.id, roleData.permissions);
      alert("สร้างบทบาทใหม่สำเร็จ!");
      setOpenCreateModal(false);
      window.location.reload();
    } catch (err) {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const handleDeleteRole = async (id, name) => {
    if (
      window.confirm(
        `⚠️ คุณแน่ใจหรือไม่ที่จะลบบทบาท "${name}"?\nการดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      )
    ) {
      try {
        await deleteRole(id);
        alert("ลบบทบาทสำเร็จ!");

        const updatedRoles = roles.filter((r) => r.id !== id);
        setRoles(updatedRoles);

        if (selectedRole === id) {
          setSelectedRole(updatedRoles.length > 0 ? updatedRoles[0].id : null);
        }
      } catch (err) {
        alert(
          "ไม่สามารถลบได้: บทบาทนี้อาจถูกใช้งานโดยผู้ใช้ในระบบ หรือเกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
        );
      }
    }
  };

  return (
    <div className="srp-admin-layout srp-roles-permissions-page">
      <main className="srp-main-content-area">
        <div className="srp-roles-header-section">
          <h1>บทบาทและสิทธิ์</h1>
          <button
            className="srp-create-btn"
            onClick={() => setOpenCreateModal(true)}
          >
            + เพิ่มบทบาท
          </button>
        </div>

        <div className="srp-roles-grid-layout">
          <div className="srp-card srp-role-card">
            <h3>รายการบทบาท</h3>
            {roles
              .filter((r) => (currentRoleId === 1 ? true : r.id !== 1))
              .map((role) => (
                <div
                  key={role.id}
                  className={`srp-role-item ${selectedRole === role.id ? "srp-active" : ""}`}
                  onClick={() => setSelectedRole(role.id)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    position: "relative",
                  }}
                >
                  <div className="srp-role-name">{role.name}</div>

                  {/* 🔴 แสดงปุ่มลบ ถ้าไม่ใช่บทบาท SuperAdmin (id: 1) และไม่ใช่ Role ตัวเองที่กำลังล็อกอิน */}
                  {role.id !== 1 && role.id !== currentRoleId && (
                    <FiTrash2
                      className="srp-delete-icon"
                      style={{
                        color: "#94a3b8",
                        cursor: "pointer",
                        transition: "color 0.2s",
                      }}
                      onMouseOver={(e) =>
                        (e.currentTarget.style.color = "#ef4444")
                      }
                      onMouseOut={(e) =>
                        (e.currentTarget.style.color = "#94a3b8")
                      }
                      onClick={(e) => {
                        e.stopPropagation(); // ป้องกันไม่ให้ไปเลือก Role เมื่อกดลบ
                        handleDeleteRole(role.id, role.name);
                      }}
                    />
                  )}
                </div>
              ))}
          </div>

          <div className="srp-card srp-permission-card">
            <h3>ตั้งค่าสิทธิ์การเข้าถึง</h3>
            <div className="srp-role-label">
              บทบาท: <b>{roles.find((r) => r.id === selectedRole)?.name}</b>
            </div>

            <div className="srp-search-wrapper">
              <FiSearch className="srp-search-icon" />
              <input
                className="srp-search-input"
                placeholder="ค้นหาสิทธิ์การเข้าถึง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isSuperAdminSelected}
              />
            </div>

            {filteredModules.map((module) => {
              const isExpanded = expandedModules[module];
              return (
                <div
                  key={module}
                  className={`srp-module-block ${isExpanded ? "expanded" : ""} ${isSuperAdminSelected ? "srp-locked" : ""}`}
                >
                  <div
                    className="srp-module-title"
                    onClick={() => toggleModule(module)}
                  >
                    <span className="srp-arrow-icon">
                      {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                    </span>
                    {moduleLabels[module]}
                  </div>

                  {isExpanded && (
                    <div className="srp-permission-row-container">
                      <div className="srp-permission-row">
                        {permissionTypes.map((type) => {
                          if (
                            type === "ดูรหัสผ่าน" &&
                            module !== "User Management"
                          )
                            return null;
                          const isChecked = isSuperAdminSelected
                            ? true
                            : permissions[module]?.[type] || false;
                          return (
                            <label
                              key={type}
                              className={`srp-checkbox-label ${isChecked ? "active" : ""} ${isSuperAdminSelected ? "readonly" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isSuperAdminSelected}
                                onChange={() => togglePermission(module, type)}
                              />
                              <span className="srp-custom-checkbox">
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

            <div className="srp-action-buttons">
              <button
                className="srp-btn-cancel"
                disabled={isSuperAdminSelected}
              >
                ยกเลิก
              </button>
              <button
                className="srp-btn-save"
                disabled={isSuperAdminSelected}
                onClick={async () => {
                  try {
                    await saveRolePermissions(selectedRole, permissions);
                    alert("บันทึกสำเร็จ");
                  } catch (err) {
                    alert("เกิดข้อผิดพลาด");
                  }
                }}
              >
                บันทึก
              </button>
            </div>
          </div>

          <div className="srp-card srp-summary-card">
            <h3>สรุปสิทธิ์</h3>
            <ul className="srp-summary-list">
              {modules.map((module) => {
                const p = permissions[module] || {};
                // เช็คว่าโมดูลนี้มีสิทธิ์ใดสิทธิ์หนึ่งถูกเลือกหรือไม่
                const hasAny =
                  isSuperAdminSelected ||
                  p["ดูข้อมูล"] ||
                  p["จัดการ/แก้ไข"] ||
                  p["ควบคุมทั้งหมด"];

                return (
                  <li key={module} className="srp-summary-module">
                    {/* 🟢 ชื่อโมดูล: ถ้ามีสิทธิ์จะเป็นสีเขียวและมี ✓ นำหน้า */}
                    <div
                      className={`srp-summary-module-name ${hasAny ? "srp-text-active" : ""}`}
                    >
                      {hasAny ? "✓ " : "• "} {moduleLabels[module]}
                    </div>

                    <div className="srp-summary-permissions">
                      {permissionTypes.map((type) => {
                        if (
                          type === "ดูรหัสผ่าน" &&
                          module !== "User Management"
                        )
                          return null;
                        const isChecked = isSuperAdminSelected ? true : p[type];

                        return (
                          <div
                            key={type}
                            className={
                              isChecked
                                ? "srp-perm srp-enabled"
                                : "srp-perm srp-disabled"
                            }
                          >
                            {isChecked ? "✔ " : "✖ "} {type}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {openCreateModal && (
          <CreateRoleModal
            onClose={() => setOpenCreateModal(false)}
            onSave={handleCreateNewRole}
            modules={modules}
            permissionTypes={permissionTypes}
          />
        )}
      </main>
    </div>
  );
}
