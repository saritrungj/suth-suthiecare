const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { serialize } = require("../utils/privateDto");

const decodedFields = [];
require.cache[require.resolve("../utils/privateField")] = {
  exports: {
    readField(value, table, field, org) {
      decodedFields.push({ value, table, field, org });
      return value === "first-fixture" ? "นักเรียนจำลอง" : "ทดสอบ";
    },
  },
};
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async (sql) => {
      if (sql.includes("SELECT id,name FROM schools"))
        return [
          [
            { id: 2, name: "โรงเรียนจำลอง" },
            { id: 4, name: "โรงเรียนอื่น" },
          ],
        ];
      if (sql.includes("FROM school_students ss"))
        return [
          [
            {
              id: 11,
              school_id: 2,
              student_code: "DEMO011",
              prefix: "ด.ช.",
              first_name_encrypted: "first-fixture",
              last_name_encrypted: "last-fixture",
            },
            {
              id: 12,
              school_id: 4,
              student_code: "DEMO012",
              first_name_encrypted: "forbidden",
            },
          ],
        ];
      return [[]];
    },
  },
};

test("guardian student options decode names for the unit's schools only with staff view and retain PII masking", async () => {
  let canManageStaff = true;
  const app = express();
  app.use((req, res, next) => {
    req.schoolAccess = {
      canManageStaff,
      adminSchoolIds: [2],
      staff: { view: canManageStaff },
    };
    req.organizationContext = 9;
    next();
  });
  app.use(require("../routes/schoolInsightRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/staff-roles`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    const body = await response.json();
    // Staff view on the roles page covers every school of the unit.
    assert.deepEqual(
      body.students.map((student) => student.id),
      [11, 12],
    );
    assert.deepEqual(body.students.slice(0, 1), [
      {
        id: 11,
        school_id: 2,
        student_code: "DEMO011",
        prefix: "ด.ช.",
        first_name: "นักเรียนจำลอง",
        last_name: "ทดสอบ",
      },
    ]);
    assert.deepEqual(decodedFields.slice(0, 2), [
      {
        value: "first-fixture",
        table: "school_students",
        field: "first_name_encrypted",
        org: 9,
      },
      {
        value: "last-fixture",
        table: "school_students",
        field: "last_name_encrypted",
        org: 9,
      },
    ]);
    const masked = serialize(body, { pii: false, clinical: false });
    assert.notEqual(masked.students[0].first_name, body.students[0].first_name);
    assert.notEqual(masked.students[0].last_name, body.students[0].last_name);
    const decoded = decodedFields.length;
    canManageStaff = false;
    assert.equal((await fetch(url)).status, 403);
    assert.equal(decodedFields.length, decoded);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
