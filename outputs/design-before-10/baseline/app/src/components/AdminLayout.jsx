import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ExportProvider, ExportToolbar } from "./ExcelExport";
import { usePermissions } from "../permissions/PermissionsProvider";

const AdminLayout = () => {
  const { activeOrganization } = usePermissions();
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
        <ExportProvider><ExportToolbar /><Outlet key={activeOrganization || "authorization-loading"} /></ExportProvider>
      </div>
    </div>
  );
};

export default AdminLayout;
