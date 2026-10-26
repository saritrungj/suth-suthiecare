const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const crypto = require("crypto");

// The whole path against local MySQL (rolled back): a signed-in student
// submits a school mental-health form with a high-risk result through the real
// submit route, and their homeroom teacher gets an in-app alert.
test(
  "local MySQL alerts the homeroom teacher when a student submits a high-risk assessment",
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
        `SELECT f.id,f.organization_id FROM forms f JOIN organizations o ON o.id=f.organization_id
          WHERE o.org_type='school' AND f.health_domain='mental' AND f.status='published'
            AND (f.publish_end_date IS NULL OR f.publish_end_date>=NOW()) LIMIT 1`,
      );
      assert.ok(form, "Requires a published school mental-health form");
      const [[school]] = await q(
        "SELECT id FROM schools WHERE organization_id=? LIMIT 1",
        [form.organization_id],
      );
      const [[account]] = await q(
        `SELECT pa.id,pa.token_version FROM patient_accounts pa
          WHERE pa.status='active' AND COALESCE(pa.must_change_password,0)=0
            AND NOT EXISTS (SELECT 1 FROM school_students ss WHERE ss.patient_account_id=pa.id) ORDER BY RAND() LIMIT 1`,
      );
      assert.ok(
        account,
        "Requires an active patient account not linked to a student",
      );
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = crypto.randomBytes(4).toString("hex");
      const [g] = await q(
        "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
        [school.id, `ม.3-${tag}`],
      );
      const [room] = await q(
        "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
        [school.id, g.insertId, `3-${tag}`],
      );
      const [teacherUser] = await q(
        "INSERT INTO users (username,password,status) VALUES (?,'x','active')",
        [`hr_${tag}`],
      );
      await q(
        "INSERT INTO organization_memberships (organization_id,user_id,role_id,status) VALUES (?,?,?,'active')",
        [form.organization_id, teacherUser.insertId, role.id],
      );
      await q(
        "INSERT INTO school_staff_roles (school_id,user_id,role_code,status) VALUES (?,?,'homeroom','active')",
        [school.id, teacherUser.insertId],
      );
      const [teacher] = await q(
        "INSERT INTO school_teachers (school_id,user_id,status) VALUES (?,?,'active')",
        [school.id, teacherUser.insertId],
      );
      await q(
        "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,'homeroom')",
        [room.insertId, teacher.insertId],
      );
      const [student] = await q(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status,patient_account_id) VALUES (?,?,?,'active',?)",
        [school.id, room.insertId, `sub_${tag}`, account.id],
      );
      await q(
        "INSERT INTO school_workflow_settings (school_id,notification_json) VALUES (?,NULL) ON DUPLICATE KEY UPDATE notification_json=NULL",
        [school.id],
      );
      // A patient session exactly as sign-in creates it.
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
      require.cache[
        require.resolve("../services/organizationNotificationService")
      ] = {
        exports: { notifySubmission: async () => {} },
      };
      for (const p of [
        "../routes/formRoutes",
        "../middleware/patientAuthMiddleware",
        "../utils/patientAuth",
        "../services/sessionService",
        "../services/schoolRiskAlerts",
        "../services/schoolNotify",
        "../utils/pdpaAudit",
      ])
        delete require.cache[require.resolve(p)];
      const cookieParser = require("cookie-parser");
      const app = express();
      app.use(cookieParser());
      app.use(express.json());
      app.use("/api", require("../routes/formRoutes"));
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      const response = await fetch(
        `http://127.0.0.1:${server.address().port}/api/forms/${form.id}/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `suth_patient_session=${token}`,
            "X-CSRF-Token": csrf(token),
            // Writes on a session must come from an allowed web origin.
            Origin: (
              process.env.CORS_ORIGINS ||
              process.env.FRONTEND_URL ||
              "http://localhost:3001"
            )
              .split(",")[0]
              .trim(),
          },
          body: JSON.stringify({
            processing_consent: true,
            notice_version: "standard-v1",
            answers: {},
            questionTitles: {},
            identityValue: "-",
            summaryData: {
              score_results: [
                { label: "เสี่ยงสูง", color: "#d93025", score: 20 },
              ],
            },
          }),
        },
      );
      const body = await response.json();
      assert.equal(response.status, 201, body.message || body.code);
      const [alerts] = await q(
        "SELECT recipient_user_id,kind FROM school_notifications WHERE student_id=? AND source_type='form_response' AND source_id=?",
        [student.insertId, body.responseId],
      );
      assert.deepEqual(
        alerts
          .filter((a) => a.recipient_user_id === teacherUser.insertId)
          .map((a) => a.kind),
        ["risk_alert"],
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
