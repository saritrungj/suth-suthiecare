import SearchableSelect from "../../components/SearchableSelect";
import { toDisplayText } from "../../utils/textPresentation.js";
import { usePageExport } from "../../components/ExcelExport";
import { authSession } from "../../utils/authSession";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createUser,
  deletePatientMember,
  deleteUser,
  getPatientMember,
  getPatientMembers,
  getUserAssignmentOptions,
  getUserFull,
  getUsers,
  updateUser,
  updatePatientMember,
  getOrganizations,
  getOrganizationRoles,
  updateUserAssignments,
} from "../../services/api";
import AddAdminModal from "../../components/AddAdminModal";
import SchoolRoles from "./school/SchoolRoles";
import PatientMemberModal from "../../components/PatientMemberModal";
import FilterDropdown from "../../components/FilterDropdown";
import TablePagination, {
  DEFAULT_PAGE_SIZE,
} from "../../components/table/TablePagination";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  FiAlertCircle,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { FaEdit, FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import "./UserManagement.css";
import { PageHero } from "../../components/dashboard/DashboardKit";
import DataPanel from "../../components/table/DataPanel";
import ResultSummary from "../../components/table/ResultSummary";

const ROLE_FILTER_LABELS = { 1: "System Admin", 3: "ผู้ใช้งานทั่วไป" };
const STATUS_FILTER_LABELS = {
  active: "ใช้งานปกติ",
  inactive: "ระงับการใช้งาน",
  pending_verification: "รอยืนยัน",
  locked: "ถูกล็อกชั่วคราว",
  disabled: "ปิดการใช้งาน",
};

// Service-recipient types, decided on the server (services/memberType.js).
const MEMBER_TYPE_LABELS = {
  university_student: "นักศึกษา",
  school_student: "นักเรียน",
  general: "บุคคลทั่วไป",
  unknown: "ยังไม่ระบุ",
};

const MySwal = withReactContent(Swal);
const roleMap = {
  1: "System Admin",
  2: "ผู้ใช้งานทั่วไป",
  3: "ผู้ใช้งานทั่วไป",
};
const memberStatusMap = {
  pending_verification: "รอยืนยัน",
  active: "ใช้งานปกติ",
  locked: "ถูกล็อกชั่วคราว",
  disabled: "ปิดการใช้งาน",
};

function getStoredUser() {
  return authSession("staff").user;
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

export default function UserManagement({ initialTab = "staff" }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_PAGE_SIZE);
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
  const {
    can: canAccess,
    authorization,
    activeOrganizationType,
    schoolAccess,
  } = usePermissions();
  const isSystemAdmin = Boolean(authorization?.is_system_admin);
  const canManageUsers = isSystemAdmin;
  // System admins manage patient accounts across every unit, including
  // accounts that have no history in the unit currently selected.
  const memberScope = useMemo(
    () =>
      isSystemAdmin ? { headers: { "X-Organization-Id": "all" } } : undefined,
    [isSystemAdmin],
  );
  const canEditPatient =
    isSystemAdmin ||
    (canAccess("patient_members.update") && canAccess("pii.view"));
  const [organizations, setOrganizations] = useState([]);
  const [organizationRoles, setOrganizationRoles] = useState({});
  const [schoolAssignmentOptions, setSchoolAssignmentOptions] = useState({});
  const managesSchoolStaff =
    activeOrganizationType === "school" && schoolAccess?.can_manage_staff;

  useEffect(() => {
    if (!isSystemAdmin) return;
    getOrganizations()
      .then(async (organizationResponse) => {
        const nextOrganizations = organizationResponse.data || [];
        setOrganizations(nextOrganizations);
        const units = nextOrganizations.filter(
          (organization) =>
            organization.status === "active" &&
            organization.org_level !== "main" &&
            organization.kind !== "main",
        );
        const [catalogs, assignmentResponse] = await Promise.all([
          Promise.all(
            units.map(async (organization) => [
              organization.id,
              (await getOrganizationRoles(organization.id)).data || [],
            ]),
          ),
          getUserAssignmentOptions(),
        ]);
        setOrganizationRoles(Object.fromEntries(catalogs));
        setSchoolAssignmentOptions(
          assignmentResponse.data?.organizations || {},
        );
      })
      .catch(() => setLoadError("ไม่สามารถโหลดข้อมูลหน่วยงานและบทบาทได้"));
  }, [isSystemAdmin]);

  useEffect(() => {
    setActiveTab(initialTab);
    setSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setTypeFilter("");
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
      const response = await getPatientMembers(
        {
          page: currentPage,
          limit: itemsPerPage,
          search: search.trim(),
          status: statusFilter,
          type: typeFilter,
        },
        memberScope,
      );
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
  }, [
    currentPage,
    itemsPerPage,
    search,
    statusFilter,
    typeFilter,
    memberScope,
  ]);

  useEffect(() => {
    if (activeTab !== "staff") return undefined;
    if (!isSystemAdmin) {
      setLoading(false);
      return undefined;
    }
    fetchStaffUsers();
    // Only system admins reach this tab, and they may always view passwords.
    setCanViewPassword(true);
    return undefined;
  }, [activeTab, isSystemAdmin, fetchStaffUsers]);

  useEffect(() => {
    if (activeTab !== "members") return undefined;
    const timer = window.setTimeout(fetchMembers, 250);
    return () => window.clearTimeout(timer);
  }, [activeTab, fetchMembers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, roleFilter, statusFilter, typeFilter, itemsPerPage]);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !term ||
        [user.name, user.email, user.username].some((value) =>
          String(value || "")
            .toLowerCase()
            .includes(term),
        );
      const matchesRole =
        !roleFilter ||
        (roleFilter === "1"
          ? Number(user.role_id) === 1
          : Number(user.role_id) !== 1);
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
  usePageExport({
    title: activeTab === "staff" ? "ผู้ใช้" : "สมาชิก",
    sources:
      activeTab === "staff"
        ? [{ resource: "users", ids: filteredUsers.map((r) => r.id) }]
        : [{ resource: "members", filters: { search, status: statusFilter } }],
    requestConfig: activeTab === "members" ? memberScope : undefined,
    disabled: loading,
  });
  const totalPages =
    activeTab === "staff" ? staffTotalPages : memberPagination.total_pages;

  const handleSaveUser = async (data) => {
    try {
      const { memberships, ...account } = data;
      if (editingUser) {
        await updateUser(editingUser.id, account);
        await updateUserAssignments(editingUser.id, memberships);
      } else {
        const response = await createUser(account);
        try {
          await updateUserAssignments(response.data.id, memberships);
        } catch (assignmentError) {
          await fetchStaffUsers();
          setEditingUser(null);
          setShowModal(false);
          MySwal.fire({
            title: "สร้างบัญชีแล้ว แต่ยังไม่ได้บันทึกหน่วยงาน",
            text:
              (assignmentError.response?.data?.message ||
                "กรุณาลองใหม่อีกครั้ง") +
              " — เปิดแก้ไขผู้ใช้งานนี้เพื่อกำหนดหน่วยงานอีกครั้ง",
            icon: "warning",
            confirmButtonColor: "var(--suth-action)",
          });
          return;
        }
      }
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
        confirmButtonColor: "var(--suth-action)",
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
        confirmButtonColor: "var(--suth-action)",
      });
    }
  };

  const handleDelete = async (user) => {
    const result = await MySwal.fire({
      title: "ยืนยันการลบ",
      text: `ต้องการลบบัญชี ${user.name || user.username} หรือไม่`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "var(--suth-risk-dot-high)",
      cancelButtonColor: "var(--suth-muted)",
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
        confirmButtonColor: "var(--suth-action)",
      });
    }
  };

  const handleEditMember = async (member) => {
    if (!canManageUsers || memberModalLoading) return;
    setMemberModalLoading(true);
    try {
      const response = await getPatientMember(member.id, memberScope);
      setEditingMember(response.data);
    } catch (error) {
      MySwal.fire({
        title: "ไม่สามารถเปิดข้อมูลผู้มารับบริการได้",
        text: error.response?.data?.message || "กรุณาลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "var(--suth-action)",
      });
    } finally {
      setMemberModalLoading(false);
    }
  };

  const handleSaveMember = async (data) => {
    try {
      await updatePatientMember(editingMember.id, data, memberScope);
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
        text:
          error.response?.data?.message ||
          "กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง",
        icon: "error",
        confirmButtonColor: "var(--suth-action)",
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
      confirmButtonColor: "var(--suth-danger)",
      cancelButtonColor: "var(--suth-muted)",
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
        confirmButtonColor: "var(--suth-action)",
      });
    }
  };

  const retry = () => {
    if (activeTab === "staff") fetchStaffUsers();
    else fetchMembers();
  };

  if (!isSystemAdmin && managesSchoolStaff) return <SchoolRoles embedded />;

  return (
    <div className="sum-user-wrapper">
      <main className="sum-user-page">
        <PageHero
          title={
            activeTab === "staff"
              ? "ผู้ดูแลระบบและเจ้าหน้าที่"
              : "ผู้มารับบริการ"
          }
          description={
            activeTab === "staff"
              ? "จัดการบัญชีผู้ดูแลระบบ เจ้าหน้าที่ และระดับการเข้าถึง"
              : isSystemAdmin
                ? "จัดการบัญชีผู้มารับบริการทั้งระบบ แก้ไขข้อมูล สถานะ และกำหนดรหัสผ่านใหม่"
                : "จัดการข้อมูลบัญชี สถานะ และการเข้าถึงประวัติของผู้มารับบริการ"
          }
          actions={
            activeTab === "staff" && (
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
            )
          }
        />

        <DataPanel className="sum-table-card" aria-live="polite">
          <div
            className={`sum-filter-bar ${activeTab === "members" ? "sum-filter-bar--members" : ""}`}
          >
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

            <FilterDropdown
              activeCount={
                [roleFilter, statusFilter, typeFilter].filter(Boolean).length
              }
              onClear={() => {
                setRoleFilter("");
                setStatusFilter("");
                setTypeFilter("");
                setCurrentPage(1);
              }}
            >
              {activeTab === "members" && (
                <label className="sum-native-filter">
                  <span>ประเภทผู้มารับบริการ</span>
                  <SearchableSelect
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                  >
                    <option value="">ทุกประเภท</option>
                    {Object.entries(MEMBER_TYPE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </SearchableSelect>
                </label>
              )}

              {activeTab === "staff" && (
                <label className="sum-native-filter">
                  <span>สิทธิ์บัญชี</span>
                  <SearchableSelect
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                  >
                    <option value="">ทุกระดับ</option>
                    <option value="1">System Admin</option>
                    <option value="3">ผู้ใช้งานทั่วไป</option>
                  </SearchableSelect>
                </label>
              )}

              <label className="sum-native-filter">
                <span>สถานะ</span>
                <SearchableSelect
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
                </SearchableSelect>
              </label>
            </FilterDropdown>
          </div>

          <ResultSummary
            loading={loading}
            pagination={{
              page: currentPage,
              total: totalItems,
              limit: itemsPerPage,
            }}
            chips={[
              activeTab === "staff" && {
                key: "role",
                label: "สิทธิ์บัญชี",
                value: ROLE_FILTER_LABELS[roleFilter] || roleFilter,
                onRemove: () => setRoleFilter(""),
              },
              {
                key: "status",
                label: "สถานะ",
                value: STATUS_FILTER_LABELS[statusFilter] || statusFilter,
                onRemove: () => setStatusFilter(""),
              },
              activeTab === "members" && {
                key: "type",
                label: "ประเภท",
                value: MEMBER_TYPE_LABELS[typeFilter] || typeFilter,
                onRemove: () => setTypeFilter(""),
              },
            ]}
            onClearAll={() => {
              setRoleFilter("");
              setStatusFilter("");
              setTypeFilter("");
              setCurrentPage(1);
            }}
          />

          {loadError && (
            <div className="sum-load-error" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{loadError}</span>
              <button onClick={retry}>
                <FiRefreshCw aria-hidden="true" /> ลองใหม่
              </button>
            </div>
          )}

          <div
            className="sum-table-responsive"
            tabIndex={0}
            role="region"
            aria-label={
              activeTab === "staff"
                ? "ตารางผู้ดูแลและเจ้าหน้าที่"
                : "ตารางสมาชิก"
            }
          >
            {activeTab === "staff" ? (
              <table
                className="admin-data-table"
                aria-label="รายชื่อผู้ดูแลและเจ้าหน้าที่"
              >
                <thead>
                  <tr>
                    <th>ลำดับ</th>
                    <th>ชื่อ–นามสกุล / ชื่อผู้ใช้</th>
                    <th>อีเมล</th>
                    <th>ระดับสิทธิ์</th>
                    <th>สถานะ</th>
                    <th className="is-actions">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <LoadingRows columns={6} />
                  ) : currentUsers.length === 0 ? (
                    <EmptyRow
                      columns={6}
                      message="ไม่พบข้อมูลเจ้าหน้าที่"
                      hint={
                        search || roleFilter || statusFilter
                          ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                          : "ยังไม่มีบัญชีเจ้าหน้าที่ในระบบ"
                      }
                    />
                  ) : (
                    currentUsers.map((user, index) => {
                      const isSelf =
                        Number(currentUser?.id) === Number(user.id);
                      const targetRole = Number(user.role_id);
                      const canEdit = canManageUsers && isSystemAdmin;
                      const canDelete =
                        canManageUsers && !isSelf && isSystemAdmin;
                      return (
                        <tr key={user.id}>
                          <td>{staffStart + index + 1}</td>
                          <td>
                            <div className="sum-user-info-cell">
                              <span className="sum-user-fullname">
                                {user.name || "—"}
                              </span>
                              <span className="sum-user-username">
                                @{user.username}
                              </span>
                            </div>
                          </td>
                          <td className="sum-wrap-text">
                            <div>{user.email || "—"}</div>
                            {user.email && (
                              <small
                                className={
                                  user.email_verified_at
                                    ? "sum-email-verified"
                                    : "sum-email-pending"
                                }
                              >
                                {user.email_verified_at
                                  ? "ยืนยันแล้ว"
                                  : "รอยืนยันอีเมล"}
                              </small>
                            )}
                          </td>
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
                                <span className="sum-read-only">
                                  ดูได้อย่างเดียว
                                </span>
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
              <table
                className="sum-member-table admin-data-table"
                aria-label="รายชื่อสมาชิก"
              >
                <thead>
                  <tr>
                    <th scope="col">ผู้มารับบริการ</th>
                    <th scope="col" className="sum-col-date">
                      วันที่สมัคร
                    </th>
                    <th scope="col" className="sum-col-date">
                      เข้าใช้ล่าสุด
                    </th>
                    <th scope="col">สถานะ</th>
                    <th scope="col" className="is-actions">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <LoadingRows columns={5} />
                  ) : members.length === 0 ? (
                    <EmptyRow
                      columns={5}
                      message={
                        search || statusFilter || typeFilter
                          ? "ไม่พบผู้มารับบริการที่ตรงกับตัวกรอง"
                          : "ยังไม่มีผู้มารับบริการในหน่วยงานนี้"
                      }
                      hint={
                        search || statusFilter || typeFilter
                          ? "ลองเปลี่ยนคำค้นหาหรือตัวกรอง"
                          : "ผู้มารับบริการที่มีประวัติในหน่วยงานนี้จะแสดงที่นี่"
                      }
                    />
                  ) : (
                    members.map((member) => (
                      <tr key={member.id}>
                        <td className="sum-member-cell">
                          <div className="sum-member-name">
                            <span
                              className="sum-member-icon"
                              aria-hidden="true"
                            >
                              <FiUserCheck />
                            </span>
                            <span className="sum-member-text">
                              <strong title={member.full_name || undefined}>
                                {member.full_name || "—"}
                              </strong>
                              <span className="sum-member-meta">
                                <span
                                  className={`sum-member-type sum-member-type--${member.member_type || "unknown"}`}
                                >
                                  {member.member_type_label ||
                                    MEMBER_TYPE_LABELS[member.member_type] ||
                                    MEMBER_TYPE_LABELS.unknown}
                                </span>
                                <span title={member.username}>
                                  {member.username}
                                </span>
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="sum-col-date" data-label="สมัคร">
                          {formatDate(member.created_at)}
                        </td>
                        <td className="sum-col-date" data-label="เข้าใช้ล่าสุด">
                          {formatDate(member.last_login_at)}
                        </td>
                        <td className="sum-member-status">
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="sum-actions">
                          <div className="sum-actions-group">
                            {canEditPatient ? (
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
                                {isSystemAdmin && (
                                  <button
                                    className="sum-delete"
                                    onClick={() => handleDeleteMember(member)}
                                    aria-label={`ลบบัญชี ${member.full_name || member.username}`}
                                    title="ลบบัญชีผู้มารับบริการ"
                                  >
                                    <FaTrash aria-hidden="true" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="sum-read-only">
                                ดูได้อย่างเดียว
                              </span>
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
            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              total={totalItems}
              limit={itemsPerPage}
              onPage={setCurrentPage}
              onLimit={(size) => {
                setItemsPerPage(size);
                setCurrentPage(1);
              }}
            />
          )}
        </DataPanel>
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
          organizationRoles={organizationRoles}
          schoolAssignmentOptions={schoolAssignmentOptions}
        />
      )}
      {editingMember && (
        <PatientMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={handleSaveMember}
          requestConfig={memberScope}
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
  return (
    <span className={`sum-status sum-status-${status}`}>
      {toDisplayText(label)}
    </span>
  );
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

function EmptyRow({ columns, message, hint }) {
  return (
    <tr>
      <td colSpan={columns} className="sum-empty-state">
        <FiUsers aria-hidden="true" />
        <strong>{message}</strong>
        <span>{hint}</span>
      </td>
    </tr>
  );
}
