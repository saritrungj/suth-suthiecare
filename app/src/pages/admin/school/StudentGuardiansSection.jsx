// Guardian sign-in accounts of one student, on the general tab. Staff with
// the school staff rights on the roles page see them (view), create a new
// account for this student (create), or link an account the school already
// has, e.g. a sibling's guardian, and unlink (assign). Guardians sign in on
// the staff sign-in page with the username and password set here; in
// production a code is also sent to the account's email.
import { useCallback, useEffect, useState } from "react";
import { FiLink, FiShield, FiUserPlus, FiX } from "react-icons/fi";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  addStudentGuardian,
  getStudentGuardians,
  removeStudentGuardian,
} from "../../../services/api";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../../utils/alerts";

const emptyAccount = { username: "", name: "", email: "", password: "" };
// A readable temporary password the staff member passes on to the family.
const randomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("") + "#9";
};

export default function StudentGuardiansSection({ student }) {
  const { schoolAccess } = usePermissions();
  const canView =
    !schoolAccess?.is_guardian && Boolean(schoolAccess?.staff_actions?.view);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState(null); // "create" | "link"
  const [account, setAccount] = useState(emptyAccount);
  const [linkName, setLinkName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: result } = await getStudentGuardians(student.id);
      // An unexpected answer hides the section instead of breaking the file.
      setData(Array.isArray(result?.guardians) ? result : null);
    } catch {
      setData(null);
    }
  }, [student.id]);
  useEffect(() => {
    if (canView) load();
  }, [canView, load]);
  if (!canView || !data) return null;

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      if (mode === "link") {
        await addStudentGuardian(student.id, {
          link_username: linkName.trim(),
        });
        await showSuccessToast("เชื่อมบัญชีผู้ปกครองแล้ว");
      } else {
        await addStudentGuardian(student.id, account);
        await showSuccessToast(
          `สร้างบัญชี ${account.username} แล้ว แจ้งชื่อผู้ใช้และรหัสผ่านให้ผู้ปกครอง`,
        );
      }
      setMode(null);
      setAccount(emptyAccount);
      setLinkName("");
      await load();
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "บันทึกบัญชีผู้ปกครองไม่สำเร็จ",
      });
    } finally {
      setSaving(false);
    }
  };
  const unlink = async (guardian) => {
    if (
      !(await confirmAlert({
        title: `ยกเลิกการเชื่อม ${guardian.name}?`,
        text: "ผู้ปกครองจะไม่เห็นข้อมูลของนักเรียนคนนี้อีก บัญชียังใช้กับนักเรียนคนอื่นที่เชื่อมไว้ได้",
        confirmText: "ยกเลิกการเชื่อม",
        danger: true,
      }))
    )
      return;
    try {
      await removeStudentGuardian(student.id, guardian.id);
      await load();
    } catch (err) {
      await showErrorAlert({ error: err, title: "ยกเลิกการเชื่อมไม่สำเร็จ" });
    }
  };
  const field = (key, label, props = {}) => (
    <label className="sch-field">
      {label}
      <input
        required
        value={account[key]}
        disabled={saving}
        onChange={(e) => setAccount({ ...account, [key]: e.target.value })}
        {...props}
      />
    </label>
  );

  return (
    <section className="sch-section cw-fact-group sch-guardians">
      <h3>
        <FiShield aria-hidden="true" /> บัญชีผู้ปกครองสำหรับเข้าระบบ
      </h3>
      <p className="sch-muted">
        ผู้ปกครองเข้าระบบที่หน้าเข้าสู่ระบบเจ้าหน้าที่ เห็นเฉพาะข้อมูลทั่วไป
        สุขภาพกาย และผลประเมินของบุตรหลานที่เชื่อมไว้
        ไม่เห็นบันทึกของครูแนะแนวและการส่งต่อ และแก้ไขข้อมูลไม่ได้
      </p>
      {data.guardians.length ? (
        <ul className="sch-guardian-list">
          {data.guardians.map((g) => (
            <li key={g.id}>
              <span>
                <strong>{g.name}</strong>
                <span className="sch-sub">
                  ชื่อผู้ใช้ {g.username}
                  {!g.active ? " · ปิดใช้งาน" : ""}
                </span>
              </span>
              {data.can_assign && (
                <button
                  type="button"
                  className="sch-btn-ghost"
                  aria-label={`ยกเลิกการเชื่อม ${g.name}`}
                  onClick={() => unlink(g)}
                >
                  <FiX aria-hidden="true" /> ยกเลิกการเชื่อม
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="sch-muted">ยังไม่มีบัญชีผู้ปกครองของนักเรียนคนนี้</p>
      )}
      {!mode && (data.can_create || data.can_assign) && (
        <div className="sch-form-actions">
          {data.can_create && (
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={() => {
                setAccount({ ...emptyAccount, password: randomPassword() });
                setMode("create");
              }}
            >
              <FiUserPlus aria-hidden="true" /> สร้างบัญชีผู้ปกครอง
            </button>
          )}
          {data.can_assign && (
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={() => setMode("link")}
            >
              <FiLink aria-hidden="true" /> เชื่อมบัญชีที่มีอยู่ (เช่น พี่น้อง)
            </button>
          )}
        </div>
      )}
      {mode && (
        <form className="sch-insights-form sch-care-form" onSubmit={submit}>
          {mode === "link" ? (
            <label className="sch-field sch-insights-wide">
              ชื่อผู้ใช้ของบัญชีผู้ปกครองที่มีอยู่
              <input
                required
                value={linkName}
                disabled={saving}
                onChange={(e) => setLinkName(e.target.value)}
              />
            </label>
          ) : (
            <>
              {field("name", "ชื่อ-นามสกุลผู้ปกครอง", { maxLength: 120 })}
              {field("email", "อีเมล (ใช้รับรหัสยืนยันตอนเข้าระบบ)", {
                type: "email",
              })}
              {field("username", "ชื่อผู้ใช้", {
                minLength: 3,
                autoComplete: "off",
              })}
              {field("password", "รหัสผ่านเริ่มต้น", {
                minLength: 8,
                autoComplete: "new-password",
              })}
            </>
          )}
          <div className="sch-insights-actions">
            <button
              type="button"
              className="sch-btn sch-btn-secondary"
              disabled={saving}
              onClick={() => setMode(null)}
            >
              ยกเลิก
            </button>
            <button className="sch-btn sch-btn-primary" disabled={saving}>
              {saving
                ? "กำลังบันทึก…"
                : mode === "link"
                  ? "เชื่อมบัญชี"
                  : "สร้างบัญชี"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
