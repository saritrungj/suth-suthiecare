import { Navigate, useLocation } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";

export default function RolesRoute({ children }) {
  const location = useLocation();
  const { loading, authorization, schoolAccess, schoolAccessLoading } =
    usePermissions();
  if (loading || schoolAccessLoading)
    return <p role="status">กำลังตรวจสอบสิทธิ์…</p>;
  if (!authorization?.is_system_admin && !schoolAccess?.can_manage_staff)
    return <Navigate to="/403" replace state={{ from: location.pathname }} />;
  return children;
}
