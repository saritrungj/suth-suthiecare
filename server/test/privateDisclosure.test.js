const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express");
let auditFails = false;
require.cache[require.resolve("../config/db")] = {
  exports: {
    query: async () => {
      if (auditFails) throw new Error("SIMULATED");
      return [{}];
    },
  },
};
const { privateDisclosure } = require("../middleware/privateDisclosure");
test("full disclosure and exports stop when mandatory audit storage is unavailable", async () => {
  const app = express();
  app.use((req, res, next) => {
    req.user = { id: 1 };
    req.authorization = {
      isSystemAdmin: false,
      permissions: new Set(
        (req.get("X-Test-Permissions") || "pii.view,clinical.view").split(","),
      ),
    };
    req.organizationContext = 1;
    next();
  });
  app.use(privateDisclosure);
  app.get(["/cases", "/cases/1", "/cases/1/answers"], (req, res) =>
    res.json(
      req.path === "/cases"
        ? [
            {
              id: 1,
              identity_hash: "never-return",
              first_name: "Synthetic",
              summary_data: {
                display_name: "Synthetic Patient",
                raw_answers: { health: "secret" },
              },
            },
          ]
        : {
            id: 1,
            summary_data: {
              display_name: "Synthetic Patient",
              raw_answers: { health: "secret" },
            },
          },
    ),
  );
  app.get("/school/cases", (_req, res) =>
    res.json({
      data: [{ id: 1, first_name: "Somchai", last_name: "Surname" }],
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const request = (path, keys) =>
    fetch("http://127.0.0.1:" + server.address().port + path, {
      headers: keys ? { "X-Test-Permissions": keys } : {},
    });
  try {
    const list = await (await request("/cases")).json();
    assert.equal(list[0].identity_hash, undefined);
    assert.equal(list[0].first_name, "Synthetic");
    const masked = await (await request("/cases", "clinical.view")).json();
    assert.equal(masked[0].first_name, "S***");
    const maskedSchool = await (
      await request("/school/cases", "clinical.view")
    ).json();
    assert.equal(maskedSchool.data[0].first_name, "S***");
    assert.equal(list[0].summary_data.display_name, "S***");
    assert.equal(list[0].summary_data.raw_answers, undefined);
    const schoolList = await (await request("/school/cases")).json();
    assert.equal(schoolList.data[0].first_name, "Somchai");
    assert.equal(schoolList.data[0].last_name, "Surname");
    assert.equal(
      (await request("/cases/1/answers", "clinical.view")).status,
      403,
    );
    assert.equal((await request("/cases/1/answers", "pii.view")).status, 403);
    auditFails = true;
    const response = await request("/cases/1");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      code: "AUDIT_UNAVAILABLE",
    });
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("imported students' temporary passwords reach a sub-router's reply", async () => {
  auditFails = false;
  const app = express();
  app.use((req, res, next) => {
    req.user = { id: 1 };
    req.authorization = {
      isSystemAdmin: false,
      permissions: new Set(["pii.view", "pii.create"]),
    };
    req.organizationContext = 1;
    next();
  });
  // Mounted like the real app: /api, then the school router at /school,
  // which cuts "/school" off req.path before the route answers.
  const api = express.Router();
  api.use(privateDisclosure);
  const school = express.Router();
  school.post("/students/import", (_req, res) =>
    res.json({
      results: [{ username: "sc00269001", password: "Temp#Pass2569" }],
    }),
  );
  school.get("/students/1", (_req, res) =>
    res.json({ id: 1, password: "never-return" }),
  );
  api.use("/school", school);
  app.use("/api", api);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port + "/api/school";
  try {
    const issued = await (
      await fetch(base + "/students/import", { method: "POST" })
    ).json();
    assert.equal(issued.results[0].password, "Temp#Pass2569");
    const read = await (await fetch(base + "/students/1")).json();
    assert.equal(read.password, undefined);
  } finally {
    await new Promise((r) => server.close(r));
  }
});
