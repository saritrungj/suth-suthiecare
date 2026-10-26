const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ test: "11".repeat(32) });
process.env.DATA_ENCRYPTION_ACTIVE_KEY = "test";
const { sealText, fieldContext } = require("../utils/privateData");

// One fake db for every test: the student is #1 in school 2, class 10.
let scope;
let writes = [];
let audits = [];
let stored = null;
const connection = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release() {},
  query: async (sql, values) => {
    if (sql.includes("SELECT payload_encrypted FROM school_student_insights"))
      return [stored ? [{ payload_encrypted: stored }] : []];
    if (sql.includes("FROM school_students WHERE id=?"))
      return [
        [
          {
            id: 1,
            school_id: 2,
            classroom_id: 10,
            person_id: 50,
            patient_account_id: null,
          },
        ],
      ];
    if (sql.startsWith("SELECT emergency_contact_name_encrypted")) return [[]];
    if (sql.includes("FROM forms WHERE id=?")) return [[{ id: 5 }]];
    if (
      sql.includes(
        "FROM organization_memberships om JOIN users u ON u.id=om.user_id WHERE om.organization_id=? AND om.user_id=?",
      )
    )
      return [[{ id: 9 }]];
    if (sql.includes("SELECT DISTINCT u.id,u.username")) return [[{ id: 9 }]];
    if (sql.includes("FROM school_student_guardians g")) return [[]];
    if (sql.includes("JOIN school_staff_roles r ON r.user_id=u.id"))
      return [[{ id: 77 }]];
    writes.push({ sql, values });
    return [{ insertId: 40 }];
  },
};
require.cache[require.resolve("../config/db")] = {
  exports: {
    getConnection: async () => connection,
    query: async (sql, values) => {
      if (sql.includes("FROM school_students ss JOIN schools s"))
        return [[{ id: 1, school_id: 2, classroom_id: 10, is_boarder: 0 }]];
      return connection.query(sql, values);
    },
  },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: { requiredAudit: async (...args) => audits.push(args) },
};

async function withApp(router, run) {
  const app = express();
  app.use(express.json());
  app.use(
    "/school",
    (req, _res, next) => {
      req.user = { id: 5 };
      req.organizationContext = 7;
      req.schoolAccess = scope;
      next();
    },
    router,
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const call = (path, method = "GET", body) =>
    fetch(`http://127.0.0.1:${server.address().port}/school${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  try {
    await run(call);
  } finally {
    await new Promise((r) => server.close(r));
  }
}

const counselor = {
  counselorSchoolIds: [2],
  health: { view: true, update: true, create: true },
};
const homeroom = {
  isTeacher: true,
  classroomIds: [10],
  healthClassroomIds: [10],
  homeroomSchoolIds: [2],
  counselorSchoolIds: [],
  health: { view: true, update: true, create: true, assign: true },
};
const physicalAdmin = { physicalSchoolIds: [2], counselorSchoolIds: [] };
const contacts = {
  guardian_name: "ผู้ปกครองจำลอง",
  guardian_relationship: "mother",
  guardian_phone: "081-234-5678",
  student_phone: "090 000 0000",
  care_instructions: "พูดคุยแบบตัวต่อตัว",
  emergency_contact_name: "ญาติจำลอง",
  emergency_contact_phone: "+66 81 000 0000",
};

test("contacts: counselors edit, homeroom and physical staff read, others see nothing", async () => {
  delete require.cache[require.resolve("../routes/schoolInsightRoutes")];
  const router = require("../routes/schoolInsightRoutes");
  stored = sealText(
    { living_with: "parents", guardian_name: "เดิม", care_instructions: "ลับ" },
    fieldContext("school_student_insights", "payload_encrypted", 7),
  );
  await withApp(router, async (call) => {
    scope = { counselorSchoolIds: [] };
    assert.equal((await call("/students/1/contacts")).status, 404);

    // A guardian of the student reads the contacts, never the staff care note.
    scope = {
      isGuardian: true,
      guardianStudents: [{ id: 1, school_id: 2 }],
      counselorSchoolIds: [],
    };
    const family = await (await call("/students/1/contacts")).json();
    assert.equal(family.guardian_name, "เดิม");
    assert.equal(family.can_edit, false);
    assert.equal("care_instructions" in family, false);

    scope = physicalAdmin;
    const physical = await (await call("/students/1/contacts")).json();
    assert.equal(physical.guardian_name, "เดิม");
    assert.equal(physical.can_edit, false);
    assert.equal("care_instructions" in physical, false);

    scope = homeroom;
    const teacher = await (await call("/students/1/contacts")).json();
    assert.equal(teacher.care_instructions, "ลับ");
    assert.equal(teacher.can_edit, false);
    writes = [];
    assert.equal(
      (await call("/students/1/contacts", "PUT", contacts)).status,
      403,
    );
    assert.equal(writes.length, 0);

    scope = counselor;
    assert.equal(
      (
        await call("/students/1/contacts", "PUT", {
          ...contacts,
          student_phone: "call me",
        })
      ).status,
      422,
    );
    audits = [];
    const saved = await call("/students/1/contacts", "PUT", contacts);
    assert.equal(saved.status, 200);
    const insight = writes.find((w) =>
      w.sql.includes("INSERT INTO school_student_insights"),
    );
    const health = writes.find((w) =>
      w.sql.includes("INSERT INTO school_student_health_profiles"),
    );
    // Encrypted at rest, merged with the other insight fields.
    assert.ok(!String(insight.values[1]).includes("ผู้ปกครองจำลอง"));
    const { readJson } = require("../utils/privateData");
    const merged = readJson(
      insight.values[1],
      fieldContext("school_student_insights", "payload_encrypted", 7),
    );
    assert.equal(merged.living_with, "parents");
    assert.equal(merged.student_phone, "090 000 0000");
    assert.ok(!String(health.values[1]).includes("ญาติจำลอง"));
    assert.equal(audits.at(-1)[1], "student_contacts.update");
  });
});

test("guidance: a follow-up record opens a task only with the assign right, screening is not a student record", async () => {
  delete require.cache[require.resolve("../routes/schoolInsightRoutes")];
  const router = require("../routes/schoolInsightRoutes");
  const body = {
    recorded_at: "2026-10-01",
    issue: "เรื่องจำลอง",
    record_type: "follow_up",
    task: { target_form_id: 5, assigned_user_id: 9, due_on: "2026-11-01" },
  };
  await withApp(router, async (call) => {
    scope = counselor; // create but no assign
    writes = [];
    assert.equal(
      (await call("/students/1/guidance", "POST", body)).status,
      403,
    );
    assert.equal(writes.length, 0);
    assert.equal(
      (
        await call("/students/1/guidance", "POST", {
          ...body,
          record_type: "guidance",
        })
      ).status,
      422,
    );
    // Screening is done by rounds for a group, not recorded for one student.
    const { task: _task, ...plain } = body;
    assert.equal(
      (
        await call("/students/1/guidance", "POST", {
          ...plain,
          record_type: "screening",
        })
      ).status,
      422,
    );

    scope = { ...counselor, health: { ...counselor.health, assign: true } };
    const ok = await call("/students/1/guidance", "POST", body);
    assert.equal(ok.status, 201);
    const guidance = writes.find((w) =>
      w.sql.includes("INSERT INTO school_guidance_records"),
    );
    assert.equal(guidance.values[1], "follow_up");
    const task = writes.find((w) =>
      w.sql.includes("INSERT INTO school_rescreen_tasks"),
    );
    // Kind, the guidance record it came from, and no source response yet.
    assert.deepEqual(task.values.slice(0, 4), [1, "follow_up", 40, null]);
  });
});

test("referral approvals need their own rights", async () => {
  require.cache[require.resolve("../middleware/authMiddleware")] = {
    exports: { verifyToken: (_req, _res, next) => next() },
  };
  delete require.cache[require.resolve("../routes/referralApprovalRoutes")];
  const router = require("../routes/referralApprovalRoutes");
  const app = express();
  app.use(express.json());
  let permissions;
  app.use(
    "/approvals",
    (req, _res, next) => {
      req.user = { id: 5 };
      req.organizationContext = 7;
      req.authorization = { permissions: new Set(permissions) };
      req.schoolAccess = counselor;
      next();
    },
    router,
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = (p) => `http://127.0.0.1:${server.address().port}/approvals${p}`;
  try {
    writes = [];
    permissions = ["cases.view"];
    assert.equal((await fetch(url("/"))).status, 403);
    assert.equal(
      (await fetch(url("/3/approve"), { method: "POST" })).status,
      403,
    );
    assert.equal(
      (
        await fetch(url("/3/decline"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: "x" }),
        })
      ).status,
      403,
    );
    permissions = ["referral_approvals.update"];
    assert.equal(
      (
        await fetch(url("/3/decline"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ).status,
      422,
    );
    assert.equal(writes.length, 0);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("guardian accounts from the student file follow the school staff rights", async () => {
  delete require.cache[require.resolve("../routes/schoolInsightRoutes")];
  const router = require("../routes/schoolInsightRoutes");
  const staff = (rights) => ({
    canViewAllStudents: true,
    counselorSchoolIds: [],
    staff: rights,
  });
  await withApp(router, async (call) => {
    scope = staff({});
    assert.equal((await call("/students/1/guardians")).status, 403);

    scope = staff({ view: true });
    const list = await (await call("/students/1/guardians")).json();
    assert.deepEqual(list.guardians, []);
    assert.equal(list.can_create, false);
    writes = [];
    assert.equal(
      (
        await call("/students/1/guardians", "POST", {
          username: "parent01",
          name: "ผู้ปกครองทดสอบ",
          email: "parent01@example.test",
          password: "Synthetic#2026",
        })
      ).status,
      403,
    );
    assert.equal(
      (await call("/students/1/guardians", "POST", { link_username: "p" }))
        .status,
      403,
    );
    assert.equal(writes.length, 0);

    // Linking a guardian account the school already has (a sibling's).
    scope = staff({ view: true, assign: true });
    audits = [];
    const linked = await call("/students/1/guardians", "POST", {
      link_username: "parent01",
    });
    assert.equal(linked.status, 201);
    const link = writes.find((w) =>
      w.sql.includes("INSERT INTO school_student_guardians"),
    );
    assert.deepEqual(link.values.slice(0, 2), [1, 77]);
    assert.equal(audits.at(-1)[1], "school.guardian.link");

    // Guardians themselves never manage guardian accounts.
    scope = {
      isGuardian: true,
      guardianStudents: [{ id: 1, school_id: 2 }],
      staff: {},
    };
    assert.equal((await call("/students/1/guardians")).status, 403);
  });
});
