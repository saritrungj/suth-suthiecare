const jwt = require("jsonwebtoken");
const { db } = require("../utils/patientAuth");

const loadPatientFromToken = async (req) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const decoded = jwt.verify(token, process.env.PATIENT_JWT_SECRET || process.env.JWT_SECRET, {
    algorithms: ["HS256"],
  });
  if (decoded.account_type !== "patient" || !decoded.sub) throw new Error("invalid patient token");
  const [rows] = await db.query(
    "SELECT id, username, first_name_encrypted, last_name_encrypted, identity_hash, phone_encrypted, status, token_version, verified_at FROM patient_accounts WHERE id = ? LIMIT 1",
    [decoded.sub],
  );
  const account = rows[0];
  if (!account || account.status !== "active" || Number(account.token_version) !== Number(decoded.token_version)) {
    throw new Error("inactive patient session");
  }
  return account;
};

const verifyPatientToken = async (req, res, next) => {
  try {
    const account = await loadPatientFromToken(req);
    if (!account) return res.status(401).json({ success: false, message: "กรุณาเข้าสู่ระบบผู้รับบริการ" });
    req.patient = account;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" });
  }
};

const attachOptionalPatient = async (req, res, next) => {
  try {
    const account = await loadPatientFromToken(req);
    if (account) req.patient = account;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" });
  }
};

module.exports = { verifyPatientToken, attachOptionalPatient };
