// Roles-page right check for route handlers ("module.action" keys).
// "<module>.manage" covers every action of its module.
const can = (req, key) => {
  if (req.authorization?.isSystemAdmin) return true;
  const permissions = req.authorization?.permissions;
  return Boolean(
    permissions?.has?.(key) ||
    permissions?.has?.(`${String(key).split(".")[0]}.manage`),
  );
};

const denyUnless = (req, res, key, message = "คุณไม่มีสิทธิ์ดำเนินการนี้") => {
  if (can(req, key)) return false;
  res.status(403).json({
    success: false,
    code: "PERMISSION_REQUIRED",
    permission: key,
    message,
  });
  return true;
};

// Express middleware form of denyUnless.
const need = (key) => (req, res, next) => {
  if (!denyUnless(req, res, key)) next();
};

module.exports = { can, denyUnless, need };
