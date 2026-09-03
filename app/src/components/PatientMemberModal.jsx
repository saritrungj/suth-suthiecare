import { useEffect, useRef, useState } from "react";
import { FiEye, FiEyeOff, FiKey, FiSave, FiX } from "react-icons/fi";

const initialForm = {
  username: "",
  first_name: "",
  last_name: "",
  phone: "",
  status: "active",
  password: "",
};

export default function PatientMemberModal({ member, onClose, onSave }) {
  const [form, setForm] = useState(() => ({ ...initialForm, ...member }));
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const usernameRef = useRef(null);

  useEffect(() => {
    usernameRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setError("");
  };

  const updateDigits = (field, maxLength) => (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, maxLength);
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        username: form.username.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim(),
        status: form.status,
        password: form.password,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่",
      );
      setSaving(false);
    }
  };

  return (
    <div className="sum-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section
        className="sum-member-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sum-member-modal-title"
      >
        <header className="sum-member-modal__header">
          <div>
            <h2 id="sum-member-modal-title">แก้ไขข้อมูลผู้มารับบริการ</h2>
            <p>ปรับข้อมูลบัญชี สถานะ หรือกำหนดรหัสผ่านใหม่</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="ปิดหน้าต่าง">
            <FiX aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={submit} aria-busy={saving}>
          {error && <div className="sum-member-modal__error" role="alert">{error}</div>}

          <div className="sum-member-form-grid">
            <label className="sum-member-field sum-member-field--wide">
              <span>ชื่อผู้ใช้</span>
              <input
                ref={usernameRef}
                value={form.username}
                onChange={update("username")}
                minLength={3}
                maxLength={80}
                autoComplete="off"
                required
              />
              <small>ภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง</small>
            </label>

            <label className="sum-member-field">
              <span>ชื่อ</span>
              <input value={form.first_name} onChange={update("first_name")} maxLength={100} required />
            </label>
            <label className="sum-member-field">
              <span>นามสกุล</span>
              <input value={form.last_name} onChange={update("last_name")} maxLength={100} required />
            </label>

            <label className="sum-member-field">
              <span>หมายเลขโทรศัพท์ <em>(ไม่บังคับ)</em></span>
              <input
                value={form.phone}
                onChange={updateDigits("phone", 10)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="08xxxxxxxx"
              />
              <small>กรอกหมายเลขโทรศัพท์มือถือ 10 หลัก เช่น 0812345678</small>
            </label>
            <label className="sum-member-field">
              <span>สถานะบัญชี</span>
              <select value={form.status} onChange={update("status")}>
                <option value="active">ใช้งานปกติ</option>
                <option value="pending_verification">รอยืนยัน</option>
                <option value="locked">ล็อกบัญชี</option>
                <option value="disabled">ปิดการใช้งาน</option>
              </select>
            </label>

            <label className="sum-member-field sum-member-field--wide">
              <span><FiKey aria-hidden="true" /> รหัสผ่านใหม่ <em>(เว้นว่างหากไม่เปลี่ยน)</em></span>
              <div className="sum-member-password">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
              <small>เมื่อบันทึก ระบบจะออกจากระบบบัญชีนี้ในทุกอุปกรณ์</small>
            </label>
          </div>

          <footer className="sum-member-modal__footer">
            <button className="sum-member-cancel" type="button" onClick={onClose} disabled={saving}>ยกเลิก</button>
            <button className="sum-member-save" type="submit" disabled={saving}>
              <FiSave aria-hidden="true" /> {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
