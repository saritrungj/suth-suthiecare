// Reading student spreadsheets (Excel or CSV) and building the template,
// credentials and export workbooks. Parsing is pure and unit tested
// (studentImport.test.js); exceljs and file-saver are loaded on demand.

export const IMPORT_FIELDS = [
  {
    key: "student_code",
    label: "รหัสนักเรียน",
    required: true,
    example: "65001",
  },
  { key: "prefix", label: "คำนำหน้า", example: "ด.ช." },
  { key: "first_name", label: "ชื่อ", required: true, example: "สมชาย" },
  { key: "last_name", label: "นามสกุล", required: true, example: "ใจดี" },
  { key: "nickname", label: "ชื่อเล่น", example: "ต้น" },
  { key: "grade", label: "ชั้นปี", required: true, example: "ม.1" },
  { key: "classroom", label: "ห้อง", required: true, example: "1/1" },
  { key: "student_type", label: "ประเภทนักเรียน", example: "ปกติ" },
  { key: "gender", label: "เพศ", example: "ชาย" },
  { key: "birth_date", label: "วันเกิด", example: "31/05/2556" },
  { key: "national_id", label: "เลขบัตรประชาชน", example: "" },
  { key: "username", label: "ชื่อผู้ใช้", example: "" },
];

// Thai and English header names accepted for each field.
const HEADER_ALIASES = {
  student_code: [
    "รหัสนักเรียน",
    "เลขประจำตัว",
    "เลขประจำตัวนักเรียน",
    "student_code",
    "student id",
    "studentid",
    "code",
  ],
  prefix: ["คำนำหน้า", "คำนำหน้าชื่อ", "prefix", "title"],
  first_name: ["ชื่อ", "first_name", "first name", "firstname", "name"],
  last_name: ["นามสกุล", "last_name", "last name", "lastname", "surname"],
  nickname: ["ชื่อเล่น", "nickname"],
  grade: ["ชั้นปี", "ชั้น", "ระดับชั้น", "grade", "level"],
  classroom: ["ห้อง", "ห้องเรียน", "classroom", "room", "class"],
  student_type: ["ประเภทนักเรียน", "ประเภท", "student_type", "type"],
  gender: ["เพศ", "gender", "sex"],
  birth_date: [
    "วันเกิด",
    "วันเดือนปีเกิด",
    "birth_date",
    "birthday",
    "date of birth",
    "dob",
  ],
  national_id: [
    "เลขบัตรประชาชน",
    "เลขประจำตัวประชาชน",
    "national_id",
    "citizen id",
    "id card",
    "idcard",
  ],
  username: ["ชื่อผู้ใช้", "username", "user"],
};

const normalizeHeader = (value) =>
  String(value ?? "")
    .replace(/^﻿/, "")
    .replace(/\*/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const ALIAS_LOOKUP = new Map(
  Object.entries(HEADER_ALIASES).flatMap(([key, aliases]) =>
    aliases.map((alias) => [normalizeHeader(alias), key]),
  ),
);

// RFC 4180 CSV: quoted fields, doubled quotes, newlines inside quotes, a
// UTF-8 BOM, CRLF or LF line endings. Also accepts ";" or tab separated files
// when the header line uses them.
export function parseCsv(text) {
  const source = String(text ?? "").replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const delimiter = [",", ";", "\t"].reduce((best, candidate) =>
    firstLine.split(candidate).length > firstLine.split(best).length
      ? candidate
      : best,
  );
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) =>
    cells.some((cell) => String(cell).trim() !== ""),
  );
}

// Turns a table (first row = headers) into row objects keyed by field. Header
// cells that match no field are reported so the user can fix the file.
export function mapRows(table) {
  const [headerRow = [], ...body] = table;
  const columns = headerRow.map(
    (cell) => ALIAS_LOOKUP.get(normalizeHeader(cell)) || null,
  );
  const unknownHeaders = headerRow
    .filter((cell, index) => !columns[index] && String(cell ?? "").trim())
    .map((cell) => String(cell).trim());
  const found = new Set(columns.filter(Boolean));
  const missingRequired = IMPORT_FIELDS.filter(
    (field) => field.required && !found.has(field.key),
  ).map((field) => field.label);
  const rows = body.map((cells) => {
    const row = {};
    columns.forEach((key, index) => {
      if (!key) return;
      const value = cellText(cells[index]);
      if (value !== "") row[key] = value;
    });
    return row;
  });
  return { rows, unknownHeaders, missingRequired };
}

// exceljs cell values: strings, numbers, dates, rich text, formulas, links.
export function cellText(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }
  if (typeof value === "object") {
    if (Array.isArray(value.richText))
      return value.richText
        .map((part) => part.text)
        .join("")
        .trim();
    if ("result" in value) return cellText(value.result);
    if ("text" in value) return cellText(value.text);
    return "";
  }
  if (typeof value === "number" && Number.isInteger(value))
    return String(value);
  return String(value).trim();
}

export async function readStudentFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv")
    return mapRows(parseCsv(await file.text()));
  if (!name.endsWith(".xlsx"))
    throw new Error(
      "รองรับเฉพาะไฟล์ .xlsx หรือ .csv (ไฟล์ .xls รุ่นเก่าให้บันทึกเป็น .xlsx ก่อน)",
    );
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("ไม่พบแผ่นงานในไฟล์");
  const table = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1); // exceljs rows are 1-based
    table.push(values.map((value) => cellText(value)));
  });
  return mapRows(table.filter((cells) => cells.some((cell) => cell !== "")));
}

async function saveWorkbook(workbook, filename) {
  const { saveAs } = await import("file-saver");
  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

function styleHeader(sheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF47932" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

export async function downloadImportTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("นักเรียน");
  sheet.columns = IMPORT_FIELDS.map((field) => ({
    header: field.required ? `${field.label}*` : field.label,
    key: field.key,
    width: Math.max(14, field.label.length * 2 + 4),
    style: { numFmt: "@" }, // keep codes and IDs as text (no lost leading zeros)
  }));
  sheet.addRow(
    Object.fromEntries(IMPORT_FIELDS.map((f) => [f.key, f.example])),
  );
  styleHeader(sheet);
  const help = workbook.addWorksheet("คำอธิบาย");
  help.columns = [
    { header: "คอลัมน์", key: "label", width: 22 },
    { header: "คำอธิบาย", key: "note", width: 90 },
  ];
  [
    [
      "รหัสนักเรียน*",
      "ไม่ซ้ำกันภายในโรงเรียน ใช้ประกอบชื่อผู้ใช้: รหัสโรงเรียน + รหัสนักเรียน",
    ],
    [
      "ชั้นปี* / ห้อง*",
      "ต้องตรงกับชื่อชั้นปีและห้องในระบบ หรือเลือก 'สร้างชั้นปี/ห้องที่ยังไม่มี' ตอนนำเข้า",
    ],
    [
      "ประเภทนักเรียน",
      "ต้องตรงกับชื่อในเมนูประเภทครูและนักเรียน (เว้นว่างได้)",
    ],
    ["เพศ", "ชาย หรือ หญิง (เว้นว่างได้)"],
    ["วันเกิด", "วว/ดด/ปปปป เป็น พ.ศ. หรือ ค.ศ. เช่น 31/05/2556"],
    [
      "เลขบัตรประชาชน",
      "ไม่บังคับ ถ้ามีจะใช้รวมผลประเมินที่นักเรียนเคยทำไว้ และผูกกับบัญชีเดิมถ้ามี",
    ],
    ["ชื่อผู้ใช้", "ไม่บังคับ เว้นว่างเพื่อให้ระบบสร้างให้"],
  ].forEach(([label, note]) => help.addRow({ label, note }));
  styleHeader(help);
  await saveWorkbook(workbook, "แบบฟอร์มนำเข้านักเรียน.xlsx");
}

// One-time credentials sheet for distributing temporary passwords.
export async function downloadCredentialsWorkbook(results, schoolName = "") {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("บัญชีนักเรียน");
  sheet.columns = [
    { header: "รหัสนักเรียน", key: "student_code", width: 16 },
    { header: "ชื่อ-นามสกุล", key: "name", width: 32 },
    { header: "ชั้น/ห้อง", key: "room", width: 14 },
    { header: "ชื่อผู้ใช้", key: "username", width: 22 },
    { header: "รหัสผ่านชั่วคราว", key: "password", width: 20 },
    { header: "หมายเหตุ", key: "note", width: 40 },
  ];
  results
    .filter(
      (item) =>
        item.username && ["created", "linked", "updated"].includes(item.status),
    )
    .forEach((item) =>
      sheet.addRow({
        student_code: item.student_code,
        name: item.name,
        room: `${item.grade} ห้อง ${item.classroom}`,
        username: item.username,
        password: item.password || "(ใช้รหัสผ่านเดิมของนักเรียน)",
        note: item.password
          ? "เปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก"
          : (item.notes || []).join(" "),
      }),
    );
  styleHeader(sheet);
  const stamp = new Date().toISOString().slice(0, 10);
  await saveWorkbook(
    workbook,
    `บัญชีนักเรียน-${schoolName || "โรงเรียน"}-${stamp}.xlsx`,
  );
}

export async function downloadStudentsWorkbook(students) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("นักเรียน");
  sheet.columns = [
    { header: "โรงเรียน", key: "school_name", width: 28 },
    { header: "รหัสนักเรียน", key: "student_code", width: 14 },
    { header: "คำนำหน้า", key: "prefix", width: 10 },
    { header: "ชื่อ", key: "first_name", width: 18 },
    { header: "นามสกุล", key: "last_name", width: 18 },
    { header: "ชื่อเล่น", key: "nickname", width: 12 },
    { header: "ชั้นปี", key: "grade_name", width: 10 },
    { header: "ห้อง", key: "classroom_name", width: 10 },
    { header: "ปีการศึกษา", key: "academic_year", width: 12 },
    { header: "ประเภทนักเรียน", key: "student_type_name", width: 16 },
    { header: "ชื่อผู้ใช้", key: "username", width: 20 },
    { header: "สถานะ", key: "status", width: 12 },
  ];
  students.forEach((student) => sheet.addRow(student));
  styleHeader(sheet);
  await saveWorkbook(
    workbook,
    `รายชื่อนักเรียน-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}
