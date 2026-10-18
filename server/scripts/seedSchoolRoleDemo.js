// Extend the existing local school fixture without changing existing accounts.
require("../config/env");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { presets } = require("../authorization/schoolRolePermissions");
const { writeField } = require("../utils/privateField");
const { sealText, fieldContext } = require("../utils/privateData");
const accountEmail = require("../utils/accountEmail");
const { requiredAudit } = require("../utils/pdpaAudit");
const { loadAuthorization } = require("../authorization/authorization");
const {
  organizationRolePermissions,
} = require("../authorization/organizationPermissions");
const { membershipPermissions } = require("../authorization/dataPermissions");
const {
  loadSchoolAccess,
  canSeeStudent,
  canViewStudentHealth,
  canViewPhysicalHealth,
} = require("../utils/schoolAccess");
const assert = require("node:assert/strict");

const backup = path.resolve(__dirname, "../../backup");
const manifestPath = path.join(backup, "school-role-demo-manifest.json");
const credentialsPath = path.join(backup, "school-role-demo-accounts.csv");
const verificationPath = path.join(
  backup,
  "school-role-demo-verification.json",
);
const demo = JSON.parse(
  fs.readFileSync(path.join(backup, "school-demo-manifest.json"), "utf8"),
);
const profiles = [
  ["admin", "ผู้ดูแลโรงเรียน"],
  ["mental_admin", "ผู้ดูแลสุขภาพจิต"],
  ["physical_admin", "ผู้ดูแลสุขภาพกาย"],
  ["counselor", "ครูแนะแนว"],
  ["homeroom", "ครูประจำชั้น"],
  ["other", "ครูทั่วไป"],
  ["dorm_staff", "เจ้าหน้าที่หอพัก"],
  ["guardian", "ผู้ปกครอง"],
  ["template_only", "มีแม่แบบแต่ไม่มีสิทธิ์หน่วยงาน"],
  ["pii_denied", "ครูแนะแนวที่ปิดข้อมูลส่วนบุคคล"],
];

async function localizeLabels(manifest) {
  if (manifest.thai_labels_version === 2) return;
  const c = await db.getConnection();
  let credentials = fs.readFileSync(credentialsPath, "utf8");
  try {
    await c.beginTransaction();
    for (const account of manifest.accounts) {
      const label = profiles.find(([code]) => code === account.code)[1];
      const username = `school.${account.code}`;
      const [[duplicate]] = await c.query(
        "SELECT id FROM users WHERE username=? AND id<>?",
        [username, account.id],
      );
      assert.ok(!duplicate, `ชื่อผู้ใช้ ${username} มีอยู่แล้ว`);
      await c.query("UPDATE users SET username=?,name=? WHERE id=?", [
        username,
        writeField(label, "users", "name"),
        account.id,
      ]);
      if (manifest.role_ids.includes(account.role_id))
        await c.query("UPDATE roles SET name=?,description=? WHERE id=?", [
          label,
          `บทบาท${label}สำหรับงานโรงเรียน`,
          account.role_id,
        ]);
      await c.query(
        "UPDATE school_teachers SET position=?,employee_code=? WHERE user_id=? AND school_id=?",
        [label, `${label}-01`, account.id, manifest.school_id],
      );
      credentials = credentials
        .replaceAll(`"${account.username}"`, `"${username}"`)
        .replace(`"${account.code}","${username}"`, `"${label}","${username}"`);
      account.username = username;
      account.display_name = label;
    }
    const [rounds] = await c.query(
      "SELECT id,health_domain,status FROM school_screening_rounds WHERE id IN (?)",
      [manifest.round_ids],
    );
    for (const round of rounds)
      await c.query("UPDATE school_screening_rounds SET name=? WHERE id=?", [
        `รอบประเมิน${round.health_domain === "mental" ? "สุขภาพจิต" : "สุขภาพกาย"} (${round.status === "active" ? "เปิดรับการประเมิน" : "สิ้นสุดการประเมิน"})`,
        round.id,
      ]);
    await c.commit();
    manifest.thai_labels_version = 2;
    fs.writeFileSync(credentialsPath, credentials);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

async function completeWorkflowFixtures(manifest) {
  if (manifest.workflow_fixture_version === 1) return;
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [[source]] = await c.query(
      "SELECT c.*,g.level_order FROM school_classrooms c JOIN school_grade_levels g ON g.id=c.grade_level_id WHERE c.id=?",
      [manifest.classroom_id],
    );
    const [[nextGrade]] = await c.query(
      "SELECT id FROM school_grade_levels WHERE school_id=? AND level_order>? ORDER BY level_order,id LIMIT 1",
      [manifest.school_id, source.level_order],
    );
    assert.ok(nextGrade, "Requires a next grade for the promotion demo");
    const [room] = await c.query(
      "INSERT INTO school_classrooms (school_id,grade_level_id,name,academic_year,capacity) VALUES (?,?,?,?,?)",
      [
        manifest.school_id,
        nextGrade.id,
        "ข้อมูลจำลอง-เลื่อนชั้น",
        source.academic_year + 1,
        source.capacity,
      ],
    );
    manifest.promotion_target_classroom_id = room.insertId;
    await c.query(
      "INSERT IGNORE INTO school_academic_years (school_id,academic_year) VALUES (?,?)",
      [manifest.school_id, source.academic_year + 1],
    );
    const excluded = [
      ...manifest.boarder_ids,
      ...manifest.guardian_student_ids,
    ];
    const [graduates] = await c.query(
      "SELECT id,status,graduated_on FROM school_students WHERE id IN (?) AND id NOT IN (?) AND status='active' ORDER BY id DESC LIMIT 2 FOR UPDATE",
      [demo.student_ids, excluded],
    );
    assert.equal(graduates.length, 2);
    manifest.graduation_before = graduates;
    manifest.graduated_student_ids = graduates.map((s) => s.id);
    for (const [i, s] of graduates.entries())
      await c.query(
        "UPDATE school_students SET status='graduated',graduated_on=? WHERE id=?",
        [i === 0 ? "2023-03-31" : "2026-03-31", s.id],
      );
    if (manifest.created_workflow_settings) {
      const adminId = manifest.accounts.find((a) => a.code === "admin").id;
      await c.query(
        "UPDATE school_workflow_settings SET retention_years=2,retention_approved_by=?,retention_approved_at=NOW() WHERE school_id=?",
        [adminId, manifest.school_id],
      );
      manifest.demo_retention_years = 2;
    }
    const actorId = manifest.accounts.find((a) => a.code === "admin").id;
    await requiredAudit(
      { user: { id: actorId }, organizationContext: manifest.organization_id },
      "demo.school_workflows.seed",
      "school",
      manifest.school_id,
      { count: 2 },
      c,
    );
    manifest.workflow_fixture_version = 1;
    await c.commit();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
}

async function verify(manifest) {
  assert.equal(manifest.database, process.env.DB_NAME);
  const [students] = await db.query(
    "SELECT id,school_id,classroom_id,is_boarder,archived_at FROM school_students WHERE id IN (?)",
    [demo.student_ids],
  );
  const output = [];
  for (const account of manifest.accounts) {
    const auth = await loadAuthorization(account.id);
    assert.ok(auth && !auth.isSystemAdmin);
    const membership = auth.memberships.find(
      (m) => Number(m.organization_id) === manifest.organization_id,
    );
    assert.ok(membership);
    const unit = await organizationRolePermissions(
      db,
      membership.organization_id,
      membership.role_id,
    );
    const effective = await membershipPermissions(db, membership, unit);
    const req = {
      user: auth.user,
      organizationContext: manifest.organization_id,
      authorization: { ...auth, membership, permissions: new Set(effective) },
    };
    const access = await loadSchoolAccess(db, req);
    const visible = students.filter((s) => canSeeStudent(access, s));
    const mental = students.filter((s) => canViewStudentHealth(access, s));
    const physical = students.filter((s) => canViewPhysicalHealth(access, s));
    const role = account.school_role;
    if (["admin", "mental_admin", "physical_admin", "counselor"].includes(role))
      assert.equal(visible.length, students.length);
    if (role === "admin") assert.equal(mental.length + physical.length, 0);
    if (role === "physical_admin") {
      assert.equal(mental.length, 0);
      assert.equal(physical.length, students.length);
    }
    if (["mental_admin", "counselor"].includes(role))
      assert.equal(mental.length, students.length);
    if (role === "homeroom" || role === "other") {
      assert.ok(visible.length > 0 && visible.length < students.length);
      assert.ok(
        visible.every((s) => Number(s.classroom_id) === manifest.classroom_id),
      );
      assert.equal(mental.length, role === "other" ? 0 : visible.length);
    }
    if (role === "dorm_staff") {
      assert.equal(visible.length, manifest.boarder_ids.length);
      assert.ok(visible.every((s) => s.is_boarder));
      assert.equal(mental.length + physical.length, 0);
    }
    if (role === "guardian") {
      assert.deepEqual(
        visible.map((s) => s.id).sort((a, b) => a - b),
        [...manifest.guardian_student_ids].sort((a, b) => a - b),
      );
      assert.equal(access.canExportStudents, false);
      assert.equal(access.canUpdateStudents, false);
      assert.equal(access.canManageStaff, false);
      assert.ok(!effective.includes("students.update"));
    }
    if (account.code === "template_only") {
      assert.deepEqual(effective, []);
      assert.equal(visible.length, 0);
    }
    if (account.code === "pii_denied") {
      assert.equal(effective.includes("pii.view"), false);
      assert.equal(effective.includes("clinical.view"), true);
    }
    output.push({
      username: account.username,
      code: account.code,
      school_role: role,
      unit_permissions: unit,
      effective_permissions: effective,
      visible_students: visible.length,
      mental_students: mental.length,
      physical_students: physical.length,
      can_manage_staff: access.canManageStaff,
      can_export_students: access.canExportStudents,
    });
  }
  const coverage = {};
  for (const table of [
    "school_student_insights",
    "school_guidance_records",
    "school_rescreen_tasks",
    "school_enrollment_history",
  ]) {
    const [[row]] = await db.query(
      `SELECT COUNT(*) count FROM ${table} WHERE student_id IN (?)`,
      [demo.student_ids],
    );
    coverage[table] = row.count;
    assert.ok(row.count > 0);
  }
  for (const table of [
    "school_screening_rounds",
    "school_risk_triggers",
    "school_workflow_settings",
  ]) {
    const [[row]] = await db.query(
      `SELECT COUNT(*) count FROM ${table} WHERE school_id=?`,
      [manifest.school_id],
    );
    coverage[table] = row.count;
    assert.ok(row.count > 0);
  }
  const report = {
    verified_at: new Date().toISOString(),
    organization_id: manifest.organization_id,
    school_id: manifest.school_id,
    accounts: output,
    coverage,
  };
  fs.writeFileSync(verificationPath, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        verified: output.map(
          ({ code, visible_students, mental_students, physical_students }) => ({
            code,
            visible_students,
            mental_students,
            physical_students,
          }),
        ),
        coverage,
      },
      null,
      2,
    ),
  );
  return report;
}

async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)
  )
    throw Error("Local development database required");
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.database, process.env.DB_NAME);
    assert.equal(manifest.organization_id, Number(demo.organization_id));
    if (!process.argv.includes("--verify-only")) {
      await completeWorkflowFixtures(manifest);
      await localizeLabels(manifest);
    }
    return verify(manifest);
  }
  if (process.argv.includes("--verify-only"))
    throw Error("Seed manifest is missing");
  const connection = await db.getConnection();
  const credentials = [
    ["type", "username", "password", "organization_id", "note"],
  ];
  const manifest = {
    version: 1,
    database: process.env.DB_NAME,
    organization_id: Number(demo.organization_id),
    created_at: new Date().toISOString(),
    accounts: [],
    role_ids: [],
    teacher_ids: [],
    insight_student_ids: [],
    guidance_ids: [],
    round_ids: [],
    rescreen_ids: [],
    enrollment_ids: [],
    trigger_ids: [],
    boarder_before: [],
  };
  try {
    await connection.beginTransaction();
    const [[org]] = await connection.query(
      "SELECT id FROM organizations WHERE id=? AND org_type='school' AND org_level='unit'",
      [manifest.organization_id],
    );
    assert.ok(org, "Existing demo must belong to a school sub-unit");
    const [students] = await connection.query(
      "SELECT id,school_id,classroom_id,person_id,patient_account_id,is_boarder FROM school_students WHERE id IN (?) AND archived_at IS NULL ORDER BY id",
      [demo.student_ids],
    );
    assert.equal(students.length, demo.student_ids.length);
    assert.equal(new Set(students.map((s) => s.school_id)).size, 1);
    manifest.school_id = students[0].school_id;
    manifest.classroom_id = students[0].classroom_id;
    const [[actor]] = await connection.query(
      "SELECT id FROM users WHERE role_id=1 AND status='active' ORDER BY id LIMIT 1",
    );
    assert.ok(actor);
    const req = {
      user: actor,
      organizationContext: manifest.organization_id,
      get: () => "local-school-role-demo",
    };
    const [forms] = await connection.query(
      "SELECT id,health_domain,questions FROM forms WHERE id IN (?) AND organization_id=?",
      [demo.form_ids, manifest.organization_id],
    );
    const mentalForm = forms.find((f) => f.health_domain === "mental");
    const physicalForm = forms.find((f) => f.health_domain === "physical");
    assert.ok(mentalForm && physicalForm);
    for (const [code, label] of profiles) {
      const username = `school.${code}`;
      const [[collision]] = await connection.query(
        "SELECT id FROM users WHERE username=?",
        [username],
      );
      assert.ok(!collision, `Account already exists: ${username}`);
      let roleId;
      const schoolRole =
        code === "template_only"
          ? null
          : code === "pii_denied"
            ? "counselor"
            : code;
      const keys = [...(presets[schoolRole] || [])];
      // Assessment creation is an explicit unit grant on the demo mental admin.
      if (code === "mental_admin")
        keys.push(
          "forms.create",
          "forms.update",
          "forms.delete",
          "forms.export",
        );
      if (code === "guardian") {
        const [[role]] = await connection.query(
          "SELECT id FROM roles WHERE name='school_guardian'",
        );
        assert.ok(role);
        roleId = role.id;
      } else {
        const name = label;
        const [[collisionRole]] = await connection.query(
          "SELECT id FROM roles WHERE name=?",
          [name],
        );
        assert.ok(!collisionRole, `Role already exists: ${name}`);
        const [role] = await connection.query(
          "INSERT INTO roles (name,description) VALUES (?,?)",
          [name, `บทบาท${label}สำหรับงานโรงเรียน`],
        );
        roleId = role.insertId;
        manifest.role_ids.push(roleId);
        const templateKeys =
          code === "template_only" ? presets.mental_admin : keys;
        for (const key of new Set(templateKeys))
          await connection.query(
            "INSERT INTO role_permissions (role_id,permission_key) VALUES (?,?)",
            [roleId, key],
          );
        await connection.query(
          "INSERT INTO organization_role_permission_sets (organization_id,role_id,source,version,updated_by) VALUES (?,?,?,1,?)",
          [manifest.organization_id, roleId, "explicit", actor.id],
        );
        for (const key of new Set(keys))
          await connection.query(
            "INSERT INTO organization_role_permissions (organization_id,role_id,permission_key) VALUES (?,?,?)",
            [manifest.organization_id, roleId, key],
          );
      }
      const password = `Demo-${randomBytes(12).toString("base64url")}!9a`;
      const email = `${username}@example.test`;
      const [created] = await connection.query(
        "INSERT INTO users (username,password,name,email,email_encrypted,email_hash,role_id,status,auth_version) VALUES (?,?,?,NULL,?,?,?,'active',0)",
        [
          username,
          await bcrypt.hash(password, 12),
          writeField(label, "users", "name"),
          accountEmail.encode(email, "users"),
          accountEmail.lookup(email),
          roleId,
        ],
      );
      const id = created.insertId;
      const [membership] = await connection.query(
        "INSERT INTO organization_memberships (organization_id,user_id,role_id,status,is_primary) VALUES (?,?,?,'active',1)",
        [manifest.organization_id, id, roleId],
      );
      if (schoolRole)
        await connection.query(
          "INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,?,'active',?)",
          [manifest.school_id, id, schoolRole, actor.id],
        );
      if (code === "pii_denied")
        await connection.query(
          "INSERT INTO organization_membership_data_permissions (membership_id,permission_key,granted,source) VALUES (?,'pii.view',0,'explicit')",
          [membership.insertId],
        );
      if (code === "homeroom" || code === "other") {
        const [teacher] = await connection.query(
          "INSERT INTO school_teachers (school_id,user_id,employee_code,position) VALUES (?,?,?,?)",
          [manifest.school_id, id, `${label}-01`, label],
        );
        manifest.teacher_ids.push(teacher.insertId);
        await connection.query(
          "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,?)",
          [
            manifest.classroom_id,
            teacher.insertId,
            code === "homeroom" ? "homeroom" : "co_homeroom",
          ],
        );
      }
      manifest.accounts.push({
        code,
        id,
        username,
        role_id: roleId,
        membership_id: membership.insertId,
        school_role: schoolRole,
      });
      credentials.push([
        code,
        username,
        password,
        manifest.organization_id,
        `${label}; ข้อมูลจำลอง; อีเมล example.test ใช้รับ OTP ไม่ได้`,
      ]);
    }
    const userId = (code) => manifest.accounts.find((a) => a.code === code).id;
    manifest.guardian_student_ids = [
      students[0].id,
      students.find((s) => s.classroom_id !== manifest.classroom_id).id,
    ];
    for (const id of manifest.guardian_student_ids)
      await connection.query(
        "INSERT INTO school_student_guardians (student_id,user_id,status,updated_by) VALUES (?,?,'active',?)",
        [id, userId("guardian"), actor.id],
      );
    const alreadyBoarders = students.filter((s) => s.is_boarder);
    const boarders = alreadyBoarders.length
      ? alreadyBoarders
      : students.slice(0, 6);
    manifest.boarder_ids = boarders.map((s) => s.id);
    if (!alreadyBoarders.length) {
      manifest.boarder_before = boarders.map((s) => ({
        id: s.id,
        is_boarder: s.is_boarder,
      }));
      await connection.query(
        "UPDATE school_students SET is_boarder=1 WHERE id IN (?)",
        [manifest.boarder_ids],
      );
    }
    for (const [i, s] of students.slice(0, 6).entries()) {
      const [[existing]] = await connection.query(
        "SELECT student_id FROM school_student_insights WHERE student_id=?",
        [s.id],
      );
      if (!existing) {
        const payload = {
          guardian_name: "ผู้ปกครองข้อมูลจำลอง",
          guardian_relationship: "ผู้ดูแลจำลอง",
          guardian_phone: "",
          living_with: "ครอบครัวจำลอง",
          family_status: "ข้อมูลจำลอง",
          living_conditions: "ข้อมูลจำลองสำหรับทดสอบการมองเห็นตามบทบาท",
          support_needs: "ข้อมูลจำลอง: นัดพูดคุยติดตาม",
        };
        await connection.query(
          "INSERT INTO school_student_insights (student_id,payload_encrypted,updated_by) VALUES (?,?,?)",
          [
            s.id,
            sealText(
              payload,
              fieldContext(
                "school_student_insights",
                "payload_encrypted",
                manifest.organization_id,
              ),
            ),
            userId("counselor"),
          ],
        );
        manifest.insight_student_ids.push(s.id);
      }
      const [record] = await connection.query(
        "INSERT INTO school_guidance_records (student_id,recorded_at,follow_up_at,payload_encrypted,recorded_by) VALUES (?,'2026-10-14','2026-10-21',?,?)",
        [
          s.id,
          sealText(
            {
              issue: `ข้อมูลจำลอง: การปรับตัวในโรงเรียน ตัวอย่าง ${i + 1}`,
              support: "ข้อมูลจำลอง: รับฟังและวางแผนติดตามกับครูประจำชั้น",
            },
            fieldContext(
              "school_guidance_records",
              "payload_encrypted",
              manifest.organization_id,
            ),
          ),
          userId("counselor"),
        ],
      );
      manifest.guidance_ids.push(record.insertId);
      const [history] = await connection.query(
        "INSERT INTO school_enrollment_history (student_id,from_classroom_id,to_classroom_id,changed_by,changed_at) VALUES (?,NULL,?,?,'2026-05-18 08:00:00')",
        [s.id, s.classroom_id, userId("admin")],
      );
      manifest.enrollment_ids.push(history.insertId);
    }
    for (const f of [mentalForm, physicalForm])
      for (const status of ["active", "closed"]) {
        const [round] = await connection.query(
          "INSERT INTO school_screening_rounds (school_id,name,academic_year,semester,health_domain,form_id,starts_on,ends_on,status,created_by) VALUES (?,?,2569,1,?,?,?,?,?,?)",
          [
            manifest.school_id,
            `ข้อมูลจำลอง ${f.health_domain} ${status}`,
            f.health_domain,
            f.id,
            status === "active" ? "2026-05-18" : "2026-05-18",
            status === "active" ? "2026-10-31" : "2026-08-31",
            status,
            userId("mental_admin"),
          ],
        );
        manifest.round_ids.push(round.insertId);
      }
    for (const s of students) {
      if (manifest.rescreen_ids.length >= 6) break;
      const [responses] = await connection.query(
        "SELECT id,form_id,submitted_at FROM form_responses WHERE id IN (?) AND organization_id=? AND form_id=? AND (person_id=? OR (person_id IS NULL AND patient_account_id=?)) ORDER BY submitted_at,id",
        [
          demo.response_ids,
          manifest.organization_id,
          mentalForm.id,
          s.person_id || 0,
          s.patient_account_id || 0,
        ],
      );
      if (responses.length < 2) continue;
      const i = manifest.rescreen_ids.length;
      const source = responses[0],
        latest = responses.at(-1);
      const status = ["pending", "completed", "cancelled"][i % 3];
      const createdAt = new Date(
        new Date(source.submitted_at).getTime() + 1000,
      );
      const [task] = await connection.query(
        "INSERT INTO school_rescreen_tasks (student_id,source_response_id,target_form_id,assigned_user_id,due_on,status,completed_response_id,created_by,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
          s.id,
          source.id,
          mentalForm.id,
          userId("counselor"),
          "2026-10-22",
          status,
          status === "completed" ? latest.id : null,
          userId("mental_admin"),
          createdAt,
          status === "completed"
            ? latest.submitted_at
            : status === "cancelled"
              ? new Date()
              : null,
        ],
      );
      manifest.rescreen_ids.push(task.insertId);
    }
    assert.equal(
      manifest.rescreen_ids.length,
      6,
      "Requires six fixture students with two mental assessments",
    );
    const questions =
      typeof mentalForm.questions === "string"
        ? JSON.parse(mentalForm.questions)
        : mentalForm.questions;
    const findQuestion = (list) => {
      for (const q of list || []) {
        const options = q.options?.length ? q.options : q.cols;
        if (
          q.id &&
          !["group", "section"].includes(q.type) &&
          options?.length &&
          typeof options[0] === "string"
        )
          return q;
        const nested = findQuestion(q.children || q.questions);
        if (nested) return nested;
      }
    };
    const question = findQuestion(questions);
    assert.ok(
      question,
      "Requires a selectable question for the disabled demo rule",
    );
    const options = question.options?.length ? question.options : question.cols;
    const answerPath = ["grid_multiple", "grid_checkbox"].includes(
      question.type,
    )
      ? "0"
      : "";
    const [trigger] = await connection.query(
      "INSERT INTO school_risk_triggers (school_id,form_id,question_id,answer_path,answer_value,enabled,approved_by) VALUES (?,?,?,?,?,0,?)",
      [
        manifest.school_id,
        mentalForm.id,
        String(question.id),
        answerPath,
        options.at(-1),
        userId("mental_admin"),
      ],
    );
    manifest.trigger_ids.push(trigger.insertId);
    const [[settings]] = await connection.query(
      "SELECT school_id FROM school_workflow_settings WHERE school_id=?",
      [manifest.school_id],
    );
    manifest.created_workflow_settings = !settings;
    if (!settings)
      await connection.query(
        "INSERT INTO school_workflow_settings (school_id,care_advice_json) VALUES (?,?)",
        [
          manifest.school_id,
          JSON.stringify({
            high: "ข้อมูลจำลอง: ติดต่อครูแนะแนว",
            medium: "ข้อมูลจำลอง: นัดติดตาม",
            normal: "ข้อมูลจำลอง: ดูแลตามปกติ",
            none: "ข้อมูลจำลอง: เชิญทำแบบประเมิน",
          }),
        ],
      );
    await requiredAudit(
      req,
      "demo.school_roles.seed",
      "school",
      manifest.school_id,
      { count: manifest.accounts.length },
      connection,
    );
    fs.mkdirSync(backup, { recursive: true });
    // Keep generated credentials private and outside the tracked source tree.
    const csv =
      "\uFEFF" +
      credentials
        .map((row) =>
          row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
        )
        .join("\r\n");
    fs.writeFileSync(credentialsPath, csv, { flag: "wx", mode: 0o600 });
    await connection.commit();
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), {
      flag: "wx",
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  await completeWorkflowFixtures(manifest);
  await localizeLabels(manifest);
  return verify(manifest);
}
main()
  .catch((error) => {
    console.error(
      error.code === "ERR_ASSERTION"
        ? error.stack
        : error.code || error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
