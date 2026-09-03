const path = require("node:path");

const serverDirectory = path.join(__dirname, "server");
const port = Number(process.env.PORT || 5000);

module.exports = {
  apps: [
    {
      name: process.env.PM2_APP_NAME || "suthiecare",
      cwd: serverDirectory,
      script: path.join(serverDirectory, "index.js"),
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 8000,
      time: true,
      error_file: path.join(__dirname, "logs", "err.log"),
      out_file: path.join(__dirname, "logs", "out.log"),
      merge_logs: true,
      env_production: {
        NODE_ENV: "production",
        TZ: "Asia/Bangkok",
        HOST: "127.0.0.1",
        PORT: port,
      },
    },
  ],
};
