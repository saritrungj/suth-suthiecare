require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express");

test("unit permissions use both organization and role with no shared/system fallback", async () => {
  const calls = [],
    db = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return [params[0] === 1 ? [{ permission_key: "cases.view" }] : []];
      },
    };
  const {
    organizationRolePermissions,
  } = require("../authorization/organizationPermissions");
  assert.deepEqual(await organizationRolePermissions(db, 1, 3), ["cases.view"]);
  assert.deepEqual(await organizationRolePermissions(db, 2, 3), []);
  assert.deepEqual(
    calls.map((call) => call.params),
    [
      [1, 3],
      [2, 3],
    ],
  );
  assert.ok(
    calls.every((call) =>
      call.sql.includes(
        "FROM organization_role_permissions WHERE organization_id=? AND role_id=?",
      ),
    ),
  );
});

test("unit permission updates isolate units, require system authority, detect conflicts and roll back audit failure", async () => {
  let system = true,
    auditFail = false,
    rollback = 0;
  const sets = new Map([
    ["1:3", { version: 1, permissions: ["cases.view"] }],
    ["2:3", { version: 1, permissions: ["cases.view"] }],
  ]);
  let snapshot;
  const key = (params) => `${params[0]}:${params[1]}`;
  const query = async (sql, params = []) => {
    if (sql.startsWith("SELECT id FROM organizations"))
      return [
        [Number(params[0]) < 3 ? { id: Number(params[0]) } : undefined].filter(
          Boolean,
        ),
      ];
    if (sql.startsWith("SELECT id FROM roles"))
      return [Number(params[0]) === 3 ? [{ id: 3 }] : []];
    if (sql.startsWith("SELECT version"))
      return [
        sets.has(key(params))
          ? [{ version: sets.get(key(params)).version }]
          : [],
      ];
    if (sql.startsWith("SELECT permission_key"))
      return [
        (sets.get(key(params))?.permissions || []).map((permission_key) => ({
          permission_key,
        })),
      ];
    if (sql.startsWith("INSERT INTO organization_role_permission_sets")) {
      const old = sets.get(key(params));
      sets.set(key(params), {
        version: (old?.version || 0) + 1,
        permissions: old?.permissions || [],
      });
      return [{}];
    }
    if (sql.startsWith("DELETE FROM organization_role_permissions")) {
      sets.get(key(params)).permissions = [];
      return [{}];
    }
    if (sql.startsWith("INSERT INTO organization_role_permissions")) {
      sets.get(key(params)).permissions.push(params[2]);
      return [{}];
    }
    if (sql.startsWith("INSERT INTO authorization_audit_logs")) {
      if (auditFail) throw new Error("Synthetic audit failure");
      assert.equal(params[2], 1);
      return [{}];
    }
    throw new Error("Unexpected query");
  };
  const connection = {
    query,
    beginTransaction: async () => {
      snapshot = structuredClone(sets);
    },
    commit: async () => {},
    rollback: async () => {
      rollback++;
      sets.clear();
      for (const [k, v] of snapshot) sets.set(k, v);
    },
    release: () => {},
  };
  require.cache[require.resolve("../config/db")] = {
    exports: { query, getConnection: async () => connection },
  };
  require.cache[require.resolve("../middleware/authMiddleware")] = {
    exports: {
      verifyToken: (req, res, next) => {
        req.user = { id: 7 };
        next();
      },
      verifySuperAdmin: (req, res, next) =>
        system ? next() : res.status(403).json({}),
    },
  };
  delete require.cache[require.resolve("../utils/pdpaAudit")];
  delete require.cache[
    require.resolve("../routes/organizationPermissionRoutes")
  ];
  const app = express();
  app.use(express.json());
  app.use(require("../routes/organizationPermissionRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/organizations/1/roles/3/permissions`;
  const put = (body) =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    system = false;
    assert.equal(
      (await put({ permissions: ["cases.view"], version: 1 })).status,
      403,
    );
    system = true;
    assert.equal(
      (await put({ permissions: ["roles.manage"], version: 1 })).status,
      422,
    );
    assert.equal(
      (await put({ permissions: ["forms.view"], version: 0 })).status,
      409,
    );
    assert.equal(
      (await put({ permissions: ["forms.view"], version: 1 })).status,
      200,
    );
    assert.deepEqual(sets.get("1:3"), {
      version: 2,
      permissions: ["forms.view"],
    });
    assert.deepEqual(sets.get("2:3"), {
      version: 1,
      permissions: ["cases.view"],
    });
    auditFail = true;
    assert.equal((await put({ permissions: [], version: 2 })).status, 503);
    assert.deepEqual(sets.get("1:3").permissions, ["forms.view"]);
    auditFail = false;
    assert.equal((await put({ permissions: [], version: 2 })).status, 200);
    assert.deepEqual((await (await fetch(url)).json()).permissions, []);
    assert.ok(rollback >= 2);
    assert.equal((await fetch(url.replace("/1/", "/99/"))).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
