const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express");
let auditFails = false;
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async () => {
      if (auditFails) throw new Error("SIMULATED");
      return [{}];
    },
  },
};
const { privateDisclosure } = require("../middleware/privateDisclosure");
test("full disclosure and exports stop when mandatory audit storage is unavailable", async () => {
  const app = express();
  app.use((req, res, next) => {
    req.user = { id: 1 };
    req.authorization = {
      isSystemAdmin: false,
      permissions: new Set(
        (req.get("X-Test-Permissions") || "pii.view,clinical.view").split(","),
      ),
    };
    req.organizationContext = 1;
    next();
  });
  app.use(privateDisclosure);
  app.get(["/cases", "/cases/1", "/cases/1/answers"], (req, res) =>
    res.json(
      req.path === "/cases"
        ? [
            {
              id: 1,
              identity_hash: "never-return",
              summary_data: {
                display_name: "Synthetic Patient",
                raw_answers: { health: "secret" },
              },
            },
          ]
        : {
            id: 1,
            summary_data: {
              display_name: "Synthetic Patient",
              raw_answers: { health: "secret" },
            },
          },
    ),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const request = (path, keys) =>
    fetch("http://127.0.0.1:" + server.address().port + path, {
      headers: keys ? { "X-Test-Permissions": keys } : {},
    });
  try {
    const list = await (await request("/cases")).json();
    assert.equal(list[0].identity_hash, undefined);
    assert.equal(list[0].summary_data.display_name, "S***");
    assert.equal(list[0].summary_data.raw_answers, undefined);
    assert.equal(
      (await request("/cases/1/answers", "clinical.view")).status,
      403,
    );
    assert.equal((await request("/cases/1/answers", "pii.view")).status, 403);
    auditFails = true;
    const response = await request("/cases/1");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      code: "AUDIT_UNAVAILABLE",
    });
  } finally {
    await new Promise((r) => server.close(r));
  }
});
