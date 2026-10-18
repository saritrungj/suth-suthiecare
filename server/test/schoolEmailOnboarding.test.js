const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test("imported-account email onboarding uses the authenticated owner and stored unverified address", async () => {
  const accountEmail = require("../utils/accountEmail");
  let verified = false,
    hasEmail = true,
    sends = 0;
  const query = async (sql, params) => {
    assert.match(sql, /status='active'/);
    assert.deepEqual(params, [42]);
    return [
      [
        {
          id: 42,
          auth_version: 4,
          email_encrypted: hasEmail
            ? accountEmail.encode("student@example.com", "patient_accounts")
            : null,
          email_verified_at: verified ? "2026-10-14" : null,
        },
      ],
    ];
  };
  require.cache[require.resolve("../config/db")] = { exports: { query } };
  delete require.cache[require.resolve("../utils/patientAuth")];
  const otpPath = require.resolve("../services/otpService"),
    originalOtp = require(otpPath);
  require.cache[otpPath] = {
    exports: {
      ...originalOtp,
      createChallenge: async (db, args) => {
        sends++;
        assert.deepEqual(args, {
          accountType: "patient",
          accountId: 42,
          email: "student@example.com",
          purpose: "email_verification",
          authVersion: 4,
        });
        return { challengeToken: "synthetic.challenge" };
      },
    },
  };
  require.cache[require.resolve("../middleware/patientAuthMiddleware")] = {
    exports: {
      verifyPatientTokenAllowingPasswordChange: (req, res, next) => {
        req.patient = { id: 42 };
        next();
      },
    },
  };
  const path = require.resolve("../routes/patientAuthRoutes");
  delete require.cache[path];
  const app = express();
  app.use(express.json());
  app.use(require(path));
  app.use((e, req, res, next) =>
    res.status(e.status || 500).json({ message: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const request = () =>
    fetch(
      `http://127.0.0.1:${server.address().port}/email/onboarding/request`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: 999,
          email: "someone-else@example.com",
        }),
      },
    );
  try {
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).challengeToken, "synthetic.challenge");
    assert.equal(sends, 1);
    verified = true;
    assert.equal((await request()).status, 409);
    assert.equal(sends, 1);
    verified = false;
    hasEmail = false;
    assert.equal((await request()).status, 422);
    assert.equal(sends, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
