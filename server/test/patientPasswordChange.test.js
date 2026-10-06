const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

// The middleware reads the account through utils/patientAuth's db export.
function loadMiddleware(account) {
  process.env.PATIENT_JWT_SECRET = "test-patient-secret";
  const patientAuthPath = require.resolve("../utils/patientAuth");
  require.cache[patientAuthPath] = {
    exports: { db: { query: async () => [[account]] } },
  };
  require.cache[require.resolve("../services/sessionService")] = {
    exports: { loadSession: async () => ({ account_id: 5, auth_version: 0 }) },
  };
  const middlewarePath = require.resolve("../middleware/patientAuthMiddleware");
  delete require.cache[middlewarePath];
  return require(middlewarePath);
}

function run(middleware) {
  const token = jwt.sign(
    { sub: 5, account_type: "patient", token_version: 0 },
    "test-patient-secret",
  );
  const req = { headers: { authorization: `Bearer ${token}` } };
  return new Promise((resolve) => {
    const res = {
      status(code) {
        this.code = code;
        return this;
      },
      json(body) {
        resolve({ status: this.code, body, req });
      },
    };
    middleware(req, res, () => resolve({ status: "next", req }));
  });
}

const account = {
  id: 5,
  status: "active",
  token_version: 0,
  must_change_password: 1,
};

test("an imported account must change its password before using the portal", async () => {
  const { verifyPatientToken, attachOptionalPatient } = loadMiddleware(account);
  const blocked = await run(verifyPatientToken);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");
  const submit = await run(attachOptionalPatient);
  assert.equal(submit.status, 403);
});

test("the password change route itself is allowed", async () => {
  const { verifyPatientTokenAllowingPasswordChange } = loadMiddleware(account);
  const allowed = await run(verifyPatientTokenAllowingPasswordChange);
  assert.equal(allowed.status, "next");
  assert.equal(allowed.req.patient.id, 5);
});

test("a normal account passes", async () => {
  const { verifyPatientToken } = loadMiddleware({
    ...account,
    must_change_password: 0,
  });
  assert.equal((await run(verifyPatientToken)).status, "next");
});
