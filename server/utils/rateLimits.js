// Rate limits that still work when a whole school shares one public IP.
//
// - Login: each "username + IP" has its own small budget of failed attempts,
//   so guessing one account's password is still stopped, while every other
//   student behind the same IP keeps logging in. A larger per-IP ceiling caps
//   the total attempts (password spraying) from one address.
// - API: a request that carries a session is counted per session; a request
//   without one is counted per IP. A high per-IP ceiling on all requests stops
//   anyone from escaping the limit by sending made-up session cookies.
//
// Every number can be changed with an environment variable (see each limiter).
// The store is in memory, which matches the single PM2 fork in
// ecosystem.config.cjs; a cluster would need a shared store.
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { clientIpKeyGenerator } = require("./clientIp");

const positiveIntFromEnv = (name, fallback) => {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("base64url").slice(0, 32);

const SESSION_COOKIE = /^(?:__Host-)?suth_[a-z]+_session$/;

// The raw session cookie (or bearer token) the request carries, unverified.
// Only its hash is used as a key; a forged value just gets its own bucket,
// which the per-IP ceiling still covers.
function sessionCredential(req) {
  const bearer = String(req.headers.authorization || "").match(
    /^Bearer\s+(\S+)$/i,
  );
  if (bearer) return bearer[1];
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (SESSION_COOKIE.test(name) && value) return value;
  }
  return null;
}

const loginUsername = (req) =>
  String(req.body?.username || "")
    .trim()
    .toLowerCase()
    .slice(0, 120);

// Returns [per-IP ceiling, per-username+IP limiter] for a login route.
// Only failed attempts count against the account budget, so a student who
// logs in, logs out and logs in again is never blocked.
function loginLimiters({ name, windowMs, perAccount, perIp, message }) {
  const shared = {
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  };
  const ipCeiling = rateLimit({
    ...shared,
    limit: perIp,
    keyGenerator: (req) => `${name}:ip:${clientIpKeyGenerator(req)}`,
  });
  const accountLimiter = rateLimit({
    ...shared,
    limit: perAccount,
    skipSuccessfulRequests: true,
    keyGenerator: (req) =>
      `${name}:account:${clientIpKeyGenerator(req)}:${hash(loginUsername(req))}`,
  });
  return [ipCeiling, accountLimiter];
}

function patientLoginLimiters() {
  return loginLimiters({
    name: "patient-login",
    windowMs:
      positiveIntFromEnv("PATIENT_LOGIN_WINDOW_MINUTES", 15) * 60 * 1000,
    perAccount: positiveIntFromEnv(
      "PATIENT_LOGIN_MAX_FAILURES_PER_ACCOUNT",
      10,
    ),
    perIp: positiveIntFromEnv("PATIENT_LOGIN_MAX_PER_IP", 2000),
    message: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่",
  });
}

function staffLoginLimiters() {
  return loginLimiters({
    name: "staff-login",
    windowMs: positiveIntFromEnv("STAFF_LOGIN_WINDOW_MINUTES", 1) * 60 * 1000,
    perAccount: positiveIntFromEnv("STAFF_LOGIN_MAX_FAILURES_PER_ACCOUNT", 5),
    perIp: positiveIntFromEnv("STAFF_LOGIN_MAX_PER_IP", 100),
    message: "พยายามเข้าสู่ระบบมากเกินไป กรุณารอสักครู่",
  });
}

// Returns [per-IP ceiling, per-session-or-IP limiter] for the whole API.
function apiLimiters() {
  const shared = {
    windowMs: 60 * 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: "มีการเรียกใช้งานมากเกินไป กรุณารอสักครู่",
    },
  };
  const perSession = positiveIntFromEnv("API_RATE_LIMIT_PER_SESSION", 300);
  const perAnonymousIp = positiveIntFromEnv(
    "API_RATE_LIMIT_PER_ANONYMOUS_IP",
    1000,
  );
  const ipCeiling = rateLimit({
    ...shared,
    limit: positiveIntFromEnv("API_RATE_LIMIT_PER_IP", 20000),
    keyGenerator: (req) => `api:ip:${clientIpKeyGenerator(req)}`,
  });
  const requestLimiter = rateLimit({
    ...shared,
    limit: (req) => (sessionCredential(req) ? perSession : perAnonymousIp),
    keyGenerator: (req) => {
      const credential = sessionCredential(req);
      return credential
        ? `api:session:${hash(credential)}`
        : `api:anonymous:${clientIpKeyGenerator(req)}`;
    },
  });
  return [ipCeiling, requestLimiter];
}

module.exports = {
  apiLimiters,
  patientLoginLimiters,
  staffLoginLimiters,
  sessionCredential,
  positiveIntFromEnv,
};
