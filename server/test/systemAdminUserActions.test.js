require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

let system = true;
const query = async (sql) => {
  if (sql.includes("FROM organization_memberships")) return [[]];
  if (sql.startsWith("SELECT"))
    return [
      [
        {
          id: 8,
          username: "demo-admin",
          name: "นาย ผู้ดูแล ระบบ",
          role_id: 1,
          status: "active",
          email: "demo.full@example.test",
        },
      ],
    ];
  return [{ insertId: 8, affectedRows: 1 }];
};
require.cache[require.resolve("../config/db")] = {
  exports: {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    }),
  },
};
require.cache[require.resolve("../middleware/authMiddleware")] = {
  exports: {
    verifyToken(req, res, next) {
      req.user = { id: 5, role_id: 3 };
      next();
    },
    verifySuperAdmin(req, res, next) {
      if (!system) return res.sendStatus(403);
      req.authorization = { isSystemAdmin: true };
      next();
    },
    requirePermission: () => (req, res, next) => next(),
  },
};
require.cache[require.resolve("../utils/privateField")] = {
  exports: { writeField: (value) => value, readField: (value) => value },
};
require.cache[require.resolve("../utils/accountEmail")] = {
  exports: { encode: (v) => v, lookup: (v) => v, decode: (r) => r.email },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: { requiredAudit: async () => {} },
};

test("system administrator with legacy staff role can create, edit and delete system users", async () => {
  const app = express();
  app.use(express.json());
  app.use(require("../routes/userRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const body = {
    username: "demo-admin",
    name: "บัญชีทดสอบ",
    email: "demo@example.test",
    role_id: 1,
    status: "active",
    password: "Synthetic-test-only-123",
  };
  const call = (method, path, payload) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: payload && JSON.stringify(payload),
    });
  try {
    const listResponse = await call("GET", "/users");
    assert.equal(listResponse.status, 200);
    const [listed] = await listResponse.json();
    assert.equal(listed.name, "นาย ผู้ดูแล ระบบ");
    assert.equal(listed.email, "demo.full@example.test");
    for (const [method, path, expected] of [
      ["POST", "/users", 201],
      ["PUT", "/users/8", 200],
      ["DELETE", "/users/8", 200],
    ]) {
      const response = await call(
        method,
        path,
        method === "DELETE" ? undefined : body,
      );
      assert.equal(
        response.status,
        expected,
        `${method} ${path}: ${await response.text()}`,
      );
    }
    system = false;
    assert.equal((await call("POST", "/users", body)).status, 403);
    assert.equal((await call("PUT", "/users/8", body)).status, 403);
    assert.equal((await call("DELETE", "/users/8")).status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
