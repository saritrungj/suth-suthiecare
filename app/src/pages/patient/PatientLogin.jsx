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
  FiMail,
  FiShield,
  FiUser,
  FiUsers,
} from "react-icons/fi";
import logo from "../../assets/logoSUTH.png";
import {
  loginApi,
  patientLoginApi,
  verifyStaffOtpApi,
  verifyStaffEmailApi,
  resendStaffOtpApi,
  requestStaffPasswordRecoveryApi,
  verifyStaffPasswordRecoveryApi,
  resetStaffPasswordApi,
  requestPatientPasswordRecoveryApi,
  verifyPatientPasswordRecoveryApi,
  resetPatientPasswordApi,
} from "../../services/api";
import { setPatientSession } from "../../utils/patientSession";
import PatientLanguageSwitcher from "./PatientLanguageSwitcher";
import { PasswordInput, PasswordRules } from "./PasswordField";
import {
  isStrongPassword,
  PASSWORD_MIN_LENGTH,
} from "../../utils/passwordPolicy";
import "./PatientAuth.css";
import "../login/Login.css";

const isTurnstileDisabled = import.meta.env.VITE_DISABLE_TURNSTILE === "true";

function OtpCodeInput({ value, onChange, disabled, idPrefix = "otp" }) {
  const inputs = useRef([]);
  const enteredDigits = String(value || "")
    .replace(/\D/g, "")
    .slice(0, 6);
  const digits = Array.from(
    { length: 6 },
    (_, index) => enteredDigits[index] || "",
  );
  const setDigits = (next, focusIndex) => {
    onChange(next.filter(Boolean).join(""));
    if (typeof focusIndex === "number")
      requestAnimationFrame(() => inputs.current[focusIndex]?.focus());
  };
  const updateDigit = (index, rawValue) => {
    const digit = String(rawValue || "")
      .replace(/\D/g, "")
      .slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next, digit && index < 5 ? index + 1 : index);
  };
  const handlePaste = (event, index) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6 - index);
    if (!pasted) return;
    event.preventDefault();
    const next = [...digits];
    pasted.split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setDigits(next, Math.min(5, index + pasted.length));
  };
  return (
    <div
      className="patient-otp-inputs"
      role="group"
      aria-label="รหัสยืนยัน 6 หลัก"
    >
      {digits.map((digit, index) => (
        <input
          key={`${idPrefix}-${index}`}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          id={`${idPrefix}-${index}`}
          aria-label={`ตัวเลขรหัสยืนยันตำแหน่งที่ ${index + 1}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength="1"
          value={digit}
          disabled={disabled}
          onChange={(event) => updateDigit(index, event.target.value)}
          onPaste={(event) => handlePaste(event, index)}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digits[index] && index > 0) {
              const next = [...digits];
              next[index - 1] = "";
              setDigits(next, index - 1);
            }
            if (event.key === "ArrowLeft" && index > 0)
              inputs.current[index - 1]?.focus();
            if (event.key === "ArrowRight" && index < 5)
              inputs.current[index + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

export default function PatientLogin({ initialRole = "patient" }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage === "en" ? "en" : "th";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState(
    initialRole === "staff" ? "staff" : "patient",
  );
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(
    isTurnstileDisabled ? "local-turnstile-disabled" : "",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [staffOtp, setStaffOtp] = useState(null);
  const [otpValue, setOtpValue] = useState("");
  const [recovery, setRecovery] = useState(null);
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const isStaff = role === "staff";
  const requestedPath = params.get("returnTo");
  const returnTo =
    requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
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

  // The recovery and OTP screens replace the login form, unmounting the widget
  // container, so the widget must be rendered again whenever the form returns.
  const loginFormVisible = !recovery && !staffOtp;

  useEffect(() => {
    if (isTurnstileDisabled || !loginFormVisible) return undefined;
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
  }, [language, role, loginFormVisible]);

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
    setStaffOtp(null);
    setOtpValue("");
    setRecovery(null);
    setError("");
    setNotice("");
  };

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    if (error) setError("");
    if (notice) setNotice("");
  };

  const startPasswordRecovery = (staff) =>
    setRecovery({
      staff,
      step: "email",
      email: "",
      otp: "",
      password: "",
      confirmPassword: "",
      loading: false,
      error: "",
    });
  const recoveryCopy = recovery?.staff
    ? language === "en"
      ? "Reset staff password"
      : "ตั้งรหัสผ่านเจ้าหน้าที่ใหม่"
    : language === "en"
      ? "Reset password"
      : "ตั้งรหัสผ่านใหม่";
  const recoveryApi = () =>
    recovery?.staff
      ? {
          requestApi: requestStaffPasswordRecoveryApi,
          verifyApi: verifyStaffPasswordRecoveryApi,
          resetApi: resetStaffPasswordApi,
        }
      : {
          requestApi: requestPatientPasswordRecoveryApi,
          verifyApi: verifyPatientPasswordRecoveryApi,
          resetApi: resetPatientPasswordApi,
        };
  const updateRecovery = (field, value) =>
    setRecovery((current) => ({
      ...current,
      [field]: value,
      ...(field === "error" ? {} : { error: "" }),
    }));
  const requestRecoveryCode = async (event) => {
    event.preventDefault();
    const email = recovery?.email.trim();
    if (!email)
      return updateRecovery(
        "error",
        language === "en" ? "Enter your email address." : "กรุณากรอกอีเมล",
      );
    setRecovery((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await recoveryApi().requestApi({ email });
      if (!response.data?.challengeToken) {
        setRecovery((current) => ({
          ...current,
          step: "notice",
          loading: false,
        }));
        return;
      }
      setRecovery((current) => ({
        ...current,
        step: "otp",
        loading: false,
        challengeToken: response.data.challengeToken,
        maskedEmail: response.data.maskedEmail,
      }));
    } catch (requestError) {
      setRecovery((current) => ({
        ...current,
        loading: false,
        error:
          requestError.response?.data?.message ||
          (language === "en"
            ? "Unable to send a code."
            : "ไม่สามารถส่งรหัสยืนยันได้"),
      }));
    }
  };
  const verifyRecoveryCode = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(recovery?.otp || ""))
      return updateRecovery(
        "error",
        language === "en" ? "Enter the 6-digit code." : "กรุณากรอกรหัส 6 หลัก",
      );
    setRecovery((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await recoveryApi().verifyApi({
        challengeToken: recovery.challengeToken,
        otp: recovery.otp,
      });
      setRecovery((current) => ({
        ...current,
        step: "password",
        loading: false,
        recoveryToken: response.data.recoveryToken,
      }));
    } catch (requestError) {
      setRecovery((current) => ({
        ...current,
        loading: false,
        error:
          requestError.response?.data?.message ||
          (language === "en"
            ? "Unable to verify the code."
            : "ไม่สามารถยืนยันรหัสได้"),
      }));
    }
  };
  const resetRecoveredPassword = async (event) => {
    event.preventDefault();
    if (!isStrongPassword(recovery?.password))
      return updateRecovery(
        "error",
        language === "en"
          ? "Your password does not meet every requirement below."
          : "รหัสผ่านยังไม่ตรงตามเงื่อนไขทุกข้อ",
      );
    if (recovery.password !== recovery.confirmPassword)
      return updateRecovery(
        "error",
        language === "en"
          ? "Passwords do not match."
          : "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
      );
    setRecovery((current) => ({ ...current, loading: true, error: "" }));
    try {
      await recoveryApi().resetApi({
        recoveryToken: recovery.recoveryToken,
        password: recovery.password,
      });
      setRecovery((current) => ({
        ...current,
        step: "success",
        loading: false,
      }));
    } catch (requestError) {
      setRecovery((current) => ({
        ...current,
        loading: false,
        error:
          requestError.response?.data?.message ||
          (language === "en"
            ? "Unable to reset the password."
            : "ไม่สามารถตั้งรหัสผ่านใหม่ได้"),
      }));
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
        if (response.data?.requiresOtp) {
          setStaffOtp(response.data);
          setOtpValue("");
          return;
        }
        if (!response.data?.success || !response.data?.token)
          throw new Error("INVALID_LOGIN_RESPONSE");
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

  const verifyStaffOtp = async (event) => {
    event.preventDefault();
    if (!staffOtp || !/^\d{6}$/.test(otpValue)) {
      setError(
        language === "en"
          ? "Enter the 6-digit verification code."
          : "กรุณากรอกรหัสยืนยัน 6 หลัก",
      );
      return;
    }
    setError("");
    setLoading(true);
    try {
      const response = staffOtp.emailVerification
        ? await verifyStaffEmailApi({
            challengeToken: staffOtp.challengeToken,
            otp: otpValue,
          })
        : await verifyStaffOtpApi({
            challengeToken: staffOtp.challengeToken,
            otp: otpValue,
          });
      if (staffOtp.emailVerification && response.data?.requiresLogin) {
        setStaffOtp(null);
        setOtpValue("");
        setNotice(
          language === "en"
            ? "Your email has been verified. Sign in below with your usual username and password to continue."
            : "ยืนยันอีเมลสำเร็จแล้ว กรุณาเข้าสู่ระบบด้านล่างด้วยชื่อผู้ใช้และรหัสผ่านเดิมเพื่อดำเนินการต่อ",
        );
        return;
      }
      if (!response.data?.success || !response.data?.token)
        throw new Error("INVALID_OTP_RESPONSE");
      sessionStorage.setItem("suth_user", JSON.stringify(response.data.user));
      sessionStorage.setItem("suth_token", response.data.token);
      navigate("/admin/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          (language === "en"
            ? "Unable to verify the code."
            : "ไม่สามารถยืนยันรหัสได้"),
      );
    } finally {
      setLoading(false);
    }
  };
  const resendStaffOtp = async () => {
    if (!staffOtp) return;
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await resendStaffOtpApi({
        challengeToken: staffOtp.challengeToken,
        emailVerification: Boolean(staffOtp.emailVerification),
      });
      setStaffOtp((current) => ({
        ...current,
        resendAfter: response.data.resendAfter,
      }));
      setNotice(
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
    <main
      className={`patient-auth-page patient-login-page ${isStaff ? "staff-login-page" : "patient-civic-auth-page"}`}
    >
      <div className="patient-auth-toolbar">
        <Link
          className="patient-auth-home"
          to="/"
          aria-label={t("patient_auth.back_home", "กลับหน้าแรก")}
        >
          <FiArrowLeft aria-hidden="true" />
          <span>{t("patient_auth.back_home", "กลับหน้าแรก")}</span>
        </Link>
        <PatientLanguageSwitcher />
      </div>

      <section
        className={`patient-login-shell ${isStaff ? "" : "patient-civic-shell"}`}
        aria-label={content.pageLabel}
      >
        <aside
          className={`patient-login-intro ${isStaff ? "staff-login-intro" : "patient-civic-intro"}`}
        >
          <img className="patient-login-logo" src={logo} alt="SUTH" />
          <div className="patient-login-intro-copy">
            <p className="patient-login-kicker">{content.kicker}</p>
            <h2>{content.introTitle}</h2>
            <p>{content.introDescription}</p>
          </div>
          <div
            className="patient-login-benefits"
            aria-label={content.pageLabel}
          >
            {content.benefits.map(([Icon, label]) => (
              <div className="patient-login-benefit" key={label}>
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="patient-login-form-panel">
          <div
            className="patient-login-role-switcher"
            role="tablist"
            aria-label={t("patient_auth.role_switcher_label")}
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isStaff}
              className={!isStaff ? "is-active" : ""}
              onClick={() => selectRole("patient")}
            >
              {t("patient_auth.role_patient")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isStaff}
              className={isStaff ? "is-active" : ""}
              onClick={() => selectRole("staff")}
            >
              {t("patient_auth.role_staff")}
            </button>
          </div>

          <div className="patient-login-heading">
            <span className="patient-login-heading-icon" aria-hidden="true">
              <IntroIcon />
            </span>
            <div>
              <h1 id={titleId}>{content.title}</h1>
              <p>{content.subtitle}</p>
            </div>
          </div>

          {error && (
            <div className="patient-auth-error" role="alert">
              <FiAlertCircle aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="patient-auth-notice" role="status">
              <FiShield aria-hidden="true" />
              <span>{notice}</span>
            </div>
          )}

          {recovery ? (
            <section
              className="patient-recovery-flow"
              aria-labelledby="password-recovery-title"
              aria-busy={recovery.loading}
            >
              <div
                className="patient-recovery-progress"
                aria-label={
                  language === "en"
                    ? "Password recovery progress"
                    : "ขั้นตอนการตั้งรหัสผ่านใหม่"
                }
              >
                {[
                  ["email", language === "en" ? "Email" : "อีเมล"],
                  ["otp", language === "en" ? "Code" : "รหัส"],
                  ["password", language === "en" ? "New password" : "รหัสใหม่"],
                ].map(([step, label], index) => (
                  <span
                    className={
                      ["notice", "success"].includes(recovery.step)
                        ? "is-complete"
                        : recovery.step === step
                          ? "is-current"
                          : ""
                    }
                    key={step}
                  >
                    <b>{index + 1}</b>
                    {label}
                  </span>
                ))}
              </div>
              <div className="patient-recovery-heading">
                <span aria-hidden="true">
                  <FiMail />
                </span>
                <div>
                  <h2 id="password-recovery-title">{recoveryCopy}</h2>
                  <p>
                    {recovery.step === "email"
                      ? language === "en"
                        ? "Enter the email address linked to your account."
                        : "กรอกอีเมลที่ผูกกับบัญชีของคุณ"
                      : recovery.step === "otp"
                        ? language === "en"
                          ? `Enter the code sent to ${recovery.maskedEmail}.`
                          : `กรอกรหัสที่ส่งไปยัง ${recovery.maskedEmail}`
                        : language === "en"
                          ? "Choose a new password for your account."
                          : "ตั้งรหัสผ่านใหม่เพื่อกลับเข้าสู่ระบบ"}
                  </p>
                </div>
              </div>
              {recovery.error && (
                <div className="patient-auth-error" role="alert">
                  <FiAlertCircle aria-hidden="true" />
                  <span>{recovery.error}</span>
                </div>
              )}
              {recovery.step === "email" && (
                <form
                  className="patient-login-form"
                  onSubmit={requestRecoveryCode}
                  noValidate
                >
                  <div className="patient-auth-field">
                    <label htmlFor="recovery-email">
                      {language === "en" ? "Email address" : "อีเมล"}
                    </label>
                    <input
                      id="recovery-email"
                      type="email"
                      autoComplete="email"
                      value={recovery.email}
                      onChange={(event) =>
                        updateRecovery("email", event.target.value)
                      }
                      placeholder="name@example.com"
                      disabled={recovery.loading}
                      autoFocus
                      required
                    />
                  </div>
                  <button
                    className="patient-auth-button"
                    type="submit"
                    disabled={recovery.loading}
                  >
                    {recovery.loading
                      ? language === "en"
                        ? "Sending code..."
                        : "กำลังส่งรหัส..."
                      : language === "en"
                        ? "Send verification code"
                        : "ส่งรหัสยืนยัน"}
                  </button>
                </form>
              )}
              {recovery.step === "otp" && (
                <form
                  className="patient-login-form"
                  onSubmit={verifyRecoveryCode}
                  noValidate
                >
                  <div className="patient-auth-field">
                    <label>
                      {language === "en"
                        ? "6-digit verification code"
                        : "รหัสยืนยัน 6 หลัก"}
                    </label>
                    <OtpCodeInput
                      idPrefix="recovery-otp"
                      value={recovery.otp}
                      onChange={(value) => updateRecovery("otp", value)}
                      disabled={recovery.loading}
                    />
                  </div>
                  <button
                    className="patient-auth-button"
                    type="submit"
                    disabled={recovery.loading}
                  >
                    {recovery.loading
                      ? language === "en"
                        ? "Verifying..."
                        : "กำลังยืนยัน..."
                      : language === "en"
                        ? "Verify code"
                        : "ยืนยันรหัส"}
                  </button>
                </form>
              )}
              {recovery.step === "password" && (
                <form
                  className="patient-login-form"
                  onSubmit={resetRecoveredPassword}
                  noValidate
                >
                  <div className="patient-auth-field">
                    <label htmlFor="recovery-password">
                      {language === "en" ? "New password" : "รหัสผ่านใหม่"}
                    </label>
                    <PasswordInput
                      id="recovery-password"
                      language={language}
                      minLength={PASSWORD_MIN_LENGTH}
                      value={recovery.password}
                      onChange={(event) =>
                        updateRecovery("password", event.target.value)
                      }
                      aria-describedby="recovery-password-rules"
                      disabled={recovery.loading}
                      autoFocus
                      required
                    />
                    <PasswordRules
                      id="recovery-password-rules"
                      password={recovery.password}
                      language={language}
                    />
                  </div>
                  <div className="patient-auth-field">
                    <label htmlFor="recovery-confirm-password">
                      {language === "en"
                        ? "Confirm new password"
                        : "ยืนยันรหัสผ่านใหม่"}
                    </label>
                    <PasswordInput
                      id="recovery-confirm-password"
                      language={language}
                      minLength={PASSWORD_MIN_LENGTH}
                      value={recovery.confirmPassword}
                      onChange={(event) =>
                        updateRecovery("confirmPassword", event.target.value)
                      }
                      disabled={recovery.loading}
                      required
                    />
                  </div>
                  <button
                    className="patient-auth-button"
                    type="submit"
                    disabled={recovery.loading}
                  >
                    {recovery.loading
                      ? language === "en"
                        ? "Saving..."
                        : "กำลังบันทึก..."
                      : language === "en"
                        ? "Set new password"
                        : "ตั้งรหัสผ่านใหม่"}
                  </button>
                </form>
              )}
              {recovery.step === "notice" && (
                <div className="patient-recovery-result">
                  <FiMail aria-hidden="true" />
                  <p>
                    {language === "en"
                      ? "If this email is linked to an account, a verification code has been sent."
                      : "หากอีเมลนี้ผูกกับบัญชี ระบบได้ส่งรหัสยืนยันให้แล้ว"}
                  </p>
                </div>
              )}
              {recovery.step === "success" && (
                <div className="patient-recovery-result is-success">
                  <FiShield aria-hidden="true" />
                  <p>
                    {language === "en"
                      ? "Password updated. You can sign in now."
                      : "ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว สามารถเข้าสู่ระบบได้เลย"}
                  </p>
                </div>
              )}
              <button
                className="patient-auth-link patient-recovery-back"
                type="button"
                onClick={() => setRecovery(null)}
                disabled={recovery.loading}
              >
                {recovery.step === "success" || recovery.step === "notice"
                  ? language === "en"
                    ? "Back to sign in"
                    : "กลับหน้าเข้าสู่ระบบ"
                  : language === "en"
                    ? "Cancel"
                    : "ยกเลิก"}
              </button>
            </section>
          ) : staffOtp ? (
            <form
              className="patient-login-form patient-otp-flow"
              onSubmit={verifyStaffOtp}
              aria-labelledby={titleId}
              aria-busy={loading}
              noValidate
            >
              <div className="patient-auth-field">
                <label htmlFor="staff-otp">
                  {language === "en"
                    ? "Email verification code"
                    : "รหัสยืนยันทางอีเมล"}
                </label>
                <p className="patient-auth-field-help">
                  {language === "en"
                    ? `A 6-digit code was sent to ${staffOtp.maskedEmail}. It expires in 5 minutes.`
                    : `ส่งรหัส 6 หลักไปที่ ${staffOtp.maskedEmail} แล้ว รหัสมีอายุ 5 นาที`}
                </p>
                <OtpCodeInput
                  idPrefix="staff-otp"
                  value={otpValue}
                  onChange={setOtpValue}
                  disabled={loading}
                />
              </div>
              <button
                className="patient-auth-button"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="patient-auth-spinner" aria-hidden="true" />
                    {language === "en" ? "Verifying..." : "กำลังยืนยัน..."}
                  </>
                ) : language === "en" ? (
                  "Verify and sign in"
                ) : (
                  "ยืนยันและเข้าสู่ระบบ"
                )}
              </button>
              <div className="patient-otp-secondary-actions">
                <button
                  className="patient-auth-link"
                  type="button"
                  onClick={resendStaffOtp}
                  disabled={loading}
                >
                  {language === "en" ? "Send a new code" : "ส่งรหัสใหม่"}
                </button>
                <span aria-hidden="true" />
                <button
                  className="patient-auth-link"
                  type="button"
                  onClick={() => {
                    setStaffOtp(null);
                    setOtpValue("");
                    setError("");
                    setNotice("");
                  }}
                  disabled={loading}
                >
                  {language === "en" ? "Use another account" : "ใช้บัญชีอื่น"}
                </button>
              </div>
            </form>
          ) : (
            <form
              className="patient-login-form"
              onSubmit={submit}
              aria-labelledby={titleId}
              aria-busy={loading}
              noValidate
            >
              <div className="patient-auth-field">
                <label htmlFor="login-username">{content.username}</label>
                <input
                  id="login-username"
                  name="username"
                  autoComplete="username"
                  value={form.username}
                  onChange={updateField("username")}
                  placeholder={content.usernamePlaceholder}
                  disabled={loading}
                  required
                />
              </div>
              <div className="patient-auth-field">
                <label htmlFor="login-password">{content.password}</label>
                <div className="patient-password-control">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={updateField("password")}
                    placeholder={content.passwordPlaceholder}
                    disabled={loading}
                    required
                  />
                  <button
                    className="patient-password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={t(
                      showPassword
                        ? "patient_auth.login.hide_password"
                        : "patient_auth.login.show_password",
                      showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน",
                    )}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>
              <div className="patient-password-help">
                {isStaff ? (
                  <button
                    type="button"
                    onClick={() => startPasswordRecovery(true)}
                  >
                    {t("patient_auth.staff_login.forgot_password")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startPasswordRecovery(false)}
                  >
                    {t("patient_auth.login.forgot_password")}
                  </button>
                )}
              </div>
              <div
                ref={turnstileRef}
                className="patient-turnstile"
                aria-label={t("patient_auth.login.security_label")}
              />
              <button
                className="patient-auth-button"
                type="submit"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="patient-auth-spinner" aria-hidden="true" />
                    {t("patient_auth.login.submitting")}
                  </>
                ) : (
                  t("patient_auth.login.submit")
                )}
              </button>
            </form>
          )}

          {isStaff ? (
            <p className="staff-login-note">
              {t("patient_auth.staff_login.support_note")}
            </p>
          ) : (
            <>
              <div className="patient-login-register">
                <span>{t("patient_auth.login.no_account")}</span>
                <Link
                  className="patient-auth-link"
                  to={`/account/register?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  {t("patient_auth.login.register_link")}
                </Link>
              </div>
              <p className="patient-login-privacy">
                {t("patient_auth.login.privacy_note")}
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
