import { Navigate } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";

export default function PermissionRoute({
  module,
  children,
  systemAdminOnly = false,
}) {
  const { loading, can, authorization } = usePermissions();
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  if (systemAdminOnly && !authorization?.is_system_admin)
    return <Navigate to="/403" replace />;
  return can(module) ? children : <Navigate to="/403" replace />;
}
