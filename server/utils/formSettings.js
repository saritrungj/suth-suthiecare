const LOGIN_ENFORCEMENT_MODES = new Set(["strict", "optional", "none"]);
const RESULT_DISPLAY_MODES = new Set(["realtime", "on_submit"]);

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

const requiresAuthenticatedSubmission = (loginEnforcement) =>
  normalizeLoginEnforcement(loginEnforcement) !== "none";

module.exports = {
  hasValidLoginEnforcement,
  hasValidResultDisplayMode,
  normalizeLoginEnforcement,
  normalizeResultDisplayMode,
  requiresAuthenticatedSubmission,
};
