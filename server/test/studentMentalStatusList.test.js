const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ test: "11".repeat(32) });
process.env.DATA_ENCRYPTION_ACTIVE_KEY = "test";
const { writeField } = require("../utils/privateField");

const student = (id, classroom) => ({
  id,
  school_id: 1,
  classroom_id: classroom,
  student_code: `000${id}`,
  status: "active",
  first_name_encrypted: writeField(
    `นักเรียน${id}`,
    "school_students",
    "first_name_encrypted",
    7,
  ),
  last_name_encrypted: null,
});
const risky = JSON.stringify({ score_results: [{ label: "เสี่ยงสูง" }] });

async function withApp({ roles, query }, run) {
  require.cache[require.resolve("../config/db")] = {
    exports: { query, getConnection: async () => ({}) },
  };
  delete require.cache[require.resolve("../routes/schoolRoutes")];
  delete require.cache[require.resolve("../authorization/authorization")];
  const app = express();
  app.use(express.json());
  app.use("/api/school", (req, _res, next) => {
    req.user = { id: 30 };
    req.organizationContext = 7;
    req.authorization = roles
      ? {
          isSystemAdmin: false,
          permissions: new Set(["students.view", "student_health.view"]),
        }
      : { isSystemAdmin: true, permissions: new Set() };
    next();
  });
  app.use("/api/school", require("../routes/schoolRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await run((path) =>
      fetch(`http://127.0.0.1:${server.address().port}/api/school${path}`),
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
}

test("the student list shows each student's latest mental status in the chosen period", async () => {
  const seen = [];
  await withApp(
    {
      query: async (sql, params) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("ROW_NUMBER()")) {
          seen.push(params);
          return [
            [
              {
                student_id: 1,
                id: 90,
                organization_id: 7,
                summary_data: risky,
                submitted_at: new Date("2026-06-10T03:00:00Z"),
                form_title: "SDQ",
              },
            ],
          ];
        }
        if (sql.includes("FROM school_students ss"))
          return [[student(1, 21), student(2, 21)]];
        if (sql.includes("term1_starts_on"))
          return [
            [
              {
                school_id: 1,
                academic_year: 2569,
                term1_starts_on: "2026-05-16",
                term1_ends_on: "2026-10-10",
                term2_starts_on: "2026-11-01",
                term2_ends_on: "2027-03-31",
              },
            ],
          ];
        if (sql.includes("FROM school_enrollment_history"))
          return [
            [
              {
                student_id: 1,
                from_classroom_id: 11,
                to_classroom_id: 21,
                changed_at: new Date("2027-05-10T01:00:00Z"),
              },
            ],
          ];
        if (sql.includes("FROM school_student_care_statuses"))
          return [
            [
              {
                id: 3,
                student_id: 2,
                status: "following",
                effective_on: "2026-09-01",
              },
            ],
          ];
        if (sql.includes("FROM school_classrooms c"))
          return [
            [{ id: 11, name: "1", grade_name: "ม.1", academic_year: 2569 }],
          ];
        return [[]];
      },
    },
    async (get) => {
      const all = await (
        await get("/students?mental_from=2026-05-16&mental_to=2026-10-10")
      ).json();
      assert.deepEqual(seen[0].slice(1), [7, "2026-05-16", "2026-10-10"]);
      const [first, second] = all.data;
      assert.equal(first.mental.status, "screening");
      assert.equal(first.mental.risk, "high");
      assert.equal(first.mental.term_label, "ภาคเรียนที่ 1/2569");
      // Taken while the student was still in ม.1, before moving up.
      assert.equal(first.mental.classroom_label, "ม.1 ห้อง 1");
      assert.equal(second.mental.status, "following");
      assert.equal(second.mental.risk, null);
      assert.equal(all.mental_counts.assessed, 1);
      assert.equal(all.mental_counts.not_assessed, 1);
      assert.equal(all.mental_counts.following, 1);

      const filtered = await (
        await get("/students?mental_status=not_assessed")
      ).json();
      assert.deepEqual(
        filtered.data.map((s) => s.id),
        [2],
      );
      assert.equal(
        (await get("/students?mental_from=2026-10-10&mental_to=2026-05-16"))
          .status,
        422,
      );
      assert.equal((await get("/students?mental_status=x")).status, 422);
    },
  );
});

test("a physical-health admin lists students without any mental status", async () => {
  let assessmentReads = 0;
  await withApp(
    {
      roles: true,
      query: async (sql) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("FROM school_staff_roles"))
          return [[{ school_id: 1, role_code: "physical_admin" }]];
        if (sql.includes("ROW_NUMBER()") || sql.includes("form_responses"))
          assessmentReads++;
        if (sql.includes("FROM school_students ss")) return [[student(1, 21)]];
        return [[]];
      },
    },
    async (get) => {
      const body = await (await get("/students")).json();
      assert.equal(body.data.length, 1);
      assert.equal(body.data[0].mental, null);
      assert.equal(body.mental_counts, null);
      assert.equal(body.mental_period.can_view, false);
      assert.equal(assessmentReads, 0);
    },
  );
});
