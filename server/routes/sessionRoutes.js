const express = require("express"),
  router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  verifyPatientTokenAllowingPasswordChange,
} = require("../middleware/patientAuthMiddleware");
const { revokeSession, cookieName } = require("../services/sessionService");
// The app probes both sessions on every page load. A visitor without a
// session cookie is a normal anonymous visit, not an auth failure, so the
// probe answers 204 instead of a 401 that browsers log as an error.
const anonymousProbe = (type) => (req, res, next) =>
  req.query.probe !== undefined && !req.cookies?.[cookieName(type)]
    ? res.status(204).end()
    : next();
router.get("/session/staff", anonymousProbe("staff"), verifyToken, (req, res) =>
  res.json({
    user: req.authorizationProfile.user,
    csrf_token: req.privateSessions.staff.csrf_token,
  }),
);
router.get(
  "/session/patient",
  anonymousProbe("patient"),
  verifyPatientTokenAllowingPasswordChange,
  (req, res) =>
    res.json({
      user: require("../utils/patientAuth").publicAccount(req.patient),
      csrf_token: req.privateSessions.patient.csrf_token,
    }),
);
router.post("/session/staff/logout", verifyToken, async (req, res) => {
  await revokeSession(req, res, "staff");
  res.json({ success: true });
});
module.exports = router;
