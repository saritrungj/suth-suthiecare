import { toDisplayText } from "../../../utils/textPresentation.js";
import { usePageExport } from "../../../components/ExcelExport";
import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2, FiUsers } from "react-icons/fi";
import {
  createSchoolClassroom,
  createSchoolGrade,
  deleteSchoolClassroom,
  deleteSchoolGrade,
  getSchoolClassrooms,
  getSchoolGrades,
  getSchoolTeachers,
  setClassroomTeachers,
  updateSchoolClassroom,
  updateSchoolGrade,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../../utils/alerts";
import {
  PageHeader,
  SchoolModal,
  RequiredMark,
  useFieldErrors,
  TEACHER_ROLE_LABELS,
  currentAcademicYear,
  useSchools,
} from "./schoolUi";
import StaffCheckboxPicker from "../../../components/StaffCheckboxPicker";
import "./school.css";

// The active sub-unit is the school: this page only manages its grade levels
// and the rooms of each grade. The school record and its code are generated.
export default function SchoolStructure() {
  const { schoolAccess: access } = usePermissions();
  const { schools, loading, error } = useSchools();
  const school = schools[0];

  usePageExport({
    title: "โครงสร้างโรงเรียน",
    sources: [
      { resource: "schools" },
      ...(school
        ? [
            { resource: "grades", id: school.id },
            { resource: "classrooms", id: school.id },
          ]
        : []),
    ],
  });
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="ชั้นปีและห้องเรียน"
          description={
            school
              ? `${school.name} · รหัสโรงเรียน ${school.code} (สร้างอัตโนมัติ ใช้นำหน้าชื่อผู้ใช้นักเรียน)`
              : undefined
          }
        />
        {error && (
          <p className="sch-error" role="alert">
            {error}
          </p>
        )}
        {loading && !school && <p className="sch-muted">กำลังโหลด...</p>}
        {school && <SchoolClasses school={school} access={access} />}
      </main>
    </div>
  );
}

const validYear = (year) => /^\d{4}$/.test(year);

function SchoolClasses({ school, access }) {
  const [grades, setGrades] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [year, setYear] = useState(String(currentAcademicYear()));
  const [loading, setLoading] = useState(true);
  const [gradeName, setGradeName] = useState("");
  const [busy, setBusy] = useState(false);
  const [classroomModal, setClassroomModal] = useState(null);
  const [teacherModal, setTeacherModal] = useState(null);
  usePageExport({
    priority: 1,
    title: "โครงสร้างโรงเรียน",
    sources: [
      { resource: "schools" },
      { resource: "grades", id: school.id },
      {
        resource: "classrooms",
        id: school.id,
        filters: { academic_year: year },
      },
    ],
    disabled: loading,
  });

  const load = useCallback(async () => {
    if (!validYear(year)) return;
    setLoading(true);
    try {
      const [gradeRes, roomRes, teacherRes] = await Promise.all([
        getSchoolGrades(school.id),
        getSchoolClassrooms(school.id, { academic_year: year }),
        getSchoolTeachers({ school_id: school.id, status: "active" }),
      ]);
      setGrades(gradeRes.data || []);
      setClassrooms(roomRes.data || []);
      setTeachers(teacherRes.data || []);
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "โหลดข้อมูลชั้นเรียนไม่สำเร็จ",
      });
    } finally {
      setLoading(false);
    }
  }, [school.id, year]);

  useEffect(() => {
    load();
  }, [load]);

  const addGrade = async (event) => {
    event.preventDefault();
    if (!gradeName.trim()) return;
    setBusy(true);
    try {
      await createSchoolGrade(school.id, {
        name: gradeName.trim(),
        level_order: grades.length + 1,
      });
      setGradeName("");
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "เพิ่มชั้นปีไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const addRoom = async (grade) => {
    setBusy(true);
    try {
      const { data } = await createSchoolClassroom(school.id, {
        grade_level_id: grade.id,
        academic_year: year,
      });
      await load();
      await showSuccessToast(`เพิ่ม ${grade.name} ห้อง ${data.name} แล้ว`);
    } catch (err) {
      await showErrorAlert({ error: err, title: "เพิ่มห้องเรียนไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const renameGrade = async (grade) => {
    const { default: Swal } = await import("sweetalert2");
    const result = await Swal.fire({
      title: "แก้ไขชื่อชั้นปี",
      input: "text",
      inputValue: grade.name,
      showCancelButton: true,
      confirmButtonText: "บันทึก",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#c2410c",
    });
    if (!result.isConfirmed || !result.value?.trim()) return;
    try {
      await updateSchoolGrade(grade.id, {
        name: result.value.trim(),
        level_order: grade.level_order,
        status: grade.status,
      });
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "แก้ไขชั้นปีไม่สำเร็จ" });
    }
  };

  const removeGrade = async (grade) => {
    if (
      !(await confirmAlert({
        title: `ลบชั้นปี ${grade.name}?`,
        text: "ลบได้เฉพาะชั้นปีที่ยังไม่มีห้องเรียนในทุกปีการศึกษา",
        confirmText: "ลบ",
        danger: true,
      }))
    )
      return;
    try {
      await deleteSchoolGrade(grade.id);
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "ลบชั้นปีไม่สำเร็จ" });
    }
  };

  const removeClassroom = async (room) => {
    if (
      !(await confirmAlert({
        title: `ลบ ${room.grade_name} ห้อง ${room.name}?`,
        text: "ลบได้เฉพาะห้องที่ยังไม่มีนักเรียน",
        confirmText: "ลบห้อง",
        danger: true,
      }))
    )
      return;
    try {
      await deleteSchoolClassroom(room.id);
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "ลบห้องเรียนไม่สำเร็จ" });
    }
  };

  return (
    <>
      <section className="sch-card sch-structure-bar">
        <label className="sch-field sch-year-field">
          ปีการศึกษา (พ.ศ.)
          <input
            inputMode="numeric"
            value={year}
            aria-invalid={!validYear(year)}
            onChange={(event) =>
              setYear(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
          />
        </label>
        {access?.can_create_school && (
          <form className="sch-add-grade" onSubmit={addGrade}>
            <label className="sch-field">
              ชั้นปีใหม่
              <input
                placeholder="เช่น ม.1 หรือ ป.4"
                maxLength={50}
                value={gradeName}
                onChange={(event) => setGradeName(event.target.value)}
              />
            </label>
            <button
              className="sch-btn"
              type="submit"
              disabled={busy || !gradeName.trim()}
            >
              <FiPlus aria-hidden="true" /> เพิ่มชั้นปี
            </button>
          </form>
        )}
      </section>

      {!loading && !grades.length && (
        <div className="sch-empty-state">
          <strong>ยังไม่มีชั้นปี</strong>
          <span>
            เพิ่มชั้นปีด้านบน แล้วกด &quot;+ เพิ่มห้อง&quot;
            ในชั้นปีนั้นเพื่อสร้างห้องเรียน
          </span>
        </div>
      )}

      {grades.map((grade) => {
        const rooms = classrooms.filter(
          (room) => Number(room.grade_level_id) === Number(grade.id),
        );
        const students = rooms.reduce(
          (sum, room) => sum + Number(room.student_count || 0),
          0,
        );
        return (
          <section
            className="sch-card sch-grade"
            key={grade.id}
            aria-labelledby={`grade-${grade.id}`}
          >
            <div className="sch-card-head">
              <div className="sch-grade-title">
                <h2 id={`grade-${grade.id}`}>{grade.name}</h2>
                <span className="sch-muted">
                  {rooms.length} ห้อง · นักเรียน {students} คน
                </span>
              </div>
              <div className="sch-row-actions">
                {access?.can_create_school && (
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    disabled={busy || !validYear(year)}
                    onClick={() => addRoom(grade)}
                  >
                    <FiPlus aria-hidden="true" /> เพิ่มห้อง
                  </button>
                )}
                {access?.can_update_school && (
                  <button
                    type="button"
                    className="sch-icon-btn"
                    onClick={() => renameGrade(grade)}
                    aria-label={`แก้ไขชื่อชั้นปี ${grade.name}`}
                  >
                    <FiEdit2 aria-hidden="true" />
                  </button>
                )}
                {access?.can_delete_school && (
                  <button
                    type="button"
                    className="sch-icon-btn sch-danger"
                    onClick={() => removeGrade(grade)}
                    aria-label={`ลบชั้นปี ${grade.name}`}
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {!rooms.length ? (
              <p className="sch-muted sch-grade-empty">
                {loading ? "กำลังโหลด..." : `ยังไม่มีห้องในปีการศึกษา ${year}`}
              </p>
            ) : (
              <ul className="sch-room-list">
                {rooms.map((room) => (
                  <li key={room.id}>
                    <span className="sch-name">
                      ห้อง {room.name}
                      {room.status !== "active" && (
                        <span className="sch-badge status-inactive">ปิด</span>
                      )}
                    </span>
                    <span className="sch-muted">
                      นักเรียน {room.student_count}
                      {room.capacity ? `/${room.capacity}` : ""} คน
                    </span>
                    <span className="sch-room-teachers">
                      {room.teachers.length ? (
                        room.teachers
                          .map(
                            (t) =>
                              `${t.name} (${TEACHER_ROLE_LABELS[t.role] || t.role})`,
                          )
                          .join(", ")
                      ) : (
                        <span className="sch-muted">ยังไม่กำหนดครู</span>
                      )}
                    </span>
                    <span className="sch-row-actions">
                      {access?.can_update_school && (
                        <>
                          <button
                            type="button"
                            className="sch-icon-btn"
                            aria-label={`กำหนดครู ${grade.name} ห้อง ${room.name}`}
                            title="กำหนดครูที่ดูแล"
                            onClick={() => setTeacherModal(room)}
                          >
                            <FiUsers aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="sch-icon-btn"
                            aria-label={`แก้ไข ${grade.name} ห้อง ${room.name}`}
                            title="แก้ไขห้อง"
                            onClick={() => setClassroomModal({ ...room })}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </button>
                        </>
                      )}
                      {access?.can_delete_school && (
                        <button
                          type="button"
                          className="sch-icon-btn sch-danger"
                          aria-label={`ลบ ${grade.name} ห้อง ${room.name}`}
                          title="ลบห้อง"
                          onClick={() => removeClassroom(room)}
                        >
                          <FiTrash2 aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {classroomModal && (
        <ClassroomModal
          school={school}
          grades={grades}
          initial={classroomModal}
          onClose={() => setClassroomModal(null)}
          onSaved={async () => {
            setClassroomModal(null);
            await load();
          }}
        />
      )}
      {teacherModal && (
        <ClassroomTeachersModal
          room={teacherModal}
          teachers={teachers}
          onClose={() => setTeacherModal(null)}
          onSaved={async () => {
            setTeacherModal(null);
            await load();
          }}
        />
      )}
    </>
  );
}

function ClassroomModal({ school, grades, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    grade_level_id: initial.grade_level_id,
    name: initial.name || "",
    academic_year: initial.academic_year,
    capacity: initial.capacity ?? "",
    status: initial.status || "active",
  });
  const [saving, setSaving] = useState(false);
  const { bind, errorFor } = useFieldErrors();
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (initial.id) await updateSchoolClassroom(initial.id, form);
      else await createSchoolClassroom(school.id, form);
      await showSuccessToast("บันทึกห้องเรียนแล้ว");
      await onSaved();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกห้องเรียนไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      size="small"
      title={initial.id ? "แก้ไขห้องเรียน" : "เพิ่มห้องเรียน"}
      subtitle={school.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="submit"
            form="classroom-form"
            className="sch-btn"
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </>
      }
    >
      <form id="classroom-form" className="sch-form-grid" onSubmit={save}>
        <label className="sch-field">
          <span>
            ชั้นปี
            <RequiredMark />
          </span>
          <select
            required
            {...bind("grade_level_id", "กรุณาเลือกชั้นปี")}
            value={form.grade_level_id}
            onChange={(event) =>
              setForm({ ...form, grade_level_id: event.target.value })
            }
          >
            {grades.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
          {errorFor("grade_level_id")}
        </label>
        <label className="sch-field">
          <span>
            ชื่อห้อง
            <RequiredMark />
          </span>
          <input
            required
            {...bind("name", "กรุณากรอกชื่อห้อง")}
            maxLength={50}
            placeholder="เช่น 1"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          {errorFor("name")}
        </label>
        <label className="sch-field">
          <span>
            ปีการศึกษา (พ.ศ.)
            <RequiredMark />
          </span>
          <input
            required
            {...bind("academic_year", "กรุณากรอกปีการศึกษา")}
            inputMode="numeric"
            value={form.academic_year}
            onChange={(event) =>
              setForm({
                ...form,
                academic_year: event.target.value
                  .replace(/\D/g, "")
                  .slice(0, 4),
              })
            }
          />
          {errorFor("academic_year")}
        </label>
        <label className="sch-field">
          จำนวนที่นั่ง (ไม่บังคับ)
          <input
            inputMode="numeric"
            value={form.capacity}
            onChange={(event) =>
              setForm({
                ...form,
                capacity: event.target.value.replace(/\D/g, "").slice(0, 4),
              })
            }
          />
        </label>
        {initial.id && (
          <label className="sch-field">
            สถานะ
            <select
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value })
              }
            >
              <option value="active">ใช้งาน</option>
              <option value="inactive">ปิดใช้งาน</option>
            </select>
          </label>
        )}
      </form>
    </SchoolModal>
  );
}

function ClassroomTeachersModal({ room, teachers, onClose, onSaved }) {
  const [assigned, setAssigned] = useState(
    () => new Map(room.teachers.map((t) => [t.teacher_id, t.role])),
  );
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await setClassroomTeachers(
        room.id,
        [...assigned.entries()].map(([teacher_id, role]) => ({
          teacher_id,
          role,
        })),
      );
      await showSuccessToast("กำหนดครูประจำห้องแล้ว");
      await onSaved();
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "บันทึกครูประจำห้องไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      size="small"
      title={`ครูที่ดูแลห้อง ${room.grade_name} ห้อง ${room.name}`}
      subtitle="ครูที่ถูกกำหนดจะเห็นนักเรียนและข้อมูลสุขภาพของห้องนี้"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="sch-btn"
            onClick={save}
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </>
      }
    >
      <StaffCheckboxPicker
        label="ครูของโรงเรียนนี้"
        people={teachers.map((teacher) => ({
          id: teacher.id,
          name: teacher.name,
          username: teacher.username,
          hint: teacher.teacher_type_name || "",
        }))}
        selected={new Set(assigned.keys())}
        onChange={(next) =>
          setAssigned((current) => {
            const updated = new Map();
            next.forEach((id) =>
              updated.set(id, current.get(id) || "homeroom"),
            );
            return updated;
          })
        }
        emptyText='โรงเรียนนี้ยังไม่มีครู เพิ่มครูได้ที่เมนู "ครู"'
      />
      {assigned.size > 0 && (
        <div className="sch-section sch-stack-top">
          <h3>บทบาทในห้องนี้</h3>
          <ul className="sch-role-list">
            {[...assigned.entries()].map(([teacherId, role]) => {
              const teacher = teachers.find((item) => item.id === teacherId);
              return (
                <li key={teacherId}>
                  <span className="sch-name">{teacher?.name || "-"}</span>
                  <select
                    aria-label={`บทบาทของ ${teacher?.name || "ครู"}`}
                    value={role}
                    onChange={(event) =>
                      setAssigned((current) =>
                        new Map(current).set(teacherId, event.target.value),
                      )
                    }
                  >
                    {Object.entries(TEACHER_ROLE_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {toDisplayText(label)}
                        </option>
                      ),
                    )}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SchoolModal>
  );
}
