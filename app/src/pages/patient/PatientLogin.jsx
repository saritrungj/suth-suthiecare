import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiBriefcase,
  FiClock,
  FiEye,
  FiEyeOff,
  FiFileText,
  FiGrid,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import Swal from "sweetalert2";
import logo from "../../assets/logoSUTH.png";
import lineOaQrCode from "../../assets/S__141672476.jpg";
import { loginApi, patientLoginApi } from "../../services/api";
import { setPatientSession } from "../../utils/patientSession";
import PatientLanguageSwitcher from "./PatientLanguageSwitcher";
import "./PatientAuth.css";
import "../login/Login.css";

const isTurnstileDisabled = import.meta.env.VITE_DISABLE_TURNSTILE === "true";
const lineOaUrl =
  import.meta.env.VITE_LINE_OA_URL ||
  "https://line.me/R/ti/p/@911uimmu";

export default function PatientLogin({ initialRole = "patient" }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "en" ? "en" : "th";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(initialRole === "staff" ? "staff" : "patient");
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(
    isTurnstileDisabled ? "local-turnstile-disabled" : "",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const isStaff = role === "staff";
  const requestedPath = params.get("returnTo");
  const returnTo = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
    ? requestedPath
    : "/history";

  useEffect(() => {
    if (!isStaff) return;
    localStorage.removeItem("suth_user");
    localStorage.removeItem("suth_token");
    sessionStorage.removeItem("suth_user");
    sessionStorage.removeItem("suth_token");
    localStorage.setItem("SUTH_LOGOUT", Date.now().toString());
    localStorage.removeItem("SUTH_LOGOUT");
  }, [isStaff]);

  useEffect(() => {
    if (isTurnstileDisabled) return undefined;
    setTurnstileToken("");

    const renderWidget = () => {
      if (window.turnstile && turnstileRef.current && widgetIdRef.current === null) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          theme: "light",
          language,
          size: window.matchMedia("(max-width: 480px)").matches ? "compact" : "flexible",
          callback: setTurnstileToken,
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        });
      }
    };

    let script = document.getElementById("cf-turnstile-script");
    if (!script) {
      script = document.createElement("script");
      script.id = "cf-turnstile-script";
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener("load", renderWidget);
    if (window.turnstile) renderWidget();

    return () => {
      script?.removeEventListener("load", renderWidget);
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [language, role]);

  const resetTurnstile = () => {
    if (window.turnstile && widgetIdRef.current !== null) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {}
    }
    if (!isTurnstileDisabled) setTurnstileToken("");
  };

  const selectRole = (nextRole) => {
    if (nextRole === role || loading) return;
    setRole(nextRole);
    setForm({ username: "", password: "" });
    setShowPassword(false);
    setError("");
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
  };

  const showStaffPasswordHelp = () => {
    Swal.fire({
      icon: "info",
      title: t("patient_auth.staff_login.forgot_password_title"),
      text: t("patient_auth.staff_login.forgot_password_description"),
      confirmButtonText: t("patient_auth.staff_login.forgot_password_confirm"),
      confirmButtonColor: "#a9430b",
      customClass: {
        popup: "patient-password-help-dialog",
      },
    });
  };

  const showPatientPasswordHelp = async () => {
    const result = await Swal.fire({
      title: t("patient_auth.login.forgot_password_title"),
      text: t("patient_auth.login.forgot_password_description"),
      imageUrl: lineOaQrCode,
      imageAlt: t("patient_auth.login.line_qr_alt"),
      imageWidth: 300,
      imageHeight: 300,
      showCancelButton: true,
      confirmButtonText: t("patient_auth.login.open_line_oa"),
      cancelButtonText: t("patient_auth.login.close_qr"),
      confirmButtonColor: "#06c755",
      cancelButtonColor: "#667789",
      customClass: {
        popup: "patient-password-help-dialog patient-line-qr-dialog",
      },
    });

    if (result.isConfirmed) {
      window.open(lineOaUrl, "_blank", "noopener,noreferrer");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.username.trim() || !form.password) {
      setError(t("patient_auth.login.credentials_required"));
      return;
    }
    if (!turnstileToken) {
      setError(t("patient_auth.login.turnstile_required"));
      return;
    }

    setLoading(true);
    try {
      if (isStaff) {
        const response = await loginApi({
          username: form.username.trim(),
          password: form.password,
          turnstileToken,
        });
        if (!response.data?.success || !response.data?.token) throw new Error("INVALID_LOGIN_RESPONSE");
        sessionStorage.setItem("suth_user", JSON.stringify(response.data.user));
        sessionStorage.setItem("suth_token", response.data.token);
        navigate("/admin/dashboard", { replace: true });
      } else {
        const response = await patientLoginApi({
          username: form.username.trim(),
          password: form.password,
          turnstileToken,
        });
        setPatientSession(response.data.token, response.data.user);
        navigate(returnTo, { replace: true });
      }
    } catch (requestError) {
      resetTurnstile();
      setError(
        requestError.response?.data?.message ||
          t("patient_auth.login.generic_error"),
      );
    } finally {
      setLoading(false);
    }
  };

  const content = isStaff
    ? {
        pageLabel: t("patient_auth.staff_login.page_label"),
        kicker: t("patient_auth.staff_login.kicker"),
        introTitle: t("patient_auth.staff_login.intro_title"),
        introDescription: t("patient_auth.staff_login.intro_description"),
        title: t("patient_auth.staff_login.title"),
        subtitle: t("patient_auth.staff_login.subtitle"),
        username: t("patient_auth.staff_login.username"),
        usernamePlaceholder: t("patient_auth.staff_login.username_placeholder"),
        password: t("patient_auth.staff_login.password"),
        passwordPlaceholder: t("patient_auth.staff_login.password_placeholder"),
        benefits: [
          [FiGrid, t("patient_auth.staff_login.benefit_overview")],
          [FiUsers, t("patient_auth.staff_login.benefit_users")],
          [FiShield, t("patient_auth.staff_login.benefit_access")],
        ],
      }
    : {
        pageLabel: t("patient_auth.login.page_label"),
        kicker: t("patient_auth.login.kicker"),
        introTitle: t("patient_auth.login.intro_title"),
        introDescription: t("patient_auth.login.intro_description"),
        title: t("patient_auth.login.title"),
        subtitle: t("patient_auth.login.subtitle"),
        username: t("patient_auth.login.username"),
        usernamePlaceholder: t("patient_auth.login.username_placeholder"),
        password: t("patient_auth.login.password"),
        passwordPlaceholder: t("patient_auth.login.password_placeholder"),
        benefits: [
          [FiShield, t("patient_auth.login.benefit_privacy")],
          [FiFileText, t("patient_auth.login.benefit_history")],
          [FiClock, t("patient_auth.login.benefit_access")],
        ],
      };
  const titleId = isStaff ? "staff-login-title" : "patient-login-title";
  const IntroIcon = isStaff ? FiBriefcase : FiUser;

  return (
    <main className={`patient-auth-page patient-login-page ${isStaff ? "staff-login-page" : "patient-civic-auth-page"}`}>
      <div className="patient-auth-toolbar">
        <Link className="patient-auth-home" to="/" aria-label={t("patient_auth.back_home", "กลับหน้าแรก")}>
          <FiArrowLeft aria-hidden="true" />
          <span>{t("patient_auth.back_home", "กลับหน้าแรก")}</span>
        </Link>
        <PatientLanguageSwitcher />
      </div>

      <section className={`patient-login-shell ${isStaff ? "" : "patient-civic-shell"}`} aria-label={content.pageLabel}>
        <aside className={`patient-login-intro ${isStaff ? "staff-login-intro" : "patient-civic-intro"}`}>
          <img className="patient-login-logo" src={logo} alt="SUTH" />
          <div className="patient-login-intro-copy">
            <p className="patient-login-kicker">{content.kicker}</p>
            <h2>{content.introTitle}</h2>
            <p>{content.introDescription}</p>
          </div>
          <div className="patient-login-benefits" aria-label={content.pageLabel}>
            {content.benefits.map(([Icon, label]) => (
              <div className="patient-login-benefit" key={label}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="patient-login-form-panel">
          <div className="patient-login-role-switcher" role="tablist" aria-label={t("patient_auth.role_switcher_label")}>
            <button type="button" role="tab" aria-selected={!isStaff} className={!isStaff ? "is-active" : ""} onClick={() => selectRole("patient")}>{t("patient_auth.role_patient")}</button>
            <button type="button" role="tab" aria-selected={isStaff} className={isStaff ? "is-active" : ""} onClick={() => selectRole("staff")}>{t("patient_auth.role_staff")}</button>
          </div>

          <div className="patient-login-heading">
            <span className="patient-login-heading-icon" aria-hidden="true"><IntroIcon /></span>
            <div><h1 id={titleId}>{content.title}</h1><p>{content.subtitle}</p></div>
          </div>

          {error && <div className="patient-auth-error" role="alert"><FiAlertCircle aria-hidden="true" /><span>{error}</span></div>}

          <form className="patient-login-form" onSubmit={submit} aria-labelledby={titleId} aria-busy={loading} noValidate>
            <div className="patient-auth-field">
              <label htmlFor="login-username">{content.username}</label>
              <input id="login-username" name="username" autoComplete="username" value={form.username} onChange={updateField("username")} placeholder={content.usernamePlaceholder} disabled={loading} required />
            </div>
            <div className="patient-auth-field">
              <label htmlFor="login-password">{content.password}</label>
              <div className="patient-password-control">
                <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={form.password} onChange={updateField("password")} placeholder={content.passwordPlaceholder} disabled={loading} required />
                <button className="patient-password-toggle" type="button" onClick={() => setShowPassword((current) => !current)} aria-label={t(showPassword ? "patient_auth.login.hide_password" : "patient_auth.login.show_password", showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน")} aria-pressed={showPassword}>
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>
            <div className="patient-password-help">
              {isStaff ? (
                <button type="button" onClick={showStaffPasswordHelp}>
                  {t("patient_auth.staff_login.forgot_password")}
                </button>
              ) : (
                <button type="button" onClick={showPatientPasswordHelp}>
                  {t("patient_auth.login.forgot_password")}
                </button>
              )}
            </div>
            <div ref={turnstileRef} className="patient-turnstile" aria-label={t("patient_auth.login.security_label")} />
            <button className="patient-auth-button" type="submit" disabled={loading}>
              {loading ? <><span className="patient-auth-spinner" aria-hidden="true" />{t("patient_auth.login.submitting")}</> : t("patient_auth.login.submit")}
            </button>
          </form>

          {isStaff ? (
            <p className="staff-login-note">{t("patient_auth.staff_login.support_note")}</p>
          ) : (
            <>
              <div className="patient-login-register"><span>{t("patient_auth.login.no_account")}</span><Link className="patient-auth-link" to={`/account/register?returnTo=${encodeURIComponent(returnTo)}`}>{t("patient_auth.login.register_link")}</Link></div>
              <p className="patient-login-privacy">{t("patient_auth.login.privacy_note")}</p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
