const CHECKUP_FIELDS = [
  { id: "employee_id", label: "รหัสพนักงาน", type: "text", required: false, options: [] },
  { id: "first_name", label: "ชื่อ", type: "text", required: true, options: [] },
  { id: "last_name", label: "นามสกุล", type: "text", required: true, options: [] },
  { id: "department", label: "แผนก", type: "text", required: false, options: [] },
  { id: "phone", label: "เบอร์โทรศัพท์", type: "phone", required: false, options: [] },
  { id: "checkup_date", label: "วันที่เริ่มตรวจสุขภาพ", type: "date", required: false, options: [] },
  { id: "checkup_end_date", label: "วันที่สิ้นสุดตรวจสุขภาพ", type: "date", required: false, options: [] },
];

// Older Agency schemas are arrays. Typed forms use an envelope in the same
// JSON column, so existing definitions and records need no backfill.
function readAgencySchema(raw) {
  const schema = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (Array.isArray(schema)) return { form_type: "custom", fields: schema };
  const fields = Array.isArray(schema?.fields) ? [...schema.fields] : [];
  // Extend existing typed checkup forms on read; keep historical single dates intact.
  if (schema?.form_type === "health_checkup" && fields.some(field => field.id === "checkup_date") && !fields.some(field => field.id === "checkup_end_date")) {
    fields.push({ ...CHECKUP_FIELDS.find(field => field.id === "checkup_end_date") });
  }
  return { form_type: schema?.form_type || "custom", fields };
}

function validateCheckupRange(schema, data) {
  if (!schema.some(field => field.id === "checkup_end_date")) return {};
  const start = data.checkup_date, end = data.checkup_end_date;
  const errors = {};
  for (const [key, value] of [["checkup_date", start], ["checkup_end_date", end]]) {
    if (!value) continue;
    const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
    if (!date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) errors[key] = "วันที่ไม่ถูกต้อง กรุณาใช้ YYYY-MM-DD";
  }
  if (end && !start) errors.checkup_date = "กรุณาเลือกวันที่เริ่มตรวจสุขภาพ";
  if (start && end && !Object.keys(errors).length && end < start) errors.checkup_end_date = "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น";
  return errors;
}

module.exports = { CHECKUP_FIELDS, readAgencySchema, validateCheckupRange };
