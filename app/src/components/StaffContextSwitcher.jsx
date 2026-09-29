import { usePermissions } from "../permissions/PermissionsProvider";
import "./StaffContextSwitcher.css";
export default function StaffContextSwitcher() {
  const { authorization, activeAgency, setActiveAgency } = usePermissions();
  if (!authorization) return null;
  const agencies = authorization.is_system_admin
    ? authorization.agencies || []
    : (authorization.agency_memberships || [])
        .map((item) => item.agency)
        .filter(Boolean);
  return (
    <div className="organization-switcher staff-context-switcher">
      <label htmlFor="staff-active-context">
        บริษัท / Agency ที่กำลังใช้งาน
      </label>
      <select
        id="staff-active-context"
        value={activeAgency || ""}
        onChange={(event) => setActiveAgency(event.target.value)}
        disabled={!agencies.length}
      >
        {!agencies.length && <option value="">ยังไม่มี Agency</option>}
        {agencies.map((agency) => (
          <option key={agency.id} value={agency.id}>
            {agency.name}
          </option>
        ))}
      </select>
    </div>
  );
}
