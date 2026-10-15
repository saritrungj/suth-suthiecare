import test from "node:test";
import assert from "node:assert/strict";
import {
  getSelectableOrganizations,
  getActiveOrganizationLabel,
  hasActiveOrganizationMembership,
  selectInitialOrganization,
  groupOrganizationsByParent,
  getActiveOrganizationType,
  getWorkspaceOrganization,
} from "./organizationContext.js";

test("system workspace enters any compatible unit without requiring membership", () => {
  const authorization = {is_system_admin:true,memberships:[],organizations:[
    {id:1,org_type:'hospital'}, {id:2,org_type:'school',status:'inactive'},
    {id:3,org_type:'school'}, {id:4,org_type:'school'},
  ]};
  assert.equal(getWorkspaceOrganization(authorization,'all').selected.id,1);
  assert.equal(getWorkspaceOrganization(authorization,'1','school').selected.id,3);
  assert.equal(getWorkspaceOrganization(authorization,'4','school').selected.id,4);
  assert.deepEqual(getWorkspaceOrganization(authorization,'all','school').organizations.map(o=>o.id),[3,4]);
  assert.equal(getWorkspaceOrganization({is_system_admin:true,organizations:[]},'all','school').selected,null);
});

test("system admin can select every active organization without memberships", () => {
  const authorization = {
    is_system_admin: true,
    memberships: [],
    organizations: [
      { id: 11, name: "หน่วยงาน A" },
      { id: 22, name: "หน่วยงาน B" },
    ],
  };

  assert.deepEqual(
    getSelectableOrganizations(authorization),
    authorization.organizations,
  );
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

test("only system administrators can choose all or an organization outside memberships", () => {
  for (const roleId of [2, 3]) {
    const authorization = {
      is_system_admin: false,
      user: { role_id: roleId },
      organizations: [{ id: 99, name: "หน่วยงานที่ไม่มีสิทธิ์" }],
      memberships: [
        { organization: { id: 20 }, role: { id: 1, name: "SuperAdmin" } },
      ],
    };
    assert.equal(selectInitialOrganization(authorization, "all"), "20");
    assert.equal(selectInitialOrganization(authorization, "99"), "20");
    assert.deepEqual(
      getSelectableOrganizations(authorization).map((org) => org.id),
      [20],
    );
    assert.notEqual(
      getActiveOrganizationLabel(authorization, "all"),
      "ทุกหน่วยงาน",
    );
  }
  assert.deepEqual(
    getSelectableOrganizations({
      is_system_admin: "false",
      organizations: [{ id: 99 }],
    }),
    [],
  );
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

test("a member can view shared management menus only in their active organization", () => {
  const authorization = {
    is_system_admin: false,
    memberships: [{ organization: { id: 3, name: "หน่วยงานสมาชิก" } }],
  };

  assert.equal(hasActiveOrganizationMembership(authorization, "3"), true);
  assert.equal(hasActiveOrganizationMembership(authorization, "4"), false);
});

test("groups selectable sub-units under their main organization", () => {
  const groups = groupOrganizationsByParent([
    { id: 9, name: "รพ.เดิม", org_type: "hospital" },
    {
      id: 5,
      name: "เครือข่ายโรงเรียน",
      org_type: "school",
      parent_id: 1,
      parent_name: "มทส.",
    },
    {
      id: 4,
      name: "โรงพยาบาล มทส.",
      org_type: "hospital",
      parent_id: 1,
      parent_name: "มทส.",
    },
  ]);
  assert.deepEqual(
    groups.map((group) => [
      group.parentName,
      group.organizations.map((o) => o.id),
    ]),
    [
      ["มทส.", [5, 4]],
      [null, [9]],
    ],
  );
});

test("reads the active organization type, null for all", () => {
  const authorization = {
    is_system_admin: true,
    organizations: [
      { id: 4, org_type: "hospital" },
      { id: 5, org_type: "school" },
      { id: 6 },
    ],
  };
  assert.equal(getActiveOrganizationType(authorization, "5"), "school");
  assert.equal(getActiveOrganizationType(authorization, "6"), "hospital");
  assert.equal(getActiveOrganizationType(authorization, "all"), null);
});
