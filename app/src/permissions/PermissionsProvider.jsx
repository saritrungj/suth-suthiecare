import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getAuthorization, getSchoolAccess } from "../services/api";
import { canAccess, permissionMap } from "./permissionRegistry";
import {
  getActiveOrganizationType,
  selectInitialOrganization,
} from "./organizationContext";

const PermissionsContext = createContext({
  loading: true,
  can: () => false,
  permissions: new Set(),
  authorization: null,
  activeOrganization: null,
  activeOrganizationType: null,
  schoolAccess: null,
  schoolAccessLoading: false,
  setActiveOrganization: () => {},
});

export function PermissionsProvider({ children }) {
  const [authorization, setAuthorization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeOrganization, setActiveOrganizationState] = useState(null);
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
      })
      .catch(() => alive && setAuthorization(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);
  const setActiveOrganization = (value) => {
    const next = selectInitialOrganization(authorization, value);
    setActiveOrganizationState(next);
    if (authorization?.user?.id)
      localStorage.setItem(
        `suth_active_organization_${authorization.user.id}`,
        next,
      );
  };
  const activeOrganizationType = getActiveOrganizationType(
    authorization,
    activeOrganization,
  );
  // School organizations also expose who is a teacher of which classrooms;
  // menus and school pages read it from here.
  // Remembers which organization the access belongs to, so a page never acts
  // on a missing or stale answer while the request is in flight.
  const [schoolAccessState, setSchoolAccessState] = useState({
    organization: null,
    data: null,
  });
  useEffect(() => {
    if (activeOrganizationType !== "school") return undefined;
    let alive = true;
    getSchoolAccess()
      .then(
        ({ data }) =>
          alive &&
          setSchoolAccessState({ organization: activeOrganization, data }),
      )
      .catch(
        () =>
          alive &&
          setSchoolAccessState({
            organization: activeOrganization,
            data: null,
          }),
      );
    return () => {
      alive = false;
    };
  }, [activeOrganizationType, activeOrganization]);
  const schoolAccessLoading =
    activeOrganizationType === "school" &&
    schoolAccessState.organization !== activeOrganization;
  const schoolAccess =
    activeOrganizationType === "school" && !schoolAccessLoading
      ? schoolAccessState.data
      : null;
  const permissions = useMemo(() => {
    if (!authorization || authorization.is_system_admin === true)
      return new Set();
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
      activeOrganizationType,
      schoolAccess,
      schoolAccessLoading,
      setActiveOrganization,
      permissions,
      can: (module, level = "view") =>
        canAccess(
          permissions,
          module,
          level,
          authorization?.is_system_admin === true,
        ),
    }),
    [
      loading,
      authorization,
      activeOrganization,
      activeOrganizationType,
      schoolAccess,
      schoolAccessLoading,
      permissions,
    ],
  );
  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}
export const usePermissions = () => useContext(PermissionsContext);
