import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FiAlertCircle, FiArrowLeft, FiKey, FiLock } from "react-icons/fi";
import logo from "../../assets/logoSUTH.png";
import { changePatientPasswordApi } from "../../services/api";
import {
  getPatientSession,
  setPatientSession,
} from "../../utils/patientSession";
import PatientLanguageSwitcher from "./PatientLanguageSwitcher";
import { PasswordInput, PasswordRules } from "./PasswordField";
import {
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
} from "../../utils/passwordPolicy";
import "./PatientAuth.css";
import "../login/Login.css";

// Signed-in password change. Accounts created by a school import land here
// after their first sign-in (must_change_password) and cannot use the portal
// until they choose their own password.
export default function PatientChangePassword() {
  const { t, i18n } = useTranslation();
  const language = i18n.language?.startsWith("en") ? "en" : "th";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPath = params.get("returnTo");
  const returnTo =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/history";
  const { authenticated: token, user } = getPatientSession();
  const required = Boolean(user?.must_change_password);
  const [form, setForm] = useState({
    current: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token)
      navigate(
        `/account/login?returnTo=${encodeURIComponent("/account/change-password")}`,
        { replace: true },
      );
  }, [token, navigate]);

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(form.password))
      return setError(t("patient_auth.change_password.weak"));
    if (form.password !== form.confirm)
      return setError(t("patient_auth.change_password.mismatch"));
    setLoading(true);
    try {
      const response = await changePatientPasswordApi({
        current_password: form.current,
        new_password: form.password,
      });
      setPatientSession(null, response.data.user);
      navigate(
        response.data.user?.email && !response.data.user?.email_verified
          ? `/account/verify-email?returnTo=${encodeURIComponent(returnTo)}`
          : returnTo,
        { replace: true },
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          t("patient_auth.change_password.error"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="patient-auth-page patient-civic-auth-page">
      <div className="patient-auth-toolbar">
        <Link
          className="patient-auth-home"
          to="/"
          aria-label={t("patient_auth.back_home")}
        >
          <FiArrowLeft aria-hidden="true" />
          <span>{t("patient_auth.back_home")}</span>
        </Link>
        <PatientLanguageSwitcher />
      </div>

      <section
        className="patient-login-shell patient-civic-shell"
        aria-label={t("patient_auth.change_password.title")}
      >
        <aside className="patient-login-intro patient-civic-intro">
          <img className="patient-login-logo" src={logo} alt="SUTH" />
          <div className="patient-login-intro-copy">
            <p className="patient-login-kicker">
              {t("patient_auth.change_password.kicker")}
            </p>
            <h2>{t("patient_auth.change_password.intro_title")}</h2>
            <p>{t("patient_auth.change_password.intro_description")}</p>
          </div>
        </aside>

        <div className="patient-login-form-panel">
          <div className="patient-login-heading">
            <span className="patient-login-heading-icon" aria-hidden="true">
              <FiKey />
            </span>
            <div>
              <h1 id="patient-change-password-title">
                {t("patient_auth.change_password.title")}
              </h1>
              <p>
                {required
                  ? t("patient_auth.change_password.required_subtitle", {
                      username: user?.username || "",
                    })
                  : t("patient_auth.change_password.subtitle")}
              </p>
            </div>
          </div>

          {error && (
            <div className="patient-auth-error" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form
            className="patient-register-form"
            onSubmit={submit}
            aria-labelledby="patient-change-password-title"
            aria-busy={loading}
          >
            <div className="patient-auth-field">
              <label htmlFor="change-current-password">
                {required
                  ? t("patient_auth.change_password.temporary_password")
                  : t("patient_auth.change_password.current_password")}
              </label>
              <PasswordInput
                id="change-current-password"
                language={language}
                autoComplete="current-password"
                value={form.current}
                onChange={update("current")}
                disabled={loading}
                required
              />
            </div>
            <div className="patient-auth-field">
              <label htmlFor="change-new-password">
                {t("patient_auth.change_password.new_password")}
              </label>
              <PasswordInput
                id="change-new-password"
                language={language}
                minLength={PASSWORD_MIN_LENGTH}
                value={form.password}
                onChange={update("password")}
                aria-describedby="change-password-rules"
                disabled={loading}
                required
              />
              <PasswordRules
                id="change-password-rules"
                password={form.password}
                language={language}
              />
            </div>
            <div className="patient-auth-field">
              <label htmlFor="change-confirm-password">
                {t("patient_auth.change_password.confirm_password")}
              </label>
              <PasswordInput
                id="change-confirm-password"
                language={language}
                minLength={PASSWORD_MIN_LENGTH}
                value={form.confirm}
                onChange={update("confirm")}
                disabled={loading}
                required
              />
            </div>
            <button
              className="patient-auth-button"
              type="submit"
              disabled={loading}
            >
              <FiLock aria-hidden="true" />{" "}
              {loading
                ? t("patient_auth.change_password.submitting")
                : t("patient_auth.change_password.submit")}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
