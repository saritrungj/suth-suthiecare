import test from "node:test";
import assert from "node:assert/strict";
import { canAccess, permissionMap } from "./permissionRegistry.js";

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
