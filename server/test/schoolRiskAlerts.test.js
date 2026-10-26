const test = require("node:test");
const assert = require("node:assert/strict");
const {
  riskAlertSettings,
  validateSettings,
  alertForResponse,
  alertForResponseSafely,
} = require("../services/schoolRiskAlerts");

const high = { score_results: [{ label: "เสี่ยงสูง", color: "#d93025" }] };
const normal = { score_results: [{ label: "ปกติ", color: "#34a853" }] };

test("alerts default to on, high risk only, teachers only", () => {
  assert.deepEqual(riskAlertSettings(null), {
    enabled: true,
    levels: ["high"],
    mental_admins: false,
  });
  assert.deepEqual(
    riskAlertSettings(JSON.stringify({ risk_alerts: { enabled: false } })),
    { enabled: false, levels: ["high"], mental_admins: false },
  );
  assert.deepEqual(
    riskAlertSettings({ risk_alerts: { levels: ["medium", "bogus", "high"] } })
      .levels,
    ["medium", "high"],
  );
  assert.deepEqual(riskAlertSettings("not json").levels, ["high"]);
});

test("settings must be explicit booleans and known levels", () => {
  assert.ok(
    validateSettings({ enabled: "yes", levels: [], mental_admins: false })
      .error,
  );
  assert.ok(
    validateSettings({
      enabled: true,
      levels: ["normal"],
      mental_admins: false,
    }).error,
  );
  assert.deepEqual(
    validateSettings({
      enabled: true,
      levels: ["high", "high"],
      mental_admins: true,
    }).value,
    { enabled: true, levels: ["high"], mental_admins: true },
  );
});

test("only an at-risk mental-health result from a known person is looked up", async () => {
  const queries = [];
  const connection = {
    query: async (sql) => {
      queries.push(sql);
      return [[]];
    },
  };
  const base = {
    organizationId: 2,
    responseId: 9,
    personId: 5,
    patientAccountId: null,
  };
  assert.equal(
    await alertForResponse(connection, {
      ...base,
      healthDomain: "physical",
      summary: high,
    }),
    0,
  );
  assert.equal(
    await alertForResponse(connection, {
      ...base,
      healthDomain: "mental",
      summary: normal,
    }),
    0,
  );
  assert.equal(
    await alertForResponse(connection, {
      ...base,
      personId: null,
      healthDomain: "mental",
      summary: high,
    }),
    0,
  );
  assert.equal(queries.length, 0, "no query for results that cannot alert");
  // The server's approved answer trigger counts as high risk.
  await alertForResponse(connection, {
    ...base,
    healthDomain: "mental",
    summary: { ...normal, school_risk_override: { level: "high" } },
  });
  assert.equal(queries.length, 1);
});

test("a failing alert is undone on its own and never fails the submission", async () => {
  const log = [];
  const connection = {
    query: async (sql) => {
      log.push(sql.split(" ").slice(0, 3).join(" "));
      if (sql.includes("FROM school_students")) throw new Error("boom");
      return [[]];
    },
  };
  const warn = console.warn;
  console.warn = () => {};
  try {
    const sent = await alertForResponseSafely(connection, {
      organizationId: 2,
      responseId: 9,
      healthDomain: "mental",
      summary: high,
      personId: 5,
    });
    assert.equal(sent, 0);
  } finally {
    console.warn = warn;
  }
  assert.equal(log[0], "SAVEPOINT school_risk_alert");
  assert.equal(log.at(-1), "ROLLBACK TO SAVEPOINT");
  assert.ok(!log.some((line) => line.startsWith("RELEASE")));
});
