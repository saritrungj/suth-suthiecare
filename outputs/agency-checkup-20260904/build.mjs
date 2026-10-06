import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const out = new URL(".", import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  "$1",
);
const book = await SpreadsheetFile.importXlsx(
  await FileBlob.load(`${out}/checkup-import-example.xlsx`),
);
const sheet = book.worksheets.getItem("Import");
const guide = book.worksheets.getItem("Instructions");
sheet.getRange("A12:G14").copyFrom(sheet.getRange("A9:G11"), "all");
sheet.getRange("A12:G14").setNumberFormat("@");
sheet.getRange("A12:G14").values = [
  [
    "",
    "DEMO-011",
    "สมชาย",
    "ทดสอบหนึ่ง",
    "ฝ่ายบุคคล",
    "0000000001",
    "2026-09-15",
  ],
  [
    "",
    "DEMO-012",
    "สุภาวดี",
    "ทดสอบสอง",
    "ฝ่ายบัญชี",
    "0000000002",
    "2026-09-15",
  ],
  ["", "DEMO-013", "กิตติ", "ทดสอบสาม", "ฝ่ายผลิต", "0000000003", "2026-09-16"],
];
sheet.getRange("A12:G14").format.rowHeight = 27;
guide.getRange("B2").values = [
  [
    "ข้อมูลสมมติ 13 รายการ รวมตัวอย่างกรอกครบเหมือน Manual เพิ่ม 3 รายการท้ายตาราง",
  ],
];
guide.getRange("B4").values = [
  ["ชื่อ รหัสพนักงาน และเบอร์โทรทั้งหมดเป็นข้อมูลสมมติ ไม่ใช่ข้อมูลบุคคลจริง"],
];
guide.getRange("B10").values = [
  [
    "ไม่บังคับ เก็บเป็นข้อความ ตัวอย่าง 0000000001–0000000003 เป็นเบอร์สมมติสำหรับทดสอบ",
  ],
];
guide.getRange("B14").values = [
  ["ลบหรือแทนที่ข้อมูลตัวอย่างทั้ง 13 แถวก่อนนำเข้ารายชื่อจริง"],
];
console.log(
  (
    await book.inspect({
      kind: "table",
      range: "Import!A12:G14",
      include: "values,formulas",
      tableMaxRows: 3,
      tableMaxCols: 7,
    })
  ).ndjson,
);
console.log(
  (
    await book.inspect({
      kind: "match",
      searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?",
      options: { useRegex: true, maxResults: 10 },
    })
  ).ndjson,
);
for (const [name, range] of [
  ["Import", "A1:G14"],
  ["Instructions", "A1:B16"],
]) {
  const blob = await book.render({
    sheetName: name,
    range,
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `${out}/${name}.png`,
    new Uint8Array(await blob.arrayBuffer()),
  );
}
await (
  await SpreadsheetFile.exportXlsx(book)
).save(`${out}/checkup-import-example.xlsx`);
console.log(
  "Updated workbook: 13 records, including 3 complete manual-style examples.",
);
