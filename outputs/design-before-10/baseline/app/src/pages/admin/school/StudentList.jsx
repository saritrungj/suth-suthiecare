import { toDisplayText } from '../../../utils/textPresentation.js';
import MasterSelect from "../../../components/MasterSelect";
import { usePageExport } from "../../../components/ExcelExport";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiEdit2,
  FiEye,
  FiKey,
  FiPlus,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import Swal from "sweetalert2";
import {
  createSchoolStudent,
  deleteSchoolStudent,
  getSchoolClassrooms,
  getSchoolGrades,
  getSchoolStudents,
  getSchoolTypes,
  resetStudentPassword,
  updateSchoolStudent,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../../utils/alerts";
import {
  EmptyRow,
  GENDER_LABELS,
  LoadingRows,
  PageHeader,
  Pagination,
  STUDENT_STATUS_LABELS,
  useStudentStatusLabels,
  RequiredMark,
  RequiredNote,
  SchoolModal,
  TableScroll,
  ThaiDateField,
  classroomLabel,
  currentAcademicYear,
  escapeHtml,
  studentName,
  useFieldErrors,
  useSchools,
  BarSelect,
  FilterDropdown,
  MenuSelect,
  SearchField,
} from "./schoolUi";
import StudentDetailModal from "./StudentDetailModal";
import "./school.css";

const emptyFilters = {
  grade_id: "",
  classroom_id: "",
  student_type_id: "",
  status: "active",
  search: "",
  is_boarder: '',
};

export default function StudentList() {
  const statusLabels=useStudentStatusLabels();
  const { schoolAccess: access } = usePermissions();
  const { schoolId } = useSchools();
  const [filters, setFilters] = useState(emptyFilters);
  const [grades, setGrades] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [studentTypes, setStudentTypes] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    getSchoolTypes("student-types")
      .then(({ data }) => setStudentTypes(data || []))
      .catch(() => setStudentTypes([]));
  }, []);

  useEffect(() => {
    if (!schoolId) {
      setGrades([]);
      setClassrooms([]);
      return;
    }
    Promise.all([getSchoolGrades(schoolId), getSchoolClassrooms(schoolId)])
      .then(([gradeRes, roomRes]) => {
        setGrades(gradeRes.data || []);
        setClassrooms(roomRes.data || []);
      })
      .catch(() => {
        setGrades([]);
        setClassrooms([]);
      });
  }, [schoolId]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await getSchoolStudents({
        school_id: schoolId || undefined,
        ...Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== ""),
        ),
        page,
        limit,
      });
      if (id === requestId.current) setResult(data);
    } catch (err) {
      if (id === requestId.current)
        setLoadError(
          err.response?.data?.message || "ไม่สามารถโหลดรายชื่อนักเรียนได้",
        );
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [schoolId, filters, page, limit]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const updateFilter = (key, value) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "grade_id" ? { classroom_id: "" } : {}),
    }));
  };

  const visibleClassrooms = classrooms.filter(
    (room) =>
      !filters.grade_id || String(room.grade_level_id) === filters.grade_id,
  );

  const resetPassword = async (student) => {
    if (
      !(await confirmAlert({
        title: `ตั้งรหัสผ่านใหม่ให้ ${studentName(student)}?`,
        text: "รหัสเดิมจะใช้ไม่ได้ทันที นักเรียนต้องเปลี่ยนรหัสอีกครั้งเมื่อเข้าสู่ระบบ",
        confirmText: "ตั้งรหัสใหม่",
      }))
    )
      return;
    try {
      const { data } = await resetStudentPassword(student.id);
      await Swal.fire({
        icon: "success",
        title: "รหัสผ่านชั่วคราว",
        html: `<p>ชื่อผู้ใช้ <b>${escapeHtml(data.username)}</b></p><p style="font-size:1.4rem;font-family:monospace;letter-spacing:2px">${escapeHtml(data.password)}</p><p style="color:#b45309">แสดงครั้งเดียวเท่านั้น กรุณาจดหรือส่งให้นักเรียนก่อนปิดหน้าต่าง</p>`,
        confirmButtonText: "บันทึกแล้ว",
        confirmButtonColor: "#c2410c",
        allowOutsideClick: false,
      });
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ" });
    }
  };

  const remove = async (student) => {
    if (
      !(await confirmAlert({
        title: `ปิดบัญชี ${studentName(student)}?`,
        text: "ปิดการเข้าสู่ระบบของบัญชีนักเรียน โดยคงสถานะการศึกษาและประวัติไว้",
        confirmText: "ปิดบัญชี",
        danger: true,
      }))
    )
      return;
    try {
      await deleteSchoolStudent(student.id);
      await load();
      await showSuccessToast("ปิดข้อมูลนักเรียนแล้ว");
    } catch (err) {
      await showErrorAlert({ error: err, title: "ดำเนินการไม่สำเร็จ" });
    }
  };

  usePageExport({title:"นักเรียน",sources:[{resource:"students",filters:{...filters,school_id:schoolId}}],disabled:loading});
  const students = result.data || [];
  // Previous/next inside the student file follow this page of the list.
  const viewingIndex = students.findIndex((student) => student.id === viewing);
  const studentNav =
    viewingIndex === -1
      ? undefined
      : {
          position: viewingIndex + 1,
          total: students.length,
          onPrev:
            viewingIndex > 0
              ? () => setViewing(students[viewingIndex - 1].id)
              : undefined,
          onNext:
            viewingIndex < students.length - 1
              ? () => setViewing(students[viewingIndex + 1].id)
              : undefined,
        };
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="รายชื่อนักเรียน"
          description={
            access?.can_view_all_students
              ? "นักเรียนทั้งหมดของโรงเรียน คลิกชื่อเพื่อดูข้อมูลสุขภาพจิตและสุขภาพกาย"
              : "นักเรียนในห้องที่คุณดูแล คลิกชื่อเพื่อดูข้อมูลสุขภาพจิตและสุขภาพกาย"
          }
        >
          {access?.can_create_students && (
            <>
              <Link
                className="sch-btn-secondary"
                to="/admin/school/students/import"
              >
                <FiUpload aria-hidden="true" /> นำเข้าจาก Excel/CSV
              </Link>
              <button
                type="button"
                className="sch-btn"
                disabled={!schoolId}
                onClick={() => setEditing({ school_id: schoolId })}
              >
                <FiPlus aria-hidden="true" /> เพิ่มนักเรียน
              </button>
            </>
          )}
        </PageHeader>

        <section className="sch-card">
          <div className="sch-filter-bar">
            <SearchField
              label="ค้นหานักเรียน"
              placeholder="ค้นหาชื่อ ชื่อเล่น รหัสนักเรียน หรือชื่อผู้ใช้"
              value={filters.search}
              onChange={(value) => updateFilter("search", value)}
            />
            <BarSelect
              label="ชั้นปี"
              value={filters.grade_id}
              disabled={!schoolId}
              onChange={(value) => updateFilter("grade_id", value)}
            >
              <option value="">ทุกชั้นปี</option>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </BarSelect>
            <BarSelect
              label="ห้อง"
              value={filters.classroom_id}
              disabled={!schoolId}
              onChange={(value) => updateFilter("classroom_id", value)}
            >
              <option value="">ทุกห้อง</option>
              {visibleClassrooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.grade_name} ห้อง {room.name} ({room.academic_year})
                </option>
              ))}
            </BarSelect>
            <FilterDropdown
              activeCount={
                [filters.student_type_id, filters.status !== "active"].filter(
                  Boolean,
                ).length
              }
            >
              <MenuSelect
                label="ประเภทนักเรียน"
                value={filters.student_type_id}
                onChange={(value) => updateFilter("student_type_id", value)}
              >
                <option value="">ทุกประเภท</option>
                {studentTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </MenuSelect>
              <MenuSelect
                label="สถานะ"
                value={filters.status}
                onChange={(value) => updateFilter("status", value)}
              >
                <option value="">ทุกสถานะ</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {toDisplayText(label)}
                  </option>
                ))}
              </MenuSelect>
              <MenuSelect label="ที่พัก" value={filters.is_boarder} onChange={value=>updateFilter('is_boarder',value)}><option value="">ทุกประเภทที่พัก</option><option value="1">นักเรียนหอพัก</option><option value="0">ไปกลับ</option></MenuSelect>
            </FilterDropdown>
          </div>

          {loadError && (
            <p className="sch-error" role="alert">
              {loadError}{" "}
              <button type="button" className="sch-btn-ghost" onClick={load}>
                ลองใหม่
              </button>
            </p>
          )}

          <TableScroll label="ตารางรายชื่อนักเรียน">
            <table className="sch-table">
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อ-นามสกุล</th>
                  <th>ชั้น/ห้อง</th>
                  <th>ประเภท</th>
                  <th>บัญชีผู้ใช้</th>
                  <th>สถานะ</th>
                  <th className="sch-actions-col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={7} />
                ) : !students.length ? (
                  <EmptyRow
                    columns={7}
                    title="ไม่พบนักเรียน"
                    hint={
                      access?.can_create_students
                        ? "ลองเปลี่ยนตัวกรอง หรือนำเข้ารายชื่อนักเรียนจากไฟล์ Excel/CSV"
                        : "ลองเปลี่ยนตัวกรอง"
                    }
                  />
                ) : (
                  students.map((student) => (
                    <tr key={student.id}>
                      <td>{student.student_code}</td>
                      <td>
                        <button
                          type="button"
                          className="sch-name-btn"
                          onClick={() => setViewing(student.id)}
                        >
                          <span className="sch-name">
                            {studentName(student)}
                          </span>
                        </button>
                        <span className="sch-sub">
                          {student.nickname ? `(${student.nickname})` : ""}
                        </span>
                      </td>
                      <td>{classroomLabel(student)}</td>
                      <td>{student.student_type_name || "-"}</td>
                      <td>
                        {student.username || "-"}
                        {student.must_change_password && (
                          <span className="sch-badge status-pending">
                            ยังไม่เปลี่ยนรหัส
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`sch-badge status-${student.status === "active" ? "active" : "inactive"}`}
                        >
                          {student.status_label || statusLabels[student.status] || STUDENT_STATUS_LABELS[student.status]}
                        </span>
                      </td>
                      <td>
                        <div className="sch-row-actions">
                          <button
                            type="button"
                            className="sch-icon-btn"
                            aria-label={`ดูข้อมูล ${studentName(student)}`}
                            onClick={() => setViewing(student.id)}
                          >
                            <FiEye aria-hidden="true" />
                          </button>
                          {access?.can_update_students && (
                            <>
                              <button
                                type="button"
                                className="sch-icon-btn"
                                aria-label={`แก้ไขข้อมูล ${studentName(student)}`}
                                onClick={() => setEditing(student)}
                              >
                                <FiEdit2 aria-hidden="true" />
                              </button>
                              {student.username && (
                                <button
                                  type="button"
                                  className="sch-icon-btn"
                                  aria-label={`ตั้งรหัสผ่านใหม่ให้ ${studentName(student)}`}
                                  onClick={() => resetPassword(student)}
                                >
                                  <FiKey aria-hidden="true" />
                                </button>
                              )}
                            </>
                          )}
                          {access?.can_delete_students &&
                            student.account_status !== "disabled" && (
                              <button
                                type="button"
                                className="sch-icon-btn sch-danger"
                                aria-label={`ปิดข้อมูล ${studentName(student)}`}
                                onClick={() => remove(student)}
                              >
                                <FiTrash2 aria-hidden="true" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
          <Pagination
            pagination={result.pagination}
            onPage={setPage}
            onLimit={(value) => {
              setLimit(value);
              setPage(1);
            }}
          />
        </section>

        {viewing && (
          <StudentDetailModal
            studentId={viewing}
            nav={studentNav}
            onClose={() => setViewing(null)}
          />
        )}
        {editing && (
          <StudentFormModal
            initial={editing}
            studentTypes={studentTypes}
            onClose={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await load();
            }}
          />
        )}
      </main>
    </div>
  );
}

function StudentFormModal({ initial, studentTypes, onClose, onSaved }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({
    school_id: initial.school_id || "",
    classroom_id: initial.classroom_id || "",
    student_type_id: initial.student_type_id || "",
    student_code: initial.student_code || "",
    prefix: initial.prefix || "",
    first_name: initial.first_name || "",
    last_name: initial.last_name || "",
    nickname: initial.nickname || "",
    gender: initial.gender || "",
    birth_date: initial.birth_date || "",
    national_id: "",
    status: initial.status || "active",
  });
  const [classrooms, setClassrooms] = useState([]);
  const [saving, setSaving] = useState(false);
  const { bind, errorFor } = useFieldErrors();

  useEffect(() => {
    if (!form.school_id) return;
    getSchoolClassrooms(form.school_id, {
      academic_year: isNew ? currentAcademicYear() : undefined,
    })
      .then(({ data }) => setClassrooms(data || []))
      .catch(() => setClassrooms([]));
  }, [form.school_id, isNew]);

  const set = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      student_type_id: form.student_type_id || null,
      classroom_id: form.classroom_id || null,
      gender: form.gender || null,
    };
    try {
      if (isNew) {
        const { data } = await createSchoolStudent(payload);
        if (data.password)
          await Swal.fire({
            icon: "success",
            title: "สร้างนักเรียนและบัญชีแล้ว",
            html: `<p>ชื่อผู้ใช้ <b>${escapeHtml(data.username)}</b></p><p style="font-size:1.4rem;font-family:monospace;letter-spacing:2px">${escapeHtml(data.password)}</p><p style="color:#b45309">รหัสผ่านชั่วคราวแสดงครั้งเดียว นักเรียนต้องเปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งแรก</p>`,
            confirmButtonText: "บันทึกแล้ว",
            confirmButtonColor: "#c2410c",
            allowOutsideClick: false,
          });
        else
          await showSuccessToast(
            `เพิ่มนักเรียนแล้ว (ผูกกับบัญชีเดิม ${escapeHtml(data.username)})`,
          );
      } else {
        await updateSchoolStudent(initial.id, payload);
        await showSuccessToast("บันทึกข้อมูลนักเรียนแล้ว");
      }
      await onSaved();
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "บันทึกข้อมูลนักเรียนไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SchoolModal
      title={isNew ? "เพิ่มนักเรียน" : `แก้ไขข้อมูล ${studentName(initial)}`}
      subtitle={
        isNew
          ? "ระบบจะสร้างบัญชีผู้ใช้ให้อัตโนมัติ หากมีเลขบัตรประชาชนที่มีบัญชีอยู่แล้วจะผูกกับบัญชีเดิม"
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="submit"
            form="student-form"
            className="sch-btn"
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </>
      }
    >
      <form id="student-form" className="sch-form-grid" onSubmit={save}>
        <RequiredNote />
        <label className="sch-field">
          <span>
            รหัสนักเรียน
            <RequiredMark />
          </span>
          <input
            required
            maxLength={32}
            value={form.student_code}
            onChange={set("student_code")}
            readOnly={!isNew}
            {...bind("student_code", "กรุณากรอกรหัสนักเรียน")}
          />
          {errorFor("student_code")}
        </label>
        <label className="sch-field">
          <span>
            ชั้น/ห้อง
            {isNew && <RequiredMark />}
          </span>
          <select
            required={isNew}
            value={form.classroom_id}
            onChange={set("classroom_id")}
            {...(isNew ? bind("classroom_id", "กรุณาเลือกชั้น/ห้อง") : {})}
          >
            <option value="">เลือกห้อง</option>
            {classrooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.grade_name} ห้อง {room.name} ({room.academic_year})
              </option>
            ))}
          </select>
          {errorFor("classroom_id")}
        </label>
        <label className="sch-field">
          ประเภทนักเรียน
          <select
            value={form.student_type_id}
            onChange={set("student_type_id")}
          >
            <option value="">ไม่ระบุ</option>
            {studentTypes
              .filter((type) => type.status === "active" || String(type.id) === String(initial.student_type_id))
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
          </select>
        </label>
        <label className="sch-field">
          คำนำหน้า
          <MasterSelect category="prefix" labelValues value={form.prefix} onChange={set("prefix")} fallback={["ด.ช.","ด.ญ.","นาย","นางสาว"].map(label=>({code:label,label}))}><option value="">ไม่ระบุ</option></MasterSelect>
        </label>
        <label className="sch-field">
          <span>
            ชื่อ
            <RequiredMark />
          </span>
          <input
            required
            maxLength={100}
            value={form.first_name}
            onChange={set("first_name")}
            {...bind("first_name", "กรุณากรอกชื่อ")}
          />
          {errorFor("first_name")}
        </label>
        <label className="sch-field">
          <span>
            นามสกุล
            <RequiredMark />
          </span>
          <input
            required
            maxLength={100}
            value={form.last_name}
            onChange={set("last_name")}
            {...bind("last_name", "กรุณากรอกนามสกุล")}
          />
          {errorFor("last_name")}
        </label>
        <label className="sch-field">
          ชื่อเล่น
          <input
            maxLength={100}
            value={form.nickname}
            onChange={set("nickname")}
          />
        </label>
        <label className="sch-field">
          เพศ
          <MasterSelect category="gender" value={form.gender} onChange={set("gender")} fallback={Object.entries(GENDER_LABELS).map(([code,label])=>({code,label}))}><option value="">ไม่ระบุ</option></MasterSelect>
        </label>
        <ThaiDateField
          label="วันเกิด"
          value={form.birth_date}
          onChange={(iso) =>
            setForm((current) => ({ ...current, birth_date: iso }))
          }
        />
        {isNew && (
          <label className="sch-field">
            เลขบัตรประชาชน (ไม่บังคับ)
            <input
              inputMode="numeric"
              maxLength={13}
              value={form.national_id}
              onChange={(event) =>
                setForm({
                  ...form,
                  national_id: event.target.value
                    .replace(/\D/g, "")
                    .slice(0, 13),
                })
              }
            />
          </label>
        )}
        {(
          <label className="sch-field">
            สถานะ
            <MasterSelect category="student_status" value={form.status} onChange={set("status")} fallback={Object.entries(STUDENT_STATUS_LABELS).filter(([code])=>!["transferred","inactive"].includes(code)).map(([code,label])=>({code,label}))} />
          </label>
        )}
      </form>
    </SchoolModal>
  );
}
