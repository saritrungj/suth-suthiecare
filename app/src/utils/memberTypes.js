// Service-recipient types. The server decides the type (see
// server/services/memberType.js); the app only labels and explains it.
export const MEMBER_TYPE_LABELS = {
  university_student: { th: "นักศึกษา", en: "University student" },
  school_student: { th: "นักเรียน", en: "School student" },
  general: { th: "บุคคลทั่วไป", en: "General public" },
  unknown: { th: "ยังไม่ระบุ", en: "Not stated yet" },
};

// The university faculties offered in the assessment forms.
export const FACULTY_OPTIONS = [
  "สำนักวิชาวิทยาศาสตร์",
  "สำนักวิชาเทคโนโลยีสังคม",
  "สำนักวิชาเทคโนโลยีการเกษตร",
  "สำนักวิชาวิศวกรรมศาสตร์",
  "สำนักวิชาแพทยศาสตร์",
  "สำนักวิชาพยาบาลศาสตร์",
  "สำนักวิชาทันตแพทยศาสตร์",
  "สำนักวิชาสาธารณสุขศาสตร์",
  "สำนักวิชาศาสตร์และศิลป์ดิจิทัล",
];

export const memberTypeLabel = (type, language = "th") =>
  (MEMBER_TYPE_LABELS[type] || MEMBER_TYPE_LABELS.unknown)[
    language === "en" ? "en" : "th"
  ];
