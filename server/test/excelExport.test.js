const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  exports: { query: async () => [[{ org_type: "hospital" }]] },
};
require.cache[require.resolve("../utils/pdpaAudit")] = {
  exports: { requiredAudit: async () => {} },
};
const userRouter = express.Router();
let pages = [];
userRouter.get("/patient-members", (req, res) => {
  const page = Number(req.query.page);
  pages.push(page);
  const rows = Array.from({ length: 401 }, (_, i) => ({
    id: i + 1,
    first_name: "ทดสอบ",
    password_hash: "NEVER_EXPORT",
    phone: "0812345678",
    notes: "clinical",
    nested: { token: "NEVER_EXPORT" },
  }));
  res.json({
    data: rows.slice((page - 1) * 200, page * 200),
    pagination: { total_pages: 3, total: 401, page },
  });
});
require.cache[require.resolve("../routes/userRoutes")] = {
  exports: userRouter,
};
const formRouter = express.Router();
formRouter.get("/forms/:id/responses", (req, res) => {
  const offset = Number(req.query.offset),
    limit = Number(req.query.limit);
  res.json(
    Array.from({ length: 601 }, (_, i) => ({ id: i + 1 })).slice(
      offset,
      offset + limit,
    ),
  );
});
require.cache[require.resolve("../routes/formRoutes")] = {
  exports: formRouter,
};
const masterRouter = express.Router();
masterRouter.get("/faculty", (req, res) =>
  res.json([
    { id: 1, code: "science", label: "วิทยาศาสตร์", name: "วิทยาศาสตร์" },
  ]),
);
require.cache[require.resolve("../routes/masterDataRoutes")] = {
  exports: masterRouter,
};
const profileRouter = express.Router();
profileRouter.get("/me/profile", (req, res) =>
  res.json({
    success: true,
    profile: {
      name: "บัญชีทดสอบ",
      username: "demo",
      password_hash: "NEVER_EXPORT",
    },
  }),
);
require.cache[require.resolve("../routes/authRoutes")] = {
  exports: profileRouter,
};
const caseRouter = express.Router();
caseRouter.get("/cases/:id", (req, res) =>
  res.json({
    id: Number(req.params.id),
    first_name: "ทดสอบ",
    notes: "clinical",
  }),
);
require.cache[require.resolve("../routes/caseRoutes")] = {
  exports: caseRouter,
};
const {
  collectSource,
  canExport,
  sanitizeExport,
  definitions,
} = require("../services/exportData");
const req = {
  user: { id: 1 },
  authorization: {
    permissions: new Set([
      "patient_members.view",
      "patient_members.export",
      "pii.view",
      "pii.export",
    ]),
  },
  organizationContext: 7,
  method: "POST",
  get: () => null,
};
test("exports every page and applies a selected order after collecting all pages", async () => {
  pages = [];
  const rows = await collectSource(req, { resource: "members" }, false);
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(rows.length, 401);
  assert.equal(rows[0].first_name, "ทดสอบ");
  assert.equal(rows[0].notes, undefined);
  assert.equal(rows[0].password_hash, undefined);
  assert.deepEqual(rows[0].nested, {});
  const subset = await collectSource(
    req,
    { resource: "members", ids: [401, 1, 201] },
    false,
  );
  assert.deepEqual(
    subset.map((r) => r.id),
    [401, 1, 201],
  );
});
test("read permission alone cannot export and arbitrary routes are rejected", async () => {
  const denied = {
    ...req,
    authorization: { permissions: new Set(["patient_members.view"]) },
  };
  assert.equal(canExport(denied, definitions.members), false);
  await assert.rejects(collectSource(denied, { resource: "members" }, false), {
    status: 403,
  });
  await assert.rejects(collectSource(req, { resource: "../../users" }, false), {
    status: 422,
  });
  await assert.rejects(collectSource(req, { resource: "members" }, true), {
    status: 403,
  });
  const maskedActor = {
    ...req,
    authorization: { permissions: new Set(["cases.view", "cases.export"]) },
  };
  const basic = await collectSource(
    maskedActor,
    { resource: "case", id: 1 },
    false,
  );
  assert.equal(basic.id, 1);
  assert.notEqual(basic.first_name, "ทดสอบ");
  assert.equal(basic.notes, undefined);
});
test("response exports continue offset pagination beyond the first 500 rows", async () => {
  const actor = {
    ...req,
    authorization: { permissions: new Set(["cases.view", "cases.export"]) },
  };
  const rows = await collectSource(
    actor,
    { resource: "responses", id: 1 },
    false,
  );
  assert.equal(rows.length, 601);
  assert.equal(rows.at(-1).id, 601);
});
test("deep export independently requires an authorized school role", () => {
  const a = {
    ...req,
    authorization: {
      permissions: new Set([
        "clinical.view",
        "student_health.view",
        "students.export",
      ]),
    },
    schoolAccess: {
      canExportStudents: true,
      canViewStudents: true,
      canClinical: false,
    },
  };
  assert.equal(canExport(a, definitions.student_health), false);
});
test("credentials and ciphertext never appear even in an authorized deep export", () => {
  const safe = sanitizeExport(
    {
      notes: "allowed",
      must_change_password: true,
      password: "secret",
      secret: "x",
      token: "x",
      cipher_encrypted: "x",
      nested: { otp: "x", value: "suthenc:encrypted" },
      answers: [{ answer_value: "normal", auth_token: "x" }],
    },
    true,
    true,
  );
  assert.equal(safe.notes, "allowed");
  assert.equal(safe.must_change_password, true);
  assert.deepEqual(safe.nested, { value: "" });
  assert.deepEqual(safe.answers, [{ answer_value: "normal" }]);
  assert.equal(safe.password, undefined);
});
test("business labels are exported under master rights without clinical or PII grants", async () => {
  const actor = {
    ...req,
    authorization: {
      permissions: new Set(["master_data.view", "master_data.export"]),
    },
  };
  const rows = await collectSource(
    actor,
    { resource: "master", id: "faculty" },
    false,
  );
  assert.equal(rows[0].label, "วิทยาศาสตร์");
  assert.equal(rows[0].name, "วิทยาศาสตร์");
});
test("own-profile exports retain the owned profile while stripping credentials", async () => {
  const actor = { ...req, authorization: { permissions: new Set() } };
  const profile = await collectSource(actor, { resource: "profile" }, false);
  assert.equal(profile.name, "บัญชีทดสอบ");
  assert.equal(profile.password_hash, undefined);
});
