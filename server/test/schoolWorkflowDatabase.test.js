const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test(
  "local MySQL runs screening, teacher onboarding, enrollment history and retention with rollback",
  {
    skip: process.env.SCHOOL_DB_TESTS !== "1",
    timeout: 30000,
  },
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
      const [[school]] = await connection.query(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      assert.ok(school, "Requires a local school fixture");
      const [[actor]] = await connection.query(
        "SELECT id FROM users WHERE role_id=1 AND status='active' LIMIT 1",
      );
      assert.ok(actor);
      const [[form]] = await connection.query(
        "SELECT id,health_domain FROM forms WHERE organization_id=? AND health_domain IN ('mental','physical') LIMIT 1",
        [school.organization_id],
      );
      assert.ok(form, "Requires a local school assessment");
      const [[room]] = await connection.query(
        "SELECT id FROM school_classrooms WHERE school_id=? LIMIT 1",
        [school.id],
      );
      assert.ok(room);
      const code =
        "workflow_" + require("crypto").randomBytes(5).toString("hex");
      const [insert] = await connection.query(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status,is_boarder,graduated_on) VALUES (?,?,?,'graduated',1,'2020-01-01')",
        [school.id, room.id, code],
      );
      const studentId = insert.insertId;
      await connection.query(
        "INSERT INTO school_enrollment_history (student_id,from_classroom_id,to_classroom_id,changed_by) VALUES (?,NULL,?,?)",
        [studentId, room.id, actor.id],
      );
      // Every route's commit/rollback remains inside this test's outer rollback.
      const db = {
        query: connection.query.bind(connection),
        getConnection: async () => ({
          query: connection.query.bind(connection),
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
      const access = {
        isSystemAdmin: true,
        canViewRisk: true,
        canViewAllStudents: true,
        canViewStudents: true,
        allStudentSchoolIds: [],
        classroomIds: [],
        teacherSchoolIds: [],
        physicalSchoolIds: [],
      };
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = actor;
        req.organizationContext = school.organization_id;
        req.schoolAccess = access;
        req.authorization = { isSystemAdmin: true, permissions: new Set() };
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
        const data = await r.json();
        assert.ok(r.ok, `${path}: ${r.status} ${data.message || ""}`);
        return data;
      };
      const round = await call("/screening-rounds", "POST", {
        school_id: school.id,
        name: "Synthetic integration round",
        academic_year: 2569,
        semester: 2,
        health_domain: form.health_domain,
        form_id: form.id,
        starts_on: "2026-11-02",
        ends_on: "2026-11-15",
      });
      const progress = await call(`/screening-rounds/${round.id}/progress`);
      assert.equal(progress.total, progress.completed + progress.outstanding);
      const [[mentalForm]] = await connection.query(
        "SELECT id,questions FROM forms WHERE organization_id=? AND health_domain='mental' LIMIT 1",
        [school.organization_id],
      );
      if (mentalForm) {
        const questions =
          typeof mentalForm.questions === "string"
            ? JSON.parse(mentalForm.questions)
            : mentalForm.questions;
        const flatten = (items) =>
          (items || []).flatMap((q) => [q, ...flatten(q.subQuestions)]);
        const question = flatten(questions).find(
          (q) =>
            [
              "multiple_choice",
              "dropdown",
              "checkboxes",
              "grid_multiple",
              "grid_checkbox",
            ].includes(q.type) &&
            (q.options?.length || q.cols?.length),
        );
        if (question) {
          const trigger = await call("/risk-triggers", "POST", {
            school_id: school.id,
            form_id: mentalForm.id,
            question_id: question.id,
            answer_path: question.rows ? "0" : "",
            answer_value: String((question.options || question.cols)[0]),
          });
          assert.ok(trigger.id);
        }
      }
      const history = await call(`/students/${studentId}/enrollment-history`);
      assert.equal(history.length, 1);
      await call(`/workflow-settings/${school.id}`, "PUT", {
        care_advice: {
          high: "Synthetic care advice",
          medium: "",
          normal: "",
          none: "",
        },
        retention_years: 2,
      });
      const preview = await call(`/retention/${school.id}`, "POST", {
        dry_run: true,
      });
      assert.ok(preview.data.some((s) => s.id === studentId));
      // Only execute the fixture's archive, never other eligible local students.
      const [[eligibility]] = await connection.query(
        "SELECT archived_at FROM school_students WHERE id=?",
        [studentId],
      );
      assert.equal(eligibility.archived_at, null);
      const username = "wf_" + require("crypto").randomBytes(5).toString("hex");
      const teacherRow = {
        username,
        name: "ครูทดสอบ ระบบ",
        email: username + "@example.com",
        role_code: "homeroom",
        initial_password: "DemoStrong#2026",
      };
      const [[classroom]] = await connection.query(
        "SELECT c.name,c.academic_year,g.name AS grade FROM school_classrooms c JOIN school_grade_levels g ON g.id=c.grade_level_id WHERE c.id=?",
        [room.id],
      );
      Object.assign(teacherRow, {
        classroom: classroom.name,
        grade: classroom.grade,
        academic_year: classroom.academic_year,
      });
      const checked = await call("/teachers/import", "POST", {
        school_id: school.id,
        rows: [teacherRow],
        dry_run: true,
      });
      assert.equal(checked.results[0].status, "will_create");
      const applied = await call("/teachers/import", "POST", {
        school_id: school.id,
        rows: [teacherRow],
        dry_run: false,
      });
      assert.equal(applied.results[0].status, "created");
      const [[staff]] = await connection.query(
        "SELECT u.id,u.role_id,u.email_verified_at,r.role_code FROM users u JOIN school_staff_roles r ON r.user_id=u.id WHERE u.username=? AND r.school_id=?",
        [username, school.id],
      );
      assert.ok(staff.role_id !== 1);
      assert.equal(staff.email_verified_at, null);
      assert.equal(staff.role_code, "homeroom");
      const [[assignment]] = await connection.query(
        "SELECT ct.classroom_id FROM school_classroom_teachers ct JOIN school_teachers t ON t.id=ct.teacher_id WHERE t.user_id=?",
        [staff.id],
      );
      assert.equal(assignment.classroom_id, room.id);
      const assignees = await call(
        `/rescreen-assignees?student_id=${studentId}`,
      );
      assert.ok(assignees.some((u) => u.id === staff.id));
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);
