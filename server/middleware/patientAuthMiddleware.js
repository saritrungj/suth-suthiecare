const jwt = require("jsonwebtoken");
const { db } = require("../utils/patientAuth");

const loadPatientFromToken = async (req) => {
  const session = await require("../services/sessionService").loadSession(
    req,
    "patient",
  );
  if (!session) return null;
  const decoded = {
    sub: session.account_id,
    token_version: session.auth_version,
  };
  const [rows] = await db.query(
    "SELECT id, username, email,email_encrypted, email_verified_at, pending_email,pending_email_encrypted, first_name_encrypted, last_name_encrypted, identity_hash, phone_encrypted, status, token_version, auth_version, verified_at, must_change_password FROM patient_accounts WHERE id = ? LIMIT 1",
    [decoded.sub],
  );
  const account = rows[0];
  if (
    !account ||
    account.status !== "active" ||
    Number(account.token_version) !== Number(decoded.token_version)
  ) {
    throw Object.assign(new Error("PATIENT_SESSION_CHANGED"), {
      status: 401,
      code: "PATIENT_SESSION_CHANGED",
    });
  }
  return account;
};

// Accounts created for students by a school import start with a temporary
// password. Until it is changed, only the password change itself, the profile
// read and logout are allowed.
const passwordChangeRequired = (res) =>
  res.status(403).json({
    success: false,
    code: "PASSWORD_CHANGE_REQUIRED",
    message: "กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งาน",
  });
const mustChangePassword = (account) =>
  Boolean(Number(account?.must_change_password || 0));

const authenticate =
  ({ optional = false, allowPendingPasswordChange = false } = {}) =>
  async (req, res, next) => {
    let account;
    try {
      account = await loadPatientFromToken(req);
    } catch (error) {
      if (
        optional &&
        error.status === 401 &&
        [
          "INVALID_SESSION",
          "SESSION_EXPIRED",
          "SESSION_REVOKED",
          "PATIENT_SESSION_CHANGED",
        ].includes(error.code)
      ) {
        const session = require("../services/sessionService");
        res.clearCookie(session.cookieName("patient"), session.options());
        return next();
      }
      return res.status(error.status || 401).json({
        code: error.code,
        success: false,
        message: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่",
      });
    }
    if (!account) {
      if (optional) return next();
      return res
        .status(401)
        .json({ success: false, message: "กรุณาเข้าสู่ระบบผู้รับบริการ" });
    }
    if (!allowPendingPasswordChange && mustChangePassword(account))
      return passwordChangeRequired(res);
    req.patient = account;
    return next();
  };

const verifyPatientToken = authenticate();
const attachOptionalPatient = authenticate({ optional: true });
const verifyPatientTokenAllowingPasswordChange = authenticate({
  allowPendingPasswordChange: true,
});

module.exports = {
  verifyPatientToken,
  attachOptionalPatient,
  verifyPatientTokenAllowingPasswordChange,
  mustChangePassword,
};
