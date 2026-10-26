// A student the caller can see but lacks the right for gets a 403 naming the
// missing roles-page keys (out-of-scope students keep the 404), and the
// referral approval queue says how many requests it hides without naming them.
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ test: "11".repeat(32) });
process.env.DATA_ENCRYPTION_ACTIVE_KEY = "test";
const { writeField } = require("../utils/privateField");

let writes = [];
let requestRows = [];
const connection = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release() {},
  query: async (sql, values) => {
    writes.push({ sql, values });
    return [{ insertId: 1 }];
  },
};
require.cache[require.resolve("../config/db")] = {
  exports: {
    getConnection: async () => connection,
    query: async (sql, params) => {
      // Student #1 is in school 2, class 10; student #2 is in class 20.
      if (sql.includes("FROM school_students ss JOIN schools s"))
        return [
          [
            { id: 1, school_id: 2, classroom_id: 10, is_boarder: 0 },
            { id: 2, school_id: 2, classroom_id: 20, is_boarder: 0 },
          ].filter((s) => s.id === Number(params[0])),
        ];
      if (sql.includes("FROM case_referral_requests q")) return [requestRows];
      return [[]];
    },
  },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: { requiredAudit: async () => {} },
};
require.cache[require.resolve("../middleware/authMiddleware")] = {
  exports: { verifyToken: (_req, _res, next) => next() },
};

function listen(path, router, setup) {
  const app = express();
  app.use(express.json());
  app.use(
    path,
    (req, _res, next) => {
      req.user = { id: 5 };
      req.organizationContext = 7;
      setup(req);
      next();
    },
    router,
  );
  const server = app.listen(0, "127.0.0.1");
  return new Promise((resolve) =>
    server.once("listening", () =>
      resolve({
        server,
        url: (p) => `http://127.0.0.1:${server.address().port}${path}${p}`,
      }),
    ),
  );
}

// A homeroom teacher of class 10 (health in scope through the class).
const homeroom = (extra = {}) => ({
  isTeacher: true,
  hasSchoolRole: true,
  classroomIds: [10],
  healthClassroomIds: [10],
  homeroomSchoolIds: [2],
  counselorSchoolIds: [],
  clinicalAllowed: true,
  healthView: true,
  healthUpdate: true,
  health: { view: true, update: true },
  ...extra,
});

test("a visible student without the right gets a 403 naming the missing keys; others keep the 404", async () => {
  let scope;
  const { server, url } = await listen(
    "/school",
    require("../routes/schoolInsightRoutes"),
    (req) => {
      req.schoolAccess = scope;
    },
  );
  const guidance = (id) =>
    fetch(url(`/students/${id}/guidance`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recorded_at: "2026-10-21", issue: "ปรับตัว" }),
    });
  try {
    writes = [];
    // Health update but no create: the guidance note needs student_health.create.
    scope = homeroom();
    let response = await guidance(1);
    assert.equal(response.status, 403);
    let body = await response.json();
    assert.equal(body.code, "PERMISSION_REQUIRED");
    assert.deepEqual(body.permissions, ["student_health.create"]);
    assert.match(body.message, /student_health\.create/);
    // Student #2 is not in their class: still not found, nothing revealed.
    response = await guidance(2);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).permissions, undefined);
    // No health view at all: reading insights names the view keys.
    scope = homeroom({
      clinicalAllowed: false,
      healthView: false,
      healthUpdate: false,
      health: {},
    });
    response = await fetch(url("/students/1/insights"));
    assert.equal(response.status, 403);
    body = await response.json();
    assert.deepEqual(body.permissions, [
      "clinical.view",
      "student_health.view",
    ]);
    // A subject teacher sees the student but health is outside their duty:
    // granting keys would not help, so it stays a 404.
    scope = {
      isTeacher: true,
      hasSchoolRole: true,
      classroomIds: [10],
      healthClassroomIds: [],
      homeroomSchoolIds: [],
      counselorSchoolIds: [],
      clinicalAllowed: false,
      healthView: false,
      health: {},
    };
    assert.equal((await fetch(url("/students/1/insights"))).status, 404);
    // Staff with no school duty see every student; health view would open
    // the whole unit's health for them.
    scope = {
      hasSchoolRole: false,
      canViewAllStudents: true,
      clinicalAllowed: true,
      healthView: false,
      healthUnitWide: false,
      health: {},
    };
    response = await fetch(url("/students/2/insights"));
    assert.equal(response.status, 403);
    assert.deepEqual((await response.json()).permissions, [
      "student_health.view",
    ]);
    // Guardians never get a list of rights.
    scope = {
      isGuardian: true,
      guardianStudents: [{ id: 1, school_id: 2 }],
      health: {},
    };
    assert.equal((await guidance(1)).status, 404);
    // With the right the note is written.
    scope = homeroom({ health: { view: true, update: true, create: true } });
    assert.equal((await guidance(1)).status, 201);
    assert.ok(writes.some((w) => /school_guidance_records/.test(w.sql)));
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("the approval queue counts the requests it hides without naming the students", async () => {
  let scope, permissions;
  const { server, url } = await listen(
    "/approvals",
    require("../routes/referralApprovalRoutes"),
    (req) => {
      req.authorization = { permissions: new Set(permissions) };
      req.schoolAccess = scope;
    },
  );
  const row = (id, studentId, classroomId) => ({
    id,
    status: "pending",
    created_at: "2026-10-21T08:00:00.000Z",
    source_response_id: 100 + id,
    destination_organization_id: 9,
    destination_name: "โรงพยาบาลทดสอบ",
    reason_encrypted: writeField(
      "ส่งต่อเพื่อประเมิน",
      "case_referral_requests",
      "reason_encrypted",
      7,
    ),
    requested_by: 5,
    student_id: studentId,
    school_id: 2,
    classroom_id: classroomId,
    is_boarder: 0,
    student_code: `S${studentId}`,
    prefix: "ด.ช.",
    first_name_encrypted: writeField(
      `ลับ${studentId}`,
      "school_students",
      "first_name_encrypted",
      7,
    ),
    last_name_encrypted: null,
  });
  try {
    requestRows = [row(1, 1, 10), row(2, 2, 20), row(3, 3, 20)];
    permissions = ["referral_approvals.view", "referral_approvals.update"];
    // Sees class 10's mental health only.
    scope = homeroom();
    let response = await fetch(url("/?status=pending"));
    assert.equal(response.status, 200);
    let body = await response.json();
    assert.deepEqual(
      body.data.map((r) => r.id),
      [1],
    );
    assert.deepEqual(body.hidden, { count: 2, missing_permissions: [] });
    const text = JSON.stringify(body);
    assert.doesNotMatch(text, /S2|S3|ลับ2|ลับ3/);
    // An approver who cannot see mental health at all is told which rights.
    scope = homeroom({
      clinicalAllowed: false,
      healthView: false,
      health: {},
    });
    body = await (await fetch(url("/"))).json();
    assert.equal(body.data.length, 0);
    assert.deepEqual(body.hidden, {
      count: 3,
      missing_permissions: ["clinical.view", "student_health.view"],
    });
    // The student file's panel (one assessment) carries no queue count.
    permissions = ["cases.view"];
    scope = homeroom();
    body = await (await fetch(url("/?source_response_id=101"))).json();
    assert.equal(body.hidden, undefined);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("school presets carry the rights the everyday flow needs", () => {
  const {
    ROLE_PRESETS,
    PRESET_TYPES,
  } = require("../authorization/rolePresets");
  const {
    keysForOrganizationType,
  } = require("../authorization/permissionMatrix");
  const school = keysForOrganizationType("school");
  for (const [id, keys] of Object.entries(ROLE_PRESETS)) {
    assert.equal(new Set(keys).size, keys.length, `${id} has no duplicates`);
    if (PRESET_TYPES[id] === "school")
      for (const key of keys) assert.ok(school.has(key), `${id}: ${key}`);
  }
  const has = (id, keys) =>
    keys.forEach((key) => assert.ok(ROLE_PRESETS[id].includes(key), key));
  has("school_admin", ["pii.create", "students.create"]);
  has("mental_admin", [
    "school_workflows.view",
    "school_workflows.create",
    "school_workflows.update",
    "referral_approvals.view",
    "referral_approvals.update",
    "clinical.view",
    "student_health.view",
  ]);
  has("counselor", ["student_health.create", "student_health.assign"]);
  has("subject_teacher", ["student_behavior.create"]);
  assert.ok(!ROLE_PRESETS.school_admin.includes("clinical.view"));
  assert.ok(!ROLE_PRESETS.subject_teacher.includes("pii.view"));
});
