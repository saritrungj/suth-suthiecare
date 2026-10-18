const KEYS = ["pii.view", "clinical.view"];
// The unit role's rights on the roles page are the only source. School roles
// only decide scope; guardians keep their fixed read-only set.
async function membershipPermissions(db, membership, roleKeys) {
  const { expandManage } = require("./permissionMatrix");
  const school = await require("./schoolRolePermissions").schoolRolePermissions(
    db,
    membership,
  );
  if (school.guardian) return [...expandManage(school)];
  return [...expandManage(roleKeys)];
}
async function resetMigratedGrants(db, membershipId, roleId, organizationId) {
  await db.query(
    'DELETE FROM organization_membership_data_permissions WHERE membership_id=? AND source="legacy_snapshot"',
    [membershipId],
  );
  const keys = new Set(
    await require("./organizationPermissions").organizationRolePermissions(
      db,
      organizationId,
      roleId,
    ),
  );
  for (const key of KEYS) {
    const allowed =
      key === "pii.view"
        ? [
            "cases.view",
            "forms.view",
            "patient_members.view",
            "students.view",
            "student_health.view",
          ]
        : ["cases.view", "forms.view", "student_health.view"];
    if (allowed.some((value) => keys.has(value)))
      await db.query(
        'INSERT IGNORE INTO organization_membership_data_permissions (membership_id,permission_key,granted,source) VALUES (?,?,1,"legacy_snapshot")',
        [membershipId, key],
      );
  }
}
module.exports = { KEYS, membershipPermissions, resetMigratedGrants };
