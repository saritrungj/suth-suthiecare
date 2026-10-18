const test = require("node:test");
const assert = require("node:assert/strict");
const { exportDisplayContext } = require("../services/exportDisplayContext");

test("export display resolves only metadata referenced by authorized rows and keeps organization-specific labels", async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes("FROM schools"))
        return [[{ id: 2, label: "โรงเรียนจำลอง", organization_id: 3 }]];
      if (sql.includes("FROM roles"))
        return [[{ id: 4, label: "ผู้ประสานงาน" }]];
      if (sql.includes("FROM clinics"))
        return [[{ slug: "general", name: "คลินิกทั่วไป" }]];
      if (sql.includes("master_data_options"))
        return [
          [
            {
              organization_id: 3,
              category: "student_status",
              code: "active",
              label: "ศึกษาอยู่",
            },
          ],
        ];
      throw Error("Unexpected metadata lookup");
    },
  };
  const context = await exportDisplayContext(
    { organizationContext: 3, authorization: { permissions: new Set() } },
    [
      {
        resource: "students",
        data: [
          {
            id: 8,
            school_id: 2,
            role_id: 4,
            status: "active",
            clinic_type: "general",
            recorded_by: 9,
          },
        ],
      },
    ],
    db,
  );
  assert.equal(context.lookups.school_id[2], "โรงเรียนจำลอง");
  assert.equal(context.lookups.role_id[4], "ผู้ประสานงาน");
  assert.equal(context.options[0].label, "ศึกษาอยู่");
  assert.equal(context.clinics.general, "คลินิกทั่วไป");
  assert.equal(context.lookups.recorded_by, undefined);
  assert.equal(
    calls.some((call) =>
      /patient_accounts|form_responses|FROM users/.test(call.sql),
    ),
    false,
  );
  assert.deepEqual(
    calls.find((call) => call.sql.includes("FROM schools")).params,
    [[2]],
  );
  assert.deepEqual(
    calls.find((call) => call.sql.includes("FROM clinics")).params,
    [["general"], 3],
  );
});

test(
  "local MySQL resolves export metadata using the actual schema",
  {
    skip: process.env.SCHOOL_DB_TESTS !== "1",
    timeout: 15000,
  },
  async () => {
    const db = require("../config/db");
    try {
      const [[org]] = await db.query(
        "SELECT id FROM organizations WHERE org_type='school' AND status='active' LIMIT 1",
      );
      assert.ok(org);
      const context = await exportDisplayContext(
        { organizationContext: org.id, authorization: { isSystemAdmin: true } },
        [
          {
            resource: "students",
            data: [
              {
                organization_id: org.id,
                school_id: 1,
                classroom_id: 1,
                grade_level_id: 1,
                student_type_id: 1,
                teacher_type_id: 1,
                role_id: 1,
                form_id: 1,
                clinic_id: 1,
                clinic_type: "general",
              },
            ],
          },
        ],
        db,
      );
      assert.ok(context.lookups);
      assert.ok(Array.isArray(context.options));
    } finally {
      await db.end();
    }
  },
);
