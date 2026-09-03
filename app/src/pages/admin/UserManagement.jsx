import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createUser,
  deletePatientMember,
  deleteUser,
  getPatientMember,
  getPatientMembers,
  getRolePermissions,
  getUserFull,
  getUsers,
  updateUser,
  updatePatientMember,
  getOrganizations,
  getRoles,
  createOrganizationMember,
  updateOrganizationMember,
} from "../../services/api";
import AddAdminModal from "../../components/AddAdminModal";
import PatientMemberModal from "../../components/PatientMemberModal";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  FiAlertCircle,
  FiChevronLeft,
  FiChevronRight,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { FaEdit, FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./UserManagement.css";

const MySwal = withReactContent(Swal);
const roleMap = { 1: "System Admin", 2: "Admin", 3: "Staff" };
const memberStatusMap = {
  pending_verification: "รอยืนยัน",
  active: "ใช้งานปกติ",
  locked: "ถูกล็อกชั่วคราว",
  disabled: "ปิดการใช้งาน",
};

function getStoredUser() {
  try {
    const value =
      sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function UserManagement({ initialTab = "staff", standalone = false }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [memberPagination, setMemberPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [memberModalLoading, setMemberModalLoading] = useState(false);
  const [canViewPassword, setCanViewPassword] = useState(false);
  const memberRequestRef = useRef(0);

  const currentUser = useMemo(getStoredUser, []);
  const currentRoleId = Number(currentUser?.role_id || 3);
  const { can: canAccess, authorization } = usePermissions();
  const isSystemAdmin = Boolean(authorization?.is_system_admin);
  const canManageUsers = isSystemAdmin;
  const [organizations, setOrganizations] = useState([]);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    if (!isSystemAdmin) return;
    Promise.all([getOrganizations(), getRoles()]).then(([organizationResponse, roleResponse]) => {
      setOrganizations(organizationResponse.data || []);
      setRoles(roleResponse.data || []);
    }).catch(() => setLoadError("ไม่สามารถโหลดข้อมูลหน่วยงานและบทบาทได้"));
  }, [isSystemAdmin]);

  useEffect(() => {
    setActiveTab(initialTab);
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setCurrentPage(1);
    setLoadError("");
  }, [initialTab]);

  const fetchStaffUsers = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await getUsers();
      setUsers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      setUsers([]);
      setLoadError(
        error.response?.data?.message ||
          "ไม่สามารถโหลดข้อมูลเจ้าหน้าที่ได้ กรุณาลองใหม่",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async () => {
    const requestId = ++memberRequestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const response = await getPatientMembers({
        page: currentPage,
        limit: itemsPerPage,
        search: search.trim(),
        status: statusFilter,
      });
      if (requestId !== memberRequestRef.current) return;
      setMembers(Array.isArray(response.data?.data) ? response.data.data : []);
      setMemberPagination(
        response.data?.pagination || {
          page: currentPage,
          limit: itemsPerPage,
          total: 0,
          total_pages: 1,
        },
      );
    } catch (error) {
      if (requestId !== memberRequestRef.current) return;
      setMembers([]);
      setLoadError(
        error.response?.data?.message ||
          "ไม่สามารถโหลดข้อมูลสมาชิกได้ กรุณาลองใหม่",
      );
    } finally {
      if (requestId === memberRequestRef.current) setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, statusFilter]);

  useEffect(() => {
    if (activeTab !== "staff") return undefined;
    fetchStaffUsers();
    if (currentRoleId === 1) {
      setCanViewPassword(true);
      return undefined;
    }
    getRolePermissions(currentRoleId)
      .then((response) => {
        const permission = response.data?.find(
          (item) =>
            item.module === "User Management" ||
            item.module === "จัดการผู้ใช้ (Users)",
        );
        setCanViewPassword(Boolean(permission?.can_view_password));
      })
      .catch(() => setCanViewPassword(false));
    return undefined;
  }, [activeTab, currentRoleId, fetchStaffUsers]);

  useEffect(() => {
    if (activeTab !== "members") return undefined;
    const timer = window.setTimeout(fetchMembers, 250);
    return () => window.clearTimeout(timer);
  }, [activeTab, fetchMembers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, roleFilter, statusFilter, itemsPerPage]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [user.name, user.email, user.username].some((value) =>
          String(value || "").toLowerCase().includes(term),
        );
      const matchesRole = !roleFilter || String(user.role_id) === roleFilter;
      const matchesStatus = !statusFilter || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const staffTotalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / itemsPerPage),
  );
  const staffStart = (currentPage - 1) * itemsPerPage;
  const currentUsers = filteredUsers.slice(
    staffStart,
    staffStart + itemsPerPage,
  );
  const totalItems =
    activeTab === "staff" ? filteredUsers.length : memberPagination.total;
  const totalPages =
    activeTab === "staff" ? staffTotalPages : memberPagination.total_pages;

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setCurrentPage(1);
    setLoadError("");
  };

  const syncMemberships = async (userId, memberships, existing = []) => {
    const wanted = new Map((memberships || []).map((membership) => [Number(membership.organization_id), membership]));
    await Promise.all((existing || []).map((membership) => {
      const desired = wanted.get(Number(membership.organization_id));
      return updateOrganizationMember(membership.organization_id, membership.id, desired ? { role_id: desired.role_id, status: desired.status || "active", is_primary: desired.is_primary } : { role_id: membership.role_id, status: "inactive", is_primary: false });
    }));
    const existingOrganizations = new Set((existing || []).map((membership) => Number(membership.organization_id)));
    await Promise.all([...wanted.values()].filter((membership) => !existingOrganizations.has(Number(membership.organization_id))).map((membership) => createOrganizationMember(membership.organization_id, { user_id: userId, role_id: membership.role_id, is_primary: membership.is_primary })));
  };

  const handleSaveUser = async (data) => {
    try {
      const { memberships, ...account } = data;
      if (editingUser) { await updateUser(editingUser.id, account); await syncMemberships(editingUser.id, memberships, editingUser.memberships); }
      else { const response = await createUser(account); await syncMemberships(response.data.id, memberships); }
      setShowModal(false);
      setEditingUser(null);
      await fetchStaffUsers();
      MySwal.fire({
        title: "สำเร็จ",
        text: "บันทึกข้อมูลผู้ใช้งานเรียบร้อยแล้ว",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      MySwal.fire({
        title: "ไม่สามารถบันทึกข้อมูลได้",
        text: error.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const handleEditUser = async (user) => {
    try {
      const response = await getUserFull(user.id);
      setEditingUser(response.data);
      setShowModal(true);
    } catch (error) {
      MySwal.fire({
        title: "ไม่สามารถเปิดข้อมูลผู้ใช้งานได้",
        text: error.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const handleDelete = async (user) => {
    const result = await MySwal.fire({
      title: "ยืนยันการลบ",
      text: `ต้องการลบบัญชี ${user.name || user.username} หรือไม่`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "ลบบัญชี",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
    });
    if (!result.isConfirmed) return;
    try {
      await deleteUser(user.id);
      await fetchStaffUsers();
      MySwal.fire({
        title: "ลบบัญชีแล้ว",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      MySwal.fire({
        title: "ไม่สามารถลบบัญชีได้",
        text: error.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const handleEditMember = async (member) => {
    if (!canManageUsers || memberModalLoading) return;
    setMemberModalLoading(true);
    try {
      const response = await getPatientMember(member.id);
      setEditingMember(response.data);
    } catch (error) {
      MySwal.fire({
        title: "ไม่สามารถเปิดข้อมูลผู้มารับบริการได้",
        text: error.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "#f47932",
      });
    } finally {
      setMemberModalLoading(false);
    }
  };

  const handleSaveMember = async (data) => {
    try {
      await updatePatientMember(editingMember.id, data);
      setEditingMember(null);
      await fetchMembers();
      await MySwal.fire({
        title: "บันทึกเรียบร้อยแล้ว",
        text: "ข้อมูลผู้มารับบริการและสถานะบัญชีเป็นปัจจุบันแล้ว",
        icon: "success",
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (error) {
      await MySwal.fire({
        title: "ไม่สามารถบันทึกข้อมูลได้",
        text: error.response?.data?.message || "กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "#f47932",
      });
      throw error;
    }
  };

  const handleDeleteMember = async (member) => {
    if (!canManageUsers) return;
    const result = await MySwal.fire({
      title: "ลบบัญชีผู้มารับบริการ?",
      html: `บัญชี <strong>${member.full_name || member.username}</strong> จะไม่สามารถเข้าสู่ระบบได้อีก<br><small>ข้อมูลการประเมินทางคลินิกจะยังคงอยู่ แต่จะยกเลิกการเชื่อมกับบัญชีนี้</small>`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#b42318",
      cancelButtonColor: "#64748b",
      confirmButtonText: "ลบบัญชีถาวร",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!result.isConfirmed) return;
    try {
      await deletePatientMember(member.id);
      await fetchMembers();
      MySwal.fire({
        title: "ลบบัญชีเรียบร้อยแล้ว",
        icon: "success",
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (error) {
      MySwal.fire({
        title: "ไม่สามารถลบบัญชีได้",
        text: error.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "#f47932",
      });
    }
  };

  const retry = () => {
    if (activeTab === "staff") fetchStaffUsers();
    else fetchMembers();
  };

  return (
    <div className="sum-user-wrapper">
      <main className="sum-user-page">
        <header className="sum-user-header">
          <div>
            <h1>
              {activeTab === "staff"
                ? "ผู้ดูแลระบบและเจ้าหน้าที่"
                : "ผู้มารับบริการ"}
            </h1>
            <p>
              {activeTab === "staff"
                ? "จัดการบัญชีผู้ดูแลระบบ เจ้าหน้าที่ และระดับการเข้าถึง"
                : "จัดการข้อมูลบัญชี สถานะ และการเข้าถึงประวัติของผู้มารับบริการ"}
            </p>
          </div>
          {activeTab === "staff" && (
            <button
              className="sum-add-btn"
              onClick={() => {
                setEditingUser(null);
                setShowModal(true);
              }}
              disabled={!canManageUsers}
              title={
                canManageUsers
                  ? "เพิ่มผู้ใช้งาน"
                  : "บัญชีของคุณมีสิทธิ์ดูข้อมูลเท่านั้น"
              }
            >
              <FiPlus aria-hidden="true" /> เพิ่มผู้ใช้งาน
            </button>
          )}
        </header>

        {!standalone && (
          <nav className="sum-user-tabs" aria-label="ประเภทผู้ใช้งาน">
          <button
            className={activeTab === "staff" ? "active" : ""}
            onClick={() => switchTab("staff")}
            aria-current={activeTab === "staff" ? "page" : undefined}
          >
            <FiShield aria-hidden="true" />
            <span>เจ้าหน้าที่</span>
            <strong>{users.length}</strong>
          </button>
          <button
            className={activeTab === "members" ? "active" : ""}
            onClick={() => switchTab("members")}
            aria-current={activeTab === "members" ? "page" : undefined}
          >
            <FiUsers aria-hidden="true" />
            <span>ผู้มารับบริการ</span>
            <strong>{memberPagination.total}</strong>
          </button>
          </nav>
        )}

        <section className="sum-table-card" aria-live="polite">
          <div className={`sum-filter-bar ${activeTab === "members" ? "sum-filter-bar--members" : ""}`}>
            <label className="sum-search-group">
              <FiSearch className="sum-filter-icon" aria-hidden="true" />
              <span className="sr-only">ค้นหาผู้ใช้งาน</span>
              <input
                type="search"
                placeholder={
                  activeTab === "staff"
                    ? "ค้นหาชื่อ อีเมล หรือชื่อผู้ใช้"
                    : "ค้นหาชื่อผู้ใช้ของผู้มารับบริการ"
                }
                value={search}
                onChange={(event) => setSearch(event.target.value.slice(0, 80))}
              />
            </label>

            {activeTab === "staff" && (
              <label className="sum-native-filter">
                <span>ระดับสิทธิ์</span>
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                >
                  <option value="">ทุกระดับ</option>
                  <option value="1">Super Admin</option>
                  <option value="2">Admin</option>
                  <option value="3">Staff</option>
                </select>
              </label>
            )}

            <label className="sum-native-filter">
              <span>สถานะ</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">ทุกสถานะ</option>
                {activeTab === "staff" ? (
                  <>
                    <option value="active">ใช้งานปกติ</option>
                    <option value="inactive">ระงับการใช้งาน</option>
                  </>
                ) : (
                  <>
                    <option value="active">ใช้งานปกติ</option>
                    <option value="pending_verification">รอยืนยัน</option>
                    <option value="locked">ถูกล็อกชั่วคราว</option>
                    <option value="disabled">ปิดการใช้งาน</option>
                  </>
                )}
              </select>
            </label>
          </div>

          {loadError && (
            <div className="sum-load-error" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{loadError}</span>
              <button onClick={retry}>
                <FiRefreshCw aria-hidden="true" /> ลองใหม่
              </button>
            </div>
          )}

          <div className="sum-table-responsive">
            {activeTab === "staff" ? (
              <table>
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ชื่อ–นามสกุล / ชื่อผู้ใช้</th>
                    <th>อีเมล</th>
                    <th>ระดับสิทธิ์</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <LoadingRows columns={6} />
                  ) : currentUsers.length === 0 ? (
                    <EmptyRow columns={6} message="ไม่พบข้อมูลเจ้าหน้าที่" />
                  ) : (
                    currentUsers.map((user, index) => {
                      const isSelf = Number(currentUser?.id) === Number(user.id);
                      const targetRole = Number(user.role_id);
                      const canEdit =
                        canManageUsers &&
                        isSystemAdmin;
                      const canDelete =
                        canManageUsers &&
                        !isSelf &&
                        isSystemAdmin;
                      return (
                        <tr key={user.id}>
                          <td>{staffStart + index + 1}</td>
                          <td>
                            <div className="sum-user-info-cell">
                              <span className="sum-user-fullname">{user.name || "—"}</span>
                              <span className="sum-user-username">@{user.username}</span>
                            </div>
                          </td>
                          <td className="sum-wrap-text">{user.email || "—"}</td>
                          <td>{roleMap[user.role_id] || "—"}</td>
                          <td>
                            <StatusBadge status={user.status} staff />
                          </td>
                          <td className="sum-actions">
                            <div className="sum-actions-group">
                              {canEdit && (
                                <button
                                  className="sum-edit"
                                  onClick={() => handleEditUser(user)}
                                  aria-label={`แก้ไข ${user.username}`}
                                  title="แก้ไขข้อมูลผู้ใช้งาน"
                                >
                                  <FaEdit aria-hidden="true" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  className="sum-delete"
                                  onClick={() => handleDelete(user)}
                                  aria-label={`ลบ ${user.username}`}
                                  title="ลบบัญชีผู้ใช้งาน"
                                >
                                  <FaTrash aria-hidden="true" />
                                </button>
                              )}
                              {!canEdit && !canDelete && (
                                <span className="sum-read-only">ดูได้อย่างเดียว</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <table className="sum-member-table">
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ชื่อผู้ใช้สมาชิก</th>
                    <th>ชื่อ-นามสกุล</th>
                    <th>วันที่สมัคร</th>
                    <th>เข้าใช้ล่าสุด</th>
                    <th>สถานะ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <LoadingRows columns={7} />
                  ) : members.length === 0 ? (
                    <EmptyRow columns={7} message="ไม่พบข้อมูลผู้มารับบริการ" />
                  ) : (
                    members.map((member, index) => (
                      <tr key={member.id}>
                        <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                        <td>
                          <div className="sum-member-name">
                            <span className="sum-member-icon" aria-hidden="true">
                              <FiUserCheck />
                            </span>
                            <span title={member.username}>{member.username}</span>
                          </div>
                        </td>
                        <td>{member.full_name || "—"}</td>
                        <td>{formatDate(member.created_at)}</td>
                        <td>{formatDate(member.last_login_at)}</td>
                        <td>
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="sum-actions">
                          <div className="sum-actions-group">
                            {canManageUsers ? (
                              <>
                              <button
                                className="sum-edit"
                                onClick={() => handleEditMember(member)}
                                disabled={memberModalLoading}
                                aria-label={`แก้ไขข้อมูล ${member.full_name || member.username}`}
                                title="แก้ไขข้อมูลและเปลี่ยนรหัสผ่าน"
                              >
                                <FaEdit aria-hidden="true" />
                              </button>
                              <button
                                className="sum-delete"
                                onClick={() => handleDeleteMember(member)}
                                aria-label={`ลบบัญชี ${member.full_name || member.username}`}
                                title="ลบบัญชีผู้มารับบริการ"
                              >
                                <FaTrash aria-hidden="true" />
                              </button>
                              </>
                            ) : (
                              <span className="sum-read-only">ดูได้อย่างเดียว</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {!loading && totalItems > 0 && (
            <footer className="sum-table-pagination-footer">
              <div className="sum-pagination-info">
                <span>แสดง</span>
                <select
                  value={itemsPerPage}
                  onChange={(event) => setItemsPerPage(Number(event.target.value))}
                  aria-label="จำนวนรายการต่อหน้า"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>จากทั้งหมด {totalItems.toLocaleString("th-TH")} รายการ</span>
              </div>
              <div className="sum-pagination-controls">
                <button
                  className="sum-page-btn"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage <= 1}
                  aria-label="หน้าก่อนหน้า"
                >
                  <FiChevronLeft aria-hidden="true" />
                </button>
                <span>
                  หน้า <strong>{currentPage}</strong> จาก {totalPages}
                </span>
                <button
                  className="sum-page-btn"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  disabled={currentPage >= totalPages}
                  aria-label="หน้าถัดไป"
                >
                  <FiChevronRight aria-hidden="true" />
                </button>
              </div>
            </footer>
          )}
        </section>
      </main>

      {showModal && (
        <AddAdminModal
          onClose={() => {
            setShowModal(false);
            setEditingUser(null);
          }}
          onSave={handleSaveUser}
          initialData={editingUser}
          canViewPassword={canViewPassword}
          organizations={organizations}
          roles={roles}
        />
      )}
      {editingMember && (
        <PatientMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveMember}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, staff = false }) {
  const label = staff
    ? status === "active"
      ? "ใช้งานปกติ"
      : "ระงับการใช้งาน"
    : memberStatusMap[status] || "ไม่ทราบสถานะ";
  return <span className={`sum-status sum-status-${status}`}>{label}</span>;
}

function LoadingRows({ columns }) {
  return Array.from({ length: 5 }, (_, index) => (
    <tr className="sum-loading-row" key={index} aria-hidden="true">
      <td colSpan={columns}>
        <span />
      </td>
    </tr>
  ));
}

function EmptyRow({ columns, message }) {
  return (
    <tr>
      <td colSpan={columns} className="sum-empty-state">
        <FiUsers aria-hidden="true" />
        <strong>{message}</strong>
        <span>ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ</span>
      </td>
    </tr>
  );
}
