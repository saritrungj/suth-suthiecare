const PREFIX = "assessment_draft_";
export function clearAssessmentDrafts() {
  if (typeof sessionStorage === "undefined") return;
  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(PREFIX) || key === "assessment_pending_claim")
      sessionStorage.removeItem(key);
  }
}
export function draftOwner() {
  let flow = sessionStorage.getItem("assessment_guest_flow");
  if (!flow) {
    flow = crypto.randomUUID();
    sessionStorage.setItem("assessment_guest_flow", flow);
  }
  return `guest:${flow}`;
}
export function authorizeDraftClaim(formId) {
  sessionStorage.setItem(
    "assessment_pending_claim",
    JSON.stringify({
      formId: String(formId),
      owner: draftOwner(),
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    }),
  );
}
export function claimAssessmentDraft(userId) {
  try {
    const claim = JSON.parse(
      sessionStorage.getItem("assessment_pending_claim"),
    );
    if (!claim || claim.expiresAt < Date.now()) return;
    const key = PREFIX + claim.formId,
      draft = JSON.parse(sessionStorage.getItem(key));
    if (
      draft?.owner === claim.owner &&
      Date.now() - draft.savedAt < 4 * 60 * 60 * 1000
    ) {
      draft.owner = userId;
      sessionStorage.setItem(key, JSON.stringify(draft));
    }
  } catch {
    clearAssessmentDrafts();
  } finally {
    sessionStorage.removeItem("assessment_pending_claim");
  }
}
