const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ test: "11".repeat(32) });
process.env.DATA_ENCRYPTION_ACTIVE_KEY = "test";
const mental = require("../services/studentMentalStatus");

const terms2569 = new Map([
  [
    2569,
    {
      term1_starts_on: "2026-05-16",
      term1_ends_on: "2026-10-10",
      term2_starts_on: "2026-11-01",
      term2_ends_on: "2027-03-31",
    },
  ],
]);

test("assessments are filed under the school's own semesters", () => {
  assert.deepEqual(mental.termOf("2026-06-01", terms2569), {
    academic_year: 2569,
    semester: 1,
  });
  // January belongs to semester 2 of the academic year that began in May.
  assert.deepEqual(mental.termOf("2027-01-20", terms2569), {
    academic_year: 2569,
    semester: 2,
  });
  // Between semesters, and in years without dates, only the year is known.
  assert.deepEqual(mental.termOf("2026-10-20", terms2569), {
    academic_year: 2569,
    semester: null,
  });
  assert.deepEqual(mental.termOf("2025-07-01", terms2569), {
    academic_year: 2568,
    semester: null,
  });
  assert.equal(
    mental.termLabel({ academic_year: 2569, semester: 2 }),
    "ภาคเรียนที่ 2/2569",
  );
});

test("the class at an assessment follows the class-change history", () => {
  const history = [
    {
      changed_at: "2026-05-10T08:00:00+07:00",
      from_classroom_id: 11,
      to_classroom_id: 21,
    },
    {
      changed_at: "2027-05-10T08:00:00+07:00",
      from_classroom_id: 21,
      to_classroom_id: 31,
    },
  ];
  // Before the first move the student was in the class it moved from (ม.1).
  assert.equal(
    mental.classroomAt("2026-01-05T09:00:00+07:00", history, 31),
    11,
  );
  assert.equal(
    mental.classroomAt("2026-08-05T09:00:00+07:00", history, 31),
    21,
  );
  assert.equal(
    mental.classroomAt("2027-08-05T09:00:00+07:00", history, 31),
    31,
  );
  assert.equal(mental.classroomAt("2026-08-05T09:00:00+07:00", [], 31), 31);
});

test("care steps keep their history and closing ends the step", () => {
  const events = [
    { id: 1, status: "counselor_referral", effective_on: "2026-06-01" },
    { id: 2, status: "hospital_referral", effective_on: "2026-07-01" },
    { id: 3, status: "closed", effective_on: "2026-09-01" },
  ];
  assert.equal(
    mental.careStateAt(events, "2026-06-15").status,
    "counselor_referral",
  );
  assert.equal(
    mental.careStateAt(events, "2026-08-01").status,
    "hospital_referral",
  );
  assert.equal(mental.careStateAt(events, "2026-10-01"), null);
  assert.equal(mental.primaryStatus({ risk: "high", care: null }), "screening");
  assert.equal(
    mental.primaryStatus({ risk: "normal", care: null }),
    "no_screening",
  );
  assert.equal(
    mental.primaryStatus({ risk: null, care: null }),
    "not_assessed",
  );
  assert.equal(
    mental.primaryStatus({ risk: "normal", care: { status: "following" } }),
    "following",
  );
  const summary = { risk: "medium", care_status: "following" };
  for (const status of ["assessed", "screening", "following"])
    assert.equal(mental.matchesStatus(summary, status), true, status);
  for (const status of ["not_assessed", "no_screening", "hospital_referral"])
    assert.equal(mental.matchesStatus(summary, status), false, status);
  // Students whose mental status the caller may not see match no status.
  assert.equal(mental.matchesStatus(null, "not_assessed"), false);
});

test("semester dates must be complete, ordered and inside the academic year", () => {
  const good = {
    term1_starts_on: "2026-05-16",
    term1_ends_on: "2026-10-10",
    term2_starts_on: "2026-11-01",
    term2_ends_on: "2027-03-31",
  };
  assert.deepEqual(mental.validateTerms(good, 2569).value, good);
  assert.deepEqual(Object.values(mental.validateTerms({}, 2569).value), [
    null,
    null,
    null,
    null,
  ]);
  for (const bad of [
    { ...good, term2_ends_on: "" },
    { ...good, term1_ends_on: "2026-11-05" },
    { ...good, term1_starts_on: "2026-10-20" },
    { ...good, term1_starts_on: "2024-05-16" },
    { ...good, term2_ends_on: "31/03/2570" },
  ])
    assert.equal(mental.validateTerms(bad, 2569).error, true);
});

// --- Recording a care step -------------------------------------------------
test("care steps need a health update right in scope, are encrypted and audited", async () => {
  let scope;
  const writes = [];
  const audits = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
    query: async (sql, values) => {
      writes.push({ sql, values });
      return [{ insertId: 5 }];
    },
  };
  require.cache[require.resolve("../config/db")] = {
    exports: {
      getConnection: async () => connection,
      query: async (sql) => {
        if (sql.includes("FROM school_students"))
          return [[{ id: 1, school_id: 2, classroom_id: 10 }]];
        if (sql.includes("FROM school_academic_years")) return [[]];
        return [[]];
      },
    },
  };
  require.cache[require.resolve("../utils/pdpaAudit")] = {
    exports: { requiredAudit: async (...args) => audits.push(args) },
  };
  delete require.cache[require.resolve("../routes/schoolInsightRoutes")];
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
    require("../routes/schoolInsightRoutes"),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const post = (body) =>
    fetch(
      `http://127.0.0.1:${server.address().port}/school/students/1/care-status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  const valid = {
    status: "hospital_referral",
    effective_on: "2026-10-01",
    note: "ส่งต่อ รพ. ตามนัด",
  };
  try {
    // A subject teacher who only teaches the class cannot record care.
    scope = {
      isTeacher: true,
      classroomIds: [10],
      healthClassroomIds: [],
      counselorSchoolIds: [],
      health: { update: true },
    };
    assert.equal((await post(valid)).status, 404);
    // A counselor of the school without the update right on the roles page.
    scope = { counselorSchoolIds: [2], health: { view: true } };
    assert.equal((await post(valid)).status, 404);
    assert.equal(writes.length, 0);

    scope = { counselorSchoolIds: [2], health: { view: true, update: true } };
    assert.equal((await post({ ...valid, status: "done" })).status, 422);
    assert.equal(
      (await post({ ...valid, effective_on: "2999-01-01" })).status,
      422,
    );
    assert.equal(writes.length, 0);

    const ok = await post(valid);
    assert.equal(ok.status, 201);
    const insert = writes.find((w) =>
      w.sql.includes("INSERT INTO school_student_care_statuses"),
    );
    assert.ok(insert);
    assert.deepEqual(insert.values.slice(0, 7), [
      2,
      1,
      "hospital_referral",
      "2026-10-01",
      2569,
      null,
      10,
    ]);
    // The note is sealed, never stored or audited in clear text.
    assert.ok(!String(insert.values[7]).includes("ส่งต่อ"));
    assert.equal(audits.length, 1);
    assert.equal(audits[0][1], "student_care_status.create");
    assert.deepEqual(audits[0][4], { status: "hospital_referral" });
  } finally {
    await new Promise((r) => server.close(r));
  }
});
