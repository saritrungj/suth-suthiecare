// Thai labels for audit actions. Unknown codes fall back to an area label or
// the code itself, so a new action never shows as blank.
const ACTIONS = {
  "data.read": "เปิดดูข้อมูล",
  "students.create": "เพิ่มนักเรียน",
  "students.update": "แก้ไขข้อมูลนักเรียน",
  "students.delete": "ลบหรือเก็บถาวรนักเรียน",
  "student_health.update": "บันทึกหรือแก้ไขข้อมูลสุขภาพ",
  "student_health.follow_up.update": "บันทึกการติดตามสุขภาพกาย",
  "student_insights.update": "แก้ไขข้อมูลเชิงลึก",
  "student_guidance.create": "บันทึกการให้คำปรึกษา",
  "student_behavior.create": "ส่งรายงานพฤติกรรม",
  "student_behavior.update": "บันทึกการติดตามพฤติกรรม",
  "student_behavior.assign": "มอบผู้รับผิดชอบรายงานพฤติกรรม",
  "student_behavior.delete": "ยกเลิกรายงานพฤติกรรม",
  "school_appointments.confirm": "ยืนยันนัดหมาย",
  "school_appointments.reschedule": "เลื่อนนัดหมาย",
  "school_appointments.transfer": "โอนนัดหมาย",
  "school_appointments.complete": "บันทึกว่าพบนักเรียนแล้ว",
  "school_appointments.no_show": "บันทึกว่าไม่มาตามนัด",
  "school_appointments.cancel": "ยกเลิกนัดหมาย",
  "school_documents.create": "เพิ่มเอกสาร",
  "school_documents.update": "แก้ไขเอกสาร",
  "school_documents.delete": "ซ่อนเอกสาร",
  "school_documents.categories": "แก้ไขหมวดเอกสาร",
  "school.roles.update": "เปลี่ยนหน้าที่ในโรงเรียน",
  "school.care_guidance.update": "แก้ไขคำแนะนำสำหรับครู",
  "school.notification_settings.update": "แก้ไขการแจ้งเตือนกลุ่มเสี่ยง",
  "school.physical_rules.create": "เพิ่มเกณฑ์ภาวะเสี่ยงทางกาย",
  "school.physical_rules.update": "แก้ไขเกณฑ์ภาวะเสี่ยงทางกาย",
  "school.appointment_topics.update": "แก้ไขหัวข้อนัดหมาย",
  "permissions.unit_role.create": "เพิ่มบทบาทในหน่วยงาน",
  "users.assignments.update": "เปลี่ยนหน่วยงานหรือบทบาทของผู้ใช้",
};
export const AUDIT_AREAS = {
  students: "นักเรียน",
  student_health: "ข้อมูลสุขภาพ",
  student_behavior: "พฤติกรรม",
  school_appointments: "นัดหมาย",
  school_documents: "คลังเอกสาร",
  school: "ตั้งค่าโรงเรียน",
  permissions: "บทบาทและสิทธิ์",
  users: "ผู้ใช้",
  pdpa: "ข้อมูลส่วนบุคคล (PDPA)",
};
export function auditActionLabel(action) {
  if (ACTIONS[action]) return ACTIONS[action];
  const area = AUDIT_AREAS[String(action).split(".")[0]];
  return area ? `${area}: ${action}` : action;
}
const TARGETS = {
  student: "นักเรียน",
  student_physical_record: "ผลตรวจร่างกาย",
  student_health_profile: "ข้อมูลสุขภาพประจำตัว",
  student_password_reset: "รหัสผ่านนักเรียน",
  school: "โรงเรียน",
  role: "บทบาท",
  user: "ผู้ใช้",
  route: "หน้าข้อมูล",
};
export const auditTargetLabel = (row) =>
  row.student_code
    ? `นักเรียน ${row.student_code}`
    : `${TARGETS[row.target_type] || row.target_type || "-"}${row.target_id && row.target_type !== "route" ? ` #${row.target_id}` : ""}`;
// "2026-10-19T14:05:09" → "19 ต.ค. 2569 14:05"
export function auditTime(local) {
  if (!local) return "-";
  const [date, time] = local.split("T");
  const d = new Date(`${date}T00:00:00`);
  return `${d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} ${String(time || "").slice(0, 5)}`;
}
