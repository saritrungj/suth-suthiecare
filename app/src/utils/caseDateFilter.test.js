import test from "node:test";
import assert from "node:assert/strict";
import { bangkokDateKey, getCurrentMonthDateRange, isCaseInDateRange, normaliseDateRange, parseCaseDate } from "./caseDateFilter.js";

test("defaults to the first day of the current month through today", () => {
  assert.deepEqual(getCurrentMonthDateRange(new Date(2026, 7, 13, 23, 59)), {
    startDate: "2026-08-01",
    endDate: "2026-08-13",
  });
});

test("includes both boundary dates regardless of the time of submission", () => {
  assert.equal(isCaseInDateRange({ submitted_at: "2026-08-10 23:59:59" }, "2026-08-10", "2026-08-10"), true);
  assert.equal(isCaseInDateRange({ submitted_at: "2026-08-09 23:59:59" }, "2026-08-10", "2026-08-10"), false);
});

test("uses created/updated timestamp when submitted_at is unavailable", () => {
  assert.equal(isCaseInDateRange({ created_at: "2026-08-15 08:00:00" }, "2026-08-15", "2026-08-15"), true);
  assert.equal(isCaseInDateRange({ updated_at: "2026-08-16 08:00:00" }, "2026-08-15", "2026-08-15"), false);
});

test("parses MySQL timestamps as local calendar values and normalises reversed ranges", () => {
  const date = parseCaseDate("2026-08-10 00:30:00");
  assert.equal(date.getFullYear(), 2026);
  assert.deepEqual(normaliseDateRange("2026-08-20", "2026-08-10"), ["2026-08-10", "2026-08-20"]);
});

test("uses Bangkok calendar days even when the browser timezone differs", () => {
  assert.equal(bangkokDateKey(new Date("2026-05-31T18:00:00.000Z")), "2026-06-01");
  assert.equal(isCaseInDateRange({ submitted_at: "2026-06-01T00:05:00.000Z" }, "2026-06-01", "2026-06-01"), true);
  assert.equal(isCaseInDateRange({ submitted_at: "2026-05-31T16:59:00.000Z" }, "2026-06-01", "2026-06-01"), false);
});
