import React, { useState, useEffect, useRef } from "react";
// 🟢 เพิ่ม getRolePermissions เพื่อดึงสิทธิ์
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getRolePermissions,
} from "../../services/api";
import "./UserManagement.css";
import AddAdminModal from "../../components/AddAdminModal";
import {
  FiSearch,
  FiPlus,
  FiLayers,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { FaEdit, FaTrash } from "react-icons/fa";

import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

const MySwal = withReactContent(Swal);

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
      className="sum-custom-select"
      ref={ref}
      style={{ ...style, zIndex: isOpen ? 99 : 1 }}
      onClick={() => setIsOpen(!isOpen)}
    >
      <Icon className="sum-filter-icon" style={iconStyle} />
      <span className="sum-select-value" style={textStyle}>
        {displayLabel}
      </span>
      <FiChevronDown
        className={`sum-dropdown-icon ${isOpen ? "open" : ""}`}
        style={iconStyle}
      />

      {isOpen && (
        <div className="sum-select-menu">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`sum-select-option ${String(value) === String(opt.value) ? "selected" : ""}`}
              onClick={() => onChange(opt.value)}
            >
              {" "}
              {opt.label}{" "}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // 🟢 States สำหรับ Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // เพิ่ม State สำหรับจัดการจำนวนรายการต่อหน้า

  const [canViewPassword, setCanViewPassword] = useState(false);

  const currentUserStr =
    sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");
  const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
  const currentRoleId = currentUser ? Number(currentUser.role_id) : 3;

  const roleMap = { 1: "Super Admin", 2: "Admin", 3: "Staff" };

  useEffect(() => {
    fetchUsers();

    if (currentRoleId === 1) {
      setCanViewPassword(true);
    } else {
      getRolePermissions(currentRoleId)
        .then((res) => {
          const userMod = res.data.find(
            (p) => p.module === "จัดการผู้ใช้ (Users)",
          );
          if (userMod && userMod.can_view_password) {
            setCanViewPassword(true);
          }
        })
        .catch(() => {});
    }
  }, [currentRoleId]);

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (err) {
      setUsers([]);
    }
  };

  const handleSaveUser = async (data) => {
    try {
      if (editingUser) await updateUser(editingUser.id, data);
      else await createUser(data);

      setShowModal(false);
      setEditingUser(null);
      fetchUsers();

      MySwal.fire({
        title: "สำเร็จ!",
        text: "บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว",
        icon: "success",
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      MySwal.fire({
        title: "เกิดข้อผิดพลาด",
        text: err.response?.data?.message || "เกิดข้อผิดพลาดในการบันทึก",
        icon: "error",
        confirmButtonColor: "#ef4444",
      });
    }
  };

  const handleDelete = (id, name) => {
    MySwal.fire({
      title: "ยืนยันการลบ",
      html: `คุณต้องการลบผู้ใช้งาน <strong>${name}</strong> ออกจากระบบใช่หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ยืนยันการลบ",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteUser(id);
          fetchUsers();
          MySwal.fire({
            title: "ลบสำเร็จ!",
            text: "ข้อมูลผู้ใช้ถูกลบออกจากระบบแล้ว",
            icon: "success",
            timer: 2000,
            showConfirmButton: false,
          });
        } catch (err) {
          MySwal.fire({
            title: "ผิดพลาด!",
            text: "ไม่สามารถลบข้อมูลได้ในขณะนี้",
            icon: "error",
            confirmButtonColor: "#ef4444",
          });
        }
      }
    });
  };

  // 🟢 Filter Data
  const filteredUsers = users.filter((user) => {
    const matchSearch =
      (user.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (user.email || "").toLowerCase().includes(search.toLowerCase()) ||
      (user.username || "").toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter
      ? user.role_id.toString() === roleFilter
      : true;
    const matchStatus = statusFilter ? user.status === statusFilter : true;
    return matchSearch && matchRole && matchStatus;
  });

  // 🟢 รีเซ็ตหน้ากลับไป 1 เสมอ หากมีการค้นหาหรือเปลี่ยนฟิลเตอร์
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter]);

  // 🟢 คำนวณข้อมูล Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const indexOfLastUser = currentPage * itemsPerPage;
  const indexOfFirstUser = indexOfLastUser - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);

  return (
    <div className="sum-user-wrapper">
      <div className="sum-user-page">
        <div className="sum-user-header">
          <h2>จัดการผู้ใช้งาน</h2>
          <button
            className="sum-add-btn"
            onClick={() => {
              setEditingUser(null);
              setShowModal(true);
            }}
          >
            <FiPlus /> เพิ่มผู้ใช้งาน
          </button>
        </div>

        <div className="sum-table-card">
          <div className="sum-filter-bar">
            <div className="sum-search-group">
              <FiSearch className="sum-filter-icon" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล หรือ Username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <CustomDropdown
              icon={FiLayers}
              value={roleFilter}
              onChange={setRoleFilter}
              options={[
                { value: "", label: "ทุก Role" },
                { value: "1", label: "Super Admin" },
                { value: "2", label: "Admin" },
                { value: "3", label: "Staff" },
              ]}
            />

            <CustomDropdown
              icon={FiLayers}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "ทุกสถานะ" },
                { value: "active", label: "Active (ใช้งาน)" },
                { value: "inactive", label: "Inactive (ระงับ)" },
              ]}
            />
          </div>

          <div className="sum-table-responsive">
            <table>
              <thead>
                <tr>
                  <th style={{ width: "60px" }}>ลำดับ</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>อีเมล</th>
                  <th>Role</th>
                  <th style={{ textAlign: "center" }}>สถานะ</th>
                  <th style={{ textAlign: "center" }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan="6"
                      className="td-empty"
                      style={{
                        textAlign: "center",
                        padding: "40px",
                        color: "#64748b",
                      }}
                    >
                      ไม่พบข้อมูลผู้ใช้งาน
                    </td>
                  </tr>
                ) : (
                  currentUsers.map((user, index) => {
                    const isSelf = currentUser && currentUser.id === user.id;
                    const targetRole = Number(user.role_id);
                    const canEdit =
                      currentRoleId === 1 ||
                      isSelf ||
                      currentRoleId < targetRole;
                    const canDelete =
                      (currentRoleId === 1 || currentRoleId < targetRole) &&
                      !isSelf;

                    return (
                      <tr key={user.id}>
                        {/* 🟢 แสดงเลขลำดับเรียงต่อกันทุกหน้า */}
                        <td style={{ color: "#94a3b8", fontWeight: 500 }}>
                          {indexOfFirstUser + index + 1}
                        </td>
                        <td>
                          <div className="sum-user-info-cell">
                            <div className="sum-user-fullname">{user.name}</div>
                            <div className="sum-user-username">
                              @{user.username}
                            </div>
                          </div>
                        </td>
                        <td>{user.email}</td>
                        <td>{roleMap[user.role_id]}</td>
                        <td style={{ textAlign: "center" }}>
                          <span
                            className={`sum-status ${user.status === "active" ? "sum-active" : "sum-inactive"}`}
                          >
                            {user.status === "active"
                              ? "ใช้งานปกติ"
                              : "ระงับการใช้งาน"}
                          </span>
                        </td>
                        <td className="sum-actions">
                          {canEdit ? (
                            <button
                              className="sum-edit"
                              onClick={() => {
                                setEditingUser(user);
                                setShowModal(true);
                              }}
                            >
                              <FaEdit />
                            </button>
                          ) : (
                            <span
                              className="no-permission"
                              style={{ fontSize: "13px", color: "#94a3b8" }}
                            >
                              ไม่มีสิทธิ์
                            </span>
                          )}
                          {canDelete && (
                            <button
                              className="sum-delete"
                              onClick={() => handleDelete(user.id, user.name)}
                            >
                              <FaTrash />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 🟢 Pagination UI แบบเดียวกับ CaseTable */}
          {filteredUsers.length > 0 && (
            <div className="sum-table-pagination-footer">
              <div className="sum-pagination-info">
                <span>แสดง</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="sum-pagination-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>รายการ (รวมทั้งหมด {filteredUsers.length} รายการ)</span>
              </div>

              <div className="sum-pagination-controls">
                <button
                  className="sum-page-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  title="หน้าก่อนหน้า"
                >
                  <FiChevronLeft
                    size={22}
                    style={{ flexShrink: 0, display: "block" }}
                  />
                </button>

                <span className="sum-page-indicator">
                  หน้า{" "}
                  <strong style={{ color: "#4a9b9f" }}>{currentPage}</strong>{" "}
                  จาก {totalPages || 1}
                </span>

                <button
                  className="sum-page-btn"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages || totalPages === 0}
                  title="หน้าถัดไป"
                >
                  <FiChevronRight
                    size={22}
                    style={{ flexShrink: 0, display: "block" }}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddAdminModal
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
          initialData={editingUser}
          canViewPassword={canViewPassword}
        />
      )}
    </div>
  );
}
