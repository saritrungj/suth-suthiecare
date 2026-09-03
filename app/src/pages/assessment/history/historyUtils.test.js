import test from "node:test";
import assert from "node:assert/strict";

import { formatAnswerValue, isDisplayableTableAnswer } from "./historyUtils.js";

test("empty object answers use a visible fallback instead of an empty table", () => {
  assert.equal(isDisplayableTableAnswer({}), false);
  assert.equal(formatAnswerValue({}), "-");
});

test("non-empty structured answers remain table data", () => {
  assert.equal(isDisplayableTableAnswer({ 0: "ไม่มีเลย" }), true);
});

