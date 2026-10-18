import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccess,
  permissionMap,
  permissionGroupsForOrganization,
} from "./permissionRegistry.js";

test("normalises legacy user permission rows and applies view/manage levels", () => {
  const permissions = permissionMap([
    { module: "จัดการผู้ใช้ (Users)", can_view: 1, can_manage: 0, can_full: 0 },
  ]);
  assert.equal(canAccess(permissions, "User Management"), true);
  assert.equal(canAccess(permissions, "User Management", "manage"), false);
});

test("full control grants both view and manage access", () => {
  const permissions = permissionMap([
    { module: "Case Management", can_view: 0, can_manage: 0, can_full: 1 },
  ]);
  assert.equal(canAccess(permissions, "Case Management"), true);
  assert.equal(canAccess(permissions, "Case Management", "manage"), true);
  assert.equal(canAccess({}, "Content Management", "manage", true), true);
});

test("each organization type offers exactly the modules it shows", () => {
  const ids = (org_type) =>
    permissionGroupsForOrganization({ org_type }).map((group) => group.id);
  const school = ids("school");
  const hospital = ids("hospital");
  for (const id of [
    "school",
    "students",
    "student_health",
    "school_staff",
    "school_workflows",
  ])
    assert.ok(school.includes(id), id);
  for (const id of ["appointments", "patient_members", "clinics"]) {
    assert.ok(hospital.includes(id), id);
    assert.equal(school.includes(id), false, id);
  }
  for (const id of ["school_staff", "school_workflows", "students"])
    assert.equal(hospital.includes(id), false, id);
  // Banners are managed system-wide, never per unit.
  assert.equal([...school, ...hospital].includes("content"), false);
});
