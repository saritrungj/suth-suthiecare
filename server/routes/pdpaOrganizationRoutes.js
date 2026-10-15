const express = require("express");
const db = require("../config/db");
const {
  verifyToken,
  verifySuperAdmin,
} = require("../middleware/authMiddleware");
const { encrypt, decrypt } = require("../utils/encryption");
const { requiredAudit } = require("../utils/pdpaAudit");
const { httpError } = require("../utils/operationalOwnership");
const router = express.Router();
router.use("/organizations", verifyToken, verifySuperAdmin);
const fail = (res, error) =>
  res
    .status(error.status || 503)
    .json({ code: error.status ? error.code : "PDPA_SETTINGS_UNAVAILABLE" });
async function organization(connection, id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1)
    throw httpError(422, "INVALID_ORGANIZATION");
  const [rows] = await connection.query(
    "SELECT id FROM organizations WHERE id=? AND status='active' AND org_level='unit'",
    [id],
  );
  if (!rows[0]) throw httpError(404, "ORGANIZATION_NOT_FOUND");
}
router.get("/organizations/:id/referral-destinations", async (req, res) => {
  try {
    await organization(db, req.params.id);
    const [rows] = await db.query(
      "SELECT l.destination_organization_id,o.name,l.enabled FROM organization_referral_links l JOIN organizations o ON o.id=l.destination_organization_id WHERE l.source_organization_id=?",
      [req.params.id],
    );
    res.json(rows);
  } catch (error) {
    fail(res, error);
  }
});
router.put("/organizations/:id/referral-destinations", async (req, res) => {
  const connection = await db.getConnection();
  try {
    await organization(connection, req.params.id);
    const list = req.body.destinations;
    if (
      !Array.isArray(list) ||
      list.length > 200 ||
      new Set(list.map((v) => Number(v.organization_id))).size !== list.length
    )
      throw httpError(422, "INVALID_DESTINATIONS");
    await connection.beginTransaction();
    await connection.query(
      "UPDATE organization_referral_links SET enabled=0,updated_by=? WHERE source_organization_id=?",
      [req.user.id, req.params.id],
    );
    for (const item of list) {
      if (
        Number(item.organization_id) === Number(req.params.id) ||
        typeof item.enabled !== "boolean"
      )
        throw httpError(422, "INVALID_DESTINATION");
      await organization(connection, item.organization_id);
      await connection.query(
        "INSERT INTO organization_referral_links (source_organization_id,destination_organization_id,enabled,updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE enabled=VALUES(enabled),updated_by=VALUES(updated_by)",
        [
          req.params.id,
          item.organization_id,
          item.enabled ? 1 : 0,
          req.user.id,
        ],
      );
    }
    req.organizationContext = Number(req.params.id);
    await requiredAudit(
      req,
      "referral_destinations.update",
      "organization",
      req.params.id,
      { count: list.length },
      connection,
    );
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    fail(res, error);
  } finally {
    connection.release();
  }
});
router.get("/organizations/:id/notification-target", async (req, res) => {
  try {
    await organization(db, req.params.id);
    const [rows] = await db.query(
      "SELECT provider,enabled,verified_at,destination_encrypted FROM organization_notification_targets WHERE organization_id=?",
      [req.params.id],
    );
    const row = rows[0];
    res.json(
      row
        ? {
            provider: row.provider,
            enabled: Boolean(row.enabled),
            verified_at: row.verified_at,
            destination_masked:
              "****" +
              String(
                require("../utils/privateField").readField(
                  row.destination_encrypted,
                  "organization_notification_targets",
                  "destination",
                  req.params.id,
                ),
              ).slice(-4),
          }
        : null,
    );
  } catch (error) {
    fail(res, error);
  }
});
router.put("/organizations/:id/notification-target", async (req, res) => {
  const connection = await db.getConnection();
  try {
    await organization(connection, req.params.id);
    const { destination, enabled, verified } = req.body;
    if (
      typeof destination !== "string" ||
      !/^[-]?\d{1,30}$/.test(destination) ||
      typeof enabled !== "boolean" ||
      verified !== true
    )
      throw httpError(422, "VERIFIED_DESTINATION_REQUIRED");
    await connection.beginTransaction();
    await connection.query(
      "INSERT INTO organization_notification_targets (organization_id,destination_encrypted,enabled,verified_by,verified_at,updated_by) VALUES (?,?,?,?,NOW(),?) ON DUPLICATE KEY UPDATE destination_encrypted=VALUES(destination_encrypted),enabled=VALUES(enabled),verified_by=VALUES(verified_by),verified_at=NOW(),updated_by=VALUES(updated_by)",
      [
        req.params.id,
        encrypt(
          destination,
          require("../utils/privateData").fieldContext(
            "organization_notification_targets",
            "destination",
            req.params.id,
          ),
        ),
        enabled ? 1 : 0,
        req.user.id,
        req.user.id,
      ],
    );
    req.organizationContext = Number(req.params.id);
    await requiredAudit(
      req,
      "notification_target.update",
      "organization",
      req.params.id,
      {},
      connection,
    );
    await connection.commit();
    res.json({ success: true });
  } catch (error) {
    await connection.rollback();
    fail(res, error);
  } finally {
    connection.release();
  }
});
router.all('/organizations/:id/members/:membershipId/data-permissions', (_req,res) => {
  res.status(410).json({code:'PRIVACY_SETTINGS_RETIRED'});
});
router.get("/organizations/:id/notification-events", async (req, res) => {
  try {
    await organization(db, req.params.id);
    const [events] = await db.query(
      "SELECT id,response_id,status,reason_code,created_at FROM organization_notification_events WHERE organization_id=? ORDER BY id DESC LIMIT 100",
      [req.params.id],
    );
    res.json(events);
  } catch (e) {
    fail(res, e);
  }
});
module.exports = router;
