import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { createAgencyTemplate } from "./agencyTemplate.js";

test("website template has 3 manual-compatible checkup examples and preserves text phone/date", async () => {
  const fields = [
    ["employee_id", "text"],
    ["first_name", "text"],
    ["last_name", "text"],
    ["department", "text"],
    ["phone", "phone"],
    ["checkup_date", "date"],
  ].map(([id, type]) => ({ id, label: id, type }));
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await createAgencyTemplate({ name: "ตรวจสุขภาพ", fields }),
  );
  const sheet = book.worksheets[0];
  assert.equal(sheet.name, "Import");
  assert.equal(sheet.rowCount, 4);
  assert.deepEqual(sheet.getRow(1).values.slice(1), [
    "source_record_id",
    ...fields.map((field) => field.id),
  ]);
  for (let row = 2; row <= 4; row++) {
    assert.ok(!sheet.getCell(row, 1).value);
    assert.ok(sheet.getCell(row, 3).text);
    assert.ok(sheet.getCell(row, 4).text);
    assert.match(sheet.getCell(row, 6).text, /^0\d{9}$/);
    assert.equal(sheet.getCell(row, 7).text, "2026-09-15");
    sheet.getRow(row).eachCell((cell) => assert.equal(cell.formula, undefined));
  }
});
test("examples respect selected form's options and stable column order", async () => {
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(
    await createAgencyTemplate({
      fields: [
        { id: "choice", type: "select", options: ["A", "B"] },
        { id: "multiple", type: "multiselect", options: ["X", "Y"] },
      ],
    }),
  );
  assert.equal(book.worksheets[0].getCell("B2").text, "A");
  assert.equal(book.worksheets[0].getCell("C2").text, "X|Y");
});
