const express = require("express");
const db = require("../config/db");
const { requiredAudit } = require("../utils/pdpaAudit");
const {
  canManageWorkflowsAt,
  canSeeStudent,
  canViewStudentHealth,
  canViewPhysicalHealth,
  canHealthAction,
  studentScopeClause,
} = require("../utils/schoolAccess");
const {
  validDate,
  dateWindow,
  positiveId,
  questionById,
  responseRisk,
} = require("../utils/schoolWorkflows");
const { readField } = require("../utils/privateField");
const {
  roundTargetClause,
  roundTargetParams,
} = require("../services/schoolRescreen");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const json = (value) => (typeof value === "string" ? JSON.parse(value) : value);
const date = (value) =>
  value instanceof Date ? value.toLocaleDateString("sv-SE") : value;
const authorizedDomain = (access, student, domain) =>
  domain === "physical"
    ? canViewPhysicalHealth(access, student)
    : canViewStudentHealth(access, student);

router.use((req, res, next) =>
  req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);
// action: the roles-page action on screening workflows this request needs.
async function school(req, res, id, action = null) {
  const [[row]] = await db.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [positiveId(id), req.organizationContext],
  );
  if (
    !row ||
    (action && !canManageWorkflowsAt(req.schoolAccess, row.id, action))
  ) {
    fail(res, 403, "ไม่มีสิทธิ์จัดการโรงเรียนนี้");
    return null;
  }
  return row;
}
// assign: moving a student between classrooms (students -> assign on the roles page).
async function student(req, res, id, assign = false) {
  const [[row]] = await db.query(
    "SELECT ss.* FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE ss.id=? AND s.organization_id=? AND ss.archived_at IS NULL",
    [positiveId(id), req.organizationContext],
  );
  if (
    !row ||
    !canSeeStudent(req.schoolAccess, row) ||
    (assign &&
      !(req.schoolAccess.isSystemAdmin || req.schoolAccess.canAssignStudents))
  ) {
    fail(res, 404, "ไม่พบนักเรียนในขอบเขตสิทธิ์");
    return null;
  }
  return row;
}
async function transaction(req, action, target, id, run) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await run(connection);
    await requiredAudit(req, action, target, id, {}, connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
const rescreenTasks = require("../services/rescreenTasks");
const rescreenAssignees = (connection, req, ss, userId = null) =>
  rescreenTasks.rescreenAssignees(
    connection,
    req.organizationContext,
    ss,
    userId,
  );
async function form(req, id, domain) {
  const [[row]] = await db.query(
    "SELECT id,health_domain,questions FROM forms WHERE id=? AND organization_id=?",
    [positiveId(id), req.organizationContext],
  );
  return row && (!domain || row.health_domain === domain) ? row : null;
}

router.get("/risk-summary", async (req, res) => {
  if (!req.schoolAccess.canViewRisk)
    return fail(res, 403, "ไม่มีสิทธิ์ดูภาพรวมความเสี่ยง");
  dateWindow(req.query);
  const scope = studentScopeClause(req.schoolAccess, "ss");
  const [students] = await db.query(
    `SELECT ss.id,ss.school_id,ss.student_code,ss.prefix,ss.first_name_encrypted,ss.last_name_encrypted,ss.is_boarder,ss.classroom_id,c.name AS classroom_name,g.name AS grade_name FROM school_students ss JOIN schools s ON s.id=ss.school_id LEFT JOIN school_classrooms c ON c.id=ss.classroom_id LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id WHERE s.organization_id=? AND ss.archived_at IS NULL AND ss.status='active'${scope.sql}${positiveId(req.query.school_id) ? " AND ss.school_id=?" : ""}${req.query.is_boarder === "1" ? " AND ss.is_boarder=1" : ""}`,
    [
      req.organizationContext,
      ...scope.params,
      ...(positiveId(req.query.school_id) ? [Number(req.query.school_id)] : []),
    ],
  );
  const riskStudents = students.filter(
    (s) =>
      !req.schoolAccess.physicalSchoolIds?.includes(Number(s.school_id)) ||
      canViewStudentHealth(req.schoolAccess, s),
  );
  const ids = riskStudents.map((s) => s.id);
  let responses = [];
  if (ids.length)
    [responses] = await db.query(
      `SELECT ss.id AS student_id,fr.id,fr.organization_id,fr.summary_data,fr.submitted_at FROM school_students ss JOIN form_responses fr ON fr.person_id=ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id=ss.patient_account_id) JOIN forms f ON f.id=fr.form_id WHERE ss.id IN (?) AND fr.organization_id=? AND f.health_domain='mental'${req.query.start_date ? " AND DATE(fr.submitted_at)>=?" : ""}${req.query.end_date ? " AND DATE(fr.submitted_at)<=?" : ""} ORDER BY fr.submitted_at DESC,fr.id DESC`,
      [
        ids,
        req.organizationContext,
        ...(req.query.start_date ? [req.query.start_date] : []),
        ...(req.query.end_date ? [req.query.end_date] : []),
      ],
    );
  const latest = new Map();
  for (const row of responses)
    if (!latest.has(row.student_id)) latest.set(row.student_id, row);
  const [settings] = await db.query(
    "SELECT school_id,care_advice_json,care_guidance_json FROM school_workflow_settings WHERE school_id IN (?)",
    [students.length ? [...new Set(students.map((s) => s.school_id))] : [0]],
  );
  const advice = new Map(
    settings.map((s) => [s.school_id, json(s.care_advice_json) || {}]),
  );
  const guidance = new Map(
    settings.map((s) => [s.school_id, json(s.care_guidance_json) || {}]),
  );
  res.set("Cache-Control", "no-store");
  // Keep the queue limited to student identity, enrollment context and the
  // latest risk summary. Response IDs, answers, scores and history stay out.
  res.json({
    data: riskStudents.map((s) => {
      const latestResponse = latest.get(s.id),
        risk = latestResponse ? responseRisk(latestResponse) : "none";
      const firstName = readField(
        s.first_name_encrypted,
        "school_students",
        "first_name_encrypted",
        req.organizationContext,
      );
      const lastName = readField(
        s.last_name_encrypted,
        "school_students",
        "last_name_encrypted",
        req.organizationContext,
      );
      return {
        id: s.id,
        student_code: s.student_code,
        student_name:
          [s.prefix, firstName, lastName].filter(Boolean).join(" ") ||
          "ไม่ระบุชื่อ",
        grade_name: s.grade_name,
        classroom_name: s.classroom_name,
        is_boarder: Boolean(s.is_boarder),
        risk_status: risk,
        assessed_on: latestResponse?.submitted_at || null,
        care_advice:
          advice.get(s.school_id)?.[risk] || "ยังไม่มีคำแนะนำที่โรงเรียนกำหนด",
        care_guidance: filledSteps(guidance.get(s.school_id)?.[risk]),
      };
    }),
  });
});

router.put("/students/:id/enrollment", async (req, res) => {
  const row = await student(req, res, req.params.id, true);
  if (!row) return;
  const b = req.body || {};
  if (
    typeof b.is_boarder !== "boolean" ||
    (b.graduated_on &&
      (!validDate(b.graduated_on) ||
        b.graduated_on >
          new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })))
  )
    return fail(res, 422, "สถานะหอพักหรือวันจบการศึกษาไม่ถูกต้อง");
  if (b.graduated_on && row.status !== "graduated")
    return fail(res, 422, "วันจบการศึกษาใช้กับนักเรียนที่มีสถานะจบการศึกษา");
  await transaction(req, "school.enrollment.update", "student", row.id, (c) =>
    c.query(
      "UPDATE school_students SET is_boarder=?,graduated_on=? WHERE id=?",
      [b.is_boarder ? 1 : 0, b.graduated_on || null, row.id],
    ),
  );
  res.json({ success: true });
});
router.get("/students/:id/enrollment-history", async (req, res) => {
  const row = await student(req, res, req.params.id);
  if (!row) return;
  const [history] = await db.query(
    "SELECT h.id,h.changed_at,h.changed_by,old.name AS from_classroom,new.name AS to_classroom,new.academic_year FROM school_enrollment_history h LEFT JOIN school_classrooms old ON old.id=h.from_classroom_id LEFT JOIN school_classrooms new ON new.id=h.to_classroom_id WHERE h.student_id=? ORDER BY h.changed_at DESC,h.id DESC",
    [row.id],
  );
  res.json(history);
});
router.post("/promotions", async (req, res) => {
  const { school_id, mappings, dry_run = true } = req.body || {};
  if (!(await school(req, res, school_id, "assign"))) return;
  if (
    typeof dry_run !== "boolean" ||
    !Array.isArray(mappings) ||
    !mappings.length ||
    mappings.length > 100 ||
    new Set(mappings.map((m) => Number(m.from_classroom_id))).size !==
      mappings.length
  )
    return fail(res, 422, "กรุณาระบุห้องต้นทางและปลายทางไม่ซ้ำกัน");
  const result = await transaction(
    req,
    "school.promotion",
    "school",
    school_id,
    async (c) => {
      const output = [];
      // Validate the entire mapping before the first write, then snapshot all
      // source enrollments so chained mappings cannot promote a student twice.
      for (const m of mappings) {
        const [rooms] = await c.query(
          "SELECT id,academic_year FROM school_classrooms WHERE school_id=? AND id IN (?)",
          [
            school_id,
            [positiveId(m.from_classroom_id), positiveId(m.to_classroom_id)],
          ],
        );
        const from = rooms.find((r) => r.id === Number(m.from_classroom_id)),
          to = rooms.find((r) => r.id === Number(m.to_classroom_id));
        if (
          !from ||
          !to ||
          Number(to.academic_year) !== Number(from.academic_year) + 1
        )
          throw Object.assign(
            new Error("ห้องปลายทางต้องอยู่โรงเรียนเดียวกันและปีการศึกษาถัดไป"),
            { status: 422 },
          );
        const [rows] = await c.query(
          "SELECT id FROM school_students WHERE classroom_id=? AND school_id=? AND status='active' AND archived_at IS NULL FOR UPDATE",
          [from.id, school_id],
        );
        output.push({
          from_classroom_id: from.id,
          to_classroom_id: to.id,
          count: rows.length,
          ids: rows.map((r) => r.id),
        });
      }
      if (!dry_run)
        for (const m of output)
          for (const id of m.ids) {
            await c.query(
              "INSERT INTO school_enrollment_history (student_id,from_classroom_id,to_classroom_id,changed_by) VALUES (?,?,?,?)",
              [id, m.from_classroom_id, m.to_classroom_id, req.user.id],
            );
            await c.query(
              "UPDATE school_students SET classroom_id=? WHERE id=?",
              [m.to_classroom_id, id],
            );
          }
      return output.map(({ ids, ...m }) => m);
    },
  );
  res.json({ dry_run, data: result });
});

router.get("/screening-rounds", async (req, res) => {
  const [rows] = await db.query(
    "SELECT r.*,f.title AS form_title FROM school_screening_rounds r JOIN schools s ON s.id=r.school_id JOIN forms f ON f.id=r.form_id WHERE s.organization_id=? ORDER BY r.starts_on DESC,r.id DESC",
    [req.organizationContext],
  );
  const ids = rows.map((r) => r.id);
  const grades = await roundGrades(db, ids);
  const classrooms = await roundClassrooms(db, ids);
  res.json(
    rows
      .filter(
        (r) =>
          canManageWorkflowsAt(req.schoolAccess, r.school_id, "view") ||
          authorizedDomain(
            req.schoolAccess,
            { school_id: r.school_id },
            r.health_domain,
          ) ||
          req.schoolAccess.teacherSchoolIds.includes(Number(r.school_id)),
      )
      .map((r) => ({
        ...r,
        starts_on: date(r.starts_on),
        ends_on: date(r.ends_on),
        // Both empty: the round covers the whole school.
        grades: grades.get(r.id) || [],
        classrooms: classrooms.get(r.id) || [],
      })),
  );
});
// Grade levels a round is limited to, by round id.
async function roundGrades(connection, roundIds) {
  const map = new Map();
  if (!roundIds.length) return map;
  const [rows] = await connection.query(
    "SELECT rg.round_id,g.id,g.name FROM school_screening_round_grades rg JOIN school_grade_levels g ON g.id=rg.grade_level_id WHERE rg.round_id IN (?) ORDER BY g.level_order,g.name",
    [roundIds],
  );
  for (const row of rows) {
    if (!map.has(row.round_id)) map.set(row.round_id, []);
    map.get(row.round_id).push({ id: row.id, name: row.name });
  }
  return map;
}
// Classrooms a round is limited to, by round id.
async function roundClassrooms(connection, roundIds) {
  const map = new Map();
  if (!roundIds.length) return map;
  const [rows] = await connection.query(
    "SELECT rc.round_id,c.id,c.name,c.grade_level_id,g.name AS grade_name FROM school_screening_round_classrooms rc JOIN school_classrooms c ON c.id=rc.classroom_id JOIN school_grade_levels g ON g.id=c.grade_level_id WHERE rc.round_id IN (?) ORDER BY g.level_order,g.name,c.name",
    [roundIds],
  );
  for (const row of rows) {
    if (!map.has(row.round_id)) map.set(row.round_id, []);
    map.get(row.round_id).push({
      id: row.id,
      name: row.name,
      grade_level_id: row.grade_level_id,
      grade_name: row.grade_name,
    });
  }
  return map;
}
// Distinct positive ids of an optional list, or null when it is malformed.
function idList(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return null;
  const ids = value.map(positiveId);
  return ids.every(Boolean) ? [...new Set(ids)] : null;
}
// Checks one round body for a school the caller may create rounds in.
// Returns { error } or the values to insert.
async function roundInput(req, b, schoolId) {
  if (
    Number(b.school_id) !== Number(schoolId) ||
    !["mental", "physical"].includes(b.health_domain) ||
    !validDate(b.starts_on) ||
    !validDate(b.ends_on) ||
    b.starts_on > b.ends_on ||
    ![1, 2].includes(Number(b.semester)) ||
    !Number.isInteger(Number(b.academic_year)) ||
    Number(b.academic_year) < 2400 ||
    Number(b.academic_year) > 2700 ||
    typeof b.name !== "string" ||
    !b.name.trim() ||
    b.name.length > 180
  )
    return { error: "ข้อมูลรอบประเมินไม่ถูกต้อง" };
  if (!(await form(req, b.form_id, b.health_domain)))
    return { error: "แบบประเมินต้องอยู่ในหน่วยงานและด้านสุขภาพเดียวกัน" };
  // Optional grade levels and classrooms of this school. Neither means the
  // whole school (see roundTargetClause).
  const gradeIds = idList(b.grade_level_ids);
  if (!gradeIds) return { error: "ระดับชั้นไม่ถูกต้อง" };
  const classroomIds = idList(b.classroom_ids);
  if (!classroomIds) return { error: "ห้องเรียนไม่ถูกต้อง" };
  if (gradeIds.length) {
    const [found] = await db.query(
      "SELECT id FROM school_grade_levels WHERE school_id=? AND id IN (?)",
      [schoolId, gradeIds],
    );
    if (found.length !== gradeIds.length)
      return { error: "ระดับชั้นต้องเป็นของโรงเรียนนี้" };
  }
  if (classroomIds.length) {
    const [found] = await db.query(
      "SELECT id FROM school_classrooms WHERE school_id=? AND id IN (?)",
      [schoolId, classroomIds],
    );
    if (found.length !== classroomIds.length)
      return { error: "ห้องเรียนต้องเป็นของโรงเรียนนี้" };
  }
  return {
    values: [
      schoolId,
      b.name.trim(),
      b.academic_year,
      b.semester,
      b.health_domain,
      b.form_id,
      b.starts_on,
      b.ends_on,
      req.user.id,
    ],
    gradeIds,
    classroomIds,
  };
}
async function insertRound(c, round) {
  const [insert] = await c.query(
    "INSERT INTO school_screening_rounds (school_id,name,academic_year,semester,health_domain,form_id,starts_on,ends_on,created_by) VALUES (?,?,?,?,?,?,?,?,?)",
    round.values,
  );
  if (round.gradeIds.length)
    await c.query(
      "INSERT INTO school_screening_round_grades (round_id,grade_level_id) VALUES ?",
      [round.gradeIds.map((g) => [insert.insertId, g])],
    );
  if (round.classroomIds.length)
    await c.query(
      "INSERT INTO school_screening_round_classrooms (round_id,classroom_id) VALUES ?",
      [round.classroomIds.map((id) => [insert.insertId, id])],
    );
  return insert.insertId;
}
router.post("/screening-rounds", async (req, res) => {
  const b = req.body || {};
  if (!(await school(req, res, b.school_id, "create"))) return;
  const round = await roundInput(req, b, positiveId(b.school_id));
  if (round.error) return fail(res, 422, round.error);
  const id = await transaction(
    req,
    "school.round.create",
    "school",
    b.school_id,
    (c) => insertRound(c, round),
  );
  res.status(201).json({ id });
});
// Several rounds of one school at once, e.g. one per classroom on the
// homeroom timetable, so the classes do not all answer at the same time.
// Every round is checked before any is written.
router.post("/screening-rounds/batch", async (req, res) => {
  const b = req.body || {};
  if (!(await school(req, res, b.school_id, "create"))) return;
  const schoolId = positiveId(b.school_id);
  if (!Array.isArray(b.rounds) || !b.rounds.length || b.rounds.length > 200)
    return fail(res, 422, "ต้องมีรอบประเมิน 1–200 รอบ");
  const rounds = [];
  for (const [index, body] of b.rounds.entries()) {
    const round = await roundInput(req, body || {}, schoolId);
    if (round.error)
      return fail(res, 422, `รอบที่ ${index + 1}: ${round.error}`);
    rounds.push(round);
  }
  const ids = await transaction(
    req,
    "school.round.create",
    "school",
    schoolId,
    async (c) => {
      const created = [];
      for (const round of rounds) created.push(await insertRound(c, round));
      return created;
    },
  );
  res.status(201).json({ ids });
});
router.put("/screening-rounds/:id", async (req, res) => {
  const [[round]] = await db.query(
    "SELECT r.* FROM school_screening_rounds r JOIN schools s ON s.id=r.school_id WHERE r.id=? AND s.organization_id=?",
    [req.params.id, req.organizationContext],
  );
  if (
    !round ||
    !canManageWorkflowsAt(req.schoolAccess, round.school_id, "update")
  )
    return fail(res, 403, "ไม่มีสิทธิ์จัดการรอบนี้");
  if (!["active", "closed"].includes(req.body?.status))
    return fail(res, 422, "สถานะรอบไม่ถูกต้อง");
  await transaction(req, "school.round.status", "round", round.id, (c) =>
    c.query("UPDATE school_screening_rounds SET status=? WHERE id=?", [
      req.body.status,
      round.id,
    ]),
  );
  res.json({ success: true });
});
router.get("/screening-rounds/:id/progress", async (req, res) => {
  const [[round]] = await db.query(
    "SELECT r.* FROM school_screening_rounds r JOIN schools s ON s.id=r.school_id WHERE r.id=? AND s.organization_id=?",
    [req.params.id, req.organizationContext],
  );
  if (!round) return fail(res, 404, "ไม่พบรอบประเมิน");
  if (!req.schoolAccess.canViewStudents)
    return fail(res, 403, "ไม่มีสิทธิ์ดูนักเรียน");
  if (
    !canManageWorkflowsAt(req.schoolAccess, round.school_id, "view") &&
    !authorizedDomain(
      req.schoolAccess,
      { school_id: round.school_id },
      round.health_domain,
    ) &&
    !req.schoolAccess.teacherSchoolIds.includes(Number(round.school_id))
  )
    return fail(res, 403, "ไม่มีสิทธิ์ดูรอบนี้");
  const scope = studentScopeClause(req.schoolAccess, "ss");
  const [rows] = await db.query(
    `SELECT ss.id,ss.student_code,ss.prefix,ss.first_name_encrypted,ss.last_name_encrypted,g.name AS grade_name,c.name AS classroom_name,MAX(fr.submitted_at) AS completed_on FROM school_students ss LEFT JOIN school_classrooms c ON c.id=ss.classroom_id LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id LEFT JOIN form_responses fr ON (fr.person_id=ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id=ss.patient_account_id)) AND fr.organization_id=? AND fr.form_id=? AND DATE(fr.submitted_at) BETWEEN ? AND ? WHERE ss.school_id=? AND ss.status='active' AND ss.archived_at IS NULL AND ${roundTargetClause("?")}${scope.sql} GROUP BY ss.id,ss.student_code,ss.prefix,ss.first_name_encrypted,ss.last_name_encrypted,g.name,c.name ORDER BY ss.student_code`,
    [
      req.organizationContext,
      round.form_id,
      date(round.starts_on),
      date(round.ends_on),
      round.school_id,
      ...roundTargetParams(round.id),
      ...scope.params,
    ],
  );
  const progressRows = rows.map((row) => {
    const firstName = readField(
      row.first_name_encrypted,
      "school_students",
      "first_name_encrypted",
      req.organizationContext,
    );
    const lastName = readField(
      row.last_name_encrypted,
      "school_students",
      "last_name_encrypted",
      req.organizationContext,
    );
    return {
      id: row.id,
      student_code: row.student_code,
      student_name:
        [row.prefix, firstName, lastName].filter(Boolean).join(" ") ||
        "ไม่ระบุชื่อ",
      grade_name: row.grade_name,
      classroom_name: row.classroom_name,
      completed_on: row.completed_on,
    };
  });
  res.json({
    round_id: round.id,
    total: progressRows.length,
    completed: progressRows.filter((r) => r.completed_on).length,
    outstanding: progressRows.filter((r) => !r.completed_on).length,
    data: progressRows,
  });
});

router.get("/rescreen-assignees", async (req, res) => {
  const ss = await student(req, res, req.query.student_id);
  if (!ss) return;
  if (!canViewStudentHealth(req.schoolAccess, ss))
    return fail(res, 403, "ไม่มีสิทธิ์ติดตามสุขภาพจิตของนักเรียนนี้");
  res.json(await rescreenAssignees(db, req, ss));
});
// ?student_id= narrows the list to one student (the student file). A
// completed task carries only the risk level of its result.
router.get("/rescreen-tasks", async (req, res) => {
  const studentId = positiveId(req.query.student_id);
  const [rows] = await db.query(
    `SELECT t.*,ss.school_id,ss.classroom_id,ss.student_code,ss.archived_at,u.username AS assigned_username,f.title AS target_form_title,(COALESCE(ss.patient_account_id,p.patient_account_id) IS NOT NULL) AS has_account,cr.organization_id AS completed_org,cr.summary_data AS completed_summary FROM school_rescreen_tasks t JOIN school_students ss ON ss.id=t.student_id JOIN schools s ON s.id=ss.school_id JOIN users u ON u.id=t.assigned_user_id LEFT JOIN forms f ON f.id=t.target_form_id LEFT JOIN persons p ON p.id=ss.person_id LEFT JOIN form_responses cr ON cr.id=t.completed_response_id WHERE s.organization_id=?${studentId ? " AND t.student_id=?" : ""} ORDER BY t.due_on,t.id`,
    [req.organizationContext, ...(studentId ? [studentId] : [])],
  );
  const today = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Bangkok",
  });
  res.json(
    rows
      .filter(
        // Follow-up tasks are staff work; guardians are never shown them.
        (r) =>
          !req.schoolAccess.isGuardian &&
          !r.archived_at &&
          canViewStudentHealth(req.schoolAccess, r),
      )
      .map(({ completed_org, completed_summary, ...r }) => ({
        ...r,
        due_on: date(r.due_on),
        overdue: r.status === "pending" && date(r.due_on) < today,
        has_account: Boolean(Number(r.has_account)),
        result_risk: completed_summary
          ? responseRisk({
              organization_id: completed_org,
              summary_data: completed_summary,
            })
          : null,
      })),
  );
});
router.post("/rescreen-tasks", async (req, res) => {
  const b = req.body || {},
    ss = await student(req, res, b.student_id);
  if (!ss) return;
  if (!canHealthAction(req.schoolAccess, "assign", ss))
    return fail(res, 403, "ไม่มีสิทธิ์ติดตามสุขภาพจิตของนักเรียนนี้");
  const id = await transaction(
    req,
    "school.rescreen.create",
    "student",
    ss.id,
    (c) =>
      rescreenTasks.createTask(c, {
        organizationId: req.organizationContext,
        userId: req.user.id,
        ss,
        task: {
          source_response_id: b.source_response_id,
          target_form_id: b.target_form_id,
          assigned_user_id: b.assigned_user_id,
          due_on: b.due_on,
          task_kind: b.task_kind || "rescreen",
        },
      }),
  );
  res.status(201).json({ id });
});
router.put("/rescreen-tasks/:id", async (req, res) => {
  const [[task]] = await db.query(
    "SELECT t.*,ss.school_id,ss.classroom_id,ss.person_id,ss.patient_account_id,ss.archived_at FROM school_rescreen_tasks t JOIN school_students ss ON ss.id=t.student_id JOIN schools s ON s.id=ss.school_id WHERE t.id=? AND s.organization_id=?",
    [req.params.id, req.organizationContext],
  );
  if (
    !task ||
    task.archived_at ||
    !canViewStudentHealth(req.schoolAccess, task)
  )
    return fail(res, 404, "ไม่พบงานติดตามในขอบเขตสิทธิ์");
  if (!canHealthAction(req.schoolAccess, "assign", task))
    return fail(res, 403, "ไม่มีสิทธิ์ติดตามสุขภาพจิตของนักเรียนนี้");
  if (task.status !== "pending") return fail(res, 409, "งานนี้สิ้นสุดแล้ว");
  if (!["completed", "cancelled"].includes(req.body?.status))
    return fail(res, 422, "สถานะไม่ถูกต้อง");
  await transaction(
    req,
    "school.rescreen.complete",
    "rescreen",
    task.id,
    async (c) => {
      if (req.body.status === "completed") {
        const [[response]] = await c.query(
          "SELECT id FROM form_responses WHERE id=? AND (? IS NULL OR id<>?) AND form_id=? AND organization_id=? AND (person_id=? OR (person_id IS NULL AND patient_account_id=?)) AND submitted_at>=?",
          [
            req.body.completed_response_id,
            task.source_response_id,
            task.source_response_id,
            task.target_form_id,
            req.organizationContext,
            task.person_id || 0,
            task.patient_account_id || 0,
            task.created_at,
          ],
        );
        if (!response)
          throw Object.assign(
            new Error("ต้องเลือกผลประเมินซ้ำจริงที่ส่งหลังสร้างงานติดตาม"),
            { status: 422 },
          );
      }
      const [updated] = await c.query(
        "UPDATE school_rescreen_tasks SET status=?,completed_response_id=?,completed_at=NOW() WHERE id=? AND status='pending'",
        [
          req.body.status,
          req.body.status === "completed"
            ? req.body.completed_response_id
            : null,
          task.id,
        ],
      );
      if (!updated.affectedRows)
        throw Object.assign(new Error("งานนี้ถูกปรับสถานะแล้ว"), {
          status: 409,
        });
    },
  );
  res.json({ success: true });
});

router.get("/risk-triggers", async (req, res) => {
  const [rows] = await db.query(
    "SELECT r.* FROM school_risk_triggers r JOIN schools s ON s.id=r.school_id WHERE s.organization_id=? ORDER BY r.id",
    [req.organizationContext],
  );
  res.json(
    rows.filter(
      (r) =>
        canManageWorkflowsAt(req.schoolAccess, r.school_id, "view") &&
        canViewStudentHealth(req.schoolAccess, { school_id: r.school_id }),
    ),
  );
});
router.post("/risk-triggers", async (req, res) => {
  const b = req.body || {};
  if (!(await school(req, res, b.school_id, "create"))) return;
  if (
    !canViewStudentHealth(req.schoolAccess, { school_id: Number(b.school_id) })
  )
    return fail(res, 403, "ต้องเป็นแอดมินสุขภาพจิต");
  const f = await form(req, b.form_id, "mental");
  const question = f && questionById(json(f.questions), b.question_id),
    path = String(b.answer_path || "");
  if (
    !question ||
    ["group", "section"].includes(question.type) ||
    typeof b.answer_value !== "string" ||
    !b.answer_value.trim() ||
    b.answer_value.length > 500 ||
    String(b.question_id).length > 120
  )
    return fail(res, 422, "ต้องระบุข้อคำถามจริงและคำตอบที่ทำให้เป็นสีแดง");
  if (
    ["grid_multiple", "grid_checkbox"].includes(question.type) &&
    (!/^\d+$/.test(path) || !question.rows?.[Number(path)])
  )
    return fail(res, 422, "คำถามแบบตารางต้องเลือกแถวที่ต้องการตรวจ");
  if (path && !["grid_multiple", "grid_checkbox"].includes(question.type))
    return fail(res, 422, "คำถามนี้ไม่มีแถวคำตอบ");
  const options = question.options || question.cols;
  if (
    options?.length &&
    !options.some((v) => String(v).trim() === b.answer_value.trim())
  )
    return fail(res, 422, "คำตอบต้องตรงกับตัวเลือกในแบบประเมิน");
  const [insert] = await transaction(
    req,
    "school.risk_rule.approve",
    "school",
    b.school_id,
    (c) =>
      c.query(
        "INSERT INTO school_risk_triggers (school_id,form_id,question_id,answer_path,answer_value,approved_by) VALUES (?,?,?,?,?,?)",
        [
          b.school_id,
          b.form_id,
          b.question_id,
          path,
          b.answer_value.trim(),
          req.user.id,
        ],
      ),
  );
  res.status(201).json({ id: insert.insertId });
});
router.put("/risk-triggers/:id", async (req, res) => {
  const [[rule]] = await db.query(
    "SELECT r.* FROM school_risk_triggers r JOIN schools s ON s.id=r.school_id WHERE r.id=? AND s.organization_id=?",
    [req.params.id, req.organizationContext],
  );
  if (
    !rule ||
    !canManageWorkflowsAt(req.schoolAccess, rule.school_id, "update") ||
    !canViewStudentHealth(req.schoolAccess, { school_id: rule.school_id })
  )
    return fail(res, 403, "ไม่มีสิทธิ์จัดการเกณฑ์นี้");
  if (typeof req.body?.enabled !== "boolean")
    return fail(res, 422, "สถานะเกณฑ์ไม่ถูกต้อง");
  await transaction(req, "school.risk_rule.status", "trigger", rule.id, (c) =>
    c.query("UPDATE school_risk_triggers SET enabled=? WHERE id=?", [
      req.body.enabled ? 1 : 0,
      rule.id,
    ]),
  );
  res.json({ success: true });
});

router.get("/workflow-settings/:schoolId", async (req, res) => {
  if (!(await school(req, res, req.params.schoolId, "view"))) return;
  const [[settings]] = await db.query(
    "SELECT * FROM school_workflow_settings WHERE school_id=?",
    [req.params.schoolId],
  );
  res.json({
    ...settings,
    care_advice: json(settings?.care_advice_json) || {
      high: "",
      medium: "",
      normal: "",
      none: "",
    },
  });
});
router.put("/workflow-settings/:schoolId", async (req, res) => {
  const s = await school(req, res, req.params.schoolId, "update");
  if (!s) return;
  const { care_advice, retention_years } = req.body || {};
  if (
    !care_advice ||
    typeof care_advice !== "object" ||
    Object.keys(care_advice).some(
      (k) => !["high", "medium", "normal", "none"].includes(k),
    ) ||
    Object.values(care_advice).some(
      (v) => typeof v !== "string" || v.length > 2000,
    ) ||
    !Number.isInteger(Number(retention_years)) ||
    Number(retention_years) < 1 ||
    Number(retention_years) > 100
  )
    return fail(res, 422, "คำแนะนำหรือระยะเวลาเก็บข้อมูลไม่ถูกต้อง");
  await transaction(req, "school.settings.approve", "school", s.id, (c) =>
    c.query(
      "INSERT INTO school_workflow_settings (school_id,care_advice_json,retention_years,retention_approved_by,retention_approved_at) VALUES (?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE care_advice_json=VALUES(care_advice_json),retention_years=VALUES(retention_years),retention_approved_by=VALUES(retention_approved_by),retention_approved_at=NOW()",
      [s.id, JSON.stringify(care_advice), retention_years, req.user.id],
    ),
  );
  res.json({ success: true });
});
// Risk alerts to homeroom teachers and grade counselors when a submitted
// mental-health assessment is at risk (services/schoolRiskAlerts.js).
router.get("/notification-settings/:schoolId", async (req, res) => {
  if (!(await school(req, res, req.params.schoolId, "view"))) return;
  const [[settings]] = await db.query(
    "SELECT notification_json FROM school_workflow_settings WHERE school_id=?",
    [req.params.schoolId],
  );
  res.json({
    risk_alerts: require("../services/schoolRiskAlerts").riskAlertSettings(
      settings?.notification_json,
    ),
  });
});
router.put("/notification-settings/:schoolId", async (req, res) => {
  const s = await school(req, res, req.params.schoolId, "update");
  if (!s) return;
  const checked = require("../services/schoolRiskAlerts").validateSettings(
    req.body?.risk_alerts,
  );
  if (checked.error) return fail(res, 422, checked.error);
  await transaction(
    req,
    "school.notification_settings.update",
    "school",
    s.id,
    (c) =>
      c.query(
        "INSERT INTO school_workflow_settings (school_id,notification_json) VALUES (?,?) ON DUPLICATE KEY UPDATE notification_json=VALUES(notification_json)",
        [s.id, JSON.stringify({ risk_alerts: checked.value })],
      ),
  );
  res.json({ success: true });
});
// Step-by-step guidance for teachers per risk level, next to the one-line
// care advice. Saved on its own so the retention approval is untouched.
const RISK_LEVELS = ["high", "medium", "normal", "none"];
const GUIDANCE_STEPS = ["observe", "talk", "follow_up", "refer"];
const emptyGuidance = () =>
  Object.fromEntries(
    RISK_LEVELS.map((risk) => [
      risk,
      Object.fromEntries(GUIDANCE_STEPS.map((step) => [step, ""])),
    ]),
  );
// Only the steps the school wrote, in order, for display.
function filledSteps(steps) {
  return GUIDANCE_STEPS.filter((step) =>
    String(steps?.[step] || "").trim(),
  ).map((step) => ({ step, text: steps[step] }));
}
router.get("/care-guidance/:schoolId", async (req, res) => {
  if (!(await school(req, res, req.params.schoolId, "view"))) return;
  const [[settings]] = await db.query(
    "SELECT care_advice_json,care_guidance_json FROM school_workflow_settings WHERE school_id=?",
    [req.params.schoolId],
  );
  const advice = json(settings?.care_advice_json) || {};
  const saved = json(settings?.care_guidance_json) || {};
  const guidance = emptyGuidance();
  for (const risk of RISK_LEVELS)
    for (const step of GUIDANCE_STEPS)
      guidance[risk][step] = String(saved?.[risk]?.[step] || "");
  res.json({
    care_advice: Object.fromEntries(
      RISK_LEVELS.map((risk) => [risk, String(advice[risk] || "")]),
    ),
    care_guidance: guidance,
  });
});
router.put("/care-guidance/:schoolId", async (req, res) => {
  const s = await school(req, res, req.params.schoolId, "update");
  if (!s) return;
  const { care_advice, care_guidance } = req.body || {};
  const text = (v) => typeof v === "string" && v.length <= 2000;
  const valid =
    care_advice &&
    typeof care_advice === "object" &&
    Object.keys(care_advice).every((k) => RISK_LEVELS.includes(k)) &&
    Object.values(care_advice).every(text) &&
    care_guidance &&
    typeof care_guidance === "object" &&
    Object.entries(care_guidance).every(
      ([risk, steps]) =>
        RISK_LEVELS.includes(risk) &&
        steps &&
        typeof steps === "object" &&
        Object.keys(steps).every((k) => GUIDANCE_STEPS.includes(k)) &&
        Object.values(steps).every(text),
    );
  if (!valid)
    return fail(res, 422, "คำแนะนำไม่ถูกต้องหรือยาวเกิน 2,000 ตัวอักษร");
  await transaction(req, "school.care_guidance.update", "school", s.id, (c) =>
    c.query(
      "INSERT INTO school_workflow_settings (school_id,care_advice_json,care_guidance_json) VALUES (?,?,?) ON DUPLICATE KEY UPDATE care_advice_json=VALUES(care_advice_json),care_guidance_json=VALUES(care_guidance_json)",
      [s.id, JSON.stringify(care_advice), JSON.stringify(care_guidance)],
    ),
  );
  res.json({ success: true });
});
// Guidance for one student's latest mental-health risk, for the people who
// may see that risk (risk overview or the student's health).
router.get("/students/:id/care-guidance", async (req, res) => {
  const row = await student(req, res, req.params.id);
  if (!row) return;
  if (!(
    req.schoolAccess.canViewRisk || canViewStudentHealth(req.schoolAccess, row)
  ))
    return fail(res, 403, "ไม่มีสิทธิ์ดูคำแนะนำการดูแลนักเรียนคนนี้");
  const [[latest]] = await db.query(
    `SELECT fr.id,fr.organization_id,fr.summary_data,fr.submitted_at FROM form_responses fr JOIN forms f ON f.id=fr.form_id WHERE fr.organization_id=? AND f.health_domain='mental' AND (fr.person_id=? OR (fr.person_id IS NULL AND fr.patient_account_id=?)) ORDER BY fr.submitted_at DESC,fr.id DESC LIMIT 1`,
    [req.organizationContext, row.person_id || 0, row.patient_account_id || 0],
  );
  const risk = latest ? responseRisk(latest) : "none";
  const [[settings]] = await db.query(
    "SELECT care_advice_json,care_guidance_json FROM school_workflow_settings WHERE school_id=?",
    [row.school_id],
  );
  res.set("Cache-Control", "no-store");
  res.json({
    risk,
    care_advice: (json(settings?.care_advice_json) || {})[risk] || "",
    care_guidance: filledSteps(
      (json(settings?.care_guidance_json) || {})[risk],
    ),
  });
});
router.post("/retention/:schoolId", async (req, res) => {
  const s = await school(req, res, req.params.schoolId, "delete");
  if (!s) return;
  const { dry_run = true } = req.body || {};
  if (typeof dry_run !== "boolean")
    return fail(res, 422, "ระบุโหมดตรวจสอบไม่ถูกต้อง");
  const candidates = `SELECT ss.id,ss.student_code,ss.graduated_on FROM school_students ss WHERE ss.school_id=? AND ss.status='graduated' AND ss.archived_at IS NULL AND ss.graduated_on<=DATE_SUB(CURDATE(),INTERVAL ? YEAR) AND NOT EXISTS (SELECT 1 FROM pdpa_legal_holds h WHERE h.organization_id=? AND h.released_at IS NULL AND ((h.target_type='student' AND h.target_id=ss.id) OR (h.target_type='form_responses' AND h.target_id IN (SELECT fr.id FROM form_responses fr WHERE fr.organization_id=? AND (fr.person_id=ss.person_id OR fr.patient_account_id=ss.patient_account_id)))))`;
  const result = await transaction(
    req,
    "school.retention." + (dry_run ? "preview" : "archive"),
    "school",
    s.id,
    async (c) => {
      const [[policy]] = await c.query(
        "SELECT retention_years FROM school_workflow_settings WHERE school_id=? AND retention_approved_at IS NOT NULL FOR UPDATE",
        [s.id],
      );
      if (!policy?.retention_years)
        throw Object.assign(new Error("กรุณาบันทึกนโยบายเก็บข้อมูลก่อน"), {
          status: 409,
        });
      const [rows] = await c.query(candidates + " FOR UPDATE", [
        s.id,
        policy.retention_years,
        req.organizationContext,
        req.organizationContext,
      ]);
      if (!dry_run && rows.length)
        await c.query(
          "UPDATE school_students SET archived_at=NOW() WHERE id IN (?)",
          [rows.map((r) => r.id)],
        );
      return rows.map((r) => ({ ...r, graduated_on: date(r.graduated_on) }));
    },
  );
  res.json({
    dry_run,
    archived: dry_run ? 0 : result.length,
    data: result,
    shared_medical_records_deleted: false,
  });
});

router.use(require("./schoolTeacherImportRoutes"));
module.exports = router;
// Exposed for the local MySQL boundary test.
module.exports.rescreenAssignees = rescreenAssignees;
