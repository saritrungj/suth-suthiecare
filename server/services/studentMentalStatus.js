// Mental-health status of a student over time: which semester and class each
// assessment or care step belongs to, and the status as of a given period.
//
// Statuses shown to staff:
// - automatic, from the latest mental assessment in the period:
//   assessed / not_assessed, and screening (medium or high risk) /
//   no_screening (normal);
// - recorded by teachers as a history: counselor_referral, following,
//   hospital_referral, and closed (which ends the care step).
const { currentAcademicYear } = require("../utils/academicYear");

const CARE_STATUSES = [
  "counselor_referral",
  "following",
  "hospital_referral",
  "closed",
];
const MENTAL_STATUSES = [
  "assessed",
  "not_assessed",
  "screening",
  "no_screening",
  "counselor_referral",
  "following",
  "hospital_referral",
];
const TERM_COLUMNS = [
  "term1_starts_on",
  "term1_ends_on",
  "term2_starts_on",
  "term2_ends_on",
];

const pad = (n) => String(n).padStart(2, "0");
// A YYYY-MM-DD key in Bangkok time for a Date, DATE or DATETIME value.
function dateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "numeric",
        day: "numeric",
      })
        .formatToParts(value)
        .map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
const todayKey = () => dateKey(new Date());

// Thai academic year (B.E.) a date falls in when the school set no dates:
// a new year starts in mid-May, so January to April belong to the year before.
function academicYearOf(key) {
  const [y, m] = String(key).split("-").map(Number);
  return currentAcademicYear(new Date(Date.UTC(y, m - 1, 15, 5)));
}

// terms: Map academic_year -> row with term1/term2 start and end dates.
// Returns { academic_year, semester } where semester is 1, 2 or null (the
// school set no dates for that year, or the date falls between semesters).
function termOf(key, terms) {
  if (!key) return { academic_year: null, semester: null };
  const fallback = academicYearOf(key);
  for (const year of [fallback, fallback - 1, fallback + 1]) {
    const row = terms?.get(year);
    if (!row) continue;
    for (const semester of [1, 2]) {
      const start = dateKey(row[`term${semester}_starts_on`]);
      const end = dateKey(row[`term${semester}_ends_on`]);
      if (start && end && key >= start && key <= end)
        return { academic_year: year, semester };
    }
  }
  return { academic_year: fallback, semester: null };
}

function termLabel({ academic_year: year, semester }) {
  if (!year) return "";
  return semester
    ? `ภาคเรียนที่ ${semester}/${year}`
    : `ปีการศึกษา ${year} (นอกภาคเรียน)`;
}

// Class a student was in at a moment, from the class-change history
// (oldest first). Before the first change the student was in its "from"
// class; with no history the current class is the only one known.
function classroomAt(at, history = [], currentClassroomId = null) {
  const key = at instanceof Date ? at.getTime() : new Date(at).getTime();
  let found;
  for (const row of history) {
    const changed = new Date(row.changed_at).getTime();
    if (changed <= key) found = { id: row.to_classroom_id };
    else {
      if (!found) found = { id: row.from_classroom_id };
      break;
    }
  }
  return found ? found.id : currentClassroomId;
}

// The care step in force on a day: the latest recorded step on or before it,
// unless that step closed the care.
function careStateAt(events = [], untilKey) {
  let state = null;
  for (const event of events) {
    const on = dateKey(event.effective_on);
    if (untilKey && on > untilKey) continue;
    if (
      !state ||
      on > dateKey(state.effective_on) ||
      (on === dateKey(state.effective_on) && event.id > state.id)
    )
      state = event;
  }
  return state && state.status !== "closed" ? state : null;
}

// The one status a list shows: a recorded care step wins, then whether the
// latest result needs screening, else that nothing was assessed.
function primaryStatus({ risk, care }) {
  if (care) return care.status;
  if (!risk) return "not_assessed";
  return risk === "normal" ? "no_screening" : "screening";
}

function matchesStatus(summary, wanted) {
  if (!wanted) return true;
  if (!summary) return false;
  if (wanted === "assessed") return Boolean(summary.risk);
  if (wanted === "not_assessed") return !summary.risk;
  if (wanted === "screening")
    return Boolean(summary.risk) && summary.risk !== "normal";
  if (wanted === "no_screening") return summary.risk === "normal";
  return summary.care_status === wanted;
}

// --- Database helpers ------------------------------------------------------
async function loadTerms(db, schoolIds) {
  const ids = [...new Set(schoolIds.map(Number).filter(Boolean))];
  const map = new Map(ids.map((id) => [id, new Map()]));
  if (!ids.length) return map;
  const [rows] = await db.query(
    `SELECT school_id,academic_year,${TERM_COLUMNS.join(",")} FROM school_academic_years WHERE school_id IN (?)`,
    [ids],
  );
  for (const row of rows)
    map.get(Number(row.school_id))?.set(Number(row.academic_year), row);
  return map;
}

async function loadEnrollmentHistory(db, studentIds) {
  const map = new Map();
  if (!studentIds.length) return map;
  const [rows] = await db.query(
    "SELECT student_id,from_classroom_id,to_classroom_id,changed_at FROM school_enrollment_history WHERE student_id IN (?) ORDER BY changed_at,id",
    [studentIds],
  );
  for (const row of rows) {
    if (!map.has(row.student_id)) map.set(row.student_id, []);
    map.get(row.student_id).push(row);
  }
  return map;
}

async function loadClassrooms(db, ids) {
  const unique = [...new Set(ids.filter(Boolean).map(Number))];
  if (!unique.length) return new Map();
  const [rows] = await db.query(
    "SELECT c.id,c.name,c.academic_year,g.name AS grade_name FROM school_classrooms c LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id WHERE c.id IN (?)",
    [unique],
  );
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function loadCareEvents(db, studentIds) {
  const map = new Map();
  if (!studentIds.length) return map;
  const [rows] = await db.query(
    "SELECT id,student_id,status,effective_on,academic_year,semester,classroom_id,payload_encrypted,created_by,created_at FROM school_student_care_statuses WHERE student_id IN (?) ORDER BY effective_on,id",
    [studentIds],
  );
  for (const row of rows) {
    if (!map.has(row.student_id)) map.set(row.student_id, []);
    map.get(row.student_id).push(row);
  }
  return map;
}

// Status of each student over a period: the latest mental assessment
// submitted between `from` (optional) and `to`, the semester and class it
// was taken in, and the care step in force on `to`. Students must already
// be filtered to those whose mental status the caller may see.
async function mentalSummaries(db, organizationId, students, { from, to }) {
  const { responseRisk } = require("../utils/schoolWorkflows");
  const result = new Map();
  if (!students.length) return result;
  const ids = students.map((s) => Number(s.id));
  const [responses] = await db.query(
    `SELECT x.student_id,x.id,x.organization_id,x.summary_data,x.submitted_at,x.form_title FROM (
       SELECT ss.id AS student_id,fr.id,fr.organization_id,fr.summary_data,fr.submitted_at,f.title AS form_title,
              ROW_NUMBER() OVER (PARTITION BY ss.id ORDER BY fr.submitted_at DESC,fr.id DESC) AS rn
         FROM school_students ss
         JOIN form_responses fr ON fr.person_id=ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id=ss.patient_account_id)
         JOIN forms f ON f.id=fr.form_id
        WHERE ss.id IN (?) AND fr.organization_id=? AND f.health_domain='mental'
          ${from ? "AND DATE(fr.submitted_at)>=?" : ""} AND DATE(fr.submitted_at)<=?
     ) x WHERE x.rn=1`,
    [ids, organizationId, ...(from ? [from] : []), to],
  );
  const latest = new Map(responses.map((r) => [Number(r.student_id), r]));
  const [terms, history, care] = await Promise.all([
    loadTerms(
      db,
      students.map((s) => s.school_id),
    ),
    loadEnrollmentHistory(db, [...latest.keys()]),
    loadCareEvents(db, ids),
  ]);
  const roomIds = new Map();
  for (const [id, response] of latest) {
    const student = students.find((s) => Number(s.id) === id);
    roomIds.set(
      id,
      classroomAt(
        response.submitted_at,
        history.get(id),
        student?.classroom_id,
      ),
    );
  }
  const rooms = await loadClassrooms(db, [...roomIds.values()]);
  for (const student of students) {
    const id = Number(student.id);
    const response = latest.get(id);
    const state = careStateAt(care.get(id), to);
    const risk = response ? responseRisk(response) : null;
    const assessedOn = response ? dateKey(response.submitted_at) : null;
    const term = assessedOn
      ? termOf(assessedOn, terms.get(Number(student.school_id)))
      : null;
    const room = rooms.get(Number(roomIds.get(id)));
    result.set(id, {
      status: primaryStatus({ risk, care: state }),
      risk,
      assessed_on: assessedOn,
      form_title: response?.form_title || null,
      academic_year: term?.academic_year || null,
      semester: term?.semester || null,
      term_label: term ? termLabel(term) : null,
      classroom_label: room
        ? `${room.grade_name || ""} ห้อง ${room.name}`.trim()
        : null,
      care_status: state?.status || null,
      care_since: state ? dateKey(state.effective_on) : null,
    });
  }
  return result;
}

// Validates the two semesters of one academic year. All four dates empty
// clears them; otherwise each semester needs both dates, in order, and the
// second semester starts after the first ends.
function validateTerms(body = {}, academicYear) {
  const value = {};
  for (const column of TERM_COLUMNS) {
    const raw = body[column];
    if (raw === "" || raw == null) value[column] = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return { error: true };
    else value[column] = String(raw);
  }
  if (TERM_COLUMNS.every((c) => !value[c])) return { value };
  for (const semester of [1, 2]) {
    const start = value[`term${semester}_starts_on`];
    const end = value[`term${semester}_ends_on`];
    if (!start || !end || start > end) return { error: true };
  }
  if (value.term1_ends_on >= value.term2_starts_on) return { error: true };
  // Both semesters stay inside the Gregorian years the B.E. year spans.
  const first = Number(academicYear) - 543;
  if (
    value.term1_starts_on < `${first}-01-01` ||
    value.term2_ends_on > `${first + 1}-12-31`
  )
    return { error: true };
  return { value };
}

module.exports = {
  CARE_STATUSES,
  MENTAL_STATUSES,
  TERM_COLUMNS,
  dateKey,
  todayKey,
  academicYearOf,
  termOf,
  termLabel,
  classroomAt,
  careStateAt,
  primaryStatus,
  matchesStatus,
  loadTerms,
  loadEnrollmentHistory,
  loadClassrooms,
  loadCareEvents,
  mentalSummaries,
  validateTerms,
};
