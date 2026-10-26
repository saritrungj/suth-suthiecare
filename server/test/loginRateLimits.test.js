const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// A school shares one public IP. These tests drive the real login routes and
// the real API limiter over HTTP, with the database replaced by a small fake.
const SCHOOL_IP = "203.0.113.10";

function fakePatientStore() {
  const accounts = new Map();
  const account = (username) => {
    if (!accounts.has(username))
      accounts.set(username, {
        id: accounts.size + 1,
        username,
        password_hash: `right-${username}`,
        status: "active",
        failed_login_count: 0,
        locked_until: null,
        token_version: 0,
      });
    return accounts.get(username);
  };
  const db = {
    async query(sql, params) {
      if (sql.startsWith("SELECT * FROM patient_accounts WHERE username"))
        return [[{ ...account(params[0]) }]];
      if (sql.startsWith("UPDATE patient_accounts SET failed_login_count=?")) {
        const [failures, , , id] = params;
        const row = [...accounts.values()].find((item) => item.id === id);
        row.failed_login_count = failures;
        if (failures >= 10) {
          row.status = "locked";
          row.locked_until = new Date(Date.now() + 15 * 60 * 1000);
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
  return { db, account };
}

function patientLoginApp(env = {}) {
  Object.assign(process.env, { DISABLE_TURNSTILE: "true" }, env);
  const store = fakePatientStore();
  require.cache[require.resolve("../utils/patientAuth")] = {
    exports: {
      db: store.db,
      bcrypt: {
        compare: async (password, hash) => hash === `right-${password}`,
      },
      audit: async () => {},
      publicAccount: (account) => ({ id: account.id }),
      // Not used by login; present so importers find every export.
      ...Object.fromEntries(
        [
          "encrypt",
          "hmacHash",
          "validateIdentity",
          "validatePhone",
          "validateCredentials",
          "validatePersonName",
          "getExistingPhone",
          "signPatientToken",
        ].map((name) => [name, () => null]),
      ),
    },
  };
  require.cache[require.resolve("../services/sessionService")] = {
    exports: {
      establishSession: async () => ({ csrf_token: "csrf" }),
      loadSession: async () => null,
      cookieName: (type) => `suth_${type}_session`,
    },
  };
  for (const path of ["../routes/patientAuthRoutes", "../utils/rateLimits"])
    delete require.cache[require.resolve(path)];
  const app = express();
  app.use(express.json());
  app.use("/api/patient-auth", require("../routes/patientAuthRoutes"));
  for (const name of Object.keys(env)) delete process.env[name];
  return { app, store };
}

async function listen(app) {
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((done) => server.close(done)) };
}

async function login(base, username, password, ip = SCHOOL_IP) {
  const response = await fetch(`${base}/api/patient-auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify({ username, password }),
  });
  return response.status;
}

test("guessing one student's password from the school IP is still stopped", async () => {
  const { app, store } = patientLoginApp();
  const server = await listen(app);
  try {
    const statuses = [];
    for (let attempt = 0; attempt < 12; attempt += 1)
      statuses.push(await login(server.base, "m1-001", "wrong-guess"));
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.deepEqual(statuses.slice(10), [429, 429]);
    // The right password does not get through the limiter either.
    assert.equal(await login(server.base, "m1-001", "m1-001"), 429);
    // And the account itself is locked, whatever IP the next guess uses.
    assert.equal(store.account("m1-001").status, "locked");
    assert.equal(
      await login(server.base, "m1-001", "m1-001", "198.51.100.7"),
      423,
    );
  } finally {
    await server.close();
  }
});

test("sixty students log in together from one IP", async () => {
  const { app } = patientLoginApp();
  const server = await listen(app);
  try {
    const students = Array.from(
      { length: 60 },
      (_, index) => `m4-${index + 1}`,
    );
    // One typo each first, as happens in a real homeroom period.
    await Promise.all(students.map((name) => login(server.base, name, "typo")));
    const statuses = await Promise.all(
      students.map((name) => login(server.base, name, name)),
    );
    assert.deepEqual(statuses, Array(60).fill(200));
  } finally {
    await server.close();
  }
});

test("a guessed account at the school does not block its classmates", async () => {
  const { app } = patientLoginApp();
  const server = await listen(app);
  try {
    for (let attempt = 0; attempt < 11; attempt += 1)
      await login(server.base, "attacked", "wrong");
    assert.equal(await login(server.base, "attacked", "attacked"), 429);
    assert.equal(await login(server.base, "classmate", "classmate"), 200);
  } finally {
    await server.close();
  }
});

test("the per-IP login ceiling still caps password spraying and is set by env", async () => {
  const { app } = patientLoginApp({ PATIENT_LOGIN_MAX_PER_IP: "5" });
  const server = await listen(app);
  try {
    const statuses = [];
    for (let index = 0; index < 7; index += 1)
      statuses.push(await login(server.base, `spray-${index}`, "Password1!"));
    assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429, 429]);
    // Another IP has its own ceiling.
    assert.equal(
      await login(server.base, "other", "other", "198.51.100.8"),
      200,
    );
  } finally {
    await server.close();
  }
});

function staffLoginApp() {
  Object.assign(process.env, { DISABLE_TURNSTILE: "true" });
  const dbPath = require.resolve("../config/db");
  const original = require.cache[dbPath];
  require.cache[dbPath] = {
    exports: {
      query: async (sql, params) =>
        sql.includes("FROM users WHERE username=?")
          ? [
              [
                {
                  id: 9,
                  username: params[0],
                  password: "not-bcrypt",
                  status: "active",
                },
              ],
            ]
          : [[]],
    },
  };
  for (const path of ["../routes/authRoutes", "../utils/rateLimits"])
    delete require.cache[require.resolve(path)];
  const app = express();
  app.use(express.json());
  app.use("/api", require("../routes/authRoutes"));
  if (original) require.cache[dbPath] = original;
  else delete require.cache[dbPath];
  return app;
}

async function staffLogin(base, username) {
  const response = await fetch(`${base}/api/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": SCHOOL_IP,
    },
    body: JSON.stringify({ username, password: "wrong-password" }),
  });
  return response.status;
}

test("staff login counts failures per username + IP", async () => {
  const server = await listen(staffLoginApp());
  try {
    const statuses = [];
    for (let attempt = 0; attempt < 6; attempt += 1)
      statuses.push(await staffLogin(server.base, "teacher-a"));
    assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429]);
    // Other teachers at the same school are not blocked by teacher-a.
    const others = await Promise.all(
      Array.from({ length: 30 }, (_, index) =>
        staffLogin(server.base, `teacher-${index}`),
      ),
    );
    assert.ok(others.every((status) => status === 400));
  } finally {
    await server.close();
  }
});

function apiApp(env = {}) {
  Object.assign(process.env, env);
  delete require.cache[require.resolve("../utils/rateLimits")];
  const app = express();
  app.use("/api", require("../utils/rateLimits").apiLimiters());
  app.get("/api/ping", (req, res) => res.json({ ok: true }));
  for (const name of Object.keys(env)) delete process.env[name];
  return app;
}

async function ping(base, cookie) {
  const response = await fetch(`${base}/api/ping`, {
    headers: {
      "cf-connecting-ip": SCHOOL_IP,
      ...(cookie ? { cookie } : {}),
    },
  });
  return response.status;
}

test("requests with a session are counted per session, not per IP", async () => {
  const server = await listen(
    apiApp({
      API_RATE_LIMIT_PER_SESSION: "3",
      API_RATE_LIMIT_PER_ANONYMOUS_IP: "2",
    }),
  );
  try {
    const first = "suth_patient_session=student-one";
    const second = "other=1; suth_patient_session=student-two";
    assert.deepEqual(
      [
        await ping(server.base, first),
        await ping(server.base, first),
        await ping(server.base, first),
      ],
      [200, 200, 200],
    );
    assert.equal(await ping(server.base, first), 429);
    // A classmate on the same IP has their own budget.
    assert.equal(await ping(server.base, second), 200);
    // Requests without a session still share the IP's budget.
    assert.deepEqual(
      [
        await ping(server.base),
        await ping(server.base),
        await ping(server.base),
      ],
      [200, 200, 429],
    );
  } finally {
    await server.close();
  }
});

test("made-up session cookies cannot escape the per-IP ceiling", async () => {
  const server = await listen(apiApp({ API_RATE_LIMIT_PER_IP: "4" }));
  try {
    const statuses = [];
    for (let index = 0; index < 6; index += 1)
      statuses.push(
        await ping(server.base, `suth_staff_session=forged-${index}`),
      );
    assert.deepEqual(statuses, [200, 200, 200, 200, 429, 429]);
  } finally {
    await server.close();
  }
});
