const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test("CSV cells never start a spreadsheet formula", () => {
  const { csvCell } = require("../utils/csvCell");
  assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
  assert.equal(csvCell("@cmd"), `"'@cmd"`);
  assert.equal(csvCell('ครู "ทดสอบ"'), `"ครู ""ทดสอบ"""`);
  assert.equal(csvCell(null), `""`);
});

// The unit history against local MySQL (rolled back): reads left out unless
// asked, filters by person and area, field names but no values, CSV only with
// audit.export, and a student's history only for staff who see the student.
test(
  "local MySQL shows the unit's change history to audit.view only",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 60000 },
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
      const tag = require("crypto").randomBytes(4).toString("hex");
      const [actor] = await q(
        "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
        [`aud_${tag}`],
      );
      const [room] = await q(
        "SELECT id FROM school_classrooms WHERE school_id=? LIMIT 1",
        [school.id],
      );
      const [inScope] = await q(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status) VALUES (?,?,?,'active')",
        [school.id, room[0]?.id || null, `aud_${tag}`],
      );
      const log = (action, targetType, targetId, after) =>
        q(
          "INSERT INTO authorization_audit_logs (actor_user_id,organization_id,action,target_type,target_id,result,after_data) VALUES (?,?,?,?,?,'changed',?)",
          [
            actor.insertId,
            school.organization_id,
            action,
            targetType,
            String(targetId),
            after ? JSON.stringify(after) : null,
          ],
        );
      await log("student_behavior.create", "student", inScope.insertId, {
        report_id: 7,
      });
      await log("students.update", "student", inScope.insertId, {
        fields: ["first_name", "phone"],
      });
      await log("data.read", "route", "/api/school/students", null);
      await log("school_documents.create", "school", school.id, {
        document_id: 3,
      });

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
      let keys = new Set(["audit.view"]);
      let scope = {
        classroomIds: [],
        allStudentSchoolIds: [school.id],
        counselorClassroomIds: [],
      };
      require.cache[require.resolve("../middleware/authMiddleware")] = {
        exports: {
          verifyToken: (req, _res, next) => {
            req.user = { id: 1 };
            req.organizationContext = school.organization_id;
            req.authorization = { isSystemAdmin: false, permissions: keys };
            next();
          },
          verifySuperAdmin: (_req, _res, next) => next(),
          verifyAdmin: (_req, _res, next) => next(),
          requirePermission: () => (_req, _res, next) => next(),
        },
      };
      for (const p of ["../routes/auditRoutes", "../routes/schoolAuditRoutes"])
        delete require.cache[require.resolve(p)];
      const app = express();
      app.use("/api/audit-logs", require("../routes/auditRoutes"));
      app.use("/api/school", (req, _res, next) => {
        req.organizationContext = school.organization_id;
        req.authorization = { isSystemAdmin: false, permissions: keys };
        req.schoolAccess = { ...scope, isSystemAdmin: false };
        next();
      });
      app.use("/api/school", require("../routes/schoolAuditRoutes"));
      app.use((e, req, res, next) =>
        res.status(500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const get = async (path) => {
        const r = await fetch(
          `http://127.0.0.1:${server.address().port}${path}`,
        );
        return {
          status: r.status,
          text: await r.text(),
          type: r.headers.get("content-type"),
        };
      };
      const json = async (path) => JSON.parse((await get(path)).text);

      const mine = await json(
        `/api/audit-logs?actor=${actor.insertId}&limit=50`,
      );
      assert.deepEqual(
        mine.data.map((r) => r.action).sort(),
        [
          "school_documents.create",
          "student_behavior.create",
          "students.update",
        ],
        "reads are left out by default",
      );
      const update = mine.data.find((r) => r.action === "students.update");
      assert.deepEqual(update.fields, ["first_name", "phone"]);
      assert.equal(update.student_code, `aud_${tag}`);
      assert.equal(JSON.stringify(update).includes("phone_value"), false);
      const withReads = await json(
        `/api/audit-logs?actor=${actor.insertId}&include_reads=1&limit=50`,
      );
      assert.equal(withReads.data.length, 4);
      const area = await json(
        `/api/audit-logs?actor=${actor.insertId}&area=school_documents`,
      );
      assert.deepEqual(
        area.data.map((r) => r.details.document_id),
        [3],
      );

      assert.equal(
        (await get(`/api/audit-logs?format=csv&actor=${actor.insertId}`))
          .status,
        403,
        "CSV needs audit.export",
      );
      keys = new Set(["audit.view", "audit.export"]);
      const csv = await get(
        `/api/audit-logs?format=csv&actor=${actor.insertId}`,
      );
      assert.equal(csv.status, 200);
      assert.match(csv.type, /text\/csv/);
      assert.equal(
        csv.text.trim().split(/\r\n/).length,
        4,
        "header and three changes",
      );

      // The student's own history, only within scope.
      const studentLog = await json(
        `/api/school/students/${inScope.insertId}/audit`,
      );
      assert.deepEqual(studentLog.data.map((r) => r.action).sort(), [
        "student_behavior.create",
        "students.update",
      ]);
      scope = {
        classroomIds: [],
        allStudentSchoolIds: [],
        counselorClassroomIds: [],
      };
      assert.equal(
        (await get(`/api/school/students/${inScope.insertId}/audit`)).status,
        404,
      );
      keys = new Set();
      assert.equal((await get("/api/audit-logs")).status, 403);
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      delete require.cache[require.resolve("../config/db")];
      delete require.cache[require.resolve("../middleware/authMiddleware")];
      await pool.end?.();
    }
  },
);
