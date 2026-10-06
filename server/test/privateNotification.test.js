require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { encrypt } = require("../utils/encryption");
const events = [];
let target = null;
process.env.TELEGRAM_BOT_TOKEN = "synthetic-test-token";
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async (sql, params) => {
      if (sql.startsWith("SELECT")) {
        assert.equal(params[0], 7);
        assert.match(
          sql,
          /organization_id=\?.*enabled=1.*verified_at IS NOT NULL/,
        );
        return [target ? [{ destination_encrypted: encrypt(target) }] : []];
      }
      events.push(params);
      return [{}];
    },
  },
};
const {
  notifySubmission,
} = require("../services/organizationNotificationService");
test("no target means no fallback, minimal notification has no supplied patient details", async () => {
  let calls = 0;
  assert.equal(
    (
      await notifySubmission(
        { organizationId: 7, responseId: 9, name: "private-name" },
        async () => {
          calls++;
        },
      )
    ).status,
    "skipped",
  );
  assert.equal(calls, 0);
  target = "-999";
  let payload;
  assert.equal(
    (
      await notifySubmission(
        {
          organizationId: 7,
          responseId: 9,
          name: "private-name",
          phone: "private-phone",
          risk: "high",
        },
        async (value) => {
          payload = value;
        },
      )
    ).status,
    "sent",
  );
  assert.equal(payload.chat_id, "-999");
  assert.equal(payload.text, "มีรายการใหม่\nรหัสอ้างอิง CASE-9");
  assert.doesNotMatch(
    JSON.stringify(payload),
    /private-name|private-phone|high|synthetic-test-token/,
  );
  const failed = await notifySubmission(
    { organizationId: 7, responseId: 9 },
    async () => {
      throw new Error("bot-token-and-patient-data");
    },
  );
  assert.equal(failed.status, "failed");
  assert.equal(events.at(-1)[3], "NOTIFICATION_UNAVAILABLE");
  assert.doesNotMatch(JSON.stringify(events), /bot-token-and-patient-data/);
});
