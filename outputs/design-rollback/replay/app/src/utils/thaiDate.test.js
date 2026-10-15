import { test } from "node:test";
import assert from "node:assert/strict";
import { isoToThai, maskThaiDate, parseThaiDate } from "./thaiDate.js";

const today = new Date(2026, 9, 2);

test("shows an API date in the Buddhist era", () => {
  assert.equal(isoToThai("2013-05-31"), "31/05/2556");
  assert.equal(isoToThai(""), "");
  assert.equal(isoToThai(null), "");
});

test("inserts slashes while typing", () => {
  assert.equal(maskThaiDate("31"), "31");
  assert.equal(maskThaiDate("3105"), "31/05");
  assert.equal(maskThaiDate("31052556"), "31/05/2556");
  assert.equal(maskThaiDate("31/05/2556x9"), "31/05/2556");
});

test("parses a Buddhist or Christian year into an API date", () => {
  assert.deepEqual(parseThaiDate("31/05/2556", { today }), {
    iso: "2013-05-31",
  });
  assert.deepEqual(parseThaiDate("1/9/2569", { today }), { iso: "2026-09-01" });
  assert.deepEqual(parseThaiDate("31/05/2013", { today }), {
    iso: "2013-05-31",
  });
  assert.deepEqual(parseThaiDate("", { today }), { iso: "" });
});

test("rejects incomplete, impossible and future dates", () => {
  assert.equal(parseThaiDate("31/05", { today }).error, "format");
  assert.equal(parseThaiDate("31/02/2555", { today }).error, "invalid");
  assert.equal(parseThaiDate("03/10/2569", { today }).error, "future");
  assert.deepEqual(parseThaiDate("02/10/2569", { today }), {
    iso: "2026-10-02",
  });
});
