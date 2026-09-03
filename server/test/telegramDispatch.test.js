const test = require("node:test");
const assert = require("node:assert/strict");

const { dispatchTelegramAlert } = require("../utils/telegram");

test("telegram dispatch returns immediately while notification continues", async () => {
  let finishSend;
  const pendingSend = new Promise((resolve) => {
    finishSend = resolve;
  });
  let started = false;

  const result = dispatchTelegramAlert("message", null, async () => {
    started = true;
    await pendingSend;
  });

  assert.equal(result, undefined);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, true);
  finishSend();
});

