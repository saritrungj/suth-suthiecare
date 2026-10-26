import {
  authSession,
  captureAuthResponse,
  clearAuthSession,
} from "../utils/authSession";
import axios from "axios";
import { clearPatientSession } from "../utils/patientSession";

const apiBaseUrl = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    "Bypass-Tunnel-Reminder": "true",
    "ngrok-skip-browser-warning": "69420",
    "x-tunnel-skip-anti-phishing-page": "true",
  },
});

const resolveApiAssetUrl = (value) => {
  if (!value || !value.startsWith("/api/")) return value;
  const apiBase = String(import.meta.env.VITE_API_URL || "/api").replace(
    /\/$/,
    "",
  );
  return `${apiBase.replace(/\/api$/, "")}${value}`;
};

// ── Users ──
export const getUsers = () => api.get("/users");
export const getPatientMembers = (params, config = {}) =>
  api.get("/patient-members", { ...config, params });
export const getPatientMember = (id, config) =>
  api.get(`/patient-members/${id}`, config);
export const updatePatientMember = (id, data, config) =>
  api.put(`/patient-members/${id}`, data, config);
export const deletePatientMember = (id) => api.delete(`/patient-members/${id}`);
export const getUserFull = (id) => api.get(`/users/${id}/full`);
export const getUserAssignmentOptions = () =>
  api.get("/users/assignment-options");
export const createUser = (data) => api.post("/users", data);
export const updateUser = (id, data) => api.put(`/users/${id}`, data);
export const updateUserAssignments = (id, memberships) =>
  api.put(`/users/${id}/assignments`, { memberships });
export const deleteUser = (id) => api.delete(`/users/${id}`);

// ── Auth ──
export const loginApi = (credentials) => api.post("/login", credentials);
export const verifyStaffOtpApi = (data) => api.post("/login/verify-otp", data);
export const verifyStaffEmailApi = (data) => api.post("/email/verify", data);
export const resendStaffOtpApi = (data) => api.post("/login/resend-otp", data);
export const requestStaffPasswordRecoveryApi = (data) =>
  api.post("/password-recovery/request", data);
export const verifyStaffPasswordRecoveryApi = (data) =>
  api.post("/password-recovery/verify", data);
export const resetStaffPasswordApi = (data) =>
  api.post("/password-recovery/reset", data);
export const getAuthorization = () => api.get("/me/authorization");
export const getMyProfile = () => api.get("/me/profile");
export const updateMyProfile = (data) => api.put("/me/profile", data);
export const changeMyPassword = (data) => api.put("/me/password", data);
export const changeMyEmail = (data) => api.put("/me/email", data);
export const getOrganizations = () => api.get("/organizations");
export const createOrganization = (data) => api.post("/organizations", data);
export const updateOrganization = (id, data) =>
  api.put(`/organizations/${id}`, data);

const patientApi = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { "ngrok-skip-browser-warning": "true" },
});

patientApi.interceptors.request.use((config) => {
  const session = authSession("patient");
  if (session.csrf) config.headers["X-CSRF-Token"] = session.csrf;
  return config;
});

patientApi.interceptors.response.use(
  (res) => {
    captureAuthResponse("patient", res.data);
    return res;
  },
  (error) => {
    if (error.response?.status === 401) {
      clearPatientSession();
      if (window.location.pathname.startsWith("/history")) {
        window.location.href = `/account/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    // Accounts created by a school import must set their own password first.
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === "PASSWORD_CHANGE_REQUIRED" &&
      !window.location.pathname.startsWith("/account/change-password")
    ) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      window.location.href = `/account/change-password?returnTo=${encodeURIComponent(returnTo)}`;
    }
    return Promise.reject(error);
  },
);

export const patientLoginApi = (credentials) =>
  patientApi.post("/patient-auth/login", credentials);
export const patientRegisterApi = (data) =>
  patientApi.post("/patient-auth/register", data);
export const verifyPatientEmailApi = (data) =>
  patientApi.post("/patient-auth/email/verify", data);
export const requestPatientOnboardingEmailApi = () =>
  patientApi.post("/patient-auth/email/onboarding/request");
export const resendPatientEmailApi = (data) =>
  patientApi.post("/patient-auth/email/resend", data);
export const requestPatientPasswordRecoveryApi = (data) =>
  patientApi.post("/patient-auth/password-recovery/request", data);
export const verifyPatientPasswordRecoveryApi = (data) =>
  patientApi.post("/patient-auth/password-recovery/verify", data);
export const resetPatientPasswordApi = (data) =>
  patientApi.post("/patient-auth/password-recovery/reset", data);
export const patientLogoutApi = () => patientApi.post("/patient-auth/logout");
export const changePatientPasswordApi = (data) =>
  patientApi.post("/patient-auth/password/change", data);
export const getPatientMe = () => patientApi.get("/patient/me");
export const updatePatientEmail = (email) =>
  patientApi.patch("/patient/me/email", { email });
export const verifyPatientEmailChange = (data) =>
  patientApi.post("/patient/me/email/verify", data);
export const resendPatientEmailChange = (data) =>
  patientApi.post("/patient/me/email/resend", data);
export const getPatientHistory = () => patientApi.get("/patient/history");
export const getPatientSchoolHealth = () =>
  patientApi.get("/patient/me/school-health");
export const getPatientAssessmentTasks = () =>
  patientApi.get("/patient/me/assessment-tasks");
export const updatePatientMemberType = (data) =>
  patientApi.put("/patient/me/member-type", data);
export const getPatientCaseLogs = (id) =>
  patientApi.get(`/patient/history/responses/${id}/logs`);
export const getPatientCaseAnswers = (id) =>
  patientApi.get(`/patient/history/responses/${id}/answers`);
export const updatePatientHistoryResponse = (id, data) =>
  patientApi.patch(`/patient/history/responses/${id}`, data);
export const updatePatientHistoryAnswer = (responseId, questionId, value) =>
  patientApi.patch(
    `/patient/history/responses/${responseId}/answers/${questionId}`,
    { value },
  );

// ── School (หน่วยงานประเภทโรงเรียน) ──
export const getSchoolAccess = () => api.get("/school/access");
export const getSchoolNotifications = (params) =>
  api.get("/school/notifications", { params });
export const getSchoolNotificationCount = () =>
  api.get("/school/notifications/unread-count");
export const readSchoolNotification = (id) =>
  api.put(`/school/notifications/${id}/read`);
export const ackSchoolNotification = (id) =>
  api.put(`/school/notifications/${id}/ack`);
export const readAllSchoolNotifications = () =>
  api.put("/school/notifications/read-all");
export const getBehaviorOptions = () =>
  api.get("/school/behavior-reports/options");
export const getBehaviorReports = (params) =>
  api.get("/school/behavior-reports", { params });
export const getBehaviorReport = (id) =>
  api.get(`/school/behavior-reports/${id}`);
export const createBehaviorReport = (data) =>
  api.post("/school/behavior-reports", data);
export const updateBehaviorStatus = (id, data) =>
  api.put(`/school/behavior-reports/${id}/status`, data);
export const assignBehaviorReport = (id, assigned_to) =>
  api.put(`/school/behavior-reports/${id}/assign`, { assigned_to });
export const getPhysicalRules = (school_id) =>
  api.get("/school/physical-risk-rules", { params: { school_id } });
export const createPhysicalRule = (data) =>
  api.post("/school/physical-risk-rules", data);
export const updatePhysicalRule = (id, data) =>
  api.put(`/school/physical-risk-rules/${id}`, data);
export const getFollowUps = (params) =>
  api.get("/school/follow-ups", { params });
export const getFollowUp = (id) => api.get(`/school/follow-ups/${id}`);
export const updateFollowUp = (id, data) =>
  api.put(`/school/follow-ups/${id}`, data);
export const getCareGuidance = (schoolId) =>
  api.get(`/school/care-guidance/${schoolId}`);
export const saveCareGuidance = (schoolId, data) =>
  api.put(`/school/care-guidance/${schoolId}`, data);
export const getSchoolAppointments = (params) =>
  api.get("/school/appointments", { params });
export const getSchoolAppointment = (id) =>
  api.get(`/school/appointments/${id}`);
export const actOnSchoolAppointment = (id, data) =>
  api.put(`/school/appointments/${id}`, data);
export const getMyAppointmentSlots = (params) =>
  api.get("/school/appointment-slots", { params });
export const createAppointmentSlots = (data) =>
  api.post("/school/appointment-slots", data);
export const closeAppointmentSlot = (id) =>
  api.delete(`/school/appointment-slots/${id}`);
export const getAppointmentTopics = (school_id) =>
  api.get("/school/appointment-topics", { params: { school_id } });
export const saveAppointmentTopics = (data) =>
  api.put("/school/appointment-topics", data);
// The school's shared counseling schedule used by every counselor.
export const getAppointmentSchedule = (schoolId) =>
  api.get("/school/appointment-schedule", { params: { school_id: schoolId } });
export const saveAppointmentSchedule = (data) =>
  api.put("/school/appointment-schedule", data);
// Guardian sign-in accounts of one student, managed from the student file.
export const getStudentGuardians = (studentId) =>
  api.get(`/school/students/${studentId}/guardians`);
export const addStudentGuardian = (studentId, data) =>
  api.post(`/school/students/${studentId}/guardians`, data);
export const removeStudentGuardian = (studentId, userId) =>
  api.delete(`/school/students/${studentId}/guardians/${userId}`);
export const getStudentAppointments = () =>
  patientApi.get("/patient/school-appointments");
export const getStudentAppointmentOptions = () =>
  patientApi.get("/patient/school-appointments/options");
export const requestStudentAppointment = (data) =>
  patientApi.post("/patient/school-appointments", data);
export const cancelStudentAppointment = (id) =>
  patientApi.post(`/patient/school-appointments/${id}/cancel`);
export const getDocumentCategories = (school_id) =>
  api.get("/school/document-categories", { params: { school_id } });
export const saveDocumentCategories = (data) =>
  api.put("/school/document-categories", data);
export const getSchoolDocuments = (params) =>
  api.get("/school/documents", { params });
export const createSchoolDocument = (data) =>
  api.post("/school/documents", data);
export const updateSchoolDocument = (id, data) =>
  api.put(`/school/documents/${id}`, data);
export const hideSchoolDocument = (id) => api.delete(`/school/documents/${id}`);
export const downloadSchoolDocument = (id) =>
  api.get(`/school/documents/${id}/file`, { responseType: "blob" });
export const getStudentDocuments = () =>
  patientApi.get("/patient/school-documents");
export const downloadStudentDocument = (id) =>
  patientApi.get(`/patient/school-documents/${id}/file`, {
    responseType: "blob",
  });
export const getSchoolReport = (params) =>
  api.get("/school/reports/overview", { params });
export const exportSchoolReport = (params) =>
  api.get("/school/reports/overview", {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });
export const getNotificationSettings = (schoolId) =>
  api.get(`/school/notification-settings/${schoolId}`);
export const saveNotificationSettings = (schoolId, data) =>
  api.put(`/school/notification-settings/${schoolId}`, data);
export const getStudentCareGuidance = (studentId) =>
  api.get(`/school/students/${studentId}/care-guidance`);
export const cancelBehaviorReport = (id, note) =>
  api.delete(`/school/behavior-reports/${id}`, { data: { note } });
export const getSchools = () => api.get("/school/schools");
export const getSchoolGrades = (schoolId) =>
  api.get(`/school/schools/${schoolId}/grades`);
export const createSchoolGrade = (schoolId, data) =>
  api.post(`/school/schools/${schoolId}/grades`, data);
export const updateSchoolGrade = (id, data) =>
  api.put(`/school/grades/${id}`, data);
export const deleteSchoolGrade = (id) => api.delete(`/school/grades/${id}`);
export const getSchoolClassrooms = (schoolId, params) =>
  api.get(`/school/schools/${schoolId}/classrooms`, { params });
export const createSchoolClassroom = (schoolId, data) =>
  api.post(`/school/schools/${schoolId}/classrooms`, data);
export const updateSchoolClassroom = (id, data) =>
  api.put(`/school/classrooms/${id}`, data);
export const deleteSchoolClassroom = (id) =>
  api.delete(`/school/classrooms/${id}`);
export const setClassroomTeachers = (id, teachers) =>
  api.put(`/school/classrooms/${id}/teachers`, { teachers });
export const getSchoolTypes = (kind) => api.get(`/school/${kind}`);
export const getSchoolTeachers = (params) =>
  api.get("/school/teachers", { params });
export const getTeacherCandidates = (schoolId) =>
  api.get("/school/teachers/candidates", { params: { school_id: schoolId } });
export const createSchoolTeacher = (data) => api.post("/school/teachers", data);
export const updateSchoolTeacher = (id, data) =>
  api.put(`/school/teachers/${id}`, data);
export const deleteSchoolTeacher = (id) => api.delete(`/school/teachers/${id}`);
export const getSchoolStudents = (params) =>
  api.get("/school/students", { params });
export const setStudentCareStatus = (id, data) =>
  api.post(`/school/students/${id}/care-status`, data);
export const saveAcademicYearTerms = (schoolId, year, data) =>
  api.put(`/school/schools/${schoolId}/academic-years/${year}/terms`, data);
export const getSchoolStudent = (id) => api.get(`/school/students/${id}`);
export const createSchoolStudent = (data) => api.post("/school/students", data);
export const updateSchoolStudent = (id, data) =>
  api.put(`/school/students/${id}`, data);
export const deleteSchoolStudent = (id) => api.delete(`/school/students/${id}`);
export const resetStudentPassword = (id) =>
  api.post(`/school/students/${id}/reset-password`);
export const importSchoolStudents = (data) =>
  api.post("/school/students/import", data);
export const getStudentHealth = (id) =>
  api.get(`/school/students/${id}/health`);
export const updateStudentHealthProfile = (id, data) =>
  api.put(`/school/students/${id}/health-profile`, data);
export const createStudentPhysicalRecord = (id, data) =>
  api.post(`/school/students/${id}/physical-records`, data);
export const updateStudentPhysicalRecord = (id, data) =>
  api.put(`/school/physical-records/${id}`, data);
export const deleteStudentPhysicalRecord = (id) =>
  api.delete(`/school/physical-records/${id}`);
export const getSchoolCases = (params) => api.get("/school/cases", { params });
export const getCaseLastName = (id, school = false) =>
  api.get(
    school ? `/school/students/${id}/last-name` : `/cases/${id}/last-name`,
  );

// ── Dashboard ──
export const getRecentCases = (clinic, startDate, endDate, formId) =>
  api.get("/dashboard/recent", {
    params: { clinic, startDate, endDate, form_id: formId || undefined },
  });

// ── Forms ──
export const saveFormToDb = (formData) => api.post("/save-form", formData);
export const getForms = async (sortParam) => {
  const response = await api.get("/forms", { params: { sort: sortParam } });
  response.data = response.data.map((form) => ({
    ...form,
    image: resolveApiAssetUrl(form.image),
  }));
  return response;
};
export const getFormById = (id) => api.get(`/forms/${id}`);
export const updateFormInDb = (id, formData) =>
  api.put(`/forms/${id}`, formData);
export const duplicateFormInDb = (formId) => {
  return api.post(`/forms/${formId}/duplicate`);
};

// ── Clinics ──
export const getActiveClinics = () => api.get("/clinics");
export const getAllClinics = () => api.get("/clinics/all");
export const createClinic = (data) => api.post("/clinics", data);
export const updateClinic = (id, data) => api.put(`/clinics/${id}`, data);
export const deleteClinic = (id) => api.delete(`/clinics/${id}`);
export const reorderClinics = (order) =>
  api.patch("/clinics/reorder", { order });
export const toggleClinicHelpCenter = (id, showInHelpCenter) =>
  api.patch(`/clinics/${id}/toggle-help-center`, {
    show_in_help_center: showInHelpCenter,
  });

// ── เพิ่มฟังก์ชันใหม่สำหรับอัปเดตรูปปกโดยเฉพาะ ──
export const updateFormImageOnly = (id, imageData) =>
  api.patch(`/forms/${id}/image`, imageData);
export const deleteFormInDb = (id) => api.delete(`/forms/${id}`);
export const renameFormInDb = (id, newTitle) =>
  api.patch(`/forms/${id}/rename`, { title: newTitle });

// ── Form Submissions ──
export const submitFormAnswers = (formId, data) =>
  patientApi.post(`/forms/${formId}/submit`, data);
export const updateFormStatus = (id, statusData) =>
  api.patch(`/forms/${id}/status`, statusData);
export const updateFormClinicType = (id, data) =>
  api.patch(`/forms/${id}/clinic`, data);
export const getFormResponses = (formId, params) =>
  api.get(`/forms/${formId}/responses`, { params });

// ── Roles & Permissions ──
export const getOrganizationRoles = (org) =>
  api.get(`/organizations/${org}/roles`);
export const createOrganizationRole = (org, data) =>
  api.post(`/organizations/${org}/roles`, data);
export const deleteOrganizationRole = (org, role) =>
  api.delete(`/organizations/${org}/roles/${role}`);
export const getRolePermissions = (id) => api.get(`/roles/${id}/permissions`);

// ── Banner ──
export const getBanners = () => api.get("/banners");
export const createBanner = (data) => api.post("/banners", data);
export const updateBannerImage = (id, data) =>
  api.patch(`/banners/${id}/image`, data);
export const deleteBanner = (id) => api.delete(`/banners/${id}`);
export const reorderBanners = (data) => api.post("/banners/reorder", data);

// ── Result images (per organization) ──
export const getFormResultImages = (formId) =>
  api.get(`/result-images/forms/${formId}`);
export const getResultImages = () => api.get("/admin/result-images");
export const saveResultImage = (level, data) =>
  api.put(`/admin/result-images/${level}`, data);
export const resetResultImage = (level) =>
  api.delete(`/admin/result-images/${level}`);
export const addResultImageAsset = (data) =>
  api.post("/admin/result-images/assets", data);
export const deleteResultImageAsset = (id) =>
  api.delete(`/admin/result-images/assets/${id}`);
export const saveResultPageTexts = (texts) =>
  api.put("/admin/result-images/texts", { texts });

//--- services ---//
export const getServices = () => api.get("/services");
export const createService = (data) => api.post("/services", data);
export const updateService = (id, data) => api.put(`/services/${id}`, data);
export const deleteService = (id) => api.delete(`/services/${id}`);

//--- risks ---//

//--- appointments ---//
export const getAppointments = (params) => api.get("/appointments", { params });
export const saveAppointment = (apptData) =>
  api.post("/appointments", apptData);
export const getCaseAppointments = (caseId, target = "response") =>
  api.get(`/cases/${caseId}/appointments`, { params: { target } });
// เพิ่มต่อท้ายไฟล์ api.js
export const updateAppointmentStatus = (id, status) =>
  api.patch(`/appointments/${id}/status`, { status });

// ── Case Management (Logs) ──
export const getCaseLogs = (caseId, target = "response") =>
  api.get(`/cases/${caseId}/logs`, { params: { target } });
export const addCaseLog = (caseId, logData) =>
  api.post(`/cases/${caseId}/logs`, logData);
export const deleteCase = (id) => api.delete(`/cases/${id}`);

//--case detail --//
export const getStatusOptions = (clinic_type = "all") =>
  api.get("/status-options", { params: { clinic_type } });
export const updateClinicalData = (id, data) =>
  api.put(`/master-cases/${id}/clinical-data`, data);
export const createStatusOption = (data) => api.post("/case-statuses", data);
export const deactivateStatusOption = (id) =>
  api.put(`/case-statuses/${id}/deactivate`);
export const createCase = (data) => api.post("/cases", data);
export const getStaffs = () => api.get("/staffs");
export const createStaff = (data) => api.post("/staffs", data);
export const deleteStaff = (id) => api.delete(`/staffs/${id}`);

// ── Secure Tokens (สำหรับเข้ารหัสลิงก์แบบประเมิน) ──
export const generateSecureToken = (data) =>
  api.post("/form-invitations", data);
export const staffLogoutApi = () => api.post("/session/staff/logout");
export const decodeSecureToken = (data) =>
  patientApi.post("/form-invitations/resolve", data);

// ── Master Cases (ระบบจัดการเคสต่อเนื่อง) ──
export const getMasterCasesById = (id) => api.get(`/master-cases/by-id/${id}`); // 🟢 เพิ่มบรรทัดนี้
// Every assessment of the person behind a Master Case, across forms and clinics.
export const getPersonTimeline = (masterCaseId) =>
  api.get(`/master-cases/${masterCaseId}/person-timeline`);
export const closeMasterCase = (id, data) =>
  api.put(`/master-cases/${id}/close`, data);
export const getReferralDestinations = () =>
  api.get("/case-referrals/destinations");
export const getCaseReferrals = (params) =>
  api.get("/case-referrals", { params });
export const getCaseReferral = (id) => api.get(`/case-referrals/${id}`);
export const createCaseReferral = (data) => api.post("/case-referrals", data);
// A school's referral to a hospital waits for approval in the school first.
export const getReferralRequests = (params) =>
  api.get("/referral-approvals", { params });
export const approveReferralRequest = (id) =>
  api.post(`/referral-approvals/${id}/approve`);
export const declineReferralRequest = (id, note) =>
  api.post(`/referral-approvals/${id}/decline`, { note });
export const cancelReferralRequest = (id) =>
  api.post(`/referral-approvals/${id}/cancel`);
export const updateCaseReferral = (id, data) =>
  api.post(`/case-referrals/${id}/updates`, data);

//--- Template บันทึกข้อมูล LSM --//
export const getNoteTemplates = (clinicType) =>
  api.get(`/templates?clinic_type=${clinicType}`);
export const createNoteTemplate = (data) => api.post(`/templates`, data);
export const updateNoteTemplate = (id, data) =>
  api.put(`/templates/${id}`, data);
export const deleteNoteTemplate = (id) => api.delete(`/templates/${id}`);

//--- ดึงคำถามจากฟอร์ม---//

// - Dashboard Charts - //
export const getMasterCaseStats = (clinic, formId, startDate, endDate) =>
  api.get("/admin/master-cases/stats", {
    params: { clinic, form_id: formId, startDate, endDate },
  });
export const getOrganizationsOverview = (startDate, endDate) =>
  api.get("/dashboard/organizations-overview", {
    params: {
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
  });
export const getDashboardSettings = () =>
  api.get("/dashboard-settings/settings");

// ── History & Patient Portal ──
export const getCaseAnswers = (id) => api.get(`/cases/${id}/answers`);

// ── System Evaluations (สำหรับ Dashboard) ──
export const getSystemEvaluationsStats = () => api.get("/evaluations/stats");
export const getSystemEvaluationsList = (page = 1, limit = 10) =>
  api.get(`/evaluations/list?page=${page}&limit=${limit}`);

// ── ช่วยเหลือ ──
export const getFaqCategories = (clinicId) =>
  api.get(`/admin/help-center/categories/${clinicId}`);
export const getPublicFaqCategories = (clinicId) =>
  api.get(`/admin/help-center/public/categories/${clinicId}`);
export const getPublicFaqs = () => api.get("/admin/help-center/public/faqs");
export const createFaqCategory = (data) =>
  api.post("/admin/help-center/categories", data);
export const getFaqsAdmin = (params) =>
  api.get("/admin/help-center/faqs", { params });
export const createFaq = (data) => api.post("/admin/help-center/faqs", data);
export const updateFaq = (id, data) =>
  api.put(`/admin/help-center/faqs/${id}`, data);
export const deleteFaq = (id) => api.delete(`/admin/help-center/faqs/${id}`);
export const updateFaqCategory = (id, data) =>
  api.patch(`/admin/help-center/categories/${id}`, data);
export const deleteFaqCategory = (id) =>
  api.delete(`/admin/help-center/categories/${id}`);

// 🟢 ดึง Token สดๆ จาก Storage ทุกครั้งที่ยิง API (ชัวร์ 100% ไม่ค้าง)
api.interceptors.request.use((config) => {
  const session = authSession("staff");
  if (session.csrf) config.headers["X-CSRF-Token"] = session.csrf;
  const organization = session.user?.id
    ? localStorage.getItem("suth_active_organization_" + session.user.id)
    : null;
  if (organization && !config.headers["X-Organization-Id"])
    config.headers["X-Organization-Id"] = organization;
  return config;
});

api.interceptors.response.use(
  (res) => {
    captureAuthResponse("staff", res.data);
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      clearAuthSession("staff");
      sessionStorage.removeItem("suth_user");
      sessionStorage.removeItem("suth_token");
      localStorage.removeItem("suth_user");
      localStorage.removeItem("suth_token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  },
);

export default api;
export const getPrivacyNotice = (id) => api.get(`/forms/${id}/privacy-notice`);
export const getReferralDestinationsConfig = (id) =>
  api.get(`/organizations/${id}/referral-destinations`);
export const setReferralDestinationsConfig = (id, destinations) =>
  api.put(`/organizations/${id}/referral-destinations`, { destinations });
export const getNotificationTarget = (id) =>
  api.get(`/organizations/${id}/notification-target`);
export const setNotificationTarget = (id, body) =>
  api.put(`/organizations/${id}/notification-target`, body);
export const exportCaseData = (id, format) =>
  api.post(`/cases/${id}/export-data`, { format });
export const getOrganizationRolePermissions = (org, role) =>
  api.get(`/organizations/${org}/roles/${role}/permissions`);
export const saveOrganizationRolePermissions = (org, role, body) =>
  api.put(`/organizations/${org}/roles/${role}/permissions`, body);
