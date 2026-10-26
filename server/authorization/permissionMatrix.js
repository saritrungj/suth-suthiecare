// Unit permission matrix: every unit module offers all seven actions. The roles
// page (organization_role_permissions) is the only source of these rights;
// "<module>.manage" grants every action of that module.
const ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "assign",
  "export",
  "manage",
];

const MODULES = {
  master_data: { types: ["hospital", "school"] },
  pii: { types: ["hospital", "school"] },
  clinical: { types: ["hospital", "school"] },
  dashboard: { types: ["hospital", "school"] },
  cases: { types: ["hospital", "school"] },
  forms: { types: ["hospital", "school"] },
  help_center: { types: ["hospital"] },
  appointments: { types: ["hospital"] },
  patient_members: { types: ["hospital"] },
  clinics: { types: ["hospital"] },
  school: { types: ["school"] },
  students: { types: ["school"] },
  student_health: { types: ["school"] },
  school_staff: { types: ["school"] },
  school_workflows: { types: ["school"] },
  student_behavior: { types: ["school"] },
  school_appointments: { types: ["school"] },
  school_documents: { types: ["school"] },
  // Approving a school's referral to a hospital before it is sent.
  referral_approvals: { types: ["school"] },
  // Audit history is read-only: only view and export ever pass a check.
  audit: { types: ["hospital", "school"] },
};

// Banners stay a system-wide (System Admin) module.
const SYSTEM_KEYS = ACTIONS.map((action) => `content.${action}`);

const UNIT_KEYS = Object.keys(MODULES).flatMap((module) =>
  ACTIONS.map((action) => `${module}.${action}`),
);

const keysForOrganizationType = (type) => {
  const orgType = type === "school" ? "school" : "hospital";
  return new Set(
    Object.entries(MODULES)
      .filter(([, module]) => module.types.includes(orgType))
      .flatMap(([module]) => ACTIONS.map((action) => `${module}.${action}`)),
  );
};

// Expand "<module>.manage" into the module's other actions.
function expandManage(keys) {
  const result = new Set(keys);
  for (const key of keys) {
    const [module, action] = String(key).split(".");
    if (action === "manage")
      for (const other of ACTIONS) result.add(`${module}.${other}`);
  }
  return result;
}

module.exports = {
  ACTIONS,
  MODULES,
  UNIT_KEYS,
  SYSTEM_KEYS,
  keysForOrganizationType,
  expandManage,
};
