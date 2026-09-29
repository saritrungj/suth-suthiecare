const jwt = require("jsonwebtoken");
const db = require("../config/db");
const {
  loadAuthorization,
  isAgencyAuthorization,
} = require("../authorization/authorization");

const roleIdOf = (user) => Number(user?.role_id);

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "ไม่พบ Token กรุณา Login ใหม่",
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (decoded.account_type && decoded.account_type !== "staff") {
      return res.status(401).json({
        success: false,
        message: "โทเค็นนี้ไม่สามารถใช้กับระบบเจ้าหน้าที่ได้",
      });
    }
    if (
      String(process.env.STAFF_EMAIL_OTP_MODE || "enroll").toLowerCase() ===
        "required" &&
      (decoded.account_type !== "staff" || decoded.email_otp !== true)
    ) {
      return res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบและยืนยันรหัสอีเมลใหม่",
      });
    }
    req.user = decoded;
    const authorization = await loadAuthorization(decoded.id);
    if (!authorization)
      return res
        .status(401)
        .json({ success: false, message: "บัญชีไม่พร้อมใช้งาน" });
    if (decoded.auth_version !== undefined) {
      const [rows] = await db.query(
        "SELECT auth_version, status FROM users WHERE id=? LIMIT 1",
        [decoded.id],
      );
      if (
        !rows[0] ||
        rows[0].status !== "active" ||
        Number(rows[0].auth_version || 0) !== Number(decoded.auth_version)
      ) {
        return res.status(401).json({
          success: false,
          message: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่",
        });
      }
    }
    req.authorizationProfile = authorization;
    req.user.access_mode = isAgencyAuthorization(authorization)
      ? "agency"
      : "admin";
    const requestPath = String(req.originalUrl || req.path).split("?")[0];
    const allowedAgencyPath =
      requestPath === "/api/me/authorization" ||
      requestPath === "/api/agency-entry" ||
      requestPath.startsWith("/api/agency-entry/");
    if (req.user.access_mode === "agency" && !allowedAgencyPath) {
      return res.status(403).json({
        success: false,
        message: "บัญชีหน่วยงานใช้ได้เฉพาะระบบบันทึกข้อมูล",
      });
    }
    return next();
  } catch (err) {
    // 401 (not 403) so the client session interceptor clears the stale
    // token and returns the user to the login page.
    return res.status(401).json({
      success: false,
      message: "Token หมดอายุหรือไม่ถูกต้อง",
    });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user && [1, 2].includes(roleIdOf(req.user))) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: "คุณไม่มีสิทธิ์เข้าถึง (สำหรับ Admin เท่านั้น)",
    });
  }
};

const verifySuperAdmin = async (req, res, next) => {
  try {
    const authorization = await loadAuthorization(req.user.id);
    if (authorization?.isSystemAdmin) {
      req.authorization = authorization;
      return next();
    }
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถตรวจสอบสิทธิ์ได้" });
  }
  return res.status(403).json({
    success: false,
    message: "คุณไม่มีสิทธิ์จัดการบทบาทหรือสิทธิ์ของระบบ",
  });
};

const moduleAliases = {
  "User Management": [
    "User Management",
    "จัดการผู้ใช้ (Users)",
    "จัดการผู้ใช้",
  ],
  "Roles & Permissions": ["Roles & Permissions", "บทบาทและสิทธิ์"],
  "Case Management": ["Case Management", "จัดการเคส"],
  Appointments: ["Appointments", "ตารางนัดหมาย"],
  "Form Management": ["Form Management", "จัดการฟอร์ม"],
};

const requirePermission =
  (module, access = "view") =>
  async (req, res, next) => {
    if (req.authorization?.isSystemAdmin) return next();
    if (req.authorization?.permissions) {
      const action = ["create", "update", "delete"].includes(access)
        ? access
        : access === "manage"
          ? "update"
          : "view";
      const keyByModule = {
        Dashboard: "dashboard.view",
        "Case Management": `cases.${action}`,
        Appointments: `appointments.${action}`,
        "User Management": `patient_members.${action}`,
        "Form Management": `forms.${action}`,
        "Clinic Management": `clinics.${action}`,
        "Help Center Management": `help_center.${action}`,
        "Content Management": `content.${action}`,
      };
      const permission = keyByModule[module];
      if (permission && req.authorization.permissions.has(permission))
        return next();
      return res.status(403).json({
        success: false,
        message: `คุณไม่มีสิทธิ์${access === "manage" ? "จัดการ" : "เข้าดู"} ${module}`,
      });
    }
    if (roleIdOf(req.user) === 1) return next();
    try {
      const modules = moduleAliases[module] || [module];
      const [rows] = await db.query(
        "SELECT can_view, can_manage, can_full FROM permissions WHERE role_id = ? AND module IN (?)",
        [roleIdOf(req.user), modules],
      );
      const allowed = rows.some((row) =>
        access !== "view"
          ? Boolean(row.can_manage || row.can_full)
          : Boolean(row.can_view || row.can_manage || row.can_full),
      );
      if (allowed) return next();
      return res.status(403).json({
        success: false,
        message: `คุณไม่มีสิทธิ์${access === "manage" ? "จัดการ" : "เข้าดู"} ${module}`,
      });
    } catch (error) {
      console.error("Permission lookup failed:", error);
      return res
        .status(500)
        .json({ success: false, message: "ไม่สามารถตรวจสอบสิทธิ์ได้" });
    }
  };

module.exports = {
  verifyToken,
  verifyAdmin,
  verifySuperAdmin,
  requirePermission,
};
