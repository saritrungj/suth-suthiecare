const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test("submits a hash-linked form without a plaintext identity", async () => {
  let insertedMasterCase;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.startsWith("SELECT title, clinic_type")) {
        return [[{ title: "Diagnostic form", clinic_type: "general", form_type: "Registration" }]];
      }
      if (sql.startsWith("SELECT id FROM patient_accounts")) return [[{ id: 42 }]];
      if (sql.startsWith("SELECT id, identity_hash FROM mastercases")) return [[]];
      if (sql.startsWith("INSERT INTO mastercases")) {
        insertedMasterCase = params;
        return [{ insertId: 701 }];
      }
      if (sql.startsWith("INSERT INTO form_responses")) return [{ insertId: 901 }];
      if (sql.startsWith("INSERT INTO form_answers")) return [{}];
      throw new Error(`Unexpected SQL in form submission test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const patientMiddlewarePath = require.resolve("../middleware/patientAuthMiddleware");
  const telegramPath = require.resolve("../utils/telegram");
  require.cache[dbPath] = { exports: { getConnection: async () => connection } };
  require.cache[patientMiddlewarePath] = {
    exports: {
      verifyPatientToken: (req, _res, next) => {
        req.patient = { id: 42, identity_hash: "patient-identity-hash" };
        next();
      },
      attachOptionalPatient: (req, _res, next) => {
        req.patient = { id: 42, identity_hash: "patient-identity-hash" };
        next();
      },
    },
  };
  require.cache[telegramPath] = { exports: { dispatchTelegramAlert: () => {} } };

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
    const response = await fetch(`http://127.0.0.1:${port}/api/forms/54/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: { diagnostic_question: "diagnostic answer" },
        questionTitles: { diagnostic_question: "Diagnostic question" },
        identityValue: "-",
        summaryData: {},
      }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(insertedMasterCase, [42, "patient-identity-hash", "general"]);
    assert.deepEqual(await response.json(), {
      message: "บันทึกคำตอบสำเร็จ",
      responseId: 901,
      masterCaseId: 701,
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("accepts a public form submission without a patient session", async () => {
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.startsWith("SELECT title, clinic_type")) {
        return [[{
          title: "Public form",
          clinic_type: "general",
          form_type: "Registration",
          login_enforcement: "none",
          organization_id: null,
        }]];
      }
      if (sql.startsWith("INSERT INTO mastercases")) return [{ insertId: 702 }];
      if (sql.startsWith("INSERT INTO form_responses")) return [{ insertId: 902 }];
      if (sql.startsWith("INSERT INTO form_answers")) return [{}];
      throw new Error(`Unexpected SQL in public submission test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const patientMiddlewarePath = require.resolve("../middleware/patientAuthMiddleware");
  const telegramPath = require.resolve("../utils/telegram");
  require.cache[dbPath] = { exports: { getConnection: async () => connection } };
  require.cache[patientMiddlewarePath] = {
    exports: { attachOptionalPatient: (_req, _res, next) => next() },
  };
  require.cache[telegramPath] = { exports: { dispatchTelegramAlert: () => {} } };

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
    const response = await fetch(`http://127.0.0.1:${port}/api/forms/55/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: { question: "answer" }, summaryData: {} }),
    });

    assert.equal(response.status, 201);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("blocks unauthenticated submission when login is strict or optional", async () => {
  for (const loginEnforcement of ["strict", "optional"]) {
    let beganTransaction = false;
    const connection = {
      beginTransaction: async () => { beganTransaction = true; },
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql) => {
        if (sql.startsWith("SELECT title, clinic_type")) {
          return [[{
            title: "Login protected form",
            clinic_type: "general",
            form_type: "Registration",
            login_enforcement: loginEnforcement,
            organization_id: null,
          }]];
        }
        throw new Error(`Unexpected SQL in ${loginEnforcement} submission test: ${sql}`);
      },
    };

    const dbPath = require.resolve("../config/db");
    const patientMiddlewarePath = require.resolve("../middleware/patientAuthMiddleware");
    const telegramPath = require.resolve("../utils/telegram");
    require.cache[dbPath] = { exports: { getConnection: async () => connection } };
    require.cache[patientMiddlewarePath] = {
      exports: { attachOptionalPatient: (_req, _res, next) => next() },
    };
    require.cache[telegramPath] = { exports: { dispatchTelegramAlert: () => {} } };

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
      const response = await fetch(`http://127.0.0.1:${port}/api/forms/56/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { question: "answer" }, summaryData: {} }),
      });

      assert.equal(response.status, 401);
      assert.equal((await response.json()).login_enforcement, loginEnforcement);
      assert.equal(beganTransaction, false);
    } finally {
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  }
});
