import { Navigate } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";

export default function PermissionRoute({
  module,
  children,
  systemAdminOnly = false,
}) {
  const { loading, can, authorization, schoolAccess, schoolAccessLoading } =
    usePermissions();
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  if (module === "Dashboard" && schoolAccessLoading)
    return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  if (module === "Dashboard" && schoolAccess?.is_guardian)
    return <Navigate to="/admin/school/students" replace />;
  if (systemAdminOnly && !authorization?.is_system_admin)
    return <Navigate to="/403" replace />;
  return can(module) ? children : <Navigate to="/403" replace />;
}
