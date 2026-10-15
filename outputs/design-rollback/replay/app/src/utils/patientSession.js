import {
  authSession,
  setAuthSession,
  clearAuthSession,
  subscribeAuthSession,
} from "./authSession.js";
export function getPatientSession() {
  const session = authSession("patient");
  return { authenticated: Boolean(session.user), user: session.user };
}
// First argument is retained for existing callers; access tokens are never stored.
export function setPatientSession(_unused, user) {
  setAuthSession("patient", user, authSession("patient").csrf);
}
export function clearPatientSession() {
  if (typeof sessionStorage !== "undefined")
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith("assessment_draft_")) sessionStorage.removeItem(key);
    }
  clearAuthSession("patient");
}
export function subscribePatientSession(listener) {
  return subscribeAuthSession(listener);
}
