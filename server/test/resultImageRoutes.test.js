const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const PNG = "data:image/png;base64,iVBORw0KGgo=";

// Mount the router with a fake database and a signed-in staff member whose
// active organization is `organizationContext`.
async function withRouter({ query, organizationContext = 7 }, run) {
  const dbPath = require.resolve("../config/db");
  const authMiddlewarePath = require.resolve("../middleware/authMiddleware");
  require.cache[dbPath] = { exports: { query } };
  require.cache[authMiddlewarePath] = {
    exports: {
      verifyToken: (req, _res, next) => {
        req.user = { id: 3 };
        req.organizationContext = organizationContext;
        next();
      },
      requirePermission: () => (_req, _res, next) => next(),
    },
  };
  const routerPath = require.resolve("../routes/resultImageRoutes");
  delete require.cache[routerPath];
  const app = express();
  app.use(express.json({ limit: "25mb" }));
  app.use("/api", require(routerPath));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address();
    await run((path, init) =>
      fetch(`http://127.0.0.1:${port}/api${path}`, init),
    );
  } finally {
    server.close();
  }
}

const jsonInit = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

test("public lookup returns the form organization's custom images", async () => {
  const calls = [];
  const query = async (sql, params) => {
    calls.push(params);
    if (sql.includes("FROM forms")) return [[{ organization_id: 9 }]];
    return [[{ level: "high", image: PNG, filename: "high.png" }]];
  };
  await withRouter({ query }, async (call) => {
    const response = await call("/result-images/forms/12");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      images: { low: null, medium: null, high: PNG },
    });
  });
  assert.deepEqual(calls, [[12], [9]]);
});

test("public lookup falls back to defaults before the migration runs", async () => {
  const query = async (sql) => {
    if (sql.includes("FROM forms")) return [[{ organization_id: 9 }]];
    throw Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
  };
  await withRouter({ query }, async (call) => {
    const response = await call("/result-images/forms/12");
    assert.deepEqual(await response.json(), {
      images: { low: null, medium: null, high: null },
    });
  });
});

test("saving stores the image for the active organization only", async () => {
  let saved;
  const query = async (sql, params) => {
    if (sql.includes("INSERT INTO organization_result_images")) saved = params;
    return [{ affectedRows: 1 }];
  };
  await withRouter({ query }, async (call) => {
    const response = await call(
      "/admin/result-images/medium",
      jsonInit("PUT", { image: PNG, filename: "mid.png", organization_id: 99 }),
    );
    assert.equal(response.status, 200);
  });
  assert.deepEqual(saved, [7, "medium", PNG, "mid.png", 3]);
});

test("saving rejects unknown levels, non-images and the all-organizations view", async () => {
  const query = async () => {
    throw new Error("database must not be reached");
  };
  await withRouter({ query }, async (call) => {
    const badLevel = await call(
      "/admin/result-images/critical",
      jsonInit("PUT", { image: PNG }),
    );
    assert.equal(badLevel.status, 400);
    const svg = await call(
      "/admin/result-images/low",
      jsonInit("PUT", { image: "data:image/svg+xml;base64,PHN2Zz4=" }),
    );
    assert.equal(svg.status, 400);
  });
  await withRouter({ query, organizationContext: "all" }, async (call) => {
    const response = await call(
      "/admin/result-images/low",
      jsonInit("PUT", { image: PNG }),
    );
    assert.equal(response.status, 422);
  });
});

test("resetting deletes the organization's custom image", async () => {
  let deleted;
  const query = async (sql, params) => {
    if (sql.startsWith("DELETE")) deleted = params;
    return [{ affectedRows: 1 }];
  };
  await withRouter({ query }, async (call) => {
    const response = await call("/admin/result-images/low", {
      method: "DELETE",
    });
    assert.equal(response.status, 200);
  });
  assert.deepEqual(deleted, [7, "low"]);
});
