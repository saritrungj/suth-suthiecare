import test from "node:test";
import assert from "node:assert/strict";
import { createWorkbook, workbookTables } from "./excelWorkbook.js";

test("exported result text has the same readable formatting as the frontend", () => {
  const tables = workbookTables([
    {
      resource: "cases",
      data: [
        {
          id: 1,
          summary_data: {
            raw_answers: {
              "คะแนน **&gt;** 10": {
                label: "**มากกว่า** &gt; 10",
                value: "stored_code",
              },
            },
          },
        },
      ],
    },
  ]);
  assert.equal(
    tables[0].rows[0]["summary_data.answers.คะแนน > 10"],
    "มากกว่า > 10",
  );
});

test("downloaded workbook contains display labels instead of stored enum values", async () => {
  const book = await createWorkbook([
    {
      resource: "students",
      data: [
        {
          student_code: "0001",
          status: "active",
          gender: "male",
          is_boarder: 1,
        },
      ],
    },
  ]);
  assert.equal(book.worksheets[0].getCell("B2").value, "กำลังศึกษา");
  assert.equal(book.worksheets[0].getCell("C2").value, "ชาย");
  assert.equal(book.worksheets[0].getCell("D2").value, "หอพัก");
});

test("assessment exports retain readable case references, answers and interpreted scores", () => {
  const tables = workbookTables([
    {
      resource: "cases",
      data: [
        {
          id: 101,
          master_case_id: 10,
          summary_data: {
            raw_answers: { "<b>คำถามตัวอย่าง</b>": ["คำตอบ ก", "คำตอบ ข"] },
            score_results: [{ score: 4, label: "ปกติ" }],
          },
        },
      ],
    },
  ]);
  const parent = tables.find((table) => table.rows[0]?.case_code);
  assert.equal(parent.rows[0].case_code, "MC-0010");
  assert.equal(parent.rows[0].response_code, "RE-0101");
  assert.equal(
    parent.rows[0]["summary_data.answers.คำถามตัวอย่าง"],
    "คำตอบ ก, คำตอบ ข",
  );
  assert.equal(parent.rows[0].id, undefined);
  assert.equal(
    tables.find((table) => table.rows[0]?.score === 4).rows[0].label,
    "ปกติ",
  );
});

test("school role exports show assigned school, member and role names", () => {
  const tables = workbookTables([
    {
      resource: "school_roles",
      data: {
        schools: [{ id: 1, name: "โรงเรียนจำลอง" }],
        members: [{ id: 2, username: "teacher-demo" }],
        role_labels: { homeroom: "ครูประจำชั้น" },
        roles: [
          { school_id: 1, user_id: 2, role_code: "homeroom", status: "active" },
        ],
      },
    },
  ]);
  assert.equal(tables.length, 1);
  assert.deepEqual(tables[0].rows[0], {
    school_name: "โรงเรียนจำลอง",
    username: "teacher-demo",
    role_name: "ครูประจำชั้น",
    status: "ใช้งาน",
  });
});
test("related records retain every row and an explicit parent reference", () => {
  const tables = workbookTables([
    {
      resource: "student_insights",
      data: [
        {
          id: 7,
          student_code: "ST007",
          profile: { guardian_name: "ผู้ปกครอง" },
          records: [
            { id: 1, issue: "เรื่องหนึ่ง" },
            { id: 2, issue: "เรื่องสอง" },
          ],
        },
      ],
    },
  ]);
  assert.equal(tables.length, 2);
  const child = tables.find((t) => t.rows.length === 2);
  assert.deepEqual(
    child.rows.map((r) => r.parent_record),
    ["ST007", "ST007"],
  );
  assert.equal(
    tables.find((t) => t.rows.length === 1).rows[0]["profile.guardian_name"],
    "ผู้ปกครอง",
  );
});
test("xlsx round trip retains Thai text, text codes and more than one page of records", async () => {
  const rows = Array.from({ length: 401 }, (_, index) => ({
    id: index + 1,
    student_code: "000" + index,
    first_name: "ทดสอบ",
    birth_date: "2013-05-31",
    note: '=HYPERLINK("bad")',
  }));
  const book = await createWorkbook([{ resource: "students", data: rows }]);
  const buffer = await book.xlsx.writeBuffer();
  const ExcelJS = (await import("exceljs")).default;
  const copy = new ExcelJS.Workbook();
  await copy.xlsx.load(buffer);
  const sheet = copy.worksheets[0];
  assert.equal(sheet.rowCount, 402);
  assert.equal(sheet.getCell("A2").value, "0000");
  assert.equal(sheet.getCell("B2").value, "ทดสอบ");
  assert.equal(typeof sheet.getCell("D2").value, "string");
  assert.equal(sheet.getCell("B1").value, "ชื่อ");
  assert.match(sheet.getCell("C2").value, /2556/);
});
