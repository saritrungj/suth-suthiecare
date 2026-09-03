// Routes whose operational data must always be constrained by the active
// organization. Keeping this policy pure makes it regression-testable.
function needsOrganizationContext(path, hasAuthorization = false) {
  return path.startsWith("/cases") ||
    path.startsWith("/master-cases") ||
    path.startsWith("/admin/master-cases") ||
    path.startsWith("/appointments") ||
    path.startsWith("/all-cases") ||
    path.startsWith("/patient-members") ||
    path.startsWith("/history/") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/charts/") ||
    path.startsWith("/evaluations/") ||
    ((path === "/forms" ||
      path === "/save-form" ||
      (path.startsWith("/forms/") && !/^\/forms\/[^/]+\/submit$/.test(path)) ||
      path.startsWith("/clinics")) &&
      hasAuthorization) ||
    /^\/forms\/[^/]+\/(responses|responses-v2|submission-count)$/.test(path);
}

module.exports = { needsOrganizationContext };
