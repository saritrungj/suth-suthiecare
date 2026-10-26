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
import RolesRoute from "./permissions/RolesRoute";
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
const ReferralApprovals = lazy(() => import("./pages/admin/ReferralApprovals"));
const RolesPermissions = lazy(() => import("./pages/admin/RolesPermissions"));
const UserManagement = lazy(() => import("./pages/admin/UserManagement"));
const BannerManagement = lazy(() => import("./pages/admin/BannerManagement"));
const ResultImageManager = lazy(
  () => import("./pages/admin/resultImages/ResultImageManager"),
);
const MasterData = lazy(() => import("./pages/admin/MasterData"));
const SchoolWorkflows = lazy(
  () => import("./pages/admin/school/SchoolWorkflows"),
);
const PatientVerifyEmail = lazy(
  () => import("./pages/patient/PatientVerifyEmail"),
);
const MyProfile = lazy(() => import("./pages/admin/MyProfile"));
const ManualCenter = lazy(() => import("./pages/admin/manual/ManualCenter"));
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
const SchoolDashboard = lazy(
  () => import("./pages/admin/school/SchoolDashboard"),
);
const SchoolStructure = lazy(
  () => import("./pages/admin/school/SchoolStructure"),
);
const StudentList = lazy(() => import("./pages/admin/school/StudentList"));
const StudentFilePage = lazy(
  () => import("./pages/admin/school/StudentFilePage"),
);
const StudentImport = lazy(() => import("./pages/admin/school/StudentImport"));
const TeacherList = lazy(() => import("./pages/admin/school/TeacherList"));
const SchoolAppointments = lazy(
  () => import("./pages/admin/school/SchoolAppointments"),
);
const AuditHistory = lazy(() => import("./pages/admin/AuditHistory"));
const SchoolReports = lazy(() => import("./pages/admin/school/SchoolReports"));
const SchoolDocuments = lazy(
  () => import("./pages/admin/school/SchoolDocuments"),
);
const FollowUps = lazy(() => import("./pages/admin/school/FollowUps"));
const BehaviorReports = lazy(
  () => import("./pages/admin/school/BehaviorReports"),
);
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
          color: "var(--suth-muted)",
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
                fontFamily: "var(--suth-font)",
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
              path="/account/verify-email"
              element={<PatientVerifyEmail />}
            />
            <Route
              path="/account/change-password"
              element={<PatientChangePassword />}
            />
            <Route path="/help-center" element={<HelpCenterUser />} />
            <Route
              path="/help-center/clinic/:id"
              element={<ClinicHelpDetail />}
            />
            <Route path="/401" element={<StatusPage status={401} />} />
            <Route path="/403" element={<StatusPage status={403} />} />
            <Route path="/404" element={<StatusPage status={404} />} />
            <Route path="/500" element={<StatusPage status={500} />} />
            <Route path="/503" element={<StatusPage status={503} />} />
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
                    <OrganizationTypeSwitch
                      school={
                        <SchoolRoute check="can_view_students">
                          <SchoolDashboard />
                        </SchoolRoute>
                      }
                    >
                      <Dashboard />
                    </OrganizationTypeSwitch>
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
                path="referrals/approvals"
                element={
                  <PermissionRoute module="referral_approvals.view">
                    <ReferralApprovals />
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
                  <PermissionRoute module="roles.manage" systemAdminOnly>
                    <RolesPermissions />
                  </PermissionRoute>
                }
              />
              <Route
                path="audit"
                element={
                  <PermissionRoute module="audit.view">
                    <AuditHistory />
                  </PermissionRoute>
                }
              />
              <Route
                path="users"
                element={
                  <RolesRoute>
                    <UserManagement initialTab="staff" />
                  </RolesRoute>
                }
              />
              <Route
                path="members"
                element={
                  <PermissionRoute module="User Management">
                    <UserManagement initialTab="members" />
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
                      <CaseData key="risk-cases" initialRisk="สูง" />
                    </PermissionRoute>
                  </OrganizationTypeSwitch>
                }
              />
              <Route
                path="result-images"
                element={
                  <PermissionRoute module="Form Management">
                    <ResultImageManager />
                  </PermissionRoute>
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
                path="school/students/:studentId"
                element={
                  <SchoolRoute check="can_view_students">
                    <StudentFilePage />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/import"
                element={
                  <SchoolRoute check="can_view_school">
                    <StudentImport />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/students/import"
                element={<Navigate to="/admin/school/import" replace />}
              />
              <Route
                path="school/teachers"
                element={
                  <SchoolRoute check="can_view_school">
                    <TeacherList />
                  </SchoolRoute>
                }
              />
              {/* Teacher and student types are master data categories now. */}
              <Route
                path="school/types"
                element={
                  <Navigate
                    to="/admin/master-data?category=teacher_types"
                    replace
                  />
                }
              />
              <Route
                path="master-data"
                element={
                  <PermissionRoute module="master_data.view">
                    <MasterData />
                  </PermissionRoute>
                }
              />
              <Route
                path="school/roles"
                element={<Navigate to="/admin/users" replace />}
              />
              <Route
                path="school/behavior"
                element={
                  <SchoolRoute check="can_use_behavior">
                    <BehaviorReports />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/appointments"
                element={
                  <SchoolRoute check="can_use_appointments">
                    <SchoolAppointments />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/reports"
                element={
                  <SchoolRoute check="can_view_reports">
                    <SchoolReports />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/documents"
                element={
                  <SchoolRoute check="can_use_documents">
                    <SchoolDocuments />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/follow-ups"
                element={
                  <SchoolRoute check="can_view_physical">
                    <FollowUps />
                  </SchoolRoute>
                }
              />
              <Route
                path="school/workflows"
                element={
                  <SchoolRoute check="can_view_school">
                    <SchoolWorkflows />
                  </SchoolRoute>
                }
              />
              {/* Every signed-in staff member manages their own account. */}
              <Route path="profile" element={<MyProfile />} />
              {/* User guides, filtered by role inside the page. */}
              <Route path="manual" element={<ManualCenter />} />
            </Route>
            <Route path="*" element={<StatusPage status={404} />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
