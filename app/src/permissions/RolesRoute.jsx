import { Navigate } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";

export default function RolesRoute({ children }) {
  const { loading, authorization, schoolAccess, schoolAccessLoading } =
    usePermissions();
  if (loading || schoolAccessLoading)
    return <p role="status">กำลังตรวจสอบสิทธิ์…</p>;
  if (!authorization?.is_system_admin && !schoolAccess?.can_manage_staff)
    return <Navigate to="/403" replace />;
  return children;
}
