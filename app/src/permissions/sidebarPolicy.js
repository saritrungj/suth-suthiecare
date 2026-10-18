// System authority controls the main management section only. Unit menus use
// the selected membership's permissions, regardless of the account's role.
export function sidebarSystemRole(authorization) {
  if (!authorization) return null;
  if (authorization.is_system_admin === true) return "system_admin";
  if (["admin", "staff"].includes(authorization.system_role))
    return authorization.system_role;
  // Compatibility with older authorization responses; never use local session
  // data or the selected organization's role to infer a system role.
  if (Number(authorization.user?.role_id) === 2) return "admin";
  if (Number(authorization.user?.role_id) === 3) return "staff";
  return null;
}

export function filterSidebarItems(
  items,
  {
    authorization,
    activeOrganization,
    organizationType = "hospital",
    schoolAccess,
    can = () => false,
  },
) {
  const isSystemAdmin = authorization?.is_system_admin === true;
  const allowed = (item) => {
    if (!authorization) return false;
    if (item.hideForSystemAdmin && isSystemAdmin) return false;
    if ((item.system || item.systemAdminOnly) && !isSystemAdmin) return false;
    // Only the global overview exposes menus for every organization type.
    const showAllTypes = isSystemAdmin && activeOrganization === "all";
    if (
      item.orgTypes &&
      !showAllTypes &&
      !item.orgTypes.includes(organizationType)
    )
      return false;
    if (isSystemAdmin) return true;
    if (item.type === "header")
      return !item.orgTypes || item.orgTypes.includes(organizationType);
    if (item.orgTypes && !item.orgTypes.includes(organizationType))
      return false;
    if (organizationType === "school" && item.schoolCheck)
      return Boolean(item.schoolCheck(schoolAccess));
    return !item.module || can(item.module);
  };
  return items
    .filter(allowed)
    .map((item) => {
      if (!item.children) return item;
      const children = item.children.filter(allowed);
      return children.length ? { ...item, children } : null;
    })
    .filter(Boolean)
    .filter(
      (item, index, visible) =>
        item.type !== "header" ||
        (visible[index + 1] && visible[index + 1].type !== "header"),
    );
}

export function adminHomePath({
  authorization,
  organizationType,
  schoolAccess,
  can,
}) {
  if (!authorization) return "/403";
  if (authorization.is_system_admin === true || can("Dashboard"))
    return "dashboard";
  if (organizationType === "school") {
    if (schoolAccess?.can_view_students) return "school/students";
    if (schoolAccess?.can_view_health) return "cases";
    if (schoolAccess?.can_view_school) return "school";
  } else if (can("Case Management")) return "cases";
  if (can("User Management")) return "members";
  if (can("Form Management")) return "forms";
  if (organizationType !== "school" && can("Appointments")) return "schedule";
  if (organizationType !== "school" && can("Clinic Management"))
    return "clinics";
  if (can("Help Center Management")) return "help-center";
  return "profile";
}
