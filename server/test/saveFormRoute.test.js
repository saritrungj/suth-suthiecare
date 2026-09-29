const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

// Regression test: creating a form with the default "general" clinic type
// used to fail with 422 because organizationForClinic required an actual
// row in `clinics` with slug "general", which most organizations never
// create (it's a synthetic "shared" option in the UI, not a real clinic).
test("saves a form with the default 'general' clinic type using the active organization", async () => {
  let insertedValues;
  const connection = {
    query: async (sql, params) => {
      if (sql.trim().startsWith("INSERT INTO forms")) {
        insertedValues = params;
        return [{ insertId: 55 }];
      }
      throw new Error(`Unexpected SQL in save-form test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const authMiddlewarePath = require.resolve("../middleware/authMiddleware");
  require.cache[dbPath] = { exports: { query: connection.query } };
  require.cache[authMiddlewarePath] = {
    exports: {
      verifyToken: (req, _res, next) => {
        req.user = { id: 1 };
        req.organizationContext = 7;
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    },
  };

  const routerPath = require.resolve("../routes/formRoutes");
  delete require.cache[routerPath];
  const router = require(routerPath);
  const app = express();
  app.use(express.json());
  app.use("/api", router);

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/save-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New form",
        clinic_type: "general",
        questions: [],
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: "Form saved successfully",
      id: 55,
    });
    assert.equal(insertedValues[12], 7);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

// Regression test: a system admin whose active-organization selector is set
// to "all" (the default until they explicitly pick one org, per
// selectInitialOrganization) got a hardcoded "please select an organization"
// 422 on every new form, even when their chosen clinic already resolves to
// exactly one organization. The clinic lookup should be trusted the same way
// it already is on the update route.
test("saves a form when the admin's active organization is 'all' but the clinic resolves one organization", async () => {
  let insertedValues;
  const connection = {
    query: async (sql, params) => {
      if (sql.startsWith("SELECT organization_id FROM clinics")) {
        assert.deepEqual(params, ["general"]);
        return [[{ organization_id: 1 }]];
      }
      if (sql.trim().startsWith("INSERT INTO forms")) {
        insertedValues = params;
        return [{ insertId: 56 }];
      }
      throw new Error(`Unexpected SQL in save-form test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const authMiddlewarePath = require.resolve("../middleware/authMiddleware");
  require.cache[dbPath] = { exports: { query: connection.query } };
  require.cache[authMiddlewarePath] = {
    exports: {
      verifyToken: (req, _res, next) => {
        req.user = { id: 1 };
        req.organizationContext = "all";
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    },
  };

  const routerPath = require.resolve("../routes/formRoutes");
  delete require.cache[routerPath];
  const router = require(routerPath);
  const app = express();
  app.use(express.json());
  app.use("/api", router);

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/save-form`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New form",
        clinic_type: "general",
        questions: [],
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(insertedValues[12], 1);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
