const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// School overview report against local MySQL (rolled back): risk counts per
// screening round from real (sealed) responses, follow-up counts, the whole
// school for a supervisor without a school duty (with small counts hidden),
// the teacher's own room for a homeroom teacher, and CSV only with export.
test(
  "local MySQL reports counts only, scoped and with small counts hidden",
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
      await connection.query("SET time_zone='+07:00'");
      const q = connection.query.bind(connection);
      const [[form]] = await q(
        "SELECT f.id,f.organization_id FROM forms f JOIN organizations o ON o.id=f.organization_id WHERE o.org_type='school' AND f.health_domain='mental' LIMIT 1",
      );
      assert.ok(form, "Requires a school mental-health form");
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = require("crypto").randomBytes(4).toString("hex");
      // A new school keeps the fixture's own students out of the counts.
      const [newSchool] = await q(
        "INSERT INTO schools (organization_id,code,name,status) VALUES (?,?,?,'active')",
        [
          form.organization_id,
          `RP${tag}`.slice(0, 20),
          `โรงเรียนรายงาน ${tag}`,
        ],
      );
      const schoolId = newSchool.insertId;
      const [g] = await q(
        "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
        [schoolId, `ม.2-${tag}`],
      );
      const room = async (n) =>
        (
          await q(
            "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
            [schoolId, g.insertId, `${n}-${tag}`],
          )
        )[0].insertId;
      const roomA = await room("1"),
        roomB = await room("2");
      const today = new Date().toLocaleDateString("sv-SE", {
        timeZone: "Asia/Bangkok",
      });
      await q(
        "INSERT INTO school_screening_rounds (school_id,name,academic_year,semester,health_domain,form_id,starts_on,ends_on,created_by) VALUES (?,?,2569,2,'mental',?,DATE_SUB(?,INTERVAL 3 DAY),DATE_ADD(?,INTERVAL 3 DAY),1)",
        [schoolId, `รอบทดสอบ ${tag}`, form.id, today, today],
      );
      const { sealJson, fieldContext } = require("../utils/privateData");
      const summary = (label, color) =>
        JSON.stringify(
          sealJson(
            { score_results: [{ label, color }] },
            fieldContext(
              "form_responses",
              "summary_data",
              form.organization_id,
            ),
          ),
        );
      // Room A: 6 high, 1 normal. Room B: 2 medium, 1 not assessed.
      const plan = [
        ...Array(6).fill([roomA, "เสี่ยงสูง", "#d93025"]),
        [roomA, "ปกติ", "#34a853"],
        [roomB, "เฝ้าระวัง", "#fbbc04"],
        [roomB, "เฝ้าระวัง", "#fbbc04"],
        [roomB, null, null],
      ];
      const studentIds = [];
      for (const [i, [roomId, label, color]] of plan.entries()) {
        const [person] = await q("INSERT INTO persons () VALUES ()");
        const [st] = await q(
          "INSERT INTO school_students (school_id,classroom_id,student_code,status,person_id) VALUES (?,?,?,'active',?)",
          [schoolId, roomId, `rp_${tag}_${i}`, person.insertId],
        );
        studentIds.push(st.insertId);
        if (label)
          await q(
            "INSERT INTO form_responses (form_id,person_id,organization_id,summary_data,submitted_at) VALUES (?,?,?,?,NOW())",
            [
              form.id,
              person.insertId,
              form.organization_id,
              summary(label, color),
            ],
          );
      }
      const [reporter] = await q(
        "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
        [`rpu_${tag}`],
      );
      for (const sid of studentIds.slice(0, 2))
        await q(
          "INSERT INTO school_behavior_reports (school_id,student_id,reported_by,category,concern_level,observed_on,status) VALUES (?,?,?,'emotion','high',?,'new')",
          [schoolId, sid, reporter.insertId, today],
        );
      await q(
        "INSERT INTO school_follow_up_items (school_id,student_id,domain,source_type,due_on,status) VALUES (?,?,'physical','physical_rule',DATE_SUB(?,INTERVAL 1 DAY),'open')",
        [schoolId, studentIds[7], today],
      );
      // A homeroom teacher of room B.
      await q(
        "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
        [form.organization_id, reporter.insertId, role.id],
      );
      await q(
        "INSERT INTO school_staff_roles (school_id,user_id,role_code,status) VALUES (?,?,'homeroom','active')",
        [schoolId, reporter.insertId],
      );
      const [t] = await q(
        "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
        [schoolId, reporter.insertId],
      );
      await q(
        "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,'homeroom')",
        [roomB, t.insertId],
      );
      const [supervisor] = await q(
        "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
        [`sup_${tag}`],
      );
      await q(
        "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
        [form.organization_id, supervisor.insertId, role.id],
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
      delete require.cache[require.resolve("../routes/schoolReportRoutes")];
      const { loadSchoolAccess } = require("../utils/schoolAccess");
      const { expandManage } = require("../authorization/permissionMatrix");
      const keys = {
        [supervisor.insertId]: ["dashboard.view"],
        [reporter.insertId]: [
          "dashboard.view",
          "dashboard.export",
          "students.view",
        ],
      };
      let actor = supervisor.insertId;
      const app = express();
      app.use(async (req, res, next) => {
        req.user = { id: actor };
        req.organizationContext = form.organization_id;
        req.authorization = {
          isSystemAdmin: false,
          permissions: new Set(expandManage(keys[actor])),
        };
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolReportRoutes"));
      app.use((e, req, res, next) =>
        res.status(500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const get = async (path, as) => {
        actor = as;
        const r = await fetch(
          `http://127.0.0.1:${server.address().port}/school${path}`,
        );
        const text = await r.text();
        return {
          status: r.status,
          text,
          json: r.headers.get("content-type")?.includes("json")
            ? JSON.parse(text)
            : null,
        };
      };

      // Supervisor: the whole school, small counts hidden, no student rows.
      const sup = await get(
        `/reports/overview?school_id=${schoolId}`,
        supervisor.insertId,
      );
      assert.equal(sup.status, 200, sup.text);
      assert.equal(sup.json.scope, "school");
      assert.equal(sup.json.population, 10);
      assert.equal(sup.json.trend_basis, "rounds");
      const round = sup.json.trend.at(-1);
      assert.equal(round.high, 6);
      assert.equal(round.normal, null, "1 student is below the threshold");
      assert.equal(round.medium, null);
      assert.equal(
        round.assessed,
        null,
        "totals hidden so a hidden count cannot be derived",
      );
      assert.equal(
        sup.json.follow_up.behavior.new,
        null,
        "2 reports is below the threshold",
      );
      assert.doesNotMatch(sup.text, /rp_/, "no student codes");
      assert.equal(
        (
          await get(
            `/reports/overview?school_id=${schoolId}&format=csv`,
            supervisor.insertId,
          )
        ).status,
        403,
      );

      // Homeroom teacher of room B: their room only, exact counts.
      const hr = await get(
        `/reports/overview?school_id=${schoolId}`,
        reporter.insertId,
      );
      assert.equal(hr.json.scope, "mine");
      assert.equal(hr.json.population, 3);
      const mine = hr.json.trend.at(-1);
      assert.deepEqual(
        [mine.high, mine.medium, mine.normal, mine.assessed, mine.not_assessed],
        [0, 2, 0, 2, 1],
      );
      assert.equal(hr.json.follow_up.physical.overdue, 1);
      assert.equal(
        hr.json.follow_up.behavior.new,
        0,
        "room A reports are not in room B's figures",
      );
      const csv = await get(
        `/reports/overview?school_id=${schoolId}&format=csv`,
        reporter.insertId,
      );
      assert.equal(csv.status, 200);
      assert.match(csv.text, /เฝ้าระวัง/);

      keys[supervisor.insertId] = [];
      assert.equal(
        (
          await get(
            `/reports/overview?school_id=${schoolId}`,
            supervisor.insertId,
          )
        ).status,
        403,
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
