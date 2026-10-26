const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Behaviour reports end to end against local MySQL (rolled back): a subject
// teacher reports, the homeroom teacher and the grade counselor are told and
// follow up, the reporter sees only status, an outsider sees nothing.
test(
  "local MySQL keeps behaviour reports with their reporter and the people responsible",
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
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = require("crypto").randomBytes(4).toString("hex");
      const [g] = await q(
        "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
        [school.id, `ม.1-${tag}`],
      );
      const room = async (name) =>
        (
          await q(
            "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
            [school.id, g.insertId, `${name}-${tag}`],
          )
        )[0].insertId;
      const roomA = await room("1"),
        roomB = await room("2");
      const staff = async (name, duty, seat, roomId, gradeScoped = 0) => {
        const [u] = await q(
          "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
          [`${name}_${tag}`],
        );
        await q(
          "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
          [school.organization_id, u.insertId, role.id],
        );
        await q(
          "INSERT INTO school_staff_roles (school_id,user_id,role_code,status,grade_scoped) VALUES (?,?,?,'active',?)",
          [school.id, u.insertId, duty, gradeScoped],
        );
        if (seat) {
          const [t] = await q(
            "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
            [school.id, u.insertId],
          );
          await q(
            "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,?)",
            [roomId, t.insertId, seat],
          );
        }
        return u.insertId;
      };
      const subject = await staff("subj", "subject_teacher", "subject", roomA),
        homeroom = await staff("hr", "homeroom", "homeroom", roomA),
        counselor = await staff("cs", "counselor", null, null, 1),
        outsider = await staff("out", "subject_teacher", "subject", roomB);
      await q(
        "INSERT INTO school_staff_role_grades (school_id,user_id,grade_level_id) VALUES (?,?,?)",
        [school.id, counselor, g.insertId],
      );
      const [st] = await q(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status) VALUES (?,?,?,'active')",
        [school.id, roomA, `beh_${tag}`],
      );
      const studentId = st.insertId;

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
      for (const p of ["../routes/schoolBehaviorRoutes", "../utils/pdpaAudit"])
        delete require.cache[require.resolve(p)];
      const { loadSchoolAccess } = require("../utils/schoolAccess");
      const { expandManage } = require("../authorization/permissionMatrix");
      const reporterKeys = ["students.view", "student_behavior.create"];
      const responsibleKeys = [
        "students.view",
        "student_behavior.view",
        "student_behavior.create",
        "student_behavior.update",
        "student_behavior.assign",
        "student_behavior.delete",
      ];
      const keysFor = (userId) =>
        [homeroom, counselor].includes(userId) ? responsibleKeys : reporterKeys;
      let actor = subject;
      const app = express();
      app.use(express.json());
      app.use(async (req, res, next) => {
        req.user = { id: actor };
        req.organizationContext = school.organization_id;
        req.authorization = {
          isSystemAdmin: false,
          permissions: new Set(expandManage(keysFor(actor))),
        };
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolBehaviorRoutes"));
      app.use((e, req, res, next) =>
        res.status(e.status || 500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const call = async (as, path, method = "GET", body) => {
        actor = as;
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
      const report = {
        student_id: studentId,
        category: "emotion",
        concern_level: "high",
        observed_on: "2026-10-15",
        details: "นักเรียนร้องไห้ในคาบเรียน ข้อมูลสมมติ",
      };

      // Validation, then the report itself.
      assert.equal(
        (
          await call(subject, "/behavior-reports", "POST", {
            ...report,
            observed_on: "2999-01-01",
          })
        ).status,
        422,
      );
      const created = await call(subject, "/behavior-reports", "POST", report);
      assert.equal(created.status, 201, created.body.message);
      const id = created.body.id;
      const [[stored]] = await q(
        "SELECT payload_encrypted FROM school_behavior_reports WHERE id=?",
        [id],
      );
      assert.doesNotMatch(stored.payload_encrypted, /ร้องไห้/);
      const [notices] = await q(
        "SELECT recipient_user_id FROM school_notifications WHERE source_type='behavior_report' AND source_id=?",
        [id],
      );
      const told = notices.map((n) => n.recipient_user_id);
      assert.ok(told.includes(homeroom) && told.includes(counselor));
      assert.ok(!told.includes(subject) && !told.includes(outsider));

      // An outsider cannot report on or see this student.
      assert.equal(
        (await call(outsider, "/behavior-reports", "POST", report)).status,
        404,
      );
      assert.equal(
        (await call(outsider, "/behavior-reports")).body.pagination.total,
        0,
      );
      assert.equal(
        (await call(outsider, `/behavior-reports/${id}`)).status,
        404,
      );

      // The responsible staff follow up; notes stay with them.
      const list = await call(homeroom, "/behavior-reports?status=open");
      const item = list.body.data.find((r) => r.id === id);
      assert.equal(item.access, "full");
      assert.equal(item.details, report.details);
      assert.equal(
        (
          await call(homeroom, `/behavior-reports/${id}/status`, "PUT", {
            status: "following",
            note: "คุยกับนักเรียนแล้ว นัดติดตามสัปดาห์หน้า",
          })
        ).status,
        200,
      );
      const full = await call(homeroom, `/behavior-reports/${id}`);
      assert.equal(
        full.body.history.at(-1).note,
        "คุยกับนักเรียนแล้ว นัดติดตามสัปดาห์หน้า",
      );
      assert.ok(full.body.assignees.some((u) => u.id === counselor));
      const own = await call(subject, `/behavior-reports/${id}`);
      assert.equal(own.body.access, "own");
      assert.equal(own.body.status, "following");
      assert.ok(own.body.history.every((h) => h.note === ""));
      assert.equal(
        (
          await call(subject, `/behavior-reports/${id}/status`, "PUT", {
            status: "closed",
          })
        ).status,
        403,
      );

      // Assignment only to the people responsible for this student.
      assert.equal(
        (
          await call(homeroom, `/behavior-reports/${id}/assign`, "PUT", {
            assigned_to: outsider,
          })
        ).status,
        422,
      );
      assert.equal(
        (
          await call(homeroom, `/behavior-reports/${id}/assign`, "PUT", {
            assigned_to: counselor,
          })
        ).status,
        200,
      );
      const [[assigned]] = await q(
        "SELECT COUNT(*) AS n FROM school_notifications WHERE recipient_user_id=? AND source_id=? AND dedupe_key LIKE 'behavior:%:assign:%'",
        [counselor, id],
      );
      assert.equal(Number(assigned.n), 1);

      // Export needs student_behavior.export and holds only visible reports.
      assert.equal(
        (await call(homeroom, "/behavior-reports?format=csv")).status,
        403,
      );
      responsibleKeys.push("student_behavior.export");
      actor = homeroom;
      const csv = await fetch(
        `http://127.0.0.1:${server.address().port}/school/behavior-reports?format=csv`,
      );
      assert.equal(csv.status, 200);
      assert.match(await csv.text(), new RegExp(`beh_${tag}`));
      responsibleKeys.pop();

      // Cancelling ends further work on the report.
      assert.equal(
        (await call(counselor, `/behavior-reports/${id}`, "DELETE")).status,
        200,
      );
      assert.equal(
        (
          await call(counselor, `/behavior-reports/${id}/status`, "PUT", {
            status: "following",
          })
        ).status,
        409,
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
