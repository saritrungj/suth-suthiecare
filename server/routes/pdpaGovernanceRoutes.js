const express = require("express");
const db = require("../config/db");
const { getProcessingNotice } = require("../services/privacyNoticeService");
const router = express.Router();

// The configuration and self-service request UI have been retired. Existing
// evidence, requests, settings and encryption infrastructure remain intact.
router.use(["/pdpa", "/patient/privacy"], (_req, res) => {
  res.status(410).json({
    code: "PRIVACY_SETTINGS_RETIRED",
    message: "ระบบยกเลิกหน้าตั้งค่านี้แล้ว",
  });
});
router.get("/forms/:id/privacy-notice", async (req, res) => {
  const [[form]] = await db.query(
    "SELECT id,organization_id FROM forms WHERE id=? AND status='published'",
    [req.params.id],
  );
  if (!form) return res.status(404).json({ code: "FORM_NOT_FOUND" });
  res.set("Cache-Control", "no-store");
  res.json(await getProcessingNotice(db, form.id, form.organization_id));
});
module.exports = router;
