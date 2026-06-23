import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Bypass-Tunnel-Reminder': 'true',
    'ngrok-skip-browser-warning': '69420',
    'x-tunnel-skip-anti-phishing-page': 'true'
  }
  
});

// ── Users ──
export const getUsers    = ()           => api.get('/users');
export const createUser  = (data)       => api.post('/users', data);
export const updateUser  = (id, data)   => api.put(`/users/${id}`, data);
export const deleteUser  = (id)         => api.delete(`/users/${id}`);

// ── Auth ──
export const loginApi    = (credentials) => api.post('/login', credentials);

// ── Dashboard ──
export const getDashboardSummary = () => api.get('/dashboard/summary');
export const getRecentCases = (clinic) => api.get('/dashboard/recent', { params: { clinic } });

// ── Forms ──
export const saveFormToDb    = (formData)       => api.post('/save-form', formData);
export const getForms        = (sortParam)      => api.get(`/forms?sort=${sortParam}`);
export const getFormById     = (id)             => api.get(`/forms/${id}`);
export const updateFormInDb  = (id, formData)   => api.put(`/forms/${id}`, formData);
export const duplicateFormInDb = (formId) => {
  return api.post(`/forms/${formId}/duplicate`);
};


// ── Clinics ──
export const getActiveClinics = () => api.get('/clinics');
export const getAllClinics = () => api.get('/clinics/all');
export const getClinicByIdOrSlug = (idOrSlug) => api.get(`/clinics/${idOrSlug}`);
export const createClinic = (data) => api.post('/clinics', data);
export const updateClinic = (id, data) => api.put(`/clinics/${id}`, data);
export const deleteClinic = (id) => api.delete(`/clinics/${id}`);
export const reorderClinics = (order) => api.patch('/clinics/reorder', { order });
export const toggleClinicHelpCenter = (id, showInHelpCenter) => api.patch(`/clinics/${id}/toggle-help-center`, { show_in_help_center: showInHelpCenter });

// ── เพิ่มฟังก์ชันใหม่สำหรับอัปเดตรูปปกโดยเฉพาะ ──
export const updateFormImageOnly = (id, imageData) => api.patch(`/forms/${id}/image`, imageData);
export const deleteFormInDb  = (id)             => api.delete(`/forms/${id}`);
export const renameFormInDb  = (id, newTitle)   => api.patch(`/forms/${id}/rename`, { title: newTitle });

// ── Form Submissions ──
export const submitFormAnswers      = (formId, data) => api.post(`/forms/${formId}/submit`, data);
export const getFormSubmissionCount = (formId)       => api.get(`/forms/${formId}/submission-count`); // ✅ แก้แล้ว ลบ /api ออก
export const getFormResponses       = (formId)       => api.get(`/forms/${formId}/responses`);
export const updateFormStatus = (id, statusData) => api.patch(`/forms/${id}/status`, statusData);
export const updateFormClinicType = (id, data) => api.patch(`/forms/${id}/clinic`, data);

// ── Roles & Permissions ──
export const getRoles            = ()         => api.get('/roles');
export const getRolePermissions  = (id)       => api.get(`/roles/${id}/permissions`);
export const saveRolePermissions = (id, data) => api.post(`/roles/${id}/permissions`, data);
export const createRole          = (data)     => api.post('/roles', data);
export const deleteRole          = (id)       => api.delete(`/roles/${id}`);

// ── Banner ──
export const getBanners      = ()       => api.get('/banners');
export const createBanner    = (data)   => api.post('/banners', data);
export const updateBannerImage = (id, data) => api.patch(`/banners/${id}/image`, data);
export const deleteBanner    = (id)     => api.delete(`/banners/${id}`);
export const reorderBanners  = (data)   => api.post('/banners/reorder', data);

//--- services ---//
export const getServices = () => api.get('/services');
export const createService = (data) => api.post('/services',data);
export const updateService = (id, data) => api.put(`/services/${id}`, data);
export const deleteService = (id) => api.delete(`/services/${id}`);

//--- risks ---//
export const getRisks = () => api.get('/risks');

//--- appointments ---//
export const getAppointments = () => api.get('/appointments'); 
export const saveAppointment = (apptData) => api.post('/appointments', apptData);
export const getCaseAppointments = (caseId, target = 'response') => api.get(`/cases/${caseId}/appointments`, { params: { target } });
// เพิ่มต่อท้ายไฟล์ api.js
export const updateAppointmentStatus = (id, status) => api.patch(`/appointments/${id}/status`, { status });

// ── Case Management (Logs) ──
export const getCaseLogs = (caseId, target = 'response') => api.get(`/cases/${caseId}/logs`, { params: { target } });
export const addCaseLog  = (caseId, logData) => api.post(`/cases/${caseId}/logs`, logData);
export const updateCase = (id, data) => api.put(`/cases/${id}`, data);
export const deleteCase = (id) => api.delete(`/cases/${id}`); 


//--case detail --//
export const getStatusOptions = (clinic_type = 'all') => api.get('/status-options', { params: { clinic_type } });
export const updateClinicalData = (id, data) => api.put(`/master-cases/${id}/clinical-data`, data);
export const createStatusOption = (data) => api.post('/case-statuses', data);
export const deactivateStatusOption = (id) => api.put(`/case-statuses/${id}/deactivate`)
export const createCase = (data) => api.post("/cases", data);
export const getStaffs = () => api.get('/staffs');
export const createStaff = (data) => api.post('/staffs', data);
export const deleteStaff = (id) => api.delete(`/staffs/${id}`);

// ── Secure Tokens (สำหรับเข้ารหัสลิงก์แบบประเมิน) ──
export const generateSecureToken = (data) => api.post('/generate-token', data);
export const decodeSecureToken = (data) => api.post('/decode-token', data);

// ── Master Cases (ระบบจัดการเคสต่อเนื่อง) ──
export const getMasterCasesByIdentity = (identity) => api.get(`/master-cases/${identity}`);
export const getMasterCasesById = (id) => api.get(`/master-cases/by-id/${id}`); // 🟢 เพิ่มบรรทัดนี้
export const closeMasterCase = (id, data) => api.put(`/master-cases/${id}/close`, data);

//--- Template บันทึกข้อมูล LSM --//
export const getNoteTemplates = (clinicType) => api.get(`/templates?clinic_type=${clinicType}`);
export const createNoteTemplate = (data) => api.post(`/templates`, data);
export const updateNoteTemplate = (id, data) => api.put(`/templates/${id}`, data);
export const deleteNoteTemplate = (id) => api.delete(`/templates/${id}`);

//--- ดึงคำถามจากฟอร์ม---//
export const getFormQuestions = (formId) => api.get(`/forms/${formId}/questions`);

// - Dashboard Charts - //
export const getMasterCaseStats = (clinic, formId) => api.get('/admin/master-cases/stats', { params: { clinic, form_id: formId } });
export const getChartData = (formId, questionId, startDate, endDate) => { return api.get(`/charts/${formId}/${questionId}`, {params: { startDate, endDate }});};
export const getDashboardSettings = () => api.get('/dashboard-settings/settings');
export const saveDashboardSettings = (data) => api.post('/dashboard-settings/settings', data);


// ── History & Patient Portal ──
export const getMasterCaseByIdentity = (identity) => api.get(`/master-cases/${identity}`);
export const updateHistoryResponse = (id, data) => api.patch(`/history/response/${id}`, data);
export const getCaseAnswers = (id) => api.get(`/cases/${id}/answers`);

// ── System Evaluations (สำหรับ Dashboard) ──
export const getSystemEvaluationsStats = () => api.get('/evaluations/stats');
export const getSystemEvaluationsList = (page = 1, limit = 10) => api.get(`/evaluations/list?page=${page}&limit=${limit}`);

// ── ช่วยเหลือ ──
export const getFaqCategories = (clinicId) => api.get(`/admin/help-center/categories/${clinicId}`);
export const createFaqCategory = (data) => api.post('/admin/help-center/categories', data);
export const getFaqsAdmin = (params) => api.get('/admin/help-center/faqs', { params });
export const createFaq = (data) => api.post('/admin/help-center/faqs', data);
export const updateFaq = (id, data) => api.put(`/admin/help-center/faqs/${id}`, data);
export const deleteFaq = (id) => api.delete(`/admin/help-center/faqs/${id}`);
export const updateFaqCategory = (id, data) => api.patch(`/admin/help-center/categories/${id}`, data);
export const deleteFaqCategory = (id) => api.delete(`/admin/help-center/categories/${id}`);

// 🟢 ดึง Token สดๆ จาก Storage ทุกครั้งที่ยิง API (ชัวร์ 100% ไม่ค้าง)
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('suth_token') || localStorage.getItem('suth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      sessionStorage.removeItem('suth_user');
      sessionStorage.removeItem('suth_token');
      localStorage.removeItem('suth_user');
      localStorage.removeItem('suth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;