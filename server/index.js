// index.js
// Keep all server-side calendar calculations consistent with the product's
// operating timezone, regardless of the host machine's locale.
process.env.TZ = "Asia/Bangkok";
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { clientIpKeyGenerator } = require("./utils/clientIp");
require("./config/env");

// 🟢 1. นำเข้า Utils (ถ้ายังมีใช้อยู่)
const { sendTelegramAlert } = require("./utils/telegram");

// 🟢 2. นำเข้า Routes ทั้งหมดที่เราแยกไว้
const authRoutes = require("./routes/authRoutes"); // <-- เส้นทางจัดการการเข้าสู่ระบบ
const formRoutes = require("./routes/formRoutes"); // <-- เส้นทางจัดการข้อมูลฟอร์มและคำตอบ
const userRoutes = require("./routes/userRoutes"); // <-- เส้นทางจัดการข้อมูลผู้ใช้
const roleRoutes = require("./routes/roleRoutes"); // <-- เส้นทางจัดการข้อมูลผู้ใช้และสิทธิ์
const bannerRoutes = require("./routes/bannerRoutes"); // <-- เส้นทางจัดการข้อมูลแบนเนอร์
const dashboardRoutes = require("./routes/dashboardRoutes"); // <-- เส้นทางจัดการข้อมูล Dashboard
const caseRoutes = require("./routes/caseRoutes"); // <-- เส้นทางจัดการเคส, นัดหมาย, และประวัติ
const clinicRoutes = require("./routes/clinicRoutes"); // <-- เส้นทางจัดการข้อมูลคลินิก
const staffRoutes = require("./routes/staffRoutes"); // <-- เส้นทางจัดการข้อมูลเจ้าหน้าที่
const faqRoutes = require("./routes/faqRoutes"); // <-- เส้นทางจัดการข้อมูล FAQ
const patientAuthRoutes = require("./routes/patientAuthRoutes");
const patientRoutes = require("./routes/patientRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const { verifyToken, requirePermission, verifySuperAdmin } = require("./middleware/authMiddleware");
const { resolveContext } = require("./authorization/authorization");
const { needsOrganizationContext } = require("./authorization/requestScope");
const crypto = require("crypto");

const app = express();

app.set("trust proxy", 1); // ✅ เพิ่มบรรทัดนี้
app.disable("x-powered-by");

// 🟢 ตั้งค่า Middleware

// 🔒 Security headers (HSTS, X-Frame-Options, noSniff ฯลฯ)
app.use(helmet());

app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex, nofollow, nosnippet");
  next();
});

// 🔒 CORS แบบ allowlist (จำกัดเฉพาะ origin ที่กำหนดใน .env)
const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.FRONTEND_URL ||
  ""
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // อนุญาต request ที่ไม่มี origin (เช่น mobile app, curl, same-origin)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);

// 🔒 Rate limit ทั่วทั้ง API (ป้องกันการยิงถี่ / brute-force / DoS)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKeyGenerator,
  message: {
    success: false,
    message: "มีการเรียกใช้งานมากเกินไป กรุณารอสักครู่",
  },
});
app.use("/api", apiLimiter);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.set("X-Request-Id", req.requestId);
  next();
});

// Operational data always has an explicit organization context. This sits before
// route handlers so a guessed URL or body field cannot escape tenant scope.
app.use("/api", (req, res, next) => {
  if (!needsOrganizationContext(req.path, Boolean(req.headers.authorization))) return next();
  return verifyToken(req, res, () => resolveContext(req, res, next));
});

// Permission gate for every administrative write endpoint. Individual routes still
// validate their own payload and any stricter hierarchy rules.
const permissionForWrite = (path) => {
  if (/^\/forms\/[^/]+\/submit$/.test(path) || path === "/counts" || path === "/submit-system-feedback" || path.startsWith("/history/") || path === "/decode-token") return null;
  if (path.startsWith("/forms") || path === "/save-form") return "Form Management";
  if (path.startsWith("/clinics")) return "Clinic Management";
  if (path.startsWith("/admin/help-center")) return "Help Center Management";
  if (path.startsWith("/banners")) return "Content Management";
  if (path.startsWith("/dashboard-settings")) return "Dashboard";
  if (path.startsWith("/appointments")) return "Appointments";
  if (path.startsWith("/cases") || path.startsWith("/master-cases") || path.startsWith("/services") || path.startsWith("/templates") || path.startsWith("/case-statuses") || path.startsWith("/status-options")) return "Case Management";
  return null;
};

const permissionForRead = (path) => {
  if (/^\/forms\/[^/]+\/(?:responses|responses-v2|submission-count)$/.test(path)) return "Form Management";
  if (/^\/forms\/[^/]+\/questions$/.test(path)) return "Form Management";
  if (path.startsWith("/evaluations/")) return "Dashboard";
  if (path.startsWith("/dashboard") || path.startsWith("/charts/") || path === "/admin/master-cases/stats") return "Dashboard";
  if (
    path.startsWith("/cases") ||
    path.startsWith("/master-cases") ||
    path.startsWith("/appointments") ||
    path.startsWith("/services") ||
    path.startsWith("/templates") ||
    path.startsWith("/case-statuses") ||
    path.startsWith("/status-options") ||
    path === "/all-cases"
  ) return "Case Management";
  if (path.startsWith("/staffs")) return "User Management";
  if (path === "/clinics/all") return "Clinic Management";
  return null;
};

app.use("/api", (req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method)) return next();
  const module = permissionForRead(req.path);
  if (!module) return next();
  return verifyToken(req, res, () => requirePermission(module, "view")(req, res, next));
});

app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const module = permissionForWrite(req.path);
  if (!module) return next();
  const action = req.method === "POST" ? "create" : req.method === "DELETE" ? "delete" : "update";
  return verifyToken(req, res, () => requirePermission(module, action)(req, res, next));
});

// 🟢 ตั้งค่าหน้าแรก (Root Route)
app.get("/", (req, res) => {
  res.send("Server is running!");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "suthiecare-api",
    version: require("./package.json").version,
    timestamp: new Date().toISOString(),
  });
});

// 🟢 ผูก Routes เข้ากับ API Path หลัก
app.use("/api", authRoutes);
app.use("/api/patient-auth", patientAuthRoutes);
app.use("/api/patient", patientRoutes);
app.use("/api", formRoutes);
app.use("/api", userRoutes);
app.use("/api", roleRoutes);
app.use("/api", organizationRoutes);
app.use("/api", bannerRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", caseRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/staffs", staffRoutes);
app.use("/api/admin/help-center", faqRoutes);

// 🟢 6. API ทดสอบ Telegram (ป้องกันด้วย token — เฉพาะผู้ที่ล็อกอินแล้ว)
app.post(
  "/api/test-telegram",
  verifyToken,
  requirePermission("Dashboard", "manage"),
  async (req, res) => {
  await sendTelegramAlert(
    "🧪 <b>ทดสอบระบบ</b>\nถ้าเห็นข้อความนี้แสดงว่าเชื่อมต่อสำเร็จ ✅",
  );
  res.json({ message: "ส่งแล้ว ดู Terminal และ Telegram" });
  },
);

// 🔒 Global error handler (backstop): log เต็มฝั่ง server, ส่ง message กลางๆ ให้ client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === "Not allowed by CORS") {
    return res
      .status(403)
      .json({ success: false, message: "ไม่อนุญาตให้เข้าถึงจากต้นทางนี้" });
  }
  // payload ใหญ่เกินกำหนด (body-parser) หรือ error ที่มี status ของตัวเอง
  const status = err && (err.status || err.statusCode);
  if (status === 413) {
    return res
      .status(413)
      .json({ success: false, message: "ข้อมูลที่ส่งมามีขนาดใหญ่เกินไป" });
  }
  console.error("Unhandled Error:", err);
  res
    .status(
      typeof status === "number" && status >= 400 && status < 500
        ? status
        : 500,
    )
    .json({
      success: false,
      request_id: req.requestId,
      message:
        status >= 400 && status < 500
          ? "คำขอไม่ถูกต้อง"
          : "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
    });
});

// 🟢 7. เริ่มต้นรันเซิร์ฟเวอร์
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📁 Routes successfully loaded!`);
});
