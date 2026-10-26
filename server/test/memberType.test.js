const test = require("node:test");
const assert = require("node:assert/strict");
const {
  classifyStatusText,
  statusQuestionIds,
  memberTypeSql,
} = require("../services/memberType");

test("a faculty answer makes a university student and keeps the faculty name", () => {
  assert.deepEqual(classifyStatusText("(4) สำนักวิชาวิศวกรรมศาสตร์"), {
    type: "university_student",
    faculty: "สำนักวิชาวิศวกรรมศาสตร์",
  });
  assert.equal(classifyStatusText("นักศึกษา").type, "university_student");
  assert.equal(
    classifyStatusText("ชั้นปีที่ 5 หรือสูงกว่า").type,
    "university_student",
  );
  assert.equal(
    classifyStatusText("บัณฑิตศึกษา (ปริญญาโท-เอก)").type,
    "university_student",
  );
});

test("blank, dash and not-stated answers say nothing", () => {
  for (const value of ["", "-", " – ", "ไม่ระบุ", null, undefined])
    assert.equal(classifyStatusText(value), null);
});

test("any other stated status is general public", () => {
  assert.equal(classifyStatusText("บุคคลทั่วไป").type, "general");
  assert.equal(classifyStatusText("อื่นๆ").type, "general");
  assert.equal(classifyStatusText("นักเรียน").type, "school_student");
  assert.equal(classifyStatusText("ไม่ใช่นักศึกษา มทส.").type, "general");
  assert.equal(classifyStatusText("ไม่ได้เป็นนักศึกษา").type, "general");
});

test("status and faculty questions are found at any depth", () => {
  const ids = statusQuestionIds(
    JSON.stringify([
      { id: 1, type: "text" },
      { id: 2, type: "user_status" },
      { id: 3, type: "section", subQuestions: [{ id: 4, type: "faculty" }] },
      { id: 5, type: "radio", isUserStatus: true },
    ]),
  );
  assert.deepEqual(ids, ["2", "4", "5"]);
  assert.deepEqual(statusQuestionIds("not json"), []);
});

test("the type rule puts an active roster row first and keeps former students", () => {
  const { type } = memberTypeSql("pa");
  const active = type.indexOf("rs.is_active = 1");
  const former = type.indexOf("rs.account_id IS NOT NULL");
  assert.ok(
    active > -1 && former > active,
    "active roster is checked before former roster",
  );
  assert.match(
    type,
    /> rs\.left_at/,
    "a former student changes only after a newer answer",
  );
  assert.match(type, /ELSE 'unknown' END/, "no evidence stays unknown");
});
