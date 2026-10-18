require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express");
let calls = [],
  auditFailure = false;
const query = async (sql, params) => {
  calls.push({ sql, params });
  if (sql.startsWith("INSERT INTO authorization_audit_logs") && auditFailure)
    throw new Error("synthetic");
  if (sql.startsWith("SELECT")) return [[]];
  return [{ affectedRows: 0, insertId: 1 }];
};
require.cache[require.resolve("../config/db")] = {
  exports: {
    query,
    getConnection: async () => ({
      query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
  },
};
require.cache[require.resolve("../middleware/authMiddleware")] = {
  exports: {
    verifyToken: (req, res, next) => {
      req.user = { id: 1 };
      req.authorizationProfile = {
        isSystemAdmin: req.get("X-Test-System") === "1",
      };
      next();
    },
    requirePermission: () => (req, res, next) => next(),
  },
};
require.cache[require.resolve("../middleware/patientAuthMiddleware")] = {
  exports: {
    verifyPatientToken: (_req, res) =>
      res.status(401).json({ code: "LOGIN_REQUIRED" }),
  },
};
async function appRun(run) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.cookies = {
      suth_staff_session: req.get("Cookie") ? "synthetic" : null,
    };
    req.organizationContext = req.get("X-Test-Context") === "all" ? "all" : 7;
    req.authorization = {
      isSystemAdmin: req.get("X-Test-System") === "1",
      permissions: new Set(
        (
          req.get("X-Test-Permissions") ||
          "cases.view,cases.update,cases.create,patient_members.view"
        ).split(","),
      ),
    };
    next();
  });
  app.use("/api", require("../routes/operationalLookupRoutes"));
  app.use("/api", require("../routes/caseRoutes"));
  app.use("/api", require("../routes/privateFileRoutes"));
  app.use((e, req, res, next) =>
    res.status(e.status || 500).json({ code: e.code }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    await run((path, init = {}) =>
      fetch("http://127.0.0.1:" + server.address().port + "/api" + path, init),
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
}
test("lookup aliases read only the authorized organization and never create defaults", async () => {
  calls = [];
  await appRun(async (request) => {
    for (const path of [
      "/services",
      "/templates?clinic=all",
      "/case-statuses/active",
      "/status-options",
      "/staffs",
    ])
      assert.equal(
        (await request(path, { headers: { "X-Organization-Id": "999" } }))
          .status,
        200,
      );
    assert.equal(calls.length, 5);
    for (const call of calls) {
      assert.match(call.sql, /WHERE organization_id=\?/);
      assert.equal(call.params[0], 7);
      assert.doesNotMatch(call.sql, /INSERT|UPDATE|DELETE/);
    }
    const denied = await request("/services", {
      headers: { "X-Test-Permissions": "patient_members.view" },
    });
    assert.equal(denied.status, 403);
    assert.equal(calls.length, 5);
  });
});
test("lookup writes ignore supplied owner and foreign records stay inaccessible", async () => {
  calls = [];
  await appRun(async (request) => {
    const created = await request("/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organization_id: 999, name: "Synthetic service" }),
    });
    assert.equal(created.status, 201);
    assert.equal(
      calls
        .find((c) => c.sql.startsWith("INSERT INTO service_types"))
        .params.at(-1),
      7,
    );
    const foreign = await request("/services/99", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Changed", organization_id: 999 }),
    });
    assert.equal(foreign.status, 404);
    assert.match(
      calls.find((c) => c.sql.startsWith("UPDATE service_types")).sql,
      /id=\? AND organization_id=\?/,
    );
    const all = await request("/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Context": "all",
        "X-Test-System": "1",
      },
      body: JSON.stringify({ name: "Synthetic" }),
    });
    assert.equal(all.status, 422);
  });
});
test("private files require authentication, an explicit allowlist and a durable audit", async () => {
  await appRun(async (request) => {
    assert.equal((await request("/private-files/arbitrary.pdf")).status, 404);
    assert.equal(
      (await request("/private-files/admin_manual.pdf")).status,
      401,
    );
    assert.equal((await request("/private-files/user_manual.pdf")).status, 401);
    assert.equal(
      (
        await request("/private-files/admin_manual.pdf", {
          headers: { Cookie: "synthetic=1" },
        })
      ).status,
      403,
    );
    // Unit guides are for any signed-in staff; the central guide is not.
    assert.equal(
      (
        await request("/private-files/guide_central.pdf", {
          headers: { Cookie: "synthetic=1" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await request("/private-files/guide_hospital.pdf")).status,
      401,
    );
    for (const guide of ["guide_hospital.pdf", "guide_school.pdf"]) {
      const response = await request(`/private-files/${guide}`, {
        headers: { Cookie: "synthetic=1" },
      });
      assert.equal(response.status, 200, guide);
      assert.equal(
        response.headers.get("content-type"),
        "application/pdf",
        guide,
      );
    }
    auditFailure = true;
    try {
      assert.equal(
        (
          await request("/private-files/admin_manual.pdf", {
            headers: { Cookie: "synthetic=1", "X-Test-System": "1" },
          })
        ).status,
        503,
      );
    } finally {
      auditFailure = false;
    }
  });
});
test("history edits reject a foreign response and old AES link endpoints are gone", async () => {
  calls = [];
  await appRun(async (request) => {
    const response = await request("/history/response/999", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Organization-Id": "999",
      },
      body: JSON.stringify({ field: "display_name", value: "Forged name" }),
    });
    assert.equal(response.status, 403);
    assert.equal(
      calls.some((c) => c.sql.startsWith("UPDATE")),
      false,
    );
    assert.deepEqual(
      calls.find((c) => c.sql.startsWith("SELECT 1 FROM form_responses"))
        .params,
      ["999", 7],
    );
    for (const path of ["/generate-token", "/decode-token"])
      assert.equal(
        (
          await request(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        410,
      );
  });
});
