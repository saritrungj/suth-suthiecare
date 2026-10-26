const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Physical risk end to end against local MySQL (rolled back): an approved rule,
// a physical record that meets it, one follow-up item (not two), the homeroom
// teacher told, another room's teacher kept out, and the follow-up closed.
test(
  "local MySQL opens physical follow-ups from approved rules only",
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
      const [[admin]] = await q(
        "SELECT id FROM users WHERE role_id=1 AND status='active' LIMIT 1",
      );
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = require("crypto").randomBytes(4).toString("hex");
      const [g] = await q(
        "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
        [school.id, `ม.2-${tag}`],
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
      const homeroomOf = async (name, roomId) => {
        const [u] = await q(
          "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
          [`${name}_${tag}`],
        );
        await q(
          "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
          [school.organization_id, u.insertId, role.id],
        );
        await q(
          "INSERT INTO school_staff_roles (school_id,user_id,role_code,status) VALUES (?,?,'homeroom','active')",
          [school.id, u.insertId],
        );
        const [t] = await q(
          "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
          [school.id, u.insertId],
        );
        await q(
          "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,'homeroom')",
          [roomId, t.insertId],
        );
        return u.insertId;
      };
      const homeroomA = await homeroomOf("hra", roomA),
        homeroomB = await homeroomOf("hrb", roomB);
      const [st] = await q(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status,gender) VALUES (?,?,?,'active','female')",
        [school.id, roomA, `phy_${tag}`],
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
      for (const p of [
        "../routes/schoolRoutes",
        "../routes/schoolPhysicalRiskRoutes",
        "../authorization/authorization",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const { loadSchoolAccess } = require("../utils/schoolAccess");
      const { expandManage } = require("../authorization/permissionMatrix");
      const teacherKeys = [
        "students.view",
        "clinical.view",
        "student_health.view",
        "student_health.update",
      ];
      let actor = admin.id;
      const app = express();
      app.use(express.json());
      app.use(async (req, res, next) => {
        const system = actor === admin.id;
        req.user = { id: actor, role_id: system ? 1 : 3 };
        req.organizationContext = school.organization_id;
        req.authorization = {
          isSystemAdmin: system,
          permissions: new Set(system ? [] : expandManage(teacherKeys)),
        };
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolRoutes"));
      app.use("/school", require("../routes/schoolPhysicalRiskRoutes"));
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
      const rule = {
        school_id: school.id,
        metric: "bmi",
        comparator: "gt",
        threshold_high: 25,
        label: `BMI สูงกว่าเกณฑ์ทดสอบ ${tag}`,
        follow_up_days: 30,
      };
      assert.equal(
        (await call(admin.id, "/physical-risk-rules", "POST", rule)).status,
        422,
        "a rule must be confirmed as approved",
      );
      const created = await call(admin.id, "/physical-risk-rules", "POST", {
        ...rule,
        approved: true,
      });
      assert.equal(created.status, 201, created.body.message);
      // A homeroom teacher has no workflow rights: cannot read the rules.
      assert.equal(
        (await call(homeroomA, `/physical-risk-rules?school_id=${school.id}`))
          .status,
        403,
      );

      const record = {
        measured_at: "2026-10-10",
        weight_kg: 70,
        height_cm: 160,
      };
      const saved = await call(
        admin.id,
        `/students/${studentId}/physical-records`,
        "POST",
        record,
      );
      assert.equal(saved.status, 201, saved.body.message);
      // A second high reading while the item is open does not add another.
      assert.equal(
        (
          await call(
            admin.id,
            `/students/${studentId}/physical-records`,
            "POST",
            { ...record, measured_at: "2026-10-12" },
          )
        ).status,
        201,
      );
      const [items] = await q(
        "SELECT id,due_on,payload_encrypted FROM school_follow_up_items WHERE student_id=?",
        [studentId],
      );
      assert.equal(items.length, 1);
      assert.equal(
        new Date(items[0].due_on).toLocaleDateString("sv-SE"),
        "2026-11-09",
      );
      assert.doesNotMatch(items[0].payload_encrypted, /BMI/);
      const [told] = await q(
        "SELECT recipient_user_id FROM school_notifications WHERE student_id=? AND kind='follow_up'",
        [studentId],
      );
      assert.ok(told.some((n) => n.recipient_user_id === homeroomA));
      assert.ok(!told.some((n) => n.recipient_user_id === homeroomB));

      // Scope: the student's homeroom teacher sees and closes it, room B does not.
      const listA = await call(homeroomA, "/follow-ups?status=active");
      const item = listA.body.data.find((i) => i.id === items[0].id);
      assert.ok(item, "homeroom teacher sees the follow-up");
      assert.equal(item.rule_label, rule.label);
      assert.equal(Number(item.value), 27.3);
      assert.equal(
        (await call(homeroomB, "/follow-ups")).body.data.some(
          (i) => i.id === item.id,
        ),
        false,
      );
      assert.equal(
        (await call(homeroomB, `/follow-ups/${item.id}`)).status,
        404,
      );
      assert.equal(
        (
          await call(homeroomA, `/follow-ups/${item.id}`, "PUT", {
            status: "done",
            assigned_to: homeroomB,
          })
        ).status,
        422,
      );
      const closed = await call(homeroomA, `/follow-ups/${item.id}`, "PUT", {
        status: "done",
        result: "ส่งพบพยาบาลโรงเรียนแล้ว ข้อมูลสมมติ",
        assigned_to: homeroomA,
      });
      assert.equal(closed.status, 200, closed.body.message);
      const detail = await call(homeroomA, `/follow-ups/${item.id}`);
      assert.equal(detail.body.status, "done");
      assert.equal(detail.body.result, "ส่งพบพยาบาลโรงเรียนแล้ว ข้อมูลสมมติ");
      assert.ok(detail.body.closed_at);

      // After closing, a new high reading opens a fresh item.
      await call(admin.id, `/students/${studentId}/physical-records`, "POST", {
        ...record,
        measured_at: "2026-10-15",
      });
      const [[count]] = await q(
        "SELECT COUNT(*) AS n FROM school_follow_up_items WHERE student_id=?",
        [studentId],
      );
      assert.equal(Number(count.n), 2);
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      delete require.cache[require.resolve("../config/db")];
      await pool.end?.();
    }
  },
);
