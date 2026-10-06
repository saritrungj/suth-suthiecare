const KEYS = ["pii.view", "clinical.view"];
async function membershipPermissions(db, membership, roleKeys) {
  const result = new Set(roleKeys);
  const [rows] = await db.query(
    'SELECT permission_key,granted,source FROM organization_membership_data_permissions WHERE membership_id=? ORDER BY source="explicit" ASC',
    [membership.id],
  );
  for (const row of rows)
    if (KEYS.includes(row.permission_key)) {
      if (Number(row.granted) === 1) result.add(row.permission_key);
      else result.delete(row.permission_key);
    }
  return [...result];
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
