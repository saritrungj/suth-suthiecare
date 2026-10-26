const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Runs against a local MySQL only (SCHOOL_DB_TESTS=1) and rolls everything
// back: a round limited to one classroom reaches that classroom only. A
// student of another classroom in the same grade does not see it, the staff
// progress page counts only the target classroom, and the dashboard trend
// counts the same students.
test(
  "a round for one classroom skips the other classrooms of its grade",
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
      "../routes/schoolReportRoutes",
      "../services/schoolRescreen",
      "../utils/pdpaAudit",
    ])
      delete require.cache[require.resolve(m)];
    let server;
    try {
      await connection.beginTransaction();
      const [[school]] = await connection.query(
        "SELECT s.id,s.organization_id FROM schools s JOIN school_classrooms c ON c.school_id=s.id ORDER BY s.id LIMIT 1",
      );
      assert.ok(school, "Requires a local school with a classroom");
      const [[form]] = await connection.query(
        "SELECT id FROM forms WHERE organization_id=? AND health_domain='mental' LIMIT 1",
        [school.organization_id],
      );
      assert.ok(form, "Requires a mental health form in the school unit");
      const [[admin]] = await connection.query(
        "SELECT u.id FROM users u JOIN user_system_roles r ON r.user_id=u.id AND r.system_role_id=1 LIMIT 1",
      );
      // A fresh grade with two classrooms and one student with an account in
      // each, so the test does not depend on the local roster.
      const [grade] = await connection.query(
        "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
        [school.id, "ชั้นทดสอบรอบรายห้อง"],
      );
      const classroom = async (name) =>
        (
          await connection.query(
            "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2579)",
            [school.id, grade.insertId, name],
          )
        )[0].insertId;
      const roomA = await classroom("ทดสอบ/1");
      const roomB = await classroom("ทดสอบ/2");
      const enrol = async (code, room) => {
        const [account] = await connection.query(
          "INSERT INTO patient_accounts (username,password_hash,status) VALUES (?,?,'active')",
          [`round-room-${code}-${Date.now()}`, "x"],
        );
        const [row] = await connection.query(
          "INSERT INTO school_students (school_id,classroom_id,student_code,patient_account_id,status) VALUES (?,?,?,?,'active')",
          [school.id, room, code, account.insertId],
        );
        return { id: row.insertId, account: account.insertId };
      };
      const inA = await enrol(`RA${Date.now() % 100000}`, roomA);
      const inB = await enrol(`RB${Date.now() % 100000}`, roomB);

      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.user = { id: admin.id };
        req.organizationContext = school.organization_id;
        req.authorization = { isSystemAdmin: true, permissions: new Set() };
        req.schoolAccess = {
          isSystemAdmin: true,
          hasSchoolRole: false,
          canViewStudents: true,
          canViewAllStudents: true,
          canViewRisk: true,
          teacherSchoolIds: [],
          classroomIds: [],
        };
        next();
      });
      app.use("/school", require("../routes/schoolWorkflowRoutes"));
      app.use(require("../routes/schoolReportRoutes"));
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const call = (path, body) =>
        fetch(`http://127.0.0.1:${server.address().port}${path}`, {
          method: body ? "POST" : "GET",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
      // No earlier answer to this form may count inside the test rounds.
      const day = "2037-02-10"; // TIMESTAMP columns end in 2038
      const round = (name, extra) => ({
        school_id: school.id,
        name,
        academic_year: 2579,
        semester: 2,
        health_domain: "mental",
        form_id: form.id,
        starts_on: day,
        ends_on: day,
        ...extra,
      });
      // The homeroom timetable: one round per classroom, room B a day later.
      const batch = await call("/school/screening-rounds/batch", {
        school_id: school.id,
        rounds: [
          round("รอบห้อง A", { classroom_ids: [roomA] }),
          round("รอบห้อง B", {
            classroom_ids: [roomB],
            starts_on: "2037-02-11",
            ends_on: "2037-02-11",
          }),
        ],
      });
      assert.equal(batch.status, 201, await batch.clone().text());
      const [roundA, roundB] = (await batch.json()).ids;
      const listed = await (await call("/school/screening-rounds")).json();
      assert.deepEqual(
        listed.find((r) => r.id === roundA).classrooms.map((c) => c.id),
        [roomA],
      );
      assert.deepEqual(listed.find((r) => r.id === roundA).grades, []);

      const { pendingRoundsForPatient } = require("../services/schoolRescreen");
      const RealDate = Date;
      const pendingOn = async (account) => {
        global.Date = class extends RealDate {
          constructor(...args) {
            super(...(args.length ? args : [`${day}T05:00:00Z`]));
          }
        };
        try {
          return (await pendingRoundsForPatient(shared, account)).map(
            (r) => r.id,
          );
        } finally {
          global.Date = RealDate;
        }
      };
      // Room B's student does not see room A's round (and theirs is tomorrow).
      assert.deepEqual(await pendingOn(inA.account), [roundA]);
      assert.deepEqual(await pendingOn(inB.account), []);

      // Progress counts the target classroom only.
      const progress = await (
        await call(`/school/screening-rounds/${roundA}/progress`)
      ).json();
      assert.deepEqual(
        progress.data.map((r) => r.id),
        [inA.id],
      );
      assert.equal(progress.total, 1);
      assert.equal(progress.outstanding, 1);

      // A grade round plus room A together: still both rooms.
      const both = await call(
        "/school/screening-rounds",
        round("รอบทั้งชั้น", {
          grade_level_ids: [grade.insertId],
          classroom_ids: [roomA],
        }),
      );
      assert.equal(both.status, 201);
      const bothId = (await both.json()).id;
      const bothProgress = await (
        await call(`/school/screening-rounds/${bothId}/progress`)
      ).json();
      assert.deepEqual(
        bothProgress.data.map((r) => r.id).sort((a, b) => a - b),
        [inA.id, inB.id].sort((a, b) => a - b),
      );

      // The dashboard trend counts only room A's students for room A's round.
      const report = await call(`/reports/overview?school_id=${school.id}`);
      assert.equal(report.status, 200, await report.clone().text());
      const trend = (await report.json()).trend;
      for (const label of ["รอบห้อง A", "รอบห้อง B"]) {
        const period = trend.find((p) => p.label === label);
        assert.equal(period.assessed + period.not_assessed, 1, label);
      }
      assert.equal(
        trend.find((p) => p.label === "รอบทั้งชั้น").not_assessed,
        2,
      );
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);
