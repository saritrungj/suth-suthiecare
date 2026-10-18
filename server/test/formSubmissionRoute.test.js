process.env.DATA_ENCRYPTION_KEYS ||= JSON.stringify({ test: "11".repeat(32) });
process.env.DATA_ENCRYPTION_ACTIVE_KEY ||= "test";
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { encrypt, decrypt } = require("../utils/encryption");

test("submits a hash-linked form and names it after the account", async () => {
  let insertedMasterCase;
  let insertedResponse;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes("FROM school_risk_triggers"))
        return [
          [
            {
              id: 6,
              question_id: "diagnostic_question",
              answer_value: "diagnostic answer",
              enabled: 1,
            },
          ],
        ];
      if (sql.startsWith("SELECT title, clinic_type")) {
        return [
          [
            {
              title: "Diagnostic form",
              clinic_type: "general",
              form_type: "Registration",
              status: "published",
              organization_id: 1,
            },
          ],
        ];
      }
      if (sql.includes("FROM patient_accounts WHERE id = ? FOR UPDATE"))
        return [[{ id: 42, identity_hash: "patient-identity-hash" }]];
      if (sql.includes("FROM persons WHERE")) return [[]];
      if (sql.startsWith("INSERT INTO persons")) return [{ insertId: 9 }];
      if (sql.includes("FROM mastercases WHERE")) return [[]];
      if (sql.startsWith("INSERT INTO mastercases")) {
        insertedMasterCase = params;
        return [{ insertId: 701 }];
      }
      if (sql.startsWith("INSERT INTO form_responses")) {
        insertedResponse = params;
        return [{ insertId: 901 }];
      }
      if (sql.startsWith("INSERT INTO pdpa_consent_evidence")) return [{}];
      if (sql.startsWith("INSERT INTO form_answers")) return [{}];
      if (sql.startsWith("INSERT INTO organization_notification_events"))
        return [{ insertId: 5 }];
      if (sql.startsWith("SELECT purpose,legal_basis,notice_version"))
        return [[]];
      if (sql.startsWith("UPDATE mastercases SET organization_id")) return [{}];
      throw new Error(`Unexpected SQL in form submission test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const patientMiddlewarePath =
    require.resolve("../middleware/patientAuthMiddleware");
  const telegramPath = require.resolve("../utils/telegram");
  require.cache[dbPath] = {
    exports: { getConnection: async () => connection },
  };
  require.cache[patientMiddlewarePath] = {
    exports: {
      verifyPatientToken: (req, _res, next) => {
        req.patient = {
          id: 42,
          identity_hash: "patient-identity-hash",
          first_name_encrypted: encrypt("สมหญิง"),
          last_name_encrypted: encrypt("ใจดี"),
        };
        next();
      },
      attachOptionalPatient: (req, _res, next) => {
        req.patient = {
          id: 42,
          identity_hash: "patient-identity-hash",
          first_name_encrypted: encrypt("สมหญิง"),
          last_name_encrypted: encrypt("ใจดี"),
        };
        next();
      },
    },
  };
  require.cache[
    require.resolve("../services/organizationNotificationService")
  ] = { exports: { notifySubmission: async () => {} } };
  require.cache[telegramPath] = {
    exports: { dispatchTelegramAlert: () => {} },
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
    const response = await fetch(
      `http://127.0.0.1:${port}/api/forms/54/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processing_consent: true,
          notice_version: "standard-v1",
          answers: { diagnostic_question: "diagnostic answer" },
          questionTitles: { diagnostic_question: "Diagnostic question" },
          identityValue: "-",
          summaryData: {
            school_risk_override: { level: "normal", trigger_ids: [] },
          },
        }),
      },
    );

    assert.equal(response.status, 201);
    assert.deepEqual(insertedMasterCase, [
      9,
      42,
      "patient-identity-hash",
      "general",
      1,
    ]);
    // [form_id, master_case_id, person_id, account, identity_value, hash, summary, org]
    assert.equal(insertedResponse[2], 9);
    assert.equal(insertedResponse[4], null);
    const summary = require("../utils/privateData").openJson(
      JSON.parse(insertedResponse[6]),
      "form_responses:summary_data:org:1",
    );
    assert.equal(summary.display_name, "สมหญิง ใจดี");
    assert.equal(summary.display_name_source, "account");
    assert.deepEqual(summary.school_risk_override, {
      level: "high",
      trigger_ids: [6],
    });
    assert.equal(
      summary.score_results.at(-1).question_id,
      "school_risk_trigger",
    );
    assert.deepEqual(await response.json(), {
      message: "บันทึกคำตอบสำเร็จ",
      responseId: 901,
      masterCaseId: 701,
      score_results: summary.score_results,
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
      if (sql.includes("FROM school_risk_triggers")) return [[]];
      if (sql.startsWith("SELECT title, clinic_type")) {
        return [
          [
            {
              title: "Public form",
              clinic_type: "general",
              form_type: "Registration",
              status: "published",
              organization_id: 1,
              login_enforcement: "none",
              organization_id: 1,
            },
          ],
        ];
      }
      if (sql.startsWith("INSERT INTO mastercases")) return [{ insertId: 702 }];
      if (sql.startsWith("INSERT INTO form_responses"))
        return [{ insertId: 902 }];
      if (sql.startsWith("INSERT INTO pdpa_consent_evidence")) return [{}];
      if (sql.startsWith("INSERT INTO form_answers")) return [{}];
      if (sql.startsWith("INSERT INTO organization_notification_events"))
        return [{ insertId: 5 }];
      if (sql.startsWith("SELECT purpose,legal_basis,notice_version"))
        return [[]];
      if (sql.startsWith("UPDATE mastercases SET organization_id")) return [{}];
      throw new Error(`Unexpected SQL in public submission test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const patientMiddlewarePath =
    require.resolve("../middleware/patientAuthMiddleware");
  const telegramPath = require.resolve("../utils/telegram");
  require.cache[dbPath] = {
    exports: { getConnection: async () => connection },
  };
  require.cache[patientMiddlewarePath] = {
    exports: { attachOptionalPatient: (_req, _res, next) => next() },
  };
  require.cache[
    require.resolve("../services/organizationNotificationService")
  ] = { exports: { notifySubmission: async () => {} } };
  require.cache[telegramPath] = {
    exports: { dispatchTelegramAlert: () => {} },
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
    const response = await fetch(
      `http://127.0.0.1:${port}/api/forms/55/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processing_consent: true,
          notice_version: "standard-v1",
          answers: { question: "answer" },
          summaryData: {},
        }),
      },
    );

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
      beginTransaction: async () => {
        beganTransaction = true;
      },
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      query: async (sql) => {
        if (sql.startsWith("SELECT title, clinic_type")) {
          return [
            [
              {
                title: "Login protected form",
                clinic_type: "general",
                form_type: "Registration",
                status: "published",
                organization_id: 1,
                login_enforcement: loginEnforcement,
                organization_id: 1,
              },
            ],
          ];
        }
        throw new Error(
          `Unexpected SQL in ${loginEnforcement} submission test: ${sql}`,
        );
      },
    };

    const dbPath = require.resolve("../config/db");
    const patientMiddlewarePath =
      require.resolve("../middleware/patientAuthMiddleware");
    const telegramPath = require.resolve("../utils/telegram");
    require.cache[dbPath] = {
      exports: { getConnection: async () => connection },
    };
    require.cache[patientMiddlewarePath] = {
      exports: { attachOptionalPatient: (_req, _res, next) => next() },
    };
    require.cache[
      require.resolve("../services/organizationNotificationService")
    ] = { exports: { notifySubmission: async () => {} } };
    require.cache[telegramPath] = {
      exports: { dispatchTelegramAlert: () => {} },
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
      const response = await fetch(
        `http://127.0.0.1:${port}/api/forms/56/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            processing_consent: true,
            notice_version: "standard-v1",
            answers: { question: "answer" },
            summaryData: {},
          }),
        },
      );

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

test("rejects a submission to a draft form even by direct URL", async () => {
  let beganTransaction = false;
  const connection = {
    beginTransaction: async () => {
      beganTransaction = true;
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.startsWith("SELECT title, clinic_type")) {
        return [
          [
            {
              title: "Draft form",
              clinic_type: "general",
              form_type: "Registration",
              status: "draft",
              login_enforcement: "none",
              organization_id: 1,
            },
          ],
        ];
      }
      if (sql.startsWith("SELECT purpose,legal_basis,notice_version"))
        return [[]];
      if (sql.startsWith("UPDATE mastercases SET organization_id")) return [{}];
      throw new Error(`Unexpected SQL in draft submission test: ${sql}`);
    },
  };

  const dbPath = require.resolve("../config/db");
  const patientMiddlewarePath =
    require.resolve("../middleware/patientAuthMiddleware");
  const telegramPath = require.resolve("../utils/telegram");
  require.cache[dbPath] = {
    exports: { getConnection: async () => connection },
  };
  require.cache[patientMiddlewarePath] = {
    exports: { attachOptionalPatient: (_req, _res, next) => next() },
  };
  require.cache[
    require.resolve("../services/organizationNotificationService")
  ] = { exports: { notifySubmission: async () => {} } };
  require.cache[telegramPath] = {
    exports: { dispatchTelegramAlert: () => {} },
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
    const response = await fetch(
      `http://127.0.0.1:${port}/api/forms/57/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: { question: "answer" } }),
      },
    );

    assert.equal(response.status, 403);
    assert.equal(beganTransaction, false);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

async function submitAsGuest(connection, body) {
  const dbPath = require.resolve("../config/db");
  const patientMiddlewarePath =
    require.resolve("../middleware/patientAuthMiddleware");
  const telegramPath = require.resolve("../utils/telegram");
  require.cache[dbPath] = {
    exports: { getConnection: async () => connection },
  };
  require.cache[patientMiddlewarePath] = {
    exports: { attachOptionalPatient: (_req, _res, next) => next() },
  };
  require.cache[
    require.resolve("../services/organizationNotificationService")
  ] = { exports: { notifySubmission: async () => {} } };
  require.cache[telegramPath] = {
    exports: { dispatchTelegramAlert: () => {} },
  };
  const routerPath = require.resolve("../routes/formRoutes");
  delete require.cache[routerPath];
  const app = express();
  app.use(express.json());
  app.use("/api", require(routerPath));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    return await fetch(`http://127.0.0.1:${port}/api/forms/60/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        processing_consent: true,
        notice_version: "standard-v1",
        ...body,
      }),
    });
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const publicForm = {
  title: "Public form",
  clinic_type: "general",
  form_type: "Registration",
  status: "published",
  organization_id: 1,
  login_enforcement: "none",
  organization_id: 1,
  questions: JSON.stringify([{ id: "nid", type: "national_id" }]),
};

const thaiId = (prefix) => {
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += Number(prefix[i]) * (13 - i);
  return `${prefix}${(11 - (sum % 11)) % 10}`;
};

test("a form with default settings rejects missing consent and stale notice versions before saving responses", async () => {
  let writes = 0;
  const connection = {
    beginTransaction: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.startsWith("SELECT title, clinic_type")) return [[publicForm]];
      if (sql.startsWith("SELECT purpose,legal_basis,notice_version"))
        return [[]];
      writes++;
      throw Error("Consent rejection must precede persistence");
    },
  };
  for (const body of [
    { processing_consent: false, notice_version: "standard-v1" },
    { processing_consent: true, notice_version: "old-version" },
  ]) {
    const response = await submitAsGuest(connection, { answers: {}, ...body });
    assert.equal(response.status, 422);
  }
  assert.equal(writes, 0);
});

test("a guest who consents is filed under their national ID", async () => {
  const id = thaiId("110170023070");
  let insertedResponse;
  let encryptedAnswer;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql, params) => {
      if (sql.includes("FROM school_risk_triggers")) return [[]];
      if (sql.startsWith("SELECT title, clinic_type")) return [[publicForm]];
      if (sql.includes("FROM persons WHERE identity_hash"))
        return [[{ id: 7, patient_account_id: null, identity_hash: "h" }]];
      if (sql.startsWith("UPDATE persons")) return [{}];
      if (sql.includes("FROM mastercases WHERE person_id"))
        return [[{ id: 88, identity_hash: "h" }]];
      if (sql.startsWith("INSERT INTO form_responses")) {
        insertedResponse = params;
        return [{ insertId: 903 }];
      }
      if (sql.startsWith("INSERT INTO pdpa_consent_evidence")) return [{}];
      if (sql.startsWith("INSERT INTO form_answers")) {
        encryptedAnswer = JSON.parse(params[4]);
        return [{}];
      }
      if (sql.startsWith("INSERT INTO organization_notification_events"))
        return [{ insertId: 5 }];
      if (sql.startsWith("SELECT purpose,legal_basis,notice_version"))
        return [[]];
      if (sql.startsWith("UPDATE mastercases SET organization_id")) return [{}];
      throw new Error(`Unexpected SQL in consent test: ${sql}`);
    },
  };
  const response = await submitAsGuest(connection, {
    answers: { nid: id },
    questionTitles: { nid: "ID number" },
    identityValue: id,
    consent_given: true,
    summaryData: {},
  });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).masterCaseId, 88);
  assert.equal(insertedResponse[2], 7);
  assert.equal(decrypt(insertedResponse[4]), id);
  // The answer is encrypted by question type even without a Thai keyword.
  assert.notEqual(encryptedAnswer, id);
  assert.equal(decrypt(encryptedAnswer), id);
});

test("an invalid consented national ID is rejected before anything is saved", async () => {
  let beganTransaction = false;
  const connection = {
    beginTransaction: async () => {
      beganTransaction = true;
    },
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    query: async (sql) => {
      if (sql.startsWith("SELECT title, clinic_type")) return [[publicForm]];
      if (sql.startsWith("SELECT purpose,legal_basis,notice_version"))
        return [[]];
      if (sql.startsWith("UPDATE mastercases SET organization_id")) return [{}];
      throw new Error(`Unexpected SQL in invalid ID test: ${sql}`);
    },
  };
  const response = await submitAsGuest(connection, {
    answers: { nid: "1234567890123" },
    identityValue: "1234567890123",
    consent_given: true,
    summaryData: {},
  });
  assert.equal(response.status, 422);
  assert.equal(beganTransaction, false);
});
