import SchoolManagementNav from "./SchoolManagementNav";
import AcademicYearSelect, { useAcademicYears } from "./AcademicYearSelect";
import api from "../../../services/api";
import SearchableSelect from "../../../components/SearchableSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import { usePageExport } from "../../../components/ExcelExport";
import { useCallback, useEffect, useRef, useState } from "react";
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
            school ? `${school.name} · รหัสโรงเรียน ${school.code}` : undefined
          }
        />
        <SchoolManagementNav />
        {error && (
          <p className="sch-error" role="alert">
            {error}
          </p>
        )}
        {loading && !school && <p className="sch-muted">กำลังโหลด...</p>}
        {school && (
          <SchoolClasses key={school.id} school={school} access={access} />
        )}
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
  const academic = useAcademicYears(school.id);
  const [newYear, setNewYear] = useState("");
  const [yearError, setYearError] = useState("");
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [gradeName, setGradeName] = useState("");
  const [busy, setBusy] = useState(false);
  const [classroomModal, setClassroomModal] = useState(null);
  const [teacherModal, setTeacherModal] = useState(null);
  const loadVersion = useRef(0);
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
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError("");
    try {
      const [gradeRes, roomRes, teacherRes] = await Promise.all([
        getSchoolGrades(school.id),
        getSchoolClassrooms(school.id, { academic_year: year }),
        getSchoolTeachers({ school_id: school.id, status: "active" }),
      ]);
      if (version !== loadVersion.current) return;
      setGrades(gradeRes.data || []);
      setClassrooms(
        (roomRes.data || []).map((room) => ({
          ...room,
          teachers: room.teachers || [],
        })),
      );
      setTeachers(teacherRes.data || []);
    } catch (err) {
      if (version === loadVersion.current)
        setLoadError(
          err.response?.data?.message ||
            "โหลดข้อมูลชั้นเรียนไม่สำเร็จ กรุณาลองใหม่",
        );
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [school.id, year]);

  useEffect(() => {
    load();
    return () => {
      loadVersion.current++;
    };
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
      confirmButtonColor: "var(--suth-action)",
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
      <section
        className="sch-card sch-structure-workspace"
        aria-label="จัดการห้องเรียนตามปีการศึกษา"
      >
        <div className="sch-structure-toolbar">
          <label className="sch-field sch-year-field">
            ปีการศึกษา (พ.ศ.)
            <AcademicYearSelect
              years={academic.years}
              currentYear={academic.current_year}
              value={year}
              onChange={(e) => setYear(e.target.value)}
            />
          </label>
          <div className="sch-structure-context">
            <strong>ห้องเรียนปี {year}</strong>
            <span className="sch-muted">
              {grades.length} ชั้นปี · {classrooms.length} ห้อง · นักเรียน{" "}
              {classrooms.reduce((n, r) => n + Number(r.student_count || 0), 0)}{" "}
              คน
            </span>
          </div>
          {year !== String(academic.current_year) && (
            <button
              className="sch-btn-secondary"
              onClick={() => setYear(String(academic.current_year))}
            >
              กลับปีปัจจุบัน
            </button>
          )}
        </div>
        <div className="sch-structure-filters">
          <label className="sch-field">
            ค้นหาห้องหรือครู
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ชื่อห้อง หรือชื่อครูที่ดูแล"
            />
          </label>
          <label className="sch-field">
            ชั้นปี
            <SearchableSelect
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
            >
              <option value="">ทุกชั้นปี</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <label className="sch-unassigned-toggle">
            <input
              type="checkbox"
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
            />
            เฉพาะห้องที่ยังไม่มีครู (
            {classrooms.filter((r) => !r.teachers.length).length})
          </label>
        </div>
        {loadError && (
          <p className="sch-error" role="alert">
            {loadError}{" "}
            <button className="sch-btn-secondary" onClick={load}>
              โหลดใหม่
            </button>
          </p>
        )}
        {academic.error && (
          <p className="sch-error" role="alert">
            {academic.error}{" "}
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={() =>
                window.dispatchEvent(new Event("school:academic-years"))
              }
            >
              โหลดปีการศึกษาใหม่
            </button>
          </p>
        )}
        {loading && <p role="status">กำลังโหลดห้องเรียน…</p>}
      </section>
      {(access?.can_create_school || access?.can_update_school) && (
        <details className="sch-card sch-structure-settings">
          <summary>ตั้งค่าปีการศึกษาและชั้นปี</summary>
          <p className="sch-muted">
            ชั้นปีใช้ร่วมกันทุกปีการศึกษา ห้องเรียนและครูที่ดูแลจัดแยกตามปี
          </p>
          {access?.can_create_school && (
            <div className="sch-structure-settings-grid">
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setYearError("");
                  if (
                    !/^\d{4}$/.test(newYear) ||
                    Number(newYear) < academic.minimum_year
                  ) {
                    setYearError(
                      `กรุณากรอก พ.ศ. 4 หลัก ตั้งแต่ ${academic.minimum_year}`,
                    );
                    return;
                  }
                  setBusy(true);
                  try {
                    await api.post(
                      `/school/schools/${school.id}/academic-years`,
                      { academic_year: Number(newYear) },
                    );
                    window.dispatchEvent(new Event("school:academic-years"));
                    setNewYear("");
                    await showSuccessToast("เพิ่มปีการศึกษาแล้ว");
                  } catch (err) {
                    setYearError(
                      err.response?.data?.message || "เพิ่มปีการศึกษาไม่สำเร็จ",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="sch-field">
                  ปีการศึกษาใหม่ (พ.ศ.)
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={newYear}
                    onChange={(e) =>
                      setNewYear(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder={String(academic.current_year + 1)}
                    aria-describedby="academic-year-help"
                    required
                  />
                </label>
                <p className="sch-muted" id="academic-year-help">
                  ย้อนหลังได้สูงสุด 10 ปี (ตั้งแต่ {academic.minimum_year})
                  และเพิ่มปีในอนาคตได้
                </p>
                {yearError && (
                  <p role="alert" className="sch-error">
                    {yearError}
                  </p>
                )}
                <button className="sch-btn-secondary" disabled={busy}>
                  <FiPlus aria-hidden="true" /> เพิ่มปีการศึกษา
                </button>
              </form>
              <form onSubmit={addGrade}>
                <label className="sch-field">
                  ชั้นปีใหม่
                  <input
                    placeholder="เช่น ม.1 หรือ ป.4"
                    maxLength={50}
                    value={gradeName}
                    onChange={(e) => setGradeName(e.target.value)}
                    required
                  />
                </label>
                <p className="sch-muted">
                  เพิ่มครั้งเดียว แล้วสร้างห้องแยกในแต่ละปีการศึกษา
                </p>
                <button
                  className="sch-btn-secondary"
                  disabled={busy || !gradeName.trim()}
                >
                  <FiPlus aria-hidden="true" /> เพิ่มชั้นปี
                </button>
              </form>
            </div>
          )}
        </details>
      )}

      {!loading && !loadError && !grades.length && (
        <div className="sch-empty-state">
          <strong>ยังไม่มีชั้นปี</strong>
          <span>
            เปิดตั้งค่าปีการศึกษาและชั้นปีเพื่อเพิ่มชั้นปี แล้วกด &quot;+
            เพิ่มห้อง&quot; ในชั้นปีนั้นเพื่อสร้างห้องเรียน
          </span>
        </div>
      )}

      {!loading &&
        !loadError &&
        grades.length > 0 &&
        !grades.some(
          (grade) =>
            (!gradeFilter || String(grade.id) === gradeFilter) &&
            ((!search.trim() && !unassignedOnly) ||
              classrooms.some(
                (room) =>
                  Number(room.grade_level_id) === Number(grade.id) &&
                  (!unassignedOnly || !room.teachers.length) &&
                  `${grade.name} ${room.name} ${room.teachers.map((t) => t.name).join(" ")}`
                    .toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
              )),
        ) && (
          <div className="sch-empty-state">
            <strong>ไม่พบห้องเรียนตามตัวกรอง</strong>
            <button
              className="sch-btn-secondary"
              onClick={() => {
                setSearch("");
                setGradeFilter("");
                setUnassignedOnly(false);
              }}
            >
              ล้างตัวกรอง
            </button>
          </div>
        )}
      {!loading &&
        !loadError &&
        grades
          .filter((g) => !gradeFilter || String(g.id) === gradeFilter)
          .map((grade) => {
            const rooms = classrooms.filter(
              (room) => Number(room.grade_level_id) === Number(grade.id),
            );
            const visibleRooms = rooms.filter(
              (r) =>
                (!unassignedOnly || !r.teachers.length) &&
                `${grade.name} ${r.name} ${r.teachers.map((t) => t.name).join(" ")}`
                  .toLocaleLowerCase()
                  .includes(search.trim().toLocaleLowerCase()),
            );
            if (!visibleRooms.length && (search.trim() || unassignedOnly))
              return null;
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
                    {loading
                      ? "กำลังโหลด..."
                      : `ยังไม่มีห้องในปีการศึกษา ${year}`}
                  </p>
                ) : (
                  <ul className="sch-room-list">
                    {visibleRooms.map((room) => (
                      <li key={room.id}>
                        <span className="sch-name">
                          ห้อง {room.name}
                          {room.status !== "active" && (
                            <span className="sch-badge status-inactive">
                              ปิด
                            </span>
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
                          {access?.can_assign_school && (
                            <button
                              type="button"
                              className="sch-btn-secondary"
                              aria-label={`กำหนดครู ${grade.name} ห้อง ${room.name}`}
                              title="กำหนดครูที่ดูแล"
                              onClick={() => setTeacherModal(room)}
                            >
                              <FiUsers aria-hidden="true" /> กำหนดครู
                            </button>
                          )}
                          {access?.can_update_school && (
                            <>
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
          years={academic.years}
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

function ClassroomModal({ school, grades, years, initial, onClose, onSaved }) {
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
          <SearchableSelect
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
          </SearchableSelect>
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
          <AcademicYearSelect
            years={years}
            required
            {...bind("academic_year", "กรุณาเลือกปีการศึกษา")}
            value={form.academic_year}
            onChange={(e) =>
              setForm({ ...form, academic_year: e.target.value })
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
                  <SearchableSelect
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
                  </SearchableSelect>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </SchoolModal>
  );
}
