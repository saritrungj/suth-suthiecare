const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isMainOrganization,
  planOrganizationWrite,
  memberUserIds,
} = require("../utils/organizationHierarchy");

const schoolsMain = {
  id: 4,
  org_level: "main",
  org_type: "school",
  parent_id: null,
  status: "active",
};
const untypedMain = { ...schoolsMain, id: 3, org_type: null };
const school = {
  id: 2,
  org_level: "unit",
  org_type: "hospital",
  parent_id: 4,
  status: "active",
};
const legacy = {
  id: 9,
  org_level: "unit",
  org_type: "hospital",
  parent_id: null,
  status: "active",
};

test("a main organization chooses the type of its sub-units", () => {
  assert.equal(isMainOrganization(schoolsMain), true);
  assert.equal(isMainOrganization(legacy), false);
  assert.match(
    planOrganizationWrite({ body: { kind: "main", name: "โรงเรียน" } }).error,
    /ประเภทของหน่วยงานหลัก/,
  );
  const { value } = planOrganizationWrite({
    body: {
      kind: "main",
      name: " โรงเรียน ",
      org_type: "school",
      parent_id: 7,
    },
  });
  assert.deepEqual(value, {
    kind: "main",
    name: "โรงเรียน",
    description: null,
    status: "active",
    org_type: "school",
    parent_id: null,
  });
  // An untyped main organization from before must pick a type when saved.
  assert.equal(
    planOrganizationWrite({
      body: { name: "โรงพยาบาล", org_type: "hospital" },
      existing: untypedMain,
    }).value.org_type,
    "hospital",
  );
});

test("a sub-unit inherits the type of its main organization", () => {
  const created = planOrganizationWrite({
    body: {
      kind: "unit",
      name: "รร.สุรวิวัฒน์",
      org_type: "hospital",
      parent_id: "4",
    },
    parent: schoolsMain,
  });
  assert.equal(created.value.org_type, "school");
  assert.equal(created.value.parent_id, 4);

  // The stored copy is corrected on the next save.
  assert.equal(
    planOrganizationWrite({
      body: { name: "รร." },
      existing: school,
      parent: schoolsMain,
    }).value.org_type,
    "school",
  );
  assert.match(
    planOrganizationWrite({
      body: { kind: "unit", name: "x", parent_id: 3 },
      parent: untypedMain,
    }).error,
    /ยังไม่ได้กำหนดประเภท/,
  );
  assert.match(
    planOrganizationWrite({ body: { kind: "unit", name: "x" } }).error,
    /กรุณาเลือกหน่วยงานหลัก/,
  );
  assert.match(
    planOrganizationWrite({
      body: { kind: "unit", name: "x", parent_id: 2 },
      parent: school,
    }).error,
    /ภายใต้หน่วยงานหลักเท่านั้น/,
  );
});

test("a legacy unit without a parent keeps a type of its own", () => {
  const kept = planOrganizationWrite({
    body: { name: "รพ." },
    existing: legacy,
  });
  assert.equal(kept.value.parent_id, null);
  assert.equal(kept.value.org_type, "hospital");
  const moved = planOrganizationWrite({
    body: { name: "รพ.", parent_id: 4 },
    existing: legacy,
    parent: schoolsMain,
  });
  assert.equal(moved.value.org_type, "school");
  assert.match(
    planOrganizationWrite({
      body: { name: "รร.", parent_id: null },
      existing: school,
    }).error,
    /หน่วยงานหลัก/,
  );
});

test("member ids must be unique positive integers", () => {
  assert.deepEqual(memberUserIds({ user_ids: [3, "4"] }), [3, 4]);
  assert.deepEqual(memberUserIds({ user_id: 7 }), [7]);
  assert.equal(memberUserIds({ user_ids: [3, 3] }), null);
  assert.equal(memberUserIds({ user_ids: [0] }), null);
  assert.equal(memberUserIds({}), null);
});
