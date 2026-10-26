import test from "node:test";
import assert from "node:assert/strict";
import { resultImageChoice, resultImageLevel } from "./resultImageLevel.js";

test("result colours map to picture levels", () => {
  assert.equal(resultImageLevel("#D93025"), "high");
  assert.equal(resultImageLevel("#f59e0b"), "medium");
  assert.equal(resultImageLevel("#34a853"), "low");
  assert.equal(resultImageLevel(undefined), "low");
});

test("custom shades are read by hue", () => {
  assert.equal(resultImageLevel("#f94f24"), "high");
  assert.equal(resultImageLevel("#ff5722"), "high");
  assert.equal(resultImageLevel("#fbf428"), "medium");
  assert.equal(resultImageLevel("#ff6d00"), "medium");
  assert.equal(resultImageLevel("#4caf50"), "low");
  assert.equal(resultImageLevel("#2196f3"), "low");
  assert.equal(resultImageLevel("#9e9e9e"), "low");
  assert.equal(resultImageLevel("var(--suth-info)"), "low");
});

test("a scoring range can choose its own picture", () => {
  assert.deepEqual(resultImageChoice("asset:12", "#d93025"), {
    level: "high",
    assetId: "12",
  });
  assert.deepEqual(resultImageChoice("level:medium", "#34a853"), {
    level: "medium",
    assetId: null,
  });
  assert.deepEqual(resultImageChoice("", "#34a853"), {
    level: "low",
    assetId: null,
  });
  assert.deepEqual(resultImageChoice("level:bogus", "#d93025"), {
    level: "high",
    assetId: null,
  });
});
