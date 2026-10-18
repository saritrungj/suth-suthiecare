// Every per-organization lookup list lives here, teacher and student types
// included (their own tables, status active/inactive via `school`).
// `group` places a category in the master data page's category list;
// `usage` counts the rows that point at an item, shown as "ใช้อยู่".
// schoolOnly categories describe students and families: hospital units do not
// manage them, but forms may still read their active options.
const catalog = {
  faculty: {
    group: "general",
    hint: "ตัวเลือกสำนักวิชาในแบบประเมินและข้อมูลผู้รับบริการ",
    label: "สำนักวิชา",
    defaults: [
      "(1) สำนักวิชาวิทยาศาสตร์",
      "(2) สำนักวิชาเทคโนโลยีสังคม",
      "(3) สำนักวิชาเทคโนโลยีการเกษตร",
      "(4) สำนักวิชาวิศวกรรมศาสตร์",
      "(5) สำนักวิชาแพทยศาสตร์",
      "(6) สำนักวิชาพยาบาลศาสตร์",
      "(7) สำนักวิชาทันตแพทยศาสตร์",
      "(8) สำนักวิชาสาธารณสุขศาสตร์",
      "(9) สำนักวิชาศาสตร์และศิลป์ดิจิทัล",
      "อื่นๆ",
    ].map((label, index) => ["faculty_" + index, label]),
  },
  user_status: {
    group: "general",
    hint: "อาชีพหรือสถานะที่ผู้รับบริการเลือกในแบบประเมิน",
    label: "อาชีพ/สถานะผู้รับบริการ",
    defaults: [
      ["student", "นักศึกษา"],
      ["general", "บุคคลทั่วไป"],
    ],
  },
  publication_status: {
    group: "system",
    hint: "สถานะของแบบประเมินที่ระบบใช้ควบคุมการเผยแพร่",
    label: "สถานะเผยแพร่",
    fixed: true,
    defaults: [
      ["published", "เผยแพร่"],
      ["draft", "ร่าง"],
      ["hidden", "ซ่อน"],
    ],
  },

  student_status: {
    group: "system",
    hint: "สถานะการศึกษาที่ระบบใช้คัดกรองรายชื่อนักเรียน",
    schoolOnly: true,
    label: "สถานะนักเรียน",
    fixed: true,
    defaults: require("./studentStatus").current.map((code) => [
      code,
      require("./studentStatus").labels[code],
    ]),
  },
  risk_level: {
    group: "system",
    hint: "ระดับความเสี่ยงจากการให้คะแนนแบบประเมิน",
    label: "ระดับความเสี่ยง",
    fixed: true,
    defaults: [
      ["high", "เสี่ยงสูง"],
      ["medium", "เสี่ยงปานกลาง"],
      ["normal", "ปกติ"],
      ["none", "ยังไม่มีผล"],
    ],
  },
  gender: {
    group: "system",
    hint: "เพศในข้อมูลบุคคลและรายงาน",
    label: "เพศ",
    fixed: true,
    defaults: [
      ["male", "ชาย"],
      ["female", "หญิง"],
      ["other", "อื่น ๆ"],
    ],
  },
  blood_type: {
    group: "system",
    hint: "กรุ๊ปเลือดในข้อมูลสุขภาพนักเรียน",
    schoolOnly: true,
    label: "กรุ๊ปเลือด",
    fixed: true,
    defaults: ["A", "B", "AB", "O", "unknown"].map((code) => [
      code,
      code === "unknown" ? "ไม่ทราบ" : code,
    ]),
  },
  hearing: {
    group: "system",
    hint: "ผลตรวจการได้ยินในข้อมูลสุขภาพนักเรียน",
    schoolOnly: true,
    label: "ผลตรวจการได้ยิน",
    fixed: true,
    defaults: [
      ["normal", "ปกติ"],
      ["abnormal", "ผิดปกติ"],
      ["not_tested", "ยังไม่ได้ตรวจ"],
    ],
  },
  prefix: {
    group: "general",
    hint: "คำนำหน้าชื่อในแบบฟอร์มและข้อมูลบุคคล",
    label: "คำนำหน้า",
    defaults: [
      ["boy", "ด.ช."],
      ["girl", "ด.ญ."],
      ["mr", "นาย"],
      ["miss", "นางสาว"],
      ["mrs", "นาง"],
    ],
  },
  guardian_relationship: {
    group: "school",
    hint: "ความสัมพันธ์ของผู้ปกครองกับนักเรียน",
    schoolOnly: true,
    label: "ความสัมพันธ์ผู้ปกครอง",
    defaults: [
      ["father", "บิดา"],
      ["mother", "มารดา"],
      ["relative", "ญาติ"],
      ["other", "อื่น ๆ"],
    ],
  },
  living_with: {
    group: "school",
    hint: "ผู้ที่นักเรียนพักอาศัยด้วย",
    schoolOnly: true,
    label: "พักอาศัยกับ",
    defaults: [
      ["parents", "บิดามารดา"],
      ["guardian", "ผู้ปกครอง"],
      ["dormitory", "หอพัก"],
      ["other", "อื่น ๆ"],
    ],
  },
  family_status: {
    group: "school",
    hint: "สภาพครอบครัวของนักเรียน",
    schoolOnly: true,
    label: "สภาพครอบครัว",
    defaults: [
      ["together", "อยู่ร่วมกัน"],
      ["separated", "แยกกันอยู่"],
      ["single_parent", "ผู้ปกครองคนเดียว"],
      ["other", "อื่น ๆ"],
    ],
  },
  support_needs: {
    group: "school",
    hint: "ความช่วยเหลือที่นักเรียนต้องการ",
    schoolOnly: true,
    label: "ความช่วยเหลือที่ต้องการ",
    defaults: [
      ["education", "การศึกษา"],
      ["financial", "ทุน/ค่าใช้จ่าย"],
      ["health", "สุขภาพ"],
      ["family", "ครอบครัว"],
      ["other", "อื่น ๆ"],
    ],
  },
  teacher_types: {
    group: "school",
    hint: "ใช้กับรายชื่อครูและไฟล์นำเข้าครู",
    label: "ประเภทครู",
    table: "school_teacher_types",
    fields: ["name", "description"],
    maxLength: { name: 100 },
    school: true,
    usage: { table: "school_teachers", column: "teacher_type_id" },
  },
  student_types: {
    group: "school",
    hint: "ชื่อต้องตรงกับคอลัมน์ประเภทนักเรียนในไฟล์นำเข้านักเรียน",
    label: "ประเภทนักเรียน",
    table: "school_student_types",
    fields: ["name", "description"],
    maxLength: { name: 100 },
    school: true,
    usage: { table: "school_students", column: "student_type_id" },
  },
  services: {
    group: "service",
    hint: "ประเภทบริการและสีที่ใช้ในตารางนัดหมาย",
    label: "ประเภทบริการ",
    table: "service_types",
    fields: ["name", "color"],
  },
  case_statuses: {
    group: "service",
    hint: "สถานะเคสที่เจ้าหน้าที่เลือกระหว่างติดตาม",
    label: "สถานะเคส",
    table: "case_statuses",
    lockedFields: ["name"],
    // New cases start here, so this status cannot be switched off.
    alwaysActive: {
      field: "name",
      values: [require("./caseStatus").INITIAL_CASE_STATUS],
    },
    fields: ["name", "color", "clinic_type"],
  },
  templates: {
    group: "service",
    hint: "ข้อความสำเร็จรูปสำหรับบันทึกการติดตามเคส",
    label: "แม่แบบบันทึก",
    table: "note_templates",
    fields: ["label", "text", "clinic_type"],
    private: ["text"],
  },
};
module.exports = catalog;
