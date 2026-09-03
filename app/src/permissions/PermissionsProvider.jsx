import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthorization } from "../services/api";
import { canAccess, permissionMap } from "./permissionRegistry";
import { selectInitialOrganization } from "./organizationContext";

const PermissionsContext = createContext({ loading: true, can: () => false, permissions: new Set(), authorization: null, activeOrganization: null, setActiveOrganization: () => {} });

export function PermissionsProvider({ children }) {
  const [authorization, setAuthorization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrganization, setActiveOrganizationState] = useState(null);
  useEffect(() => {
    let alive = true;
    getAuthorization().then(({ data }) => {
      if (!alive) return;
      setAuthorization(data);
      const key = `suth_active_organization_${data.user.id}`;
      const saved = localStorage.getItem(key);
      const selected = selectInitialOrganization(data, saved);
      setActiveOrganizationState(selected);
      localStorage.setItem(key, selected);
    }).catch(() => alive && setAuthorization(null)).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);
  const setActiveOrganization = (value) => {
    const next = String(value);
    setActiveOrganizationState(next);
    if (authorization?.user?.id) localStorage.setItem(`suth_active_organization_${authorization.user.id}`, next);
  };
  const permissions = useMemo(() => {
    if (!authorization || authorization.is_system_admin) return new Set();
    const membership = authorization.memberships?.find((item) => String(item.organization.id) === String(activeOrganization));
    return permissionMap(membership?.permissions || []);
  }, [authorization, activeOrganization]);
  const value = useMemo(() => ({ loading, authorization, activeOrganization, setActiveOrganization, permissions, can: (module, level = "view") => canAccess(permissions, module, level, Boolean(authorization?.is_system_admin)) }), [loading, authorization, activeOrganization, permissions]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}
export const usePermissions = () => useContext(PermissionsContext);
