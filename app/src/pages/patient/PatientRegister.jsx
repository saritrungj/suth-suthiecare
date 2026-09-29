import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiLink,
  FiLock,
  FiUserPlus,
} from "react-icons/fi";
import logo from "../../assets/logoSUTH.png";
import {
  patientRegisterApi,
  verifyPatientEmailApi,
  resendPatientEmailApi,
} from "../../services/api";
import { setPatientSession } from "../../utils/patientSession";
import { showErrorAlert, showSuccessAlert } from "../../utils/alerts";
import PatientLanguageSwitcher from "./PatientLanguageSwitcher";
import { PasswordInput, PasswordRules } from "./PasswordField";
import {
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
} from "../../utils/passwordPolicy";
import "./PatientAuth.css";

const isTurnstileDisabled = import.meta.env.VITE_DISABLE_TURNSTILE === "true";

export default function PatientRegister() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "en" ? "en" : "th";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requestedPath = params.get("returnTo");
  const returnTo =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/history";

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    national_id: "",
    phone: "",
  });
  const [turnstileToken, setTurnstileToken] = useState(
    isTurnstileDisabled ? "local-turnstile-disabled" : "",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailChallenge, setEmailChallenge] = useState(null);
  const [otp, setOtp] = useState("");
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    if (isTurnstileDisabled) return undefined;
    setTurnstileToken("");

    const renderWidget = () => {
      if (
        window.turnstile &&
        turnstileRef.current &&
        widgetIdRef.current === null
      ) {
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          theme: "light",
          language,
          size: window.matchMedia("(max-width: 480px)").matches
            ? "compact"
            : "flexible",
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
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
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
  }, [language]);

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
  };

  const updateDigits = (field, maxLength) => (event) => {
    const value = event.target.value.replace(/\D/g, "").slice(0, maxLength);
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(form.password)) {
      setError(
        language === "en"
          ? "Your password does not meet every requirement below."
          : "รหัสผ่านยังไม่ตรงตามเงื่อนไขทุกข้อ",
      );
      document.getElementById("register-password")?.focus();
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError(t("patient_auth.register.password_mismatch"));
      return;
    }
    if (!turnstileToken) {
      setError(t("patient_auth.register.turnstile_required"));
      return;
    }

    setLoading(true);
    try {
      const response = await patientRegisterApi({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        email: form.email.trim(),
        national_id: form.national_id,
        phone: form.phone,
        turnstileToken,
      });
      if (response.data?.requiresEmailVerification) {
        setEmailChallenge(response.data);
        setOtp("");
        return;
      }
      setPatientSession(response.data.token, response.data.user);
      await showSuccessAlert({
        title:
          language === "en" ? "Account created" : "สร้างบัญชีเรียบร้อยแล้ว",
        text:
          language === "en"
            ? "Your account is ready to use."
            : "บัญชีของคุณพร้อมใช้งานแล้ว",
      });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          t("patient_auth.register.generic_error"),
      );
      await showErrorAlert({
        error: requestError,
        title:
          language === "en" ? "Registration failed" : "สร้างบัญชีไม่สำเร็จ",
        fallback: t("patient_auth.register.generic_error"),
      });
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {}
      }
      if (!isTurnstileDisabled) setTurnstileToken("");
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) {
      setError(
        language === "en"
          ? "Enter the 6-digit verification code."
          : "กรุณากรอกรหัสยืนยัน 6 หลัก",
      );
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await verifyPatientEmailApi({
        challengeToken: emailChallenge.challengeToken,
        otp,
      });
      setPatientSession(response.data.token, response.data.user);
      await showSuccessAlert({
        title:
          language === "en" ? "Email verified" : "ยืนยันอีเมลเรียบร้อยแล้ว",
        text:
          language === "en"
            ? "Your account is ready to use."
            : "บัญชีของคุณพร้อมใช้งานแล้ว",
      });
      navigate(returnTo, { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (language === "en"
            ? "Unable to verify the email."
            : "ไม่สามารถยืนยันอีเมลได้"),
      );
    } finally {
      setLoading(false);
    }
  };
  const resendEmail = async () => {
    setLoading(true);
    setError("");
    try {
      await resendPatientEmailApi({
        challengeToken: emailChallenge.challengeToken,
      });
      setError(
        language === "en"
          ? "A new code has been sent."
          : "ส่งรหัสใหม่เรียบร้อยแล้ว",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (language === "en"
            ? "Unable to send a new code."
            : "ไม่สามารถส่งรหัสใหม่ได้"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="patient-auth-page patient-civic-auth-page patient-register-page">
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
        className="patient-login-shell patient-register-shell patient-civic-shell"
        aria-label={t("patient_auth.register.page_label")}
      >
        <aside className="patient-login-intro patient-register-intro patient-civic-intro">
          <img className="patient-login-logo" src={logo} alt="SUTH" />
          <div className="patient-login-intro-copy">
            <p className="patient-login-kicker">
              {t("patient_auth.register.kicker")}
            </p>
            <h2>{t("patient_auth.register.intro_title")}</h2>
            <p>{t("patient_auth.register.intro_description")}</p>
          </div>

          <div className="patient-login-benefits patient-register-steps">
            <div className="patient-login-benefit">
              <FiLink aria-hidden="true" />
              <span>{t("patient_auth.register.step_identity")}</span>
            </div>
            <div className="patient-login-benefit">
              <FiUserPlus aria-hidden="true" />
              <span>{t("patient_auth.register.step_account")}</span>
            </div>
            <div className="patient-login-benefit">
              <FiLock aria-hidden="true" />
              <span>{t("patient_auth.register.step_security")}</span>
            </div>
          </div>
        </aside>

        <div className="patient-login-form-panel patient-register-form-panel">
          <div className="patient-login-heading">
            <span className="patient-login-heading-icon" aria-hidden="true">
              <FiUserPlus />
            </span>
            <div>
              <h1 id="patient-register-title">
                {t("patient_auth.register.title")}
              </h1>
              <p>{t("patient_auth.register.subtitle")}</p>
            </div>
          </div>

          {error && (
            <div className="patient-auth-error" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {emailChallenge ? (
            <form
              className="patient-register-form"
              onSubmit={verifyEmail}
              aria-labelledby="patient-register-title"
              aria-busy={loading}
            >
              <fieldset className="patient-register-section">
                <legend>
                  {language === "en" ? "Verify your email" : "ยืนยันอีเมล"}
                </legend>
                <p>
                  {language === "en"
                    ? `Enter the 6-digit code sent to ${emailChallenge.maskedEmail}.`
                    : `กรอกรหัส 6 หลักที่ส่งไปที่ ${emailChallenge.maskedEmail}`}
                </p>
                <div className="patient-auth-field">
                  <label htmlFor="patient-email-otp">
                    {language === "en" ? "Verification code" : "รหัสยืนยัน"}
                  </label>
                  <input
                    id="patient-email-otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength="6"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    disabled={loading}
                    autoFocus
                    required
                  />
                </div>
              </fieldset>
              <button
                className="patient-auth-button"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? language === "en"
                    ? "Verifying..."
                    : "กำลังยืนยัน..."
                  : language === "en"
                    ? "Verify email"
                    : "ยืนยันอีเมล"}
              </button>
              <button
                className="patient-auth-link"
                type="button"
                onClick={resendEmail}
                disabled={loading}
              >
                {language === "en" ? "Send a new code" : "ส่งรหัสใหม่"}
              </button>
            </form>
          ) : (
            <form
              className="patient-register-form"
              onSubmit={submit}
              aria-labelledby="patient-register-title"
              aria-busy={loading}
            >
              <fieldset className="patient-register-section">
                <legend>{t("patient_auth.register.account_section")}</legend>
                <p>{t("patient_auth.register.account_help")}</p>
                <div className="patient-register-fields">
                  <div className="patient-auth-field patient-register-field-wide">
                    <label htmlFor="register-username">
                      {t("patient_auth.register.username")}
                    </label>
                    <input
                      id="register-username"
                      name="username"
                      maxLength="80"
                      autoComplete="username"
                      value={form.username}
                      onChange={updateField("username")}
                      placeholder={t(
                        "patient_auth.register.username_placeholder",
                      )}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="patient-auth-field patient-register-field-wide">
                    <label htmlFor="register-email">
                      {language === "en" ? "Email" : "อีเมล"}
                    </label>
                    <input
                      id="register-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      maxLength="254"
                      value={form.email}
                      onChange={updateField("email")}
                      placeholder={
                        language === "en"
                          ? "name@example.com"
                          : "name@example.com"
                      }
                      disabled={loading}
                      required
                    />
                    <small>
                      {language === "en"
                        ? "We will send a verification code to this address."
                        : "ระบบจะส่งรหัสยืนยันไปยังอีเมลนี้"}
                    </small>
                  </div>
                  <div className="patient-auth-field">
                    <label htmlFor="register-password">
                      {t("patient_auth.register.password")}
                    </label>
                    <PasswordInput
                      id="register-password"
                      language={language}
                      name="password"
                      minLength={PASSWORD_MIN_LENGTH}
                      value={form.password}
                      onChange={updateField("password")}
                      placeholder={t(
                        "patient_auth.register.password_placeholder",
                      )}
                      aria-describedby="register-password-rules"
                      disabled={loading}
                      required
                    />
                    <PasswordRules
                      id="register-password-rules"
                      password={form.password}
                      language={language}
                    />
                  </div>
                  <div className="patient-auth-field">
                    <label htmlFor="register-confirm">
                      {t("patient_auth.register.confirm_password")}
                    </label>
                    <PasswordInput
                      id="register-confirm"
                      language={language}
                      name="confirmPassword"
                      minLength={PASSWORD_MIN_LENGTH}
                      value={form.confirmPassword}
                      onChange={updateField("confirmPassword")}
                      placeholder={t(
                        "patient_auth.register.confirm_password_placeholder",
                      )}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="patient-register-section">
                <legend>{t("patient_auth.register.identity_section")}</legend>
                <p>{t("patient_auth.register.identity_help")}</p>
                <div className="patient-register-fields">
                  <div className="patient-auth-field">
                    <label htmlFor="register-first-name">
                      {t("patient_auth.register.first_name")}
                    </label>
                    <input
                      id="register-first-name"
                      name="first_name"
                      autoComplete="given-name"
                      maxLength="100"
                      value={form.first_name}
                      onChange={updateField("first_name")}
                      placeholder={t(
                        "patient_auth.register.first_name_placeholder",
                      )}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="patient-auth-field">
                    <label htmlFor="register-last-name">
                      {t("patient_auth.register.last_name")}
                    </label>
                    <input
                      id="register-last-name"
                      name="last_name"
                      autoComplete="family-name"
                      maxLength="100"
                      value={form.last_name}
                      onChange={updateField("last_name")}
                      placeholder={t(
                        "patient_auth.register.last_name_placeholder",
                      )}
                      disabled={loading}
                      required
                    />
                  </div>
                  <div className="patient-auth-field">
                    <label htmlFor="register-id">
                      {t("patient_auth.register.national_id")}
                      <span
                        className="patient-optional-label"
                        aria-hidden="true"
                      >
                        {t("patient_auth.register.optional")}
                      </span>
                    </label>
                    <input
                      id="register-id"
                      name="national_id"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength="13"
                      value={form.national_id}
                      onChange={updateDigits("national_id", 13)}
                      placeholder={t(
                        "patient_auth.register.national_id_placeholder",
                      )}
                      disabled={loading}
                    />
                  </div>
                  <div className="patient-auth-field">
                    <label htmlFor="register-phone">
                      {t("patient_auth.register.phone")}
                      <span className="patient-optional-label">
                        {t("patient_auth.register.optional")}
                      </span>
                    </label>
                    <input
                      id="register-phone"
                      name="phone"
                      inputMode="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={updateDigits("phone", 10)}
                      placeholder={t("patient_auth.register.phone_placeholder")}
                      disabled={loading}
                    />
                  </div>
                </div>
              </fieldset>

              <div className="patient-register-submit-area">
                <div
                  ref={turnstileRef}
                  className="patient-turnstile"
                  aria-label={t("patient_auth.register.security_label")}
                />
                <button
                  className="patient-auth-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span
                        className="patient-auth-spinner"
                        aria-hidden="true"
                      />
                      {t("patient_auth.register.submitting")}
                    </>
                  ) : (
                    <>
                      <FiCheckCircle aria-hidden="true" />
                      {t("patient_auth.register.submit")}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="patient-login-register patient-register-login-link">
            <span>{t("patient_auth.register.has_account")}</span>
            <Link
              className="patient-auth-link"
              to={`/account/login?returnTo=${encodeURIComponent(returnTo)}`}
            >
              {t("patient_auth.register.login_link")}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
