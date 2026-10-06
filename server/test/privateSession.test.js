const test = require("node:test"),
  assert = require("node:assert/strict");
process.env.NODE_ENV = "test";
process.env.SESSION_CSRF_SECRET = "test-csrf-".repeat(8);
process.env.CORS_ORIGINS = "https://example.test";
const calls = [];
let session = null,
  affected = 1;
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT")) return [session ? [session] : []];
      return [{ affectedRows: affected }];
    },
  },
};
const service = require("../services/sessionService");
const req = (token, method = "GET", headers = {}) => ({
  cookies: { [service.cookieName("staff")]: token },
  method,
  get: (key) => headers[key],
});
test("opaque session sets the right cookie, stores hashes, and returns only CSRF", async () => {
  let cookie;
  const response = await service.establishSession(
    { cookies: {} },
    {
      cookie: (name, value, options) => {
        cookie = { name, value, options };
      },
    },
    "staff",
    { id: 3, auth_version: 4 },
  );
  assert.equal(cookie.value.length, 43);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(cookie.options.path, "/");
  assert.equal(cookie.options.domain, undefined);
  assert.equal(response.token, undefined);
  const insert = calls.find((call) => call.sql.startsWith("INSERT"));
  assert.equal(insert.params[0], service.sha(cookie.value));
  assert.equal(insert.params[4], service.sha(response.csrf_token));
  assert.equal(insert.params[6], 28800);
  session = {
    id: 1,
    account_id: 3,
    auth_version: 4,
    csrf_hash: service.sha(response.csrf_token),
  };
  await service.loadSession(req(cookie.value), "staff");
  const select = calls.find((call) => call.sql.startsWith("SELECT"));
  assert.match(
    select.sql,
    /revoked_at IS NULL.*expires_at>NOW\(\).*last_seen_at>/,
  );
  assert.equal(select.params[2], 900);
  await assert.rejects(
    service.loadSession(
      req(cookie.value, "POST", { Origin: "https://example.test" }),
      "staff",
    ),
    { status: 403, code: "CSRF_REJECTED" },
  );
  await assert.rejects(
    service.loadSession(
      req(cookie.value, "POST", {
        Origin: "https://attacker.test",
        "X-CSRF-Token": response.csrf_token,
      }),
      "staff",
    ),
    { status: 403, code: "ORIGIN_REJECTED" },
  );
  await service.loadSession(
    req(cookie.value, "POST", {
      Origin: "https://example.test",
      "X-CSRF-Token": response.csrf_token,
    }),
    "staff",
  );
  affected = 0;
  await assert.rejects(service.loadSession(req(cookie.value), "staff"), {
    status: 401,
  });
  affected = 1;
  session = null;
  await assert.rejects(service.loadSession(req(cookie.value), "staff"), {
    code: "SESSION_EXPIRED",
  });
});
test("production cookies are secure host-only and staff cannot bypass OTP", async () => {
  process.env.NODE_ENV = "production";
  assert.equal(service.cookieName("staff"), "__Host-suth_staff_session");
  assert.equal(service.options().secure, true);
  await assert.rejects(
    service.establishSession({}, {}, "staff", { id: 3 }, { mfa: false }),
    { code: "MFA_REQUIRED" },
  );
  process.env.NODE_ENV = "test";
});
