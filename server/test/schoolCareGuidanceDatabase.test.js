const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Step-by-step teacher guidance against local MySQL (rolled back): saved per
// risk level without touching the retention approval, and returned for a
// student and in the risk overview.
test(
  "local MySQL saves care guidance steps beside the care advice",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 30000 },
  async () => {
    require("../config/env");
    assert.ok(
      ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST),
      "Integration fixture is restricted to local MySQL",
    );
    const pool = require("../config/db"),
      connection = await pool.getConnection();
    let server;
    try {
      await connection.beginTransaction();
      const q = connection.query.bind(connection);
      const [[school]] = await q(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      assert.ok(school, "Requires a local school fixture");
      const [[admin]] = await q(
        "SELECT id FROM users WHERE role_id=1 AND status='active' LIMIT 1",
      );
      const [[before]] = await q(
        "SELECT retention_years,retention_approved_at FROM school_workflow_settings WHERE school_id=?",
        [school.id],
      );
      const [st] = await q(
        "INSERT INTO school_students (school_id,student_code,status) VALUES (?,?,'active')",
        [school.id, `gd_${require("crypto").randomBytes(4).toString("hex")}`],
      );
      const db = {
        query: q,
        getConnection: async () => ({
          query: q,
          beginTransaction: async () => {},
          commit: async () => {},
          rollback: async () => {},
          release: () => {},
        }),
      };
      require.cache[require.resolve("../config/db")] = { exports: db };
      for (const p of [
        "../routes/schoolWorkflowRoutes",
        "../routes/schoolTeacherImportRoutes",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const { loadSchoolAccess } = require("../utils/schoolAccess");
      const app = express();
      app.use(express.json());
      app.use(async (req, res, next) => {
        req.user = { id: admin.id };
        req.organizationContext = school.organization_id;
        req.authorization = { isSystemAdmin: true, permissions: new Set() };
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolWorkflowRoutes"));
      app.use((e, req, res, next) =>
        res.status(e.status || 500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const call = async (path, method = "GET", body) => {
        const r = await fetch(
          `http://127.0.0.1:${server.address().port}/school${path}`,
          {
            method,
            headers: { "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        );
        return { status: r.status, body: await r.json() };
      };
      assert.equal(
        (
          await call(`/care-guidance/${school.id}`, "PUT", {
            care_advice: { none: "ดูแลตามปกติ" },
            care_guidance: { none: { cook: "x" } },
          })
        ).status,
        422,
      );
      const saved = await call(`/care-guidance/${school.id}`, "PUT", {
        care_advice: { none: "ดูแลตามปกติ (ทดสอบ)" },
        care_guidance: {
          none: {
            observe: "สังเกตการมาเรียน (ทดสอบ)",
            talk: "",
            refer: "แจ้งครูแนะแนวเมื่อพบสัญญาณเตือน (ทดสอบ)",
          },
        },
      });
      assert.equal(saved.status, 200, saved.body.message);
      const read = await call(`/care-guidance/${school.id}`);
      assert.equal(
        read.body.care_guidance.none.observe,
        "สังเกตการมาเรียน (ทดสอบ)",
      );
      assert.equal(read.body.care_guidance.high.talk, "");
      const forStudent = await call(`/students/${st.insertId}/care-guidance`);
      assert.equal(forStudent.status, 200, forStudent.body.message);
      assert.equal(forStudent.body.risk, "none");
      assert.equal(forStudent.body.care_advice, "ดูแลตามปกติ (ทดสอบ)");
      assert.deepEqual(
        forStudent.body.care_guidance.map((s) => s.step),
        ["observe", "refer"],
        "only written steps, in order",
      );
      const summary = await call(`/risk-summary?school_id=${school.id}`);
      const row = summary.body.data.find((r) => r.id === st.insertId);
      assert.equal(row.care_guidance.length, 2);
      const [[after]] = await q(
        "SELECT retention_years,retention_approved_at FROM school_workflow_settings WHERE school_id=?",
        [school.id],
      );
      assert.deepEqual(
        [after.retention_years, String(after.retention_approved_at)],
        [
          before?.retention_years ?? null,
          String(before?.retention_approved_at ?? null),
        ],
        "retention approval is untouched",
      );
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      delete require.cache[require.resolve("../config/db")];
      await pool.end?.();
    }
  },
);
