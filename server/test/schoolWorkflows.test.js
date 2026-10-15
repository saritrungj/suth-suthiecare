const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const {
  validDate,
  dateWindow,
  evaluateRiskTriggers,
} = require("../utils/schoolWorkflows");
const {
  loadSchoolAccess,
  canViewStudentHealth,
  canViewPhysicalHealth,
  canSeeStudent,
} = require("../utils/schoolAccess");
const { prepareImportRow } = require("../utils/studentImport");

test("school role matrix separates physical data, mental insights and boarder scope", async () => {
  const db = {
    query: async (sql) =>
      sql.includes("school_staff_roles")
        ? [[{ school_id: 2, role_code: db.role }]]
        : sql.includes("school_teachers")
          ? [[]]
          : [[]],
  };
  for (const role of [
    "mental_admin",
    "physical_admin",
    "dorm_staff",
    "admin",
  ]) {
    db.role = role;
    const access = await loadSchoolAccess(db, {
      user: { id: 3 },
      organizationContext: 7,
      authorization: { permissions: new Set() },
    });
    const ss = { school_id: 2, classroom_id: 10, is_boarder: 1 };
    assert.equal(canViewStudentHealth(access, ss), role === "mental_admin");
    assert.equal(
      canViewPhysicalHealth(access, ss),
      ["mental_admin", "physical_admin"].includes(role),
    );
    assert.equal(Boolean(canSeeStudent(access, ss)), true);
    assert.equal(
      Boolean(canSeeStudent(access, { ...ss, is_boarder: 0 })),
      role !== "dorm_staff",
    );
    assert.equal(
      Boolean(canSeeStudent(access, { ...ss, school_id: 99 })),
      false,
    );
    assert.equal(
      Boolean(canSeeStudent(access, { ...ss, archived_at: "2026-10-14" })),
      false,
    );
  }
});
test("risk triggers inspect the specified row, survive low totals and ignore inactive rules", () => {
  const rule = {
    id: 7,
    question_id: "grid",
    answer_path: "8",
    answer_value: "มี",
    enabled: 1,
  };
  assert.deepEqual(
    evaluateRiskTriggers([rule], { grid: { 0: "ไม่มี", 8: "มี" } }),
    { level: "high", trigger_ids: [7] },
  );
  assert.equal(
    evaluateRiskTriggers([rule], { grid: { 0: "มี", 8: "ไม่มี" } }),
    null,
  );
  assert.equal(
    evaluateRiskTriggers([{ ...rule, enabled: 0 }], { grid: { 8: "มี" } }),
    null,
  );
  assert.deepEqual(
    evaluateRiskTriggers(
      [{ ...rule, question_id: "checkbox", answer_path: "" }],
      { checkbox: ["ไม่มี", "มี"] },
    ),
    { level: "high", trigger_ids: [7] },
  );
});
test("date filters reject impossible dates, reverse ranges and SQL input", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2028-02-29"), true);
  for (const query of [
    { start_date: "2026-02-30" },
    { start_date: "2026-11-02", end_date: "2026-10-14" },
    { start_date: "2026-01-01' OR 1=1" },
  ])
    assert.throws(() => dateWindow(query), { status: 422 });
});
test("student onboarding validates email, optional initial password and independent boarding status", () => {
  const raw = {
    student_code: "001",
    first_name: "สมชาย",
    last_name: "ทดสอบ",
    grade: "ม.1",
    classroom: "1/1",
    email: "Student@School.test",
    initial_password: "DemoStrong#2026",
    is_boarder: "ใช่",
  };
  const prepared = prepareImportRow(raw, { schoolCode: "SC" });
  assert.deepEqual(prepared.errors, []);
  assert.equal(prepared.row.email, "student@school.test");
  assert.equal(prepared.row.is_boarder, 1);
  const bad = prepareImportRow(
    { ...raw, email: "bad", initial_password: "123", is_boarder: "unknown" },
    { schoolCode: "SC" },
  );
  assert.equal(bad.errors.length, 3);
  assert.equal(
    prepareImportRow({ ...raw, is_boarder: "" }, { schoolCode: "SC" }).row
      .is_boarder,
    null,
  );
});

async function withApp(query, access, run) {
  const connection = {
    query,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  };
  const dbPath = require.resolve("../config/db");
  require.cache[dbPath] = {
    exports: { query, getConnection: async () => connection },
  };
  for (const path of [
    "../routes/schoolWorkflowRoutes",
    "../routes/schoolTeacherImportRoutes",
    "../utils/pdpaAudit",
  ])
    delete require.cache[require.resolve(path)];
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 3 };
    req.organizationContext = 7;
    req.schoolAccess = access;
    req.authorization = { permissions: new Set() };
    next();
  });
  app.use(require("../routes/schoolWorkflowRoutes"));
  app.use((e, req, res, next) =>
    res.status(e.status || 500).json({ message: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await run((path, body, method = "POST") =>
      fetch(
        `http://127.0.0.1:${server.address().port}${path}`,
        body
          ? {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }
          : undefined,
      ),
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
}
const admin = {
  isSystemAdmin: false,
  adminSchoolIds: [2],
  allStudentSchoolIds: [2],
  classroomIds: [],
  teacherSchoolIds: [],
  counselorSchoolIds: [],
  physicalSchoolIds: [],
  dormSchoolIds: [],
  canViewAllStudents: false,
  canViewStudents: true,
  canViewRisk: true,
};
test("rescreen completion rejects another student response and denies physical-only staff before writes", async () => {
  for (const mental of [true, false]) {
    let writes = 0;
    await withApp(
      async (sql, params) => {
        if (sql.includes("FROM school_rescreen_tasks"))
          return [
            [
              {
                id: 5,
                school_id: 2,
                classroom_id: 10,
                person_id: 101,
                patient_account_id: 201,
                status: "pending",
                source_response_id: 10,
                target_form_id: 8,
                created_at: "2026-10-14 09:00:00",
              },
            ],
          ];
        if (sql.includes("FROM form_responses")) {
          assert.match(sql, /id<>\?/);
          assert.match(sql, /submitted_at>=\?/);
          assert.deepEqual(params, [
            99,
            10,
            8,
            7,
            101,
            201,
            "2026-10-14 09:00:00",
          ]);
          return [[]];
        }
        if (sql.startsWith("UPDATE")) writes++;
        return [{}];
      },
      {
        ...admin,
        counselorSchoolIds: mental ? [2] : [],
        physicalSchoolIds: mental ? [] : [2],
      },
      async (request) => {
        const response = await request(
          "/rescreen-tasks/5",
          { status: "completed", completed_response_id: 99 },
          "PUT",
        );
        assert.equal(response.status, mental ? 422 : 404);
        assert.equal(writes, 0);
      },
    );
  }
});
test("general school risk summary returns only allowed fields and configured care advice", async () => {
  const { sealJson, fieldContext } = require("../utils/privateData");
  await withApp(
    async (sql, params) => {
      if (
        sql.includes("FROM school_students ss") &&
        sql.includes("LEFT JOIN school_classrooms")
      ) {
        assert.match(sql, /ss.school_id IN/);
        assert.match(sql, /archived_at IS NULL/);
        return [
          [
            {
              id: 1,
              school_id: 2,
              student_code: "001",
              classroom_id: 10,
              classroom_name: "1/1",
              is_boarder: 1,
            },
          ],
        ];
      }
      if (sql.includes("JOIN form_responses fr"))
        return [
          [
            {
              id: 20,
              student_id: 1,
              organization_id: 7,
              submitted_at: "2026-11-03",
              summary_data: JSON.stringify(
                sealJson(
                  {
                    raw_answers: { secret: "private" },
                    score_results: [
                      { score: 10, label: "เสี่ยงสูง", color: "#d93025" },
                    ],
                  },
                  fieldContext("form_responses", "summary_data", 7),
                ),
              ),
            },
          ],
        ];
      if (sql.includes("school_workflow_settings"))
        return [
          [
            {
              school_id: 2,
              care_advice_json: { high: "คำแนะนำที่โรงเรียนยืนยัน" },
            },
          ],
        ];
      throw Error(sql);
    },
    admin,
    async (get) => {
      const response = await get("/risk-summary");
      assert.equal(response.status, 200);
      const { data } = await response.json();
      assert.deepEqual(
        Object.keys(data[0]).sort(),
        [
          "id",
          "student_code",
          "classroom_name",
          "is_boarder",
          "risk_status",
          "assessed_on",
          "care_advice",
        ].sort(),
      );
      assert.equal(data[0].risk_status, "high");
      assert.equal(data[0].care_advice, "คำแนะนำที่โรงเรียนยืนยัน");
    },
  );
});
test("screening progress counts actual responses within the round, organization and classroom scope", async () => {
  const access = {
    ...admin,
    adminSchoolIds: [],
    allStudentSchoolIds: [],
    teacherSchoolIds: [2],
    classroomIds: [10],
  };
  await withApp(
    async (sql, params) => {
      if (sql.includes("FROM school_screening_rounds"))
        return [
          [
            {
              id: 4,
              school_id: 2,
              form_id: 8,
              health_domain: "mental",
              starts_on: "2026-11-02",
              ends_on: "2026-11-15",
            },
          ],
        ];
      if (sql.includes("MAX(fr.submitted_at)")) {
        assert.match(sql, /fr.organization_id=\?/);
        assert.match(sql, /DATE\(fr.submitted_at\) BETWEEN/);
        assert.match(sql, /ss.classroom_id IN/);
        assert.deepEqual(params, [7, 8, "2026-11-02", "2026-11-15", 2, [10]]);
        return [
          [
            { id: 1, completed_on: "2026-11-03" },
            { id: 2, completed_on: null },
          ],
        ];
      }
      throw Error(sql);
    },
    access,
    async (get) => {
      const response = await get("/screening-rounds/4/progress");
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.completed, 1);
      assert.equal(body.outstanding, 1);
    },
  );
});
test("promotion validates all destinations before any enrollment write", async () => {
  let writes = 0;
  await withApp(
    async (sql, params) => {
      if (sql.includes("SELECT id FROM schools")) return [[{ id: 2 }]];
      if (sql.includes("FROM school_classrooms"))
        return [
          [
            { id: 10, academic_year: 2569 },
            { id: 20, academic_year: 2569 },
          ],
        ];
      if (sql.startsWith("UPDATE school_students")) writes++;
      return [[]];
    },
    admin,
    async (get) => {
      const response = await get("/promotions", {
        school_id: 2,
        dry_run: false,
        mappings: [{ from_classroom_id: 10, to_classroom_id: 20 }],
      });
      assert.equal(response.status, 422);
      assert.equal(writes, 0);
    },
  );
});
test("retention counts from graduation, excludes holds, and preview performs no archive writes", async () => {
  let archived = 0;
  await withApp(
    async (sql, params) => {
      if (sql.includes("SELECT id FROM schools")) return [[{ id: 2 }]];
      if (sql.includes("SELECT retention_years"))
        return [[{ retention_years: 2 }]];
      if (sql.includes("DATE_SUB(CURDATE()")) {
        assert.match(sql, /graduated_on<=/);
        assert.match(sql, /pdpa_legal_holds/);
        assert.deepEqual(params, [2, 2, 7, 7]);
        return [[{ id: 1, student_code: "001", graduated_on: "2024-10-01" }]];
      }
      if (sql.startsWith("UPDATE school_students")) archived++;
      return [{ affectedRows: 1 }];
    },
    admin,
    async (get) => {
      const preview = await get("/retention/2", { dry_run: true });
      assert.equal(preview.status, 200);
      assert.equal(archived, 0);
      const apply = await get("/retention/2", { dry_run: false });
      assert.equal(apply.status, 200);
      assert.equal(archived, 1);
      assert.equal((await apply.json()).shared_medical_records_deleted, false);
    },
  );
});
