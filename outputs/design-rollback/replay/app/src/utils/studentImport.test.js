import test from "node:test";
import assert from "node:assert/strict";
import { cellText, mapRows, parseCsv } from "./studentImport.js";

test("parses quoted CSV fields, doubled quotes, CRLF and a BOM", () => {
  const csv =
    '﻿รหัสนักเรียน,ชื่อ,นามสกุล\r\n65001,"สม, ชาย","ใจ""ดี"\r\n65002,"หลาย\nบรรทัด",ทดสอบ\r\n\r\n';
  assert.deepEqual(parseCsv(csv), [
    ["รหัสนักเรียน", "ชื่อ", "นามสกุล"],
    ["65001", "สม, ชาย", 'ใจ"ดี'],
    ["65002", "หลาย\nบรรทัด", "ทดสอบ"],
  ]);
});

test("detects semicolon separated files", () => {
  assert.deepEqual(parseCsv("a;b\n1;2"), [
    ["a", "b"],
    ["1", "2"],
  ]);
});

test("maps Thai and English headers and reports unknown or missing ones", () => {
  const { rows, unknownHeaders, missingRequired } = mapRows([
    ["Student ID", "ชื่อ*", "Surname", "ชั้น", "ห้อง", "สีโปรด"],
    ["65001", "สมชาย", "ใจดี", "ม.1", "1/1", "ฟ้า"],
    ["65002", "สมหญิง", "", "ม.1", "1/2", ""],
  ]);
  assert.deepEqual(rows[0], {
    student_code: "65001",
    first_name: "สมชาย",
    last_name: "ใจดี",
    grade: "ม.1",
    classroom: "1/1",
  });
  assert.equal(rows[1].last_name, undefined);
  assert.deepEqual(unknownHeaders, ["สีโปรด"]);
  assert.deepEqual(missingRequired, []);
  assert.deepEqual(mapRows([["ชื่อ"]]).missingRequired, [
    "รหัสนักเรียน",
    "นามสกุล",
    "ชั้นปี",
    "ห้อง",
  ]);
});

test("reads exceljs cell values as text", () => {
  assert.equal(cellText(65001), "65001");
  assert.equal(cellText(new Date(Date.UTC(2013, 4, 31))), "2013-05-31");
  assert.equal(
    cellText({ richText: [{ text: "สม" }, { text: "ชาย" }] }),
    "สมชาย",
  );
  assert.equal(cellText({ formula: "A1", result: "x" }), "x");
  assert.equal(cellText(null), "");
});
