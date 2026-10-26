const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { randomUUID } = require("node:crypto");

// Runs against a local MySQL only (SCHOOL_DB_TESTS=1) and rolls everything
// back: contacts, a follow-up task made before any assessment, and a school's
// hospital referral that waits for approval and is sent on approval.
test(
  "student file actions and hospital referral approval persist in MySQL",
  { skip: process.env.SCHOOL_DB_TESTS !== "1", timeout: 60000 },
  async () => {
    require("../config/env");
    assert.ok(["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST));
    const pool = require("../config/db");
    const connection = await pool.getConnection();
    // Routes run on this one connection; their own transactions are no-ops
    // inside the test transaction, which is rolled back at the end.
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
    require.cache[require.resolve("../middleware/authMiddleware")] = {
      exports: { verifyToken: (_req, _res, next) => next() },
    };
    for (const m of [
      "../routes/schoolInsightRoutes",
      "../routes/schoolWorkflowRoutes",
      "../routes/caseReferralRoutes",
      "../routes/referralApprovalRoutes",
      "../services/caseReferralCreate",
      "../services/rescreenTasks",
      "../authorization/authorization",
      "../utils/pdpaAudit",
    ])
      delete require.cache[require.resolve(m)];
    const servers = [];
    try {
      await connection.beginTransaction();
      const [[student]] = await connection.query(
        `SELECT ss.id,ss.school_id,ss.classroom_id,ss.person_id,ss.patient_account_id,s.organization_id
           FROM school_students ss JOIN schools s ON s.id=ss.school_id
           JOIN form_responses fr ON fr.person_id=ss.person_id AND fr.organization_id=s.organization_id
           JOIN forms f ON f.id=fr.form_id AND f.health_domain='mental'
          WHERE ss.archived_at IS NULL LIMIT 1`,
      );
      assert.ok(student, "Requires a local student with a mental assessment");
      const org = student.organization_id;
      const [[response]] = await connection.query(
        "SELECT fr.id,fr.form_id FROM form_responses fr JOIN forms f ON f.id=fr.form_id AND f.health_domain='mental' WHERE fr.person_id=? AND fr.organization_id=? ORDER BY fr.id DESC LIMIT 1",
        [student.person_id, org],
      );
      const [[admin]] = await connection.query(
        "SELECT u.id FROM users u JOIN user_system_roles r ON r.user_id=u.id AND r.system_role_id=1 WHERE u.status='active' LIMIT 1",
      );
      assert.ok(admin, "Requires a local system admin");
      await connection.query(
        "INSERT IGNORE INTO organization_memberships (organization_id,user_id,role_id,status) SELECT ?,?,role_id,'active' FROM organization_memberships WHERE organization_id=? LIMIT 1",
        [org, admin.id, org],
      );
      const access = { isSystemAdmin: true, health: {} };
      const mount = async (path, router) => {
        const app = express();
        app.use(express.json());
        app.use(path, (req, _res, next) => {
          req.user = { id: admin.id, username: "db-test" };
          req.organizationContext = org;
          req.authorization = { isSystemAdmin: true, permissions: new Set() };
          req.schoolAccess = access;
          next();
        });
        app.use(path, router);
        const server = app.listen(0, "127.0.0.1");
        servers.push(server);
        await new Promise((r) => server.once("listening", r));
        return (p, method = "GET", body) =>
          fetch(`http://127.0.0.1:${server.address().port}${path}${p}`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: body ? JSON.stringify(body) : undefined,
          });
      };
      const school = await mount("/school", [
        require("../routes/schoolInsightRoutes"),
        require("../routes/schoolWorkflowRoutes"),
      ]);

      // Contacts are encrypted and merged into the insight record.
      const put = await school(`/students/${student.id}/contacts`, "PUT", {
        guardian_name: "ผู้ปกครองทดสอบ",
        guardian_relationship: "",
        guardian_phone: "081 000 0000",
        student_phone: "",
        care_instructions: "ทดสอบ",
        emergency_contact_name: "ฉุกเฉินทดสอบ",
        emergency_contact_phone: "082 000 0000",
      });
      assert.equal(put.status, 200);
      const back = await (
        await school(`/students/${student.id}/contacts`)
      ).json();
      assert.equal(back.guardian_name, "ผู้ปกครองทดสอบ");
      assert.equal(back.emergency_contact_phone, "082 000 0000");

      // A follow-up record with a task made before any new assessment.
      const [[assignee]] = await connection.query(
        "SELECT u.id FROM users u WHERE u.id=?",
        [admin.id],
      );
      const guidance = await school(
        `/students/${student.id}/guidance`,
        "POST",
        {
          recorded_at: "2026-10-01",
          issue: "ทดสอบ",
          record_type: "follow_up",
          task: {
            target_form_id: response.form_id,
            assigned_user_id: assignee.id,
            due_on: "2026-12-01",
          },
        },
      );
      assert.equal(guidance.status, 201, await guidance.clone().text());
      const { task_id: taskId } = await guidance.json();
      const [[task]] = await connection.query(
        "SELECT task_kind,source_response_id,guidance_record_id FROM school_rescreen_tasks WHERE id=?",
        [taskId],
      );
      assert.equal(task.task_kind, "follow_up");
      assert.equal(task.source_response_id, null);
      assert.ok(task.guidance_record_id);
      const list = await (
        await school(`/rescreen-tasks?student_id=${student.id}`)
      ).json();
      assert.ok(list.some((t) => t.id === taskId));

      // A school referring to a hospital creates a request, not a referral.
      const [hospital] = await connection.query(
        "INSERT INTO organizations (code,name,status,org_type,org_level) VALUES (?,?,'active','hospital','unit')",
        [`APPROVE-${randomUUID()}`, "โรงพยาบาลทดสอบ (synthetic)"],
      );
      await connection.query(
        "INSERT INTO organization_referral_links (source_organization_id,destination_organization_id,enabled) VALUES (?,?,1)",
        [org, hospital.insertId],
      );
      const referrals = await mount(
        "/case-referrals",
        require("../routes/caseReferralRoutes"),
      );
      const sent = await referrals("/", "POST", {
        source_response_id: response.id,
        destination_organization_id: hospital.insertId,
        reason: "ทดสอบการอนุมัติ",
      });
      assert.equal(sent.status, 201, await sent.clone().text());
      const request = await sent.json();
      assert.equal(request.status, "awaiting_approval");
      const [[none]] = await connection.query(
        "SELECT COUNT(*) AS n FROM case_referrals WHERE destination_organization_id=?",
        [hospital.insertId],
      );
      assert.equal(Number(none.n), 0);
      // A second identical request is refused while the first is open.
      assert.equal(
        (
          await referrals("/", "POST", {
            source_response_id: response.id,
            destination_organization_id: hospital.insertId,
            reason: "ซ้ำ",
          })
        ).status,
        409,
      );

      const approvals = await mount(
        "/referral-approvals",
        require("../routes/referralApprovalRoutes"),
      );
      const queue = await (await approvals("/?status=pending")).json();
      assert.ok(queue.data.some((r) => r.id === request.request_id));
      const approved = await approvals(
        `/${request.request_id}/approve`,
        "POST",
      );
      assert.equal(approved.status, 200, await approved.clone().text());
      const { referral_id: referralId } = await approved.json();
      const [[referral]] = await connection.query(
        "SELECT status,destination_organization_id FROM case_referrals WHERE id=?",
        [referralId],
      );
      assert.equal(referral.status, "pending");
      assert.equal(
        Number(referral.destination_organization_id),
        hospital.insertId,
      );
      assert.equal(
        (await approvals(`/${request.request_id}/approve`, "POST")).status,
        409,
      );
    } finally {
      for (const server of servers) await new Promise((r) => server.close(r));
      await connection.rollback();
      connection.release();
      await pool.end();
    }
  },
);
