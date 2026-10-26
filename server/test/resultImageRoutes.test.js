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
  delete require.cache[require.resolve("../services/resultPageSchema")];
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

test("public lookup returns the form organization's images, linked library pictures and texts", async () => {
  const calls = [];
  const questions = [
    {
      scoringRules: [{ resultImage: "asset:4" }, { resultImage: "level:low" }],
    },
    {
      type: "group",
      subQuestions: [{ scoringRules: [{ resultImage: "asset:5" }] }],
    },
  ];
  const query = async (sql, params) => {
    calls.push(params);
    if (sql.includes("FROM forms"))
      return [[{ organization_id: 9, questions: JSON.stringify(questions) }]];
    if (sql.includes("organization_result_image_assets"))
      return [[{ id: 4, image: PNG }]];
    if (sql.includes("organization_result_page_settings"))
      return [[{ texts: { hero_done_title: " เสร็จแล้ว ", unknown: "x" } }]];
    return [[{ level: "high", image: PNG, filename: "high.png" }]];
  };
  await withRouter({ query }, async (call) => {
    const response = await call("/result-images/forms/12");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      images: { low: null, medium: null, high: PNG },
      assets: { 4: PNG },
      texts: { hero_done_title: "เสร็จแล้ว" },
    });
  });
  assert.deepEqual(calls[0], [12]);
  assert.ok(calls.some((params) => params[1]?.join?.() === "4,5"));
});

test("public lookup falls back to defaults when the tables cannot be created", async () => {
  const query = async (sql) => {
    if (sql.includes("FROM forms"))
      return [[{ organization_id: 9, questions: "[]" }]];
    throw Object.assign(new Error("missing"), { code: "ER_NO_SUCH_TABLE" });
  };
  await withRouter({ query }, async (call) => {
    const response = await call("/result-images/forms/12");
    assert.deepEqual(await response.json(), {
      images: { low: null, medium: null, high: null },
      assets: {},
      texts: {},
    });
  });
});

test("a missing table is created on first save, then the save is retried", async () => {
  let created = false;
  let saves = 0;
  const query = async (sql) => {
    if (sql.startsWith("CREATE TABLE")) {
      created = true;
      return [{}];
    }
    if (sql.includes("INSERT INTO organization_result_images")) {
      saves += 1;
      if (!created)
        throw Object.assign(new Error("missing"), {
          code: "ER_NO_SUCH_TABLE",
        });
    }
    return [{ affectedRows: 1 }];
  };
  await withRouter({ query }, async (call) => {
    const response = await call(
      "/admin/result-images/high",
      jsonInit("PUT", { image: PNG }),
    );
    assert.equal(response.status, 200);
  });
  assert.equal(created, true);
  assert.equal(saves, 2);
});

test("library pictures are added and removed within the active organization", async () => {
  const writes = [];
  const query = async (sql, params) => {
    if (sql.includes("COUNT(*)")) return [[{ total: 2 }]];
    if (sql.startsWith("INSERT") || sql.startsWith("DELETE"))
      writes.push(params);
    return [{ insertId: 31, affectedRows: 1 }];
  };
  await withRouter({ query }, async (call) => {
    const added = await call(
      "/admin/result-images/assets",
      jsonInit("POST", { image: PNG, filename: "calm.png" }),
    );
    assert.equal(added.status, 201);
    assert.deepEqual(await added.json(), { success: true, id: 31 });
    const removed = await call("/admin/result-images/assets/31", {
      method: "DELETE",
    });
    assert.equal(removed.status, 200);
  });
  assert.deepEqual(writes, [
    [7, PNG, "calm.png", 3],
    [31, 7],
  ]);
});

test("the library refuses pictures beyond its limit", async () => {
  const query = async () => [[{ total: 60 }]];
  await withRouter({ query }, async (call) => {
    const response = await call(
      "/admin/result-images/assets",
      jsonInit("POST", { image: PNG }),
    );
    assert.equal(response.status, 409);
  });
});

test("texts keep only known, trimmed keys", async () => {
  let saved;
  const query = async (sql, params) => {
    if (sql.includes("organization_result_page_settings")) saved = params;
    return [{ affectedRows: 1 }];
  };
  await withRouter({ query }, async (call) => {
    const response = await call(
      "/admin/result-images/texts",
      jsonInit("PUT", {
        texts: {
          btn_eval: "  ให้คะแนนระบบ ",
          hero_done_title: "",
          script: "<b>x</b>",
          back_home: "x".repeat(600),
        },
      }),
    );
    assert.equal(response.status, 200);
  });
  assert.equal(saved[0], 7);
  assert.deepEqual(JSON.parse(saved[1]), {
    back_home: "x".repeat(500),
    btn_eval: "ให้คะแนนระบบ",
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
