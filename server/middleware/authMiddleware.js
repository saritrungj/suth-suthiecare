const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { loadAuthorization } = require("../authorization/authorization");

const roleIdOf = (user) => Number(user?.role_id);

const verifyToken = (req, res, next) => {
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
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({
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
    if (authorization?.isSystemAdmin) { req.authorization = authorization; return next(); }
  } catch (error) { return res.status(500).json({ success: false, message: "ไม่สามารถตรวจสอบสิทธิ์ได้" }); }
  return res.status(403).json({ success: false, message: "คุณไม่มีสิทธิ์จัดการบทบาทหรือสิทธิ์ของระบบ" });
};

const moduleAliases = {
  "User Management": ["User Management", "จัดการผู้ใช้ (Users)", "จัดการผู้ใช้"],
  "Roles & Permissions": ["Roles & Permissions", "บทบาทและสิทธิ์"],
  "Case Management": ["Case Management", "จัดการเคส"],
  Appointments: ["Appointments", "ตารางนัดหมาย"],
  "Form Management": ["Form Management", "จัดการฟอร์ม"],
};

const requirePermission = (module, access = "view") => async (req, res, next) => {
  if (req.authorization?.isSystemAdmin) return next();
  if (req.authorization?.permissions) {
    const action = ["create", "update", "delete"].includes(access) ? access : (access === "manage" ? "update" : "view");
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
    if (permission && req.authorization.permissions.has(permission)) return next();
    return res.status(403).json({ success: false, message: `คุณไม่มีสิทธิ์${access === "manage" ? "จัดการ" : "เข้าดู"} ${module}` });
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
    return res.status(403).json({ success: false, message: `คุณไม่มีสิทธิ์${access === "manage" ? "จัดการ" : "เข้าดู"} ${module}` });
  } catch (error) {
    console.error("Permission lookup failed:", error);
    return res.status(500).json({ success: false, message: "ไม่สามารถตรวจสอบสิทธิ์ได้" });
  }
};

module.exports = { verifyToken, verifyAdmin, verifySuperAdmin, requirePermission };
