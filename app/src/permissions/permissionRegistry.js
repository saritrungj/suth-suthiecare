// Sections of the unit roles page, in display order.
export const PERMISSION_CATEGORIES = [
  { id: "privacy", label: "ข้อมูลส่วนบุคคลและสุขภาพ" },
  { id: "service", label: "งานบริการและติดตามเคส" },
  { id: "school", label: "งานโรงเรียน" },
  { id: "settings", label: "ตั้งค่าหน่วยงาน" },
];

// Every unit module offers all seven actions; "manage" grants the whole module.
// Mirrors server/authorization/permissionMatrix.js (a test keeps them in sync).
export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "assign",
  "export",
  "manage",
];

export const PERMISSION_GROUPS = [
  {
    id: "master_data",
    category: "settings",
    label: "ข้อมูลหลัก",
    hint: "คำนำหน้า สถานะ และรายการตัวเลือกที่ใช้ร่วมกันทั้งหน่วยงาน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูรายการข้อมูลหลัก",
      create: "เพิ่มรายการใหม่",
      update: "แก้ไขชื่อและรายละเอียดรายการ",
      delete: "เปิดหรือปิดการใช้งานรายการ",
      assign: "จัดลำดับการแสดงรายการ",
      export: "ส่งออกข้อมูลหลัก",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "pii",
    category: "privacy",
    label: "ข้อมูลส่วนบุคคลเต็ม",
    hint: "ชื่อ-นามสกุล เลขบัตร และช่องทางติดต่อ ยังจำกัดตามขอบเขตข้อมูลเดิม",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "เห็นชื่อและข้อมูลติดต่อแบบเต็ม",
      create: "บันทึกข้อมูลระบุตัวตนเมื่อเพิ่มนักเรียนหรือเคส walk-in",
      update: "แก้ไขชื่อและเบอร์โทรของผู้รับบริการหรือนักเรียน",
      delete: "ลบรายการที่มีข้อมูลระบุตัวตน (นักเรียน)",
      assign: "ส่งชื่อผู้รับบริการไปกับการส่งต่อเคส",
      export: "ส่งออกไฟล์แบบระบุตัวตน (ไม่ปกปิดชื่อ)",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "clinical",
    category: "privacy",
    label: "ข้อมูลสุขภาพ",
    hint: "คำตอบแบบประเมินและผลทางคลินิก ยังจำกัดตามขอบเขตข้อมูลเดิม",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "เห็นคำตอบและผลประเมิน",
      create: "บันทึกข้อมูลทางคลินิกของเคส",
      update: "แก้ไขคำตอบหรือผลประเมินที่ส่งแล้ว",
      delete: "ลบเคสพร้อมผลประเมิน",
      assign: "ส่งชื่อแบบประเมินไปกับการส่งต่อเคส",
      export: "ส่งออกคำตอบและข้อมูลสุขภาพ",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "dashboard",
    category: "service",
    label: "แดชบอร์ด",
    hint: "ภาพรวมสถิติและกราฟจากแบบฟอร์ม",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูแดชบอร์ดและกราฟ",
      create: "สร้างกราฟใหม่",
      update: "แก้ไขกราฟ",
      delete: "ลบกราฟ",
      assign: "จัดลำดับกราฟและเลือกแบบฟอร์มเริ่มต้น",
      export: "ส่งออกข้อมูลแดชบอร์ด",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "cases",
    category: "service",
    label: "ข้อมูลเคสและเคสเสี่ยง",
    hint: "ข้อมูลเคส เคสเสี่ยง และการส่งต่อระหว่างหน่วยงาน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูเคสและเคสเสี่ยง",
      create: "เปิดเคส walk-in",
      update: "บันทึกการติดต่อและเปลี่ยนสถานะเคส",
      delete: "ลบเคส",
      assign: "ส่งต่อเคสไปหน่วยงานอื่น",
      export: "ส่งออกรายการเคส",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "appointments",
    category: "service",
    label: "ตารางนัดหมาย",
    hint: "ตารางนัดหมายของคลินิก",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูตารางนัดหมาย",
      create: "สร้างนัดหมาย",
      update: "เปลี่ยนสถานะนัด (มาตามนัด/เลื่อน)",
      delete: "ยกเลิกนัดหมาย",
      assign: "กำหนดผู้รับผิดชอบนัด",
      export: "ส่งออกตารางนัดหมาย",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "patient_members",
    category: "service",
    label: "ผู้มารับบริการ",
    hint: "บัญชีผู้มารับบริการของหน่วยงาน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูรายชื่อผู้มารับบริการ",
      create: "ส่งคำเชิญทำแบบประเมินถึงบัญชี",
      update: "แก้ไขข้อมูลบัญชี",
      delete: "ปิดใช้งานบัญชีหรือยกเลิกคำเชิญ",
      assign: "ตั้งรหัสผ่านใหม่ให้ผู้รับบริการ",
      export: "ส่งออกรายชื่อผู้มารับบริการ",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "forms",
    category: "service",
    label: "จัดการฟอร์ม",
    hint: "สร้าง แก้ไข และเผยแพร่แบบประเมิน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูแบบฟอร์ม",
      create: "สร้างหรือคัดลอกแบบฟอร์ม",
      update: "แก้ไขคำถามและรายละเอียด",
      delete: "ลบแบบฟอร์ม",
      assign: "เผยแพร่/ปิด และผูกแบบฟอร์มกับคลินิก",
      export: "ส่งออกคำตอบแบบฟอร์ม",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "clinics",
    category: "settings",
    label: "จัดการคลินิก",
    hint: "คลินิกและบริการที่เปิดรับ",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูคลินิก",
      create: "เพิ่มคลินิก",
      update: "แก้ไขข้อมูลคลินิก",
      delete: "ลบคลินิก",
      assign: "จัดลำดับและแสดงคลินิกในศูนย์ช่วยเหลือ",
      export: "ส่งออกรายการคลินิก",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "help_center",
    category: "settings",
    label: "ศูนย์ช่วยเหลือ",
    hint: "บทความและคำถามที่พบบ่อยของหน่วยงาน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูบทความและหมวด",
      create: "เพิ่มบทความหรือหมวด",
      update: "แก้ไขบทความหรือหมวด",
      delete: "ลบบทความหรือหมวด",
      assign: "เผยแพร่หรือซ่อนบทความและหมวด",
      export: "ส่งออกบทความ",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "content",
    category: "settings",
    label: "จัดการภาพแบนเนอร์",
    hint: "ภาพแบนเนอร์หน้าเว็บ (จัดการทั้งระบบ)",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูแบนเนอร์",
      create: "เพิ่มแบนเนอร์",
      update: "แก้ไขแบนเนอร์",
      delete: "ลบแบนเนอร์",
      assign: "จัดลำดับแบนเนอร์",
      export: "ส่งออกรายการแบนเนอร์",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "school",
    category: "school",
    label: "โครงสร้างโรงเรียน ครู และประเภท",
    hint: "ชั้นปี ห้องเรียน ครู และประเภทครู/นักเรียน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูโครงสร้างและรายชื่อครู",
      create: "เพิ่มชั้นปี ห้อง ครู และประเภท",
      update: "แก้ไขโครงสร้างและข้อมูลครู",
      delete: "ลบชั้นปี ห้อง ครู หรือประเภท",
      assign: "จัดครูประจำห้องเรียน",
      export: "ส่งออกโครงสร้างและรายชื่อครู",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "students",
    category: "school",
    label: "นักเรียนและบัญชีนักเรียน",
    hint: "ข้อมูลนักเรียน บัญชีนักเรียน และการนำเข้า",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูรายชื่อนักเรียน",
      create: "เพิ่มหรือนำเข้านักเรียน",
      update: "แก้ไขข้อมูลและรีเซ็ตรหัสผ่านนักเรียน",
      delete: "ลบนักเรียน",
      assign: "ย้ายห้องเรียนและการลงทะเบียน",
      export: "ส่งออกรายชื่อนักเรียน",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "student_health",
    category: "school",
    label: "ข้อมูลสุขภาพนักเรียน",
    hint: "สุขภาพกาย สุขภาพจิต และข้อมูลเชิงลึก ตามบทบาทในโรงเรียน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูข้อมูลสุขภาพตามขอบเขตห้องหรือบทบาท",
      create: "บันทึกผลตรวจร่างกายและบันทึกแนะแนว",
      update: "แก้ไขข้อมูลสุขภาพและข้อมูลเชิงลึก",
      delete: "ลบผลตรวจร่างกาย",
      assign: "มอบหมายงานติดตามรายบุคคล",
      export: "ส่งออกข้อมูลสุขภาพนักเรียน",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "school_staff",
    category: "school",
    label: "ผู้ดูแล บุคลากร และบัญชีผู้ปกครอง",
    hint: "มอบบทบาทในโรงเรียน นำเข้าครู และบัญชีผู้ปกครอง (มอบบทบาทผู้ดูแลโรงเรียนได้)",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูบุคลากรและบทบาทในโรงเรียน",
      create: "สร้างบัญชีผู้ปกครองและนำเข้าครู",
      update: "เปลี่ยนบทบาทในโรงเรียน",
      delete: "ถอนบทบาทในโรงเรียน",
      assign: "ผูกผู้ปกครองกับนักเรียน",
      export: "ส่งออกรายชื่อบุคลากรและบทบาท",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "school_workflows",
    category: "school",
    label: "คัดกรองและติดตามโรงเรียน",
    hint: "รอบคัดกรอง เกณฑ์เสี่ยง เลื่อนชั้น และการเก็บข้อมูลหลังจบการศึกษา",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูรอบคัดกรอง เกณฑ์เสี่ยง และการตั้งค่า",
      create: "สร้างรอบคัดกรองและเกณฑ์เสี่ยง",
      update: "แก้ไขรอบ เกณฑ์ และคำแนะนำดูแล",
      delete: "เก็บถาวรข้อมูลหลังจบการศึกษา",
      assign: "เลื่อนชั้นนักเรียนทั้งรุ่น",
      export: "ส่งออกรอบคัดกรอง",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "student_behavior",
    category: "school",
    label: "บันทึกพฤติกรรม",
    hint: "รายงานพฤติกรรมจากครูรายวิชาและครูที่ปรึกษา ยังจำกัดตามนักเรียนที่ดูแล",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูรายงานพฤติกรรมและประวัติการติดตาม",
      create: "ส่งรายงานพฤติกรรมของนักเรียน",
      update: "บันทึกการติดตามและเปลี่ยนสถานะรายงาน",
      delete: "ยกเลิกรายงานพฤติกรรม",
      assign: "มอบผู้รับผิดชอบติดตามรายงาน",
      export: "ส่งออกรายงานพฤติกรรม",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "school_appointments",
    category: "service",
    label: "นัดหมายรับคำปรึกษา",
    hint: "นัดหมายที่นักเรียนขอรับคำปรึกษา และช่วงเวลาว่างของครู",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูนัดหมายของนักเรียนที่ดูแล",
      create: "เปิดช่วงเวลาว่างและนัดแทนนักเรียน",
      update: "ยืนยัน เลื่อน และบันทึกผลการนัด",
      delete: "ยกเลิกนัดหมาย",
      assign: "โอนนัดหมายให้ครูคนอื่น",
      export: "ส่งออกรายการนัดหมาย",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "school_documents",
    category: "school",
    label: "คลังเอกสาร",
    hint: "คู่มือ แบบฟอร์ม และแนวทางจากงานส่งเสริมสุขภาวะ",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูและดาวน์โหลดเอกสารที่เปิดให้บทบาทนี้",
      create: "อัปโหลดเอกสารหรือเพิ่มลิงก์",
      update: "แก้ไขชื่อ คำอธิบาย และไฟล์เอกสาร",
      delete: "ซ่อนหรือลบเอกสาร",
      assign: "จัดหมวดและกำหนดผู้มองเห็นเอกสาร",
      export: "ส่งออกรายการเอกสาร",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "referral_approvals",
    category: "school",
    label: "อนุมัติการส่งต่อโรงพยาบาล",
    hint: "การส่งต่อนักเรียนไปหน่วยงานโรงพยาบาลต้องผ่านการอนุมัติในโรงเรียนก่อน",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูคำขอส่งต่อที่รออนุมัติและประวัติการอนุมัติ",
      create:
        "ไม่มีผล: คำขอเกิดเมื่อส่งต่อจากแฟ้มนักเรียน (ใช้สิทธิ์จัดสรรเคส)",
      update: "อนุมัติหรือไม่อนุมัติคำขอส่งต่อ",
      delete: "ยกเลิกคำขอส่งต่อที่ยังรออนุมัติของผู้อื่น",
      assign: "ไม่มีผล: คำขอไม่มีผู้รับผิดชอบ",
      export: "ไม่มีผล: ยังไม่มีการส่งออกคำขอ",
      manage: "ทำได้ทุกอย่างในโมดูลนี้ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
  {
    id: "audit",
    category: "settings",
    label: "ประวัติการแก้ไขข้อมูล",
    hint: "ใครแก้ไขข้อมูลสำคัญเมื่อไร ประวัติแก้ไขหรือลบไม่ได้",
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
      "manage",
    ],
    meanings: {
      view: "ดูประวัติการแก้ไขข้อมูลของหน่วยงาน",
      create: "ไม่มีผล: ระบบบันทึกประวัติเองเท่านั้น",
      update: "ไม่มีผล: ประวัติแก้ไขไม่ได้",
      delete: "ไม่มีผล: ประวัติลบไม่ได้",
      assign: "ไม่มีผล: ประวัติไม่มีผู้รับผิดชอบ",
      export: "ส่งออกประวัติการแก้ไข",
      manage: "ดูและส่งออกประวัติ (รวมทุกสิทธิ์ด้านซ้าย)",
    },
  },
];

const COMMON_PERMISSION_GROUPS = new Set([
  "master_data",
  "pii",
  "clinical",
  "dashboard",
  "cases",
  "forms",
  "audit",
]);
const SCHOOL_PERMISSION_GROUPS = new Set([
  ...COMMON_PERMISSION_GROUPS,
  "school",
  "students",
  "student_health",
  "school_staff",
  "school_workflows",
  "student_behavior",
  "school_appointments",
  "school_documents",
  "referral_approvals",
]);
const HEALTH_SERVICE_PERMISSION_GROUPS = new Set([
  ...COMMON_PERMISSION_GROUPS,
  "appointments",
  "patient_members",
  "clinics",
  // Help Center FAQs are grouped by clinic, so only hospital units have it.
  "help_center",
]);

export function permissionGroupsForOrganization(organization) {
  const allowed =
    organization?.org_type === "school"
      ? SCHOOL_PERMISSION_GROUPS
      : HEALTH_SERVICE_PERMISSION_GROUPS;
  return PERMISSION_GROUPS.filter((group) => allowed.has(group.id));
}

export const MODULES = PERMISSION_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
}));

const MODULE_ACTION = {
  Dashboard: "dashboard.view",
  "Case Management": "cases.view",
  Appointments: "appointments.view",
  "User Management": "patient_members.view",
  "Form Management": "forms.view",
  "Clinic Management": "clinics.view",
  "Help Center Management": "help_center.view",
  "Content Management": "content.view",
  "Roles & Permissions": "roles.manage",
  "จัดการผู้ใช้ (Users)": "patient_members.view",
  จัดการผู้ใช้: "patient_members.view",
  จัดการเคส: "cases.view",
  ตารางนัดหมาย: "appointments.view",
  จัดการฟอร์ม: "forms.view",
};

// "<module>.manage" grants every action of that module.
export function expandManage(keys = []) {
  const result = new Set(keys);
  for (const key of keys) {
    const [module, action] = String(key).split(".");
    if (action === "manage")
      PERMISSION_ACTIONS.forEach((other) => result.add(`${module}.${other}`));
  }
  return result;
}

export function permissionMap(rows = []) {
  if (Array.isArray(rows) && rows.every((row) => typeof row === "string"))
    return expandManage(rows);
  const set = new Set();
  rows.forEach((row) => {
    const base = MODULE_ACTION[row.module];
    if (!base) return;
    const [resource] = base.split(".");
    if (row.can_view || row.can_manage || row.can_full)
      set.add(`${resource}.view`);
    if (row.can_manage || row.can_full)
      ["create", "update", "delete", "assign", "export"].forEach((action) =>
        set.add(`${resource}.${action}`),
      );
  });
  return set;
}

export function canAccess(
  permissions,
  moduleOrPermission,
  level = "view",
  isSystemAdmin = false,
) {
  if (isSystemAdmin) return true;
  const manages = {
    "Case Management": "cases.update",
    Appointments: "appointments.update",
    "User Management": "patient_members.update",
    "Form Management": "forms.update",
    "Clinic Management": "clinics.update",
    "Help Center Management": "help_center.update",
    "Content Management": "content.update",
  };
  const key = moduleOrPermission.includes(".")
    ? moduleOrPermission
    : level === "manage"
      ? manages[moduleOrPermission] || MODULE_ACTION[moduleOrPermission]
      : MODULE_ACTION[moduleOrPermission];
  return Boolean(key && permissions?.has?.(key));
}
