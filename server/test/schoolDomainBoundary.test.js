const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { sealJson, fieldContext } = require("../utils/privateData");

test("physical admin API and exports return only physical data and reject insight routes", async () => {
  const ss = {
    id: 1,
    school_id: 2,
    classroom_id: 10,
    person_id: 100,
    patient_account_id: 200,
    student_code: "0001",
    status: "active",
  };
  const summary = (domain) =>
    JSON.stringify(
      sealJson(
        {
          score_results: [
            {
              score: domain === "mental" ? 99 : 1,
              label: domain === "mental" ? "เสี่ยงสูง" : "ปกติ",
            },
          ],
        },
        fieldContext("form_responses", "summary_data", 7),
      ),
    );
  let insightReads = 0;
  const db = {
    query: async (sql) => {
      if (sql.includes("FROM organizations"))
        return [[{ id: 7, org_type: "school", status: "active" }]];
      if (sql.includes("FROM school_teachers")) return [[]];
      if (sql.includes("FROM school_staff_roles"))
        return [[{ school_id: 2, role_code: "physical_admin" }]];
      if (sql.includes("FROM school_students ss")) return [[ss]];
      if (sql.includes("FROM school_student_health_profiles")) return [[]];
      if (sql.includes("FROM school_student_physical_records")) return [[]];
      if (sql.includes("FROM form_responses"))
        return [
          [
            {
              id: 30,
              organization_id: 7,
              person_id: 100,
              patient_account_id: 200,
              form_id: 5,
              health_domain: "mental",
              form_title: "Confidential mental result",
              summary_data: summary("mental"),
            },
            {
              id: 31,
              organization_id: 7,
              person_id: 100,
              patient_account_id: 200,
              form_id: 6,
              health_domain: "physical",
              form_title: "Physical result",
              summary_data: summary("physical"),
            },
          ],
        ];
      if (sql.includes("school_student_insights")) {
        insightReads++;
        return [[]];
      }
      if (sql.includes("INSERT INTO authorization_audit_logs")) return [{}];
      throw Error(sql);
    },
  };
  require.cache[require.resolve("../config/db")] = { exports: db };
  for (const p of [
    "../routes/schoolRoutes",
    "../routes/schoolInsightRoutes",
    "../services/exportData",
    "../utils/pdpaAudit",
  ])
    delete require.cache[require.resolve(p)];
  const access = await require("../utils/schoolAccess").loadSchoolAccess(db, {
    user: { id: 3 },
    organizationContext: 7,
    authorization: {
      // physical_admin's unit role as written by the presets migration.
      permissions: new Set([
        "students.view",
        "students.export",
        "clinical.view",
        "student_health.view",
        "student_health.update",
        "clinical.export",
      ]),
    },
  });
  const reqContext = {
    user: { id: 3 },
    organizationContext: 7,
    authorization: {
      // physical_admin's unit role as written by the presets migration.
      permissions: new Set([
        "students.view",
        "students.export",
        "clinical.view",
        "student_health.view",
        "student_health.update",
        "clinical.export",
      ]),
      isSystemAdmin: false,
    },
    schoolAccess: access,
  };
  const app = express();
  app.use((req, res, next) => {
    Object.assign(req, reqContext);
    next();
  });
  app.use(
    "/school",
    require("../routes/schoolRoutes"),
    require("../routes/schoolInsightRoutes"),
  );
  app.use((e, req, res, next) =>
    res.status(e.status || 500).json({ message: e.message }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const get = (path) =>
    fetch(`http://127.0.0.1:${server.address().port}/school${path}`);
  try {
    const response = await get("/students/1/health");
    assert.equal(response.status, 200);
    const health = await response.json();
    assert.deepEqual(health.assessments.mental, []);
    assert.equal(health.assessments.physical.length, 1);
    assert.equal(health.can_view_mental, false);
    assert.equal(health.can_view_physical, true);
    assert.equal(health.latest_activity, null);
    assert.equal((await get("/students/1/insights")).status, 404);
    assert.equal(insightReads, 0);
    const casesResponse = await get("/cases");
    assert.equal(casesResponse.status, 200);
    const cases = await casesResponse.json();
    assert.equal(cases.data[0].mental, null);
    assert.equal(cases.data[0].overall_risk, "normal");
    const { collectSource } = require("../services/exportData");
    const exportData = await collectSource(
      {
        ...reqContext,
        headers: {},
        cookies: {},
        ip: "127.0.0.1",
        get: () => undefined,
      },
      { resource: "student_health", id: 1 },
      true,
    );
    assert.deepEqual(exportData.assessments.mental, []);
    assert.equal(exportData.assessments.physical.length, 1);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
