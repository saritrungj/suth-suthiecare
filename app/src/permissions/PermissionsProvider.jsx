import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthorization } from "../services/api";
import { canAccess, permissionMap } from "./permissionRegistry";
import { selectInitialOrganization } from "./organizationContext";

const PermissionsContext = createContext({
  loading: true,
  can: () => false,
  permissions: new Set(),
  authorization: null,
  activeOrganization: null,
  setActiveOrganization: () => {},
  activeAgency: null,
  setActiveAgency: () => {},
});

export function PermissionsProvider({ children }) {
  const [authorization, setAuthorization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrganization, setActiveOrganizationState] = useState(null);
  const [activeAgency, setActiveAgencyState] = useState(null);
  const [authorizationVersion, setAuthorizationVersion] = useState(0);
  const refreshAuthorization = () =>
    setAuthorizationVersion((version) => version + 1);
  useEffect(() => {
    let alive = true;
    getAuthorization()
      .then(({ data }) => {
        if (!alive) return;
        setAuthorization(data);
        const key = `suth_active_organization_${data.user.id}`;
        const saved = localStorage.getItem(key);
        const selected = selectInitialOrganization(data, saved);
        setActiveOrganizationState(selected);
        localStorage.setItem(key, selected);
        const agencyOptions = data.is_system_admin
          ? data.agencies || []
          : (data.agency_memberships || [])
              .map((membership) => membership.agency)
              .filter(Boolean);
        const agencyKey = `suth_active_agency_${data.user.id}`;
        const savedAgency = localStorage.getItem(agencyKey);
        const selectedAgency = agencyOptions.some(
          (agency) => String(agency.id) === String(savedAgency),
        )
          ? String(savedAgency)
          : String(agencyOptions[0]?.id || "");
        setActiveAgencyState(selectedAgency);
        if (selectedAgency) localStorage.setItem(agencyKey, selectedAgency);
        else localStorage.removeItem(agencyKey);
      })
      .catch(() => alive && setAuthorization(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [authorizationVersion]);
  const setActiveOrganization = (value) => {
    const next = String(value);
    setActiveOrganizationState(next);
    if (authorization?.user?.id)
      localStorage.setItem(
        `suth_active_organization_${authorization.user.id}`,
        next,
      );
  };
  const setActiveAgency = (value) => {
    const next = String(value || "");
    setActiveAgencyState(next);
    if (!authorization?.user?.id) return;
    const key = `suth_active_agency_${authorization.user.id}`;
    if (next) localStorage.setItem(key, next);
    else localStorage.removeItem(key);
  };
  const permissions = useMemo(() => {
    if (!authorization || authorization.is_system_admin) return new Set();
    if (authorization.access_mode === "agency")
      return permissionMap(authorization.agency_permissions || []);
    const membership = authorization.memberships?.find(
      (item) => String(item.organization.id) === String(activeOrganization),
    );
    return permissionMap(membership?.permissions || []);
  }, [authorization, activeOrganization]);
  const value = useMemo(
    () => ({
      loading,
      authorization,
      activeOrganization,
      setActiveOrganization,
      activeAgency,
      setActiveAgency,
      refreshAuthorization,
      permissions,
      can: (module, level = "view") =>
        canAccess(
          permissions,
          module,
          level,
          Boolean(authorization?.is_system_admin),
        ),
    }),
    [loading, authorization, activeOrganization, activeAgency, permissions],
  );
  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
export const usePermissions = () => useContext(PermissionsContext);
