import { exportRecord } from "./exportDisplay.js";
export const EXPORT_LABELS = {
  login_enforcement: "การเข้าสู่ระบบก่อนทำแบบประเมิน",
  result_display_mode: "การแสดงผลประเมิน",
  consent_given: "ให้ความยินยอม",
  faculty: "สำนักวิชา",
  user_status: "อาชีพ/สถานะผู้รับบริการ",
  publish_start_date: "วันเริ่มเผยแพร่",
  publish_end_date: "วันสิ้นสุดเผยแพร่",
  can_view: "ดูข้อมูล",
  can_manage: "จัดการข้อมูล",
  can_full: "สิทธิ์ทั้งหมด",
  module: "หมวดสิทธิ์",
  summary_data: "ผลประเมิน",
  score_results: "คะแนนและผลแปล",
  summary_json: "สรุปผลประเมิน",
  submitted_by: "ผู้ทำแบบประเมิน",
  latest_activity: "กิจกรรมล่าสุด",
  occurred_at: "วันที่ดำเนินการ",
  form_draft: "ร่างแบบประเมิน",
  case_code: "รหัสเคส",
  response_code: "รหัสผลประเมิน",
  recorded_by_name: "ผู้บันทึก",
  updated_by_name: "ผู้ปรับปรุง",
  created_by_name: "ผู้สร้าง",
  hearing_left: "การได้ยินข้างซ้าย",
  hearing_right: "การได้ยินข้างขวา",
  risk_status: "ความเสี่ยง",
  mental_risk: "ความเสี่ยงสุขภาพจิต",
  physical_risk: "ความเสี่ยงสุขภาพกาย",
  vision_left: "สายตาข้างซ้าย",
  vision_right: "สายตาข้างขวา",
  granted: "ได้รับสิทธิ์",
  enabled: "สถานะการใช้งาน",
  full_name: "ชื่อ-นามสกุล",
  display_name: "ชื่อที่แสดง",
  care_advice: "คำแนะนำการดูแล",
  assessed_on: "วันที่ประเมิน",
  is_boarder: "นักเรียนหอพัก",
  graduated_on: "วันจบการศึกษา",
  fitness: "ผลสมรรถภาพกาย",
  can_view_mental: "ดูข้อมูลสุขภาพจิตได้",
  can_view_physical: "ดูข้อมูลสุขภาพกายได้",
  status_label: "สถานะนักเรียน",
  id: "รหัส",
  student_id: "รหัสนักเรียนในระบบ",
  student_code: "รหัสนักเรียน",
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  prefix: "คำนำหน้า",
  nickname: "ชื่อเล่น",
  gender: "เพศ",
  birth_date: "วันเกิด",
  name: "ชื่อ",
  username: "ชื่อผู้ใช้",
  status: "สถานะ",
  account_status: "สถานะบัญชี",
  school_id: "รหัสโรงเรียน",
  school_name: "โรงเรียน",
  classroom_id: "รหัสห้องเรียน",
  classroom_name: "ห้องเรียน",
  grade_name: "ชั้นปี",
  academic_year: "ปีการศึกษา",
  student_type_name: "ประเภทนักเรียน",
  teacher_type_name: "ประเภทครู",
  organization_id: "รหัสหน่วยงาน",
  organization_name: "หน่วยงาน",
  role_code: "บทบาทโรงเรียน",
  role_name: "บทบาท",
  role_id: "รหัสบทบาท",
  permission_key: "สิทธิ์",
  description: "คำอธิบาย",
  code: "รหัสอ้างอิง",
  label: "ชื่อรายการ",
  sort_order: "ลำดับ",
  is_active: "ใช้งาน",
  phone: "โทรศัพท์",
  email: "อีเมล",
  created_at: "วันที่สร้าง",
  updated_at: "วันที่ปรับปรุง",
  submitted_at: "วันที่ประเมิน",
  recorded_at: "วันที่บันทึก",
  follow_up_at: "วันติดตาม",
  recorded_by: "ผู้บันทึก",
  guardian_name: "ชื่อผู้ปกครอง",
  guardian_relationship: "ความสัมพันธ์ผู้ปกครอง",
  guardian_phone: "โทรศัพท์ผู้ปกครอง",
  living_with: "พักอาศัยกับ",
  family_status: "สภาพครอบครัว",
  living_conditions: "ความเป็นอยู่",
  support_needs: "ความช่วยเหลือที่ต้องการ",
  issue: "เรื่องที่พบ",
  support: "การช่วยเหลือ",
  form_title: "แบบประเมิน",
  form_id: "รหัสแบบประเมิน",
  risk_level: "ระดับความเสี่ยง",
  overall_risk: "ความเสี่ยงรวม",
  score: "คะแนน",
  blood_type: "กรุ๊ปเลือด",
  allergies: "การแพ้",
  medications: "ยาที่ใช้",
  chronic_conditions: "โรคประจำตัว",
  notes: "หมายเหตุ",
  note: "บันทึก",
  detail: "รายละเอียด",
  weight_kg: "น้ำหนัก (กก.)",
  height_cm: "ส่วนสูง (ซม.)",
  bmi: "BMI",
  appointment_date: "วันนัดหมาย",
  service_name: "บริการ",
  clinic_type: "ประเภทคลินิก",
  question: "คำถาม",
  answer: "คำตอบ",
  text: "ข้อความ",
  title: "ชื่อเรื่อง",
  color: "สี",
  total: "จำนวนทั้งหมด",
  today: "วันนี้",
  pending: "รอดำเนินการ",
  parent_id: "รหัสรายการหลัก",
  parent_path: "รายการหลัก",
  value: "ค่า",
  index: "ลำดับรายการ",
  employee_code: "รหัสบุคลากร",
  position: "ตำแหน่ง",
  capacity: "ความจุ",
  address: "ที่อยู่",
  permission: "สิทธิ์",
  user_id: "รหัสผู้ใช้",
  source_response_id: "เคสต้นทาง",
  source_organization_name: "หน่วยงานต้นทาง",
  destination_organization_name: "หน่วยงานปลายทาง",
  summary: "สรุป",
  measured_at: "วันที่ตรวจ",
  risk: "ความเสี่ยง",
  systolic: "ความดันตัวบน",
  diastolic: "ความดันตัวล่าง",
  pulse: "ชีพจร",
  emergency_contact_name: "ผู้ติดต่อฉุกเฉิน",
  emergency_contact_phone: "โทรศัพท์ฉุกเฉิน",
  question_title: "คำถาม",
  answer_value: "คำตอบ",
  school: "โรงเรียน",
  grade_level_id: "รหัสชั้นปี",
  updated_by: "ผู้ปรับปรุง",
  source_master_case_id: "แฟ้มต้นทาง",
  patient_account_id: "รหัสบัญชีนักเรียน/ผู้ป่วย",
  person_id: "รหัสบุคคล",
  master_case_id: "รหัสแฟ้ม",
  appt_status: "สถานะนัดหมาย",
  case_status: "สถานะเคส",
  fullname: "ชื่อเต็ม",
  faq_id: "รหัสคำถาม",
  category_name: "หมวดคำถาม",
  clinic_name: "คลินิก",
  form_status: "สถานะแบบประเมิน",
  health_domain: "ด้านสุขภาพ",
  role: "หน้าที่ในห้องเรียน",
  member_count: "จำนวนสมาชิก",
  child_count: "จำนวนหน่วยงานย่อย",
  org_type: "ประเภทหน่วยงาน",
  org_level: "ระดับหน่วยงาน",
  is_primary: "หน่วยงานหลัก",
  staff_name: "ผู้รับผิดชอบ",
  staff_id: "รหัสผู้รับผิดชอบ",
  must_change_password: "ต้องเปลี่ยนรหัสผ่าน",
  parent_organization_name: "หน่วยงานหลัก",
  parent_name: "หน่วยงานหลัก",
  permission_keys: "สิทธิ์",
  can_update: "แก้ไขได้",
  can_view_health: "ดูข้อมูลเชิงลึกได้",
  can_update_health: "แก้ไขข้อมูลเชิงลึกได้",
  parent_record: "ระเบียนหลัก",
};
const names = {
  students: "นักเรียน",
  student: "ข้อมูลนักเรียน",
  school_cases: "ผลประเมินนักเรียน",
  student_health: "สุขภาพนักเรียน",
  student_insights: "ข้อมูลเชิงลึก",
  schools: "โรงเรียน",
  grades: "ชั้นปี",
  classrooms: "ห้องเรียน",
  teachers: "ครู",
  teacher_types: "ประเภทครู",
  student_types: "ประเภทนักเรียน",
  school_roles: "บทบาทโรงเรียน",
  cases: "เคส",
  case: "รายละเอียดเคส",
  responses: "ผลประเมิน",
  appointments: "นัดหมาย",
  referrals: "การส่งต่อ",
  referral: "รายละเอียดส่งต่อ",
  members: "สมาชิก",
  member: "รายละเอียดสมาชิก",
  users: "ผู้ใช้",
  roles: "บทบาท",
  role_permissions: "สิทธิ์บทบาท",
  organizations: "หน่วยงาน",
  organization_members: "สมาชิกหน่วยงาน",
  forms: "แบบประเมิน",
  form: "รายละเอียดแบบประเมิน",
  clinics: "คลินิก",
  faqs: "คำถามที่พบบ่อย",
  faq_categories: "หมวดคำถาม",
  banners: "แบนเนอร์",
  dashboard: "สรุป",
  dashboard_recent: "รายการล่าสุด",
  dashboard_stats: "สถิติ",
  master: "ข้อมูลหลัก",
  records: "ประวัติแนะแนว",
  assessments: "ผลประเมิน",
  physical_records: "ประวัติตรวจร่างกาย",
  profile: "ประวัติสุขภาพ",
  questions: "คำถาม",
  logs: "ประวัติการดูแล",
  answers: "คำตอบ",
  permissions: "สิทธิ์",
  import_results: "ผลนำเข้า",
};
const label = (key) =>
  key
    .split(".")
    .map((k) => EXPORT_LABELS[k] || names[k] || k)
    .join(" / ");
// Nested arrays become related sheets, preserving every record and its parent.
export function workbookTables(sheets) {
  const tables = new Map();
  const append = (path, value, parent = {}, resource = "", display = {}) => {
    const rows = Array.isArray(value) ? value : [value];
    if (!tables.has(path)) tables.set(path, []);
    rows.forEach((item, index) => {
      const row = { ...parent };
      const flatten = (obj, prefix = "") => {
        if (obj == null || typeof obj !== "object" || obj instanceof Date) {
          row[prefix || "value"] = obj;
          return;
        }
        for (const [key, val] of Object.entries(obj)) {
          if (
            key !== "must_change_password" &&
            /(password|token|secret|hash|encrypted|otp|csrf|^auth_|^session|^__enc$|^ct$|^kid$|^iv$|^tag$)/i.test(
              key,
            )
          )
            continue;
          if (typeof val === "string" && val.startsWith("suthenc:")) continue;
          const column = prefix ? `${prefix}.${key}` : key;
          if (Array.isArray(val))
            append(
              `${path}.${column}`,
              val,
              {
                parent_record:
                  item?.student_code ||
                  item?.code ||
                  item?.name ||
                  item?.title ||
                  [item?.first_name, item?.last_name]
                    .filter(Boolean)
                    .join(" ") ||
                  index + 1,
                parent_path: path,
              },
              resource,
              display,
            );
          else if (val && typeof val === "object" && !(val instanceof Date))
            flatten(val, column);
          else row[column] = val;
        }
      };
      flatten(exportRecord(item, resource, display));
      tables.get(path).push(row);
    });
  };
  sheets.forEach((s, index) => {
    const data =
      s.resource === "school_roles" && Array.isArray(s.data?.roles)
        ? s.data.roles.map((role) => ({
            ...role,
            school_name: s.data.schools?.find(
              (school) => school.id === role.school_id,
            )?.name,
            username: s.data.members?.find(
              (member) => member.id === role.user_id,
            )?.username,
            role_name: s.data.role_labels?.[role.role_code],
          }))
        : s.data;
    append(
      `${names[s.resource] || s.resource}${index ? " " + (index + 1) : ""}`,
      data,
      {},
      s.resource,
      s.display || {},
    );
  });
  return [...tables.entries()].map(([name, rows]) => ({ name, rows }));
}
export async function createWorkbook(sheets) {
  const module = await import("exceljs");
  const ExcelJS = module.default || module;
  const book = new ExcelJS.Workbook();
  book.creator = "Suthie Care";
  let number = 0;
  for (const { name, rows } of workbookTables(sheets)) {
    const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    // Reserve one row for headings under the Excel worksheet row limit.
    for (let offset = 0; offset < Math.max(rows.length, 1); offset += 1048575) {
      const suffix = String(++number);
      const title =
        name
          .split(".")
          .map((k) => names[k] || k)
          .join(" ")
          .replace(/[\\/*?:\[\]]/g, " ")
          .slice(0, 27) +
        " " +
        suffix;
      const sheet = book.addWorksheet(title, {
        views: [{ state: "frozen", ySplit: 1 }],
      });
      sheet.columns = (columns.length ? columns : ["value"]).map((key) => ({
        header: label(key),
        key,
        width: Math.min(55, Math.max(18, label(key).length + 4)),
      }));
      for (const source of rows.slice(offset, offset + 1048575)) {
        const row = { ...source };
        for (const key of columns) {
          const val = row[key];
          if (
            val instanceof Date ||
            (typeof val === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(val))
          ) {
            const date = new Date(val);
            if (!Number.isNaN(date.getTime()))
              row[key] = date.toLocaleString("th-TH", {
                timeZone: "Asia/Bangkok",
                ...(String(val).length === 10
                  ? { year: "numeric", month: "2-digit", day: "2-digit" }
                  : {}),
              });
          }
          if (typeof val === "boolean") row[key] = val ? "ใช่" : "ไม่ใช่";
        }
        sheet.addRow(row);
      }
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF344A5F" },
      };
      sheet.autoFilter = {
        from: "A1",
        to: { row: 1, column: sheet.columnCount },
      };
    }
  }
  return book;
}
export async function downloadWorkbook(sheets, title = "ข้อมูล") {
  const book = await createWorkbook(sheets);
  const buffer = await book.xlsx.writeBuffer();
  const { saveAs } = await import("file-saver");
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${title}-${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })}.xlsx`,
  );
}
