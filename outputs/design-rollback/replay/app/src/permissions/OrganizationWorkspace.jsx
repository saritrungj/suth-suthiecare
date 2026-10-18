import { Link } from "react-router-dom";
import { useEffect } from "react";
import { FiArrowRight, FiLayers } from "react-icons/fi";
import { usePermissions } from "./PermissionsProvider";
import { getWorkspaceOrganization } from "./organizationContext";
import "../styles/organization-workspace.css";

// System authority is global; a concrete destination is still needed for
// organization-owned writes. The sidebar is the single organization selector.
export default function OrganizationWorkspace({ type, children }) {
  const { authorization, loading, activeOrganization, setActiveOrganization } =
    usePermissions();
  const system = authorization?.is_system_admin === true;
  const { selected } = getWorkspaceOrganization(
    authorization,
    activeOrganization,
    type,
  );
  const switching =
    system && selected && String(selected.id) !== String(activeOrganization);
  useEffect(() => {
    if (!loading && switching) setActiveOrganization(String(selected.id));
  }, [loading, switching, selected?.id, setActiveOrganization]);
  if (loading) return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  if (!system) return children;
  if (!selected || switching)
    return (
      <main className="organization-workspace-empty">
        <section
          className="organization-workspace-notice"
          aria-labelledby="workspace-title"
          aria-busy={Boolean(switching)}
        >
          <FiLayers
            className="organization-workspace-icon"
            aria-hidden="true"
          />
          <h1 id="workspace-title">
            {switching
              ? "กำลังเปิดพื้นที่ทำงาน"
              : `ยังไม่มีหน่วยงาน${type === "school" ? "โรงเรียน" : ""}ที่พร้อมใช้งาน`}
          </h1>
          <p role="status">
            {switching
              ? `กำลังเปลี่ยนไปยัง ${selected.name} เพื่อเปิดข้อมูลในเมนูนี้`
              : "เพิ่มหน่วยงานหรือเปิดใช้งานหน่วยงานเดิม แล้วกลับมาเริ่มจัดการข้อมูลได้ที่นี่"}
          </p>
          {!switching && (
            <Link
              className="organization-workspace-action"
              to="/admin/organizations"
            >
              จัดการหน่วยงาน <FiArrowRight aria-hidden="true" />
            </Link>
          )}
        </section>
      </main>
    );
  return <div className="organization-workspace">{children}</div>;
}
