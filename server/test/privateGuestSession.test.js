const test = require("node:test"),
  assert = require("node:assert/strict");
let error;
require.cache[require.resolve("../config/db")] = {
  exports: { query: async () => [[]] },
};
require.cache[require.resolve("../services/sessionService")] = {
  exports: {
    loadSession: async () => {
      throw error;
    },
    cookieName: () => "suth_patient_session",
    options: () => ({ httpOnly: true, path: "/" }),
  },
};
const {
  attachOptionalPatient,
  verifyPatientToken,
} = require("../middleware/patientAuthMiddleware");
test("expired patient cookie is cleared for guest flow while required login still rejects it", async () => {
  error = Object.assign(new Error("SESSION_EXPIRED"), {
    status: 401,
    code: "SESSION_EXPIRED",
  });
  let clears = 0,
    continued = 0,
    status;
  const res = {
    clearCookie: (name, options) => {
      assert.equal(name, "suth_patient_session");
      assert.equal(options.httpOnly, true);
      clears++;
    },
    status: (code) => {
      status = code;
      return res;
    },
    json: () => {},
  };
  await attachOptionalPatient({}, res, () => {
    continued++;
  });
  assert.equal(clears, 1);
  assert.equal(continued, 1);
  await verifyPatientToken({}, res, () => {
    continued++;
  });
  assert.equal(status, 401);
  assert.equal(continued, 1);
});
test("guest flow cannot bypass CSRF or origin errors by discarding the active account", async () => {
  for (const code of ["CSRF_REJECTED", "ORIGIN_REJECTED"]) {
    error = Object.assign(new Error(code), { status: 403, code });
    let status,
      continued = false;
    const res = {
      clearCookie: () => assert.fail("must not downgrade active session"),
      status: (code) => {
        status = code;
        return res;
      },
      json: () => {},
    };
    await attachOptionalPatient({}, res, () => {
      continued = true;
    });
    assert.equal(status, 403);
    assert.equal(continued, false);
  }
});
