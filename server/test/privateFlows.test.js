require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict");
const { saveCaseLog } = require("../services/caseLogService");
const { createAppointment } = require("../services/appointmentService");
const { decrypt } = require("../utils/encryption");
const {
  resolveInvitation,
  consumeInvitation,
  hash,
} = require("../services/formInvitationService");
test.after(() => require("../config/db").end());
function database({
  foreignMaster = false,
  foreignReference = false,
  auditFailure = false,
} = {}) {
  const state = { calls: [], commits: 0, rollbacks: 0 };
  const c = {
    beginTransaction: async () => {},
    commit: async () => {
      state.commits++;
    },
    rollback: async () => {
      state.rollbacks++;
    },
    release: () => {},
    query: async (sql, params) => {
      state.calls.push({ sql, params });
      if (sql.startsWith("SELECT fr.id"))
        return [
          [
            {
              id: 9,
              master_case_id: 10,
              organization_id: 1,
              master_organization_id: foreignMaster ? 2 : 1,
            },
          ],
        ];
      if (sql.startsWith("SELECT id FROM "))
        return [foreignReference ? [] : [{ id: 1 }]];
      if (sql.startsWith("SELECT fullname")) return [[{ fullname: "staff" }]];
      if (sql.startsWith("SELECT id,name FROM case_statuses"))
        return [[{ id: 1, name: params[1] }]];
      if (
        sql.startsWith("INSERT INTO authorization_audit_logs") &&
        auditFailure
      )
        throw new Error("synthetic");
      return [{ insertId: 55, affectedRows: 1 }];
    },
  };
  return { state, c, db: { getConnection: async () => c } };
}
const request = (body) => ({
  organizationContext: 1,
  params: { id: 9 },
  query: {},
  body: { type: "note", detail: "sensitive health", ...body },
  user: { id: 7 },
  authorization: { user: { name: "verified actor" } },
});
test("case logs derive the master from the scoped response and reject forged master/foreign keys", async () => {
  for (const [options, body, code] of [
    [{}, { master_case_id: 999 }, "MASTER_CASE_MISMATCH"],
    [{ foreignMaster: true }, {}, "CASE_OWNER_MISMATCH"],
    [
      { foreignReference: true },
      { staff_id: 2 },
      "REFERENCE_OUTSIDE_ORGANIZATION",
    ],
  ]) {
    const { db, state } = database(options);
    await assert.rejects(saveCaseLog(db, request(body)), { code });
    assert.equal(state.commits, 0);
    assert.equal(state.rollbacks, 1);
    assert.equal(
      state.calls.some((call) => call.sql.startsWith("INSERT INTO case_logs")),
      false,
    );
  }
  const { db, state } = database();
  await saveCaseLog(
    db,
    request({ staff: "forged actor", patient_visible: true }),
  );
  const log = state.calls.find((call) =>
    call.sql.startsWith("INSERT INTO case_logs"),
  );
  assert.equal(log.params[1], 10);
  assert.equal(decrypt(log.params[3]), "verified actor");
  assert.equal(decrypt(log.params[5]), "sensitive health");
  assert.equal(log.params[7], 1);
  assert.equal(state.commits, 1);
});
test("required audit failure rolls back the complete log transaction", async () => {
  const { db, state } = database({ auditFailure: true });
  await assert.rejects(saveCaseLog(db, request({ risk_level: "high" })), {
    status: 503,
  });
  assert.equal(state.commits, 0);
  assert.equal(state.rollbacks, 1);
});
test("appointments cannot combine two otherwise accessible unrelated cases", async () => {
  const { db, state } = database();
  await assert.rejects(
    createAppointment(
      db,
      request({
        case_id: 9,
        master_case_id: 999,
        appointment_date: "2026-10-03",
      }),
    ),
    { code: "MASTER_CASE_MISMATCH" },
  );
  assert.equal(state.commits, 0);
});
const invitation = {
  id: 1,
  form_id: 2,
  organization_id: 3,
  response_id: 4,
  master_case_id: 5,
  patient_account_id: 6,
  current_patient_id: 6,
  current_master_case_id: 5,
  current_organization_id: 3,
  form_organization_id: 3,
  master_status: "Open",
  expires_at: new Date(Date.now() + 60000),
};
test("invitation validates login, receiver, expiry, revocation, reuse and binding without consuming on open", async () => {
  const token = "a".repeat(43);
  let calls = 0;
  const c = {
    query: async (sql) => {
      calls++;
      assert.match(sql, /SELECT i/);
      return [[invitation]];
    },
  };
  assert.equal(hash(token).length, 64);
  assert.equal((await resolveInvitation(c, token, { id: 6 }, 2)).id, 1);
  assert.equal(calls, 1);
  await assert.rejects(resolveInvitation(c, token, null, 2), { status: 401 });
  await assert.rejects(resolveInvitation(c, token, { id: 7 }, 2), {
    status: 403,
  });
  await assert.rejects(resolveInvitation(c, token, { id: 6 }, 99), {
    status: 410,
  });
  for (const change of [
    { expires_at: new Date(0) },
    { consumed_at: new Date() },
    { revoked_at: new Date() },
    { current_organization_id: 77 },
    { current_master_case_id: 99 },
  ])
    await assert.rejects(
      resolveInvitation(
        { query: async () => [[{ ...invitation, ...change }]] },
        token,
        { id: 6 },
        2,
      ),
      { status: 410 },
    );
  await assert.rejects(
    resolveInvitation(c, "suthenc:v1:ciphertext", { id: 6 }, 2),
    { status: 410 },
  );
  await assert.rejects(
    consumeInvitation(
      { query: async () => [{ affectedRows: 0 }] },
      invitation,
      8,
    ),
    { status: 409 },
  );
});
