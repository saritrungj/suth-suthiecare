require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { randomUUID } = require("node:crypto");

test(
  "local MySQL master categories support scoped reads, creates, updates and private templates with rollback",
  {
    skip: process.env.SCHOOL_DB_TESTS !== "1",
    timeout: 30000,
  },
  async () => {
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST));
    const pool = require("../config/db");
    const connection = await pool.getConnection();
    let server;
    try {
      await connection.beginTransaction();
      const [[actor]] = await connection.query(
        "SELECT id FROM users WHERE role_id=1 AND status='active' LIMIT 1",
      );
      const [organizations] = await connection.query(
        "SELECT MIN(id) id,org_type FROM organizations WHERE status='active' AND org_type IN ('hospital','school') GROUP BY org_type",
      );
      assert.ok(
        actor && organizations.length === 2,
        "Requires local hospital and school fixtures",
      );
      const query = connection.query.bind(connection);
      require.cache[require.resolve("../config/db")] = {
        exports: {
          query,
          getConnection: async () => ({
            query,
            beginTransaction: async () => {
              await connection.query("SAVEPOINT master_action");
            },
            commit: async () => {
              await connection.query("RELEASE SAVEPOINT master_action");
            },
            rollback: async () => {
              await connection.query("ROLLBACK TO SAVEPOINT master_action");
            },
            release() {},
          }),
        },
      };
      delete require.cache[require.resolve("../routes/masterDataRoutes")];
      delete require.cache[require.resolve("../utils/pdpaAudit")];
      let organization,
        system = true;
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = actor;
        req.authorization = {
          isSystemAdmin: system,
          permissions: new Set(["master_data.manage"]),
        };
        req.organizationContext = organization.id;
        next();
      });
      app.use(require("../routes/masterDataRoutes"));
      app.use((error, req, res, next) =>
        res.status(error.status || 500).json({ message: error.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((resolve) => server.once("listening", resolve));
      const call = async (path, method = "GET", body) => {
        const response = await fetch(
          `http://127.0.0.1:${server.address().port}${path}`,
          {
            method,
            headers: { "Content-Type": "application/json" },
            body: body && JSON.stringify(body),
          },
        );
        const data = await response.json();
        assert.ok(
          response.ok,
          `${method} ${path}: ${response.status} ${JSON.stringify(data)}`,
        );
        return data;
      };
      organization = organizations[0];
      const all = await call("/student_status?organization_id=all");
      assert.ok(new Set(all.map((r) => r.organization_id)).size >= 2);
      assert.ok(all.every((r) => r.organization_name));
      const base = `http://127.0.0.1:${server.address().port}`;
      assert.equal(
        (
          await fetch(base + "/student_status?organization_id=all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        422,
      );
      system = false;
      assert.equal(
        (
          await fetch(
            base + `/student_status?organization_id=${organizations[1].id}`,
          )
        ).status,
        403,
      );
      assert.equal(
        (await fetch(base + "/student_status?organization_id=all")).status,
        403,
      );
      system = true;
      for (organization of organizations) {
        const { categories, can_manage } = await call("/categories");
        assert.equal(can_manage, true);
        assert.equal(
          categories.some((c) => c.code === "teacher_types"),
          organization.org_type === "school",
        );
        for (const category of categories) {
          const rows = await call(`/${category.code}`);
          assert.ok(Array.isArray(rows));
          let id, body;
          if (category.fixed) {
            assert.ok(rows.length);
            const row = rows[0];
            id = row.id;
            body = {
              code: row.code,
              label: row.label,
              sort_order: row.sort_order,
              is_active: row.is_active === true || row.is_active === 1,
            };
          } else {
            const label = "synthetic_" + randomUUID().slice(0, 8);
            body = {
              ...Object.fromEntries(
                category.fields.map((key) => [
                  key,
                  key === "color"
                    ? "#1d5c8c"
                    : key === "clinic_type"
                      ? "general"
                      : key === "description"
                        ? ""
                        : label,
                ]),
              ),
              sort_order: 0,
              is_active: true,
            };
            if (
              !category.fields.includes("name") &&
              !category.fields.includes("text")
            )
              body.code = label;
            id = (await call(`/${category.code}`, "POST", body)).id;
          }
          await call(`/${category.code}/${id}`, "PUT", {
            ...body,
            is_active: false,
          });
          const saved = (await call(`/${category.code}`)).find(
            (row) => Number(row.id) === Number(id),
          );
          assert.ok(saved);
          assert.equal(Boolean(saved.is_active), false);
          if (category.code === "templates")
            assert.equal(saved.text, body.text);
        }
      }
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);
