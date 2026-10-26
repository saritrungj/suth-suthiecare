// Realistic, entirely synthetic school data for the screenshots in the user
// guides and the school presentation. Register after mockResponsiveApi: a
// later page.route wins, and anything not handled here falls back to it.

const FIRST = [
  ["เด็กหญิง", "ปภาวรินทร์", "ใจดี"],
  ["เด็กชาย", "ธนกฤต", "สุขสวัสดิ์"],
  ["เด็กหญิง", "ณัฐธิดา", "มั่นคง"],
  ["เด็กชาย", "กิตติพัฒน์", "ศรีสุข"],
  ["เด็กหญิง", "พิมพ์ชนก", "รุ่งเรือง"],
  ["เด็กชาย", "ภูริภัทร", "แสงทอง"],
  ["เด็กหญิง", "ชนิกานต์", "บุญมา"],
  ["เด็กชาย", "วีรภัทร", "ทองดี"],
  ["นางสาว", "อรุณรัตน์", "พงษ์ไพร"],
  ["นาย", "ศุภกร", "วงศ์ใหญ่"],
];
const ROOMS = [
  { id: 11, grade_id: 1, grade_name: "ม.1", classroom_name: "1/1" },
  { id: 12, grade_id: 1, grade_name: "ม.1", classroom_name: "1/2" },
  { id: 21, grade_id: 2, grade_name: "ม.2", classroom_name: "2/1" },
  { id: 31, grade_id: 3, grade_name: "ม.3", classroom_name: "3/1" },
];
const RISKS = [
  "normal",
  "normal",
  "medium",
  "normal",
  "high",
  "normal",
  "normal",
  "medium",
  "normal",
  "none",
];

export const SHOWCASE_SCHOOL = {
  id: 1,
  name: "โรงเรียนสาธิต",
  code: "SATIT",
  status: "active",
  student_count: 40,
  classroom_count: ROOMS.length,
  teacher_count: 6,
  organization_id: 3,
};

export const SHOWCASE_STUDENTS = Array.from({ length: 40 }, (_, i) => {
  // Offset each block of ten so a risk level is not always the same name.
  const [prefix, first_name, last_name] =
    FIRST[(i + 3 * Math.floor(i / FIRST.length)) % FIRST.length];
  const room = ROOMS[i % ROOMS.length];
  return {
    id: i + 1,
    school_id: 1,
    student_code: String(65001 + i),
    prefix,
    first_name,
    last_name,
    nickname: ["ข้าวหอม", "ภู", "ใบเตย", "ต้นกล้า", "มะปราง"][i % 5],
    classroom_id: room.id,
    classroom_name: room.classroom_name,
    grade_id: room.grade_id,
    grade_name: room.grade_name,
    status: "active",
    status_label: "กำลังศึกษา",
    is_boarder: i % 4 === 0,
    username: `s${65001 + i}`,
    account_status: "active",
    student_type_name: "นักเรียนปกติ",
    can_view_health: true,
  };
});

const name = (s) => `${s.prefix} ${s.first_name} ${s.last_name}`;

export const SHOWCASE_RISK = SHOWCASE_STUDENTS.map((s, i) => ({
  id: s.id,
  student_code: s.student_code,
  student_name: name(s),
  grade_name: s.grade_name,
  classroom_name: s.classroom_name,
  is_boarder: s.is_boarder,
  risk_status: RISKS[i % RISKS.length],
  assessed_on: RISKS[i % RISKS.length] === "none" ? null : "2026-10-08",
  care_advice:
    RISKS[i % RISKS.length] === "high"
      ? "ครูประจำชั้นพูดคุยรายบุคคล และส่งต่อครูแนะแนวภายในสัปดาห์นี้"
      : RISKS[i % RISKS.length] === "medium"
        ? "ติดตามอาการ และชวนทำแบบประเมินซ้ำใน 2 สัปดาห์"
        : "ดูแลตามปกติ",
}));

const TEACHERS = [
  ["ครูสมศรี", "รักเรียน", "ครูประจำชั้น"],
  ["ครูวิชัย", "ใจกว้าง", "ครูประจำชั้น"],
  ["ครูนภา", "แนะแนวดี", "ครูแนะแนว"],
  ["ครูประเสริฐ", "ทองคำ", "ครูประจำชั้น"],
  ["ครูมาลี", "ศรีสุข", "พยาบาลประจำโรงเรียน"],
  ["ครูอนันต์", "มีชัย", "ครูประจำชั้น"],
].map(([first_name, last_name, position], i) => ({
  id: i + 1,
  user_id: 20 + i,
  school_id: 1,
  employee_code: `T${101 + i}`,
  first_name,
  last_name,
  name: `${first_name} ${last_name}`,
  username: `teacher${i + 1}`,
  position,
  teacher_type_name: position,
  status: "active",
  classrooms:
    i < ROOMS.length
      ? [
          {
            classroom_id: ROOMS[i].id,
            grade_name: ROOMS[i].grade_name,
            name: ROOMS[i].classroom_name,
            academic_year: 2569,
            role: "homeroom",
          },
        ]
      : [],
}));

const FORMS = [
  {
    id: 75,
    title: "แบบประเมินความเครียดนักเรียน (ST-5)",
    health_domain: "mental",
    status: "published",
  },
  {
    id: 76,
    title: "แบบคัดกรองภาวะซึมเศร้า (9Q)",
    health_domain: "mental",
    status: "published",
  },
  {
    id: 77,
    title: "บันทึกสุขภาพกายประจำภาค",
    health_domain: "physical",
    status: "published",
  },
];

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
};

export const SHOWCASE_RESCREEN = [
  [5, "pending", 3, true],
  [15, "pending", -2, true],
  [3, "pending", 9, false],
  [8, "completed", -6, true],
  [25, "pending", 5, true],
].map(([studentId, status, due, account], i) => {
  const s = SHOWCASE_STUDENTS[studentId - 1];
  return {
    id: i + 1,
    school_id: 1,
    student_id: s.id,
    student_code: s.student_code,
    classroom_id: s.classroom_id,
    source_response_id: 300 + i,
    target_form_id: 75,
    target_form_title: FORMS[0].title,
    assigned_user_id: 22,
    assigned_username: "ครูนภา แนะแนวดี",
    created_at: `${day(-10)}T08:00:00.000Z`,
    due_on: day(due),
    status,
    overdue: status === "pending" && due < 0,
    completed_at: status === "completed" ? `${day(-7)}T09:00:00.000Z` : null,
    has_account: account,
  };
});

const ACCESS = {
  can_view_school: true,
  can_create_school: true,
  can_update_school: true,
  can_delete_school: true,
  can_manage_staff: true,
  can_view_all_students: true,
  can_assign_school: true,
  can_assign_students: true,
  can_view_students: true,
  can_create_students: true,
  can_manage_students: true,
  can_import_students: true,
  can_export_students: true,
  can_view_health: true,
  can_update_health: true,
  can_view_mental: true,
  can_view_physical: true,
  can_view_risk: true,
  can_manage_workflows: true,
  can_use_behavior: true,
  can_use_appointments: true,
  can_use_documents: true,
  can_view_reports: true,
  counselor_grade_ids: [],
  classroom_ids: ROOMS.map((r) => r.id),
  ...Object.fromEntries(
    [
      "staff_actions",
      "workflow_actions",
      "health_actions",
      "behavior_actions",
      "appointment_actions",
      "document_actions",
    ].map((k) => [
      k,
      Object.fromEntries(
        [
          "view",
          "create",
          "update",
          "delete",
          "assign",
          "export",
          "manage",
        ].map((a) => [a, true]),
      ),
    ]),
  ),
};

function page(rows, url) {
  const p = Number(url.searchParams.get("page") || 1);
  const limit = Number(url.searchParams.get("limit") || 20);
  return {
    data: rows.slice((p - 1) * limit, p * limit),
    pagination: {
      page: p,
      limit,
      total: rows.length,
      total_pages: Math.max(1, Math.ceil(rows.length / limit)),
    },
  };
}

export async function mockSchoolShowcase(page_) {
  await page_.route("**/api/**", async (route) => {
    const req = route.request();
    if (req.method() !== "GET") return route.fallback();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^\/api/, "");
    const send = (json) => route.fulfill({ json });
    if (p === "/school/access") return send(ACCESS);
    if (p === "/school/schools") return send([SHOWCASE_SCHOOL]);
    if (p === "/school/students") {
      const status = url.searchParams.get("status");
      const rows = SHOWCASE_STUDENTS.filter(
        (s) => !status || s.status === status,
      );
      return send(page(rows, url));
    }
    if (p === "/school/schools/1/grades")
      return send(
        [1, 2, 3].map((id) => ({
          id,
          school_id: 1,
          name: `ม.${id}`,
          sort_order: id,
        })),
      );
    if (p === "/school/schools/1/classrooms")
      return send(
        ROOMS.map((r) => ({
          ...r,
          grade_level_id: r.grade_id,
          school_id: 1,
          name: r.classroom_name,
          academic_year: 2569,
          student_count: 10,
          teachers: TEACHERS.filter((t) =>
            t.classrooms.some((c) => c.classroom_id === r.id),
          ).map((t) => ({
            teacher_id: t.id,
            name: t.name,
            role: "homeroom",
          })),
        })),
      );
    if (p === "/school/teachers") return send(TEACHERS);
    if (p === "/school/risk-summary") {
      const boarders = url.searchParams.get("is_boarder") === "1";
      return send({
        data: SHOWCASE_RISK.filter((r) => !boarders || r.is_boarder),
      });
    }
    if (p === "/school/screening-rounds")
      return send([
        {
          id: 4,
          school_id: 1,
          name: "คัดกรองต้นภาคเรียน",
          academic_year: 2569,
          semester: 2,
          health_domain: "mental",
          form_id: 75,
          form_title: FORMS[0].title,
          starts_on: day(-14),
          ends_on: day(14),
          status: "active",
        },
      ]);
    if (p === "/school/screening-rounds/4/progress") {
      const rows = SHOWCASE_RISK.map((r) => ({
        id: r.id,
        student_code: r.student_code,
        student_name: r.student_name,
        grade_name: r.grade_name,
        classroom_name: r.classroom_name,
        completed_on: r.assessed_on,
      }));
      return send({
        total: rows.length,
        completed: rows.filter((r) => r.completed_on).length,
        outstanding: rows.filter((r) => !r.completed_on).length,
        data: rows,
      });
    }
    if (p === "/school/rescreen-tasks") return send(SHOWCASE_RESCREEN);
    if (p === "/school/cases") {
      const risk = url.searchParams.get("risk");
      const rows = SHOWCASE_STUDENTS.map((st, i) => ({
        ...st,
        overall_risk: SHOWCASE_RISK[i].risk_status,
        latest_activity: SHOWCASE_RISK[i].assessed_on
          ? { occurred_at: `${SHOWCASE_RISK[i].assessed_on}T03:00:00Z` }
          : null,
      }))
        .filter((r) => !risk || r.overall_risk === risk)
        .sort(
          (a, b) =>
            ["high", "medium", "normal", "none"].indexOf(a.overall_risk) -
            ["high", "medium", "normal", "none"].indexOf(b.overall_risk),
        );
      const counts = { high: 0, medium: 0, normal: 0, none: 0 };
      SHOWCASE_RISK.forEach((r) => (counts[r.risk_status] += 1));
      return send({ ...page(rows, url), counts });
    }
    const care = careShowcase(p, url);
    if (care !== undefined) return send(care);
    return route.fallback();
  });
}

// School care screens: notifications, behaviour, follow-ups, appointments,
// documents, reports, care settings and the change history.
const STUDENT = (i) => {
  const s = SHOWCASE_STUDENTS[i];
  return {
    student_id: s.id,
    student_code: s.student_code,
    student_name: `${s.prefix} ${s.first_name} ${s.last_name}`,
    grade_name: ROOMS[i % ROOMS.length].grade_name,
    classroom_name: ROOMS[i % ROOMS.length].classroom_name,
  };
};
const at = (days, time) => `${day(days)}T${time}`;
const BEHAVIOR_OPTIONS = {
  categories: {
    learning: "การเรียน",
    attendance: "การมาเรียน",
    emotion: "อารมณ์และความรู้สึก",
    social: "ความสัมพันธ์กับเพื่อน",
    conduct: "ความประพฤติ",
    health: "สุขภาพ",
    other: "อื่น ๆ",
  },
  levels: { low: "เล็กน้อย", medium: "ควรติดตาม", high: "เร่งด่วน" },
  statuses: {
    new: "ใหม่",
    acknowledged: "รับทราบแล้ว",
    following: "กำลังติดตาม",
    closed: "ปิดแล้ว",
    cancelled: "ยกเลิก",
  },
  actions: Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export"].map((a) => [
      a,
      true,
    ]),
  ),
};
const BEHAVIOR = [
  [4, "emotion", "high", "new", -1, "ครูวิชาภาษาไทย", null],
  [
    7,
    "attendance",
    "medium",
    "following",
    -3,
    "ครูวิชาคณิตศาสตร์",
    "ครูแนะแนว ม.ต้น",
  ],
  [2, "social", "medium", "acknowledged", -4, "ครูประจำชั้น 1/2", null],
  [
    12,
    "learning",
    "low",
    "closed",
    -9,
    "ครูวิชาวิทยาศาสตร์",
    "ครูประจำชั้น 1/1",
  ],
  [15, "conduct", "low", "closed", -12, "ครูวิชาพลศึกษา", "ครูประจำชั้น 3/1"],
].map(
  (
    [i, category, concern_level, status, d, reporter_name, assignee_name],
    n,
  ) => ({
    id: n + 1,
    ...STUDENT(i),
    category,
    concern_level,
    observed_on: day(d),
    details: "สังเกตว่านักเรียนเงียบกว่าปกติและไม่ส่งงานสองสัปดาห์ติดกัน",
    status,
    reporter_name,
    assignee_name,
    access: "full",
  }),
);
const FOLLOW_UPS = [
  [5, "BMI สูงกว่าเกณฑ์ของโรงเรียน", 26.4, -2, 12, "open"],
  [9, "ความดันตัวบนสูงกว่าเกณฑ์", 136, -6, -1, "in_progress"],
  [18, "BMI ต่ำกว่าเกณฑ์ของโรงเรียน", 16.1, -20, 10, "done"],
].map(([i, rule_label, value, measured, due, status], n) => ({
  id: n + 1,
  ...STUDENT(i),
  rule_label,
  value,
  measured_at: day(measured),
  due_on: day(due),
  status,
  assignee_name: status === "open" ? null : "ครูอนามัยโรงเรียน",
}));
const APPOINTMENTS = [
  [3, 1, "09:00", "09:30", "requested", "อารมณ์และความรู้สึก"],
  [8, 1, "10:00", "10:30", "confirmed", "การเรียน"],
  [14, 2, "13:30", "14:00", "confirmed", "เพื่อนและความสัมพันธ์"],
  [6, -2, "11:00", "11:30", "completed", "ครอบครัว"],
].map(([i, d, start, end, status, topic_label], n) => ({
  id: n + 1,
  ...STUDENT(i),
  starts_at: at(d, start),
  ends_at: at(d, end),
  status,
  topic_label,
  staff_name: "ครูแนะแนว ม.ต้น",
}));
const DOCUMENTS = [
  [
    "คู่มือการดูแลช่วยเหลือนักเรียน",
    "คู่มือ",
    "file",
    "handbook.pdf",
    ["all_staff"],
  ],
  [
    "แบบบันทึกการเยี่ยมบ้าน",
    "แบบฟอร์ม",
    "file",
    "home-visit.docx",
    ["all_staff"],
  ],
  [
    "แนวทางส่งต่อนักเรียนกลุ่มเสี่ยง",
    "แนวทาง",
    "file",
    "referral-guide.pdf",
    ["mental_staff"],
  ],
  [
    "เคล็ดลับจัดการความเครียดก่อนสอบ",
    "ประชาสัมพันธ์",
    "link",
    null,
    ["students", "all_staff"],
  ],
].map(([title, category_name, kind, file_name, audience], n) => ({
  id: n + 1,
  title,
  description: "",
  category_id: n + 1,
  category_name,
  kind,
  file_name,
  url: kind === "link" ? "https://example.org/stress-tips" : null,
  size_bytes: kind === "file" ? 245760 : null,
  audience,
  status: "active",
  uploader_name: "งานส่งเสริมสุขภาวะ",
  updated_at: `${day(-n * 3)}T09:00:00+07:00`,
}));
const AUDIENCES = {
  all_staff: "บุคลากรทุกคน",
  mental_staff: "ทีมสุขภาพใจ",
  physical_staff: "ทีมสุขภาพกาย",
  students: "นักเรียน",
};
const listOf = (rows, url, extra = {}) => ({ ...page(rows, url), ...extra });

function careShowcase(p, url) {
  if (p === "/school/notifications/unread-count") return { count: 3 };
  if (p === "/school/notifications")
    return {
      items: [
        {
          id: 1,
          kind: "risk_alert",
          student_id: 5,
          payload: {
            title: "พบนักเรียนกลุ่มเสี่ยงสูง",
            body: `${STUDENT(4).student_code} ${STUDENT(4).student_name} · ห้อง ม.1/1 · เสี่ยงสูง\nคำแนะนำ: พูดคุยรายบุคคลภายในวันนี้และแจ้งครูแนะแนว`,
          },
          read_at: null,
          acknowledged_at: null,
          created_at: at(0, "08:15:00"),
        },
        {
          id: 2,
          kind: "behavior_report",
          student_id: 8,
          payload: {
            title: "รายงานพฤติกรรมใหม่",
            body: `${STUDENT(7).student_code} ห้อง 2/1 · การมาเรียน · ควรติดตาม`,
          },
          read_at: null,
          acknowledged_at: null,
          created_at: at(-1, "14:02:00"),
        },
        {
          id: 3,
          kind: "appointment",
          student_id: 4,
          payload: {
            title: "นักเรียนขอนัดรับคำปรึกษา",
            body: `${STUDENT(3).student_code} · ${at(1, "09:00").replace("T", " ")} · อารมณ์และความรู้สึก`,
          },
          read_at: null,
          acknowledged_at: null,
          created_at: at(-1, "10:40:00"),
        },
      ],
      total: 3,
      page: 1,
      page_size: 10,
    };
  if (p === "/school/behavior-reports/options") return BEHAVIOR_OPTIONS;
  if (p === "/school/behavior-reports") return listOf(BEHAVIOR, url);
  const report = p.match(new RegExp("^/school/behavior-reports/([0-9]+)$"));
  if (report) {
    const row = BEHAVIOR[Number(report[1]) - 1] || BEHAVIOR[0];
    return {
      ...row,
      history: [
        {
          id: 1,
          status: "acknowledged",
          note: "คุยกับนักเรียนแล้ว นัดติดตามสัปดาห์หน้า",
          assigned_to: 2,
          by: "ครูแนะแนว ม.ต้น",
          created_at: `${row.observed_on}T10:00:00+07:00`,
        },
      ],
      assignees: [
        { id: 2, name: "ครูแนะแนว ม.ต้น" },
        { id: 3, name: "ครูประจำชั้น 1/1" },
      ],
    };
  }
  if (p === "/school/follow-ups")
    return listOf(FOLLOW_UPS, url, {
      statuses: {
        open: "รอติดตาม",
        in_progress: "กำลังติดตาม",
        done: "ติดตามแล้ว",
        cancelled: "ยกเลิก",
      },
      can_update: true,
    });
  if (p === "/school/appointments")
    return listOf(APPOINTMENTS, url, {
      statuses: {
        requested: "รอยืนยัน",
        confirmed: "ยืนยันแล้ว",
        rescheduled: "เลื่อนเวลา",
        cancelled: "ยกเลิก",
        completed: "พบแล้ว",
        no_show: "ไม่มาตามนัด",
      },
      oversees: true,
    });
  if (p === "/school/appointment-slots")
    return {
      slots: [
        {
          id: 1,
          starts_at: at(1, "09:00"),
          ends_at: at(1, "09:30"),
          capacity: 1,
          booked: 1,
          status: "open",
        },
        {
          id: 2,
          starts_at: at(1, "10:00"),
          ends_at: at(1, "10:30"),
          capacity: 1,
          booked: 1,
          status: "open",
        },
        {
          id: 3,
          starts_at: at(3, "13:00"),
          ends_at: at(3, "13:30"),
          capacity: 2,
          booked: 0,
          status: "open",
        },
      ],
    };
  if (p === "/school/document-categories")
    return {
      categories: ["คู่มือ", "แบบฟอร์ม", "แนวทาง", "ประชาสัมพันธ์"].map(
        (name, i) => ({
          id: i + 1,
          name,
          status: "active",
        }),
      ),
      audiences: AUDIENCES,
      actions: BEHAVIOR_OPTIONS.actions,
    };
  if (p === "/school/documents") return listOf(DOCUMENTS, url);
  if (p === "/school/reports/overview")
    return {
      school: { id: 1, name: SHOWCASE_SCHOOL.name },
      population: 40,
      scope: "school",
      suppressed_below: null,
      trend_basis: "rounds",
      trend: [
        {
          key: "round-1",
          label: "คัดกรองต้นปีการศึกษา",
          high: 6,
          medium: 9,
          normal: 22,
          assessed: 37,
          not_assessed: 3,
        },
        {
          key: "round-2",
          label: "คัดกรองต้นภาคเรียน",
          high: 4,
          medium: 7,
          normal: 26,
          assessed: 37,
          not_assessed: 3,
        },
      ],
      follow_up: {
        behavior: { new: 1, following: 2, closed: 2 },
        physical: { open: 2, overdue: 1, done: 1 },
        rescreen: { pending: 3, overdue: 1, completed: 5 },
        guidance: { overdue: 2 },
        referrals: { pending: 1, in_progress: 2, completed: 3 },
        appointments: { upcoming: 3, completed: 4, no_show: 0 },
      },
    };
  if (p === "/school/care-guidance/1")
    return {
      care_advice: {
        high: "พูดคุยรายบุคคลภายในวันนี้และแจ้งครูแนะแนว",
        medium: "นัดติดตามภายในสัปดาห์นี้",
        normal: "ดูแลตามปกติ",
        none: "เชิญทำแบบประเมิน",
      },
      care_guidance: {
        high: {
          observe: "การมาเรียน การเก็บตัว และการเปลี่ยนแปลงที่เห็นชัด",
          talk: "ชวนคุยในที่เป็นส่วนตัว ถามว่าช่วงนี้เป็นอย่างไรบ้าง และรับฟังโดยไม่ตัดสิน",
          follow_up: "ติดตามทุกวันในสัปดาห์แรก แล้วบันทึกในแฟ้มนักเรียน",
          refer: "แจ้งครูแนะแนวทันทีเมื่อมีสัญญาณอันตราย",
        },
        medium: { observe: "", talk: "", follow_up: "", refer: "" },
        normal: { observe: "", talk: "", follow_up: "", refer: "" },
        none: { observe: "", talk: "", follow_up: "", refer: "" },
      },
    };
  if (p === "/school/notification-settings/1")
    return {
      risk_alerts: { enabled: true, levels: ["high"], mental_admins: false },
    };
  if (p === "/school/physical-risk-rules")
    return {
      rules: [
        {
          id: 1,
          metric: "bmi",
          comparator: "gt",
          threshold_low: null,
          threshold_high: "25.00",
          age_min: 12,
          age_max: 15,
          sex: null,
          label: "BMI สูงกว่าเกณฑ์ของโรงเรียน",
          follow_up_days: 14,
          status: "active",
        },
        {
          id: 2,
          metric: "systolic",
          comparator: "gte",
          threshold_low: null,
          threshold_high: "130.00",
          age_min: null,
          age_max: null,
          sex: null,
          label: "ความดันตัวบนสูงกว่าเกณฑ์",
          follow_up_days: 7,
          status: "active",
        },
      ],
      metrics: {
        bmi: "ดัชนีมวลกาย (BMI)",
        systolic: "ความดันตัวบน (มม.ปรอท)",
        diastolic: "ความดันตัวล่าง (มม.ปรอท)",
        weight_kg: "น้ำหนัก (กก.)",
        height_cm: "ส่วนสูง (ซม.)",
        pulse: "ชีพจร (ครั้ง/นาที)",
      },
      comparators: {
        lt: "ต่ำกว่า",
        lte: "ไม่เกิน",
        gt: "สูงกว่า",
        gte: "ตั้งแต่",
        outside: "อยู่นอกช่วง",
      },
    };
  if (p === "/audit-logs/actors")
    return {
      actors: [
        { id: 2, name: "ครูแนะแนว ม.ต้น" },
        { id: 3, name: "ครูประจำชั้น 1/1" },
      ],
    };
  if (p === "/audit-logs")
    return listOf(
      [
        [
          "school_appointments.confirm",
          "student",
          STUDENT(7).student_code,
          [],
          "ครูแนะแนว ม.ต้น",
          0,
        ],
        [
          "student_behavior.update",
          "student",
          STUDENT(6).student_code,
          [],
          "ครูแนะแนว ม.ต้น",
          0,
        ],
        [
          "students.update",
          "student",
          STUDENT(1).student_code,
          ["phone", "address"],
          "ครูประจำชั้น 1/1",
          -1,
        ],
        [
          "student_health.update",
          "student_physical_record",
          null,
          [],
          "ครูอนามัยโรงเรียน",
          -1,
        ],
        [
          "school_documents.create",
          "school",
          null,
          [],
          "งานส่งเสริมสุขภาวะ",
          -2,
        ],
      ].map(
        ([action, target_type, student_code, fields, actor_name, d], n) => ({
          id: n + 1,
          created_at: at(d, `1${n}:05:00`),
          actor_name,
          action,
          target_type,
          target_id: student_code ? "1" : "1",
          student_code,
          fields,
          details: {},
        }),
      ),
      url,
    );
  return undefined;
}

// What a signed-in student sees on their account page.
export async function mockStudentAccount(page_) {
  await page_.route("**/api/patient/school-appointments**", (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/options"))
      return route.fulfill({
        json: {
          success: true,
          students: [
            {
              student_id: 1,
              school_name: SHOWCASE_SCHOOL.name,
              topics: [
                { id: 1, label: "การเรียน" },
                { id: 2, label: "อารมณ์และความรู้สึก" },
              ],
              staff: [
                {
                  id: 2,
                  name: "ครูแนะแนว ม.ต้น",
                  duty: "ครูแนะแนว",
                  slots: [
                    {
                      id: 3,
                      starts_at: at(3, "13:00"),
                      ends_at: at(3, "13:30"),
                    },
                  ],
                },
              ],
            },
          ],
        },
      });
    return route.fulfill({
      json: {
        success: true,
        eligible: true,
        appointments: [
          {
            id: 1,
            status: "confirmed",
            starts_at: at(1, "09:00"),
            ends_at: at(1, "09:30"),
            staff_name: "ครูแนะแนว ม.ต้น",
            topic_label: "อารมณ์และความรู้สึก",
            can_cancel: true,
          },
        ],
      },
    });
  });
  await page_.route("**/api/patient/school-documents", (route) =>
    route.fulfill({
      json: {
        success: true,
        eligible: true,
        documents: [
          {
            id: 4,
            title: "เคล็ดลับจัดการความเครียดก่อนสอบ",
            category_name: "ประชาสัมพันธ์",
            kind: "link",
            url: "https://example.org/stress-tips",
          },
          {
            id: 5,
            title: "ช่องทางขอความช่วยเหลือของโรงเรียน",
            category_name: "คู่มือ",
            kind: "file",
            file_name: "help-channels.pdf",
          },
        ],
      },
    }),
  );
  await page_.route("**/api/patient/history", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: {
          id: 1,
          username: "s65005",
          display_name: "ปภาวรินทร์ ใจดี",
          email: "student@example.com",
          email_verified: true,
          status: "active",
        },
        member_type: { type: "school_student", source: "school" },
        masterCases: [],
        responses: [],
      },
    }),
  );
  await page_.route("**/api/patient/me/assessment-tasks", (route) =>
    route.fulfill({
      json: {
        success: true,
        tasks: [
          {
            id: 1,
            form_id: 75,
            title: FORMS[0].title,
            due_on: day(3),
            overdue: false,
            available: true,
          },
        ],
      },
    }),
  );
  await page_.route("**/api/patient/me/school-health", (route) =>
    route.fulfill({
      json: {
        success: true,
        profile: {
          blood_type: "O",
          chronic_conditions: "-",
          allergies: "แพ้กุ้ง",
          medications: "-",
        },
        records: [
          {
            id: 2,
            measured_at: "2026-09-10",
            weight_kg: 46.5,
            height_cm: 156,
            bmi: 19.1,
            systolic: 108,
            diastolic: 70,
            pulse: 82,
            vision_left: "20/20",
            vision_right: "20/25",
            hearing_left: "normal",
            hearing_right: "normal",
            fitness: "ดี",
          },
          {
            id: 1,
            measured_at: "2026-05-20",
            weight_kg: 44.8,
            height_cm: 153,
            bmi: 19.1,
            systolic: 106,
            diastolic: 68,
            pulse: 84,
            vision_left: "20/20",
            vision_right: "20/20",
            hearing_left: "normal",
            hearing_right: "normal",
            fitness: "ดี",
          },
        ],
      },
    }),
  );
}

// The change-history page with sample rows, for any unit type.
export async function mockAuditLog(page_) {
  await page_.route("**/api/audit-logs**", (route) => {
    const url = new URL(route.request().url());
    const body = careShowcase(url.pathname.slice(4), url);
    return body === undefined
      ? route.fallback()
      : route.fulfill({ json: body });
  });
}
