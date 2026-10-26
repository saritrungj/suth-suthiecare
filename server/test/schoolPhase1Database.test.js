const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Counselor grade limits through the staff page API, and subject teachers and
// counselors through the teacher import, against local MySQL (rolled back).
test(
  "local MySQL saves counselor grades and imports subject teachers",
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
      const [[otherSchool]] = await q(
        "SELECT id FROM schools WHERE id<>? LIMIT 1",
        [school.id],
      );
      const [[actor]] = await q(
        "SELECT id FROM users WHERE role_id=1 AND status='active' LIMIT 1",
      );
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = require("crypto").randomBytes(4).toString("hex");
      const grade = async (schoolId, name) =>
        (
          await q(
            "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
            [schoolId, name],
          )
        )[0].insertId;
      const g1 = await grade(school.id, `ม.1-${tag}`),
        g2 = await grade(school.id, `ม.2-${tag}`);
      const foreignGrade = otherSchool
        ? await grade(otherSchool.id, `ม.1-${tag}`)
        : null;
      const room = async (name) =>
        (
          await q(
            "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
            [school.id, g1, name],
          )
        )[0].insertId;
      const r1 = await room(`1-${tag}`),
        r2 = await room(`2-${tag}`);
      const [user] = await q(
        "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
        [`cs_${tag}`],
      );
      const counselor = user.insertId;
      await q(
        "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
        [school.organization_id, counselor, role.id],
      );
      await q(
        "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
        [school.id, counselor],
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
        "../routes/schoolInsightRoutes",
        "../routes/schoolTeacherImportRoutes",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const app = express();
      app.use(express.json());
      app.use((req, res, next) => {
        req.user = actor;
        req.organizationContext = school.organization_id;
        req.authorization = { isSystemAdmin: true, permissions: new Set() };
        req.schoolAccess = {
          isSystemAdmin: true,
          canManageStaff: true,
          staff: {},
        };
        next();
      });
      app.use("/school", require("../routes/schoolInsightRoutes"));
      app.use("/school", require("../routes/schoolTeacherImportRoutes"));
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
      const put = (extra) =>
        call("/staff-roles", "PUT", {
          school_id: school.id,
          user_id: counselor,
          role_code: "counselor",
          ...extra,
        });
      const saved = async () => {
        const [[row]] = await q(
          "SELECT grade_scoped FROM school_staff_roles WHERE school_id=? AND user_id=?",
          [school.id, counselor],
        );
        const [grades] = await q(
          "SELECT grade_level_id FROM school_staff_role_grades WHERE school_id=? AND user_id=? ORDER BY grade_level_id",
          [school.id, counselor],
        );
        return {
          scoped: Number(row?.grade_scoped),
          grades: grades.map((g) => g.grade_level_id),
        };
      };

      assert.equal((await put({ grade_level_ids: [g1, g2] })).status, 200);
      assert.deepEqual(await saved(), { scoped: 1, grades: [g1, g2] });
      // Saving again without grades keeps the limit.
      assert.equal((await put({})).status, 200);
      assert.deepEqual(await saved(), { scoped: 1, grades: [g1, g2] });
      const list = await call("/staff-roles");
      assert.ok(list.body.grades.some((g) => g.id === g1));
      assert.deepEqual(
        list.body.role_grades
          .filter((g) => g.user_id === counselor)
          .map((g) => g.grade_level_id)
          .sort((a, b) => a - b),
        [g1, g2],
      );
      assert.equal((await put({ grade_level_ids: [] })).status, 422);
      if (foreignGrade) {
        const refused = await put({ grade_level_ids: [g1, foreignGrade] });
        assert.equal(refused.status, 422);
        assert.match(refused.body.message, /ระดับชั้นต้องอยู่ในโรงเรียน/);
      }
      assert.equal((await put({ grade_level_ids: null })).status, 200);
      assert.deepEqual(await saved(), { scoped: 0, grades: [] });
      await put({ grade_level_ids: [g2] });
      // Another duty clears the grade limit.
      assert.equal((await put({ role_code: "homeroom" })).status, 200);
      assert.deepEqual(await saved(), { scoped: 0, grades: [] });

      // Teacher import: a subject teacher in two rooms, a ม.1/ม.2 counselor.
      const rows = [
        {
          username: `subj_${tag}`,
          name: "ครูรายวิชา ทดสอบ",
          email: `subj_${tag}@example.test`,
          role_code: "subject_teacher",
          grade: `ม.1-${tag}`,
          classroom: `1-${tag}, 2-${tag}`,
          academic_year: 2569,
        },
        {
          username: `gcs_${tag}`,
          name: "ครูแนะแนว ทดสอบ",
          email: `gcs_${tag}@example.test`,
          role_code: "counselor",
          grade: `ม.1-${tag}, ม.2-${tag}`,
        },
        {
          username: `bad_${tag}`,
          name: "ครูแนะแนว ผิด",
          email: `bad_${tag}@example.test`,
          role_code: "counselor",
          grade: `ม.9-${tag}`,
        },
      ];
      const imported = await call("/teachers/import", "POST", {
        school_id: school.id,
        rows,
        dry_run: false,
      });
      assert.equal(imported.status, 200, imported.body.message);
      const [subject, gradeCounselor, bad] = imported.body.results;
      assert.equal(subject.status, "created", subject.errors?.join());
      assert.equal(
        gradeCounselor.status,
        "created",
        gradeCounselor.errors?.join(),
      );
      assert.equal(bad.status, "error");
      const [seats] = await q(
        `SELECT ct.classroom_id,ct.role FROM school_classroom_teachers ct JOIN school_teachers t ON t.id=ct.teacher_id JOIN users u ON u.id=t.user_id WHERE u.username=? ORDER BY ct.classroom_id`,
        [`subj_${tag}`],
      );
      assert.deepEqual(
        seats.map((s) => [s.classroom_id, s.role]),
        [
          [r1, "subject"],
          [r2, "subject"],
        ],
      );
      const [[duty]] = await q(
        "SELECT r.role_code,r.grade_scoped,(SELECT COUNT(*) FROM school_staff_role_grades g WHERE g.user_id=r.user_id AND g.school_id=r.school_id) AS grades FROM school_staff_roles r JOIN users u ON u.id=r.user_id WHERE u.username=? AND r.school_id=?",
        [`gcs_${tag}`, school.id],
      );
      assert.equal(duty.role_code, "counselor");
      assert.equal(Number(duty.grade_scoped), 1);
      assert.equal(Number(duty.grades), 2);
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      delete require.cache[require.resolve("../config/db")];
      await pool.end?.();
    }
  },
);
