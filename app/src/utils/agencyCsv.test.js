import { test } from "node:test";
import assert from "node:assert/strict";
import { parseAgencyCsv } from "./agencyCsv.js";

test("Thai UTF-8 CSV supports BOM, quoted commas/newlines and escaped quotes", () => {
  assert.deepEqual(
    parseAgencyCsv(
      '\uFEFFid,name\r\n1,"สมชาย, ทดสอบ"\r\n2,"บรรทัด\nใหม่ ""สอง"""',
    ),
    [
      ["id", "name"],
      ["1", "สมชาย, ทดสอบ"],
      ["2", 'บรรทัด\nใหม่ "สอง"'],
    ],
  );
});
test("malformed quotes and formula values are rejected", () => {
  assert.throws(() => parseAgencyCsv('id,name\n1,"unfinished'));
  assert.throws(() => parseAgencyCsv("id,name\n1,=SUM(1)"));
});
