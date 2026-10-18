const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
process.env.DATA_ENCRYPTION_KEYS = JSON.stringify({ test: "11".repeat(32) });
process.env.DATA_ENCRYPTION_ACTIVE_KEY = "test";
let reads = 0,
  writes = [],
  audits = [],
  scope,
  guidanceRows = [];
const connection = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release() {},
  query: async (sql, values) => {
    writes.push({ sql, values });
    return [{ insertId: 8 }];
  },
};
require.cache[require.resolve("../config/db")] = {
  exports: {
    getConnection: async () => connection,
    query: async (sql, params) => {
      if (sql.includes("FROM school_students"))
        return [
          params[1] === 7 ? [{ id: 1, school_id: 2, classroom_id: 10 }] : [],
        ];
      if (sql.includes("FROM school_student_insights")) {
        reads++;
        return [[]];
      }
      if (sql.includes("FROM school_guidance_records")) {
        reads++;
        return [guidanceRows];
      }
      reads++;
      return [[]];
    },
  },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: { requiredAudit: async (...args) => audits.push(args) },
};
const { readJson, sealText, fieldContext } = require("../utils/privateData");
const { writeField } = require("../utils/privateField");
test("insight endpoints deny before private reads and encrypt permitted optional data", async () => {
  const app = express();
  app.use(express.json());
  app.use(
    "/school",
    (req, res, next) => {
      req.user = { id: 5 };
      req.organizationContext = 7;
      req.schoolAccess = scope;
      next();
    },
    require("../routes/schoolInsightRoutes"),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}/school/students/1`;
  try {
    scope = {
      isTeacher: true,
      classroomIds: [10],
      healthClassroomIds: [],
      counselorSchoolIds: [],
    };
    reads = 0;
    assert.equal((await fetch(url + "/insights")).status, 404);
    assert.equal(reads, 0);
    assert.equal(
      (
        await fetch(url + "/guidance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recorded_at: "2026-10-12", issue: "private" }),
        })
      ).status,
      404,
    );
    assert.equal(writes.length, 0);
    // Counselor whose unit role holds health create (written by the migration).
    scope = { counselorSchoolIds: [2], health: { create: true } };
    guidanceRows = [
      {
        id: 3,
        recorded_at: "2026-10-14",
        follow_up_at: "2026-10-21",
        recorded_by: 5,
        recorded_by_name_encrypted: writeField(
          "ครู สมใจ ดูแล",
          "users",
          "name",
        ),
        payload_encrypted: sealText(
          { issue: "ติดตามการปรับตัว", support: "นัดพูดคุย" },
          fieldContext("school_guidance_records", "payload_encrypted", 7),
        ),
      },
    ];
    const insightResponse = await fetch(url + "/insights");
    assert.equal(insightResponse.status, 200);
    const insight = await insightResponse.json();
    assert.equal(insight.records[0].recorded_by_name, "ครู สมใจ ดูแล");
    assert.equal(insight.records[0].issue, "ติดตามการปรับตัว");
    const body = { guardian_name: "ผู้ปกครองทดสอบ" };
    assert.equal(
      (
        await fetch(url + "/insights", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      ).status,
      200,
    );
    const saved = writes.at(-1).values[1];
    assert.ok(!saved.includes(body.guardian_name));
    assert.equal(
      readJson(
        saved,
        fieldContext("school_student_insights", "payload_encrypted", 7),
      ).guardian_name,
      body.guardian_name,
    );
    assert.throws(() =>
      readJson(
        saved,
        fieldContext("school_student_insights", "payload_encrypted", 8),
      ),
    );
    assert.ok(
      !JSON.stringify(audits.map((a) => a.slice(1, 5))).includes(
        body.guardian_name,
      ),
    );
    assert.equal(
      (
        await fetch(url + "/guidance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recorded_at: "2026-02-30", issue: "private" }),
        })
      ).status,
      422,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});
