const test = require("node:test");
const assert = require("node:assert/strict");
const { upsertSchoolTeacher } = require("../utils/schoolTeachers");

const recorder = () => {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      return [{ insertId: 9 }];
    },
  };
};

test("a full teacher write sets every field and reactivates an old row", async () => {
  const db = recorder();
  const id = await upsertSchoolTeacher(db, {
    schoolId: 1,
    userId: 2,
    teacherTypeId: 3,
    employeeCode: "T1",
    position: "ครู",
    phoneEncrypted: null,
  });
  assert.equal(id, 9);
  const { sql, params } = db.calls[0];
  assert.match(
    sql,
    /INSERT INTO school_teachers \(school_id,user_id,teacher_type_id,employee_code,position,phone_encrypted,status\)/,
  );
  assert.match(sql, /status=VALUES\(status\)/);
  assert.deepEqual(params, [1, 2, 3, "T1", "ครู", null, "active"]);
});

test("fields left undefined keep their stored value", async () => {
  const db = recorder();
  await upsertSchoolTeacher(db, { schoolId: 1, userId: 2, employeeCode: "T2" });
  const { sql, params } = db.calls[0];
  assert.doesNotMatch(sql, /teacher_type_id|position|phone_encrypted/);
  assert.deepEqual(params, [1, 2, "T2", "active"]);
});
