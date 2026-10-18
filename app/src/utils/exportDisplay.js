import { toDisplayText } from "./textPresentation.js";
import { PERMISSION_GROUPS } from "../permissions/permissionRegistry.js";

const studentStatuses = {
  active: "กำลังศึกษา",
  graduated: "จบการศึกษา",
  on_leave: "ลาพัก",
  withdrawn: "ลาออก",
  waived: "สละสิทธิ์",
  transferred: "ย้ายโรงเรียน",
  inactive: "ปิดใช้งาน",
};
const statuses = {
  active: "ใช้งาน",
  inactive: "ปิดใช้งาน",
  suspended: "ระงับใช้งาน",
  disabled: "ปิดใช้งาน",
  locked: "ล็อกบัญชี",
  pending_verification: "รอยืนยันอีเมล",
  published: "เผยแพร่",
  draft: "ร่าง",
  hidden: "ซ่อน",
  Open: "เปิดเคส",
  Closed: "ปิดเคส",
  pending: "รอดำเนินการ",
  accepted: "รับส่งต่อแล้ว",
  in_progress: "กำลังดำเนินการ",
  completed: "เสร็จสิ้น",
  rejected: "ปฏิเสธ",
  cancelled: "ยกเลิก",
  expired: "หมดอายุ",
  scheduled: "นัดหมายแล้ว",
  confirmed: "ยืนยันแล้ว",
  no_show: "ไม่มาตามนัด",
};
const roles = {
  admin: "ผู้ดูแลข้อมูลทั่วไป",
  mental_admin: "แอดมินสุขภาพจิต",
  physical_admin: "แอดมินสุขภาพกาย",
  counselor: "ครูแนะแนว",
  homeroom: "ครูประจำชั้น",
  co_homeroom: "ครูประจำชั้นร่วม",
  other: "ครูทั่วไป",
  dorm_staff: "เจ้าหน้าที่หอพัก",
  system_admin: "ผู้ดูแลระบบ",
};
const values = {
  gender: { male: "ชาย", female: "หญิง", other: "อื่น ๆ" },
  prefix: { boy: "ด.ช.", girl: "ด.ญ.", mr: "นาย", miss: "นางสาว", mrs: "นาง" },
  org_type: { school: "โรงเรียน", hospital: "โรงพยาบาล" },
  org_level: { main: "หน่วยงานหลัก", unit: "หน่วยงานย่อย" },
  health_domain: {
    mental: "สุขภาพจิต",
    physical: "สุขภาพกาย",
    other: "อื่น ๆ",
  },
  login_enforcement: {
    none: "เปิดให้เข้าถึงได้เลย",
    optional: "แนะนำให้เข้าสู่ระบบ",
    strict: "บังคับเข้าสู่ระบบ",
  },
  result_display_mode: {
    realtime: "แสดงผลระหว่างทำแบบประเมิน",
    on_submit: "แสดงผลหลังส่งแบบประเมิน",
  },
  risk_level: {
    high: "เสี่ยงสูง",
    medium: "เฝ้าระวัง",
    normal: "ปกติ",
    low: "ปกติ",
    none: "ยังไม่มีผลประเมิน",
  },
  blood_type: { unknown: "ไม่ทราบ" },
  hearing: { normal: "ปกติ", abnormal: "ผิดปกติ", not_tested: "ยังไม่ได้ตรวจ" },
  guardian_relationship: {
    father: "บิดา",
    mother: "มารดา",
    relative: "ญาติ",
    other: "อื่น ๆ",
  },
  living_with: {
    parents: "บิดามารดา",
    guardian: "ผู้ปกครอง",
    dormitory: "หอพัก",
    other: "อื่น ๆ",
  },
  family_status: {
    together: "อยู่ร่วมกัน",
    separated: "แยกกันอยู่",
    single_parent: "ผู้ปกครองคนเดียว",
    other: "อื่น ๆ",
  },
  support_needs: {
    education: "การศึกษา",
    financial: "ทุน/ค่าใช้จ่าย",
    health: "สุขภาพ",
    family: "ครอบครัว",
    other: "อื่น ๆ",
  },
};
const categories = {
  status: "student_status",
  form_status: "publication_status",
  gender: "gender",
  prefix: "prefix",
  risk: "risk_level",
  risk_level: "risk_level",
  risk_status: "risk_level",
  overall_risk: "risk_level",
  mental_risk: "risk_level",
  physical_risk: "risk_level",
  blood_type: "blood_type",
  hearing_left: "hearing",
  hearing_right: "hearing",
  guardian_relationship: "guardian_relationship",
  living_with: "living_with",
  family_status: "family_status",
  support_needs: "support_needs",
  faculty: "faculty",
  user_status: "user_status",
};
const relations = {
  organization_id: "organization_name",
  school_id: "school_name",
  classroom_id: "classroom_name",
  grade_level_id: "grade_name",
  student_type_id: "student_type_name",
  teacher_type_id: "teacher_type_name",
  role_id: "role_name",
  form_id: "form_title",
  clinic_id: "clinic_name",
  staff_id: "staff_name",
  user_id: "username",
  recorded_by: "recorded_by_name",
  updated_by: "updated_by_name",
  created_by: "created_by_name",
};
const booleanFields = new Set([
  "is_active",
  "is_primary",
  "is_boarder",
  "must_change_password",
  "enabled",
  "granted",
  "show_in_help_center",
  "show_icon",
  "patient_visible",
]);
const studentResource = (resource) =>
  [
    "students",
    "student",
    "school_cases",
    "student_health",
    "student_insights",
  ].includes(resource);
const plainText = toDisplayText;
const displayAnswer = (value) =>
  Array.isArray(value)
    ? value.map(displayAnswer).join(", ")
    : value && typeof value === "object"
      ? value.label != null
        ? plainText(String(value.label))
        : Object.entries(value)
            .map(([key, item]) => `${plainText(key)}: ${displayAnswer(item)}`)
            .join("\n")
      : typeof value === "string"
        ? plainText(value)
        : (value ?? "-");

export function displayExportValue(
  key,
  value,
  resource,
  display = {},
  record = {},
) {
  if (value == null || value === "") return "-";
  if (
    value instanceof Date ||
    (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:[T ]|$)/.test(value))
  ) {
    const dateOnly =
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const date = new Date(dateOnly ? `${value}T00:00:00+07:00` : value);
    if (!Number.isNaN(date.getTime()))
      return date.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        ...(!dateOnly ? { hour: "2-digit", minute: "2-digit" } : {}),
      });
  }
  const category =
    key === "status" && !studentResource(resource)
      ? ["forms", "form"].includes(resource)
        ? "publication_status"
        : null
      : categories[key];
  const organization = record.organization_id ?? display.organizationId;
  const custom =
    category &&
    display.options?.find(
      (option) =>
        String(option.organization_id) === String(organization) &&
        option.category === category &&
        option.code === String(value),
    );
  if (custom) return plainText(custom.label);
  if (category && display.defaults?.[category]?.[value])
    return display.defaults[category][value];
  if (key === "status" && record.status_label) return record.status_label;
  if (key === "status")
    return (
      (studentResource(resource) ? studentStatuses[value] : statuses[value]) ||
      value
    );
  if (
    ["account_status", "form_status", "appt_status", "case_status"].includes(
      key,
    )
  )
    return statuses[value] || value;
  if (["role_code", "role"].includes(key)) return roles[value] || value;
  if (key === "clinic_type" || key === "clinicType")
    return plainText(
      display.clinics?.[value] ||
        { general: "ทั่วไป", all: "ทุกคลินิก" }[value] ||
        String(value),
    );
  if (
    ["permission", "permission_key", "permission_keys"].includes(key) &&
    typeof value === "string"
  ) {
    const [group, action] = value.split(".");
    const module = PERMISSION_GROUPS.find((item) => item.id === group);
    const actions = {
      view: "ดูข้อมูล",
      create: "เพิ่ม",
      update: "แก้ไข",
      delete: "ลบ",
      assign: "มอบหมาย",
      export: "ส่งออก",
      manage: "จัดการ",
    };
    return module && actions[action]
      ? `${module.label} / ${actions[action]}`
      : value;
  }
  const map = values[category] || values[key];
  if (map && Object.hasOwn(map, value)) return map[value];
  if (
    booleanFields.has(key) ||
    typeof value === "boolean" ||
    (resource === "role_permissions" && key.startsWith("can_"))
  ) {
    const yes = value === true || value === 1 || value === "1";
    if (key === "is_boarder") return yes ? "หอพัก" : "ไปกลับ";
    if (key === "is_active" || key === "enabled")
      return yes ? "ใช้งาน" : "ปิดใช้งาน";
    return yes ? "ใช่" : "ไม่ใช่";
  }
  return typeof value === "string" ? plainText(value) : value;
}

export function exportRecord(
  record,
  resource,
  display = {},
  inheritedOrganization,
) {
  if (Array.isArray(record))
    return record.map((item) =>
      exportRecord(item, resource, display, inheritedOrganization),
    );
  if (!record || typeof record !== "object" || record instanceof Date)
    return displayExportValue("value", record, resource, display);
  const result = {};
  const context = {
    ...display,
    organizationId:
      record.organization_id ?? inheritedOrganization ?? display.organizationId,
  };
  if (
    ["cases", "case", "responses"].includes(resource) &&
    record.master_case_id
  )
    result.case_code = `MC-${String(record.master_case_id).padStart(4, "0")}`;
  if (
    ["cases", "case", "responses"].includes(resource) &&
    (record.response_id || record.id)
  )
    result.response_code = `RE-${String(record.response_id || record.id).padStart(4, "0")}`;
  for (const [key, value] of Object.entries(record)) {
    if (
      (/^can_/.test(key) && resource !== "role_permissions") ||
      /^(auth_|session|__)/.test(key) ||
      (/(password|token|secret|hash|encrypted|otp|csrf)/i.test(key) &&
        key !== "must_change_password")
    )
      continue;
    if (key === "raw_answers") {
      result.answers = Object.fromEntries(
        Object.entries(value || {}).map(([title, answer]) => [
          plainText(title),
          displayAnswer(answer),
        ]),
      );
      continue;
    }
    if (
      key === "status_label" ||
      ["pagination", "role_labels", "version", "permissions_version"].includes(
        key,
      )
    )
      continue;
    if (key === "role_code" && record.role_name) continue;
    if (
      key === "id" ||
      (key.endsWith("_id") && key !== "national_id") ||
      ["recorded_by", "updated_by", "created_by"].includes(key)
    ) {
      const target = relations[key];
      const resolved = display.lookups?.[key]?.[value];
      if (target && !record[target] && resolved) result[target] = resolved;
      continue;
    }
    if (typeof value === "string" && value.startsWith("suthenc:")) continue;
    const nestedResource =
      key === "student"
        ? "students"
        : key === "students"
          ? "students"
          : key === "forms"
            ? "forms"
            : resource;
    result[key] =
      value && typeof value === "object" && !(value instanceof Date)
        ? exportRecord(value, nestedResource, context, context.organizationId)
        : displayExportValue(key, value, resource, context, record);
  }
  return result;
}
