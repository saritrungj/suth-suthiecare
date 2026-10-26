const test = require("node:test");
const assert = require("node:assert/strict");
const {
  pendingTasksForPatient,
  completeTasksForResponse,
} = require("../services/schoolRescreen");

const fakeConnection = (result) => {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [result];
    },
  };
};

test("student task list shows the form and due date only, never the source or risk", async () => {
  const connection = fakeConnection([
    {
      id: 4,
      target_form_id: 9,
      due_on: "2000-01-02",
      title: "แบบคัดกรองซ้ำ",
      status: "published",
      publish_start_date: null,
      publish_end_date: null,
      source_response_id: 77,
    },
    {
      id: 5,
      target_form_id: 10,
      due_on: "2999-01-02",
      title: "ฉบับร่าง",
      status: "draft",
    },
  ]);
  const tasks = await pendingTasksForPatient(connection, 12);
  assert.deepEqual(connection.calls[0].params, [12, 12]);
  assert.match(connection.calls[0].sql, /t\.status = 'pending'/);
  assert.match(connection.calls[0].sql, /ss\.archived_at IS NULL/);
  assert.deepEqual(tasks, [
    {
      id: 4,
      form_id: 9,
      title: "แบบคัดกรองซ้ำ",
      due_on: "2000-01-02",
      overdue: true,
      available: true,
    },
    {
      id: 5,
      form_id: 10,
      title: "ฉบับร่าง",
      due_on: "2999-01-02",
      overdue: false,
      available: false,
    },
  ]);
});

test("a submission closes pending tasks for the same form, student and organization", async () => {
  const connection = fakeConnection({ affectedRows: 1 });
  const closed = await completeTasksForResponse(connection, {
    formId: 9,
    organizationId: 3,
    responseId: 101,
    personId: 55,
    patientAccountId: null,
  });
  assert.equal(closed, 1);
  const { sql, params } = connection.calls[0];
  assert.match(sql, /UPDATE school_rescreen_tasks/);
  assert.match(sql, /t\.status = 'pending' AND t\.target_form_id = \?/);
  assert.match(sql, /s\.organization_id = \?/);
  // A follow-up task made in the student file has no source response; it
  // must still close (NULL <> 101 is never true in SQL).
  assert.match(
    sql,
    /\(t\.source_response_id IS NULL OR t\.source_response_id <> \?\)/,
  );
  assert.deepEqual(params, [101, 9, 3, 101, 55, 0]);
});

test("an anonymous submission never closes a task", async () => {
  const connection = fakeConnection({ affectedRows: 0 });
  const closed = await completeTasksForResponse(connection, {
    formId: 9,
    organizationId: 3,
    responseId: 101,
    personId: null,
    patientAccountId: null,
  });
  assert.equal(closed, 0);
  assert.equal(connection.calls.length, 0);
});
