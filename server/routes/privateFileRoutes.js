const express = require("express"),
  path = require("path");
const { verifyToken } = require("../middleware/authMiddleware");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const { cookieName } = require("../services/sessionService");
const { requiredAudit, requiredPatientAudit } = require("../utils/pdpaAudit");
const router = express.Router();
const FILES = new Map([
  ["user_manual.pdf", { patient: true }],
  ["admin_manual.pdf", { patient: false }],
]);
router.get("/private-files/:name", async (req, res, next) => {
  const file = FILES.get(req.params.name);
  if (!file) return res.status(404).json({ code: "FILE_NOT_FOUND" });
  if (
    process.env.NODE_ENV === "production" &&
    process.env.MANUALS_PRIVACY_REVIEWED !== "true"
  )
    return res.status(503).json({ code: "FILE_PRIVACY_REVIEW_REQUIRED" });
  const send = async () => {
    try {
      if (req.patient)
        await requiredPatientAudit(req, "file.download", req.params.name, {
          format: "pdf",
        });
      else {
        if (!file.patient && !req.authorizationProfile?.isSystemAdmin)
          return res.status(403).json({ code: "FILE_PERMISSION_REQUIRED" });
        await requiredAudit(req, "file.download", "manual", req.params.name, {
          format: "pdf",
        });
      }
      res.set("Cache-Control", "no-store");
      res.set("Content-Security-Policy", "sandbox; default-src 'none'");
      res.download(
        path.join(__dirname, "../private/docs", req.params.name),
        req.params.name,
        (error) => {
          if (error && !res.headersSent)
            res.status(404).json({ code: "FILE_NOT_FOUND" });
        },
      );
    } catch (error) {
      next(error);
    }
  };
  if (req.cookies?.[cookieName("staff")]) return verifyToken(req, res, send);
  if (file.patient) return verifyPatientToken(req, res, send);
  return res.status(401).json({ code: "STAFF_LOGIN_REQUIRED" });
});
module.exports = router;
