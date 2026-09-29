const { Resend } = require("resend");

function configured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

function otpEmailCopy(purpose) {
  switch (purpose) {
    case "staff_login":
      return {
        subject: "รหัสยืนยันการเข้าสู่ระบบ | SUTHieCare โรงพยาบาล มทส.",
        action: "เข้าสู่ระบบสำหรับเจ้าหน้าที่",
      };
    case "account_recovery":
      return {
        subject: "รหัสยืนยันการตั้งรหัสผ่านใหม่ | SUTHieCare โรงพยาบาล มทส.",
        action: "ยืนยันตัวตนเพื่อกำหนดรหัสผ่านใหม่",
      };
    default:
      return {
        subject: "รหัสยืนยันอีเมล | SUTHieCare โรงพยาบาล มทส.",
        action: "ยืนยันที่อยู่อีเมลของคุณ",
      };
  }
}

async function sendOtpEmail({ to, otp, purpose, idempotencyKey }) {
  if (!configured()) {
    const error = new Error("Email service is not configured");
    error.code = "EMAIL_NOT_CONFIGURED";
    throw error;
  }
  const { subject, action } = otpEmailCopy(purpose);
  const text = `เรียน ผู้ใช้บริการระบบ SUTHieCare

โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี (รพ. มทส.) ได้รับคำขอ${action}

รหัสยืนยันของคุณคือ: ${otp}

รหัสนี้มีอายุการใช้งาน 5 นาที โปรดใช้รหัสภายในเวลาที่กำหนด และไม่เปิดเผยรหัสให้ผู้อื่นทราบ

หากท่านไม่ได้เป็นผู้ดำเนินการ โปรดเพิกเฉยต่ออีเมลฉบับนี้

ขอแสดงความนับถือ
ระบบ SUTHieCare
โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี`;
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:'Sarabun','Noto Sans Thai',Arial,sans-serif;color:#1f2f3f;line-height:1.65">
  <p style="margin:0 0 4px;font-size:18px;font-weight:700;color:#15283d">SUTHieCare</p>
  <p style="margin:0 0 24px;color:#526578">โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี (รพ. มทส.)</p>
  <p>เรียน ผู้ใช้บริการระบบ SUTHieCare</p>
  <p>โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี ได้รับคำขอ${action}</p>
  <p style="margin:24px 0 8px">รหัสยืนยันของคุณคือ</p>
  <p style="margin:0 0 24px;padding:16px;background:#eff9f2;border:1px solid #93c9a7;border-radius:10px;color:#185c38;font-size:28px;font-weight:700;letter-spacing:6px;text-align:center">${otp}</p>
  <p>รหัสนี้มีอายุการใช้งาน 5 นาที โปรดใช้รหัสภายในเวลาที่กำหนด และไม่เปิดเผยรหัสให้ผู้อื่นทราบ</p>
  <p>หากท่านไม่ได้เป็นผู้ดำเนินการ โปรดเพิกเฉยต่ออีเมลฉบับนี้</p>
  <p style="margin:24px 0 0">ขอแสดงความนับถือ<br>ระบบ SUTHieCare<br>โรงพยาบาลมหาวิทยาลัยเทคโนโลยีสุรนารี</p>
</div>`;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send(
    {
      from: process.env.RESEND_FROM_EMAIL,
      to: [to],
      subject,
      text,
      html,
    },
    { idempotencyKey },
  );
  if (error) {
    const sendError = new Error(error.message || "Unable to send email");
    sendError.code = "EMAIL_SEND_FAILED";
    throw sendError;
  }
  return data?.id || null;
}

module.exports = { configured, otpEmailCopy, sendOtpEmail };
