import { LuBuilding2, LuHospital, LuSchool } from "react-icons/lu";
import { usePermissions } from "../permissions/PermissionsProvider";
import { getSelectableOrganizations } from "../permissions/organizationContext";
import { getOrganizationProfile } from "../permissions/organizationProfile";
import "./OrganizationScope.css";

const ICONS = { hospital: LuHospital, school: LuSchool, all: LuBuilding2 };

// One line naming whose data the page shows: type icon, organization name,
// type pill and parent organization. `prefix` reads before the name
// (e.g. "จัดทำโดย" on a public form).
export function OrganizationScope({
  name,
  orgType,
  parentName,
  prefix,
  compact = false,
}) {
  const profile = getOrganizationProfile(orgType);
  const Icon = ICONS[profile.icon] || LuBuilding2;
  return (
    <p
      className={`org-scope${compact ? " org-scope--compact" : ""}`}
      data-org-kind={profile.kind}
    >
      <Icon className="org-scope__icon" aria-hidden="true" />
      {prefix && <span className="org-scope__prefix">{prefix}</span>}
      <span className="org-scope__name">{name || profile.label}</span>
      {profile.kind !== "all" && (
        <span className="org-scope__type">{profile.label}</span>
      )}
      {parentName && !compact && (
        <span className="org-scope__parent">สังกัด {parentName}</span>
      )}
    </p>
  );
}

// The active organization from the switcher, for admin pages.
export default function ActiveOrganizationScope(props) {
  const { authorization, activeOrganization, activeOrganizationType } =
    usePermissions();
  const organization =
    activeOrganization === "all"
      ? null
      : getSelectableOrganizations(authorization).find(
          (org) => String(org.id) === String(activeOrganization),
        );
  return (
    <OrganizationScope
      name={organization?.name}
      orgType={organization ? activeOrganizationType : null}
      parentName={organization?.parent_name}
      {...props}
    />
  );
}
