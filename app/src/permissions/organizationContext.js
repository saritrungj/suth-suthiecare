export const getSelectableOrganizations = (authorization) => {
  if (!authorization) return [];
  if (authorization.is_system_admin === true)
    return authorization.organizations || [];
  return (authorization.memberships || []).map((membership) => ({
    ...membership.organization,
    membershipId: membership.id,
    roleName: membership.role?.name || "",
  }));
};

export const selectInitialOrganization = (authorization, savedValue) => {
  const organizations = getSelectableOrganizations(authorization);
  const saved = String(savedValue || "");

  if (authorization?.is_system_admin === true) {
    if (saved === "all") return "all";
    const isKnownOrganization = organizations.some(
      (organization) => String(organization.id) === saved,
    );
    return isKnownOrganization ? saved : "all";
  }

  const isKnownMembership = organizations.some(
    (organization) => String(organization.id) === saved,
  );
  return isKnownMembership ? saved : String(organizations[0]?.id || "");
};

export const getActiveOrganizationLabel = (
  authorization,
  activeOrganization,
) => {
  if (activeOrganization === "all" && authorization?.is_system_admin === true)
    return "ทุกหน่วยงาน";
  return (
    getSelectableOrganizations(authorization).find(
      (organization) => String(organization.id) === String(activeOrganization),
    )?.name || "หน่วยงานที่เลือก"
  );
};

// Selectable sub-units grouped under their main organization, for the
// organization switcher. Units without a main organization come last.
export const groupOrganizationsByParent = (organizations = []) => {
  const groups = new Map();
  organizations.forEach((organization) => {
    const key = organization.parent_id ? String(organization.parent_id) : "";
    if (!groups.has(key))
      groups.set(key, {
        parentId: organization.parent_id || null,
        parentName: organization.parent_name || null,
        organizations: [],
      });
    groups.get(key).organizations.push(organization);
  });
  return [...groups.values()].sort((a, b) => {
    if (!a.parentId) return 1;
    if (!b.parentId) return -1;
    return String(a.parentName).localeCompare(String(b.parentName), "th");
  });
};

// "hospital" or "school" for a concrete organization, null for "all".
export const getActiveOrganizationType = (
  authorization,
  activeOrganization,
) => {
  if (!activeOrganization || activeOrganization === "all") return null;
  const organization = getSelectableOrganizations(authorization).find(
    (item) => String(item.id) === String(activeOrganization),
  );
  return organization ? organization.org_type || "hospital" : null;
};

export const hasActiveOrganizationMembership = (
  authorization,
  activeOrganization,
) => {
  if (authorization?.is_system_admin === true) return true;
  return (authorization?.memberships || []).some(
    (membership) =>
      String(membership.organization?.id) === String(activeOrganization),
  );
};
