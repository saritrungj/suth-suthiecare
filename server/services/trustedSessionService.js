const crypto = require("crypto");

const TRUSTED_SESSION_COOKIE = "suth_staff_trusted";
const trustedTtlSeconds = () =>
  Number(process.env.STAFF_TRUSTED_SESSION_SECONDS || 3600);
const tokenHash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

async function issueTrustedSession(db, { accountId, authVersion = 0 }) {
  const token = newToken();
  const ttl = trustedTtlSeconds();
  await db.query(
    "INSERT INTO staff_trusted_sessions (account_id, token_hash, auth_version_snapshot, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))",
    [accountId, tokenHash(token), authVersion, ttl],
  );
  return { token, maxAgeMs: ttl * 1000 };
}

async function verifyTrustedSession(db, { accountId, token, authVersion = 0 }) {
  if (!token) return false;
  const [rows] = await db.query(
    "SELECT id FROM staff_trusted_sessions WHERE account_id=? AND token_hash=? AND auth_version_snapshot=? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1",
    [accountId, tokenHash(token), authVersion],
  );
  return Boolean(rows[0]);
}

async function revokeTrustedSession(db, { token }) {
  if (!token) return;
  await db.query(
    "UPDATE staff_trusted_sessions SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL",
    [tokenHash(token)],
  );
}

function trustedSessionCookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/api",
  };
}

module.exports = {
  TRUSTED_SESSION_COOKIE,
  issueTrustedSession,
  verifyTrustedSession,
  revokeTrustedSession,
  trustedSessionCookieOptions,
};
