const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const {
  studentScopeClause,
  canViewStudentHealth,
  canUpdateStudentHealth,
} = require("../utils/schoolAccess");

// Mounts schoolRoutes with a fake db and a fake authorization context, the way
// index.js does after verifyToken + resolveContext.
async function withSchoolApp({ query, context = 7, authorization }, run) {
  const dbPath = require.resolve("../config/db");
  require.cache[dbPath] = {
    exports: {
      query: async (sql, params) =>
        sql.includes("FROM school_staff_roles r") ? [[]] : query(sql, params),
      getConnection: async () => ({}),
    },
  };
  const routerPath = require.resolve("../routes/schoolRoutes");
  delete require.cache[routerPath];
  // audit() lives in the authorization module, which holds its own db handle.
  delete require.cache[require.resolve("../authorization/authorization")];
  const app = express();
  app.use(express.json());
  app.use("/api/school", (req, _res, next) => {
    req.user = { id: 30 };
    req.organizationContext = context;
    req.authorization = authorization;
    next();
  });
  app.use("/api/school", require(routerPath));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await run((path, init) =>
      fetch(`http://127.0.0.1:${port}/api/school${path}`, init),
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const memberAuthorization = (permissions) => ({
  isSystemAdmin: false,
  permissions: new Set(permissions),
});

test("academic year master is school scoped and includes the current year", async () => {
  const { currentAcademicYear } = require("../utils/academicYear");
  const current = currentAcademicYear();
  await withSchoolApp(
    {
      authorization: { isSystemAdmin: true, permissions: new Set() },
      query: async (sql, params) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("FROM school_teachers st")) return [[]];
        if (sql.includes("FROM schools"))
          return [[{ id: 1, organization_id: 7 }]];
        if (sql.includes("term1_starts_on"))
          return [
            [
              {
                school_id: 1,
                academic_year: current,
                term1_starts_on: `${current - 543}-05-16`,
                term1_ends_on: `${current - 543}-10-10`,
                term2_starts_on: `${current - 543}-11-01`,
                term2_ends_on: `${current - 542}-03-31`,
              },
            ],
          ];
        if (sql.includes("FROM school_academic_years")) {
          assert.deepEqual(params, [1, current - 10, 1, current - 10, current]);
          return [[{ academic_year: current + 1 }, { academic_year: current }]];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (request) => {
      const response = await request("/schools/1/academic-years");
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        current_year: current,
        minimum_year: current - 10,
        years: [current + 1, current],
        terms: {
          [current]: {
            term1_starts_on: `${current - 543}-05-16`,
            term1_ends_on: `${current - 543}-10-10`,
            term2_starts_on: `${current - 543}-11-01`,
            term2_ends_on: `${current - 542}-03-31`,
          },
        },
      });
    },
  );
});

test("academic year writes reject old years and duplicates and enforce create permission", async () => {
  const { currentAcademicYear } = require("../utils/academicYear");
  for (const variant of [
    "old",
    "future",
    "duplicate",
    "forbidden",
    "outside",
  ]) {
    let writes = 0;
    await withSchoolApp(
      {
        authorization:
          variant === "forbidden"
            ? memberAuthorization(["school.view"])
            : { isSystemAdmin: true, permissions: new Set() },
        query: async (sql, params) => {
          if (sql.includes("FROM organizations"))
            return [[{ id: 7, org_type: "school", status: "active" }]];
          if (sql.includes("FROM school_teachers st")) return [[]];
          if (sql.includes("FROM schools"))
            return [
              variant === "outside" ? [] : [{ id: 1, organization_id: 7 }],
            ];
          if (sql.includes("INSERT INTO school_academic_years")) {
            writes++;
            assert.deepEqual(params, [1, currentAcademicYear() + 1]);
            if (variant === "duplicate")
              throw Object.assign(new Error("duplicate"), {
                code: "ER_DUP_ENTRY",
              });
            return [{ affectedRows: 1 }];
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      },
      async (request) => {
        const response = await request("/schools/1/academic-years", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            academic_year:
              currentAcademicYear() + (variant === "old" ? -11 : 1),
          }),
        });
        assert.equal(
          response.status,
          {
            old: 422,
            future: 201,
            duplicate: 409,
            forbidden: 403,
            outside: 404,
          }[variant],
        );
        assert.equal(writes, ["future", "duplicate"].includes(variant) ? 1 : 0);
      },
    );
  }
});

test("school surname disclosure excludes first names and respects PII and classroom scope", async () => {
  const { writeField } = require("../utils/privateField");
  for (const variant of ["allowed", "no_pii", "other_classroom"]) {
    let studentReads = 0;
    await withSchoolApp(
      {
        authorization: memberAuthorization(
          variant === "no_pii"
            ? ["students.view"]
            : variant === "other_classroom"
              ? ["students.view", "pii.view"]
              : ["students.view", "pii.view"],
        ),
        query: async (sql, params) => {
          if (sql.includes("FROM organizations"))
            return [[{ id: 7, org_type: "school", status: "active" }]];
          if (sql.includes("FROM school_teachers st"))
            return [
              variant === "other_classroom" ? [{ id: 4, school_id: 1 }] : [],
            ];
          if (sql.includes("FROM school_classroom_teachers"))
            return [[{ classroom_id: 11 }]];
          if (sql.includes("FROM school_students ss")) {
            studentReads++;
            assert.deepEqual(params, [1, 7]);
            return [
              [
                {
                  id: 1,
                  school_id: 1,
                  classroom_id: 99,
                  first_name_encrypted: writeField(
                    "สมชาย",
                    "school_students",
                    "first_name_encrypted",
                    7,
                  ),
                  last_name_encrypted: writeField(
                    "ใจดี",
                    "school_students",
                    "last_name_encrypted",
                    7,
                  ),
                },
              ],
            ];
          }
          throw new Error(`Unexpected SQL: ${sql}`);
        },
      },
      async (get) => {
        const response = await get("/students/1/last-name");
        assert.equal(
          response.status,
          variant === "allowed" ? 200 : variant === "no_pii" ? 403 : 404,
        );
        if (variant === "allowed") {
          assert.deepEqual(await response.json(), { last_name: "ใจดี" });
          assert.equal(response.headers.get("cache-control"), "no-store");
        }
        if (variant === "no_pii") assert.equal(studentReads, 0);
      },
    );
  }
});

test("refuses an organization that is not a school", async () => {
  await withSchoolApp(
    {
      authorization: memberAuthorization(["students.view"]),
      query: async (sql) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "hospital", status: "active" }]];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (get) => {
      const response = await get("/students");
      assert.equal(response.status, 422);
    },
  );
});

test("refuses the all-organizations context", async () => {
  await withSchoolApp(
    {
      context: "all",
      authorization: { isSystemAdmin: true },
      query: async (sql) => {
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (get) => {
      assert.equal((await get("/access")).status, 422);
    },
  );
});

test("a teacher with students.view but no school role only sees their own classrooms", async () => {
  let studentSql;
  let studentParams;
  await withSchoolApp(
    {
      authorization: memberAuthorization(["students.view"]),
      query: async (sql, params) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("FROM school_teachers st"))
          return [[{ id: 4, school_id: 2 }]];
        if (sql.includes("FROM school_classroom_teachers"))
          return [[{ classroom_id: 11 }, { classroom_id: 12 }]];
        if (sql.includes("FROM school_students ss")) {
          studentSql = sql;
          studentParams = params;
          return [[]];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (get) => {
      const access = await (await get("/access")).json();
      assert.equal(access.is_teacher, true);
      assert.equal(access.can_view_all_students, false);
      assert.deepEqual(access.classroom_ids, [11, 12]);
      const response = await get("/students");
      assert.equal(response.status, 200);
      assert.match(studentSql, /ss\.classroom_id IN \(\?\)/);
      assert.deepEqual(studentParams.at(-1), [11, 12]);
    },
  );
});

test("staff who are neither teachers nor permitted get no students", async () => {
  await withSchoolApp(
    {
      authorization: memberAuthorization(["school.view"]),
      query: async (sql) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("FROM school_teachers st")) return [[]];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (get) => {
      assert.equal((await get("/students")).status, 403);
      assert.equal((await get("/cases")).status, 403);
    },
  );
});

test("health access requires a stable role, never a classroom assignment alone", () => {
  const student = { school_id: 2, classroom_id: 10 };
  const teacher = {
    isTeacher: true,
    classroomIds: [10],
    healthClassroomIds: [],
    counselorSchoolIds: [],
  };
  assert.equal(canViewStudentHealth(teacher, student), false);
  assert.equal(canUpdateStudentHealth(teacher, student), false);
  const homeroom = {
    ...teacher,
    healthClassroomIds: [10],
    homeroomSchoolIds: [2],
  };
  assert.equal(canViewStudentHealth(homeroom, student), true);
  assert.equal(
    canUpdateStudentHealth(homeroom, { school_id: 2, classroom_id: 11 }),
    false,
  );
  assert.equal(
    canViewStudentHealth({ ...teacher, counselorSchoolIds: [2] }, student),
    true,
  );
  assert.equal(
    canViewStudentHealth({ ...teacher, counselorSchoolIds: [3] }, student),
    false,
  );
  assert.equal(canViewStudentHealth({ isSystemAdmin: true }, student), true);
});

test("the school sub-unit is the school: created on first use with a generated code", async () => {
  const inserted = [];
  await withSchoolApp(
    {
      authorization: memberAuthorization(["school.view"]),
      query: async (sql, params) => {
        if (sql.includes("org_type, status FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("SELECT id, name FROM organizations"))
          return [[{ id: 7, name: "โรงเรียนสุรวิวัฒน์" }]];
        if (sql.includes("FROM school_teachers st")) return [[]];
        if (sql.includes("FROM schools WHERE organization_id")) return [[]];
        if (sql.startsWith("INSERT INTO schools")) {
          inserted.push(params);
          return [{ insertId: 5 }];
        }
        if (sql.startsWith("SHOW TABLES")) return [[]]; // audit log disabled
        if (sql.includes("FROM schools WHERE id"))
          return [[{ id: 5, code: "SC007", name: "โรงเรียนสุรวิวัฒน์" }]];
        if (sql.includes("FROM schools s WHERE s.id"))
          return [
            [{ id: params[0], code: "SC007", name: "โรงเรียนสุรวิวัฒน์" }],
          ];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (get) => {
      const response = await get("/schools");
      assert.equal(response.status, 200);
      const rows = await response.json();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, 5);
      assert.deepEqual(inserted, [[7, "SC007", "โรงเรียนสุรวิวัฒน์"]]);
    },
  );
});

test("a room added without a name gets the next number in its grade and year", async () => {
  let insertParams;
  await withSchoolApp(
    {
      authorization: memberAuthorization(["school.create"]),
      query: async (sql, params) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("FROM school_teachers st")) return [[]];
        if (sql.includes("FROM schools WHERE id = ? AND organization_id"))
          return [[{ id: 5, organization_id: 7 }]];
        if (sql.includes("FROM school_grade_levels g JOIN schools"))
          return [[{ id: 3, school_id: 5 }]];
        if (sql.includes("SELECT name FROM school_classrooms"))
          return [[{ name: "1" }, { name: "3" }]];
        if (sql.startsWith("INSERT INTO school_classrooms")) {
          insertParams = params;
          return [{ insertId: 40 }];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (request) => {
      const response = await request("/schools/5/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade_level_id: 3, academic_year: 2569 }),
      });
      assert.equal(response.status, 201);
      assert.deepEqual(await response.json(), { id: 40, name: "2" });
      assert.deepEqual(insertParams, [5, 3, "2", 2569, null, "active"]);
    },
  );
});

test("teaching a class alone grants no student access without students.view on the roles page", async () => {
  await withSchoolApp(
    {
      authorization: memberAuthorization([]),
      query: async (sql) => {
        if (sql.includes("FROM organizations"))
          return [[{ id: 7, org_type: "school", status: "active" }]];
        if (sql.includes("FROM school_teachers st"))
          return [[{ id: 4, school_id: 2 }]];
        if (sql.includes("FROM school_classroom_teachers"))
          return [[{ classroom_id: 11 }]];
        throw new Error(`Unexpected SQL: ${sql}`);
      },
    },
    async (get) => {
      assert.equal((await get("/students")).status, 403);
    },
  );
});
