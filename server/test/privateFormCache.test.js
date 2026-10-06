require("../config/env");
const test = require("node:test"),
  assert = require("node:assert/strict"),
  express = require("express");
const calls = [];
const query = async (sql, params = []) => {
  calls.push({ sql, params });
  if (sql.includes("COUNT(*) as count")) {
    const published = sql.includes("f.status='published'"),
      org = params.at(-1);
    return [
      [{ form_id: 1, count: (org === 7 ? 70 : 80) + (published ? 0 : 1) }],
    ];
  }
  if (sql.includes("FROM forms f LEFT JOIN organizations"))
    return [
      [
        {
          id: 1,
          title: sql.includes("f.status='published'")
            ? "Published synthetic"
            : "Private synthetic",
          updated_at: new Date(),
          status: sql.includes("f.status='published'") ? "published" : "draft",
          organization_id: params[0],
        },
      ],
    ];
  if (sql.startsWith("SELECT organization_id FROM forms"))
    return [[{ organization_id: 7 }]];
  if (sql.startsWith("SELECT status,organization_id FROM forms"))
    return [[{ organization_id: 7, status: "draft" }]];
  if (sql.startsWith("SELECT * FROM forms"))
    return [
      [
        {
          id: 1,
          title: "Private synthetic",
          status: "draft",
          organization_id: 7,
          questions: [],
        },
      ],
    ];
  if (sql.startsWith("SELECT fa.")) return [[]];
  if (sql.startsWith("SELECT theme"))
    return [[{ status: "draft", organization_id: 7 }]];
  throw new Error("Unexpected synthetic query");
};
require.cache[require.resolve("../config/db")] = { exports: { query } };
require.cache[require.resolve("../middleware/authMiddleware")] = {
  exports: {
    verifyToken: (req, res, next) => next(),
    requirePermission: () => (req, res, next) => next(),
  },
};
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.organizationContext = Number(req.get("X-Test-Org") || 7);
  req.authorization = {
    permissions: new Set(
      req.get("X-Test-Manage") === "yes" ? ["forms.view"] : [],
    ),
  };
  next();
});
app.use("/api", require("../routes/formRoutes"));
let server, url;
test.before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  url = "http://127.0.0.1:" + server.address().port + "/api";
});
test.after(async () => {
  await new Promise((r) => server.close(r));
});
const request = (path, manage = false, org = 7, body) =>
  fetch(url + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "X-Test-Manage": manage ? "yes" : "no",
      "X-Test-Org": String(org),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("cached form visibility never shares draft entries with a member lacking form permission", async () => {
  assert.equal(
    (await (await request("/forms", true)).json())[0].title,
    "Private synthetic",
  );
  assert.equal(
    (await (await request("/forms")).json())[0].title,
    "Published synthetic",
  );
  assert.equal(
    (await (await request("/forms", true, 8)).json())[0].organization_id,
    8,
  );
  assert.equal((await request("/forms/1")).status, 404);
  assert.equal((await request("/forms/1/cover")).status, 404);
});
test("counts cache includes owner and visibility and query verifies the response/form owner relationship", async () => {
  const body = { formIds: [1] };
  const get = async (manage, org) =>
    (await (await request("/counts", manage, org, body)).json()).data[1];
  assert.equal(await get(true, 7), 71);
  assert.equal(await get(false, 7), 70);
  assert.equal(await get(true, 8), 81);
  const sql = calls.find((c) => c.sql.includes("COUNT(*) as count")).sql;
  assert.match(sql, /f.organization_id=fr.organization_id/);
  assert.match(sql, /f.organization_id = \?/);
});
