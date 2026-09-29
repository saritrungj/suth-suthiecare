import { Navigate } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";
import { hasActiveOrganizationMembership } from "./organizationContext";

export default function PermissionRoute({
  module,
  children,
  allowOrganizationMember = false,
}) {
  const { loading, can, authorization, activeOrganization } = usePermissions();
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  const canViewCentralManagement =
    allowOrganizationMember &&
    hasActiveOrganizationMembership(authorization, activeOrganization);
  return can(module) || canViewCentralManagement ? (
    children
  ) : (
    <Navigate to="/403" replace />
  );
}
