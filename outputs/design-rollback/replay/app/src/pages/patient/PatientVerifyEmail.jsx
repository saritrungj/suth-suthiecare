import { useState } from "react";
import { Link, useNavigate, useSearchParams, Navigate } from "react-router-dom";
import {
  requestPatientOnboardingEmailApi,
  verifyPatientEmailApi,
} from "../../services/api";
import {
  getPatientSession,
  setPatientSession,
} from "../../utils/patientSession";
import "./PatientAuth.css";
export default function PatientVerifyEmail() {
  const { authenticated, user } = getPatientSession();
  const [params] = useSearchParams(),
    navigate = useNavigate();
  const requested = params.get("returnTo"),
    returnTo =
      requested?.startsWith("/") && !requested.startsWith("//")
        ? requested
        : "/history";
  const [challenge, setChallenge] = useState(null),
    [otp, setOtp] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (!authenticated) return <Navigate to="/account/login" replace />;
  const request = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await requestPatientOnboardingEmailApi();
      setChallenge(data);
    } catch (e) {
      setError(e.response?.data?.message || "ส่งรหัสไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data } = await verifyPatientEmailApi({
        challengeToken: challenge.challengeToken,
        otp,
      });
      setPatientSession(null, data.user);
      navigate(returnTo, { replace: true });
    } catch (e) {
      setError(e.response?.data?.message || "รหัสไม่ถูกต้องหรือหมดอายุ");
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="patient-auth-page">
      <section
        className="patient-login-card patient-email-verification"
        aria-labelledby="verify-email-title"
      >
        <h1 id="verify-email-title">ยืนยันอีเมลนักเรียน</h1>
        <p>ยืนยันอีเมล {user?.email} เพื่อกู้รหัสผ่านด้วยตนเองได้</p>
        {error && <p role="alert">{error}</p>}
        {!challenge ? (
          <button type="button" disabled={busy} onClick={request}>
            {busy ? "กำลังส่ง…" : "ส่งรหัสยืนยัน"}
          </button>
        ) : (
          <form onSubmit={verify}>
            <p role="status">ส่งรหัสแล้ว กรุณาตรวจสอบกล่องจดหมาย</p>
            <label>
              รหัสยืนยัน 6 หลัก
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <button disabled={busy}>
              {busy ? "กำลังยืนยัน…" : "ยืนยันอีเมล"}
            </button>
            <button type="button" disabled={busy} onClick={request}>
              ขอรหัสใหม่
            </button>
          </form>
        )}
        <Link to={returnTo}>ยืนยันภายหลัง</Link>
      </section>
    </main>
  );
}
