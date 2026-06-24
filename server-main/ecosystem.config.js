// ecosystem.config.js — PM2 process config สำหรับ SUTHie Care API
// รัน:  pm2 start ecosystem.config.js --env production
//
// สถาปัตยกรรมบน IIS:
//   Browser → IIS (เสิร์ฟไฟล์ static ของ React + reverse proxy /api) → PM2 (Node API :5000)
//   IIS ไม่ได้รัน Node เอง — PM2 เป็นคนรัน index.js แล้ว IIS แค่ proxy /api ไปที่ localhost:5000

module.exports = {
  apps: [
    {
      name: "suthiecare-api",
      script: "./index.js",
      cwd: __dirname,

      // fork + 1 instance: แอปใช้ node-cache (cache ในหน่วยความจำ) และ app.listen พอร์ตเดียว
      // ถ้าจะใช้ cluster หลาย instance ต้องย้าย cache/socket.io ไปใช้ Redis ก่อน (มี ioredis/redis ติดตั้งไว้แล้ว)
      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false, // production ไม่ต้อง watch (กัน restart รัว ๆ)
      max_memory_restart: "500M",

      // ตัวแปร env หลักโหลดจากไฟล์ .env ผ่าน dotenv ในตัว index.js อยู่แล้ว
      // ตรงนี้กำหนดเฉพาะค่าที่อยากให้ PM2 บังคับ
      env: {
        NODE_ENV: "development",
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5000,
      },

      // Log
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,

      // กัน restart วนถ้าแอป crash ทันทีตอนบูต
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
