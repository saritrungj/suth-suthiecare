import { Link } from "react-router-dom";
import { usePermissions } from "./PermissionsProvider";
import { getWorkspaceOrganization } from "./organizationContext";
import "../styles/organization-workspace.css";

// System authority is global; a concrete destination is still needed for
// organization-owned writes. The sidebar is the single organization selector.
export default function OrganizationWorkspace({ type, children }) {
  const { authorization, loading, activeOrganization } = usePermissions();
  const system = authorization?.is_system_admin === true;
  const { selected } = getWorkspaceOrganization(authorization, activeOrganization, type);
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  if (!system) return children;
  if (!selected) return <main className="organization-workspace-empty">
    <h1>ยังไม่มีหน่วยงาน{type === "school" ? "โรงเรียน" : ""}ที่พร้อมใช้งาน</h1>
    <p>เพิ่มหรือเปิดใช้งานหน่วยงานเพื่อจัดการข้อมูลในเมนูนี้</p>
    <Link to="/admin/organizations">จัดการหน่วยงาน</Link>
  </main>;
  if (String(selected.id) !== String(activeOrganization)) return <main className="organization-workspace-empty">
    <h1>เลือกหน่วยงาน{type === "school" ? "โรงเรียน" : ""}ที่ต้องการจัดการ</h1>
    <p>เลือกหน่วยงานจากเมนู Sidebar เพื่อเปิดข้อมูลของหน่วยงานนั้น</p>
  </main>;
  return <div className="organization-workspace">
    {children}
  </div>;
}
