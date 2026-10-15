import test from "node:test";
import assert from "node:assert/strict";
import {
  adminHomePath,
  filterSidebarItems,
  sidebarSystemRole,
} from "./sidebarPolicy.js";
import { canAccess, permissionMap } from "./permissionRegistry.js";

const items = [
  { type: "header", key: "overview" },
  { key: "dashboard", module: "Dashboard" },
  {
    key: "cases",
    module: "Case Management",
    schoolCheck: (access) => access?.can_view_health,
  },
  { key: "forms", module: "Form Management", allowOrganizationMember: true },
  { key: "schedule", module: "Appointments", orgTypes: ["hospital"] },
  {
    key: "school-students",
    orgTypes: ["school"],
    schoolCheck: (access) => access?.can_view_students,
  },
  { key: "patient-members", module: "User Management" },
  { type: "header", key: "system", system: true },
  {
    key: "organizations",
    module: "organizations.manage",
    systemAdminOnly: true,
  },
  { key: "users", systemAdminOnly: true },
  { key: "roles", systemAdminOnly: true },
  { key: "banner", module: "Content Management", systemAdminOnly: true },
  { type: "header", key: "account" },
  { key: "profile" },
  { key: "manual" },
];
const visible = (authorization, permissions, overrides = {}) =>
  filterSidebarItems(items, {
    authorization,
    can: (module) => canAccess(permissionMap(permissions), module),
    ...overrides,
  })
    .filter((item) => item.type !== "header")
    .map((item) => item.key);

test("system admin sees every module only in the all-organizations overview", () => {
  const authorization = { is_system_admin: true, user: { role_id: 3 } };
  assert.deepEqual(visible(authorization, [], { activeOrganization: "all" }), [
    "dashboard",
    "cases",
    "forms",
    "schedule",
    "school-students",
    "patient-members",
    "organizations",
    "users",
    "roles",
    "banner",
    "profile",
    "manual",
  ]);
  assert.ok(
    visible(authorization, [], {
      organizationType: "school",
      schoolAccess: null,
    }).includes("school-students"),
  );
  assert.equal(
    visible(authorization, [], { organizationType: "school" }).includes(
      "schedule",
    ),
    false,
  );
  const hospital = visible(authorization, [], { activeOrganization: "1", organizationType: "hospital" });
  assert.ok(hospital.includes("schedule"));
  assert.equal(hospital.includes("school-students"), false);
  assert.ok(hospital.includes("organizations") && hospital.includes("users"));
  const school = visible(authorization, [], { activeOrganization: "2", organizationType: "school" });
  assert.ok(school.includes("school-students"));
  assert.equal(school.includes("schedule"), false);
  assert.ok(school.includes("organizations") && school.includes("users"));
  // A null/loading type must not imply permission to display all unit types.
  assert.equal(visible(authorization, []).includes("school-students"), false);
});

test("admin sees permitted unit menus but cannot gain main system menus from unit permissions", () => {
  const authorization = {
    is_system_admin: false,
    system_role: "admin",
    user: { role_id: 2 },
  };
  assert.deepEqual(
    visible(authorization, [
      "dashboard.view",
      "patient_members.view",
      "roles.manage",
      "organizations.manage",
      "content.view",
    ]),
    ["dashboard", "patient-members", "profile", "manual"],
  );
  assert.equal(
    visible(authorization, [], { canViewCentralManagement: true }).includes(
      "forms",
    ),
    false,
  );
});

test("staff navigation follows unit permissions independently of system role", () => {
  const authorization = {
    is_system_admin: false,
    system_role: "staff",
    user: { role_id: 3 },
    memberships: [{ role: { id: 2, name: "Admin" } }],
  };
  const permissions = [
    "dashboard.view",
    "cases.view",
    "forms.view",
    "appointments.view",
    "patient_members.view",
    "content.view",
  ];
  assert.deepEqual(visible(authorization, permissions), [
    "dashboard",
    "cases",
    "forms",
    "schedule",
    "patient-members",
    "profile",
    "manual",
  ]);
  assert.deepEqual(
    visible(authorization, permissions, {
      organizationType: "school",
      schoolAccess: { can_view_students: true, can_view_health: true },
    }),
    [
      "dashboard",
      "cases",
      "forms",
      "school-students",
      "patient-members",
      "profile",
      "manual",
    ],
  );
});

test("user management visibility changes with the selected unit's permissions", () => {
  const authorization = { is_system_admin: false, user: { role_id: 3 } };
  assert.deepEqual(visible(authorization, ["patient_members.view"]), [
    "patient-members",
    "profile",
    "manual",
  ]);
  assert.deepEqual(visible(authorization, ["cases.view"]), [
    "cases",
    "profile",
    "manual",
  ]);
});

test("unit roles and an incomplete profile cannot infer a system administrator", () => {
  assert.equal(
    sidebarSystemRole({
      memberships: [{ role: { id: 1, name: "SuperAdmin" } }],
    }),
    null,
  );
  assert.equal(
    sidebarSystemRole({
      is_system_admin: false,
      system_role: "system_admin",
      user: { role_id: 1 },
    }),
    null,
  );
  assert.deepEqual(visible(null, ["patient_members.view"]), []);
  assert.deepEqual(visible({ user: { role_id: 3 } }, []), [
    "profile",
    "manual",
  ]);
});

test("a custom account role can use its membership permissions without system authority", () => {
  assert.deepEqual(
    visible(
      { is_system_admin: false, system_role: null, user: { role_id: 99 } },
      ["cases.view", "roles.manage"],
    ),
    ["cases", "profile", "manual"],
  );
});

test("admin home uses permitted unit pages instead of the system staff/admin label", () => {
  const home = (permissions, extra = {}) =>
    adminHomePath({
      authorization: { system_role: "staff" },
      organizationType: "hospital",
      can: (module) => canAccess(new Set(permissions), module),
      ...extra,
    });
  assert.equal(home(["cases.view"]), "cases");
  assert.equal(home(["forms.view"]), "forms");
  assert.equal(home([]), "profile");
  assert.equal(
    home([], {
      organizationType: "school",
      schoolAccess: { can_view_students: true },
    }),
    "school/students",
  );
});

test("the authoritative system role wins over the legacy account role", () => {
  assert.equal(
    sidebarSystemRole({
      is_system_admin: false,
      system_role: "staff",
      user: { role_id: 2 },
    }),
    "staff",
  );
  assert.equal(
    sidebarSystemRole({
      is_system_admin: true,
      system_role: "staff",
      user: { role_id: 3 },
    }),
    "system_admin",
  );
});
