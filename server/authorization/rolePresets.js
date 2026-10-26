// Starting rights a new unit role can be created with on the roles page. A
// preset only fills the first version of the role: the roles page stays the
// source of truth and every key can be changed afterwards. Keys the
// organization type does not offer are dropped.
const keys = (module, actions) => actions.map((a) => `${module}.${a}`);

// Shared by the school duties that look after students' health in their scope.
const SCHOOL_CARE = [
  ...keys("dashboard", ["view", "export"]),
  ...keys("school", ["view", "export"]),
  ...keys("students", ["view", "export"]),
  "pii.view",
  "clinical.view",
  ...keys("student_health", ["view", "create", "update", "assign"]),
  ...keys("cases", ["view", "update", "assign", "export"]),
  ...keys("student_behavior", ["view", "create", "update", "assign"]),
  ...keys("school_appointments", ["view", "create", "update", "assign"]),
  "school_documents.view",
  "audit.view",
];

const ROLE_PRESETS = Object.freeze({
  // หัวหน้างาน: overview, reports and the change history. No per-student
  // health, case or personal data.
  supervisor: [
    "dashboard.view",
    "dashboard.export",
    "school.view",
    "audit.view",
    "audit.export",
  ],
  // ผู้ดูแลโรงเรียน: school structure and the student register, including
  // importing students (pii.create). No health data.
  school_admin: [
    ...keys("dashboard", ["view", "export"]),
    ...keys("school", ["view", "create", "update", "delete", "export"]),
    ...keys("students", ["view", "create", "update", "delete", "export"]),
    ...keys("pii", ["view", "create"]),
    ...keys("master_data", ["view", "export", "manage"]),
    "school_documents.view",
    "student_behavior.create",
  ],
  // ผู้ดูแลสุขภาพจิต: the whole school's mental-health care, screening rounds
  // and approving referrals to hospitals.
  mental_admin: [
    ...new Set([
      ...SCHOOL_CARE,
      ...keys("school", ["create", "update", "delete"]),
      ...keys("students", ["create", "update", "delete"]),
      "pii.create",
      ...keys("master_data", ["view", "export", "manage"]),
      ...keys("forms", ["view", "create", "update", "delete", "export"]),
      ...keys("school_workflows", ["view", "create", "update"]),
      ...keys("referral_approvals", ["view", "update"]),
    ]),
  ],
  // ครูแนะแนว: guidance records, follow-up tasks and cases for their students.
  counselor: SCHOOL_CARE,
  // ครูรายวิชา: sees the students they teach and reports a behaviour.
  subject_teacher: [
    "school.view",
    "students.view",
    "school_documents.view",
    "student_behavior.create",
  ],
});

// Presets that only make sense for one organization type.
const PRESET_TYPES = Object.freeze({
  school_admin: "school",
  mental_admin: "school",
  counselor: "school",
  subject_teacher: "school",
});

module.exports = { ROLE_PRESETS, PRESET_TYPES };
