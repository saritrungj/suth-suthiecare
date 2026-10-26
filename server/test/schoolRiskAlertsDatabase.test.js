const test = require("node:test");
const assert = require("node:assert/strict");

// Who hears about an at-risk assessment, against local MySQL (rolled back):
// the room's homeroom teacher and the counselor of the student's grade, not a
// counselor of another grade or a subject teacher, and only at the levels the
// school turned on.
test(
  "local MySQL sends risk alerts to the student's homeroom and grade counselors",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 30000 },
  async () => {
    require("../config/env");
    assert.ok(
      ["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST),
      "Integration fixture is restricted to local MySQL",
    );
    const pool = require("../config/db"),
      connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const q = connection.query.bind(connection);
      const [[school]] = await q(
        "SELECT s.id,s.organization_id FROM schools s JOIN organizations o ON o.id=s.organization_id WHERE o.org_type='school' LIMIT 1",
      );
      assert.ok(school, "Requires a local school fixture");
      const [[account]] = await q(
        "SELECT pa.id FROM patient_accounts pa WHERE NOT EXISTS (SELECT 1 FROM school_students ss WHERE ss.patient_account_id=pa.id) ORDER BY RAND() LIMIT 1",
      );
      assert.ok(account, "Requires a patient account not linked to a student");
      const [[role]] = await q("SELECT id FROM roles ORDER BY id LIMIT 1");
      const tag = require("crypto").randomBytes(4).toString("hex");
      const grade = async (name) =>
        (
          await q(
            "INSERT INTO school_grade_levels (school_id,name) VALUES (?,?)",
            [school.id, `${name}-${tag}`],
          )
        )[0].insertId;
      const g1 = await grade("ม.1"),
        g4 = await grade("ม.4");
      const [room] = await q(
        "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year) VALUES (?,?,?,2569)",
        [school.id, g1, `1-${tag}`],
      );
      const staff = async (name, duty, seat, gradeScoped = 0) => {
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
            [room.insertId, t.insertId, seat],
          );
        }
        return u.insertId;
      };
      const homeroom = await staff("hr", "homeroom", "homeroom"),
        subject = await staff("subj", "subject_teacher", "subject"),
        counselorM1 = await staff("cs1", "counselor", null, 1),
        counselorM4 = await staff("cs4", "counselor", null, 1);
      await q(
        "INSERT INTO school_staff_role_grades (school_id,user_id,grade_level_id) VALUES (?,?,?),(?,?,?)",
        [school.id, counselorM1, g1, school.id, counselorM4, g4],
      );
      const [st] = await q(
        "INSERT INTO school_students (school_id,classroom_id,student_code,status,patient_account_id) VALUES (?,?,?,'active',?)",
        [school.id, room.insertId, `risk_${tag}`, account.id],
      );

      const { alertForResponse } = require("../services/schoolRiskAlerts");
      const submit = (responseId, summary) =>
        alertForResponse(connection, {
          organizationId: school.organization_id,
          responseId,
          healthDomain: "mental",
          summary,
          personId: null,
          patientAccountId: account.id,
        });
      const recipients = async (responseId) =>
        (
          await q(
            "SELECT recipient_user_id FROM school_notifications WHERE source_type='form_response' AND source_id=? AND student_id=?",
            [responseId, st.insertId],
          )
        )[0].map((r) => r.recipient_user_id);
      const high = {
        score_results: [{ label: "เสี่ยงสูง", color: "#d93025" }],
      };
      const medium = {
        score_results: [{ label: "เฝ้าระวัง", color: "#fbbc04" }],
      };

      // The school's settings decide; start from the default (high only).
      await q(
        "INSERT INTO school_workflow_settings (school_id,notification_json) VALUES (?,NULL) ON DUPLICATE KEY UPDATE notification_json=NULL",
        [school.id],
      );
      const responseHigh = 900000001,
        responseMedium = 900000002;
      assert.ok((await submit(responseHigh, high)) >= 2);
      const told = await recipients(responseHigh);
      assert.ok(told.includes(homeroom) && told.includes(counselorM1));
      assert.ok(!told.includes(counselorM4) && !told.includes(subject));
      assert.equal(
        await submit(responseHigh, high),
        0,
        "a retried submission does not alert twice",
      );
      assert.equal(
        await submit(responseMedium, medium),
        0,
        "medium is off by default",
      );

      await q(
        "UPDATE school_workflow_settings SET notification_json=? WHERE school_id=?",
        [
          JSON.stringify({
            risk_alerts: {
              enabled: true,
              levels: ["high", "medium"],
              mental_admins: false,
            },
          }),
          school.id,
        ],
      );
      assert.ok((await submit(responseMedium, medium)) >= 2);
      const [[notice]] = await q(
        "SELECT payload_encrypted FROM school_notifications WHERE source_id=? AND recipient_user_id=?",
        [responseMedium, homeroom],
      );
      const { readPayload } = require("../services/schoolNotify");
      const payload = readPayload(
        notice.payload_encrypted,
        school.organization_id,
      );
      assert.match(payload.body, new RegExp(`risk_${tag}`));
      assert.match(payload.body, /เฝ้าระวัง/);
      assert.doesNotMatch(JSON.stringify(payload), /score|คะแนน/);

      await q(
        "UPDATE school_workflow_settings SET notification_json=? WHERE school_id=?",
        [
          JSON.stringify({
            risk_alerts: {
              enabled: false,
              levels: ["high"],
              mental_admins: false,
            },
          }),
          school.id,
        ],
      );
      assert.equal(
        await submit(900000003, high),
        0,
        "alerts can be turned off",
      );
    } finally {
      await connection.rollback();
      connection.release();
      await pool.end?.();
    }
  },
);
