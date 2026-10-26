const test = require("node:test");
const assert = require("node:assert/strict");
const { plan } = require("../scripts/migrateSchoolCarePermissions");

const units = [
  { id: 2, org_type: "school" },
  { id: 1, org_type: "hospital" },
];
const rows = (organization_id, role_id, keys) =>
  keys.map((permission_key) => ({ organization_id, role_id, permission_key }));
const added = (changes, org, role) =>
  changes
    .find((c) => c.organization_id === org && c.role_id === role)
    ?.added.map((a) => a.permission) || [];

test("roles that update student health get behaviour, appointments and audit", () => {
  const changes = plan({
    units,
    rolePermissions: rows(2, 4, ["student_health.manage", "students.view"]),
  });
  assert.deepEqual(added(changes, 2, 4), [
    "audit.view",
    "school_appointments.assign",
    "school_appointments.create",
    "school_appointments.update",
    "school_appointments.view",
    "student_behavior.assign",
    "student_behavior.create",
    "student_behavior.update",
    "student_behavior.view",
  ]);
});

test("teachers can report behaviour and staff managers run the document library", () => {
  const changes = plan({
    units,
    rolePermissions: [
      ...rows(2, 5, ["students.view", "school.view"]),
      ...rows(2, 6, ["school_staff.manage", "school.view"]),
      // school_staff.view alone is not "manages staff".
      ...rows(2, 7, ["school_staff.view"]),
    ],
  });
  assert.deepEqual(added(changes, 2, 5), [
    "school_documents.view",
    "student_behavior.create",
  ]);
  assert.deepEqual(added(changes, 2, 6), ["school_documents.manage"]);
  assert.deepEqual(added(changes, 2, 7), []);
});

test("hospital units only gain audit.view, and nothing is added twice", () => {
  const changes = plan({
    units,
    rolePermissions: [
      ...rows(1, 3, ["student_health.update", "students.view", "school.view"]),
      ...rows(2, 4, [
        "student_health.update",
        "student_behavior.manage",
        "audit.view",
      ]),
    ],
  });
  assert.deepEqual(added(changes, 1, 3), ["audit.view"]);
  assert.deepEqual(added(changes, 2, 4), [
    "school_appointments.assign",
    "school_appointments.create",
    "school_appointments.update",
    "school_appointments.view",
    "student_health.assign",
    "student_health.create",
  ]);
  const again = plan({
    units,
    rolePermissions: [
      ...rows(2, 4, ["student_health.update"]),
      ...rows(
        2,
        4,
        added(
          plan({
            units,
            rolePermissions: rows(2, 4, ["student_health.update"]),
          }),
          2,
          4,
        ),
      ),
    ],
  });
  assert.deepEqual(again, [], "a second run changes nothing");
});

// The starting school roles as the 2026-10-21 flow simulation found them.
test("starting school roles gain what the everyday flow needs", () => {
  const changes = plan({
    units,
    rolePermissions: [
      // ผู้ดูแลโรงเรียน
      ...rows(2, 27, [
        "school.view",
        "students.view",
        "students.create",
        "pii.view",
        "master_data.manage",
      ]),
      // ผู้ดูแลสุขภาพจิต
      ...rows(2, 28, [
        "clinical.view",
        "forms.update",
        "students.create",
        "student_health.update",
        "student_health.view",
        "student_behavior.manage",
        "school_appointments.manage",
        "audit.view",
        "pii.create",
        "school_documents.view",
      ]),
      // ครูแนะแนว
      ...rows(2, 30, [
        "clinical.view",
        "student_health.view",
        "student_health.update",
        "students.view",
        "student_behavior.manage",
        "school_appointments.manage",
        "audit.view",
        "school_documents.view",
      ]),
      // ครูรายวิชา
      ...rows(2, 36, ["school.view", "students.view", "school_documents.view"]),
      // Forms editors without clinical results run no screening rounds.
      ...rows(2, 37, ["forms.update", "school_documents.view"]),
    ],
  });
  assert.deepEqual(added(changes, 2, 27), [
    "pii.create",
    "school_documents.view",
    "student_behavior.create",
  ]);
  assert.deepEqual(added(changes, 2, 28), [
    "referral_approvals.update",
    "referral_approvals.view",
    "school_workflows.create",
    "school_workflows.update",
    "school_workflows.view",
    "student_health.assign",
    "student_health.create",
  ]);
  assert.deepEqual(added(changes, 2, 30), [
    "student_health.assign",
    "student_health.create",
  ]);
  assert.deepEqual(added(changes, 2, 36), ["student_behavior.create"]);
  assert.deepEqual(added(changes, 2, 37), []);
  const reasons = changes
    .find((c) => c.role_id === 28)
    .added.find((a) => a.permission === "school_workflows.view").reason;
  assert.equal(reasons, "holds clinical.view + forms.update");
});
