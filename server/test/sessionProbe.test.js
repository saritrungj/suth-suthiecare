const test = require("node:test"),
  assert = require("node:assert/strict");
process.env.NODE_ENV = "test";
process.env.SESSION_CSRF_SECRET = "test-csrf-".repeat(8);
// No session rows exist: any cookie that reaches the auth middleware is invalid.
require.cache[require.resolve("../config/db")] = {
  exports: { query: async () => [[]] },
};
const express = require("express");
const cookieParser = require("cookie-parser");
const { cookieName } = require("../services/sessionService");

async function withServer(run) {
  const app = express();
  app.use(cookieParser());
  app.use("/api", require("../routes/sessionRoutes"));
  const server = app.listen(0);
  try {
    await run(`http://127.0.0.1:${server.address().port}/api`);
  } finally {
    server.close();
  }
}

for (const type of ["staff", "patient"]) {
  test(`${type} probe without a session cookie answers 204`, () =>
    withServer(async (base) => {
      const response = await fetch(`${base}/session/${type}?probe`);
      assert.equal(response.status, 204);
    }));

  test(`${type} probe with an unknown session cookie still answers 401`, () =>
    withServer(async (base) => {
      const response = await fetch(`${base}/session/${type}?probe`, {
        headers: { cookie: `${cookieName(type)}=stale-token` },
      });
      assert.equal(response.status, 401);
    }));

  test(`${type} session without probe keeps answering 401`, () =>
    withServer(async (base) => {
      const response = await fetch(`${base}/session/${type}`);
      assert.equal(response.status, 401);
    }));
}
