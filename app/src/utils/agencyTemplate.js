import ExcelJS from "exceljs";

function exampleValue(field, index) {
  const checkup = {
    employee_id: `DEMO-${String(index + 1).padStart(3, "0")}`,
    first_name: ["สมชาย", "สุภาวดี", "กิตติ"][index],
    last_name: ["ทดสอบหนึ่ง", "ทดสอบสอง", "ทดสอบสาม"][index],
    department: ["ฝ่ายบุคคล", "ฝ่ายบัญชี", "ฝ่ายผลิต"][index],
  };
  if (field.type === "select") return field.options?.[0] || "";
  if (field.type === "multiselect")
    return (field.options || []).slice(0, 2).join("|");
  if (field.type === "date")
    return field.id === "checkup_end_date" ? "2026-09-28" : "2026-09-15";
  if (field.type === "number") return index + 1;
  if (field.type === "email") return `demo${index + 1}@example.com`;
  if (field.type === "phone") return `000000000${index + 1}`;
  return checkup[field.id] || `ข้อมูลตัวอย่าง ${index + 1}`;
}

export async function createAgencyTemplate(master) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Import", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  const guide = book.addWorksheet("Instructions");
  const fields = master.fields || [];
  sheet.addRow(["source_record_id", ...fields.map((field) => field.id)]);
  for (let index = 0; index < 3; index += 1) {
    sheet.addRow(["", ...fields.map((field) => exampleValue(field, index))]);
  }
  sheet.columns.forEach((column, index) => {
    column.width =
      index === 0
        ? 28
        : Math.max(
            22,
            Math.min(36, String(fields[index - 1]?.id || "").length + 4),
          );
    column.numFmt =
      index > 0 && fields[index - 1]?.type === "number" ? "0.##" : "@";
  });
  guide.addRows([
    ["รายการ", "คำแนะนำ", "จำเป็น", "รูปแบบ / ค่าที่เลือกได้"],
    ["แบบฟอร์ม", master.name || "ลงทะเบียนตรวจสุขภาพ", "", ""],
    [
      "ข้อมูลตัวอย่าง",
      "ชีต Import มีข้อมูลสมมติ 3 แถว ให้ลบหรือแทนที่ก่อนนำเข้ารายชื่อจริง",
      "",
      "",
    ],
    [
      "source_record_id",
      "เว้นว่าง ระบบสร้างรหัสอัตโนมัติขณะอ่านไฟล์",
      "ไม่",
      "อัปโหลดซ้ำโดยเว้นรหัสว่างจะสร้างรายการใหม่",
    ],
    ...fields.map((field) => [
      field.id,
      field.label,
      field.required ? "ใช่" : "ไม่",
      field.type === "date"
        ? "YYYY-MM-DD ปี ค.ศ."
        : field.type === "phone"
          ? "เก็บเป็นข้อความเพื่อรักษาเลข 0 ด้านหน้า เบอร์ตัวอย่างเป็นเบอร์สมมติ"
          : field.type === "multiselect"
            ? `คั่นหลายค่าด้วย | : ${(field.options || []).join(" | ")}`
            : (field.options || []).join(" | "),
    ]),
    [
      "ก่อนนำเข้า",
      "คงชื่อและลำดับคอลัมน์แถวแรก รวมถึงชีต Import ไว้ลำดับแรก",
      "",
      "",
    ],
    [
      "ช่วงตรวจสุขภาพ",
      "checkup_date คือวันเริ่มต้น และ checkup_end_date คือวันสิ้นสุด นับรวมทั้งสองวัน",
      "",
      "ตรวจวันเดียวให้ใส่วันเดียวกันทั้งสองช่อง",
    ],
    ["ข้อจำกัด", "สูงสุด 1,000 รายการ ขนาดไม่เกิน 10 MB ไม่อนุญาตสูตร", "", ""],
  ]);
  guide.columns = [{ width: 26 }, { width: 64 }, { width: 12 }, { width: 60 }];
  for (const tab of [sheet, guide]) {
    tab.eachRow((row, index) => {
      row.height = index === 1 ? 32 : tab === guide ? 44 : 28;
      row.eachCell((cell) => {
        cell.font = {
          name: "Tahoma",
          size: 11,
          color: { argb: index === 1 ? "FFFFFFFF" : "FF243746" },
          bold: index === 1,
        };
        cell.alignment = { vertical: "middle", wrapText: true };
        if (index === 1)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF354858" },
          };
      });
    });
  }
  return book.xlsx.writeBuffer();
}
