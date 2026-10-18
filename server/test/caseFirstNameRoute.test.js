require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
let auditFails = false;
let audits = 0;
let reads = 0;
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async (sql, params) => {
      if (sql.startsWith("SELECT 1 FROM form_responses"))
        return [Number(params[1]) === 7 ? [{ id: 1 }] : []];
      if (sql.includes("AS account_last_name")) {
        reads++;
        assert.match(sql, /fr.organization_id = \?/);
        assert.deepEqual(params, ["1", 7]);
        assert.doesNotMatch(sql, /first_name_encrypted/);
        return [
          [
            {
              id: 1,
              organization_id: 7,
              summary_data: JSON.stringify({
                display_name: "นาย สมชาย ใจดี",
                raw_answers: { secret: "clinical detail" },
              }),
            },
          ],
        ];
      }
      return [[]];
    },
  },
};
require.cache[require.resolve("../middleware/authMiddleware")] = {
  exports: {
    verifyToken: (_req, _res, next) => next(),
    requirePermission: () => (req, res, next) =>
      req.authorization.permissions.has("cases.view")
        ? next()
        : res.status(403).json({ code: "CASE_PERMISSION_REQUIRED" }),
  },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: {
    requiredAudit: async () => {
      if (auditFails)
        throw Object.assign(new Error("audit unavailable"), {
          status: 503,
          code: "AUDIT_UNAVAILABLE",
        });
      audits++;
    },
  },
};

test("last-name route discloses only the surname, enforces scope and PII rights, and fails closed on audit errors", async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.user = { id: 1 };
    req.organizationContext = Number(req.get("X-Test-Organization") || 7);
    req.authorization = {
      permissions: new Set(
        (req.get("X-Test-Permissions") || "cases.view,pii.view").split(","),
      ),
    };
    next();
  });
  app.use(require("../middleware/privateDisclosure").privateDisclosure);
  app.use(require("../routes/caseRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const request = (headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/cases/1/last-name`, {
      headers,
    });
  try {
    const response = await request();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { last_name: "ใจดี" });
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(audits, 1);
    const before = reads;
    assert.equal(
      (await request({ "X-Test-Permissions": "cases.view" })).status,
      403,
    );
    assert.equal((await request({ "X-Test-Organization": "8" })).status, 403);
    assert.equal(reads, before);
    auditFails = true;
    const denied = await request();
    assert.equal(denied.status, 503);
    assert.deepEqual(await denied.json(), {
      success: false,
      code: "AUDIT_UNAVAILABLE",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
