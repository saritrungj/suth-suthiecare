const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Grade-scoped counselors, notification recipients and the notification inbox
// against local MySQL. Everything runs inside one transaction that is rolled back.
test(
  "local MySQL keeps grade-scoped counselors and notifications inside their students",
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
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = require("crypto").randomBytes(4).toString("hex");
      const grade = async (name) =>
        (
          await q(
            "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
            [school.id, `${name}-${tag}`],
          )
        )[0].insertId;
      const room = async (gradeId, name) =>
        (
          await q(
            "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
            [school.id, gradeId, `${name}-${tag}`],
          )
        )[0].insertId;
      const g1 = await grade("m1"),
        g4 = await grade("m4");
      const c1 = await room(g1, "1/1"),
        c4 = await room(g4, "4/1");
      const user = async (name, member = true) => {
        const [r] = await q(
          "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
          [`${name}_${tag}`],
        );
        if (member)
          await q(
            "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
            [school.organization_id, r.insertId, role.id],
          );
        return r.insertId;
      };
      const duty = (userId, code, gradeScoped = 0) =>
        q(
          "INSERT INTO school_staff_roles (school_id,user_id,role_code,status,grade_scoped) VALUES (?,?,?,'active',?)",
          [school.id, userId, code, gradeScoped],
        );
      const homeroom = await user("hr"),
        counselorAll = await user("csall"),
        counselorM1 = await user("csm1"),
        counselorNone = await user("csnone"),
        mentalAdmin = await user("madmin"),
        outsider = await user("out", false);
      await duty(homeroom, "homeroom");
      const [teacher] = await q(
        "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
        [school.id, homeroom],
      );
      await q(
        "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,'homeroom')",
        [c1, teacher.insertId],
      );
      await duty(counselorAll, "counselor");
      await duty(counselorM1, "counselor", 1);
      await q(
        "INSERT INTO school_staff_role_grades (school_id,user_id,grade_level_id) VALUES (?,?,?)",
        [school.id, counselorM1, g1],
      );
      await duty(counselorNone, "counselor", 1);
      await duty(mentalAdmin, "mental_admin");
      const student = async (classroomId) =>
        (
          await q(
            "INSERT INTO school_students (school_id,classroom_id,student_code,status) VALUES (?,?,?,'active')",
            [school.id, classroomId, `care_${tag}_${classroomId}`],
          )
        )[0].insertId;
      const s1 = await student(c1),
        s4 = await student(c4);

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
        "../routes/schoolNotificationRoutes",
        "../routes/schoolWorkflowRoutes",
        "../routes/schoolTeacherImportRoutes",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const {
        notify,
        recipientsForStudent,
        readPayload,
      } = require("../services/schoolNotify");
      const {
        loadSchoolAccess,
        canSeeStudent,
        studentScopeClause,
      } = require("../utils/schoolAccess");
      const { expandManage } = require("../authorization/permissionMatrix");
      const requestFor = (userId) => ({
        user: { id: userId },
        organizationContext: school.organization_id,
        authorization: {
          isSystemAdmin: false,
          permissions: new Set(
            expandManage([
              "students.view",
              "clinical.view",
              "student_health.view",
            ]),
          ),
        },
      });

      // Recipients follow the student's room and grade (the fixture school may
      // already have real staff, so only this test's users are checked).
      const all = { homeroom: true, counselors: true, mentalAdmins: true };
      const forS1 = await recipientsForStudent(connection, s1, all);
      for (const id of [homeroom, counselorAll, counselorM1, mentalAdmin])
        assert.ok(forS1.includes(id), `recipient ${id} for the ม.1 student`);
      assert.ok(!forS1.includes(counselorNone) && !forS1.includes(outsider));
      const forS4 = await recipientsForStudent(connection, s4, {
        counselors: true,
      });
      assert.ok(forS4.includes(counselorAll));
      assert.ok(!forS4.includes(counselorM1) && !forS4.includes(counselorNone));
      assert.ok(!forS4.includes(homeroom) && !forS4.includes(mentalAdmin));

      // Scope: ม.1 counselor sees the ม.1 student only, an empty scope sees none.
      const m1Access = await loadSchoolAccess(db, requestFor(counselorM1));
      const seen = async (access) => {
        const scope = studentScopeClause(access);
        const [rows] = await q(
          `SELECT ss.id FROM school_students ss WHERE ss.id IN (?)${scope.sql}`,
          [[s1, s4], ...scope.params],
        );
        return rows.map((r) => r.id);
      };
      assert.deepEqual(await seen(m1Access), [s1]);
      assert.equal(
        canSeeStudent(m1Access, {
          id: s4,
          school_id: school.id,
          classroom_id: c4,
        }),
        false,
      );
      assert.deepEqual(
        await seen(await loadSchoolAccess(db, requestFor(counselorNone))),
        [],
      );
      const allSeen = await seen(
        await loadSchoolAccess(db, requestFor(counselorAll)),
      );
      assert.ok(allSeen.includes(s1) && allSeen.includes(s4));

      // Rescreen assignees respect the counselor's grades.
      const { rescreenAssignees } = require("../routes/schoolWorkflowRoutes");
      const assigneeIds = async (studentId, classroomId) =>
        (
          await rescreenAssignees(connection, requestFor(1), {
            school_id: school.id,
            classroom_id: classroomId,
            id: studentId,
          })
        ).map((r) => r.id);
      assert.ok((await assigneeIds(s1, c1)).includes(counselorM1));
      assert.ok(!(await assigneeIds(s4, c4)).includes(counselorM1));
      assert.ok(!(await assigneeIds(s4, c4)).includes(counselorNone));
      assert.ok((await assigneeIds(s4, c4)).includes(counselorAll));

      // Notifications: encrypted, deduplicated, scoped on read.
      const send = (studentId, key) =>
        notify(connection, {
          organizationId: school.organization_id,
          schoolId: school.id,
          kind: "risk_alert",
          studentId,
          recipients: [counselorM1, counselorM1],
          payload: { title: `ทดสอบ ${key}` },
          dedupeKey: key,
        });
      assert.equal(await send(s1, `t-${tag}-1`), 1);
      assert.equal(await send(s1, `t-${tag}-1`), 0, "same key notifies once");
      assert.equal(await send(s4, `t-${tag}-4`), 1);
      const [[stored]] = await q(
        "SELECT id,payload_encrypted FROM school_notifications WHERE dedupe_key=?",
        [`t-${tag}-1`],
      );
      assert.doesNotMatch(stored.payload_encrypted, /ทดสอบ/);
      assert.deepEqual(
        readPayload(stored.payload_encrypted, school.organization_id),
        { title: `ทดสอบ t-${tag}-1` },
      );
      const [[hidden]] = await q(
        "SELECT id FROM school_notifications WHERE dedupe_key=?",
        [`t-${tag}-4`],
      );

      let actor = counselorM1;
      const app = express();
      app.use(express.json());
      app.use(async (req, res, next) => {
        Object.assign(req, requestFor(actor));
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolNotificationRoutes"));
      app.use((e, req, res, next) =>
        res.status(e.status || 500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const call = async (path, method = "GET") => {
        const r = await fetch(
          `http://127.0.0.1:${server.address().port}/school${path}`,
          { method },
        );
        return { status: r.status, body: await r.json() };
      };
      const list = await call("/notifications");
      assert.equal(list.status, 200);
      assert.deepEqual(
        list.body.items.map((n) => n.id),
        [stored.id],
        "the ม.4 notification is hidden from the ม.1 counselor",
      );
      assert.equal(list.body.items[0].payload.title, `ทดสอบ t-${tag}-1`);
      assert.equal((await call("/notifications/unread-count")).body.count, 1);
      assert.equal(
        (await call(`/notifications/${hidden.id}/ack`, "PUT")).status,
        404,
      );
      const acked = await call(`/notifications/${stored.id}/ack`, "PUT");
      assert.equal(acked.status, 200);
      assert.ok(acked.body.acknowledged_at && acked.body.read_at);
      assert.equal((await call("/notifications/unread-count")).body.count, 0);
      actor = outsider;
      assert.equal(
        (await call(`/notifications/${stored.id}/read`, "PUT")).status,
        404,
        "another user cannot touch someone else's notification",
      );
      assert.equal((await call("/notifications")).body.total, 0);
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      delete require.cache[require.resolve("../config/db")];
      await pool.end?.();
    }
  },
);
