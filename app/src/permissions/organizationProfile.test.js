import test from "node:test";
import assert from "node:assert/strict";
import {
  getOrganizationProfile,
  getClinicKpiProfile,
  groupForms,
  pickInitialClinic,
  readKpiValue,
  getClinicName,
} from "./organizationProfile.js";

const clinics = [
  { slug: "teenager", name: "คลินิกวัยรุ่น" },
  { slug: "sti", name: "คลินิกโรคติดต่อทางเพศสัมพันธ์" },
];

test("profile follows organization type, null means all organizations", () => {
  assert.equal(getOrganizationProfile("school").formGroupAxis, "health_domain");
  assert.equal(getOrganizationProfile("hospital").formGroupAxis, "clinic");
  assert.equal(getOrganizationProfile(null).formGroupAxis, "organization");
  assert.equal(getOrganizationProfile("unknown").kind, "hospital");
});

test("school forms group by health domain in a fixed order", () => {
  const groups = groupForms(
    [
      { id: 1, health_domain: "physical" },
      { id: 2, health_domain: null },
      { id: 3, health_domain: "mental" },
      { id: 4, health_domain: "mental" },
      { id: 5, health_domain: "general" },
    ],
    getOrganizationProfile("school"),
  );
  assert.deepEqual(
    groups.map((g) => [g.key, g.forms.length]),
    [
      ["mental", 2],
      ["physical", 1],
      ["general", 1],
      ["other", 1],
    ],
  );
});

test("hospital forms group by clinic in clinic order, deleted clinic last", () => {
  const groups = groupForms(
    [
      { id: 1, clinic_type: "sti" },
      { id: 2, clinic_type: "gone" },
      { id: 3 },
      { id: 4, clinic_type: "teenager" },
    ],
    getOrganizationProfile("hospital"),
    clinics,
  );
  assert.deepEqual(
    groups.map((g) => g.key),
    ["general", "teenager", "sti", "gone"],
  );
  assert.equal(groups.at(-1).missing, true);
  assert.equal(groups[1].label, "คลินิกวัยรุ่น");
});

test("all-organization scope groups by owning organization", () => {
  const groups = groupForms(
    [
      { id: 1, organization_id: 2, organization_name: "ข" },
      { id: 2 },
      { id: 3, organization_id: 1, organization_name: "ก" },
    ],
    getOrganizationProfile(null),
  );
  assert.deepEqual(
    groups.map((g) => g.label),
    ["ก", "ข", "ยังไม่ระบุหน่วยงาน"],
  );
});

test("dashboard counts lead with people who need contact now", () => {
  assert.equal(getClinicKpiProfile("teenager").priority[0].key, "highRisk");
  assert.equal(getClinicKpiProfile("sti").priority[0].key, "highRisk");
  assert.equal(
    getClinicKpiProfile("behavior").priority[0].key,
    "waitingContact",
  );
  assert.equal(readKpiValue({ totalActive: 3, closed: 2 }, "registered"), 5);
  assert.equal(readKpiValue({}, "highRisk"), 0);
});

test("initial clinic prefers the saved clinic, then the organization's first", () => {
  assert.equal(pickInitialClinic(clinics, "sti"), "sti");
  assert.equal(pickInitialClinic(clinics, "behavior"), "teenager");
  assert.equal(pickInitialClinic([], "teenager"), "all");
  assert.equal(getClinicName("general"), "ทั่วไป");
  assert.equal(getClinicName("x", clinics), null);
});
