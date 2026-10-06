import { Navigate } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";

// Guards a school-module page. The active organization must be a school
// organization, and the caller needs the given /school/access flag (the API
// grants teachers their classrooms without a role permission).
export default function SchoolRoute({ check, children }) {
  const { loading, activeOrganizationType, schoolAccess, schoolAccessLoading } =
    usePermissions();
  if (loading || (activeOrganizationType === "school" && schoolAccessLoading))
    return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  if (activeOrganizationType !== "school")
    return (
      <main className="sch-page">
        <div className="sch-empty-state" role="status">
          <strong>เมนูนี้ใช้กับหน่วยงานประเภทโรงเรียน</strong>
          <span>
            กรุณาเลือกหน่วยงานโรงเรียนจากตัวเลือก
            &quot;หน่วยงานที่กำลังใช้งาน&quot; ที่แถบเมนูด้านซ้าย
          </span>
        </div>
      </main>
    );
  if (!schoolAccess || (check && !schoolAccess[check]))
    return <Navigate to="/403" replace />;
  return children;
}
