require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const writes = [];
const query = async (sql, params = []) => {
  const compact = sql.replace(/\s+/g, " ").trim();
  if (
    compact.includes("FROM schools s") &&
    compact.includes("JOIN organizations o")
  )
    return [[{ id: 21, name: "โรงเรียนสาธิต", organization_id: 2 }]];
  if (
    compact.includes("FROM school_teacher_types t") &&
    compact.includes("JOIN organizations o")
  )
    return [[{ id: 31, name: "ครูประจำการ", organization_id: 2 }]];
  if (compact.startsWith("SELECT id,status FROM users"))
    return [[{ id: 8, status: "active" }]];
  if (
    compact.includes("FROM organization_memberships WHERE user_id=? FOR UPDATE")
  )
    return [[]];
  if (compact.startsWith("SELECT id,org_type FROM organizations"))
    return [[{ id: 2, org_type: "school" }]];
  if (compact.startsWith("SELECT r.id FROM roles r")) return [[{ id: 4 }]];
  if (compact.startsWith("SELECT id FROM organization_memberships"))
    return [[{ id: 44 }]];
  if (compact.startsWith("SELECT id FROM schools WHERE")) return [[{ id: 21 }]];
  if (compact.startsWith("SELECT id FROM school_teacher_types WHERE"))
    return [[{ id: 31 }]];
  if (!compact.startsWith("SELECT")) writes.push({ sql: compact, params });
  return [{ affectedRows: 1, insertId: 1 }];
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
    verifyToken(req, _res, next) {
      req.user = { id: 1, role_id: 1 };
      next();
    },
    verifySuperAdmin(req, _res, next) {
      req.authorization = { isSystemAdmin: true };
      next();
    },
    requirePermission: () => (_req, _res, next) => next(),
  },
};
require.cache[require.resolve("../authorization/dataPermissions")] = {
  exports: { resetMigratedGrants: async () => {} },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: { requiredAudit: async () => {} },
};

test("user assignment options and save link a teacher without duplicate entry", async () => {
  const app = express();
  app.use(express.json());
  app.use(require("../routes/userRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const optionsResponse = await fetch(`${base}/users/assignment-options`);
    assert.equal(optionsResponse.status, 200);
    const options = await optionsResponse.json();
    assert.equal(options.organizations[2].schools[0].id, 21);
    assert.equal(options.organizations[2].teacher_types[0].id, 31);

    const response = await fetch(`${base}/users/8/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memberships: [
          {
            organization_id: 2,
            role_id: 4,
            is_primary: true,
            school_assignment: {
              school_id: 21,
              personnel_kind: "teacher",
              role_code: "homeroom",
              teacher_type_id: 31,
              employee_code: "T-001",
              position: "ครูประจำชั้น",
            },
          },
        ],
      }),
    });
    assert.equal(response.status, 200, await response.text());
    assert.ok(
      writes.some((item) =>
        item.sql.startsWith("INSERT INTO organization_memberships"),
      ),
    );
    assert.ok(
      writes.some((item) =>
        item.sql.startsWith("INSERT INTO school_staff_roles"),
      ),
    );
    assert.ok(
      writes.some((item) => item.sql.startsWith("INSERT INTO school_teachers")),
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
