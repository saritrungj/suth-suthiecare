// Service-recipient type: school student, university student, general public,
// or unknown. One rule decides it everywhere (member list, filters, the
// member's own page):
//   1. An active, unarchived row in the school roster -> school student.
//   2. A former roster row (graduated, transferred, inactive or archived)
//      stays a school student unless a case or declaration newer than the
//      roster change says otherwise (for example names a faculty).
//   3. Otherwise the latest status or faculty answer, or the member's own
//      declaration, whichever is newer.
//   4. Otherwise unknown. Unknown is never folded into general.
// Only the answer side is stored (patient_member_profiles). The roster side is
// read live, so imports, graduations and archiving need no extra hooks.
const { decrypt } = require("../utils/encryption");
const { decryptSummaryData } = require("../utils/decryptCaseData");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
const { writeField, readField } = require("../utils/privateField");

const MEMBER_TYPES = ["school_student", "university_student", "general"];
const MEMBER_TYPE_LABELS = {
  school_student: "นักเรียน",
  university_student: "นักศึกษา",
  general: "บุคคลทั่วไป",
  unknown: "ยังไม่ระบุ",
};
const FILTERABLE_TYPES = new Set([...MEMBER_TYPES, "unknown"]);
const safeDecrypt = (value) => decrypt(value) || value;

// A status or faculty answer -> { type, faculty } or null when it says nothing.
function classifyStatusText(value) {
  const text = String(value ?? "").trim();
  if (!text || /^[-–—.\s]*$/.test(text)) return null;
  if (/^(ไม่ระบุ|null|undefined)$/i.test(text)) return null;
  // "ไม่ใช่นักศึกษา มทส." and similar say the opposite of the word they contain.
  if (/ไม่(ใช่|ได้เป็น|ได้ศึกษา)/.test(text))
    return { type: "general", faculty: null };
  if (/สำนักวิชา|คณะ/.test(text))
    return {
      type: "university_student",
      faculty: text.replace(/^\(\d+\)\s*/, "").slice(0, 150),
    };
  if (/นักศึกษา|ชั้นปีที่|บัณฑิตศึกษา|ปริญญา/.test(text))
    return { type: "university_student", faculty: null };
  if (/นักเรียน/.test(text)) return { type: "school_student", faculty: null };
  return { type: "general", faculty: null };
}

const flattenQuestions = (questions) =>
  (Array.isArray(questions) ? questions : []).flatMap((q) =>
    q
      ? [
          q,
          ...flattenQuestions(
            q.subQuestions || q.questions || q.children || [],
          ),
        ]
      : [],
  );

function statusQuestionIds(questions) {
  let list = questions;
  try {
    list = typeof list === "string" ? JSON.parse(list) : list;
  } catch {
    list = [];
  }
  return flattenQuestions(list)
    .filter(
      (q) =>
        q.type === "user_status" ||
        q.isUserStatus === true ||
        q.type === "faculty",
    )
    .map((q) => String(q.id));
}

const answerText = (value) =>
  Array.isArray(value)
    ? value.join(" ")
    : value && typeof value === "object"
      ? Object.values(value).join(" ")
      : value;

// The newest status or faculty answer in the member's own cases.
async function latestStatusAnswer(conn, accountId) {
  const [responses] = await conn.query(
    `SELECT fr.id, fr.organization_id, fr.summary_data, fr.submitted_at, f.questions
       FROM form_responses fr LEFT JOIN forms f ON f.id = fr.form_id
      WHERE fr.patient_account_id = ?
         OR fr.person_id IN (SELECT id FROM persons WHERE patient_account_id = ?)
      ORDER BY fr.submitted_at DESC, fr.id DESC`,
    [accountId, accountId],
  );
  for (const response of responses) {
    const ids = statusQuestionIds(response.questions);
    if (ids.length) {
      const [answers] = await conn.query(
        "SELECT question_id, question_title, answer_value FROM form_answers WHERE response_id = ? AND question_id IN (?)",
        [response.id, ids],
      );
      // A form may ask the status ("นักศึกษา") and the faculty separately:
      // combine every status answer in this response, keeping the faculty.
      const found = answers
        .map((answer) =>
          classifyStatusText(
            answerText(
              normalizeStoredAnswer(
                answer.answer_value,
                answer.question_title,
                safeDecrypt,
                response.organization_id,
              ),
            ),
          ),
        )
        .filter(Boolean);
      if (found.length) {
        const withFaculty = found.find((item) => item.faculty);
        const university = found.find(
          (item) => item.type === "university_student",
        );
        return {
          ...(withFaculty || university || found[0]),
          at: response.submitted_at,
          responseId: response.id,
        };
      }
    }
    // Older cases kept the answer only as display_faculty in the summary.
    if (response.summary_data) {
      const summary =
        decryptSummaryData(
          response.summary_data,
          safeDecrypt,
          response.organization_id,
        ) || {};
      const found = classifyStatusText(summary.display_faculty);
      if (found)
        return { ...found, at: response.submitted_at, responseId: response.id };
    }
  }
  return null;
}

// Re-read the member's cases and store the newest status answer.
async function refreshMemberAnswer(conn, accountId) {
  if (!accountId) return null;
  const found = await latestStatusAnswer(conn, accountId);
  await conn.query(
    `INSERT INTO patient_member_profiles
       (patient_account_id, answer_type, answer_faculty_encrypted, answer_at, answer_response_id, refreshed_at)
     VALUES (?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE answer_type = VALUES(answer_type),
       answer_faculty_encrypted = VALUES(answer_faculty_encrypted),
       answer_at = VALUES(answer_at), answer_response_id = VALUES(answer_response_id),
       refreshed_at = NOW()`,
    [
      accountId,
      found?.type || null,
      found?.faculty
        ? writeField(found.faculty, "patient_member_profiles", "faculty")
        : null,
      found?.at || null,
      found?.responseId || null,
    ],
  );
  return found;
}

// After a case is saved: refresh without failing the save itself.
function refreshMemberAnswerQuietly(conn, accountId) {
  if (!accountId) return Promise.resolve();
  return refreshMemberAnswer(conn, accountId).catch((error) =>
    console.warn(
      "Member type refresh skipped:",
      require("../utils/safeError").safeError(error),
    ),
  );
}

// Walk-in cases are saved against a person. Refresh the account linked to it.
function refreshPersonAnswerQuietly(conn, personId) {
  if (!personId) return Promise.resolve();
  return conn
    .query("SELECT patient_account_id FROM persons WHERE id = ?", [personId])
    .then(([rows]) =>
      refreshMemberAnswerQuietly(conn, rows[0]?.patient_account_id),
    )
    .catch(() => {});
}

// The member's own choice on their page. It counts like a new answer: it wins
// over older answers, and over a former school roster row, but not over an
// active roster row.
async function declareMemberType(conn, accountId, type, faculty) {
  if (!MEMBER_TYPES.includes(type))
    throw Object.assign(new Error("INVALID_MEMBER_TYPE"), { status: 422 });
  const cleanFaculty =
    type === "university_student" && faculty
      ? String(faculty).trim().slice(0, 150)
      : null;
  await conn.query(
    `INSERT INTO patient_member_profiles
       (patient_account_id, declared_type, declared_faculty_encrypted, declared_at)
     VALUES (?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE declared_type = VALUES(declared_type),
       declared_faculty_encrypted = VALUES(declared_faculty_encrypted),
       declared_at = NOW()`,
    [
      accountId,
      type,
      cleanFaculty
        ? writeField(cleanFaculty, "patient_member_profiles", "faculty")
        : null,
    ],
  );
}

// SQL pieces that compute the type for patient_accounts rows aliased `alias`.
// The roster row is matched by account, or by a person linked to the account.
function memberTypeSql(alias = "patient_accounts") {
  const effDeclared =
    "(mp.declared_at IS NOT NULL AND (mp.answer_at IS NULL OR mp.declared_at >= mp.answer_at))";
  const effType = `CASE WHEN ${effDeclared} THEN mp.declared_type ELSE mp.answer_type END`;
  const effAt = `CASE WHEN ${effDeclared} THEN mp.declared_at ELSE mp.answer_at END`;
  const newerThanRoster = `(${effAt}) IS NOT NULL AND (${effAt}) > rs.left_at AND (${effType}) IS NOT NULL`;
  return {
    joins: `LEFT JOIN patient_member_profiles mp ON mp.patient_account_id = ${alias}.id
      LEFT JOIN (
        SELECT COALESCE(s.patient_account_id, p.patient_account_id) AS account_id,
               MAX(s.status = 'active' AND s.archived_at IS NULL) AS is_active,
               MAX(CASE WHEN s.status <> 'active' OR s.archived_at IS NOT NULL
                        THEN COALESCE(s.archived_at, s.graduated_on, s.updated_at) END) AS left_at
          FROM school_students s LEFT JOIN persons p ON p.id = s.person_id
         WHERE COALESCE(s.patient_account_id, p.patient_account_id) IS NOT NULL
         GROUP BY COALESCE(s.patient_account_id, p.patient_account_id)
      ) rs ON rs.account_id = ${alias}.id`,
    type: `(CASE
        WHEN rs.is_active = 1 THEN 'school_student'
        WHEN rs.account_id IS NOT NULL THEN
          CASE WHEN ${newerThanRoster} THEN (${effType}) ELSE 'school_student' END
        WHEN (${effType}) IS NOT NULL THEN (${effType})
        ELSE 'unknown' END)`,
    source: `(CASE
        WHEN rs.is_active = 1 THEN 'school_roster'
        WHEN rs.account_id IS NOT NULL THEN
          CASE WHEN ${newerThanRoster}
               THEN (CASE WHEN ${effDeclared} THEN 'declared' ELSE 'case_answer' END)
               ELSE 'former_student' END
        WHEN mp.declared_type IS NOT NULL AND ${effDeclared} THEN 'declared'
        WHEN mp.answer_type IS NOT NULL THEN 'case_answer'
        ELSE 'none' END)`,
    faculty: `(CASE WHEN ${effDeclared} THEN mp.declared_faculty_encrypted ELSE mp.answer_faculty_encrypted END)`,
  };
}

const readFaculty = (value) =>
  value ? readField(value, "patient_member_profiles", "faculty") : null;

// Type, source and faculty for the given accounts, keyed by account id.
async function memberTypesFor(conn, accountIds) {
  const ids = [...new Set(accountIds.map(Number).filter(Boolean))];
  if (!ids.length) return new Map();
  const sql = memberTypeSql("pa");
  const [rows] = await conn.query(
    `SELECT pa.id, ${sql.type} AS member_type, ${sql.source} AS member_type_source,
            ${sql.faculty} AS faculty_encrypted
       FROM patient_accounts pa ${sql.joins} WHERE pa.id IN (?)`,
    [ids],
  );
  return new Map(
    rows.map((row) => [
      row.id,
      {
        type: row.member_type,
        label: MEMBER_TYPE_LABELS[row.member_type],
        source: row.member_type_source,
        faculty:
          row.member_type === "university_student"
            ? readFaculty(row.faculty_encrypted)
            : null,
      },
    ]),
  );
}

// The member's own school record (current first) for their page.
async function memberSchoolRecord(conn, accountId) {
  const [rows] = await conn.query(
    `SELECT sc.name AS school_name, gl.name AS grade_name, c.name AS classroom_name,
            c.academic_year, s.student_code, s.status, s.archived_at, s.graduated_on
       FROM school_students s
       JOIN schools sc ON sc.id = s.school_id
       LEFT JOIN school_classrooms c ON c.id = s.classroom_id
       LEFT JOIN school_grade_levels gl ON gl.id = c.grade_level_id
       LEFT JOIN persons p ON p.id = s.person_id
      WHERE s.patient_account_id = ? OR p.patient_account_id = ?
      ORDER BY (s.status = 'active' AND s.archived_at IS NULL) DESC, s.updated_at DESC
      LIMIT 1`,
    [accountId, accountId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    school_name: row.school_name,
    grade_name: row.grade_name,
    classroom_name: row.classroom_name,
    academic_year: row.academic_year,
    student_code: row.student_code,
    status: row.archived_at ? "archived" : row.status,
    graduated_on: row.graduated_on,
  };
}

module.exports = {
  MEMBER_TYPES,
  MEMBER_TYPE_LABELS,
  FILTERABLE_TYPES,
  classifyStatusText,
  statusQuestionIds,
  latestStatusAnswer,
  refreshMemberAnswer,
  refreshMemberAnswerQuietly,
  refreshPersonAnswerQuietly,
  declareMemberType,
  memberTypeSql,
  memberTypesFor,
  memberSchoolRecord,
};
