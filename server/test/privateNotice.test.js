const test = require("node:test"),
  assert = require("node:assert/strict");
const { approveNotice } = require("../services/privacyNoticeService");
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
