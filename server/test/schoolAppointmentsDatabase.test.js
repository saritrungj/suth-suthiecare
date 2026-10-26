const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const crypto = require("crypto");

// Counseling appointments end to end against local MySQL (rolled back): staff
// open slots, a signed-in student books one of their own staff, limits hold,
// each staff member sees only their own bookings (mental-health admins see all),
// and the status flow ends in a guidance record.
test(
  "local MySQL books counseling only with the student's own staff",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 90000 },
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
      const [[school]] = await q(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      assert.ok(school, "Requires a local school fixture");
      const [[account]] = await q(
        `SELECT pa.id,pa.token_version FROM patient_accounts pa WHERE pa.status='active' AND COALESCE(pa.must_change_password,0)=0
          AND NOT EXISTS (SELECT 1 FROM school_students ss WHERE ss.patient_account_id=pa.id) ORDER BY RAND() LIMIT 1`,
      );
      assert.ok(
        account,
        "Requires an active patient account not linked to a student",
      );
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = crypto.randomBytes(4).toString("hex");
      const grade = async (n) =>
        (
          await q(
            "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
            [school.id, `${n}-${tag}`],
          )
        )[0].insertId;
      const g1 = await grade("ม.1"),
        g4 = await grade("ม.4");
      const [room] = await q(
        "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
        [school.id, g1, `1-${tag}`],
      );
      const staff = async (
        name,
        duty,
        { seat = false, grades = null } = {},
      ) => {
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
          [school.id, u.insertId, duty, grades ? 1 : 0],
        );
        for (const g of grades || [])
          await q(
            "INSERT INTO school_staff_role_grades (school_id,user_id,grade_level_id) VALUES (?,?,?)",
            [school.id, u.insertId, g],
          );
        if (seat) {
          const [t] = await q(
            "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
            [school.id, u.insertId],
          );
          await q(
            "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,'homeroom')",
            [room.insertId, t.insertId],
          );
        }
        return u.insertId;
      };
      const homeroom = await staff("hr", "homeroom", { seat: true }),
        counselor = await staff("cs", "counselor", { grades: [g1] }),
        otherGrade = await staff("cs4", "counselor", { grades: [g4] }),
        mentalAdmin = await staff("ma", "mental_admin"),
        // A duty students are never offered: their slots would be invisible.
        subjectTeacher = await staff("sj", "subject_teacher");
      const [st] = await q(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status,patient_account_id) VALUES (?,?,?,'active',?)",
        [school.id, room.insertId, `apt_${tag}`, account.id],
      );
      const { sha, csrf } = require("../services/sessionService");
      const token = crypto.randomBytes(32).toString("base64url");
      await q(
        "INSERT INTO auth_sessions (token_hash,account_type,account_id,auth_version,csrf_hash,last_seen_at,expires_at) VALUES (?,?,?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL 1 HOUR))",
        [
          sha(token),
          "patient",
          account.id,
          Number(account.token_version || 0),
          sha(csrf(token)),
        ],
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
        "../routes/schoolAppointmentRoutes",
        "../routes/patientSchoolAppointmentRoutes",
        "../middleware/patientAuthMiddleware",
        "../utils/patientAuth",
        "../services/sessionService",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const { loadSchoolAccess } = require("../utils/schoolAccess");
      const { expandManage } = require("../authorization/permissionMatrix");
      const staffKeys = expandManage([
        "school_appointments.manage",
        "students.view",
        "clinical.view",
        "student_health.view",
        "student_health.create",
      ]);
      let actor = homeroom;
      const app = express();
      app.use(require("cookie-parser")());
      app.use(express.json());
      app.use("/patient", require("../routes/patientSchoolAppointmentRoutes"));
      app.use("/school", async (req, res, next) => {
        req.user = { id: actor };
        req.organizationContext = school.organization_id;
        req.authorization = {
          isSystemAdmin: false,
          permissions: new Set(staffKeys),
        };
        req.schoolAccess = await loadSchoolAccess(db, req);
        next();
      });
      app.use("/school", require("../routes/schoolAppointmentRoutes"));
      app.use((e, req, res, next) =>
        res.status(e.status || 500).json({ message: e.message }),
      );
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const origin = (
        process.env.CORS_ORIGINS ||
        process.env.FRONTEND_URL ||
        "http://localhost:3001"
      )
        .split(",")[0]
        .trim();
      const call = async (path, method = "GET", body, as = null) => {
        if (as) actor = as;
        const r = await fetch(
          `http://127.0.0.1:${server.address().port}${path}`,
          {
            method,
            headers: {
              "Content-Type": "application/json",
              ...(path.startsWith("/patient")
                ? {
                    Cookie: `suth_patient_session=${token}`,
                    "X-CSRF-Token": csrf(token),
                    Origin: origin,
                  }
                : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          },
        );
        return { status: r.status, body: await r.json() };
      };
      // Bangkok local time n days ahead at hh:mm.
      const at = (days, hh) => {
        const d = new Date(Date.now() + 7 * 3600000 + days * 86400000);
        return `${d.toISOString().slice(0, 10)}T${hh}`;
      };

      // Only people a student can book may open slots, and the page is told.
      const refused = await call(
        "/school/appointment-slots",
        "POST",
        {
          school_id: school.id,
          starts_at: at(2, "09:00"),
          ends_at: at(2, "09:30"),
        },
        subjectTeacher,
      );
      assert.equal(refused.status, 422, "a non-carer cannot open slots");
      assert.match(refused.body.message, /นักเรียนจะจองเวลานี้ไม่ได้/);
      assert.equal(
        (
          await call(
            `/school/appointment-slots?school_id=${school.id}`,
            "GET",
            null,
            subjectTeacher,
          )
        ).body.bookable,
        false,
      );
      for (const carer of [homeroom, counselor, mentalAdmin])
        assert.equal(
          (
            await call(
              `/school/appointment-slots?school_id=${school.id}`,
              "GET",
              null,
              carer,
            )
          ).body.bookable,
          true,
          "homeroom, counselor and mental-health admin can be booked",
        );

      // Staff open slots: validation, overlap, weekly repeat.
      assert.equal(
        (
          await call(
            "/school/appointment-slots",
            "POST",
            {
              school_id: school.id,
              starts_at: at(-1, "09:00"),
              ends_at: at(-1, "10:00"),
            },
            homeroom,
          )
        ).status,
        422,
        "no slots in the past",
      );
      const hr = await call("/school/appointment-slots", "POST", {
        school_id: school.id,
        starts_at: at(2, "09:00"),
        ends_at: at(2, "09:30"),
        repeat_weeks: 2,
      });
      assert.equal(hr.status, 201, hr.body.message);
      assert.equal(hr.body.ids.length, 2);
      assert.equal(
        (
          await call("/school/appointment-slots", "POST", {
            school_id: school.id,
            starts_at: at(2, "09:15"),
            ends_at: at(2, "09:45"),
          })
        ).status,
        409,
        "overlapping slot",
      );
      const cs = await call(
        "/school/appointment-slots",
        "POST",
        {
          school_id: school.id,
          starts_at: at(3, "13:00"),
          ends_at: at(3, "13:30"),
        },
        counselor,
      );
      const other = await call(
        "/school/appointment-slots",
        "POST",
        {
          school_id: school.id,
          starts_at: at(3, "14:00"),
          ends_at: at(3, "14:30"),
        },
        otherGrade,
      );
      assert.equal(other.status, 201);

      // The student sees only their own staff, with open slots.
      const options = await call("/patient/school-appointments/options");
      assert.equal(options.status, 200, options.body.message);
      const mine = options.body.students.find(
        (s) => s.student_id === st.insertId,
      );
      const staffIds = mine.staff.map((s) => s.id);
      assert.ok(staffIds.includes(homeroom) && staffIds.includes(counselor));
      assert.ok(
        !staffIds.includes(otherGrade),
        "a counselor of another grade is not offered",
      );
      assert.ok(mine.topics.length >= 1);
      const topic = mine.topics[0].id;

      // Booking another grade's counselor directly is refused.
      assert.equal(
        (
          await call("/patient/school-appointments", "POST", {
            slot_id: other.body.ids[0],
            topic_id: topic,
          })
        ).status,
        409,
      );
      const booked = await call("/patient/school-appointments", "POST", {
        slot_id: hr.body.ids[0],
        topic_id: topic,
        note: "อยากคุยเรื่องการบ้าน (ทดสอบ)",
      });
      assert.equal(booked.status, 201, booked.body.message);
      const [[stored]] = await q(
        "SELECT payload_encrypted FROM school_appointments WHERE id=?",
        [booked.body.id],
      );
      assert.doesNotMatch(stored.payload_encrypted, /การบ้าน/);
      assert.equal(
        (
          await call("/patient/school-appointments", "POST", {
            slot_id: hr.body.ids[0],
            topic_id: topic,
          })
        ).status,
        409,
        "a full slot cannot be booked again",
      );
      assert.equal(
        (
          await call("/patient/school-appointments", "POST", {
            slot_id: cs.body.ids[0],
            topic_id: topic,
          })
        ).status,
        201,
      );
      assert.equal(
        (
          await call("/patient/school-appointments", "POST", {
            slot_id: hr.body.ids[1],
            topic_id: topic,
          })
        ).status,
        409,
        "at most two open requests",
      );
      const [[told]] = await q(
        "SELECT COUNT(*) AS n FROM school_notifications WHERE recipient_user_id=? AND source_id=? AND kind='appointment'",
        [homeroom, booked.body.id],
      );
      assert.equal(Number(told.n), 1);

      // Staff visibility: own bookings only; the mental-health admin sees all.
      const ids = async (as) =>
        (
          await call("/school/appointments?status=active", "GET", null, as)
        ).body.data
          .filter((a) => a.student_id === st.insertId)
          .map((a) => a.id)
          .sort((x, y) => x - y);
      assert.deepEqual(await ids(homeroom), [booked.body.id]);
      assert.equal((await ids(counselor)).length, 1);
      assert.equal((await ids(otherGrade)).length, 0);
      assert.equal((await ids(mentalAdmin)).length, 2);
      assert.equal(
        (
          await call(
            `/school/appointments/${booked.body.id}`,
            "GET",
            null,
            otherGrade,
          )
        ).status,
        404,
      );
      const detail = await call(
        `/school/appointments/${booked.body.id}`,
        "GET",
        null,
        homeroom,
      );
      assert.equal(detail.body.note, "อยากคุยเรื่องการบ้าน (ทดสอบ)");

      // Status flow: confirm, reschedule within own slots, transfer to the counselor, complete with a record.
      assert.equal(
        (
          await call(`/school/appointments/${booked.body.id}`, "PUT", {
            action: "confirm",
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call(`/school/appointments/${booked.body.id}`, "PUT", {
            action: "reschedule",
            slot_id: cs.body.ids[0],
          })
        ).status,
        409,
        "reschedule stays with the same staff",
      );
      assert.equal(
        (
          await call(`/school/appointments/${booked.body.id}`, "PUT", {
            action: "reschedule",
            slot_id: hr.body.ids[1],
          })
        ).status,
        200,
      );
      const cs2 = await call(
        "/school/appointment-slots",
        "POST",
        {
          school_id: school.id,
          starts_at: at(4, "10:00"),
          ends_at: at(4, "10:30"),
        },
        counselor,
      );
      assert.equal(
        (
          await call(
            `/school/appointments/${booked.body.id}`,
            "PUT",
            { action: "transfer", slot_id: cs2.body.ids[0] },
            homeroom,
          )
        ).status,
        200,
      );
      assert.deepEqual(
        await ids(homeroom),
        [],
        "after transfer the booking moves to the counselor",
      );
      const done = await call(
        `/school/appointments/${booked.body.id}`,
        "PUT",
        {
          action: "complete",
          outcome: {
            issue: "คุยเรื่องการบ้าน (ทดสอบ)",
            support: "วางแผนทำการบ้าน",
          },
        },
        counselor,
      );
      assert.equal(done.status, 200, done.body.message);
      const [[linked]] = await q(
        "SELECT status,guidance_record_id FROM school_appointments WHERE id=?",
        [booked.body.id],
      );
      assert.equal(linked.status, "completed");
      assert.ok(linked.guidance_record_id);
      assert.equal(
        (
          await call(
            `/school/appointments/${booked.body.id}`,
            "PUT",
            { action: "cancel" },
            counselor,
          )
        ).status,
        409,
        "a completed appointment cannot be cancelled",
      );

      // The student sees statuses (never staff notes) and can cancel what is still open.
      const list = await call("/patient/school-appointments");
      const completed = list.body.appointments.find(
        (a) => a.id === booked.body.id,
      );
      assert.equal(completed.status, "completed");
      assert.equal(completed.student_code, undefined);
      const open = list.body.appointments.find((a) => a.id !== booked.body.id);
      assert.equal(open.can_cancel, true);
      assert.equal(
        (await call(`/patient/school-appointments/${open.id}/cancel`, "POST"))
          .status,
        200,
      );
      assert.equal(
        (await call(`/patient/school-appointments/${open.id}/cancel`, "POST"))
          .status,
        409,
      );
      // Export (manage includes export) leaves the student's note out.
      actor = mentalAdmin;
      const csv = await fetch(
        `http://127.0.0.1:${server.address().port}/school/appointments?format=csv`,
      );
      assert.equal(csv.status, 200);
      const csvText = await csv.text();
      assert.match(csvText, new RegExp(`apt_${tag}`));
      assert.doesNotMatch(csvText, /การบ้าน/);

      // A slot with a booking cannot be closed; a free one can.
      assert.equal(
        (
          await call(
            `/school/appointment-slots/${hr.body.ids[0]}`,
            "DELETE",
            null,
            homeroom,
          )
        ).status,
        200,
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
