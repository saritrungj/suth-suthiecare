// Unit rights never fall back to the account's system role or a shared template.
async function organizationRolePermissions(db, organizationId, roleId) {
  const [rows] = await db.query(
    "SELECT permission_key FROM organization_role_permissions WHERE organization_id=? AND role_id=? ORDER BY permission_key",
    [organizationId, roleId],
  );
  return rows.map((row) => row.permission_key);
}
module.exports = { organizationRolePermissions };
