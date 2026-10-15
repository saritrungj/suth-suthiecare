const test = require("node:test");
const assert = require("node:assert/strict");
const { newestActivity, attachCaseActivities, schoolActivities } = require("../services/latestActivity");
const { serialize } = require("../utils/privateDto");

test("activities use time then id and ignore invalid dates", () => {
  const a = { id: 1, occurred_at: "2026-10-08T10:00:00Z" };
  const b = { ...a, id: 2 };
  assert.equal(newestActivity([a, b, { id: 99, occurred_at: "invalid" }]), b);
  assert.equal(newestActivity([]), null);
});

test("case activities are batched and separated by organization and master", async () => {
  let calls = 0;
  const rows = [
    { id: 1, organization_id: 7, master_case_id: 10 },
    { id: 2, organization_id: 7, master_case_id: 10 },
    { id: 3, organization_id: 8, master_case_id: 11 },
    { id: 4, organization_id: 7, master_case_id: null },
    { id: 5, organization_id: 7, master_case_id: 12 },
  ];
  const db = { query: async (sql, params) => {
    calls++;
    assert.match(sql, /mc.id=fr.master_case_id/);
    assert.match(sql, /ORDER BY l.created_at DESC,l.id DESC/);
    assert.doesNotMatch(sql, /l.detail|l.staff/);
    assert.deepEqual(params, [7, 10, 8, 11, 7, 4, 7, 12]);
    return [[
      { id: 8, organization_id: 8, master_case_id: 11, response_id: 3, type: "appoint", created_at: "2026-10-08" },
      { id: 7, organization_id: 7, master_case_id: 10, response_id: 2, type: "note", created_at: "2026-10-08" },
      { id: 6, organization_id: 7, master_case_id: 10, response_id: 1, type: "status", created_at: "2026-10-07" },
      { id: 5, organization_id: 7, master_case_id: null, response_id: 4, type: "status", created_at: "2026-10-07" },
    ]];
  } };
  const result = await attachCaseActivities(db, rows);
  assert.equal(calls, 1);
  assert.equal(result[0].latest_activity.type, "note");
  assert.deepEqual(result[0].latest_activity, result[1].latest_activity);
  assert.equal(result[2].latest_activity.type, "appoint");
  assert.equal(result[3].latest_activity.type, "status");
  assert.equal(result[4].latest_activity, null);
});

test("school activity selects actual latest assessment, physical record or referral", async () => {
  const db = { query: async (sql, params) => {
    assert.match(sql, /sch.organization_id=\?/);
    assert.match(sql, /r.source_organization_id=fr.organization_id/);
    assert.doesNotMatch(sql, /reason_encrypted|note_encrypted|detail/);
    assert.deepEqual(params, [7, [1, 2], 7, [1, 2], 7, [1, 2]]);
    return [[
      { student_id: 1, id: 2, type: "assessment", title: "แบบประเมิน", occurred_at: "2026-10-01" },
      { student_id: 1, id: 3, type: "physical", title: "ผลตรวจ", occurred_at: "2026-10-02" },
      { student_id: 1, id: 4, type: "referral", title: "ส่งต่อ", occurred_at: "2026-10-03" },
    ]];
  } };
  const result = await schoolActivities(db, 7, [{ id: 1 }, { id: 2 }]);
  assert.deepEqual(result.get(1), { type: "referral", title: "ส่งต่อ", occurred_at: "2026-10-03" });
  assert.equal(result.get(2), undefined);
});

test("case list projection keeps activity metadata and excludes clinical details", () => {
  const latest_activity = { type: "note", title: "บันทึกการติดตาม", occurred_at: "2026-10-08" };
  const result = serialize({ id: 1, summary_data: {}, latest_activity, detail: "private note" }, { list: true });
  assert.deepEqual(result.latest_activity, latest_activity);
  assert.equal(result.detail, undefined);
});

test("empty queues do not query the database", async () => {
  const db = { query: () => { throw new Error("should not query"); } };
  assert.deepEqual(await attachCaseActivities(db, []), []);
  assert.equal((await schoolActivities(db, 7, [])).size, 0);
});

test("manual entry source survives decryption and case-list projection", () => {
  const { decryptCaseResponse } = require("../utils/decryptCaseData");
  const response = decryptCaseResponse({ id: 1, summary_data: JSON.stringify({ case_source: "walkin" }) }, (value) => value);
  const result = serialize(response, { list: true });
  assert.equal(result.case_source, "walkin");
  assert.equal(result.summary_data.case_source, "walkin");
});

test("queue first names are metadata only and account names are a fallback", async () => {
  const rows = [
    { id: 1, organization_id: 7, summary_data: { display_name: "นาย สมชาย ใจดี" } },
    { id: 2, organization_id: 7, summary_data: { display_name: "-" }, submitted_by: { display_name: "ปิติ วงศ์ดี" } },
    { id: 3, organization_id: 7, summary_data: {} },
  ];
  const result = await attachCaseActivities({ query: async () => [[]] }, rows);
  assert.deepEqual(result.map(row => row.first_name), ["สมชาย", "ปิติ", null]);
  const dto = serialize(result, { pii: true, list: true, caseNames: true });
  assert.equal(dto[0].first_name, "สมชาย");
  assert.equal(dto[0].summary_data.display_name, "น***");
  assert.equal(serialize(result, { list: true, caseNames: true })[0].first_name, "ส***");
  assert.equal(serialize(result, { pii: true, list: true })[0].first_name, "ส***");
});
