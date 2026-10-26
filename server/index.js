// index.js
// Keep all server-side calendar calculations consistent with the product's
// operating timezone, regardless of the host machine's locale.
process.env.TZ = "Asia/Bangkok";
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
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
const faqRoutes = require("./routes/faqRoutes"); // <-- เส้นทางจัดการข้อมูล FAQ
const patientAuthRoutes = require("./routes/patientAuthRoutes");
const patientRoutes = require("./routes/patientRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const schoolRoutes = require("./routes/schoolRoutes");
const caseReferralRoutes = require("./routes/caseReferralRoutes");
const {
  verifyToken,
  requirePermission,
  verifySuperAdmin,
} = require("./middleware/authMiddleware");
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
// Counted per session when the request has one, else per IP, so a school
// that shares one public IP is not limited as if it were one user.
app.use("/api", require("./utils/rateLimits").apiLimiters());

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cookieParser());
app.use("/api", require("./services/pdpaReadiness").readinessMiddleware);
// Even the initial authentication request must originate from the configured application.
app.use("/api", (req, res, next) => {
  if (
    process.env.NODE_ENV !== "production" ||
    ["GET", "HEAD", "OPTIONS"].includes(req.method)
  )
    return next();
  const origin = req.get("Origin");
  if (!origin || !allowedOrigins.includes(origin))
    return res.status(403).json({ code: "ORIGIN_REJECTED" });
  next();
});

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.set("X-Request-Id", req.requestId);
  next();
});

// Operational data always has an explicit organization context. This sits before
// route handlers so a guessed URL or body field cannot escape tenant scope.
app.use("/api", (req, res, next) => {
  if (
    !needsOrganizationContext(
      req.path,
      Boolean(
        req.headers.authorization ||
        (req.headers["x-organization-id"] &&
          req.cookies?.[
            require("./services/sessionService").cookieName("staff")
          ]),
      ),
    )
  )
    return next();
  return verifyToken(req, res, () => resolveContext(req, res, next));
});

// Permission gate for every administrative write endpoint. Returns the roles-page
// key ("module.action"); routes still validate payloads and stricter rules, and
// a few decide create/update/delete/assign from the body themselves.
const permissionForWrite = (path, method) => {
  if (path.endsWith("/export-data")) return null;
  if (
    /^\/forms\/[^/]+\/submit$/.test(path) ||
    path === "/counts" ||
    path === "/submit-system-feedback" ||
    path.startsWith("/history/") ||
    path === "/decode-token"
  )
    return null;
  const verb =
    method === "POST" ? "create" : method === "DELETE" ? "delete" : "update";
  if (path.startsWith("/forms") || path === "/save-form") {
    // Publishing and linking a form to a clinic is "assign".
    if (/^\/forms\/[^/]+\/(status|clinic)$/.test(path)) return "forms.assign";
    if (/^\/forms\/[^/]+\/duplicate$/.test(path) || path === "/save-form")
      return "forms.create";
    return `forms.${verb}`;
  }
  if (path.startsWith("/clinics")) {
    // Ordering and help-center visibility of clinics is "assign".
    if (path === "/clinics/reorder" || /\/toggle-help-center$/.test(path))
      return "clinics.assign";
    return `clinics.${verb}`;
  }
  if (path.startsWith("/admin/help-center")) return `help_center.${verb}`;
  if (path.startsWith("/banners")) return `content.${verb}`;
  // Uploading or resetting an organization's result pictures edits its forms.
  if (path.startsWith("/admin/result-images")) return "forms.update";
  // Chart create/update/delete is decided from the saved layout in the route.
  if (path.startsWith("/dashboard-settings")) return "dashboard.view";
  // Appointment status: cancelling is "delete", other changes "update" (route).
  if (/^\/appointments\/[^/]+\/status$/.test(path)) return "appointments.view";
  if (path.startsWith("/appointments")) return `appointments.${verb}`;
  if (path.startsWith("/staffs"))
    return `appointments.${verb === "update" ? "update" : verb}`;
  if (/^\/cases\/[^/]+\/logs$/.test(path)) return "cases.update";
  if (
    path.startsWith("/cases") ||
    path.startsWith("/master-cases") ||
    path.startsWith("/services") ||
    path.startsWith("/templates") ||
    path.startsWith("/case-statuses") ||
    path.startsWith("/status-options")
  )
    return `cases.${verb}`;
  return null;
};

const permissionForRead = (path) => {
  if (
    /^\/forms\/[^/]+\/(?:responses|responses-v2|submission-count)$/.test(path)
  )
    return "Form Management";
  if (/^\/forms\/[^/]+\/questions$/.test(path)) return "Form Management";
  if (path.startsWith("/admin/result-images")) return "Form Management";
  if (path.startsWith("/evaluations/")) return "Dashboard";
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/charts/") ||
    path === "/admin/master-cases/stats"
  )
    return "Dashboard";
  if (
    path.startsWith("/cases") ||
    path.startsWith("/master-cases") ||
    path.startsWith("/appointments") ||
    path.startsWith("/services") ||
    path.startsWith("/templates") ||
    path.startsWith("/case-statuses") ||
    path.startsWith("/status-options") ||
    path === "/all-cases"
  )
    return "Case Management";
  if (path.startsWith("/staffs")) return "User Management";
  if (path === "/clinics/all") return "Clinic Management";
  return null;
};

app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD"].includes(req.method)) return next();
  const module = permissionForRead(req.path);
  if (!module) return next();
  return verifyToken(req, res, () =>
    requirePermission(module, "view")(req, res, next),
  );
});

app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (
    req.organizationContext === "all" &&
    /^\/(cases|master-cases|appointments|staffs|services|templates|case-statuses|status-options|history)(\/|$)/.test(
      req.path,
    )
  )
    return res.status(422).json({ code: "SELECT_ONE_ORGANIZATION" });
  const key = permissionForWrite(req.path, req.method);
  if (!key) return next();
  return verifyToken(req, res, () => {
    if (req.authorization?.isSystemAdmin) return next();
    // Paths without a unit context keep the legacy account-role check.
    if (!req.authorization?.permissions) {
      const [resource, action] = key.split(".");
      const legacy = {
        forms: "Form Management",
        clinics: "Clinic Management",
        help_center: "Help Center Management",
        content: "Content Management",
        dashboard: "Dashboard",
        appointments: "Appointments",
        cases: "Case Management",
      }[resource];
      return requirePermission(
        legacy,
        ["create", "delete"].includes(action) ? action : "update",
      )(req, res, next);
    }
    if (req.authorization.permissions.has(key)) return next();
    return res.status(403).json({
      success: false,
      code: "PERMISSION_REQUIRED",
      permission: key,
      message: "คุณไม่มีสิทธิ์ดำเนินการนี้",
    });
  });
});

app.use(
  "/api",
  require("./middleware/schoolPrivacyBoundary").schoolPrivacyBoundary,
);
app.use("/api", require("./middleware/privateDisclosure").privateDisclosure);
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
app.get("/ready", async (req, res) => {
  try {
    const readiness = await require("./services/pdpaReadiness").schemaReadiness(
      require("./config/db"),
    );
    res.status(readiness.ready ? 200 : 503).json({
      ready: readiness.ready,
      code: readiness.ready ? "READY" : "PDPA_SCHEMA_NOT_READY",
    });
  } catch {
    res.status(503).json({ ready: false, code: "PDPA_READINESS_FAILED" });
  }
});

// 🟢 ผูก Routes เข้ากับ API Path หลัก
app.use("/api", authRoutes);
app.use("/api", require("./routes/sessionRoutes"));
app.use("/api", require("./routes/privateFileRoutes"));
app.use("/api", require("./routes/formInvitationRoutes"));
app.use("/api", require("./routes/pdpaOrganizationRoutes"));
app.use("/api", require("./routes/privateExportRoutes"));
app.use("/api", require("./routes/pdpaGovernanceRoutes"));
app.use("/api/patient-auth", patientAuthRoutes);
app.use("/api/patient", require("./routes/patientSchoolAppointmentRoutes"));
app.use("/api/patient", require("./routes/patientSchoolDocumentRoutes"));
app.use("/api/patient", patientRoutes);
app.use("/api", formRoutes);
app.use("/api", userRoutes);
app.use("/api", roleRoutes);
app.use("/api", organizationRoutes);
app.use("/api", require("./routes/organizationPermissionRoutes"));
app.use("/api", bannerRoutes);
app.use("/api", require("./routes/resultImageRoutes"));
app.use("/api", dashboardRoutes);
app.use("/api", require("./routes/operationalLookupRoutes"));
app.use("/api", caseRoutes);
app.use("/api/clinics", clinicRoutes);
app.use("/api/admin/help-center", faqRoutes);
app.use("/api/school", schoolRoutes);
app.use("/api/school", require("./routes/schoolInsightRoutes"));
app.use("/api/school", require("./routes/schoolWorkflowRoutes"));
app.use("/api/school", require("./routes/schoolNotificationRoutes"));
app.use("/api/school", require("./routes/schoolBehaviorRoutes"));
app.use("/api/school", require("./routes/schoolPhysicalRiskRoutes"));
app.use("/api/school", require("./routes/schoolAppointmentRoutes"));
app.use("/api/school", require("./routes/schoolDocumentRoutes"));
app.use("/api/school", require("./routes/schoolAuditRoutes"));
app.use("/api/school", require("./routes/schoolReportRoutes"));
app.use("/api/master-data", require("./routes/masterDataRoutes"));
app.use("/api/exports", require("./routes/excelExportRoutes"));
app.use("/api/case-referrals", caseReferralRoutes);
app.use("/api/referral-approvals", require("./routes/referralApprovalRoutes"));
app.use("/api/audit-logs", require("./routes/auditRoutes"));

// 🟢 6. API ทดสอบ Telegram (ป้องกันด้วย token — เฉพาะผู้ที่ล็อกอินแล้ว)
app.post(
  "/api/test-telegram",
  verifyToken,
  requirePermission("Dashboard", "manage"),
  async (req, res) => {
    res.status(410).json({ code: "GLOBAL_NOTIFICATION_RETIRED" });
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
  console.error("Unhandled Error:", {
    request_id: req.requestId,
    code: err.code || err.name,
  });
  res
    .status(
      typeof status === "number" && status >= 400 && status <= 503
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
const HOST =
  process.env.HOST ||
  (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server started on port ${PORT}`);
  console.log(`📁 Routes successfully loaded!`);
});
