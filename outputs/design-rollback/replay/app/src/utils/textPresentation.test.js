import test from "node:test";
import assert from "node:assert/strict";
import { stripHtml as caseText } from "../components/case/caseDisplay.js";
import { stripHtml as historyText } from "../pages/assessment/history/historyUtils.js";
import { contentMarkup, toDisplayText } from "./textPresentation.js";

for (const [surface, format] of [
  ["case", caseText],
  ["history", historyText],
]) {
  test(`${surface} displays encoded Markdown and comparison operators as readable text`, () => {
    assert.equal(
      format("คะแนน **&gt;** 10 และ **&lt;=** 20"),
      "คะแนน > 10 และ <= 20",
    );
    assert.equal(
      format("&lt;p&gt;ผล **ปกติ** &amp;amp; ติดตาม&lt;/p&gt;"),
      "ผล ปกติ & ติดตาม",
    );
    assert.equal(format("&#x0E01; &#62; &#x3c;"), "ก > <");
    assert.equal(format("ชื่อ *** โทร 081****123"), "ชื่อ *** โทร 081****123");
    assert.equal(format("<p>ผล **ปกติ**</p>\n\n- ติดตาม"), "ผล ปกติ ติดตาม");
    assert.equal(format("ค่า < 10 และ > 2"), "ค่า < 10 และ > 2");
    assert.equal(format("&gt; 10"), "> 10");
    assert.equal(format("&gt;= 10"), ">= 10");
  });
}

test("formatting covers links, numeric entities, lists, tables and intentional code", () => {
  assert.equal(
    toDisplayText("[ติดต่อ](https://example.test) และ &#x1F44D;"),
    "ติดต่อ และ 👍",
  );
  assert.equal(toDisplayText("1. **ข้อแรก**\n2. ข้อสอง"), "ข้อแรก ข้อสอง");
  assert.equal(toDisplayText("`**ตัวอย่างโค้ด**`"), "**ตัวอย่างโค้ด**");
  assert.match(
    contentMarkup("| หัวข้อ | ค่า |\n| --- | --- |\n| คะแนน | **10** |"),
    /<table>/,
  );
  assert.equal(
    toDisplayText(
      "&lt;script&gt;ไม่ใช่เนื้อหาที่ต้องแสดง&lt;/script&gt;ข้อความ",
    ),
    "ข้อความ",
  );
  assert.equal(toDisplayText(0), "0");
});
