import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { usePermissions } from "../permissions/PermissionsProvider";

const AdminLayout = () => {
  const { activeOrganization, activeAgency } = usePermissions();
  const { pathname } = useLocation();
  const agencyPage =
    /^\/admin\/(agencies|agency-checkup-forms|agency-entry|agency-records)(\/|$)/.test(
      pathname,
    );
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <Sidebar />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <Outlet
          key={
            agencyPage
              ? `agency-${activeAgency || "none"}`
              : activeOrganization || "authorization-loading"
          }
        />
      </div>
    </div>
  );
};

export default AdminLayout;
