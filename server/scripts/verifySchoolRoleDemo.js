// Real database + route verification on a temporary loopback server.
// Session/OTP login is deliberately outside this fixture verification.
require("../config/env");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const db = require("../config/db");
const { loadAuthorization } = require("../authorization/authorization");
const {
  organizationRolePermissions,
} = require("../authorization/organizationPermissions");
const { membershipPermissions } = require("../authorization/dataPermissions");
const {
  loadSchoolAccess,
  canSeeStudent,
  canViewStudentHealth,
  canViewPhysicalHealth,
} = require("../utils/schoolAccess");

async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "::1"].includes(process.env.DB_HOST)
  )
    throw Error("Local database required");
  const manifest = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "../../backup/school-role-demo-manifest.json"),
      "utf8",
    ),
  );
  // A throwaway clone of the manifest's database may be verified with VERIFY_CLONE_OF.
  assert.equal(
    manifest.database,
    process.env.VERIFY_CLONE_OF || process.env.DB_NAME,
  );
  const [students] = await db.query(
    "SELECT id,school_id,classroom_id,archived_at,is_boarder,first_name_encrypted FROM school_students WHERE school_id=? AND archived_at IS NULL ORDER BY id",
    [manifest.school_id],
  );
  const contexts = new Map();
  for (const account of manifest.accounts) {
    const authorization = await loadAuthorization(account.id);
    const membership = authorization.memberships.find(
      (m) => m.organization_id === manifest.organization_id,
    );
    const keys = await membershipPermissions(
      db,
      membership,
      await organizationRolePermissions(
        db,
        membership.organization_id,
        membership.role_id,
      ),
    );
    const req = {
      user: authorization.user,
      organizationContext: manifest.organization_id,
      authorization: {
        ...authorization,
        membership,
        permissions: new Set(keys),
      },
    };
    req.schoolAccess = await loadSchoolAccess(db, req);
    contexts.set(account.code, req);
  }
  // Diagnostic snapshot: demonstrate the existing clinical-denial conflict
  // without changing a stored membership or the application's policy.
  const counselor = contexts.get("counselor");
  const clinicalDenied = {
    ...counselor,
    authorization: {
      ...counselor.authorization,
      permissions: new Set(
        [...counselor.authorization.permissions].filter(
          (key) => key !== "clinical.view",
        ),
      ),
    },
  };
  contexts.set("clinical_denied_probe", clinicalDenied);
  const app = express();
  app.use(express.json());
  app.use("/api", (req, res, next) => {
    const context = contexts.get(req.get("X-Demo-Profile"));
    if (!context) return res.sendStatus(401);
    Object.assign(req, context);
    next();
  });
  app.use(
    "/api",
    require("../middleware/schoolPrivacyBoundary").schoolPrivacyBoundary,
  );
  app.use("/api", require("../middleware/privateDisclosure").privateDisclosure);
  app.use("/api/school", require("../routes/schoolRoutes"));
  app.use("/api/school", require("../routes/schoolInsightRoutes"));
  app.use("/api/school", require("../routes/schoolWorkflowRoutes"));
  app.use((error, req, res, next) =>
    res
      .status(error.status || 500)
      .json({ code: error.code || "VERIFICATION_ROUTE_ERROR" }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const output = [];
  const observations = [];
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/school`;
    for (const account of manifest.accounts) {
      const access = contexts.get(account.code).schoolAccess;
      const visible = students.filter((s) => canSeeStudent(access, s));
      const target = visible[0] || students[0];
      const canMental = canViewStudentHealth(access, target);
      const canPhysical = canViewPhysicalHealth(access, target);
      const checks = [];
      const request = async (route, status, check) => {
        const response = await fetch(base + route, {
          headers: { "X-Demo-Profile": account.code },
        });
        const body = await response.json();
        assert.ok(
          (Array.isArray(status) ? status : [status]).includes(response.status),
          `${account.code}: ${route} returned ${response.status}; expected ${status}`,
        );
        if (check) check(body);
        checks.push({ route, status: response.status });
      };
      await request("/access", 200);
      await request(
        "/students?limit=100",
        access.canViewStudents ? 200 : 403,
        (body) => {
          if (access.canViewStudents)
            assert.equal(body.pagination.total, visible.length);
        },
      );
      await request(
        "/staff-roles",
        access.canManageStaff ? 200 : 403,
        (body) => {
          if (access.canManageStaff) assert.ok(body.roles.length >= 8);
        },
      );
      await request("/schools", access.canViewSchool ? 200 : 403);
      await request("/teacher-types", access.canViewSchool ? 200 : 403);
      await request("/student-types", access.canViewSchool ? 200 : 403);
      await request("/teachers", access.canViewSchool ? 200 : 403);
      await request(
        `/schools/${manifest.school_id}/grades`,
        access.canViewSchool ? 200 : 403,
      );
      await request("/screening-rounds", 200);
      await request("/rescreen-tasks", 200);
      await request("/risk-triggers", 200);
      await request(
        `/workflow-settings/${manifest.school_id}`,
        access.canManageStaff ? 200 : 403,
      );
      await request(
        `/students/${target.id}/health`,
        canMental || canPhysical ? 200 : [403, 404],
      );
      await request(`/students/${target.id}/insights`, canMental ? 200 : 404);
      if (visible.length) {
        const outside = students.find((s) => !canSeeStudent(access, s));
        if (outside) await request(`/students/${outside.id}`, 404);
      }
      if (account.code === "pii_denied") {
        const actualName = require("../utils/privateField").readField(
          target.first_name_encrypted,
          "school_students",
          "first_name_encrypted",
          manifest.organization_id,
        );
        const maskedName = require("../utils/privateDto").mask(
          actualName,
          "first_name",
        );
        await request(`/students/${target.id}`, 200, (body) =>
          assert.equal(body.first_name, maskedName),
        );
        await request(`/students/${target.id}/first-name`, 403);
      }
      for (const [route, payload] of [
        [
          "/promotions",
          {
            school_id: manifest.school_id,
            dry_run: true,
            mappings: [
              {
                from_classroom_id: manifest.classroom_id,
                to_classroom_id: manifest.promotion_target_classroom_id,
              },
            ],
          },
        ],
        [`/retention/${manifest.school_id}`, { dry_run: true }],
      ]) {
        const response = await fetch(base + route, {
          method: "POST",
          headers: {
            "X-Demo-Profile": account.code,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json();
        assert.equal(
          response.status,
          access.canManageStaff ? 200 : 403,
          `${account.code}: ${route}`,
        );
        if (access.canManageStaff) {
          assert.equal(body.dry_run, true);
          assert.ok(body.data.length > 0);
          if (route.startsWith("/retention/")) {
            assert.equal(body.archived, 0);
            assert.ok(
              body.data.some((s) => s.id === manifest.graduated_student_ids[0]),
            );
          } else assert.ok(body.data[0].count > 0);
        }
        checks.push({ route, status: response.status, dry_run: true });
      }
      output.push({ username: account.username, checks });
    }
    const denialProbe = await fetch(
      `${base}/students/${students[0].id}/insights`,
      { headers: { "X-Demo-Profile": "clinical_denied_probe" } },
    );
    assert.ok(
      [403, 404].includes(denialProbe.status),
      "An explicit clinical.view denial must close school insights",
    );
    observations.push({
      finding:
        "an explicit clinical.view denial closes school insights even for a counselor role",
      status: denialProbe.status,
      stored_permissions_changed: false,
    });
    const homeroomAccount = manifest.accounts.find(
      (a) => a.code === "homeroom",
    );
    const homeroomMembership =
      contexts.get("homeroom").authorization.membership;
    const noUnitPermissions = await membershipPermissions(
      db,
      homeroomMembership,
      [],
    );
    assert.equal(noUnitPermissions.includes("student_health.view"), false);
    observations.push({
      finding:
        "school role presets add nothing: an empty unit permission set grants no rights",
      account: homeroomAccount.username,
      permission: "student_health.view",
      stored_permissions_changed: false,
    });
    const [[archived]] = await db.query(
      "SELECT COUNT(*) count FROM school_students WHERE id IN (?) AND archived_at IS NOT NULL",
      [manifest.graduated_student_ids],
    );
    assert.equal(
      archived.count,
      0,
      "Retention preview must not archive fixture students",
    );
    const [[sourceCount]] = await db.query(
      "SELECT COUNT(*) count FROM school_students WHERE classroom_id=?",
      [manifest.promotion_target_classroom_id],
    );
    assert.equal(
      sourceCount.count,
      0,
      "Promotion preview must not move fixture students",
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  const report = {
    verified_at: new Date().toISOString(),
    scope:
      "local database, actual school routes, privacy boundary and disclosure; excludes session/OTP",
    checks: output.reduce((sum, row) => sum + row.checks.length, 0),
    accounts: output,
    observations,
  };
  fs.writeFileSync(
    path.resolve(
      __dirname,
      "../../backup/school-role-demo-api-verification.json",
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      checks: report.checks,
      profiles: output.length,
      result: "passed",
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      error.code === "ERR_ASSERTION"
        ? error.stack
        : error.code || error.message,
    );
    process.exitCode = 1;
  })
  .finally(() => db.end());
