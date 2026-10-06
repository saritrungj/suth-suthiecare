// Seeds a complete demo school into one school sub-unit of a LOCAL database:
// teacher/student types, grades and rooms, teachers (staff accounts),
// students (imported with accounts), health profiles, physical exams,
// health-domain assessment forms and student submissions (cases) spread over
// the first term of academic year 2569.
//
// Everything goes through a running API so the data is stored exactly like
// real data (encryption, person files, master cases). Run that API with
// Telegram and e-mail switched off, for example:
//   PORT=5077 TELEGRAM_BOT_TOKEN= TELEGRAM_CHAT_ID= RESEND_API_KEY= \
//   STAFF_EMAIL_OTP_MODE=enroll node index.js
// then:
//   node scripts/seedSchoolDemo.mjs --api http://127.0.0.1:5077 --org 2
//   node scripts/seedSchoolDemo.mjs --remove          (deletes what was seeded)
//
// The ids of everything created go to backup/school-demo-manifest.json and
// the demo sign-ins to backup/school-demo-accounts.csv (backup/ is ignored
// by git). Submission times are moved back into the term afterwards.
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildScoreResults } from "../../app/src/pages/assessment/formView/formUtils.js";

const require = createRequire(import.meta.url);
require("../config/env");
const mysql = require("mysql2/promise");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const here = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.resolve(here, "../../backup");
const MANIFEST = path.join(BACKUP_DIR, "school-demo-manifest.json");
const ACCOUNTS = path.join(BACKUP_DIR, "school-demo-accounts.csv");

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};

// ── Safety: local development databases only ──────────────────────────────
const dbHost = process.env.DB_HOST || "";
if (
  process.env.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost", "::1"].includes(dbHost)
) {
  console.error(
    `Refusing to run: DB_HOST=${dbHost || "(empty)"} is not a local database.`,
  );
  process.exit(1);
}

const pool = mysql.createPool({
  host: dbHost,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 4,
});

if (flag("--remove")) {
  await removeDemo();
  await pool.end();
  process.exit(0);
}

const API = option("--api", "http://127.0.0.1:5077").replace(/\/$/, "");
const ORG = Number(option("--org", "2"));
const ADMIN_ID = Number(option("--admin", "1"));
const YEAR = 2569;

if (fs.existsSync(MANIFEST)) {
  console.error(
    "A demo is already seeded (backup/school-demo-manifest.json). Run --remove first.",
  );
  process.exit(1);
}

// ── Deterministic randomness so a re-seed gives the same school ───────────
let seed = 2569;
const random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const between = (min, max) => min + random() * (max - min);
const int = (min, max) => Math.floor(between(min, max + 1));
const strongPassword = () =>
  `Demo-${randomBytes(6).toString("base64url")}#${int(10, 99)}a`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── API helpers (throttled under the 300 requests/minute API limit) ──────
const [[admin]] = await pool.query(
  "SELECT id, username, role_id, auth_version FROM users WHERE id = ?",
  [ADMIN_ID],
);
if (!admin) throw new Error(`No staff user ${ADMIN_ID}`);
const staffToken = jwt.sign(
  {
    id: admin.id,
    username: admin.username,
    role_id: admin.role_id,
    account_type: "staff",
    email_otp: true,
    auth_version: admin.auth_version ?? 0,
  },
  process.env.JWT_SECRET,
  { expiresIn: "2h" },
);

async function call(method, url, body, { token = staffToken, org = ORG } = {}) {
  await sleep(230);
  const response = await fetch(`${API}/api${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(org ? { "X-Organization-Id": String(org) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!response.ok)
    throw new Error(
      `${method} ${url} → ${response.status} ${JSON.stringify(data).slice(0, 300)}`,
    );
  return data;
}

const manifest = {
  organization_id: ORG,
  created_at: new Date().toISOString(),
  teacher_type_ids: [],
  student_type_ids: [],
  grade_ids: [],
  classroom_ids: [],
  staff_user_ids: [],
  teacher_ids: [],
  student_ids: [],
  patient_account_ids: [],
  form_ids: [],
  response_ids: [],
};
const saveManifest = () => {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
};
const accounts = [["type", "name", "username", "password", "note"]];

// ── Reference data ────────────────────────────────────────────────────────
const BOY_NAMES = [
  "ภูมิ",
  "ธนกร",
  "ณัฐวุฒิ",
  "กิตติพัฒน์",
  "ปกรณ์",
  "ศุภกร",
  "ธีรภัทร",
  "พีรพล",
  "วรเมธ",
  "อชิระ",
  "ภาคิน",
  "ชยพล",
  "รัชพล",
  "จิรายุ",
  "ปุณณวิช",
];
const GIRL_NAMES = [
  "ณัฐธิดา",
  "พิมพ์ชนก",
  "กมลชนก",
  "ปวีณ์ธิดา",
  "ชนัญชิดา",
  "อรปรียา",
  "สุพิชญา",
  "ธัญชนก",
  "ภัทรวดี",
  "กัญญาณัฐ",
  "ณิชาภัทร",
  "ปภาวรินท์",
  "วรัญญา",
  "ศิรประภา",
  "ลลิตา",
];
const SURNAMES = [
  "ศรีสุข",
  "ใจงาม",
  "บุญมา",
  "แสงทอง",
  "สุขเจริญ",
  "วงศ์ไทย",
  "ทองดี",
  "พรหมมา",
  "ชัยมงคล",
  "ศักดิ์ดี",
  "มณีวงศ์",
  "รุ่งเรือง",
  "เพชรรัตน์",
  "สมบูรณ์ชัย",
  "อินทร์แก้ว",
  "จันทร์หอม",
  "บัวแก้ว",
  "นาคสุข",
];
const BOY_NICKS = [
  "ภูมิ",
  "ต้น",
  "บอส",
  "เจ",
  "ไอซ์",
  "ปั้น",
  "ฟลุ๊ค",
  "กัปตัน",
  "ไผ่",
  "โอ๊ต",
];
const GIRL_NICKS = [
  "มิว",
  "แพรว",
  "ใบเตย",
  "ฝ้าย",
  "น้ำฝน",
  "ปราง",
  "มายด์",
  "เฟิร์น",
  "ข้าวหอม",
  "ใบบัว",
];
const PARENT_NAMES = [
  "สมชาย",
  "สมหญิง",
  "วิไล",
  "ประเสริฐ",
  "อำไพ",
  "สุรชัย",
  "มาลี",
  "บุญเรือง",
];

const TEACHER_TYPES = [
  ["ครูประจำชั้น", "ดูแลนักเรียนในห้องประจำชั้น"],
  ["ครูแนะแนว", "ให้คำปรึกษาและติดตามสุขภาพจิตนักเรียน"],
  ["ครูอนามัยโรงเรียน", "ดูแลการตรวจสุขภาพและห้องพยาบาล"],
  ["ครูประจำวิชา", "สอนรายวิชา"],
];
const STUDENT_TYPES = [
  ["นักเรียนปกติ", "นักเรียนทั่วไป"],
  ["นักเรียนทุน", "ได้รับทุนการศึกษา"],
  ["นักเรียนที่ต้องดูแลพิเศษ", "ต้องติดตามสุขภาพหรือการเรียนอย่างใกล้ชิด"],
];
const TEACHERS = [
  ["ครูสมศรี วงศ์สวัสดิ์", "ครูประจำชั้น", "ครู คศ.2", 1],
  ["ครูประเสริฐ ทองคำ", "ครูประจำชั้น", "ครู คศ.3", 2],
  ["ครูวิภาวรรณ แก้วมณี", "ครูประจำชั้น", "ครู คศ.1", 3],
  ["ครูธนพล ศรีวิชัย", "ครูประจำชั้น", "ครู คศ.2", 4],
  ["ครูอรุณี พึ่งบุญ", "ครูประจำชั้น", "ครู คศ.3", 5],
  ["ครูกิตติศักดิ์ มั่นคง", "ครูประจำชั้น", "ครูชำนาญการ", 6],
  ["ครูพรทิพย์ ใจเย็น", "ครูแนะแนว", "ครูแนะแนว คศ.2", null],
  ["ครูนันทนา รักษ์ดี", "ครูอนามัยโรงเรียน", "ครูพยาบาล", null],
];

// ── Assessment forms (same JSON the form builder writes) ─────────────────
const GRID = {
  cols: [],
  rows: [],
  type: "grid_multiple",
  isScored: true,
  required: true,
  options: [],
  optionScores: [],
  optionImages: [],
  isIdentity: false,
  hasDescription: true,
  image: null,
};
const FORMS = [
  {
    key: "st5",
    health_domain: "mental",
    title: "แบบประเมินความเครียดนักเรียน (ST-5)",
    description:
      "สำรวจความเครียดในช่วง 2-4 สัปดาห์ที่ผ่านมา ใช้เวลาประมาณ 2 นาที",
    questions: [
      {
        ...GRID,
        id: "st5_grid",
        title: "แบบประเมินความเครียด (ST-5)",
        text: "ในช่วง 2-4 สัปดาห์ที่ผ่านมา นักเรียนมีอาการเหล่านี้บ่อยแค่ไหน",
        cols: ["แทบไม่มี", "เป็นบางครั้ง", "บ่อยครั้ง", "เป็นประจำ"],
        colScores: [0, 1, 2, 3],
        rows: [
          "1. มีปัญหาการนอน นอนไม่หลับหรือนอนมาก",
          "2. มีสมาธิน้อยลง",
          "3. หงุดหงิด กระวนกระวาย ว้าวุ่นใจ",
          "4. รู้สึกเบื่อ เซ็ง",
          "5. ไม่อยากพบปะผู้คน",
        ],
        scoringRules: [
          {
            min: 0,
            max: 4,
            color: "#4caf50",
            label: "เครียดน้อย",
            advice: "ดูแลตัวเองแบบนี้ต่อไป",
          },
          {
            min: 5,
            max: 7,
            color: "#fbbc04",
            label: "เครียดปานกลาง",
            advice: "หากิจกรรมผ่อนคลายและพูดคุยกับคนที่ไว้ใจ",
          },
          {
            min: 8,
            max: 9,
            color: "#ff9800",
            label: "เครียดมาก",
            advice: "แนะนำให้พูดคุยกับครูแนะแนว",
          },
          {
            min: 10,
            max: 15,
            color: "#d93025",
            label: "เครียดมากที่สุด (รุนแรง)",
            advice: "ครูแนะแนวจะติดต่อกลับโดยเร็ว",
          },
        ],
      },
    ],
  },
  {
    key: "phq",
    health_domain: "mental",
    title: "แบบคัดกรองภาวะซึมเศร้าในวัยรุ่น (9Q)",
    description: "คัดกรองภาวะซึมเศร้าในช่วง 2 สัปดาห์ที่ผ่านมา",
    questions: [
      {
        ...GRID,
        id: "phq_grid",
        title: "แบบประเมินโรคซึมเศร้า (9Q)",
        text: "ในช่วง 2 สัปดาห์ที่ผ่านมา รวมทั้งวันนี้ นักเรียนมีอาการเหล่านี้บ่อยแค่ไหน",
        cols: [
          "ไม่มีเลย",
          "เป็นบางวัน (1-7 วัน)",
          "เป็นบ่อย (>7 วัน)",
          "เป็นทุกวัน",
        ],
        colScores: [0, 1, 2, 3],
        rows: [
          "1. เบื่อ ไม่สนใจอยากทำอะไร",
          "2. ไม่สบายใจ ซึมเศร้า ท้อแท้",
          "3. หลับยาก หรือหลับ ๆ ตื่น ๆ หรือหลับมากไป",
          "4. เหนื่อยง่าย หรือไม่ค่อยมีแรง",
          "5. เบื่ออาหาร หรือกินมากเกินไป",
          "6. รู้สึกไม่ดีกับตัวเอง คิดว่าตัวเองล้มเหลว",
          "7. สมาธิไม่ดีเวลาทำอะไร",
          "8. พูดช้า ทำอะไรช้าลง หรือกระสับกระส่าย",
          "9. คิดทำร้ายตนเอง หรือคิดว่าถ้าตายไปคงจะดี",
        ],
        scoringRules: [
          {
            min: 0,
            max: 6,
            color: "#4caf50",
            label: "ปกติ / ไม่มีอาการซึมเศร้า",
            advice: "รักษาสุขภาพจิตให้แจ่มใสต่อไป",
          },
          {
            min: 7,
            max: 12,
            color: "#fbbc04",
            label: "มีอาการซึมเศร้าระดับน้อย",
            advice: "พักผ่อนให้เพียงพอและปรึกษาคนใกล้ชิด",
          },
          {
            min: 13,
            max: 18,
            color: "#ff9800",
            label: "มีอาการซึมเศร้าระดับปานกลาง",
            advice: "ครูแนะแนวจะนัดพูดคุยเพิ่มเติม",
          },
          {
            min: 19,
            max: 27,
            color: "#d93025",
            label: "มีอาการซึมเศร้าระดับรุนแรง",
            advice: "ส่งต่อพบผู้เชี่ยวชาญโดยเร็ว",
          },
        ],
      },
    ],
  },
  {
    key: "body",
    health_domain: "physical",
    title: "แบบคัดกรองสุขภาพกายนักเรียน",
    description: "สำรวจอาการและพฤติกรรมสุขภาพในช่วง 1 เดือนที่ผ่านมา",
    questions: [
      {
        id: "body_symptoms",
        type: "checkboxes",
        title: "ในช่วง 1 เดือนที่ผ่านมา นักเรียนมีอาการต่อไปนี้หรือไม่",
        options: [
          "ปวดศีรษะบ่อย",
          "ปวดท้องบ่อย",
          "เหนื่อยง่าย หายใจไม่อิ่ม",
          "นอนน้อยกว่า 7 ชั่วโมงต่อคืน",
          "ไม่ได้กินอาหารเช้า",
          "มองกระดานไม่ชัด",
          "ไม่มีอาการเหล่านี้",
        ],
        optionScores: [1, 1, 2, 1, 1, 1, 0],
        optionImages: [null, null, null, null, null, null, null],
        isScored: true,
        required: true,
        isIdentity: false,
        hasDescription: false,
        image: null,
        scoringRules: [
          {
            min: 0,
            max: 1,
            color: "#4caf50",
            label: "สุขภาพกายปกติ",
            advice: "ดูแลสุขภาพแบบนี้ต่อไป",
          },
          {
            min: 2,
            max: 3,
            color: "#fbbc04",
            label: "ควรเฝ้าระวัง",
            advice: "ปรับการนอนและการกินให้เหมาะสม",
          },
          {
            min: 4,
            max: 10,
            color: "#f44336",
            label: "มีความเสี่ยงสูง ควรพบครูอนามัย",
            advice: "ครูอนามัยจะนัดตรวจเพิ่มเติม",
          },
        ],
      },
      {
        id: "body_exercise",
        type: "multiple_choice",
        title: "ออกกำลังกายอย่างน้อย 30 นาที กี่วันต่อสัปดาห์",
        options: ["ไม่ได้ออกกำลังกาย", "1-2 วัน", "3-4 วัน", "5 วันขึ้นไป"],
        optionImages: [null, null, null, null],
        required: true,
        isIdentity: false,
        hasDescription: false,
        image: null,
      },
    ],
  },
];

// Answers that land on a target score, spread over the grid rows.
function gridAnswers(question, target) {
  const rows = question.rows.length;
  const scores = Array(rows).fill(0);
  let left = Math.min(target, rows * 3);
  while (left > 0) {
    const row = int(0, rows - 1);
    if (scores[row] < 3) {
      scores[row] += 1;
      left -= 1;
    }
  }
  return Object.fromEntries(
    scores.map((score, row) => [row, question.cols[score]]),
  );
}

function bodyAnswers(question, target) {
  const chosen = new Set();
  const pool = [0, 1, 2, 3, 4, 5];
  let score = 0;
  while (score < target && chosen.size < pool.length) {
    const index = pick(pool);
    if (chosen.has(index)) continue;
    if (score + question.optionScores[index] > target + 1) continue;
    chosen.add(index);
    score += question.optionScores[index];
  }
  return chosen.size
    ? [...chosen].sort().map((index) => question.options[index])
    : [question.options[6]];
}

// Mirrors FormView: score_results from the shared scorer, raw_answers keyed
// by question title, grid answers keyed by row title.
function submissionPayload(form, answers) {
  const titles = {};
  const raw = {};
  for (const question of form.questions) {
    titles[question.id] = question.title;
    const value = answers[question.id];
    if (value === undefined) continue;
    if (question.type === "grid_multiple") {
      raw[question.title] = Object.fromEntries(
        Object.entries(value).map(([row, col]) => [question.rows[row], col]),
      );
    } else
      raw[question.title] = Array.isArray(value) ? value.join(", ") : value;
  }
  return {
    answers,
    questionTitles: titles,
    summaryData: {
      display_name: "-",
      display_phone: "-",
      display_faculty: "-",
      main_issue: "-",
      score_results: buildScoreResults(form.questions, answers),
      raw_answers: raw,
      consent_given: false,
    },
    consent_given: false,
  };
}

// Score targets per risk level (ST-5 / 9Q / physical checklist).
const TARGET = {
  st5: { normal: [0, 4], medium: [5, 9], high: [10, 14] },
  phq: { normal: [0, 6], medium: [7, 15], high: [19, 24] },
  body: { normal: [0, 1], medium: [2, 3], high: [4, 6] },
};
const scoreFor = (key, level) => int(...TARGET[key][level]);
const dateIn = (yyyyMmDd, spreadDays) => {
  const date = new Date(`${yyyyMmDd}T09:00:00+07:00`);
  date.setDate(date.getDate() + int(0, spreadDays));
  date.setHours(int(8, 15), int(0, 59));
  return date;
};
const sqlDate = (date) => date.toISOString().slice(0, 19).replace("T", " ");

// ── Seeding ───────────────────────────────────────────────────────────────
try {
  const [orgRows] = await pool.query(
    "SELECT id, name, org_type, org_level FROM organizations WHERE id = ?",
    [ORG],
  );
  if (orgRows[0]?.org_type !== "school" || orgRows[0]?.org_level !== "unit")
    throw new Error(`Organization ${ORG} is not a school sub-unit`);
  const [school] = await call("GET", "/school/schools");
  console.log(`School: ${school.name} (${school.code})`);
  saveManifest();

  // Types
  const teacherTypes = {};
  for (const [index, [name, description]] of TEACHER_TYPES.entries()) {
    const { id } = await call("POST", "/school/teacher-types", {
      name,
      description,
      sort_order: index + 1,
    });
    teacherTypes[name] = id;
    manifest.teacher_type_ids.push(id);
  }
  for (const [index, [name, description]] of STUDENT_TYPES.entries()) {
    const { id } = await call("POST", "/school/student-types", {
      name,
      description,
      sort_order: index + 1,
    });
    manifest.student_type_ids.push(id);
  }
  saveManifest();
  console.log("Types created");

  // Grades ม.1-ม.6 with rooms 1 and 2. Grades and rooms that already exist
  // are reused and left out of the manifest, so --remove never deletes
  // structure someone made by hand.
  const rooms = []; // { id, grade, room }
  const existingGrades = await call(
    "GET",
    `/school/schools/${school.id}/grades`,
  );
  const existingRooms = await call(
    "GET",
    `/school/schools/${school.id}/classrooms?academic_year=${YEAR}`,
  );
  for (let grade = 1; grade <= 6; grade += 1) {
    let gradeId = existingGrades.find((row) => row.name === `ม.${grade}`)?.id;
    if (!gradeId) {
      ({ id: gradeId } = await call(
        "POST",
        `/school/schools/${school.id}/grades`,
        { name: `ม.${grade}`, level_order: grade },
      ));
      manifest.grade_ids.push(gradeId);
    }
    for (let room = 1; room <= 2; room += 1) {
      const existing = existingRooms.find(
        (row) =>
          Number(row.grade_level_id) === Number(gradeId) &&
          row.name === String(room),
      );
      if (existing) {
        rooms.push({ id: existing.id, grade, room: existing.name });
        continue;
      }
      const created = await call(
        "POST",
        `/school/schools/${school.id}/classrooms`,
        {
          grade_level_id: gradeId,
          name: String(room),
          academic_year: YEAR,
          capacity: 35,
        },
      );
      manifest.classroom_ids.push(created.id);
      rooms.push({ id: created.id, grade, room: created.name });
    }
  }
  saveManifest();
  console.log(`Grades and ${rooms.length} rooms created`);

  // Teachers: staff accounts → members of the sub-unit → teachers
  const teachers = [];
  for (const [
    index,
    [name, typeName, position, homeroomGrade],
  ] of TEACHERS.entries()) {
    const username = `demo.teacher${String(index + 1).padStart(2, "0")}`;
    const password = strongPassword();
    const { id: userId } = await call(
      "POST",
      "/users",
      {
        username,
        password,
        name,
        email: `${username}@school-demo.test`,
        role_id: 3,
        status: "active",
      },
      { org: null },
    );
    manifest.staff_user_ids.push(userId);
    accounts.push([
      "teacher",
      name,
      username,
      password,
      "staff login needs e-mail OTP",
    ]);
    teachers.push({
      userId,
      name,
      typeName,
      position,
      homeroomGrade,
      code: `T${String(index + 1).padStart(3, "0")}`,
    });
  }
  saveManifest();
  await call(
    "POST",
    `/organizations/${ORG}/members`,
    { user_ids: manifest.staff_user_ids, role_id: 3 },
    { org: null },
  );
  for (const teacher of teachers) {
    await call("POST", "/school/teachers", {
      school_id: school.id,
      user_ids: [teacher.userId],
      teacher_type_id: teacherTypes[teacher.typeName],
      employee_code: teacher.code,
      position: teacher.position,
    });
  }
  const teacherRows = await call("GET", "/school/teachers");
  for (const teacher of teachers) {
    teacher.id = teacherRows.find(
      (row) => Number(row.user_id) === Number(teacher.userId),
    ).id;
    manifest.teacher_ids.push(teacher.id);
  }
  saveManifest();
  const counselor = teachers.find(
    (teacher) => teacher.typeName === "ครูแนะแนว",
  );
  for (const room of rooms) {
    const homeroom = teachers.find(
      (teacher) => teacher.homeroomGrade === room.grade,
    );
    await call("PUT", `/school/classrooms/${room.id}/teachers`, {
      teachers: [
        { teacher_id: homeroom.id, role: "homeroom" },
        { teacher_id: counselor.id, role: "counselor" },
      ],
    });
  }
  console.log(`${teachers.length} teachers created and assigned`);

  // Students: 5 per room, imported with accounts like a school would
  const rows = [];
  for (const room of rooms) {
    for (let seat = 1; seat <= 5; seat += 1) {
      const female = (seat + room.room) % 2 === 0;
      const junior = room.grade <= 3;
      const entry = YEAR - room.grade + 1; // ม.1 of 2569 entered in 2569
      const sequence = String((Number(room.room) - 1) * 5 + seat).padStart(
        3,
        "0",
      );
      const birthYear = YEAR - 12 - room.grade;
      rows.push({
        student_code: `${String(entry).slice(-2)}${sequence}`,
        prefix: female ? (junior ? "ด.ญ." : "นางสาว") : junior ? "ด.ช." : "นาย",
        first_name: pick(female ? GIRL_NAMES : BOY_NAMES),
        last_name: pick(SURNAMES),
        nickname: pick(female ? GIRL_NICKS : BOY_NICKS),
        grade: `ม.${room.grade}`,
        classroom: room.room,
        student_type:
          random() < 0.75
            ? STUDENT_TYPES[0][0]
            : random() < 0.6
              ? STUDENT_TYPES[1][0]
              : STUDENT_TYPES[2][0],
        gender: female ? "หญิง" : "ชาย",
        birth_date: `${String(int(1, 28)).padStart(2, "0")}/${String(int(1, 12)).padStart(2, "0")}/${birthYear}`,
      });
    }
  }
  const imported = await call("POST", "/school/students/import", {
    school_id: school.id,
    rows,
    dry_run: false,
    on_duplicate: "skip",
    create_missing: false,
    academic_year: YEAR,
    row_offset: 0,
  });
  const failed = imported.results.filter((result) => result.status === "error");
  if (failed.length)
    throw new Error(`Import errors: ${JSON.stringify(failed.slice(0, 3))}`);
  const tempPasswords = new Map(
    imported.results.map((result) => [result.student_code, result]),
  );
  const [students] = await pool.query(
    `SELECT s.id, s.student_code, s.patient_account_id, s.gender, c.name AS room, g.level_order AS grade
       FROM school_students s
       JOIN school_classrooms c ON c.id = s.classroom_id
       JOIN school_grade_levels g ON g.id = c.grade_level_id
      WHERE s.school_id = ? AND s.student_code IN (?)
      ORDER BY s.student_code`,
    [school.id, rows.map((row) => row.student_code)],
  );
  manifest.student_ids = students.map((student) => student.id);
  manifest.patient_account_ids = students
    .map((student) => student.patient_account_id)
    .filter(Boolean);
  saveManifest();
  console.log(`${students.length} students imported with accounts`);

  // Health profiles
  for (const student of students) {
    const special = random();
    await call("PUT", `/school/students/${student.id}/health-profile`, {
      blood_type: pick(["A", "B", "O", "O", "AB", "B"]),
      chronic_conditions:
        special < 0.12
          ? "หอบหืด"
          : special < 0.18
            ? "ภูมิแพ้อากาศ"
            : special < 0.21
              ? "โรคลมชัก (ทานยาต่อเนื่อง)"
              : "",
      allergies:
        random() < 0.15
          ? pick(["แพ้กุ้ง", "แพ้ยาเพนิซิลลิน", "แพ้ถั่วลิสง", "แพ้นมวัว"])
          : "",
      medications:
        special < 0.12
          ? "ยาพ่นขยายหลอดลมเมื่อมีอาการ"
          : special >= 0.18 && special < 0.21
            ? "ยากันชักวันละ 2 ครั้ง"
            : "",
      emergency_contact_name: `${pick(PARENT_NAMES)} (ผู้ปกครอง)`,
      emergency_contact_phone: `08${int(10000000, 99999999)}`,
      notes:
        special >= 0.18 && special < 0.21
          ? "แจ้งครูประจำชั้นทุกครั้งที่ไม่สบาย"
          : "",
    });
  }
  console.log("Health profiles saved");

  // Physical exams at the start and the middle of term 1/2569
  for (const student of students) {
    const female = student.gender === "female";
    let height =
      (female ? 149 : 151) +
      student.grade * (female ? 2.2 : 4) +
      between(-7, 7);
    const build = random(); // under / normal / over weight
    const bmiTarget =
      build < 0.1
        ? between(15, 16.5)
        : build > 0.85
          ? between(25, 30)
          : between(17.5, 22.5);
    let weight = bmiTarget * (height / 100) ** 2;
    const vision =
      random() < 0.2
        ? pick(["20/40", "20/50", "20/70"])
        : pick(["20/20", "20/20", "20/25", "20/30"]);
    const hearing = random() < 0.04 ? "abnormal" : "normal";
    for (const [date, note] of [
      ["2026-06-08", "ตรวจสุขภาพต้นภาคเรียน"],
      ["2026-09-07", "ตรวจสุขภาพกลางภาคเรียน"],
    ]) {
      await call("POST", `/school/students/${student.id}/physical-records`, {
        measured_at: date,
        weight_kg: Number(weight.toFixed(1)),
        height_cm: Number(height.toFixed(1)),
        systolic: int(98, 122),
        diastolic: int(60, 80),
        pulse: int(68, 96),
        vision_left: vision,
        vision_right:
          random() < 0.7 ? vision : pick(["20/20", "20/30", "20/40"]),
        hearing_left: hearing,
        hearing_right: "normal",
        note:
          vision === "20/70" ? `${note} · แนะนำให้ผู้ปกครองพาไปวัดสายตา` : note,
      });
      height += between(0.8, 2);
      weight += between(-0.5, 1.6);
    }
  }
  console.log("Physical exams recorded");

  // Assessment forms of this sub-unit, tagged by health domain
  const forms = {};
  for (const form of FORMS) {
    const { id } = await call("POST", "/save-form", {
      title: form.title,
      description: form.description,
      formStepName: "ส่วนที่ 1",
      theme: {},
      questions: form.questions,
      status: "published",
      clinic_type: "general",
      form_type: "Registration",
      login_enforcement: "strict",
      result_display_mode: "on_submit",
      health_domain: form.health_domain,
    });
    forms[form.key] = { ...form, id };
    manifest.form_ids.push(id);
  }
  saveManifest();
  console.log("Assessment forms created");

  // Students who signed in and changed their temporary password. The rest
  // (about one in eight) have not signed in yet and keep their temporary one.
  const demoPassword = strongPassword();
  const demoHash = await bcrypt.hash(demoPassword, 10);
  const plans = students.map((student, index) => {
    const roll = random();
    const level = roll < 0.6 ? "normal" : roll < 0.8 ? "medium" : "high";
    const trend =
      level === "high"
        ? pick(["worse", "better", "steady"])
        : level === "medium"
          ? pick(["worse", "steady", "better"])
          : "steady";
    return { student, level, trend, active: index % 8 !== 3 };
  });
  for (const plan of plans) {
    const temp = tempPasswords.get(plan.student.student_code);
    if (!plan.active) {
      accounts.push([
        "student",
        plan.student.student_code,
        temp?.username || "",
        temp?.password || "",
        "not signed in yet: must change password",
      ]);
      continue;
    }
    await pool.query(
      "UPDATE patient_accounts SET password_hash = ?, must_change_password = 0, last_login_at = ?, token_version = token_version + 1 WHERE id = ?",
      [
        demoHash,
        sqlDate(dateIn("2026-06-01", 20)),
        plan.student.patient_account_id,
      ],
    );
    accounts.push([
      "student",
      plan.student.student_code,
      temp?.username || "",
      demoPassword,
      "signed in",
    ]);
  }

  // Submissions through the public submit endpoint, as the student
  const levelAt = (plan, step, steps) => {
    if (plan.trend === "steady" || steps === 1) return plan.level;
    const order = ["normal", "medium", "high"];
    const target = order.indexOf(plan.level);
    const from =
      plan.trend === "worse"
        ? Math.max(0, target - 1)
        : Math.min(2, target + 1);
    return step === steps - 1 ? plan.level : order[from];
  };
  let submitted = 0;
  for (const plan of plans.filter((item) => item.active)) {
    const [[account]] = await pool.query(
      "SELECT id, token_version FROM patient_accounts WHERE id = ?",
      [plan.student.patient_account_id],
    );
    const token = jwt.sign(
      {
        sub: account.id,
        account_type: "patient",
        token_version: account.token_version,
      },
      process.env.PATIENT_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: "2h" },
    );
    const schedule = [
      ["st5", "2026-06-15", 10],
      ["body", "2026-06-22", 10],
      ...(random() < 0.8 ? [["phq", "2026-07-06", 12]] : []),
      ["st5", "2026-08-10", 10],
      ...(plan.level !== "normal" || random() < 0.35
        ? [["st5", "2026-09-21", 7]]
        : []),
      ...(plan.level !== "normal" ? [["phq", "2026-09-24", 5]] : []),
      ...(random() < 0.5 ? [["body", "2026-09-14", 7]] : []),
    ];
    const perForm = {};
    schedule.forEach(([key]) => (perForm[key] = (perForm[key] || 0) + 1));
    const seen = {};
    for (const [key, start, spread] of schedule) {
      const form = forms[key];
      const step = (seen[key] = (seen[key] ?? -1) + 1);
      const level =
        key === "body"
          ? plan.level === "high" && random() < 0.5
            ? "high"
            : random() < 0.25
              ? "medium"
              : "normal"
          : levelAt(plan, step, perForm[key]);
      const score = scoreFor(key, level);
      const answers =
        key === "body"
          ? {
              body_symptoms: bodyAnswers(form.questions[0], score),
              body_exercise: pick(form.questions[1].options),
            }
          : { [form.questions[0].id]: gridAnswers(form.questions[0], score) };
      const result = await call(
        "POST",
        `/forms/${form.id}/submit`,
        submissionPayload(form, answers),
        { token, org: null },
      );
      const when = sqlDate(dateIn(start, spread));
      await pool.query(
        "UPDATE form_responses SET submitted_at = ? WHERE id = ?",
        [when, result.responseId],
      );
      manifest.response_ids.push(result.responseId);
      submitted += 1;
    }
  }
  // Each master case opened with the student's first submission.
  await pool.query(
    `UPDATE mastercases m
        JOIN (SELECT master_case_id, MIN(submitted_at) AS first_at, MAX(submitted_at) AS last_at
                FROM form_responses WHERE id IN (?) GROUP BY master_case_id) r ON r.master_case_id = m.id
        SET m.createdAt = r.first_at, m.updatedAt = r.last_at`,
    [manifest.response_ids],
  );
  saveManifest();
  console.log(`${submitted} assessment submissions (cases) created`);

  // One student moved away during the term
  const leaving = students[students.length - 2];
  await call("DELETE", `/school/students/${leaving.id}`);

  fs.writeFileSync(
    ACCOUNTS,
    "﻿" +
      accounts
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
        )
        .join("\n"),
  );
  console.log("Done. Manifest and demo sign-ins are in backup/.");
} catch (error) {
  saveManifest();
  console.error(error.message);
  console.error("Partially seeded. Run with --remove to clean up.");
  process.exitCode = 1;
} finally {
  await pool.end();
}

// ── Removal ───────────────────────────────────────────────────────────────
async function removeDemo() {
  if (!fs.existsSync(MANIFEST)) {
    console.log("Nothing to remove (no backup/school-demo-manifest.json).");
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const ids = (list) => (list?.length ? list : [0]);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [persons] = await connection.query(
      "SELECT id FROM persons WHERE patient_account_id IN (?)",
      [ids(m.patient_account_ids)],
    );
    const personIds = ids(persons.map((row) => row.id));
    const [responses] = await connection.query(
      "SELECT id, master_case_id FROM form_responses WHERE form_id IN (?) OR person_id IN (?) OR patient_account_id IN (?)",
      [ids(m.form_ids), personIds, ids(m.patient_account_ids)],
    );
    const responseIds = ids(responses.map((row) => row.id));
    const caseIds = ids([
      ...new Set(responses.map((row) => row.master_case_id).filter(Boolean)),
    ]);
    const steps = [
      ["DELETE FROM form_answers WHERE response_id IN (?)", [responseIds]],
      ["DELETE FROM form_responses WHERE id IN (?)", [responseIds]],
      [
        "DELETE FROM case_logs WHERE master_case_id IN (?) OR response_id IN (?)",
        [caseIds, responseIds],
      ],
      [
        "DELETE FROM mastercases WHERE id IN (?) OR person_id IN (?) OR patient_account_id IN (?)",
        [caseIds, personIds, ids(m.patient_account_ids)],
      ],
      ["DELETE FROM forms WHERE id IN (?)", [ids(m.form_ids)]],
      [
        "DELETE FROM school_student_physical_records WHERE student_id IN (?)",
        [ids(m.student_ids)],
      ],
      [
        "DELETE FROM school_student_health_profiles WHERE student_id IN (?)",
        [ids(m.student_ids)],
      ],
      ["DELETE FROM school_students WHERE id IN (?)", [ids(m.student_ids)]],
      ["DELETE FROM persons WHERE id IN (?)", [personIds]],
      [
        "DELETE FROM patient_auth_audit_logs WHERE patient_account_id IN (?)",
        [ids(m.patient_account_ids)],
      ],
      [
        "DELETE FROM patient_accounts WHERE id IN (?)",
        [ids(m.patient_account_ids)],
      ],
      [
        "DELETE FROM school_classroom_teachers WHERE classroom_id IN (?) OR teacher_id IN (?)",
        [ids(m.classroom_ids), ids(m.teacher_ids)],
      ],
      ["DELETE FROM school_teachers WHERE id IN (?)", [ids(m.teacher_ids)]],
      ["DELETE FROM school_classrooms WHERE id IN (?)", [ids(m.classroom_ids)]],
      ["DELETE FROM school_grade_levels WHERE id IN (?)", [ids(m.grade_ids)]],
      [
        "DELETE FROM school_teacher_types WHERE id IN (?)",
        [ids(m.teacher_type_ids)],
      ],
      [
        "DELETE FROM school_student_types WHERE id IN (?)",
        [ids(m.student_type_ids)],
      ],
      [
        "DELETE FROM organization_memberships WHERE user_id IN (?)",
        [ids(m.staff_user_ids)],
      ],
      ["DELETE FROM users WHERE id IN (?)", [ids(m.staff_user_ids)]],
    ];
    for (const [sql, params] of steps) {
      try {
        const [result] = await connection.query(sql, params);
        console.log(`${result.affectedRows}\t${sql.slice(0, 70)}`);
      } catch (error) {
        // Optional tables that this database does not have.
        if (
          error.code === "ER_NO_SUCH_TABLE" ||
          error.code === "ER_BAD_FIELD_ERROR"
        )
          continue;
        throw error;
      }
    }
    await connection.commit();
    fs.renameSync(MANIFEST, `${MANIFEST}.removed-${Date.now()}`);
    if (fs.existsSync(ACCOUNTS)) fs.unlinkSync(ACCOUNTS);
    console.log("Demo school data removed.");
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
