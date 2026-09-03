import test from "node:test";
import assert from "node:assert/strict";
import {
  clearPatientSession,
  getPatientSession,
  setPatientSession,
  subscribePatientSession,
} from "./patientSession.js";

function createSessionStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("patient session stores, publishes, and clears login state", () => {
  const eventTarget = new EventTarget();
  globalThis.window = eventTarget;
  globalThis.sessionStorage = createSessionStorage();
  globalThis.CustomEvent = class CustomEvent extends Event {};

  let changes = 0;
  const unsubscribe = subscribePatientSession(() => { changes += 1; });
  setPatientSession("token-1", { id: 7, username: "patient" });
  assert.deepEqual(getPatientSession(), {
    token: "token-1",
    user: { id: 7, username: "patient" },
  });

  clearPatientSession();
  assert.deepEqual(getPatientSession(), { token: "", user: null });
  assert.equal(changes, 2);
  unsubscribe();

  delete globalThis.window;
  delete globalThis.sessionStorage;
  delete globalThis.CustomEvent;
});

