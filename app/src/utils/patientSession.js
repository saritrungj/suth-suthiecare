const PATIENT_TOKEN_KEY = "patient_token";
const PATIENT_USER_KEY = "patient_user";
const PATIENT_SESSION_EVENT = "patient-session-changed";

function parseUser(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function getPatientSession() {
  if (typeof window === "undefined") return { token: "", user: null };
  const token = sessionStorage.getItem(PATIENT_TOKEN_KEY) || "";
  const user = parseUser(sessionStorage.getItem(PATIENT_USER_KEY));
  if (!token || !user) return { token: "", user: null };
  return { token, user };
}

function notifyPatientSession() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PATIENT_SESSION_EVENT));
  }
}

export function setPatientSession(token, user) {
  sessionStorage.setItem(PATIENT_TOKEN_KEY, token);
  sessionStorage.setItem(PATIENT_USER_KEY, JSON.stringify(user));
  notifyPatientSession();
}

export function clearPatientSession() {
  sessionStorage.removeItem(PATIENT_TOKEN_KEY);
  sessionStorage.removeItem(PATIENT_USER_KEY);
  notifyPatientSession();
}

export function subscribePatientSession(listener) {
  window.addEventListener(PATIENT_SESSION_EVENT, listener);
  window.addEventListener("focus", listener);
  return () => {
    window.removeEventListener(PATIENT_SESSION_EVENT, listener);
    window.removeEventListener("focus", listener);
  };
}

