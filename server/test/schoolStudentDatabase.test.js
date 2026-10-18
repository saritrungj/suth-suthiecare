const test = require("node:test");
const assert = require("node:assert/strict");

test(
  "MySQL school lists, details and exports match the scoped student count",
  {
    skip: process.env.SCHOOL_DB_TESTS !== "1",
    timeout: 30000,
  },
  async () => {
    const db = require("../config/db");
    const {
      capture,
      collectSource,
      definitions,
    } = require("../services/exportData");
    const { loadAuthorization } = require("../authorization/authorization");
    try {
      // Exercise the real read handlers with the existing local admin in a
      // request fixture. No login credentials or private fields are printed.
      const [[user]] = await db.query(
        "SELECT id,auth_version FROM users WHERE role_id=1 AND status='active' LIMIT 1",
      );
      assert.ok(user, "Local integration database requires an active admin");
      const authorization = await loadAuthorization(user.id);
      const [organizations] = await db.query(
        "SELECT id FROM organizations WHERE org_type='school' AND status='active'",
      );
      assert.ok(organizations.length);
      for (const organization of organizations) {
        const req = {
          user: authorization.user,
          authorization,
          organizationContext: organization.id,
          privateSessions: {
            staff: { account_id: user.id, auth_version: user.auth_version },
          },
          headers: {},
          cookies: {},
          method: "GET",
          ip: "127.0.0.1",
          requestId: require("crypto").randomUUID(),
          get(name) {
            return name.toLowerCase() === "x-organization-id"
              ? String(organization.id)
              : undefined;
          },
        };
        const [[expected]] = await db.query(
          "SELECT COUNT(*) total FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE s.organization_id=?",
          [organization.id],
        );
        const first = await capture(req, definitions.students, {
          page: 1,
          limit: 20,
        });
        assert.equal(first.pagination.total, expected.total);
        const ids = new Set();
        for (let page = 1; page <= first.pagination.total_pages; page++) {
          const result =
            page === 1
              ? first
              : await capture(req, definitions.students, { page, limit: 20 });
          for (const student of result.data) {
            assert.ok(student.status_label);
            assert.ok(
              !ids.has(student.id),
              "Pagination must not repeat students",
            );
            ids.add(student.id);
          }
        }
        assert.equal(ids.size, expected.total);
        if (first.data.length) {
          const detail = await capture(
            req,
            definitions.student,
            {},
            first.data[0].id,
          );
          assert.equal(detail.id, first.data[0].id);
          assert.equal(detail.status_label, first.data[0].status_label);
        }
        const exported = await collectSource(
          req,
          { resource: "students" },
          false,
        );
        assert.equal(exported.length, expected.total);
        assert.deepEqual(new Set(exported.map((student) => student.id)), ids);
      }
    } finally {
      await db.end();
    }
  },
);
