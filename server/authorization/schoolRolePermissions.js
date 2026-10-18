const presets = {
  admin: [
    "dashboard.view",
    "dashboard.export",
    "school.view",
    "school.create",
    "school.update",
    "school.delete",
    "school.export",
    "students.view",
    "students.create",
    "students.update",
    "students.delete",
    "students.export",
    "pii.view",
    "master_data.view",
    "master_data.manage",
    "master_data.export",
    "school_staff.manage",
    "school_workflows.manage",
  ],
  counselor: [
    "dashboard.view",
    "dashboard.export",
    "school.view",
    "school.export",
    "students.view",
    "students.export",
    "student_health.view",
    "student_health.update",
    "pii.view",
    "clinical.view",
    "cases.view",
    "cases.update",
    "cases.assign",
    "cases.export",
  ],
  homeroom: [
    "dashboard.view",
    "dashboard.export",
    "school.view",
    "school.export",
    "students.view",
    "students.export",
    "student_health.view",
    "student_health.update",
    "pii.view",
    "clinical.view",
    "cases.view",
    "cases.update",
    "cases.assign",
    "cases.export",
  ],
  other: [],
};
presets.mental_admin = [
  ...new Set([...presets.admin, ...presets.counselor, "forms.view"]),
];
presets.physical_admin = [
  "dashboard.view",
  "school.view",
  "school.export",
  "students.view",
  "students.export",
  "student_health.view",
  "student_health.update",
  "pii.view",
  "clinical.view",
  "forms.view",
];
presets.dorm_staff = ["school.view", "students.view", "pii.view"];
presets.guardian = [
  "students.view",
  "student_health.view",
  "pii.view",
  "clinical.view",
  "cases.view",
];
presets.other = ["school.view", "students.view"];
async function schoolRolePermissions(db, membership) {
  if (membership.organization_type !== "school") return [];
  const [roles] = await db.query(
    `SELECT r.role_code FROM school_staff_roles r JOIN schools s ON s.id=r.school_id JOIN organization_memberships om ON om.user_id=r.user_id AND om.organization_id=s.organization_id WHERE om.id=? AND om.status='active' AND r.status='active' AND s.organization_id=?`,
    [membership.id, membership.organization_id],
  );
  if (
    membership.role_name === "school_guardian" ||
    roles.some((r) => r.role_code === "guardian")
  )
    return Object.assign(
      roles.some((r) => r.role_code === "guardian")
        ? [...presets.guardian]
        : [],
      { guardian: true },
    );
  return [...new Set(roles.flatMap((r) => presets[r.role_code] || []))];
}
module.exports = { presets, schoolRolePermissions };
