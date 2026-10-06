import { usePermissions } from "./PermissionsProvider";

// Renders `school` when the active organization is a school organization and
// the regular (hospital) page otherwise. Pages such as the case list look
// different per organization type.
export default function OrganizationTypeSwitch({ school, children }) {
  const { loading, activeOrganizationType } = usePermissions();
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  return activeOrganizationType === "school" ? school : children;
}
