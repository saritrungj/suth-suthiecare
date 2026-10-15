export const publicRoutes = [
  '/', '/login', '/account/login', '/account/register', '/account/verify-email',
  '/account/change-password', '/help-center', '/help-center/clinic/1', '/terms',
  '/privacy-policy', '/assessment/101', '/assessment-result', '/history',
  '/history/result', '/clinic-detail', '/403', '/404', '/500',
];
export const adminRoutes = [
  'dashboard', 'forms', 'forms/create', 'forms/edit/101', 'schedule', 'referrals',
  'cases', 'roles', 'users', 'members', 'risk-cases', 'banner', 'clinics',
  'help-center', 'organizations', 'school', 'school/students',
  'school/students/import', 'school/teachers', 'school/types', 'master-data',
  'school/roles', 'school/workflows', 'profile',
].map(route => '/admin/' + route);
