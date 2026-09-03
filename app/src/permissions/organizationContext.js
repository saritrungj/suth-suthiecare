export const getSelectableOrganizations = (authorization) => {
  if (!authorization) return [];
  if (authorization.is_system_admin) return authorization.organizations || [];
  return (authorization.memberships || []).map((membership) => ({
    ...membership.organization,
    membershipId: membership.id,
    roleName: membership.role?.name || "",
  }));
};

export const selectInitialOrganization = (authorization, savedValue) => {
  const organizations = getSelectableOrganizations(authorization);
  const saved = String(savedValue || "");

  if (authorization?.is_system_admin) {
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
  if (activeOrganization === "all") return "ทุกหน่วยงาน";
  return (
    getSelectableOrganizations(authorization).find(
      (organization) =>
        String(organization.id) === String(activeOrganization),
    )?.name || "หน่วยงานที่เลือก"
  );
};
