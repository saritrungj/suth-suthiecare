import test from "node:test";
import assert from "node:assert/strict";
import {
  authorizeDraftClaim,
  claimAssessmentDraft,
  clearAssessmentDrafts,
  draftOwner,
} from "./assessmentDraft.js";
function storage() {
  const m = new Map();
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i],
    getItem: (k) => m.get(k) || null,
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}
test("only the current guest flow may claim a draft and logout clears all drafts", () => {
  globalThis.sessionStorage = storage();
  const owner = draftOwner();
  sessionStorage.setItem(
    "assessment_draft_7",
    JSON.stringify({ owner, savedAt: Date.now(), answers: { a: 0 } }),
  );
  authorizeDraftClaim(7);
  claimAssessmentDraft(8);
  assert.equal(
    JSON.parse(sessionStorage.getItem("assessment_draft_7")).owner,
    8,
  );
  sessionStorage.setItem(
    "assessment_draft_9",
    JSON.stringify({ owner: "guest:someone-else", savedAt: Date.now() }),
  );
  authorizeDraftClaim(9);
  claimAssessmentDraft(8);
  assert.equal(
    JSON.parse(sessionStorage.getItem("assessment_draft_9")).owner,
    "guest:someone-else",
  );
  clearAssessmentDrafts();
  assert.equal(sessionStorage.getItem("assessment_draft_7"), null);
  assert.equal(sessionStorage.getItem("assessment_draft_9"), null);
});
test("a draft older than four hours cannot be claimed", () => {
  globalThis.sessionStorage = storage();
  const owner = draftOwner();
  sessionStorage.setItem(
    "assessment_draft_1",
    JSON.stringify({ owner, savedAt: Date.now() - 4 * 60 * 60 * 1000 - 1 }),
  );
  authorizeDraftClaim(1);
  claimAssessmentDraft(8);
  assert.equal(
    JSON.parse(sessionStorage.getItem("assessment_draft_1")).owner,
    owner,
  );
});
