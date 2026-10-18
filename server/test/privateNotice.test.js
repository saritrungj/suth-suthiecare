const test = require("node:test"),
  assert = require("node:assert/strict");
const { approveNotice } = require("../services/privacyNoticeService");
const {
  getProcessingNotice,
  STANDARD_NOTICE,
} = require("../services/privacyNoticeService");

test("forms without configuration use the same fixed notice in read and submit flows", async () => {
  const calls = [];
  const db = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[]];
    },
  };
  assert.deepEqual(await getProcessingNotice(db, 2, 1), STANDARD_NOTICE);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [2, 1]);
  assert.match(calls[0].sql, /approved_at IS NOT NULL/);
  assert.equal(
    calls.some((c) => /INSERT|UPDATE/.test(c.sql)),
    false,
  );
  const existing = {
    purpose: "service",
    legal_basis: "consent",
    notice_version: "approved-v2",
    notice_text: "Existing notice",
  };
  assert.deepEqual(
    await getProcessingNotice({ query: async () => [[existing]] }, 2, 1),
    existing,
  );
});
test("notice approval cannot change content or legal basis under an existing version", async () => {
  const calls = [],
    notice = {
      purpose: "service",
      legal_basis: "consent",
      notice_version: "v1",
      notice_text: "Approved text",
      organizationId: 1,
      formId: 2,
      actorId: 3,
    };
  const connection = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return sql.startsWith("SELECT")
        ? [
            [
              {
                purpose: "service",
                legal_basis: "consent",
                notice_text: "Approved text",
              },
            ],
          ]
        : [{}];
    },
  };
  await assert.rejects(
    approveNotice(connection, { ...notice, notice_text: "Changed" }),
    { code: "NOTICE_VERSION_IMMUTABLE", status: 409 },
  );
  await assert.rejects(
    approveNotice(connection, { ...notice, legal_basis: "contract" }),
    { code: "NOTICE_VERSION_IMMUTABLE" },
  );
  assert.equal(calls.filter((c) => c.sql.startsWith("INSERT")).length, 0);
  await approveNotice(connection, notice);
  assert.equal(calls.filter((c) => c.sql.startsWith("INSERT")).length, 1);
});
test("new notice approval preserves the complete immutable version before publishing it", async () => {
  const calls = [],
    connection = {
      query: async (sql, params) => {
        calls.push({ sql, params });
        return sql.startsWith("SELECT") ? [[]] : [{}];
      },
    };
  await approveNotice(connection, {
    purpose: "service",
    legal_basis: "consent",
    notice_version: "v2",
    notice_text: "New approved text",
    organizationId: 1,
    formId: 2,
    actorId: 3,
  });
  assert.match(calls[1].sql, /INSERT INTO pdpa_notice_versions/);
  assert.deepEqual(calls[1].params, [
    1,
    2,
    "v2",
    "service",
    "consent",
    "New approved text",
    3,
  ]);
  assert.match(calls[2].sql, /INSERT INTO pdpa_processing_purposes/);
});
