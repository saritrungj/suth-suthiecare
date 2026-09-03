import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FiChevronDown, FiClock, FiLogOut, FiUser } from "react-icons/fi";
import { getPatientMe, patientLogoutApi } from "../services/api";
import {
  clearPatientSession,
  getPatientSession,
  subscribePatientSession,
} from "../utils/patientSession";
import "./PatientAccountMenu.css";

export default function PatientAccountMenu({ onDark = false, onNavigate, stackOnMobile = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [session, setSession] = useState(getPatientSession);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => subscribePatientSession(() => setSession(getPatientSession())), []);

  useEffect(() => {
    if (!session.token) return undefined;
    let active = true;
    getPatientMe()
      .then((response) => {
        if (active && response.data?.user) {
          setSession((current) => ({ ...current, user: response.data.user }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.token]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape" || !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const go = (path) => {
    setOpen(false);
    onNavigate?.();
    navigate(path);
  };

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await patientLogoutApi();
    } catch {
      // Local logout must still complete when the server or network is unavailable.
    } finally {
      clearPatientSession();
      setOpen(false);
      setLoggingOut(false);
      onNavigate?.();
      navigate("/", { replace: true });
    }
  };

  if (!session.user) {
    return (
      <button
        type="button"
        className={`patient-account-login ${onDark ? "is-on-dark" : ""} ${stackOnMobile ? "is-mobile-stack" : ""}`}
        onClick={() => go("/account/login?returnTo=%2Fhistory")}
      >
        <FiUser aria-hidden="true" />
        <span>{t("nav.patient_login", "เข้าสู่ระบบ")}</span>
      </button>
    );
  }

  const displayName = [session.user.first_name, session.user.last_name]
    .filter(Boolean)
    .join(" ") || session.user.username;

  return (
    <div className={`patient-account-menu ${open ? "is-open" : ""} ${onDark ? "is-on-dark" : ""} ${stackOnMobile ? "is-mobile-stack" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="patient-account-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${t("nav.patient_account", "บัญชีผู้มารับบริการ")} ${displayName}`}
      >
        <span className="patient-account-avatar" aria-hidden="true">
          {(session.user.first_name || session.user.username || "U").charAt(0).toUpperCase()}
        </span>
        <span className="patient-account-copy">
          <small>{t("nav.patient_account", "บัญชีผู้มารับบริการ")}</small>
          <strong title={displayName}>{displayName}</strong>
        </span>
        <FiChevronDown className={open ? "is-open" : ""} aria-hidden="true" />
      </button>

      {open && (
        <div className="patient-account-dropdown" role="menu">
          <div className="patient-account-menu-items">
            <button type="button" role="menuitem" onClick={() => go("/history")}>
              <FiClock aria-hidden="true" />
              {t("nav.history", "ตรวจสอบประวัติ")}
            </button>
            <button
              type="button"
              role="menuitem"
              className="patient-account-logout"
              onClick={logout}
              disabled={loggingOut}
            >
              <FiLogOut aria-hidden="true" />
              {loggingOut
                ? t("nav.logging_out", "กำลังออกจากระบบ...")
                : t("nav.logout", "ออกจากระบบ")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
