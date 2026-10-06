const test = require("node:test");
const assert = require("node:assert/strict");
const {
  riskLevelOf,
  scoreResultsOf,
  higherRisk,
} = require("../utils/riskLevel");

test("reads high, medium and normal risk from score colours and labels", () => {
  assert.equal(riskLevelOf([{ color: "#D93025", label: "x" }]), "high");
  assert.equal(riskLevelOf([{ label: "ซึมเศร้ารุนแรง" }]), "high");
  assert.equal(riskLevelOf([{ color: "#ff9800" }]), "medium");
  assert.equal(riskLevelOf([{ label: "ควรเฝ้าระวัง" }]), "medium");
  assert.equal(riskLevelOf([{ color: "#34a853", label: "ปกติ" }]), "normal");
  assert.equal(riskLevelOf([]), "normal");
  assert.equal(riskLevelOf(null), "normal");
});

test("finds score results under either key and keeps the higher risk", () => {
  assert.deepEqual(scoreResultsOf({ scoreResults: [{ score: 1 }] }), [
    { score: 1 },
  ]);
  assert.deepEqual(scoreResultsOf(null), []);
  assert.equal(higherRisk("normal", "high"), "high");
  assert.equal(higherRisk("high", "medium"), "high");
});
