import { Navigate } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";

export default function PermissionRoute({ module, children }) {
  const { loading, can } = usePermissions();
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  return can(module) ? children : <Navigate to="/403" replace />;
}
