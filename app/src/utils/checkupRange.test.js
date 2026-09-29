import { test } from "node:test";
import assert from "node:assert/strict";
import { checkupDuration } from "./checkupRange.js";

test("inclusive checkup duration handles weeks, remainders, leap days and cross-year ranges", () => {
  assert.equal(
    checkupDuration("2026-09-01", "2026-09-14"),
    "14 วัน (2 สัปดาห์)",
  );
  assert.equal(checkupDuration("2026-09-01", "2026-09-30"), "30 วัน (1 เดือน)");
  assert.equal(checkupDuration("2026-09-01", "2026-09-01"), "1 วัน");
  assert.equal(checkupDuration("2024-02-28", "2024-03-01"), "3 วัน");
  assert.equal(checkupDuration("2026-12-31", "2027-01-01"), "2 วัน");
  assert.equal(checkupDuration("", "2026-09-01"), "");
  assert.equal(checkupDuration("2026-02-30", "2026-03-01"), "วันที่ไม่ถูกต้อง");
  assert.equal(
    checkupDuration("2026-09-30", "2026-09-01"),
    "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
  );
});

test("uses calendar months and years with inclusive end and month-end clamping", () => {
  assert.equal(checkupDuration("2026-01-01", "2026-12-31"), "365 วัน (1 ปี)");
  assert.equal(checkupDuration("2024-01-01", "2024-12-31"), "366 วัน (1 ปี)");
  assert.equal(checkupDuration("2026-02-01", "2026-02-28"), "28 วัน (1 เดือน)");
  assert.equal(checkupDuration("2024-02-01", "2024-02-29"), "29 วัน (1 เดือน)");
  assert.equal(checkupDuration("2026-01-31", "2026-02-27"), "28 วัน (1 เดือน)");
  assert.equal(
    checkupDuration("2026-01-01", "2027-02-09"),
    "405 วัน (1 ปี 1 เดือน 1 สัปดาห์ 2 วัน)",
  );
  assert.equal(
    checkupDuration("2026-09-01", "2026-09-29"),
    "29 วัน (4 สัปดาห์ 1 วัน)",
  );
});
