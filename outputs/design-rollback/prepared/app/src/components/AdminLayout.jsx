import React, {useRef} from "react";
import OrganizationWorkspace from "../permissions/OrganizationWorkspace";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ExportProvider, ExportToolbar } from "./ExcelExport";
import { usePermissions } from "../permissions/PermissionsProvider";
import AdminScrollToTop from './AdminScrollToTop';
import '../styles/admin-theme.css';

const AdminLayout = () => {
  const { pathname } = useLocation();
  const hospital = /^\/admin\/(clinics|schedule)(\/|$)/.test(pathname);
  const requiresUnit = hospital || /^\/admin\/(forms|referrals|help-center)(\/|$)/.test(pathname);
  const { activeOrganization } = usePermissions();
  const contentRef=useRef(null);
  return (
    <div
      className="admin-shell"
      style={{
        display: "flex",
        width: "100%",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <a className="suth-skip-link" href="#admin-workspace" onClick={event => {
        event.preventDefault(); contentRef.current?.focus();
      }}>ข้ามไปยังเนื้อหาหลัก</a>
      <Sidebar />
      <div
        className="admin-shell-content"
        id="admin-workspace"
        tabIndex={-1}
        ref={contentRef}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        <ExportProvider><ExportToolbar />{requiresUnit ? <OrganizationWorkspace type={hospital ? "hospital" : undefined}><Outlet key={activeOrganization || "authorization-loading"} /></OrganizationWorkspace> : <Outlet key={activeOrganization || "authorization-loading"} />}</ExportProvider>
        <AdminScrollToTop key={activeOrganization || 'loading'} contentRef={contentRef}/>
      </div>
    </div>
  );
};

export default AdminLayout;
