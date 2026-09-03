// config/db.js
const mysql = require("mysql2/promise");
require("./env");

// Store and exchange temporal values with MySQL as Bangkok time. Both settings
// are required: the session controls TIMESTAMP conversion in MySQL, while the
// driver setting controls how mysql2 turns DATETIME/TIMESTAMP into JavaScript
// Date objects before API responses are serialized.
const BANGKOK_MYSQL_TIME_ZONE = "+07:00";

const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: numberFromEnv(process.env.DB_PORT, 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: numberFromEnv(process.env.DB_CONNECTION_LIMIT, 50),
  queueLimit: numberFromEnv(process.env.DB_QUEUE_LIMIT, 0),
  maxIdle: numberFromEnv(process.env.DB_MAX_IDLE, 20),
  idleTimeout: numberFromEnv(process.env.DB_IDLE_TIMEOUT, 60000),
  timezone: BANGKOK_MYSQL_TIME_ZONE,
});

// A pool may create new connections at any time, so apply the MySQL session
// timezone to each one rather than relying on the database server default.
db.on("connection", (connection) => {
  connection.query(
    `SET time_zone = '${BANGKOK_MYSQL_TIME_ZONE}'`,
    (error) => {
      if (error) {
        console.error("Unable to set MySQL session timezone to Bangkok:", error.message);
      }
    },
  );
});

module.exports = db; // ส่งออกไปให้ไฟล์อื่นใช้
