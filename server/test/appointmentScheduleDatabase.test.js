const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Runs against a local MySQL only (SCHOOL_DB_TESTS=1) and rolls everything
// back: the school's shared schedule makes slots for every counselor, never
// twice, keeps a counselor's closed day closed, and replaces unbooked slots
// when the schedule changes.
test(
  "the shared counseling schedule makes slots for every counselor",
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
      "../routes/schoolAppointmentRoutes",
      "../services/schoolAppointmentSchedule",
      "../utils/pdpaAudit",
    ])
      delete require.cache[require.resolve(m)];
    let server;
    try {
      await connection.beginTransaction();
      const [[school]] = await connection.query(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      const [users] = await connection.query(
        "SELECT u.id FROM users u JOIN organization_memberships om ON om.user_id=u.id AND om.organization_id=? AND om.status='active' WHERE u.status='active' LIMIT 2",
        [school.organization_id],
      );
      assert.ok(users.length === 2, "Requires two active members");
      // Two counselors of the school for the test.
      for (const u of users)
        await connection.query(
          `INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,'counselor','active',?)
           ON DUPLICATE KEY UPDATE role_code='counselor',status='active'`,
          [school.id, u.id, u.id],
        );
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        req.user = { id: users[0].id };
        req.organizationContext = school.organization_id;
        req.schoolAccess = {
          isSystemAdmin: true,
          appointments: {},
          mentalAdminSchoolIds: [],
        };
        next();
      });
      app.use("/school", require("../routes/schoolAppointmentRoutes"));
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const call = (path, method = "GET", body) =>
        fetch(`http://127.0.0.1:${server.address().port}/school${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
      const made = (extra = "") =>
        connection
          .query(
            `SELECT id,staff_user_id,status,DATE_FORMAT(starts_at,'%Y-%m-%dT%H:%i') AS starts_at,
                    DATE_FORMAT(ends_at,'%H:%i') AS ends_at,DAYOFWEEK(starts_at) AS dow
               FROM school_appointment_slots WHERE schedule_school_id=? AND starts_at>NOW()${extra} ORDER BY starts_at,staff_user_id`,
            [school.id],
          )
          .then(([rows]) => rows);

      const defaults = await (
        await call(`/appointment-schedule?school_id=${school.id}`)
      ).json();
      assert.equal(defaults.schedule.exists, false);
      assert.equal(defaults.schedule.start_time, "16:20");
      const save = (body) =>
        call("/appointment-schedule", "PUT", {
          school_id: school.id,
          weekdays: [1, 2, 3, 4, 5],
          start_time: "16:20",
          end_time: "17:00",
          slot_minutes: 40,
          capacity: 1,
          status: "active",
          ...body,
        });
      const first = await save({});
      assert.equal(first.status, 200, await first.clone().text());
      let slots = await made(" AND status='open'");
      assert.ok(slots.length > 0);
      // Weekdays only (MySQL DAYOFWEEK: 1 Sunday, 7 Saturday), 16:20-17:00.
      assert.ok(slots.every((s) => s.dow >= 2 && s.dow <= 6));
      assert.ok(
        slots.every(
          (s) => s.starts_at.endsWith("16:20") && s.ends_at === "17:00",
        ),
      );
      const counselorIds = new Set(slots.map((s) => s.staff_user_id));
      for (const u of users) assert.ok(counselorIds.has(u.id));

      // Making again never duplicates.
      const schedules = require("../services/schoolAppointmentSchedule");
      await schedules.materialize(shared, school.id, { force: true });
      assert.equal((await made(" AND status='open'")).length, slots.length);

      // A counselor closes one day; it is not made again.
      const closed = slots[0];
      await connection.query(
        "UPDATE school_appointment_slots SET status='closed' WHERE id=?",
        [closed.id],
      );
      await schedules.materialize(shared, school.id, { force: true });
      const reopened = (await made(" AND status='open'")).filter(
        (s) =>
          s.staff_user_id === closed.staff_user_id &&
          s.starts_at === closed.starts_at,
      );
      assert.equal(reopened.length, 0);

      // Changing to 20-minute slots replaces the unbooked ones.
      assert.equal((await save({ slot_minutes: 20 })).status, 200);
      slots = await made(" AND status='open'");
      assert.ok(slots.some((s) => s.starts_at.endsWith("16:40")));
      assert.ok(
        slots.every(
          (s) => !s.ends_at.endsWith("17:00") || s.starts_at.endsWith("16:40"),
        ),
      );

      // Switching the schedule off withdraws the unbooked future slots.
      assert.equal((await save({ status: "inactive" })).status, 200);
      assert.equal((await made(" AND status='open'")).length, 0);
    } finally {
      if (server) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);
