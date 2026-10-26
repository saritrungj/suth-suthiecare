const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Runs against a local MySQL only (SCHOOL_DB_TESTS=1) and rolls everything
// back: a screening round reaches the students of its grade levels on their
// own page until they send the form inside the round, and the staff progress
// page counts the same students.
test(
  "screening rounds reach the students of their grades and close on submission",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 60000 },
  async () => {
    require("../config/env");
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST));
    const pool = require("../config/db");
    const connection = await pool.getConnection();
    const shared = {
      query: connection.query.bind(connection),
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
    };
    require.cache[require.resolve("../config/db")] = {
      exports: { query: shared.query, getConnection: async () => shared },
    };
    for (const m of [
      "../routes/schoolWorkflowRoutes",
      "../services/schoolRescreen",
      "../utils/pdpaAudit",
    ])
      delete require.cache[require.resolve(m)];
    let server;
    try {
      await connection.beginTransaction();
      const [[student]] = await connection.query(
        `SELECT ss.id,ss.school_id,ss.person_id,COALESCE(ss.patient_account_id,p.patient_account_id) AS account_id,
                c.grade_level_id,s.organization_id
           FROM school_students ss JOIN schools s ON s.id=ss.school_id
           JOIN school_classrooms c ON c.id=ss.classroom_id
           LEFT JOIN persons p ON p.id=ss.person_id
          WHERE ss.archived_at IS NULL AND ss.status='active'
            AND COALESCE(ss.patient_account_id,p.patient_account_id) IS NOT NULL LIMIT 1`,
      );
      assert.ok(student, "Requires a local student with an account");
      const [[form]] = await connection.query(
        "SELECT id FROM forms WHERE organization_id=? AND health_domain='mental' LIMIT 1",
        [student.organization_id],
      );
      const [[other]] = await connection.query(
        "SELECT id FROM school_grade_levels WHERE school_id=? AND id<>? LIMIT 1",
        [student.school_id, student.grade_level_id],
      );
      const [[admin]] = await connection.query(
        "SELECT u.id FROM users u JOIN user_system_roles r ON r.user_id=u.id AND r.system_role_id=1 LIMIT 1",
      );
      // No earlier answer to this form may count inside the test rounds.
      const day = "2037-01-15"; // TIMESTAMP columns end in 2038
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.user = { id: admin.id };
        req.organizationContext = student.organization_id;
        req.authorization = { isSystemAdmin: true, permissions: new Set() };
        req.schoolAccess = {
          isSystemAdmin: true,
          canViewStudents: true,
          canViewAllStudents: true,
          teacherSchoolIds: [],
          classroomIds: [],
        };
        next();
      });
      app.use("/school", require("../routes/schoolWorkflowRoutes"));
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const call = (path, body) =>
        fetch(`http://127.0.0.1:${server.address().port}/school${path}`, {
          method: body ? "POST" : "GET",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
      const round = (name, grades) => ({
        school_id: student.school_id,
        name,
        academic_year: 2579,
        semester: 1,
        health_domain: "mental",
        form_id: form.id,
        starts_on: "2037-01-01",
        ends_on: "2037-01-31",
        grade_level_ids: grades,
      });
      // A grade from another school is refused.
      assert.equal(
        (await call("/screening-rounds", round("x", [999999999]))).status,
        422,
      );
      const mine = await call(
        "/screening-rounds",
        round("รอบทดสอบ 1", [student.grade_level_id]),
      );
      assert.equal(mine.status, 201, await mine.clone().text());
      const mineId = (await mine.json()).id;
      if (other)
        assert.equal(
          (await call("/screening-rounds", round("รอบชั้นอื่น", [other.id])))
            .status,
          201,
        );
      const listed = await (await call("/screening-rounds")).json();
      assert.deepEqual(
        listed.find((r) => r.id === mineId).grades.map((g) => g.id),
        [student.grade_level_id],
      );

      // The student's page, on a day inside the rounds.
      const { pendingRoundsForPatient } = require("../services/schoolRescreen");
      const realNow = Date.now;
      Date.now = () => new Date(`${day}T05:00:00Z`).getTime();
      const RealDate = Date;
      global.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [`${day}T05:00:00Z`]));
        }
      };
      let pending;
      try {
        pending = await pendingRoundsForPatient(shared, student.account_id);
      } finally {
        global.Date = RealDate;
        Date.now = realNow;
      }
      assert.deepEqual(
        pending.map((r) => r.round_name),
        ["รอบทดสอบ 1"],
      );

      // Sending the form inside the round closes it for the student and
      // counts on the staff progress page.
      await connection.query(
        "INSERT INTO form_responses (form_id,organization_id,person_id,patient_account_id,submitted_at) VALUES (?,?,?,?,?)",
        [
          form.id,
          student.organization_id,
          student.person_id,
          student.account_id,
          `${day} 10:00:00`,
        ],
      );
      global.Date = class extends RealDate {
        constructor(...args) {
          super(...(args.length ? args : [`${day}T05:00:00Z`]));
        }
      };
      try {
        pending = await pendingRoundsForPatient(shared, student.account_id);
      } finally {
        global.Date = RealDate;
      }
      assert.equal(pending.length, 0);
      const progress = await (
        await call(`/screening-rounds/${mineId}/progress`)
      ).json();
      const rows = progress.data || progress.students || progress;
      assert.ok(Array.isArray(rows));
      const mineRow = rows.find((r) => r.id === student.id);
      assert.ok(mineRow?.completed_on);
      // Only students of the round's grade level are counted.
      assert.ok(rows.every((r) => r.grade_name === mineRow.grade_name));
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);
