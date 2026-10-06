const db = require("../config/db");
const { decrypt } = require("../utils/encryption");
const axios = require("axios");
async function notifySubmission(
  { organizationId, responseId, eventId },
  sender,
) {
  let status = "skipped",
    reason = "NO_VERIFIED_TARGET";
  try {
    const [rows] = await db.query(
      "SELECT destination_encrypted FROM organization_notification_targets WHERE organization_id=? AND enabled=1 AND verified_at IS NOT NULL",
      [organizationId],
    );
    if (rows[0] && process.env.TELEGRAM_BOT_TOKEN) {
      const destination = require("../utils/privateField").readField(
        rows[0].destination_encrypted,
        "organization_notification_targets",
        "destination",
        organizationId,
      );
      const base = new URL(process.env.FRONTEND_URL || "http://localhost:3001");
      if (process.env.NODE_ENV === "production" && base.protocol !== "https:")
        throw new Error("INVALID_FRONTEND_URL");
      const payload = {
        chat_id: destination,
        text: `มีรายการใหม่\nรหัสอ้างอิง CASE-${responseId}`,
        reply_markup: {
          inline_keyboard: [
            [{ text: "เปิดในระบบ", url: new URL("/admin/cases", base).href }],
          ],
        },
      };
      if (sender) await sender(payload);
      else
        await axios.post(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          payload,
          { timeout: 10000 },
        );
      status = "sent";
      reason = null;
    }
  } catch {
    status = "failed";
    reason = "NOTIFICATION_UNAVAILABLE";
  }
  try {
    if (eventId)
      await db.query(
        "UPDATE organization_notification_events SET status=?,reason_code=? WHERE id=? AND organization_id=? AND response_id=?",
        [status, reason, eventId, organizationId, responseId],
      );
    else
      await db.query(
        "INSERT INTO organization_notification_events (organization_id,response_id,status,reason_code) VALUES (?,?,?,?)",
        [organizationId || null, responseId, status, reason],
      );
  } catch {
    console.warn("Notification metadata unavailable");
  }
  return { status, reason_code: reason };
}
module.exports = { notifySubmission };
