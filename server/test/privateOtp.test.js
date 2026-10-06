require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express"),
  bcrypt = require("bcryptjs");
let sends = 0,
  failure = false,
  email = "staff@example.test";
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async () => [
      [
        {
          id: 1,
          username: "synthetic",
          password: bcrypt.hashSync("Synthetic#123", 4),
          name: null,
          email,
          status: "active",
          role_id: 3,
          email_verified_at: new Date(),
          auth_version: 0,
        },
      ],
    ],
  },
};
require.cache[require.resolve("../utils/turnstile")] = {
  exports: {
    isTurnstileDisabled: () => true,
    verifyTurnstile: async () => true,
  },
};
require.cache[require.resolve("../services/otpService")] = {
  exports: {
    normalizeEmail: (v) => v,
    createChallenge: async () => {
      sends++;
      if (failure) throw new Error("SIMULATED_PROVIDER_FAILURE");
      return { challengeToken: "synthetic", maskedEmail: "s***@example.test" };
    },
  },
};
require.cache[require.resolve("../services/sessionService")] = {
  exports: {
    establishSession: async () => {
      throw new Error("PASSWORD_ONLY_SESSION_FORBIDDEN");
    },
  },
};
test("every production staff account needs OTP, including trusted-device cookies; provider failure has no bypass", async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.cookies = { staff_trusted_session: "synthetic" };
    next();
  });
  app.use(require("../routes/authRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const saved = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  process.env.STAFF_EMAIL_OTP_MODE = "enroll";
  process.env.STAFF_TRUSTED_DEVICE_ENABLED = "true";
  const login = () =>
    fetch("http://127.0.0.1:" + server.address().port + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "synthetic",
        password: "Synthetic#123",
      }),
    });
  try {
    const result = await login();
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.requiresOtp, true);
    assert.equal(data.token, undefined);
    assert.equal(data.csrf_token, undefined);
    assert.equal(sends, 1);
    assert.equal(result.headers.get("set-cookie"), null);
    failure = true;
    assert.equal((await login()).status, 503);
    email = null;
    assert.equal((await login()).status, 403);
  } finally {
    process.env.NODE_ENV = saved;
    await new Promise((r) => server.close(r));
  }
});
