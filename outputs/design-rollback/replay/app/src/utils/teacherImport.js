import { parseCsv, cellText } from "./studentImport.js";
export const TEACHER_FIELDS = [
  ["username", "ชื่อผู้ใช้"],
  ["name", "ชื่อ-นามสกุล"],
  ["email", "อีเมล"],
  ["initial_password", "รหัสผ่านตั้งต้น"],
  ["employee_code", "รหัสครู"],
  ["role_code", "บทบาท"],
  ["grade", "ชั้นปี"],
  ["classroom", "ห้อง"],
  ["academic_year", "ปีการศึกษา"],
];
export function mapTeacherRows(table) {
  const [headers = [], ...body] = table;
  const keys = headers.map(
    (h) =>
      TEACHER_FIELDS.find(([key, label]) =>
        [key, label].includes(String(h).trim()),
      )?.[0],
  );
  if (["username", "name", "email"].some((key) => !keys.includes(key)))
    throw Error("ต้องมีคอลัมน์ ชื่อผู้ใช้ ชื่อ-นามสกุล และอีเมล");
  const labels = {
    ครูทั่วไป: "other",
    ครูประจำชั้น: "homeroom",
    ครูแนะแนว: "counselor",
    เจ้าหน้าที่หอพัก: "dorm_staff",
  };
  return body
    .filter((row) => row.some((v) => cellText(v)))
    .map((cells) => {
      const row = {};
      keys.forEach((key, i) => {
        if (key) row[key] = cellText(cells[i]);
      });
      row.role_code = labels[row.role_code] || row.role_code || "other";
      return row;
    });
}
export async function readTeacherFile(file) {
  if (file.name.toLowerCase().endsWith(".csv"))
    return mapTeacherRows(parseCsv(await file.text()));
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    throw Error("รองรับไฟล์ .xlsx หรือ .csv");
  const ExcelJS = (await import("exceljs")).default,
    book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  const sheet = book.worksheets[0];
  if (!sheet) throw Error("ไม่พบแผ่นงาน");
  const table = [];
  sheet.eachRow((row) => table.push(row.values.slice(1).map(cellText)));
  return mapTeacherRows(table);
}
export async function saveTeacherWorkbook(results) {
  const ExcelJS = (await import("exceljs")).default,
    book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet(results ? "บัญชีครู" : "ครู");
  sheet.columns = (
    results
      ? [
          ["username", "ชื่อผู้ใช้"],
          ["password", "รหัสผ่านชั่วคราว"],
          ["status", "ผลนำเข้า"],
        ]
      : TEACHER_FIELDS
  ).map(([key, header]) => ({
    key,
    header,
    width: 25,
    style: { numFmt: "@" },
  }));
  if (results)
    sheet.addRows(
      results
        .filter((r) => ["created", "linked"].includes(r.status))
        .map((r) => ({ ...r, password: r.password || "(ใช้รหัสผ่านเดิม)" })),
    );
  else
    sheet.addRow({
      username: "teacher.demo",
      name: "ครูตัวอย่าง ทดสอบ",
      email: "teacher@example.com",
      role_code: "ครูทั่วไป",
    });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const { saveAs } = await import("file-saver");
  saveAs(
    new Blob([await book.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    results ? "บัญชีครู.xlsx" : "แบบฟอร์มนำเข้าครู.xlsx",
  );
}
