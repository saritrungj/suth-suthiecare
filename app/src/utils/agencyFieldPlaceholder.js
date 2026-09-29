export function agencyFieldPlaceholder(field) {
  const examples = {
    employee_id: "เช่น EMP-001",
    first_name: "เช่น สมชาย (ไม่ต้องระบุคำนำหน้า)",
    last_name: "เช่น ใจดี",
    department: "เช่น ฝ่ายบุคคล",
  };
  if (examples[field.id]) return examples[field.id];
  if (field.type === "phone") return "เช่น 0812345678";
  if (field.type === "email") return "เช่น name@example.com";
  if (field.type === "number") return "กรอกตัวเลข";
  if (field.type === "multiselect")
    return field.options?.length
      ? `เช่น ${field.options.slice(0, 2).join("|")}`
      : "คั่นหลายค่าด้วย |";
  if (field.type === "date" || field.type === "select") return undefined;
  return field.type === "textarea"
    ? `ระบุรายละเอียด${field.label || "เพิ่มเติม"}`
    : `ระบุ${field.label || "ข้อมูล"}`;
}
