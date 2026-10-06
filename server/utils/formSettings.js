const LOGIN_ENFORCEMENT_MODES = new Set(["strict", "optional", "none"]);
const RESULT_DISPLAY_MODES = new Set(["realtime", "on_submit"]);
// Which part of a student's health an assessment describes (school module).
const HEALTH_DOMAINS = new Set(["mental", "physical", "general"]);

const normalizeEnum = (value, validValues, fallback) =>
  validValues.has(value) ? value : fallback;

const normalizeLoginEnforcement = (value) =>
  normalizeEnum(value, LOGIN_ENFORCEMENT_MODES, "none");

const normalizeResultDisplayMode = (value) =>
  normalizeEnum(value, RESULT_DISPLAY_MODES, "realtime");

const hasValidLoginEnforcement = (value) =>
  value === undefined || value === null || LOGIN_ENFORCEMENT_MODES.has(value);

const hasValidResultDisplayMode = (value) =>
  value === undefined || value === null || RESULT_DISPLAY_MODES.has(value);

// null means "not set"; an unknown value is rejected rather than guessed.
const normalizeHealthDomain = (value) =>
  HEALTH_DOMAINS.has(value) ? value : null;

const hasValidHealthDomain = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  HEALTH_DOMAINS.has(value);

const requiresAuthenticatedSubmission = (loginEnforcement) =>
  normalizeLoginEnforcement(loginEnforcement) !== "none";

// Mirrors the landing-page visibility rule: published, and inside the optional
// publish window. An invalid date is treated as "no bound".
const isFormOpenForSubmission = (form, now = new Date()) => {
  if (!form || form.status !== "published") return false;
  const start = form.publish_start_date
    ? new Date(form.publish_start_date)
    : null;
  const end = form.publish_end_date ? new Date(form.publish_end_date) : null;
  if (start && !Number.isNaN(start.getTime()) && now < start) return false;
  if (end && !Number.isNaN(end.getTime()) && now > end) return false;
  return true;
};

module.exports = {
  HEALTH_DOMAINS,
  hasValidHealthDomain,
  normalizeHealthDomain,
  hasValidLoginEnforcement,
  hasValidResultDisplayMode,
  isFormOpenForSubmission,
  normalizeLoginEnforcement,
  normalizeResultDisplayMode,
  requiresAuthenticatedSubmission,
};
