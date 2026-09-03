import test from "node:test";
import assert from "node:assert/strict";
import {
  getSelectableOrganizations,
  getActiveOrganizationLabel,
  selectInitialOrganization,
} from "./organizationContext.js";

test("system admin can select every active organization without memberships", () => {
  const authorization = {
    is_system_admin: true,
    memberships: [],
    organizations: [
      { id: 11, name: "หน่วยงาน A" },
      { id: 22, name: "หน่วยงาน B" },
    ],
  };

  assert.deepEqual(getSelectableOrganizations(authorization), authorization.organizations);
  assert.equal(selectInitialOrganization(authorization, "22"), "22");
  assert.equal(selectInitialOrganization(authorization, null), "all");
  assert.equal(getActiveOrganizationLabel(authorization, "22"), "หน่วยงาน B");
  assert.equal(getActiveOrganizationLabel(authorization, "all"), "ทุกหน่วยงาน");
});

test("system admin discards a stale organization context", () => {
  const authorization = {
    is_system_admin: true,
    organizations: [{ id: 11, name: "หน่วยงาน A" }],
  };

  assert.equal(selectInitialOrganization(authorization, "999"), "all");
});

test("regular users can select only organizations from active memberships", () => {
  const authorization = {
    is_system_admin: false,
    organizations: [{ id: 99, name: "ไม่ควรเห็น" }],
    memberships: [
      {
        id: 7,
        organization: { id: 3, name: "หน่วยงานสมาชิก" },
        role: { name: "เจ้าหน้าที่" },
      },
    ],
  };

  assert.deepEqual(getSelectableOrganizations(authorization), [
    {
      id: 3,
      name: "หน่วยงานสมาชิก",
      membershipId: 7,
      roleName: "เจ้าหน้าที่",
    },
  ]);
  assert.equal(selectInitialOrganization(authorization, "99"), "3");
});
