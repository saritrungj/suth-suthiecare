import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEnvelope,
  faEye,
  faEyeSlash,
  faKey,
  faUserPen,
} from "@fortawesome/free-solid-svg-icons";
import {
  changeMyEmail,
  changeMyPassword,
  getMyProfile,
  updateMyProfile,
} from "../../services/api";
import { getErrorMessage, showSuccessAlert } from "../../utils/alerts";
import "./MyProfile.css";

// The session lives in sessionStorage or localStorage depending on
// "remember me"; write back to whichever one currently holds it.
const sessionStore = () =>
  sessionStorage.getItem("suth_token") ? sessionStorage : localStorage;

const saveSession = ({ user, token }) => {
  const store = sessionStore();
  if (user) store.setItem("suth_user", JSON.stringify(user));
  if (token) store.setItem("suth_token", token);
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("th-TH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

const PasswordInput = ({ id, label, value, onChange, autoComplete, hint }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="profile-field">
      <label htmlFor={id}>{label}</label>
      <div className="profile-password">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          maxLength={200}
          required
        />
        <button
          type="button"
          className="profile-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        >
          <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );
};

const MyProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [emailForm, setEmailForm] = useState({
    email: "",
    currentPassword: "",
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    getMyProfile()
      .then(({ data }) => {
        setProfile(data.profile);
        setName(data.profile.name || "");
      })
      .catch((error) =>
        setLoadError(getErrorMessage(error, "ไม่สามารถโหลดข้อมูลส่วนตัวได้")),
      );
  }, []);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError("");
    const trimmed = name.trim();
    if (Array.from(trimmed).length < 2) {
      setProfileError("กรุณากรอกชื่อ-นามสกุลอย่างน้อย 2 ตัวอักษร");
      return;
    }
    setSavingProfile(true);
    try {
      const { data } = await updateMyProfile({ name: trimmed });
      setProfile(data.profile);
      setName(data.profile.name || "");
      saveSession({ user: data.user });
      showSuccessAlert({ title: data.message });
    } catch (error) {
      setProfileError(getErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const setPasswordField = (field) => (value) =>
    setPasswords((prev) => ({ ...prev, [field]: value }));

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    const { currentPassword, newPassword, confirmPassword } = passwords;
    if (newPassword.length < 8) {
      setPasswordError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน");
      return;
    }
    setSavingPassword(true);
    try {
      const { data } = await changeMyPassword({ currentPassword, newPassword });
      saveSession({ user: data.user, token: data.token });
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      showSuccessAlert({
        title: data.message,
        text: "อุปกรณ์อื่นที่เข้าสู่ระบบด้วยบัญชีนี้จะต้องเข้าสู่ระบบใหม่",
        timer: 2600,
      });
    } catch (error) {
      setPasswordError(getErrorMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setEmailError("");
    const email = emailForm.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("รูปแบบอีเมลไม่ถูกต้อง");
      return;
    }
    if (email === (profile.email || "").toLowerCase()) {
      setEmailError("อีเมลใหม่ต้องไม่ซ้ำกับอีเมลเดิม");
      return;
    }
    setSavingEmail(true);
    try {
      const { data } = await changeMyEmail({
        email,
        currentPassword: emailForm.currentPassword,
      });
      setProfile(data.profile);
      saveSession({ user: data.user, token: data.token });
      setEmailForm({ email: "", currentPassword: "" });
      showSuccessAlert({
        title: data.message,
        text: "ระบบจะส่งรหัสยืนยันไปยังอีเมลใหม่ในการเข้าสู่ระบบครั้งถัดไป",
        timer: 3000,
      });
    } catch (error) {
      setEmailError(getErrorMessage(error));
    } finally {
      setSavingEmail(false);
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <h1>ข้อมูลส่วนตัว</h1>
        <p>จัดการชื่อที่แสดงในระบบ อีเมล และรหัสผ่านสำหรับบัญชีของคุณ</p>
      </header>

      {loadError && (
        <div className="profile-alert" role="alert">
          {loadError}
        </div>
      )}

      {!profile && !loadError && (
        <div className="profile-loading">กำลังโหลดข้อมูล…</div>
      )}

      {profile && (
        <div className="profile-grid">
          <section className="profile-card">
            <h2>
              <FontAwesomeIcon icon={faUserPen} /> ข้อมูลบัญชี
            </h2>
            <dl className="profile-meta">
              <div>
                <dt>ชื่อผู้ใช้งาน</dt>
                <dd>{profile.username}</dd>
              </div>
              <div>
                <dt>อีเมล</dt>
                <dd>
                  {profile.email || "-"}
                  {profile.email && (
                    <span
                      className={`profile-badge ${profile.email_verified_at ? "ok" : ""}`}
                    >
                      {profile.email_verified_at
                        ? "ยืนยันแล้ว"
                        : "ยังไม่ยืนยัน"}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>ระดับสิทธิ์</dt>
                <dd>{profile.role_name || "-"}</dd>
              </div>
              <div>
                <dt>สร้างบัญชีเมื่อ</dt>
                <dd>{formatDate(profile.created_at)}</dd>
              </div>
            </dl>
            <p className="profile-note">
              หากต้องการเปลี่ยนชื่อผู้ใช้งาน กรุณาติดต่อผู้ดูแลระบบ
            </p>

            <form onSubmit={handleProfileSubmit} noValidate>
              <div className="profile-field">
                <label htmlFor="profile-name">ชื่อ-นามสกุล</label>
                <input
                  id="profile-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={255}
                  required
                />
              </div>
              {profileError && (
                <p className="profile-error" role="alert">
                  {profileError}
                </p>
              )}
              <button
                type="submit"
                disabled={savingProfile || name.trim() === (profile.name || "")}
              >
                {savingProfile ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
              </button>
            </form>
          </section>

          <section className="profile-card">
            <h2>
              <FontAwesomeIcon icon={faKey} /> เปลี่ยนรหัสผ่าน
            </h2>
            <form onSubmit={handlePasswordSubmit} noValidate>
              <PasswordInput
                id="current-password"
                label="รหัสผ่านปัจจุบัน"
                value={passwords.currentPassword}
                onChange={setPasswordField("currentPassword")}
                autoComplete="current-password"
              />
              <PasswordInput
                id="new-password"
                label="รหัสผ่านใหม่"
                value={passwords.newPassword}
                onChange={setPasswordField("newPassword")}
                autoComplete="new-password"
                hint="อย่างน้อย 8 ตัวอักษร"
              />
              <PasswordInput
                id="confirm-password"
                label="ยืนยันรหัสผ่านใหม่"
                value={passwords.confirmPassword}
                onChange={setPasswordField("confirmPassword")}
                autoComplete="new-password"
              />
              {passwordError && (
                <p className="profile-error" role="alert">
                  {passwordError}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  savingPassword ||
                  !passwords.currentPassword ||
                  !passwords.newPassword ||
                  !passwords.confirmPassword
                }
              >
                {savingPassword ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}
              </button>
            </form>
          </section>

          <section className="profile-card">
            <h2>
              <FontAwesomeIcon icon={faEnvelope} /> เปลี่ยนอีเมล
            </h2>
            <p className="profile-note">
              อีเมลใหม่จะต้องยืนยันด้วยรหัสที่ส่งไปทางอีเมลเมื่อเข้าสู่ระบบครั้งถัดไป
              และอุปกรณ์อื่นที่เข้าสู่ระบบอยู่จะถูกออกจากระบบ
            </p>
            <form onSubmit={handleEmailSubmit} noValidate>
              <div className="profile-field">
                <label htmlFor="new-email">อีเมลใหม่</label>
                <input
                  id="new-email"
                  type="email"
                  value={emailForm.email}
                  onChange={(e) =>
                    setEmailForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  autoComplete="email"
                  maxLength={100}
                  required
                />
              </div>
              <PasswordInput
                id="email-current-password"
                label="รหัสผ่านปัจจุบัน"
                value={emailForm.currentPassword}
                onChange={(value) =>
                  setEmailForm((prev) => ({ ...prev, currentPassword: value }))
                }
                autoComplete="current-password"
                hint="ยืนยันตัวตนด้วยรหัสผ่านก่อนเปลี่ยนอีเมล"
              />
              {emailError && (
                <p className="profile-error" role="alert">
                  {emailError}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  savingEmail || !emailForm.email || !emailForm.currentPassword
                }
              >
                {savingEmail ? "กำลังบันทึก…" : "เปลี่ยนอีเมล"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default MyProfile;
