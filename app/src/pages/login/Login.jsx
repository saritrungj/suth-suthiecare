import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { loginApi } from "../../services/api";
import "./Login.css";
import logo from "../../assets/logoSUTH.png";
import loginImage from "../../assets/login-image.png";
import { FiEye, FiEyeOff } from "react-icons/fi";

export default function Login() {
  const navigate = useNavigate();

  // 🟢 1. บังคับ Logout ทันทีที่หลุดเข้ามาหน้า
  useEffect(() => {
    localStorage.removeItem("suth_user");
    localStorage.removeItem("suth_token");
    sessionStorage.removeItem("suth_user");
    sessionStorage.removeItem("suth_token");

    // แจ้งแท็บอื่นๆ ที่กำลังเปิดอยู่ให้ Logout ด้วย
    localStorage.setItem("SUTH_LOGOUT", Date.now().toString());
    localStorage.removeItem("SUTH_LOGOUT");
  }, []);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  const inputRef = useRef(null);

  // 🟢 Refs สำหรับ Turnstile
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null); // เก็บ ID ของ Widget ที่สร้างขึ้นเพื่อใช้ Reset

  /* ── โหลด Cloudflare Turnstile script และ render widget ── */
  useEffect(() => {
    const renderWidget = () => {
      // เช็คว่ามี script แล้ว, มีกล่อง container แล้ว และยังไม่ได้ render widget เดิมซ้ำ
      if (
        window.turnstile &&
        turnstileRef.current &&
        widgetIdRef.current === null
      ) {
        turnstileRef.current.innerHTML = ""; // เคลียร์ DOM ให้สะอาดก่อน render
        widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
          sitekey: process.env.REACT_APP_TURNSTILE_SITE_KEY,
          theme: "light",
          language: "th",
          callback: (token) => setTurnstileToken(token),
          "expired-callback": () => setTurnstileToken(""),
          "error-callback": () => setTurnstileToken(""),
        });
      }
    };

    if (!document.getElementById("cf-turnstile-script")) {
      const script = document.createElement("script");
      script.id = "cf-turnstile-script";
      // 🟢 ใส่ render=explicit เพื่อให้เราคุมการสร้าง Widget ด้วย React ได้สมบูรณ์
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else if (window.turnstile) {
      renderWidget();
    }

    return () => {
      // 🟢 ลบ Widget อย่างถูกต้องเมื่อ Unmount
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        } catch (e) {}
      }
    };
  }, []);

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username || !password) {
      setError("กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน");
      return;
    }

    if (!turnstileToken) {
      setError("กรุณายืนยันว่าคุณไม่ใช่บอท");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 🟢 ส่ง Payload ที่ครอบคลุมชื่อ Key ที่ Backend อาจจะเรียกหาอยู่ (hcaptchaToken)
      const payload = {
        username,
        password,
        turnstileToken: turnstileToken,
        hcaptchaToken: turnstileToken, // เผื่อ backend ยังดึงค่าจาก req.body.hcaptchaToken
        cfTurnstileResponse: turnstileToken, // เผื่อ backend ใช้ชื่อมาตรฐานของ Cloudflare
      };

      const response = await loginApi(payload);

      if (response.data.success) {
        const { user, token } = response.data;

        // 🟢 เก็บลง sessionStorage เท่านั้นเพื่อความปลอดภัย (Session จะหายไปเมื่อปิดเบราว์เซอร์)
        sessionStorage.setItem("suth_user", JSON.stringify(user));
        sessionStorage.setItem("suth_token", token);

        navigate("/admin/dashboard");
      }
    } catch (err) {
      // 🟢 Reset Turnstile ให้ถูกต้องด้วย Widget ID
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.reset(widgetIdRef.current);
        } catch {}
      }
      setTurnstileToken("");

      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <div className="login-left__blob login-left__blob--1" />
        <div className="login-left__blob login-left__blob--2" />
        <div className="login-left__blob login-left__blob--3" />
        <span className="login-left__spark login-left__spark--1">✦</span>
        <span className="login-left__spark login-left__spark--2">✦</span>
        <span className="login-left__spark login-left__spark--3">✦</span>
        <div className="login-left__illust">
          <img src={loginImage} alt="Login Illustration" />
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="login-logo-float">
          <img src={logo} alt="SUTH Logo" className="login-logo-img" />
        </div>

        <div className="login-right-card">
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {/* ── Username ── */}
            <div className="login-field">
              <div
                className="login-input-wrap"
                style={{ position: "relative" }}
              >
                <span className="login-input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <circle
                      cx="12"
                      cy="8"
                      r="4"
                      stroke="#b0b0b0"
                      strokeWidth="2"
                    />
                    <path
                      d="M4 20c0-4 4-7 8-7s8 3 8 7"
                      stroke="#b0b0b0"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <input
                  ref={inputRef}
                  className={`login-input ${error ? "err" : ""}`}
                  type="text"
                  placeholder="ชื่อผู้ใช้งาน "
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  autoComplete="off"
                />
              </div>
            </div>

            {/* ── Password ── */}
            <div className="login-field">
              <div
                className="login-input-wrap"
                style={{ position: "relative" }}
              >
                <span className="login-input-icon">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <rect
                      x="5"
                      y="11"
                      width="14"
                      height="10"
                      rx="2"
                      stroke="#b0b0b0"
                      strokeWidth="2"
                    />
                    <path
                      d="M8 11V7a4 4 0 018 0v4"
                      stroke="#b0b0b0"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="12" cy="16" r="1.5" fill="#b0b0b0" />
                  </svg>
                </span>
                <input
                  className={`login-input ${error ? "err" : ""}`}
                  type={showPassword ? "text" : "password"}
                  placeholder="รหัสผ่าน"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  autoComplete="current-password"
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
              {error && (
                <p className="login-error">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: "8px" }}
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  {error}
                </p>
              )}
            </div>

            {/* ✅ Cloudflare Turnstile */}
            <div className="turnstile-wrap">
              <div ref={turnstileRef} />
            </div>

            {/* ── Login Button ── */}
            <button
              type="submit"
              className={`login-btn ${loading ? "loading" : ""}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="login-btn__spinner" />
                  กำลังตรวจสอบ...
                </>
              ) : (
                "ล็อกอิน"
              )}
            </button>
          </form>

          <button className="login-back" onClick={() => navigate("/")}>
            ← กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
}
