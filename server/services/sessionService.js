const crypto = require("crypto");
const db = require("../config/db");
const { httpError } = require("../utils/operationalOwnership");
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
const production = () => process.env.NODE_ENV === "production";
const cookieName = (type) =>
  (production() ? "__Host-" : "") + `suth_${type}_session`;
const options = () => ({
  httpOnly: true,
  secure: production(),
  sameSite: "lax",
  path: "/",
});
function csrf(token) {
  const secret = process.env.SESSION_CSRF_SECRET || process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET_REQUIRED");
  return crypto
    .createHmac("sha256", secret)
    .update("csrf:" + token)
    .digest("base64url");
}
const absolute = (type) => (type === "staff" ? 28800 : 7200);
const idle = (type) => (type === "staff" ? 900 : 1800);
async function establishSession(req, res, type, account, { mfa = true } = {}) {
  if (type === "staff" && production() && !mfa)
    throw httpError(403, "MFA_REQUIRED");
  const token = crypto.randomBytes(32).toString("base64url"),
    csrfToken = csrf(token);
  const version = Number(
    type === "staff" ? account.auth_version || 0 : account.token_version || 0,
  );
  const prior = req.cookies?.[cookieName(type)];
  if (prior)
    await db.query(
      "UPDATE auth_sessions SET revoked_at=NOW() WHERE token_hash=? AND account_type=?",
      [sha(prior), type],
    );
  await db.query(
    "INSERT INTO auth_sessions (token_hash,account_type,account_id,auth_version,csrf_hash,mfa_verified_at,last_seen_at,expires_at) VALUES (?,?,?,?,?,IF(?,NOW(),NULL),NOW(),DATE_ADD(NOW(),INTERVAL ? SECOND))",
    [
      sha(token),
      type,
      account.id,
      version,
      sha(csrfToken),
      mfa ? 1 : 0,
      absolute(type),
    ],
  );
  res.cookie(cookieName(type), token, {
    ...options(),
    maxAge: absolute(type) * 1000,
  });
  return { csrf_token: csrfToken };
}
async function loadSession(req, type) {
  if (req.privateSessions?.[type]) return req.privateSessions[type];
  const token = req.cookies?.[cookieName(type)];
  if (!token) return null;
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw httpError(401, "INVALID_SESSION");
  const [rows] = await db.query(
    "SELECT * FROM auth_sessions WHERE token_hash=? AND account_type=? AND revoked_at IS NULL AND expires_at>NOW() AND last_seen_at>DATE_SUB(NOW(),INTERVAL ? SECOND) LIMIT 1",
    [sha(token), type, idle(type)],
  );
  const session = rows[0];
  if (
    !session ||
    (type === "staff" && production() && !session.mfa_verified_at)
  ) {
    await db.query(
      'UPDATE auth_sessions SET revoked_at=NOW() WHERE token_hash=? AND account_type=? AND revoked_at IS NULL AND (expires_at<=NOW() OR last_seen_at<=DATE_SUB(NOW(),INTERVAL ? SECOND) OR (account_type="staff" AND mfa_verified_at IS NULL))',
      [sha(token), type, idle(type)],
    );
    throw httpError(401, "SESSION_EXPIRED");
  }
  const expected = csrf(token);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const value = req.get("X-CSRF-Token") || "";
    const left = Buffer.from(sha(value)),
      right = Buffer.from(session.csrf_hash);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right))
      throw httpError(403, "CSRF_REJECTED");
    const origin = req.get("Origin"),
      allowed = (
        process.env.CORS_ORIGINS ||
        process.env.FRONTEND_URL ||
        "http://localhost:3001,http://127.0.0.1:4173"
      )
        .split(",")
        .map((v) => v.trim());
    if (!origin || !allowed.includes(origin))
      throw httpError(403, "ORIGIN_REJECTED");
  }
  const [updated] = await db.query(
    "UPDATE auth_sessions SET last_seen_at=NOW() WHERE id=? AND revoked_at IS NULL AND expires_at>NOW()",
    [session.id],
  );
  if (updated.affectedRows !== 1) throw httpError(401, "SESSION_REVOKED");
  session.csrf_token = expected;
  req.privateSessions ||= {};
  req.privateSessions[type] = session;
  return session;
}
async function revokeSession(req, res, type) {
  const token = req.cookies?.[cookieName(type)];
  if (token)
    await db.query(
      "UPDATE auth_sessions SET revoked_at=NOW() WHERE token_hash=? AND account_type=?",
      [sha(token), type],
    );
  res.clearCookie(cookieName(type), options());
}
module.exports = {
  sha,
  csrf,
  cookieName,
  options,
  establishSession,
  loadSession,
  revokeSession,
};
