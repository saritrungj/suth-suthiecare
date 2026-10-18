import test from "node:test";
import assert from "node:assert/strict";
import { resultImageLevel } from "./resultImageLevel.js";

test("result colours map to picture levels", () => {
  assert.equal(resultImageLevel("#D93025"), "high");
  assert.equal(resultImageLevel("#f59e0b"), "medium");
  assert.equal(resultImageLevel("#34a853"), "low");
  assert.equal(resultImageLevel(undefined), "low");
});
