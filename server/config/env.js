const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

process.env.TZ = "Asia/Bangkok";

const serverRoot = path.resolve(__dirname, "..");
const mode = process.env.NODE_ENV || "development";

const envFilesByMode = {
  development: [".env.local", ".env.development", ".env"],
  test: [".env.test", ".env"],
  production: [".env.production", ".env"],
};

const envFiles = (envFilesByMode[mode] || [`.env.${mode}`, ".env"])
  .map((file) => path.join(serverRoot, file))
  .filter((file) => fs.existsSync(file));

// Files are ordered from most specific to least specific. dotenv keeps values
// already supplied by Docker, PM2, CI, or the operating system as top priority.
if (envFiles.length) dotenv.config({ path: envFiles, quiet: true });

if (mode === "production") {
  const required = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET",
    "AES_KEY",
    "AES_SEARCH_KEY",
    "FRONTEND_URL",
    "CORS_ORIGINS",
    "TURNSTILE_SECRET_KEY",
    "SESSION_CSRF_SECRET",
    "DB_TLS_CA_FILE",
    "DATA_ENCRYPTION_KEYS",
    "DATA_ENCRYPTION_ACTIVE_KEY",
  ];
  const missing = required.filter(
    (key) => !String(process.env[key] || "").trim(),
  );
  if (missing.length) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(", ")}`,
    );
  }
  if (process.env.DISABLE_TURNSTILE === "true") {
    throw new Error("DISABLE_TURNSTILE must never be true in production");
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters in production",
    );
  }
  if (!/^[0-9a-f]{64}$/i.test(String(process.env.AES_KEY))) {
    throw new Error(
      "AES_KEY must contain exactly 64 hexadecimal characters in production",
    );
  }
  if (String(process.env.AES_SEARCH_KEY).length < 32) {
    throw new Error(
      "AES_SEARCH_KEY must contain at least 32 characters in production",
    );
  }
  if (mode === "production") {
    const otpRequired = [
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
      "OTP_HMAC_SECRET",
    ];
    const missingOtp = otpRequired.filter(
      (key) => !String(process.env[key] || "").trim(),
    );
    if (missingOtp.length)
      throw new Error(
        `Missing OTP environment variables: ${missingOtp.join(", ")}`,
      );
    if (String(process.env.OTP_HMAC_SECRET).length < 32)
      throw new Error(
        "OTP_HMAC_SECRET must contain at least 32 characters in production",
      );
  }
  if (
    process.env.SESSION_CSRF_SECRET.length < 32 ||
    process.env.SESSION_CSRF_SECRET === process.env.JWT_SECRET ||
    process.env.SESSION_CSRF_SECRET === process.env.AES_SEARCH_KEY
  )
    throw new Error("INDEPENDENT_SESSION_SECRET_REQUIRED");
  const ring = require("../utils/privateData").keyring();
  if (
    Object.values(ring.keys).some(
      (key) =>
        key === process.env.AES_SEARCH_KEY ||
        key === process.env.SESSION_CSRF_SECRET ||
        key === process.env.JWT_SECRET,
    )
  )
    throw new Error("INDEPENDENT_ENCRYPTION_KEYS_REQUIRED");
  const front = new URL(process.env.FRONTEND_URL);
  if (
    front.protocol !== "https:" ||
    process.env.CORS_ORIGINS.split(",").some(
      (value) => value.trim() !== front.origin,
    )
  )
    throw new Error("SAME_ORIGIN_HTTPS_DEPLOYMENT_REQUIRED");
}

module.exports = { mode, envFiles };
