const express = require("express"),
  router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const {
  verifyPatientTokenAllowingPasswordChange,
} = require("../middleware/patientAuthMiddleware");
const { revokeSession } = require("../services/sessionService");
router.get("/session/staff", verifyToken, (req, res) =>
  res.json({
    user: req.authorizationProfile.user,
    csrf_token: req.privateSessions.staff.csrf_token,
  }),
);
router.get(
  "/session/patient",
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
