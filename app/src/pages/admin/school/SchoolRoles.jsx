import SchoolManagementNav from "./SchoolManagementNav";
import SearchableSelect from "../../../components/SearchableSelect";
import { toDisplayText } from "../../../utils/textPresentation.js";
import GuardianAccountForm from "./GuardianAccountForm";
import { useEffect, useState } from "react";
import api from "../../../services/api";
import {
  BarSelect,
  PageHeader,
  SchoolModal,
  SearchField,
  TableScroll,
} from "./schoolUi";
import { usePageExport } from "../../../components/ExcelExport";
import "./school.css";
import TablePagination from "../../../components/table/TablePagination";
import usePagedRows from "../../../components/table/usePagedRows";
import DataPanel from "../../../components/table/DataPanel";
import ResultSummary from "../../../components/table/ResultSummary";
import { usePermissions } from "../../../permissions/PermissionsProvider";
const TEACHER_ROLE_CODES = ["counselor", "homeroom", "other"];

export default function SchoolRoles({ embedded = false }) {
  const Container = embedded ? "section" : "main";
  // Staff actions from the roles page: update roles, delete = revoke,
  // assign = link guardians to students, create = guardian accounts.
  const { schoolAccess } = usePermissions();
  // Duties follow the person's kind, as in the Add User modal: teachers (a
  // school_teachers record) get teacher duties, everyone else staff duties.
  const isTeacher = (schoolId, userId) =>
    (data?.teachers || []).some(
      (t) =>
        String(t.school_id) === String(schoolId) &&
        String(t.user_id) === String(userId),
    );
  const allowedRoleCodes = (schoolId, userId) => {
    const codes = Object.keys(data?.role_labels || {});
    if (!data?.teachers || !userId) return codes;
    const teacher = isTeacher(schoolId, userId);
    return codes.filter(
      (code) =>
        code === "guardian" || TEACHER_ROLE_CODES.includes(code) === teacher,
    );
  };
  const staff = schoolAccess?.staff_actions || {};
  const [creating, setCreating] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false),
    [search, setSearch] = useState(""),
    [roleFilter, setRoleFilter] = useState("");
  const [data, setData] = useState(null),
    [form, setForm] = useState({
      school_id: "",
      user_id: "",
      role_code: "other",
      status: "active",
      student_ids: [],
    }),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  usePageExport({
    title: "บทบาทโรงเรียน",
    sources: [{ resource: "school_roles" }],
  });
  const load = async () => {
    const { data } = await api.get("/school/staff-roles");
    setData(data);
    setForm((old) => ({
      ...old,
      school_id: old.school_id || String(data.schools[0]?.id || ""),
    }));
  };
  useEffect(() => {
    load().catch((e) =>
      setError(e.response?.data?.message || "โหลดบทบาทไม่สำเร็จ"),
    );
  }, []);
  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.put("/school/staff-roles", {
        ...form,
        school_id: Number(form.school_id),
        user_id: Number(form.user_id),
      });
      await load();
      setEditorOpen(false);
      setNotice("บันทึกบทบาทและนักเรียนในความดูแลเรียบร้อยแล้ว");
    } catch (e) {
      setError(e.response?.data?.message || "บันทึกบทบาทไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const memberName = (id) => {
    const member = data?.members.find((m) => m.id === id);
    return member?.name || member?.username || id;
  };
  const shown = (data?.roles || []).filter(
    (r) =>
      (!roleFilter || r.role_code === roleFilter) &&
      `${memberName(r.user_id)} ${data?.members.find((m) => m.id === r.user_id)?.username || ""} ${data?.role_labels[r.role_code] || ""} ${data?.schools.find((s) => s.id === r.school_id)?.name || ""}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  const { pageRows, pagination, setPage, setLimit } = usePagedRows(shown, {
    resetKeys: [search, roleFilter],
  });
  return (
    <div className="sch-wrapper">
      <Container className="sch-page">
        <PageHeader
          title="บุคลากรและผู้ปกครองของโรงเรียน"
          description="เปลี่ยนหรือยกเลิกหน้าที่ของสมาชิกในโรงเรียน และสร้างบัญชีผู้ปกครองพร้อมนักเรียนในความดูแล สิทธิ์ใช้งานมาจากบทบาทที่ผู้ดูแลระบบกำหนด"
        >
          {data && (staff.update || staff.assign) && (
            <button
              className="sch-btn"
              onClick={() => {
                setForm({
                  school_id: String(data.schools[0]?.id || ""),
                  user_id: "",
                  role_code: "other",
                  status: "active",
                  student_ids: [],
                });
                setEditorOpen(true);
              }}
            >
              กำหนดบทบาทสมาชิก
            </button>
          )}
          {data && staff.create && (
            <button
              className="sch-btn-secondary"
              onClick={() => setCreating(true)}
            >
              สร้างบัญชีผู้ปกครอง
            </button>
          )}
        </PageHeader>
        {!embedded && <SchoolManagementNav />}
        <details className="sch-card sch-role-guide">
          <summary>ขอบเขตของแต่ละบทบาท</summary>
          <TableScroll label="สิทธิ์แต่ละบทบาท">
            <table className="sch-table admin-data-table">
              <thead>
                <tr>
                  <th>บทบาท</th>
                  <th>ขอบเขตข้อมูล</th>
                  <th>ข้อมูลเชิงลึก</th>
                  <th>ส่งออก</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ผู้ปกครอง</td>
                  <td>เฉพาะนักเรียนที่ผูกกับบัญชี</td>
                  <td>
                    ดูข้อมูลทั่วไป สุขภาพ และข้อมูลเชิงลึกได้ทั้งหมด
                    อ่านอย่างเดียว
                  </td>
                  <td>ไม่มี</td>
                </tr>
                <tr>
                  <td>ผู้ดูแลโรงเรียน</td>
                  <td>ทั้งโรงเรียน จัดการครู นักเรียน และข้อมูลหลัก</td>
                  <td>ไม่เห็น</td>
                  <td>ข้อมูลทั่วไป</td>
                </tr>
                <tr>
                  <td>ครูแนะแนว</td>
                  <td>ทั้งโรงเรียน</td>
                  <td>อ่านและแก้ไข</td>
                  <td>ข้อมูลทั่วไปและเชิงลึก</td>
                </tr>
                <tr>
                  <td>ครูประจำชั้น</td>
                  <td>ห้องที่รับผิดชอบ</td>
                  <td>อ่านและแก้ไข</td>
                  <td>เฉพาะห้องที่รับผิดชอบ</td>
                </tr>
                <tr>
                  <td>ครูอื่น</td>
                  <td>ตามสิทธิ์ที่ได้รับ</td>
                  <td>ไม่เห็น</td>
                  <td>ตามสิทธิ์ทั่วไป</td>
                </tr>
                <tr>
                  <td>แอดมินสุขภาพจิต</td>
                  <td>ทั้งโรงเรียน จัดการเจ้าหน้าที่และข้อมูลทั่วไป</td>
                  <td>สุขภาพจิตและสุขภาพกาย</td>
                  <td>ตามสิทธิ์ส่งออกที่ได้รับ</td>
                </tr>
                <tr>
                  <td>แอดมินสุขภาพกาย</td>
                  <td>ทั้งโรงเรียน</td>
                  <td>เฉพาะสุขภาพกาย</td>
                  <td>ตามสิทธิ์ส่งออกที่ได้รับ</td>
                </tr>
                <tr>
                  <td>เจ้าหน้าที่หอพัก</td>
                  <td>เฉพาะนักเรียนหอพักในโรงเรียนที่รับผิดชอบ</td>
                  <td>ไม่เห็น</td>
                  <td>ตามสิทธิ์ส่งออกที่ได้รับ</td>
                </tr>
              </tbody>
            </table>
          </TableScroll>
          <p className="sch-muted">
            ผู้ดูแลระบบเข้าถึงข้อมูลทุกหน่วยงานได้
            ครูประจำชั้นต้องได้รับมอบหมายห้องในหน้าโครงสร้างโรงเรียนด้วย
          </p>
        </details>
        {error && (
          <div className="sch-card">
            <p className="sch-error" role="alert">
              {error}
            </p>
            <button
              type="button"
              className="sch-btn-secondary"
              disabled={saving}
              onClick={() => {
                setError("");
                load().catch((e) =>
                  setError(e.response?.data?.message || "โหลดบทบาทไม่สำเร็จ"),
                );
              }}
            >
              โหลดใหม่
            </button>
          </div>
        )}
        {!data && !error && <p role="status">กำลังโหลด…</p>}
        {notice && (
          <p className="sch-card" role="status">
            {notice}
          </p>
        )}
        {data && (
          <>
            {editorOpen && (
              <SchoolModal
                title={form.user_id ? "แก้ไขบทบาทสมาชิก" : "กำหนดบทบาทสมาชิก"}
                size="small"
                onClose={() => {
                  if (!saving) setEditorOpen(false);
                }}
              >
                <section>
                  {error && (
                    <p className="sch-error" role="alert">
                      {error}
                    </p>
                  )}
                  <form className="sch-management-form" onSubmit={save}>
                    <h2>กำหนดบทบาทสมาชิก</h2>
                    <p className="sch-full sch-muted">
                      สร้างบัญชีผู้ปกครองพร้อมรหัสผ่านด้วยปุ่มด้านบน
                      หรือเลือกสมาชิกเดิมเพื่อกำหนดบทบาทและนักเรียนในความดูแลที่นี่
                    </p>
                    <label className="sch-field">
                      โรงเรียน
                      <SearchableSelect
                        disabled={saving}
                        aria-label="โรงเรียน"
                        required
                        value={form.school_id}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            school_id: e.target.value,
                            user_id: "",
                            role_code: "other",
                            status: "active",
                            student_ids: [],
                          })
                        }
                      >
                        <option value="">เลือกโรงเรียน</option>
                        {data.schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>
                    <label className="sch-field">
                      สมาชิก
                      <SearchableSelect
                        disabled={saving}
                        aria-label="สมาชิก"
                        required
                        value={form.user_id}
                        onChange={(e) => {
                          const r = data.roles.find(
                            (r) =>
                              String(r.user_id) === e.target.value &&
                              String(r.school_id) === form.school_id,
                          );
                          const allowed = allowedRoleCodes(
                            form.school_id,
                            e.target.value,
                          );
                          setForm({
                            ...form,
                            user_id: e.target.value,
                            role_code:
                              r?.role_code && allowed.includes(r.role_code)
                                ? r.role_code
                                : allowed.find((code) => code !== "guardian") ||
                                  "other",
                            status: r?.status || "active",
                            student_ids: (data.guardians || [])
                              .filter(
                                (g) =>
                                  String(g.user_id) === e.target.value &&
                                  String(g.school_id) === form.school_id,
                              )
                              .map((g) => g.student_id),
                          });
                        }}
                      >
                        <option value="">เลือกสมาชิก</option>
                        {data.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.username}
                          </option>
                        ))}
                      </SearchableSelect>
                    </label>
                    <label className="sch-field">
                      บทบาท
                      <SearchableSelect
                        disabled={saving}
                        aria-label="บทบาท"
                        value={form.role_code}
                        onChange={set("role_code")}
                      >
                        {allowedRoleCodes(form.school_id, form.user_id).map(
                          (code) => (
                            <option key={code} value={code}>
                              {toDisplayText(data.role_labels[code])}
                            </option>
                          ),
                        )}
                      </SearchableSelect>
                    </label>
                    <label className="sch-field">
                      สถานะ
                      <SearchableSelect
                        disabled={saving}
                        aria-label="สถานะ"
                        value={form.status}
                        onChange={set("status")}
                      >
                        <option value="active">ใช้งาน</option>
                        <option value="inactive" disabled={!staff.delete}>
                          ถอนบทบาท
                        </option>
                      </SearchableSelect>
                    </label>
                    {form.role_code === "guardian" && (
                      <fieldset
                        className="sch-full guardian-students-fieldset"
                        disabled={saving}
                      >
                        <legend>นักเรียนในความดูแล</legend>
                        <p className="sch-muted">
                          เลือกได้หลายคน
                          ผู้ปกครองจะเห็นเฉพาะนักเรียนที่เลือกในโรงเรียนนี้
                        </p>
                        {(data.students || [])
                          .filter((s) => String(s.school_id) === form.school_id)
                          .map((s) => (
                            <label
                              key={s.id}
                              className="guardian-student-option"
                            >
                              <input
                                type="checkbox"
                                checked={form.student_ids.includes(s.id)}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    student_ids: e.target.checked
                                      ? [...form.student_ids, s.id]
                                      : form.student_ids.filter(
                                          (id) => id !== s.id,
                                        ),
                                  })
                                }
                              />
                              รหัสนักเรียน {s.student_code}
                            </label>
                          ))}
                        {!(data.students || []).some(
                          (s) => String(s.school_id) === form.school_id,
                        ) && (
                          <p>
                            ยังไม่มีนักเรียนในโรงเรียนนี้ กรุณาเพิ่มนักเรียนก่อน
                          </p>
                        )}
                      </fieldset>
                    )}
                    <button
                      className="sch-btn sch-btn-primary"
                      disabled={saving}
                    >
                      {saving ? "กำลังบันทึก…" : "บันทึกบทบาท"}
                    </button>
                  </form>
                </section>
              </SchoolModal>
            )}
            <DataPanel className="sch-card">
              <h2 className="dz-section__title">บทบาทสมาชิก</h2>
              <div className="sch-filter-bar">
                <SearchField
                  label="ค้นหาสมาชิก"
                  placeholder="ชื่อสมาชิก ชื่อผู้ใช้ หรือบทบาท"
                  value={search}
                  onChange={setSearch}
                />
                <BarSelect
                  label="บทบาท"
                  value={roleFilter}
                  onChange={setRoleFilter}
                >
                  <option value="">ทุกบทบาท</option>
                  {Object.entries(data.role_labels).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </BarSelect>
              </div>
              <ResultSummary
                pagination={pagination}
                chips={[
                  {
                    key: "role",
                    label: "บทบาท",
                    value: roleFilter
                      ? data.role_labels[roleFilter] || roleFilter
                      : "",
                    onRemove: () => setRoleFilter(""),
                  },
                ]}
              />
              <TableScroll label="บทบาทสมาชิก">
                <table className="sch-table admin-data-table">
                  <thead>
                    <tr>
                      <th>โรงเรียน</th>
                      <th>สมาชิก</th>
                      <th>บทบาท</th>
                      <th>สถานะ</th>
                      <th className="is-actions">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!shown.length && (
                      <tr>
                        <td colSpan={5}>
                          ไม่พบบทบาทสมาชิก กดกำหนดบทบาทสมาชิกเพื่อเพิ่ม
                          หรือล้างตัวกรอง
                        </td>
                      </tr>
                    )}
                    {pageRows.map((r) => (
                      <tr key={`${r.school_id}-${r.user_id}`}>
                        <td>
                          {data.schools.find((s) => s.id === r.school_id)?.name}
                        </td>
                        <td>{memberName(r.user_id)}</td>
                        <td>{data.role_labels[r.role_code]}</td>
                        <td>{r.status === "active" ? "ใช้งาน" : "ถอนบทบาท"}</td>
                        <td className="is-actions">
                          <button
                            type="button"
                            disabled={saving}
                            hidden={
                              !(staff.update || staff.assign || staff.delete)
                            }
                            className="sch-btn sch-btn-secondary"
                            onClick={() => {
                              setEditorOpen(true);
                              setForm({
                                school_id: String(r.school_id),
                                user_id: String(r.user_id),
                                role_code: r.role_code,
                                status: r.status,
                                student_ids: (data.guardians || [])
                                  .filter(
                                    (g) =>
                                      g.user_id === r.user_id &&
                                      g.school_id === r.school_id,
                                  )
                                  .map((g) => g.student_id),
                              });
                            }}
                          >
                            แก้ไข
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
              <TablePagination
                page={pagination.page}
                totalPages={pagination.total_pages}
                total={pagination.total}
                limit={pagination.limit}
                onPage={setPage}
                onLimit={setLimit}
              />
            </DataPanel>
          </>
        )}
        {creating && data && (
          <GuardianAccountForm
            data={data}
            onClose={() => setCreating(false)}
            onCreated={async (result) => {
              await load();
              setNotice(
                `สร้างบัญชีผู้ปกครอง ${result.username} เรียบร้อยแล้ว สามารถเข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านที่กำหนด`,
              );
            }}
          />
        )}
      </Container>
    </div>
  );
}
