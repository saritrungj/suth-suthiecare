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
    "DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET",
    "AES_KEY", "AES_SEARCH_KEY", "FRONTEND_URL", "CORS_ORIGINS",
    "TURNSTILE_SECRET_KEY",
  ];
  const missing = required.filter((key) => !String(process.env[key] || "").trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
  }
  if (process.env.DISABLE_TURNSTILE === "true") {
    throw new Error("DISABLE_TURNSTILE must never be true in production");
  }
  if (String(process.env.JWT_SECRET).length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters in production");
  }
  if (!/^[0-9a-f]{64}$/i.test(String(process.env.AES_KEY))) {
    throw new Error("AES_KEY must contain exactly 64 hexadecimal characters in production");
  }
  if (String(process.env.AES_SEARCH_KEY).length < 32) {
    throw new Error("AES_SEARCH_KEY must contain at least 32 characters in production");
  }
}

module.exports = { mode, envFiles };
