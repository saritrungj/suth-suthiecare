import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { lazy, Suspense, useEffect, useState } from "react";

import Login from "./pages/login/Login";
import SutLanding2 from "./pages/sutlanding/SutLanding2";
import ClinicManager from "./pages/admin/clinics/ClinicManager";
import HelpCenterManager from "./pages/admin/HelpCenterManager";
import HelpCenterUser from "./pages/helpCenter/HelpCenterUser";
import ClinicHelpDetail from "./pages/helpCenter/ClinicHelpDetail";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { PermissionsProvider } from "./permissions/PermissionsProvider";
import PermissionRoute from "./permissions/PermissionRoute";
import PatientProtectedRoute from "./permissions/PatientProtectedRoute";
import PatientLogin from "./pages/patient/PatientLogin";
import PatientRegister from "./pages/patient/PatientRegister";
import SeoMetadata from "./components/SeoMetadata";
import StatusPage from "./pages/errors/StatusPage";
import OrganizationManagement from "./pages/admin/OrganizationManagement";

// ✅ Lazy load ทุกหน้าที่เหลือ
const AssessmentResult = lazy(() => import("./pages/result/AssessmentResult"));
const Dashboard = lazy(() => import("./pages/admin/dashboard"));
const FormManager = lazy(() => import("./pages/admin/forms/FormManager"));
const FormBuilder = lazy(() => import("./pages/admin/forms/FormBuilder"));
const Appointment = lazy(() => import("./pages/admin/Appointment"));
const CaseData = lazy(() => import("./pages/admin/CaseData"));
const RolesPermissions = lazy(() => import("./pages/admin/RolesPermissions"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const RiskCases = lazy(() => import("./pages/admin/RiskCases"));
const BannerManagement = lazy(() => import("./pages/admin/BannerManagement"));
const FormView = lazy(() => import("./pages/assessment/formView/FormView"));
const HistorySearch = lazy(
  () => import("./pages/assessment/history/HistorySearch"),
);
const HistoryResult = lazy(
  () => import("./pages/assessment/history/HistoryResult"),
);
const AdminLayout = lazy(() => import("./components/AdminLayout"));
const ClinicDetail = lazy(
  () => import("./pages/assessment/history/ClinicDetail"),
);

const AdminRoute = ({ children }) => {
  const userStr =
    sessionStorage.getItem("suth_user") || localStorage.getItem("suth_user");

  if (!userStr) return <Navigate to="/login" replace />;
  try {
    JSON.parse(userStr);
  } catch {
    sessionStorage.removeItem("suth_user");
    localStorage.removeItem("suth_user");
    return <Navigate to="/login" replace />;
  }
  return children;
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const isAdminPath = window.location.pathname.startsWith("/admin");

    const syncSession = (event) => {
      // 🟢 1. ระบบ Global Logout: ถ้ามีแท็บนึงสั่ง Logout แท็บอื่นต้องเด้งออกด้วย
      if (event.key === "SUTH_LOGOUT") {
        sessionStorage.removeItem("suth_token");
        sessionStorage.removeItem("suth_user");
        if (isAdminPath) window.location.href = "/login";
      }

      // 2. ถ้าแท็บอื่นขอข้อมูลมา ให้ส่งกลับไป (ถ้าเรามี)
      if (
        event.key === "REQUEST_SESSION_SYNC" &&
        sessionStorage.getItem("suth_token")
      ) {
        localStorage.setItem(
          "SESSION_SYNC_DATA",
          JSON.stringify({
            token: sessionStorage.getItem("suth_token"),
            user: sessionStorage.getItem("suth_user"),
          }),
        );
        localStorage.removeItem("SESSION_SYNC_DATA");
      }

      // 3. รับข้อมูลกลับมา แล้วเข้าสู่ระบบให้
      if (event.key === "SESSION_SYNC_DATA" && event.newValue) {
        const data = JSON.parse(event.newValue);
        if (data.token && data.user) {
          sessionStorage.setItem("suth_token", data.token);
          sessionStorage.setItem("suth_user", data.user);
          setIsInitializing(false);
        }
      }
    };

    window.addEventListener("storage", syncSession);

    // 🟢 4. ขอ Sync ข้อมูล "เฉพาะ" ตอนที่อยู่หน้า Admin เท่านั้น
    if (
      isAdminPath &&
      !sessionStorage.getItem("suth_token") &&
      !localStorage.getItem("suth_token")
    ) {
      localStorage.setItem("REQUEST_SESSION_SYNC", Date.now().toString());
      localStorage.removeItem("REQUEST_SESSION_SYNC");

      const timer = setTimeout(() => setIsInitializing(false), 300);
      return () => {
        window.removeEventListener("storage", syncSession);
        clearTimeout(timer);
      };
    } else {
      setIsInitializing(false);
    }

    return () => window.removeEventListener("storage", syncSession);
  }, []);

  const isAdminPath = window.location.pathname.startsWith("/admin");

  if (isInitializing && isAdminPath) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "#64748b",
        }}
      >
        กำลังเชื่อมต่อข้อมูล...
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <SeoMetadata />
        <Suspense
          fallback={
            <div
              role="status"
              style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                fontFamily: "Sarabun, system-ui, sans-serif",
              }}
            >
              กำลังโหลดข้อมูล...
            </div>
          }
        >
          <Routes>
        <Route path="/" element={<SutLanding2 />} />
        <Route path="/login" element={<Login />} />
        <Route path="/account/login" element={<PatientLogin />} />
        <Route path="/account/register" element={<PatientRegister />} />
        <Route path="/help-center" element={<HelpCenterUser />} />
          <Route path="/help-center/clinic/:id" element={<ClinicHelpDetail />} />
        <Route path="/403" element={<StatusPage status={403} />} />
        <Route path="/404" element={<StatusPage status={404} />} />
        <Route path="/500" element={<StatusPage status={500} />} />

        <Route path="/assessment-result" element={<AssessmentResult />} />
        <Route path="/assessment/:id" element={<FormView />} />
        <Route path="/history" element={<PatientProtectedRoute><HistorySearch /></PatientProtectedRoute>} />
        <Route path="/history/result" element={<PatientProtectedRoute><HistoryResult /></PatientProtectedRoute>} />
        <Route path="/clinic-detail" element={<PatientProtectedRoute><ClinicDetail /></PatientProtectedRoute>} />

        <Route
          path="/admin"
          element={
              <AdminRoute><PermissionsProvider><AdminLayout /></PermissionsProvider></AdminRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PermissionRoute module="Dashboard"><Dashboard /></PermissionRoute>} />
          <Route path="forms" element={<PermissionRoute module="Form Management"><FormManager /></PermissionRoute>} />
          <Route path="forms/create" element={<PermissionRoute module="Form Management"><FormBuilder /></PermissionRoute>} />
          <Route path="forms/edit/:id" element={<PermissionRoute module="Form Management"><FormBuilder /></PermissionRoute>} />
          <Route path="schedule" element={<PermissionRoute module="Appointments"><Appointment /></PermissionRoute>} />
          <Route path="cases" element={<PermissionRoute module="Case Management"><CaseData /></PermissionRoute>} />
          <Route path="roles" element={<PermissionRoute module="Roles & Permissions"><RolesPermissions /></PermissionRoute>} />
          <Route path="users" element={<PermissionRoute module="User Management"><UserManagement initialTab="staff" standalone /></PermissionRoute>} />
          <Route path="members" element={<PermissionRoute module="User Management"><UserManagement initialTab="members" standalone /></PermissionRoute>} />
          <Route path="risk-cases" element={<PermissionRoute module="Case Management"><RiskCases /></PermissionRoute>} />
          <Route path="banner" element={<PermissionRoute module="Content Management"><BannerManagement /></PermissionRoute>} />
          <Route path="clinics" element={<PermissionRoute module="Clinic Management"><ClinicManager /></PermissionRoute>} />
          <Route path="help-center" element={<PermissionRoute module="Help Center Management"><HelpCenterManager /></PermissionRoute>} />
          <Route path="organizations" element={<PermissionRoute module="organizations.manage"><OrganizationManagement /></PermissionRoute>} />
        </Route>
            <Route path="*" element={<StatusPage status={404} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
