require("../config/env");
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { encrypt, decrypt } = require("../utils/encryption");
const { publicReferral, transitionsFor } = require("../utils/caseReferrals");
const { needsOrganizationContext } = require("../authorization/requestScope");

const record = () => ({
  id: 8,
  source_organization_id: 1,
  destination_organization_id: 2,
  source_organization_name: "ต้นทาง",
  destination_organization_name: "ปลายทาง",
  source_response_id: 101,
  source_master_case_id: 10,
  display_name_encrypted: encrypt("คนทดสอบ นามสกุลทดสอบ"),
  form_title: "ฟอร์มทดสอบ",
  reason_encrypted: encrypt("ขอประสานการติดตาม"),
  status: "pending",
  version: 1,
  identity_hash: "private-hash",
  identity_value: "private-id",
  summary_data: { raw_answers: { private: "private-answer" } },
  clinical_data: "private-clinical",
  phone: "private-phone",
});

async function withApp(
  run,
  { noDestinations = false, failUpdate = false, disabledPair = false } = {},
) {
  const state = {
    referral: record(),
    updates: [],
    snapshot: null,
    calls: [],
    commits: 0,
    rollbacks: 0,
  };
  const query = async (sql, params = []) => {
    state.calls.push({ sql, params });
    if (sql.startsWith("SELECT 1 FROM information_schema"))
      return [[{ exists: 1 }]];
    if (sql.startsWith("SHOW TABLES")) return [[{ exists: 1 }]];
    if (sql.startsWith("INSERT INTO authorization_audit_logs")) return [{}];
    if (sql.startsWith("SELECT o.id, o.code"))
      return [[{ id: 2, code: "DEST", name: "ปลายทาง" }]];
    if (sql.startsWith("SELECT enabled FROM organization_referral_links"))
      return [disabledPair ? [] : [{ enabled: 1 }]];
    if (sql.startsWith("SELECT o.id FROM organizations"))
      return [noDestinations ? [] : [{ id: 1 }, { id: 2 }]];
    if (sql.startsWith("SELECT fr.id"))
      return [
        Number(params[0]) === 101 && Number(params[1]) === 1
          ? [
              {
                id: 101,
                master_case_id: 10,
                summary_data: JSON.stringify({
                  display_name: encrypt("คนทดสอบ นามสกุลทดสอบ"),
                  raw_answers: { secret: "private-answer" },
                }),
                form_title: "ฟอร์มทดสอบ",
              },
            ]
          : [],
      ];
    if (sql.includes("FROM case_referrals r")) {
      assert.match(
        sql,
        /r\.(source_organization_id|destination_organization_id)=\?/,
      );
      if (sql.includes("r.id=?")) {
        assert.match(
          sql,
          /r.source_organization_id=\? OR r.destination_organization_id=\?/,
        );
        const authorized = [
          state.referral.source_organization_id,
          state.referral.destination_organization_id,
        ].includes(Number(params[1]));
        return [
          Number(params[0]) === state.referral.id && authorized
            ? [{ ...state.referral }]
            : [],
        ];
      }
      const expected = sql.includes("WHERE r.destination_organization_id=?")
        ? state.referral.destination_organization_id
        : state.referral.source_organization_id;
      const matches = Number(params[0]) === expected;
      if (sql.startsWith("SELECT COUNT(*) AS total"))
        return [[{ total: matches ? 1 : 0 }]];
      return [matches ? [{ ...state.referral }] : []];
    }
    // Both test units are hospitals, so referrals go out without approval.
    if (sql.startsWith("SELECT id,org_type FROM organizations"))
      return [params.map((id) => ({ id: Number(id), org_type: "hospital" }))];
    if (sql.startsWith("SELECT u.*"))
      return [
        state.updates.map((update, i) => ({
          ...update,
          id: i + 1,
          organization_name:
            update.organization_id === 1 ? "ต้นทาง" : "ปลายทาง",
        })),
      ];
    if (sql.startsWith("INSERT INTO case_referrals")) {
      state.createdParams = params;
      assert.equal(params.length, 8);
      state.referral = {
        ...record(),
        source_organization_id: params[0],
        destination_organization_id: params[1],
        display_name_encrypted: params[4],
        reason_encrypted: params[6],
      };
      return [{ insertId: 8 }];
    }
    if (sql.startsWith("UPDATE case_referrals")) {
      state.referral.status = params[0];
      state.referral.version += 1;
      return [{ affectedRows: 1 }];
    }
    if (sql.startsWith("INSERT INTO case_referral_updates")) {
      if (failUpdate) throw new Error("Synthetic write failure");
      state.updates.push({
        referral_id: params[0],
        organization_id: params[1],
        actor_name_encrypted: params[2],
        kind: params[3],
        status: params[4],
        summary_encrypted: params[5],
      });
      return [{ insertId: state.updates.length }];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const connection = {
    query,
    beginTransaction: async () => {
      state.snapshot = structuredClone({
        referral: state.referral,
        updates: state.updates,
      });
    },
    commit: async () => {
      state.commits += 1;
    },
    rollback: async () => {
      state.rollbacks += 1;
      if (state.snapshot) Object.assign(state, state.snapshot);
    },
    release: () => {},
  };
  require.cache[require.resolve("../config/db")] = {
    exports: { query, getConnection: async () => connection },
  };
  require.cache[require.resolve("../middleware/authMiddleware")] = {
    exports: { verifyToken: (_req, _res, next) => next() },
  };
  delete require.cache[require.resolve("../authorization/authorization")];
  delete require.cache[require.resolve("../routes/caseReferralRoutes")];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const context = req.get("X-Organization-Id") || "1";
    req.organizationContext = context === "all" ? "all" : Number(context);
    req.user = { id: 30 };
    req.authorization = {
      user: { name: "เจ้าหน้าที่ทดสอบ" },
      permissions: new Set(
        (
          req.get("X-Test-Permissions") ??
          "cases.view,cases.assign,cases.update,pii.view,pii.assign,clinical.view,clinical.assign"
        ).split(","),
      ),
    };
    next();
  });
  app.use("/case-referrals", require("../routes/caseReferralRoutes"));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const request = (
    org,
    path = "",
    body,
    method = body ? "POST" : "GET",
    permissions,
  ) =>
    fetch(`http://127.0.0.1:${server.address().port}/case-referrals${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Organization-Id": String(org),
        ...(permissions !== undefined
          ? { "X-Test-Permissions": permissions }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  try {
    await run(request, state);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("all referral routes require organization context", () => {
  for (const path of [
    "/case-referrals",
    "/case-referrals/8",
    "/case-referrals/destinations",
    "/case-referrals/8/updates",
  ])
    assert.equal(needsOrganizationContext(path, true), true);
});
test("the public projection excludes all source identifiers and detailed answers", () => {
  const result = publicReferral(record(), 2);
  assert.equal(result.direction, "incoming");
  assert.match(result.display_name, /^คนทดสอบ \*+$/);
  for (const field of [
    "source_response_id",
    "source_master_case_id",
    "identity_hash",
    "identity_value",
    "summary_data",
    "clinical_data",
    "phone",
  ])
    assert.equal(Object.hasOwn(result, field), false);
});
test("only the destination progresses a referral and only the pending source cancels", () => {
  assert.deepEqual(transitionsFor(record(), 1), ["cancelled"]);
  assert.deepEqual(transitionsFor(record(), 2), ["accepted", "rejected"]);
  assert.deepEqual(transitionsFor({ ...record(), status: "accepted" }, 1), []);
  assert.deepEqual(transitionsFor({ ...record(), status: "accepted" }, 2), [
    "in_progress",
  ]);
  assert.deepEqual(transitionsFor(record(), 3), []);
});
test("an unrelated organization cannot list, read or update a referral", async () => {
  await withApp(async (request, state) => {
    assert.deepEqual((await (await request(3)).json()).items, []);
    assert.equal((await request(3, "/8")).status, 404);
    assert.equal(
      (await request(3, "/8/updates", { version: 1, summary: "ลองเปิดข้อมูล" }))
        .status,
      404,
    );
    assert.equal(state.commits, 0);
    assert.equal(state.referral.status, "pending");
  });
});

test("case history includes referrals from the same master case and refuses foreign anchors", async () => {
  await withApp(async (request, state) => {
    const response = await request(
      1,
      "?direction=outgoing&source_response_id=101",
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).items.length, 1);
    const lookup = state.calls.find(
      (call) =>
        call.sql.includes("r.source_master_case_id=?") &&
        call.sql.includes("LIMIT ? OFFSET ?"),
    );
    assert.deepEqual(lookup.params, [1, 101, 10, 10, 0]);
    assert.equal(
      (await request(2, "?direction=outgoing&source_response_id=101")).status,
      404,
    );
    assert.equal(
      (await request(1, "?direction=incoming&source_response_id=101")).status,
      400,
    );
  });
});
test("source and destination see the same status and deliberately shared note", async () => {
  await withApp(async (request, state) => {
    assert.equal(
      (
        await request(2, "/8/updates", {
          version: 1,
          status: "accepted",
          summary: "รับเรื่องและกำลังประสานนัดหมาย",
        })
      ).status,
      200,
    );
    const origin = await (await request(1, "/8")).json();
    const target = await (await request(2, "/8")).json();
    assert.equal(origin.status, "accepted");
    assert.equal(target.status, origin.status);
    assert.equal(origin.version, 2);
    assert.deepEqual(origin.updates, target.updates);
    assert.equal(origin.updates[0].summary, "รับเรื่องและกำลังประสานนัดหมาย");
    assert.notEqual(
      state.updates[0].summary_encrypted,
      origin.updates[0].summary,
    );
    assert.equal(JSON.stringify(target).includes("private-answer"), false);
  });
});
test("outdated versions cannot overwrite the latest status", async () => {
  await withApp(async (request, state) => {
    assert.equal(
      (await request(2, "/8/updates", { version: 1, status: "accepted" }))
        .status,
      200,
    );
    assert.equal(
      (await request(1, "/8/updates", { version: 1, status: "cancelled" }))
        .status,
      409,
    );
    assert.equal(state.referral.status, "accepted");
    assert.equal(state.updates.length, 1);
  });
});
test("completion needs a summary and prevents later edits", async () => {
  await withApp(async (request, state) => {
    state.referral.status = "in_progress";
    assert.equal(
      (await request(2, "/8/updates", { version: 1, status: "completed" }))
        .status,
      422,
    );
    assert.equal(
      (
        await request(2, "/8/updates", {
          version: 1,
          status: "completed",
          summary: "ประสานงานเสร็จแล้ว",
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(1, "/8/updates", { version: 2, summary: "เพิ่มข้อความ" }))
        .status,
      422,
    );
    assert.equal(state.updates.length, 1);
  });
});
test("an audit note failure rolls back the status update", async () => {
  await withApp(
    async (request, state) => {
      assert.equal(
        (await request(2, "/8/updates", { version: 1, status: "accepted" }))
          .status,
        500,
      );
      assert.equal(state.referral.status, "pending");
      assert.equal(state.referral.version, 1);
      assert.equal(state.rollbacks, 1);
    },
    { failUpdate: true },
  );
});
test("creation only shares the allowed encrypted snapshot of an owned case", async () => {
  await withApp(async (request, state) => {
    const created = await request(1, "", {
      source_response_id: 101,
      destination_organization_id: 2,
      reason: "ขอประสานงาน",
    });
    assert.equal(created.status, 201);
    assert.equal(decrypt(state.createdParams[4]), "คนทดสอบ นามสกุลทดสอบ");
    assert.equal(decrypt(state.createdParams[6]), "ขอประสานงาน");
    assert.equal(state.commits, 1);
    assert.equal(state.updates[0].kind, "created");
    assert.match(
      state.calls.find((call) => call.sql.startsWith("SELECT fr.id")).sql,
      /mc.organization_id=fr.organization_id/,
    );
  });
});
test("foreign source cases, same destination, inactive units and deep payloads are refused", async () => {
  await withApp(async (request) => {
    const body = {
      source_response_id: 101,
      destination_organization_id: 2,
      reason: "ขอประสานงาน",
    };
    assert.equal(
      (await request(2, "", { ...body, destination_organization_id: 1 }))
        .status,
      404,
    );
    assert.equal(
      (await request(1, "", { ...body, destination_organization_id: 1 }))
        .status,
      422,
    );
    assert.equal(
      (await request(1, "", { ...body, raw_answers: {} })).status,
      400,
    );
    assert.equal(
      (
        await request(1, "/8/updates", {
          version: 1,
          summary: "ทดสอบ",
          clinical_data: {},
        })
      ).status,
      400,
    );
  });
  await withApp(
    async (request) => {
      assert.equal(
        (
          await request(1, "", {
            source_response_id: 101,
            destination_organization_id: 2,
            reason: "ขอประสานงาน",
          })
        ).status,
        422,
      );
    },
    { noDestinations: true },
  );
});
test("view-only staff and all-organizations context cannot perform writes", async () => {
  await withApp(async (request) => {
    assert.equal((await request("all")).status, 422);
    assert.equal(
      (
        await request(
          1,
          "",
          {
            source_response_id: 101,
            destination_organization_id: 2,
            reason: "ประสานงาน",
          },
          "POST",
          "cases.view",
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          2,
          "/8/updates",
          { version: 1, status: "accepted" },
          "POST",
          "cases.view",
        )
      ).status,
      403,
    );
    assert.equal((await request(2, "/8", undefined, "GET", "")).status, 403);
  });
});
test("closing a referral pair stops new referrals while existing participants retain history", async () => {
  await withApp(
    async (request, state) => {
      assert.equal(
        (
          await request(1, "", {
            source_response_id: 101,
            destination_organization_id: 2,
            reason: "ทดสอบ",
          })
        ).status,
        403,
      );
      assert.equal((await request(1, "/8")).status, 200);
      assert.equal((await request(2, "/8")).status, 200);
      assert.equal(state.commits, 0);
    },
    { disabledPair: true },
  );
});

test("without assign rights a referral withholds the person's name and the assessment title", async () => {
  await withApp(async (request, state) => {
    const created = await request(
      1,
      "",
      {
        source_response_id: 101,
        destination_organization_id: 2,
        reason: "ขอประสานงาน",
      },
      "POST",
      "cases.view,cases.assign,cases.update",
    );
    assert.equal(created.status, 201);
    assert.equal(decrypt(state.createdParams[4]), "ไม่ระบุชื่อ");
    assert.equal(state.createdParams[5], null);
  });
});

test("the referral list pages by the shared table sizes and reports the total", async () => {
  await withApp(async (request, state) => {
    const page = await (
      await request(1, "?direction=outgoing&limit=25")
    ).json();
    assert.equal(page.total, 1);
    assert.equal(page.total_pages, 1);
    assert.equal(page.limit, 25);
    assert.equal(page.has_more, false);
    const list = state.calls.filter((call) =>
      call.sql.includes("LIMIT ? OFFSET ?"),
    );
    assert.deepEqual(list.at(-1).params.slice(-2), [25, 0]);
    const count = state.calls.find((call) =>
      call.sql.startsWith("SELECT COUNT(*) AS total"),
    );
    assert.ok(count && !count.sql.includes("LIMIT"));
    // Sizes outside 10/25/50/100 fall back to the default of 10.
    const odd = await (await request(1, "?direction=outgoing&limit=7")).json();
    assert.equal(odd.limit, 10);
  });
});
