// config/db.js
const mysql = require("mysql2/promise");
const path = require("path");
const dotenv = require("dotenv");

const envFile = process.env.NODE_ENV === "production" ? ".env" : ".env.local";
const envPath = path.resolve(__dirname, "..", envFile);
const envResult = dotenv.config({ path: envPath });
if (envResult.error && envFile !== ".env") {
  dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
}

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: numberFromEnv(process.env.DB_PORT, 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: numberFromEnv(process.env.DB_CONNECTION_LIMIT, 50),
  queueLimit: numberFromEnv(process.env.DB_QUEUE_LIMIT, 0),
  maxIdle: numberFromEnv(process.env.DB_MAX_IDLE, 20),
  idleTimeout: numberFromEnv(process.env.DB_IDLE_TIMEOUT, 60000),
});

module.exports = db; // ส่งออกไปให้ไฟล์อื่นใช้
