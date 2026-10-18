const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test("unit role catalogs isolate units; creation and removal preserve other units and roll back audit failures", async () => {
  let system = true,
    auditFail = false,
    nextId = 10;
  let roles = new Map([
    [3, { id: 3, name: "เจ้าหน้าที่" }],
    [4, { id: 4, name: "ผู้ติดตาม" }],
  ]);
  let sets = new Map([
    ["1:3", 1],
    ["2:3", 1],
    ["2:4", 1],
  ]);
  let permissions = new Map([
    ["1:3", ["cases.view"]],
    ["2:3", ["forms.view"]],
  ]);
  const members = new Set(["2:4"]);
  const key = (p) => p[0] + ":" + p[1];
  const query = async (sql, p = []) => {
    if (sql.startsWith("SELECT id,org_type FROM organizations"))
      return [
        [
          Number(p[0]) <= 2 ? { id: Number(p[0]), org_type: "hospital" } : null,
        ].filter(Boolean),
      ];
    if (sql.startsWith("SELECT id FROM roles"))
      return [[roles.get(Number(p[0]))].filter(Boolean)];
    if (sql.startsWith("SELECT r.id,r.name")) {
      assert.deepEqual(p, [p[0], p[0], p[0]]);
      assert.match(sql, /school_guardian/);
      assert.match(sql, /r.id<>1/);
      return [
        [...roles.values()].filter(
          (r) => sets.has(p[0] + ":" + r.id) || members.has(p[0] + ":" + r.id),
        ),
      ];
    }
    if (sql.startsWith("SELECT id,name FROM roles"))
      return [
        [[...roles.values()].find((r) => r.name === p[0])].filter(Boolean),
      ];
    if (sql.startsWith("INSERT INTO roles")) {
      const id = nextId++;
      roles.set(id, { id, name: p[0], description: p[1] });
      return [{ insertId: id }];
    }
    if (sql.startsWith("SELECT version"))
      return [sets.has(key(p)) ? [{ version: sets.get(key(p)) }] : []];
    if (sql.startsWith("INSERT INTO organization_role_permission_sets")) {
      sets.set(key(p), 1);
      return [{}];
    }
    if (sql.startsWith("SELECT id FROM organization_memberships"))
      return [members.has(key(p)) ? [{ id: 8 }] : []];
    if (sql.startsWith("DELETE FROM organization_role_permissions")) {
      permissions.delete(key(p));
      return [{}];
    }
    if (sql.startsWith("DELETE FROM organization_role_permission_sets"))
      return [{ affectedRows: Number(sets.delete(key(p))) }];
    if (sql.startsWith("INSERT INTO authorization_audit_logs")) {
      if (auditFail) throw Error("audit unavailable");
      return [{}];
    }
    throw Error("Unexpected query: " + sql);
  };
  let snapshot;
  const connection = {
    query,
    beginTransaction: async () => {
      snapshot = {
        roles: structuredClone(roles),
        sets: structuredClone(sets),
        permissions: structuredClone(permissions),
      };
    },
    commit: async () => {},
    rollback: async () => {
      ({ roles, sets, permissions } = snapshot);
    },
    release() {},
  };
  require.cache[require.resolve("../config/db")] = {
    exports: { query, getConnection: async () => connection },
  };
  require.cache[require.resolve("../middleware/authMiddleware")] = {
    exports: {
      verifyToken: (req, res, next) => {
        req.user = { id: 1 };
        next();
      },
      verifySuperAdmin: (req, res, next) =>
        system ? next() : res.sendStatus(403),
    },
  };
  const app = express();
  app.use(express.json());
  app.use(require("../routes/organizationPermissionRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  const post = (unit, name) =>
    fetch(url + "/organizations/" + unit + "/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: "บทบาทเฉพาะหน่วยงาน" }),
    });
  const remove = (unit, role) =>
    fetch(url + "/organizations/" + unit + "/roles/" + role, {
      method: "DELETE",
    });
  try {
    system = false;
    assert.equal((await post(1, "บทบาทใหม่")).status, 403);
    assert.equal((await fetch(url + "/organizations/1/roles")).status, 403);
    system = true;
    assert.deepEqual(
      (await (await fetch(url + "/organizations/1/roles")).json()).map(
        (r) => r.id,
      ),
      [3],
    );
    assert.deepEqual(
      (await (await fetch(url + "/organizations/2/roles")).json()).map(
        (r) => r.id,
      ),
      [3, 4],
    );
    assert.equal((await fetch(url + "/organizations/99/roles")).status, 404);
    assert.equal((await post(1, "school_guardian")).status, 422);
    const created = await post(1, "บทบาทใหม่");
    assert.equal(created.status, 201);
    const role = await created.json();
    assert.ok(sets.has("1:" + role.id));
    assert.equal(sets.has("2:" + role.id), false);
    assert.equal((await post(1, "บทบาทใหม่")).status, 409);
    assert.equal((await post(2, "บทบาทใหม่")).status, 201);
    assert.equal((await remove(2, 4)).status, 409);
    auditFail = true;
    assert.equal((await remove(1, role.id)).status, 503);
    assert.ok(sets.has("1:" + role.id));
    assert.equal((await post(1, "บทบาทที่บันทึกไม่สำเร็จ")).status, 503);
    assert.ok(
      ![...roles.values()].some((r) => r.name === "บทบาทที่บันทึกไม่สำเร็จ"),
    );
    auditFail = false;
    assert.equal((await remove(1, role.id)).status, 200);
    assert.equal(sets.has("1:" + role.id), false);
    assert.ok(sets.has("2:" + role.id));
    assert.ok(roles.has(role.id));
    assert.deepEqual(permissions.get("2:3"), ["forms.view"]);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
