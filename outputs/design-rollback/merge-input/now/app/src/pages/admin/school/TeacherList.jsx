import { Surface as UiSurface, Badge as UiBadge } from '../../../components/ui/index.jsx';
import { Button as UiButton, FilterBar as UiFilterBar, DataTable as UiDataTable, TextInput as UiTextInput } from '../../../components/ui/index.jsx';
import SchoolManagementNav from './SchoolManagementNav';
import SearchableSelect from '../../../components/SearchableSelect';
import {usePageExport} from "../../../components/ExcelExport";
import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiUserCheck } from "react-icons/fi";
import {
  createSchoolTeacher,
  deleteSchoolTeacher,
  getSchoolTeachers,
  getSchoolTypes,
  getTeacherCandidates,
  updateSchoolTeacher,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../../utils/alerts";
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  RequiredMark,
  SchoolModal,
  TableScroll,
  TEACHER_ROLE_LABELS,
  useSchools,
  BarSelect,
  SearchField,
} from "./schoolUi";
import StaffCheckboxPicker from "../../../components/StaffCheckboxPicker";
import "./school.css";

export default function TeacherList() {
  const { schoolAccess: access } = usePermissions();
  const { schools, schoolId } = useSchools();
  const [teacherTypes, setTeacherTypes] = useState([]);
  const [filters, setFilters] = useState({ teacher_type_id: "", search: "" });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    getSchoolTypes("teacher-types")
      .then(({ data }) => setTeacherTypes(data || []))
      .catch(() => setTeacherTypes([]));
  }, []);

  usePageExport({title:"ครู",sources:[{resource:"teachers",filters:{...filters,school_id:schoolId}}],disabled:loading});
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSchoolTeachers({
        school_id: schoolId || undefined,
        teacher_type_id: filters.teacher_type_id || undefined,
        search: filters.search || undefined,
      });
      setRows(data || []);
    } catch (err) {
      await showErrorAlert({ error: err, title: "โหลดรายชื่อครูไม่สำเร็จ" });
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const remove = async (teacher) => {
    if (
      !(await confirmAlert({
        title: `นำ ${teacher.name} ออกจากรายชื่อครู?`,
        text: "บัญชีเจ้าหน้าที่ยังอยู่ แต่จะไม่เห็นนักเรียนในห้องที่เคยดูแลอีก",
        confirmText: "นำออก",
        danger: true,
      }))
    )
      return;
    try {
      await deleteSchoolTeacher(teacher.id);
      await load();
      await showSuccessToast("นำออกจากรายชื่อครูแล้ว");
    } catch (err) {
      await showErrorAlert({ error: err, title: "ดำเนินการไม่สำเร็จ" });
    }
  };

  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="รายชื่อครู"
          description="ครูคือบัญชีเจ้าหน้าที่ที่เป็นสมาชิกของหน่วยงานนี้ เมื่อกำหนดครูให้ห้องเรียน ครูจะเห็นนักเรียนและข้อมูลสุขภาพเฉพาะห้องนั้น"
        >
          {access?.can_create_school && (
            <UiButton variant="primary"
              type="button"
              className="sch-btn"
              disabled={!schools.length}
              onClick={() =>
                setEditing({
                  school_id: schoolId || schools[0]?.id || "",
                  status: "active",
                })
              }
            >
              <FiPlus aria-hidden="true" /> เพิ่มครู
            </UiButton>
          )}
        </PageHeader><SchoolManagementNav />
        <UiSurface as="section" className="sch-card">
          <UiFilterBar className="sch-filter-bar">
            <SearchField
              label="ค้นหาครู"
              placeholder="ค้นหาชื่อ ชื่อผู้ใช้ รหัสครู หรือตำแหน่ง"
              value={filters.search}
              onChange={(value) => setFilters({ ...filters, search: value })}
            />
            <BarSelect
              label="ประเภทครู"
              value={filters.teacher_type_id}
              onChange={(value) =>
                setFilters({ ...filters, teacher_type_id: value })
              }
            >
              <option value="">ทุกประเภทครู</option>
              {teacherTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </BarSelect>
          </UiFilterBar>
          <TableScroll label="ตารางรายชื่อครู">
            <UiDataTable className="sch-table">
              <thead>
                <tr>
                  <th>ครู</th>
                  <th>ประเภท / ตำแหน่ง</th>
                  <th>ห้องที่ดูแล</th>
                  <th>สถานะ</th>
                  <th className="sch-actions-col">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={6} />
                ) : !rows.length ? (
                  <EmptyRow
                    columns={6}
                    icon={FiUserCheck}
                    title="ยังไม่มีครู"
                    hint="เพิ่มครูจากบัญชีเจ้าหน้าที่ที่เป็นสมาชิกของหน่วยงานนี้"
                  />
                ) : (
                  rows.map((teacher) => (
                    <tr key={teacher.id}>
                      <td>
                        <span className="sch-name">{teacher.name}</span>
                        <span className="sch-sub">
                          {teacher.username}
                          {teacher.employee_code
                            ? ` · รหัส ${teacher.employee_code}`
                            : ""}
                        </span>
                      </td>
                      <td>
                        {teacher.teacher_type_name || "-"}
                        {teacher.position && (
                          <span className="sch-sub">{teacher.position}</span>
                        )}
                      </td>
                      <td>
                        {teacher.classrooms.length ? (
                          <div className="sch-chip-list">
                            {teacher.classrooms.map((room) => (
                              <span
                                className="sch-chip"
                                key={room.classroom_id}
                              >
                                {room.grade_name} ห้อง {room.name} (
                                {room.academic_year})
                                {room.role !== "homeroom"
                                  ? ` · ${TEACHER_ROLE_LABELS[room.role]}`
                                  : ""}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="sch-muted">ยังไม่กำหนด</span>
                        )}
                      </td>
                      <td>
                        <UiBadge className={`sch-badge status-${teacher.status}`}>
                          {teacher.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                        </UiBadge>
                      </td>
                      <td>
                        <div className="sch-row-actions">
                          {access?.can_update_school && (
                            <UiButton variant="secondary" size="icon"
                              type="button"
                              className="sch-icon-btn"
                              aria-label={`แก้ไขข้อมูลครู ${teacher.name}`}
                              onClick={() => setEditing({ ...teacher })}
                            >
                              <FiEdit2 aria-hidden="true" />
                            </UiButton>
                          )}
                          {access?.can_delete_school && (
                            <UiButton variant="danger" size="icon"
                              type="button"
                              className="sch-icon-btn sch-danger"
                              aria-label={`นำ ${teacher.name} ออกจากรายชื่อครู`}
                              onClick={() => remove(teacher)}
                            >
                              <FiTrash2 aria-hidden="true" />
                            </UiButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </UiDataTable>
          </TableScroll>
          <p className="sch-muted sch-table-note">
            กำหนดห้องที่ครูดูแลได้ที่เมนู &quot;ชั้นปีและห้องเรียน&quot;
          </p>
        </UiSurface>
        {editing && (
          <TeacherFormModal
            initial={editing}
            teacherTypes={teacherTypes}
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

function TeacherFormModal({ initial, teacherTypes, onClose, onSaved }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({
    school_id: initial.school_id || "",
    teacher_type_id: initial.teacher_type_id || "",
    employee_code: initial.employee_code || "",
    position: initial.position || "",
    phone: initial.phone || "",
    status: initial.status || "active",
  });
  const [candidates, setCandidates] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [pickError, setPickError] = useState("");
  const single = !isNew || picked.size <= 1;

  useEffect(() => {
    if (!isNew || !form.school_id) return;
    getTeacherCandidates(form.school_id)
      .then(({ data }) => setCandidates(data || []))
      .catch(() => setCandidates([]));
  }, [isNew, form.school_id]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...form,
      teacher_type_id: form.teacher_type_id || null,
    };
    if (isNew && !picked.size) {
      setSaving(false);
      setPickError("ติ๊กเลือกบัญชีเจ้าหน้าที่อย่างน้อย 1 คน");
      await showErrorAlert({
        title: "ยังไม่ได้เลือกเจ้าหน้าที่",
        text: "ติ๊กเลือกบัญชีเจ้าหน้าที่อย่างน้อย 1 คน",
      });
      return;
    }
    try {
      if (isNew) {
        const { data } = await createSchoolTeacher({
          ...payload,
          user_ids: [...picked],
          ...(single ? {} : { employee_code: "", phone: "" }),
        });
        await showSuccessToast(
          `เพิ่มครู ${data.ids?.length || 0} คนแล้ว` +
            (data.skipped?.length
              ? ` (ข้าม ${data.skipped.length} คนที่เป็นครูอยู่แล้ว)`
              : ""),
        );
      } else {
        await updateSchoolTeacher(initial.id, payload);
        await showSuccessToast("บันทึกข้อมูลครูแล้ว");
      }
      await onSaved();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกข้อมูลครูไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SchoolModal
      size="small"
      title={isNew ? "เพิ่มครู" : `แก้ไขข้อมูลครู ${initial.name}`}
      onClose={onClose}
      footer={
        <>
          <UiButton variant="secondary" type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </UiButton>
          <UiButton variant="primary"
            type="submit"
            form="teacher-form"
            className="sch-btn"
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </UiButton>
        </>
      }
    >
      <form id="teacher-form" className="sch-form-grid" onSubmit={save}>
        {isNew && (
          <>
            <div className="sch-full">
              <StaffCheckboxPicker
                label={
                  <>
                    บัญชีเจ้าหน้าที่ที่จะเป็นครู
                    <RequiredMark />
                  </>
                }
                required
                error={pickError}
                people={candidates.map((user) => ({
                  id: user.id,
                  name: user.name,
                  username: user.username,
                  hint: user.email || "",
                }))}
                selected={picked}
                onChange={(next) => {
                  setPicked(next);
                  if (next.size) setPickError("");
                }}
                emptyText="ไม่มีบัญชีที่เพิ่มได้ เพิ่มเจ้าหน้าที่เป็นสมาชิกหน่วยงานย่อยนี้ก่อน (เมนูหน่วยงานหลักและหน่วยงานย่อย)"
              />
              {!single && (
                <small className="sch-muted">
                  ประเภทและตำแหน่งจะใช้กับทุกคนที่เลือก
                  รหัสครูและโทรศัพท์แก้ไขรายคนได้ภายหลัง
                </small>
              )}
            </div>
          </>
        )}
        <label className="sch-field">
          ประเภทครู
          <SearchableSelect
            value={form.teacher_type_id}
            onChange={(event) =>
              setForm({ ...form, teacher_type_id: event.target.value })
            }
          >
            <option value="">ไม่ระบุ</option>
            {teacherTypes
              .filter((type) => type.status === "active" || String(type.id) === String(initial.teacher_type_id))
              .map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
          </SearchableSelect>
        </label>
        {single && (
          <label className="sch-field">
            รหัสครู
            <UiTextInput
              maxLength={50}
              value={form.employee_code}
              onChange={(event) =>
                setForm({ ...form, employee_code: event.target.value })
              }
            />
          </label>
        )}
        <label className="sch-field">
          ตำแหน่ง
          <UiTextInput
            maxLength={100}
            value={form.position}
            onChange={(event) =>
              setForm({ ...form, position: event.target.value })
            }
          />
        </label>
        {single && (
          <label className="sch-field">
            โทรศัพท์
            <UiTextInput
              maxLength={32}
              inputMode="tel"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
        )}
        {!isNew && (
          <label className="sch-field">
            สถานะ
            <SearchableSelect
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </SearchableSelect>
          </label>
        )}
      </form>
    </SchoolModal>
  );
}
