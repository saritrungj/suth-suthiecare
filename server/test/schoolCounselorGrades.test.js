const test = require("node:test");
const assert = require("node:assert/strict");
const {
  loadSchoolAccess,
  canSeeStudent,
  canViewStudentHealth,
  canUpdateStudentHealth,
  studentScopeClause,
  publicAccess,
} = require("../utils/schoolAccess");
const { expandManage } = require("../authorization/permissionMatrix");

const HEALTH = [
  "students.view",
  "clinical.view",
  "student_health.view",
  "student_health.update",
];
// Grade 1 (ม.1) owns classrooms 101 and 102, grade 4 (ม.4) owns classroom 401.
const CLASSROOMS = { 1: [101, 102], 4: [401] };

async function access({ roles, grades = [], rooms = [], teacher = false }) {
  const queries = [];
  const a = await loadSchoolAccess(
    {
      query: async (sql, params) => {
        queries.push(sql);
        if (sql.includes("FROM school_staff_role_grades"))
          return [
            grades.flatMap((grade) =>
              (CLASSROOMS[grade] || []).map((id) => ({
                classroom_id: id,
                grade_level_id: grade,
                school_id: 2,
              })),
            ),
          ];
        if (sql.includes("FROM school_staff_roles")) return [roles];
        if (sql.includes("FROM school_teachers"))
          return [teacher ? [{ id: 5, school_id: 2 }] : []];
        if (sql.includes("FROM school_classroom_teachers")) return [rooms];
        throw Error(`Unexpected query: ${sql} ${params}`);
      },
    },
    {
      user: { id: 9 },
      organizationContext: 7,
      authorization: { permissions: new Set(expandManage(HEALTH)) },
    },
  );
  return Object.assign(a, { queries });
}
const counselor = (grade_scoped) => ({
  school_id: 2,
  role_code: "counselor",
  grade_scoped,
});
const m1 = { id: 1, school_id: 2, classroom_id: 101 };
const m4 = { id: 4, school_id: 2, classroom_id: 401 };

test("a grade-scoped counselor sees only students in their grades", async () => {
  const a = await access({ roles: [counselor(1)], grades: [1] });
  assert.deepEqual(a.counselorSchoolIds, []);
  assert.deepEqual(a.counselorClassroomIds.sort(), [101, 102]);
  assert.equal(a.canViewAllStudents, false);
  assert.equal(a.canViewAllHealth, false);
  assert.equal(canSeeStudent(a, m1), true);
  assert.equal(canSeeStudent(a, m4), false);
  assert.equal(canViewStudentHealth(a, m1), true);
  assert.equal(canViewStudentHealth(a, m4), false);
  assert.equal(canUpdateStudentHealth(a, m4), false);
  assert.equal(a.canMental, true);
  const scope = studentScopeClause(a);
  assert.match(scope.sql, /ss\.classroom_id IN \(\?\)/);
  assert.doesNotMatch(scope.sql, /ss\.school_id IN/);
  assert.deepEqual(scope.params, [[101, 102]]);
  const visible = publicAccess(a);
  assert.equal(visible.can_view_all_students, false);
  assert.deepEqual(visible.counselor_grade_ids, [1]);
});

test("a grade-scoped counselor with no grades left sees no students", async () => {
  const a = await access({ roles: [counselor(1)], grades: [] });
  assert.deepEqual(a.counselorClassroomIds, []);
  assert.equal(canSeeStudent(a, m1), false);
  assert.equal(canViewStudentHealth(a, m1), false);
  assert.equal(studentScopeClause(a).sql, " AND 1 = 0");
  assert.equal(a.canMental, false);
});

test("an unscoped counselor and mental_admin still see the whole school", async () => {
  for (const role of [
    counselor(0),
    { school_id: 2, role_code: "mental_admin" },
  ]) {
    const a = await access({ roles: [role] });
    assert.ok(
      !a.queries.some((sql) => sql.includes("school_staff_role_grades")),
      "no grade lookup without a grade-scoped role",
    );
    assert.deepEqual(a.counselorSchoolIds, [2]);
    assert.equal(canSeeStudent(a, m4), true);
    assert.equal(canViewStudentHealth(a, m4), true);
    assert.equal(a.canViewAllHealth, true);
  }
});

test("mental_admin is never narrowed by a grade-scoped flag", async () => {
  const a = await access({
    roles: [{ school_id: 2, role_code: "mental_admin", grade_scoped: 1 }],
  });
  assert.deepEqual(a.counselorSchoolIds, [2]);
  assert.equal(canSeeStudent(a, m4), true);
});

test("subject classrooms show students but never their health", async () => {
  const a = await access({
    roles: [{ school_id: 2, role_code: "subject_teacher" }],
    rooms: [{ classroom_id: 401, school_id: 2, role: "subject" }],
    teacher: true,
  });
  assert.equal(canSeeStudent(a, m4), true);
  assert.equal(canSeeStudent(a, m1), false);
  assert.equal(canViewStudentHealth(a, m4), false);
  assert.deepEqual(a.healthClassroomIds, []);
});

test("public access reports the new module actions", async () => {
  const a = await loadSchoolAccess(
    {
      query: async (sql) => {
        if (sql.includes("FROM school_staff_roles")) return [[]];
        if (sql.includes("FROM school_teachers")) return [[]];
        throw Error(`Unexpected query: ${sql}`);
      },
    },
    {
      user: { id: 9 },
      organizationContext: 7,
      authorization: {
        permissions: new Set(
          expandManage([
            "student_behavior.create",
            "school_appointments.manage",
            "school_documents.view",
            "audit.view",
          ]),
        ),
      },
    },
  );
  const visible = publicAccess(a);
  assert.equal(visible.behavior_actions.create, true);
  assert.equal(visible.behavior_actions.view, false);
  assert.equal(visible.appointment_actions.assign, true);
  assert.equal(visible.document_actions.view, true);
  assert.equal(visible.document_actions.create, false);
  assert.equal(visible.can_view_audit, true);
});
