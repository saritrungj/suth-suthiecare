import {
  authSession,
  bootstrapAuth,
  subscribeAuthSession,
} from "./utils/authSession";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { lazy, Suspense, useEffect, useState } from "react";

import Login from "./pages/login/Login";
import SutLanding2 from "./pages/sutlanding/SutLanding2";
import ClinicManager from "./pages/admin/clinics/ClinicManager";
import HelpCenterManager from "./pages/admin/HelpCenterManager";
import HelpCenterUser from "./pages/helpCenter/HelpCenterUser";
import ClinicHelpDetail from "./pages/helpCenter/ClinicHelpDetail";
import AppErrorBoundary from "./components/AppErrorBoundary";
import {
  PermissionsProvider,
  usePermissions,
} from "./permissions/PermissionsProvider";
import { adminHomePath } from "./permissions/sidebarPolicy";
import PermissionRoute from "./permissions/PermissionRoute";
import PatientProtectedRoute from "./permissions/PatientProtectedRoute";
import PatientLogin from "./pages/patient/PatientLogin";
import PatientRegister from "./pages/patient/PatientRegister";
import PatientChangePassword from "./pages/patient/PatientChangePassword";
import SchoolRoute from "./permissions/SchoolRoute";
import OrganizationTypeSwitch from "./permissions/OrganizationTypeSwitch";
import SeoMetadata from "./components/SeoMetadata";
import StatusPage from "./pages/errors/StatusPage";
import LegalPage from "./pages/legal/LegalPage";
import OrganizationManagement from "./pages/admin/OrganizationManagement";
import PwaInstallPrompt from "./components/PwaInstallPrompt";

// ✅ Lazy load ทุกหน้าที่เหลือ
const AssessmentResult = lazy(() => import("./pages/result/AssessmentResult"));
const Dashboard = lazy(() => import("./pages/admin/dashboard"));
const FormManager = lazy(() => import("./pages/admin/forms/FormManager"));
const FormBuilder = lazy(() => import("./pages/admin/forms/FormBuilder"));
const Appointment = lazy(() => import("./pages/admin/Appointment"));
const CaseData = lazy(() => import("./pages/admin/CaseData"));
const CaseReferrals = lazy(() => import("./pages/admin/CaseReferrals"));
const RolesPermissions = lazy(() => import("./pages/admin/RolesPermissions"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const RiskCases = lazy(() => import("./pages/admin/RiskCases"));
const BannerManagement = lazy(() => import("./pages/admin/BannerManagement"));
const MyProfile = lazy(() => import("./pages/admin/MyProfile"));
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
const SchoolStructure = lazy(
  () => import("./pages/admin/school/SchoolStructure"),
);
const StudentList = lazy(() => import("./pages/admin/school/StudentList"));
const StudentImport = lazy(() => import("./pages/admin/school/StudentImport"));
const TeacherList = lazy(() => import("./pages/admin/school/TeacherList"));
const SchoolTypes = lazy(() => import("./pages/admin/school/SchoolTypes"));
const SchoolCaseData = lazy(
  () => import("./pages/admin/school/SchoolCaseData"),
);

const AdminRoute = ({ children }) => {
  if (!authSession("staff").user) return <Navigate to="/login" replace />;
  return children;
};

const AdminHome = () => {
  const {
    loading,
    authorization,
    activeOrganizationType,
    schoolAccess,
    schoolAccessLoading,
    can,
  } = usePermissions();
  if (loading || schoolAccessLoading)
    return <div role="status">กำลังตรวจสอบสิทธิ์...</div>;
  return (
    <Navigate
      to={adminHomePath({
        authorization,
        organizationType: activeOrganizationType,
        schoolAccess,
        can,
      })}
      replace
    />
  );
};

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [, refreshSession] = useState(0);
  useEffect(
    () => subscribeAuthSession(() => refreshSession((value) => value + 1)),
    [],
  );

  useEffect(() => {
    let alive = true;
    bootstrapAuth().finally(() => alive && setIsInitializing(false));
    return () => {
      alive = false;
    };
  }, []);

  const isAdminPath = window.location.pathname.startsWith("/admin");

  if (isInitializing) {
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
        <PwaInstallPrompt />
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
            <Route
              path="/account/change-password"
              element={<PatientChangePassword />}
            />
            <Route path="/help-center" element={<HelpCenterUser />} />
            <Route
              path="/help-center/clinic/:id"
              element={<ClinicHelpDetail />}
            />
            <Route path="/403" element={<StatusPage status={403} />} />
            <Route path="/404" element={<StatusPage status={404} />} />
            <Route path="/500" element={<StatusPage status={500} />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />
            <Route
              path="/privacy-policy"
              element={<LegalPage kind="privacy" />}
            />

            <Route path="/assessment-result" element={<AssessmentResult />} />
            <Route path="/assessment/:id" element={<FormView />} />
            <Route
              path="/history"
              element={
                <PatientProtectedRoute>
                  <HistorySearch />
                </PatientProtectedRoute>
              }
            />
            <Route
              path="/history/result"
              element={
                <PatientProtectedRoute>
                  <HistoryResult />
                </PatientProtectedRoute>
              }
            />
            <Route
              path="/clinic-detail"
              element={
                <PatientProtectedRoute>
                  <ClinicDetail />
                </PatientProtectedRoute>
              }
            />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <PermissionsProvider>
                    <AdminLayout />
                  </PermissionsProvider>
                </AdminRoute>
              }
            >
              <Route index element={<AdminHome />} />
              <Route
                path="dashboard"
                element={
                  <PermissionRoute module="Dashboard">
                    <Dashboard />
                  </PermissionRoute>
                }
              />
              <Route
                path="forms"
                element={
                  <PermissionRoute module="Form Management">
                    <FormManager />
                  </PermissionRoute>
                }
              />
              <Route
                path="forms/create"
                element={
                  <PermissionRoute module="Form Management">
                    <FormBuilder />
                  </PermissionRoute>
                }
              />
              <Route
                path="forms/edit/:id"
                element={
                  <PermissionRoute module="Form Management">
                    <FormBuilder />
                  </PermissionRoute>
                }
              />
              <Route
                path="schedule"
                element={
                  <PermissionRoute module="Appointments">
                    <Appointment />
                  </PermissionRoute>
                }
              />
              <Route
                path="referrals"
                element={
                  <PermissionRoute module="Case Management">
                    <CaseReferrals />
                  </PermissionRoute>
                }
              />
              <Route
                path="cases"
                element={
                  <OrganizationTypeSwitch
                    school={
                      <SchoolRoute check="can_view_health">
                        <SchoolCaseData />
                      </SchoolRoute>
                    }
                  >
                    <PermissionRoute module="Case Management">
                      <CaseData />
                    </PermissionRoute>
                  </OrganizationTypeSwitch>
                }
              />
              <Route
                path="roles"
                element={
                  <PermissionRoute module="Roles & Permissions" systemAdminOnly>
                    <RolesPermissions />
                  </PermissionRoute>
                }
              />
              <Route
                path="users"
                element={
                  <PermissionRoute module="User Management" systemAdminOnly>
                    <UserManagement initialTab="staff" standalone />
                  </PermissionRoute>
                }
              />
              <Route
                path="members"
                element={
                  <PermissionRoute module="User Management">
                    <UserManagement initialTab="members" standalone />
                  </PermissionRoute>
                }
              />
              <Route
                path="risk-cases"
                element={
                  <OrganizationTypeSwitch
                    school={
                      <SchoolRoute check="can_view_health">
                        <SchoolCaseData initialRisk="high" />
                      </SchoolRoute>
                    }
                  >
                    <PermissionRoute module="Case Management">
                      <RiskCases />
                    </PermissionRoute>
                  </OrganizationTypeSwitch>
                }
              />
              <Route
                path="banner"
                element={
                  <PermissionRoute module="Content Management" systemAdminOnly>
                    <BannerManagement />
                  </PermissionRoute>
                }
              />
              <Route
                path="clinics"
                element={
                  <PermissionRoute module="Clinic Management">
                    <ClinicManager />
                  </PermissionRoute>
                }
              />
              <Route
                path="help-center"
                element={
                  <PermissionRoute module="Help Center Management">
                    <HelpCenterManager />
                  </PermissionRoute>
                }
              />
              <Route
                path="organizations"
                element={
                  <PermissionRoute
                    module="organizations.manage"
                    systemAdminOnly
                  >
                    <OrganizationManagement />
                  </PermissionRoute>
                }
              />
              <Route
                path="school"
                element={
                  <SchoolRoute check="can_view_school">
                    <SchoolStructure />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/students"
                element={
                  <SchoolRoute check="can_view_students">
                    <StudentList />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/students/import"
                element={
                  <SchoolRoute check="can_create_students">
                    <StudentImport />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/teachers"
                element={
                  <SchoolRoute check="can_view_school">
                    <TeacherList />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/types"
                element={
                  <SchoolRoute check="can_view_school">
                    <SchoolTypes />
                  </SchoolRoute>
                }
              />
              {/* Every signed-in staff member manages their own account. */}
              <Route path="profile" element={<MyProfile />} />
            </Route>
            <Route path="*" element={<StatusPage status={404} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
