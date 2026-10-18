import {
  clearAssessmentDrafts,
  claimAssessmentDraft,
} from "./assessmentDraft.js";
const state = {
  staff: { user: null, csrf: "" },
  patient: { user: null, csrf: "" },
};
const event = "suth-auth-changed";
export function authSession(type) {
  return state[type];
}
export function setAuthSession(type, user, csrf = "") {
  if (state[type].user?.id && state[type].user.id !== user?.id)
    clearAssessmentDrafts();
  state[type] = { user: user || null, csrf };
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(event));
}
export function clearAuthSession(type) {
  clearAssessmentDrafts();
  setAuthSession(type, null);
  channel?.postMessage({ action: "logout", type });
}
const channel =
  typeof window !== "undefined" && window.BroadcastChannel
    ? new window.BroadcastChannel("suth-session-events")
    : null;
if (channel)
  channel.onmessage = ({ data }) => {
    if (data?.action === "logout" && ["staff", "patient"].includes(data.type)) {
      clearAssessmentDrafts();
      setAuthSession(data.type, null);
    }
  };
export function subscribeAuthSession(listener) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}
export async function bootstrapAuth() {
  for (const storage of [sessionStorage, localStorage])
    for (const key of [
      "suth_token",
      "suth_user",
      "patient_token",
      "patient_user",
      "SESSION_SYNC_DATA",
    ])
      storage.removeItem(key);
  const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
  await Promise.all(
    ["staff", "patient"].map(async (type) => {
      try {
        // ?probe: the server answers 204 when there is no session cookie.
        const response = await fetch(`${base}/session/${type}?probe`, {
          credentials: "include",
        });
        if (!response.ok || response.status === 204)
          return setAuthSession(type, null);
        const data = await response.json();
        setAuthSession(type, data.user, data.csrf_token);
      } catch {
        setAuthSession(type, null);
      }
    }),
  );
}
export function captureAuthResponse(type, data) {
  if (data?.user && data.csrf_token) {
    if (type === "patient" && !state.patient.user)
      claimAssessmentDraft(data.user.id);
    setAuthSession(type, data.user, data.csrf_token);
  }
}
