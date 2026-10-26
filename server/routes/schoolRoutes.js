const {
  encodeMeasurements,
  physicalRecord,
  bloodType,
} = require("../utils/schoolPrivateData");
const {
  deactivateSchoolTeacher,
  upsertSchoolTeacher,
} = require("../utils/schoolTeachers");
const { sealText, fieldContext } = require("../utils/privateData");
// routes/schoolRoutes.js — school organizations: schools, grade levels,
// classrooms, teachers, students (with their accounts) and student health.
// Mounted at /api/school. index.js already ran verifyToken + resolveContext
// (see authorization/requestScope.js), so req.authorization and
// req.organizationContext are set before any handler here.
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { encrypt, decrypt } = require("../utils/encryption");
const { audit } = require("../authorization/authorization");
const {
  loadSchoolAccess,
  studentScopeClause,
  canSeeStudent,
  canViewStudentHealth,
  canUpdateStudentHealth,
  canViewPhysicalHealth,
  canHealthAction,
  publicAccess,
} = require("../utils/schoolAccess");
const {
  MAX_IMPORT_ROWS,
  USERNAME_PATTERN,
  prepareImportRow,
  generateTemporaryPassword,
} = require("../utils/studentImport");
const {
  resolvePerson,
  nationalIdHash,
  PersonIdentityConflictError,
} = require("../utils/personIdentity");
const { decryptCaseResponse } = require("../utils/decryptCaseData");
const { memberUserIds } = require("../utils/organizationHierarchy");
const {
  riskLevelOf,
  scoreResultsOf,
  higherRisk,
} = require("../utils/riskLevel");

const router = express.Router();
const {
  currentAcademicYear,
  validAcademicYear,
} = require("../utils/academicYear");

const safeDecrypt = (value) => {
  if (!value) return "";
  return decrypt(value);
};
const text = (value) =>
  value === undefined || value === null ? "" : String(value).trim();
const optionalText = (value, max = 255) => text(value).slice(0, max) || null;
const positiveId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};
const fail = (res, status, message) =>
  res.status(status).json({ success: false, message });
// DATE columns arrive as local-midnight Date objects; send them as YYYY-MM-DD
// so a browser in another timezone does not shift the day.
const dateOnly = (value) => {
  if (!(value instanceof Date)) return value || null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
const STATUSES = ["active", "inactive"];
const STUDENT_STATUSES = Object.keys(require("../utils/studentStatus").labels);
const CURRENT_STUDENT_STATUSES = require("../utils/studentStatus").current;
const GENDERS = ["male", "female", "other"];
// "subject" seats a subject teacher in the room: they see its students, never
// their health (health follows homeroom seats only).
const TEACHER_ROLES = ["homeroom", "co_homeroom", "counselor", "subject"];
const BLOOD_TYPES = ["A", "B", "AB", "O", "unknown"];
const HEARING = ["normal", "abnormal", "not_tested"];
const TEMP_PASSWORD_COST = 10; // replaced by the student at first sign-in

// ── Context ──────────────────────────────────────────────────────────────
// Every route works inside one school organization chosen as the active
// organization. "all" (system admin overview) is not a school.
router.use(async (req, res, next) => {
  if (!req.authorization || !req.user)
    return fail(res, 401, "กรุณาเข้าสู่ระบบ");
  if (typeof req.organizationContext !== "number")
    return fail(res, 422, "กรุณาเลือกหน่วยงานโรงเรียนที่ต้องการจัดการ");
  const [orgs] = await db.query(
    "SELECT id, org_type, status FROM organizations WHERE id = ? LIMIT 1",
    [req.organizationContext],
  );
  if (!orgs[0] || orgs[0].org_type !== "school")
    return fail(res, 422, "หน่วยงานที่เลือกไม่ใช่หน่วยงานประเภทโรงเรียน");
  req.schoolAccess ||= await loadSchoolAccess(db, req);
  if (req.schoolAccess.isGuardian && !["GET", "HEAD"].includes(req.method))
    return fail(res, 403, "ผู้ปกครองมีสิทธิ์ดูข้อมูลเท่านั้น");
  return next();
});

const { need, denyUnless } = require("../authorization/can");
const allow = (check, message = "คุณไม่มีสิทธิ์ดำเนินการนี้") =>
  function allowSchoolAction(req, res, next) {
    return check(req.schoolAccess) ? next() : fail(res, 403, message);
  };

const canWriteSchool = (req, schoolId) =>
  ["GET", "HEAD"].includes(req.method) ||
  req.schoolAccess.isSystemAdmin ||
  !req.schoolAccess.adminSchoolIds?.length ||
  req.schoolAccess.adminSchoolIds.includes(Number(schoolId));

async function schoolInOrganization(req, schoolId) {
  const id = positiveId(schoolId);
  if (!id || !canWriteSchool(req, id)) return null;
  const [rows] = await db.query(
    "SELECT * FROM schools WHERE id = ? AND organization_id = ? LIMIT 1",
    [id, req.organizationContext],
  );
  return rows[0] || null;
}

async function gradeInOrganization(req, gradeId) {
  const [rows] = await db.query(
    `SELECT g.* FROM school_grade_levels g JOIN schools s ON s.id = g.school_id
      WHERE g.id = ? AND s.organization_id = ? LIMIT 1`,
    [positiveId(gradeId), req.organizationContext],
  );
  return rows[0] && canWriteSchool(req, rows[0].school_id) ? rows[0] : null;
}

async function classroomInOrganization(req, classroomId) {
  const [rows] = await db.query(
    `SELECT c.* FROM school_classrooms c JOIN schools s ON s.id = c.school_id
      WHERE c.id = ? AND s.organization_id = ? LIMIT 1`,
    [positiveId(classroomId), req.organizationContext],
  );
  return rows[0] && canWriteSchool(req, rows[0].school_id) ? rows[0] : null;
}

async function teacherInOrganization(req, teacherId) {
  const [rows] = await db.query(
    `SELECT t.* FROM school_teachers t JOIN schools s ON s.id = t.school_id
      WHERE t.id = ? AND s.organization_id = ? LIMIT 1`,
    [positiveId(teacherId), req.organizationContext],
  );
  return rows[0] && canWriteSchool(req, rows[0].school_id) ? rows[0] : null;
}

const duplicate = (error) => error?.code === "ER_DUP_ENTRY";

// ── Access ───────────────────────────────────────────────────────────────
router.get("/access", (req, res) => {
  res.json(publicAccess(req.schoolAccess));
});

// ── School ───────────────────────────────────────────────────────────────
// A school sub-unit is one school: its school row is created on first use,
// named after the sub-unit, with a generated code that prefixes student
// usernames (SC + organization id, e.g. SC002).
const schoolCodeFor = (organizationId, attempt = 0) =>
  `SC${String(organizationId).padStart(3, "0")}${attempt ? String.fromCharCode(64 + attempt) : ""}`;

async function ensureOrganizationSchool(req) {
  const [orgs] = await db.query(
    "SELECT id, name FROM organizations WHERE id = ? LIMIT 1",
    [req.organizationContext],
  );
  const organization = orgs[0];
  const [rows] = await db.query(
    "SELECT * FROM schools WHERE organization_id = ? ORDER BY status = 'active' DESC, id LIMIT 1",
    [organization.id],
  );
  if (rows[0]) {
    if (rows[0].name !== organization.name) {
      await db.query("UPDATE schools SET name = ? WHERE id = ?", [
        organization.name,
        rows[0].id,
      ]);
      rows[0].name = organization.name;
    }
    return rows[0];
  }
  for (let attempt = 0; attempt < 26; attempt += 1) {
    const code = schoolCodeFor(organization.id, attempt);
    try {
      const [result] = await db.query(
        "INSERT INTO schools (organization_id, code, name, status) VALUES (?, ?, ?, 'active')",
        [organization.id, code, organization.name],
      );
      await audit(req, {
        action: "school.create",
        targetType: "school",
        targetId: result.insertId,
        after: { code, name: organization.name, generated: true },
      });
      const [created] = await db.query("SELECT * FROM schools WHERE id = ?", [
        result.insertId,
      ]);
      return created[0];
    } catch (error) {
      if (!duplicate(error)) throw error;
      // Another request created it, or the code is taken: look again.
      const [again] = await db.query(
        "SELECT * FROM schools WHERE organization_id = ? ORDER BY id LIMIT 1",
        [organization.id],
      );
      if (again[0]) return again[0];
    }
  }
  throw new Error("Could not generate a school code");
}

router.get(
  "/schools",
  allow((a) => a.canViewSchool),
  async (req, res) => {
    const school = await ensureOrganizationSchool(req);
    const [rows] = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM school_classrooms c WHERE c.school_id = s.id AND c.status = 'active') AS classroom_count,
              (SELECT COUNT(*) FROM school_students st WHERE st.school_id = s.id AND st.status = 'active') AS student_count,
              (SELECT COUNT(*) FROM school_teachers t WHERE t.school_id = s.id AND t.status = 'active') AS teacher_count
         FROM schools s WHERE s.id = ?`,
      [school.id],
    );
    res.json(rows);
  },
);

// ── Grade levels ─────────────────────────────────────────────────────────
function gradePayload(body = {}) {
  const name = text(body.name);
  if (!name || name.length > 50) return { error: "กรุณาระบุชื่อชั้นปี" };
  const status = body.status || "active";
  if (!STATUSES.includes(status)) return { error: "สถานะไม่ถูกต้อง" };
  return {
    value: { name, level_order: Number(body.level_order) || 0, status },
  };
}

router.get(
  "/schools/:id/grades",
  allow((a) => a.canViewSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const [rows] = await db.query(
      `SELECT g.*, (SELECT COUNT(*) FROM school_classrooms c WHERE c.grade_level_id = g.id) AS classroom_count
         FROM school_grade_levels g WHERE g.school_id = ? ORDER BY g.level_order, g.name`,
      [school.id],
    );
    res.json(rows);
  },
);

router.post(
  "/schools/:id/grades",
  allow((a) => a.canCreateSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const payload = gradePayload(req.body);
    if (payload.error) return fail(res, 422, payload.error);
    try {
      const [result] = await db.query(
        "INSERT INTO school_grade_levels (school_id, name, level_order, status) VALUES (?, ?, ?, ?)",
        [
          school.id,
          payload.value.name,
          payload.value.level_order,
          payload.value.status,
        ],
      );
      res.status(201).json({ id: result.insertId });
    } catch (error) {
      if (duplicate(error)) return fail(res, 409, "มีชั้นปีชื่อนี้แล้ว");
      throw error;
    }
  },
);

router.put(
  "/grades/:id",
  allow((a) => a.canUpdateSchool),
  async (req, res) => {
    const grade = await gradeInOrganization(req, req.params.id);
    if (!grade) return fail(res, 404, "ไม่พบชั้นปี");
    const payload = gradePayload(req.body);
    if (payload.error) return fail(res, 422, payload.error);
    try {
      await db.query(
        "UPDATE school_grade_levels SET name = ?, level_order = ?, status = ? WHERE id = ?",
        [
          payload.value.name,
          payload.value.level_order,
          payload.value.status,
          grade.id,
        ],
      );
      res.json({ success: true });
    } catch (error) {
      if (duplicate(error)) return fail(res, 409, "มีชั้นปีชื่อนี้แล้ว");
      throw error;
    }
  },
);

router.delete(
  "/grades/:id",
  allow((a) => a.canDeleteSchool),
  async (req, res) => {
    const grade = await gradeInOrganization(req, req.params.id);
    if (!grade) return fail(res, 404, "ไม่พบชั้นปี");
    const [used] = await db.query(
      "SELECT 1 FROM school_classrooms WHERE grade_level_id = ? LIMIT 1",
      [grade.id],
    );
    if (used.length)
      return fail(res, 409, "ลบไม่ได้ เพราะชั้นปีนี้ยังมีห้องเรียน");
    await db.query("DELETE FROM school_grade_levels WHERE id = ?", [grade.id]);
    res.json({ success: true });
  },
);

// ── Classrooms ───────────────────────────────────────────────────────────
async function teacherDisplayRows(whereSql, params) {
  const [rows] = await db.query(
    `SELECT t.id, t.school_id, t.user_id, t.teacher_type_id, t.employee_code, t.position,
            t.phone_encrypted, t.status, s.organization_id, u.username, u.name AS user_name_encrypted,
            tt.name AS teacher_type_name
       FROM school_teachers t
       JOIN users u ON u.id = t.user_id
       JOIN schools s ON s.id = t.school_id
       LEFT JOIN school_teacher_types tt ON tt.id = t.teacher_type_id
      WHERE ${whereSql}`,
    params,
  );
  return rows.map(({ phone_encrypted, user_name_encrypted, ...row }) => ({
    ...row,
    name:
      require("../utils/privateField").readField(
        user_name_encrypted,
        "users",
        "name",
        null,
        safeDecrypt,
      ) || row.username,
    phone: require("../utils/privateField").readField(
      phone_encrypted,
      "school_teachers",
      "phone_encrypted",
      row.organization_id,
      safeDecrypt,
    ),
  }));
}

router.get(
  "/schools/:id/classrooms",
  allow((a) => a.canViewSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const year = positiveId(req.query.academic_year);
    const [rows] = await db.query(
      `SELECT c.*, g.name AS grade_name, g.level_order,
              (SELECT COUNT(*) FROM school_students st WHERE st.classroom_id = c.id AND st.status = 'active') AS student_count
         FROM school_classrooms c JOIN school_grade_levels g ON g.id = c.grade_level_id
        WHERE c.school_id = ?${year ? " AND c.academic_year = ?" : ""}
        ORDER BY c.academic_year DESC, g.level_order, g.name, c.name`,
      year ? [school.id, year] : [school.id],
    );
    const ids = rows.map((row) => row.id);
    const assignments = ids.length
      ? (
          await db.query(
            "SELECT classroom_id, teacher_id, role FROM school_classroom_teachers WHERE classroom_id IN (?)",
            [ids],
          )
        )[0]
      : [];
    const teacherIds = [...new Set(assignments.map((row) => row.teacher_id))];
    const teachers = teacherIds.length
      ? await teacherDisplayRows("t.id IN (?)", [teacherIds])
      : [];
    const byId = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    res.json(
      rows.map((row) => ({
        ...row,
        teachers: assignments
          .filter((assignment) => assignment.classroom_id === row.id)
          .map((assignment) => ({
            teacher_id: assignment.teacher_id,
            role: assignment.role,
            name: byId.get(assignment.teacher_id)?.name || "-",
          })),
      })),
    );
  },
);

router.get(
  "/schools/:id/academic-years",
  allow((a) => a.canViewSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const current = currentAcademicYear();
    const [rows] = await db.query(
      `SELECT academic_year FROM school_academic_years WHERE school_id = ? AND academic_year >= ? UNION SELECT academic_year FROM school_classrooms WHERE school_id = ? AND academic_year >= ? UNION SELECT ? AS academic_year ORDER BY academic_year DESC`,
      [school.id, current - 10, school.id, current - 10, current],
    );
    const mental = require("../services/studentMentalStatus");
    const terms = (await mental.loadTerms(db, [school.id])).get(school.id);
    res.json({
      current_year: current,
      minimum_year: current - 10,
      years: rows.map((r) => Number(r.academic_year)),
      // Semester dates per year, used to file assessments under a semester.
      terms: Object.fromEntries(
        [...terms].map(([year, row]) => [
          year,
          Object.fromEntries(
            mental.TERM_COLUMNS.map((c) => [c, mental.dateKey(row[c])]),
          ),
        ]),
      ),
    });
  },
);
router.put(
  "/schools/:id/academic-years/:year/terms",
  allow((a) => a.canUpdateSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const year = Number(req.params.year);
    if (
      !validAcademicYear(year) ||
      !(await registeredAcademicYear(school.id, year))
    )
      return fail(res, 404, "ไม่พบปีการศึกษานี้");
    const mental = require("../services/studentMentalStatus");
    const { value, error } = mental.validateTerms(req.body, year);
    if (error)
      return fail(
        res,
        422,
        "กรุณากรอกวันเปิด-ปิดของทั้งสองภาคเรียนให้ครบ เรียงตามลำดับ และอยู่ในปีการศึกษานั้น",
      );
    const columns = mental.TERM_COLUMNS;
    await db.query(
      `INSERT INTO school_academic_years (school_id, academic_year, ${columns.join(", ")}) VALUES (?, ?, ${columns.map(() => "?").join(", ")})
       ON DUPLICATE KEY UPDATE ${columns.map((c) => `${c} = VALUES(${c})`).join(", ")}`,
      [school.id, year, ...columns.map((c) => value[c])],
    );
    await audit(req, {
      action: "school.update",
      targetType: "academic_year",
      targetId: `${school.id}:${year}`,
      after: value,
    });
    res.json({ academic_year: year, ...value });
  },
);
router.post(
  "/schools/:id/academic-years",
  allow((a) => a.canCreateSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    if (!validAcademicYear(req.body.academic_year))
      return fail(
        res,
        422,
        `เพิ่มย้อนหลังได้ไม่เกิน 10 ปี (ตั้งแต่ ${currentAcademicYear() - 10}) และต้องเป็น พ.ศ. 4 หลัก`,
      );
    try {
      await db.query(
        "INSERT INTO school_academic_years (school_id, academic_year) VALUES (?, ?)",
        [school.id, Number(req.body.academic_year)],
      );
      res.status(201).json({ academic_year: Number(req.body.academic_year) });
    } catch (error) {
      if (duplicate(error)) return fail(res, 409, "มีปีการศึกษานี้แล้ว");
      throw error;
    }
  },
);
async function registeredAcademicYear(schoolId, year) {
  if (Number(year) === currentAcademicYear()) return true;
  const [rows] = await db.query(
    "SELECT 1 FROM school_academic_years WHERE school_id = ? AND academic_year = ? UNION SELECT 1 FROM school_classrooms WHERE school_id = ? AND academic_year = ? LIMIT 1",
    [schoolId, year, schoolId, year],
  );
  return Boolean(rows[0]);
}

function classroomPayload(body = {}) {
  const name = text(body.name);
  const academicYear = Number(body.academic_year);
  const capacity =
    body.capacity === "" || body.capacity == null
      ? null
      : Number(body.capacity);
  const status = body.status || "active";
  if (name.length > 50) return { error: "ชื่อห้องเรียนยาวเกินไป" };
  if (!positiveId(body.grade_level_id)) return { error: "กรุณาเลือกชั้นปี" };
  if (!validAcademicYear(body.academic_year))
    return {
      error: `ปีการศึกษาต้องเป็น พ.ศ. 4 หลัก ย้อนหลังได้ไม่เกิน 10 ปี (ตั้งแต่ ${currentAcademicYear() - 10})`,
    };
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 0))
    return { error: "จำนวนที่นั่งไม่ถูกต้อง" };
  if (!STATUSES.includes(status)) return { error: "สถานะไม่ถูกต้อง" };
  return {
    value: {
      name,
      grade_level_id: positiveId(body.grade_level_id),
      academic_year: academicYear,
      capacity,
      status,
    },
  };
}

router.post(
  "/schools/:id/classrooms",
  allow((a) => a.canCreateSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.params.id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const payload = classroomPayload(req.body);
    if (payload.error) return fail(res, 422, payload.error);
    if (!(await registeredAcademicYear(school.id, payload.value.academic_year)))
      return fail(res, 422, "กรุณาเพิ่มปีการศึกษาในข้อมูลหลักก่อน");
    const grade = await gradeInOrganization(req, payload.value.grade_level_id);
    if (!grade || grade.school_id !== school.id)
      return fail(res, 422, "ชั้นปีไม่อยู่ในโรงเรียนนี้");
    try {
      const { grade_level_id, academic_year, capacity, status } = payload.value;
      let { name } = payload.value;
      if (!name) {
        // Next room number in this grade and year: 1, 2, 3 ...
        const [existing] = await db.query(
          "SELECT name FROM school_classrooms WHERE grade_level_id = ? AND academic_year = ?",
          [grade_level_id, academic_year],
        );
        const used = new Set(existing.map((row) => row.name));
        let number = 1;
        while (used.has(String(number))) number += 1;
        name = String(number);
      }
      const [result] = await db.query(
        "INSERT INTO school_classrooms (school_id, grade_level_id, name, academic_year, capacity, status) VALUES (?, ?, ?, ?, ?, ?)",
        [school.id, grade_level_id, name, academic_year, capacity, status],
      );
      res.status(201).json({ id: result.insertId, name });
    } catch (error) {
      if (duplicate(error))
        return fail(res, 409, "มีห้องเรียนชื่อนี้ในชั้นปีและปีการศึกษานี้แล้ว");
      throw error;
    }
  },
);

router.put(
  "/classrooms/:id",
  allow((a) => a.canUpdateSchool),
  async (req, res) => {
    const classroom = await classroomInOrganization(req, req.params.id);
    if (!classroom) return fail(res, 404, "ไม่พบห้องเรียน");
    const payload = classroomPayload(req.body);
    if (payload.error) return fail(res, 422, payload.error);
    if (
      !(await registeredAcademicYear(
        classroom.school_id,
        payload.value.academic_year,
      ))
    )
      return fail(res, 422, "กรุณาเพิ่มปีการศึกษาในข้อมูลหลักก่อน");
    if (!payload.value.name) return fail(res, 422, "กรุณาระบุชื่อห้องเรียน");
    const grade = await gradeInOrganization(req, payload.value.grade_level_id);
    if (!grade || grade.school_id !== classroom.school_id)
      return fail(res, 422, "ชั้นปีไม่อยู่ในโรงเรียนนี้");
    try {
      const { name, grade_level_id, academic_year, capacity, status } =
        payload.value;
      await db.query(
        "UPDATE school_classrooms SET grade_level_id = ?, name = ?, academic_year = ?, capacity = ?, status = ? WHERE id = ?",
        [grade_level_id, name, academic_year, capacity, status, classroom.id],
      );
      res.json({ success: true });
    } catch (error) {
      if (duplicate(error))
        return fail(res, 409, "มีห้องเรียนชื่อนี้ในชั้นปีและปีการศึกษานี้แล้ว");
      throw error;
    }
  },
);

router.delete(
  "/classrooms/:id",
  allow((a) => a.canDeleteSchool),
  async (req, res) => {
    const classroom = await classroomInOrganization(req, req.params.id);
    if (!classroom) return fail(res, 404, "ไม่พบห้องเรียน");
    const [used] = await db.query(
      "SELECT 1 FROM school_students WHERE classroom_id = ? LIMIT 1",
      [classroom.id],
    );
    if (used.length)
      return fail(res, 409, "ลบไม่ได้ เพราะห้องนี้ยังมีนักเรียน");
    await db.query("DELETE FROM school_classrooms WHERE id = ?", [
      classroom.id,
    ]);
    res.json({ success: true });
  },
);

// Replaces the teachers of a classroom: [{ teacher_id, role }].
router.put(
  "/classrooms/:id/teachers",
  // Placing teachers in a classroom is "assign" on the roles page.
  allow((a) => a.isSystemAdmin || a.canAssignSchool),
  async (req, res) => {
    const classroom = await classroomInOrganization(req, req.params.id);
    if (!classroom) return fail(res, 404, "ไม่พบห้องเรียน");
    const list = Array.isArray(req.body?.teachers) ? req.body.teachers : null;
    if (!list || list.length > 20)
      return fail(res, 422, "รายชื่อครูไม่ถูกต้อง");
    const assignments = [];
    for (const item of list) {
      const teacher = await teacherInOrganization(req, item.teacher_id);
      const role = item.role || "homeroom";
      if (!teacher || teacher.school_id !== classroom.school_id)
        return fail(res, 422, "ครูต้องอยู่ในโรงเรียนเดียวกับห้องเรียน");
      if (!TEACHER_ROLES.includes(role))
        return fail(res, 422, "บทบาทครูไม่ถูกต้อง");
      if (!assignments.some((a) => a.teacher_id === teacher.id))
        assignments.push({ teacher_id: teacher.id, role });
    }
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "DELETE FROM school_classroom_teachers WHERE classroom_id = ?",
        [classroom.id],
      );
      for (const assignment of assignments)
        await connection.query(
          "INSERT INTO school_classroom_teachers (classroom_id, teacher_id, role) VALUES (?, ?, ?)",
          [classroom.id, assignment.teacher_id, assignment.role],
        );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await audit(req, {
      action: "school.update",
      targetType: "classroom_teachers",
      targetId: classroom.id,
      after: assignments,
    });
    res.json({ success: true });
  },
);

// ── Teacher and student types ────────────────────────────────────────────
// Read-only here for the teacher and student pages; items are edited in
// master data (teacher_types / student_types) under master_data.* rights.
function typeRoutes(path, table, usedIn) {
  router.get(
    `/${path}`,
    allow((a) => a.canViewSchool),
    async (req, res) => {
      const [rows] = await db.query(
        `SELECT t.*, (SELECT COUNT(*) FROM ${usedIn.table} u WHERE u.${usedIn.column} = t.id) AS usage_count
           FROM ${table} t WHERE t.organization_id = ? ORDER BY t.sort_order, t.name`,
        [req.organizationContext],
      );
      res.json(rows);
    },
  );
}

typeRoutes("teacher-types", "school_teacher_types", {
  table: "school_teachers",
  column: "teacher_type_id",
});
typeRoutes("student-types", "school_student_types", {
  table: "school_students",
  column: "student_type_id",
});

async function typeInOrganization(req, table, id, currentId = null) {
  if (id === null || id === undefined || id === "") return { id: null };
  const [rows] = await db.query(
    `SELECT id FROM ${table} WHERE id = ? AND organization_id = ? AND (status = 'active' OR id = ?) LIMIT 1`,
    [positiveId(id), req.organizationContext, positiveId(currentId) || 0],
  );
  return rows[0] || null;
}

// ── Teachers ─────────────────────────────────────────────────────────────
router.get(
  "/teachers",
  allow((a) => a.canViewSchool),
  async (req, res) => {
    const where = ["s.organization_id = ?"];
    const params = [req.organizationContext];
    const schoolId = positiveId(req.query.school_id);
    if (schoolId) {
      where.push("t.school_id = ?");
      params.push(schoolId);
    }
    const typeId = positiveId(req.query.teacher_type_id);
    if (typeId) {
      where.push("t.teacher_type_id = ?");
      params.push(typeId);
    }
    if (STATUSES.includes(req.query.status)) {
      where.push("t.status = ?");
      params.push(req.query.status);
    }
    const teachers = await teacherDisplayRows(
      `t.school_id IN (SELECT id FROM schools s WHERE ${where[0]}) AND ${
        where.slice(1).join(" AND ") || "1 = 1"
      }`,
      params,
    );
    const search = text(req.query.search).toLowerCase();
    const filtered = search
      ? teachers.filter((teacher) =>
          [
            teacher.name,
            teacher.username,
            teacher.employee_code,
            teacher.position,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search)),
        )
      : teachers;
    const ids = filtered.map((teacher) => teacher.id);
    const classrooms = ids.length
      ? (
          await db.query(
            `SELECT ct.teacher_id, ct.role, c.id AS classroom_id, c.name, c.academic_year, g.name AS grade_name
               FROM school_classroom_teachers ct
               JOIN school_classrooms c ON c.id = ct.classroom_id
               JOIN school_grade_levels g ON g.id = c.grade_level_id
              WHERE ct.teacher_id IN (?)`,
            [ids],
          )
        )[0]
      : [];
    const [schools] = await db.query(
      "SELECT id, name FROM schools WHERE organization_id = ?",
      [req.organizationContext],
    );
    const schoolNames = new Map(schools.map((s) => [s.id, s.name]));
    res.json(
      filtered
        .map((teacher) => ({
          ...teacher,
          school_name: schoolNames.get(teacher.school_id) || "-",
          classrooms: classrooms
            .filter((row) => row.teacher_id === teacher.id)
            .map(({ teacher_id, ...row }) => row),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "th")),
    );
  },
);

// Staff with an active membership in this organization who are not yet a
// teacher of the given school.
router.get(
  "/teachers/candidates",
  allow((a) => a.canCreateSchool),
  async (req, res) => {
    const school = await schoolInOrganization(req, req.query.school_id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.name, u.email
         FROM organization_memberships om JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = ? AND om.status = 'active' AND u.status = 'active'
          AND u.id NOT IN (SELECT user_id FROM school_teachers WHERE school_id = ? AND status = 'active')
        ORDER BY u.username`,
      [req.organizationContext, school.id],
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        name: safeDecrypt(row.name) || row.username,
      })),
    );
  },
);

async function teacherPayload(
  req,
  body = {},
  { creating, currentTypeId = null },
) {
  const status = body.status || "active";
  if (!STATUSES.includes(status)) return { error: "สถานะไม่ถูกต้อง" };
  const type = await typeInOrganization(
    req,
    "school_teacher_types",
    body.teacher_type_id,
    currentTypeId,
  );
  if (!type) return { error: "ประเภทครูไม่ถูกต้อง" };
  const value = {
    teacher_type_id: type.id,
    employee_code: optionalText(body.employee_code, 50),
    position: optionalText(body.position, 100),
    phone: optionalText(body.phone, 32),
    status,
  };
  if (creating) {
    const school = await schoolInOrganization(req, body.school_id);
    if (!school) return { error: "กรุณาเลือกโรงเรียน" };
    // One ({ user_id }) or many ({ user_ids: [] }) staff accounts at once.
    const userIds = memberUserIds(body);
    if (!userIds) return { error: "กรุณาเลือกบัญชีเจ้าหน้าที่อย่างน้อย 1 คน" };
    const [members] = await db.query(
      "SELECT user_id FROM organization_memberships WHERE user_id IN (?) AND organization_id = ? AND status = 'active'",
      [userIds, req.organizationContext],
    );
    if (members.length !== userIds.length)
      return {
        error: "ครูต้องเป็นบัญชีเจ้าหน้าที่ที่เป็นสมาชิกของหน่วยงานนี้",
      };
    value.school_id = school.id;
    value.user_ids = userIds;
  }
  return { value };
}

router.post(
  "/teachers",
  allow((a) => a.canCreateSchool),
  async (req, res) => {
    const payload = await teacherPayload(req, req.body, { creating: true });
    if (payload.error) return fail(res, 422, payload.error);
    const v = payload.value;
    // Staff who already teach at this school are skipped, not duplicated;
    // former teachers (inactive rows) are reactivated.
    const [existing] = await db.query(
      "SELECT user_id FROM school_teachers WHERE school_id = ? AND user_id IN (?) AND status = 'active'",
      [v.school_id, v.user_ids],
    );
    const skipped = existing.map((row) => row.user_id);
    const toAdd = v.user_ids.filter((id) => !skipped.includes(id));
    if (!toAdd.length)
      return fail(res, 409, "เจ้าหน้าที่ที่เลือกเป็นครูของโรงเรียนนี้แล้ว");
    // Employee code and phone belong to one person, so they apply only when a
    // single teacher is added.
    const single = v.user_ids.length === 1;
    const ids = [];
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      for (const userId of toAdd) {
        ids.push(
          await upsertSchoolTeacher(connection, {
            schoolId: v.school_id,
            userId,
            teacherTypeId: v.teacher_type_id,
            employeeCode: single ? v.employee_code : null,
            position: v.position,
            phoneEncrypted:
              single && v.phone
                ? require("../utils/privateField").writeField(
                    v.phone,
                    "school_teachers",
                    "phone_encrypted",
                    req.organizationContext,
                  )
                : null,
            status: v.status,
          }),
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    await audit(req, {
      action: "school.create",
      targetType: "teacher",
      targetId: v.school_id,
      after: { school_id: v.school_id, user_ids: toAdd, skipped },
    });
    res.status(201).json({ id: ids[0], ids, skipped });
  },
);

router.put(
  "/teachers/:id",
  allow((a) => a.canUpdateSchool),
  async (req, res) => {
    const teacher = await teacherInOrganization(req, req.params.id);
    if (!teacher) return fail(res, 404, "ไม่พบครู");
    const payload = await teacherPayload(req, req.body, {
      creating: false,
      currentTypeId: teacher.teacher_type_id,
    });
    if (payload.error) return fail(res, 422, payload.error);
    const v = payload.value;
    await db.query(
      "UPDATE school_teachers SET teacher_type_id = ?, employee_code = ?, position = ?, phone_encrypted = ?, status = ? WHERE id = ?",
      [
        v.teacher_type_id,
        v.employee_code,
        v.position,
        v.phone
          ? require("../utils/privateField").writeField(
              v.phone,
              "school_teachers",
              "phone_encrypted",
              req.organizationContext,
            )
          : null,
        v.status,
        teacher.id,
      ],
    );
    await audit(req, {
      action: "school.update",
      targetType: "teacher",
      targetId: teacher.id,
      after: { teacher_type_id: v.teacher_type_id, status: v.status },
    });
    res.json({ success: true });
  },
);

router.delete(
  "/teachers/:id",
  allow((a) => a.canDeleteSchool),
  async (req, res) => {
    const teacher = await teacherInOrganization(req, req.params.id);
    if (!teacher) return fail(res, 404, "ไม่พบครู");
    await deactivateSchoolTeacher(db, {
      schoolId: teacher.school_id,
      userId: teacher.user_id,
    });
    await audit(req, {
      action: "school.delete",
      targetType: "teacher",
      targetId: teacher.id,
      before: { school_id: teacher.school_id, user_id: teacher.user_id },
    });
    res.json({ success: true });
  },
);

// ── Students ─────────────────────────────────────────────────────────────
const STUDENT_SELECT = `
  SELECT ss.*, s.name AS school_name, s.code AS school_code,
         c.name AS classroom_name, c.academic_year, c.grade_level_id,
         g.name AS grade_name, g.level_order, sty.name AS student_type_name, mo.label AS status_label,
         pa.username, pa.status AS account_status, pa.must_change_password
    FROM school_students ss
    JOIN schools s ON s.id = ss.school_id
    LEFT JOIN school_classrooms c ON c.id = ss.classroom_id
    LEFT JOIN school_grade_levels g ON g.id = c.grade_level_id
    -- MySQL 8.4 defaults new tables to 0900_ai_ci while imported school
    -- tables can use unicode_ci. Stable codes must compare identically
    -- regardless of either table's collation.
    LEFT JOIN master_data_options mo ON mo.organization_id=s.organization_id AND mo.category='student_status' AND mo.code COLLATE utf8mb4_bin=ss.status COLLATE utf8mb4_bin
    LEFT JOIN school_student_types sty ON sty.id = ss.student_type_id
    LEFT JOIN patient_accounts pa ON pa.id = ss.patient_account_id`;

const publicStudent = (row, org) => ({
  id: row.id,
  school_id: row.school_id,
  school_name: row.school_name,
  school_code: row.school_code,
  classroom_id: row.classroom_id,
  classroom_name: row.classroom_name || null,
  academic_year: row.academic_year || null,
  grade_level_id: row.grade_level_id || null,
  grade_name: row.grade_name || null,
  student_type_id: row.student_type_id,
  student_type_name: row.student_type_name || null,
  student_code: row.student_code,
  prefix: row.prefix,
  first_name: require("../utils/privateField").readField(
    row.first_name_encrypted,
    "school_students",
    "first_name_encrypted",
    org,
  ),
  last_name: require("../utils/privateField").readField(
    row.last_name_encrypted,
    "school_students",
    "last_name_encrypted",
    org,
  ),
  nickname: require("../utils/privateField").readField(
    row.nickname_encrypted,
    "school_students",
    "nickname_encrypted",
    org,
  ),
  gender: row.gender,
  birth_date:
    require("../utils/privateField").readField(
      row.birth_date_encrypted,
      "school_students",
      "birth_date_encrypted",
      org,
    ) || null,
  status: row.status,
  is_boarder: Boolean(Number(row.is_boarder || 0)),
  graduated_on: dateOnly(row.graduated_on),
  status_label:
    row.status_label ||
    require("../utils/studentStatus").labels[row.status] ||
    row.status,
  person_id: row.person_id,
  patient_account_id: row.patient_account_id,
  username: row.username || null,
  account_status: row.account_status || null,
  must_change_password: Boolean(Number(row.must_change_password || 0)),
});

const fullName = (student) =>
  [student.prefix, student.first_name, student.last_name]
    .filter(Boolean)
    .join(" ");

// Students the caller may see, filtered in SQL by structure and in memory by
// name (names are encrypted at rest).
async function scopedStudents(req, filters = {}) {
  const where = ["s.organization_id = ?", "ss.archived_at IS NULL"];
  const params = [req.organizationContext];
  const add = (sql, value) => {
    where.push(sql);
    params.push(value);
  };
  if (positiveId(filters.school_id))
    add("ss.school_id = ?", positiveId(filters.school_id));
  if (positiveId(filters.grade_id))
    add("c.grade_level_id = ?", positiveId(filters.grade_id));
  if (positiveId(filters.classroom_id))
    add("ss.classroom_id = ?", positiveId(filters.classroom_id));
  if (positiveId(filters.student_type_id))
    add("ss.student_type_id = ?", positiveId(filters.student_type_id));
  if (["0", "1"].includes(String(filters.is_boarder)))
    add("ss.is_boarder = ?", Number(filters.is_boarder));
  if (STUDENT_STATUSES.includes(filters.status))
    add("ss.status = ?", filters.status);
  const scope = studentScopeClause(req.schoolAccess, "ss");
  const [rows] = await db.query(
    `${STUDENT_SELECT} WHERE ${where.join(" AND ")}${scope.sql}
      ORDER BY s.name, g.level_order, g.name, c.name, ss.student_code`,
    [...params, ...scope.params],
  );
  const students = rows.map((row) =>
    publicStudent(row, req.organizationContext),
  );
  const search = text(filters.search).toLowerCase();
  if (!search) return students;
  return students.filter((student) =>
    [
      student.student_code,
      student.first_name,
      student.last_name,
      student.nickname,
      student.username,
      fullName(student),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search)),
  );
}

function paginate(items, query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(200, Math.max(10, Number(query.limit) || 20));
  return {
    data: items.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: items.length,
      total_pages: Math.max(1, Math.ceil(items.length / limit)),
    },
  };
}

async function loadStudent(req, id) {
  const [rows] = await db.query(
    `${STUDENT_SELECT} WHERE ss.id = ? AND s.organization_id = ? LIMIT 1`,
    [positiveId(id), req.organizationContext],
  );
  if (!rows[0] || rows[0].archived_at) return null;
  return {
    raw: rows[0],
    student: publicStudent(rows[0], req.organizationContext),
  };
}

router.get(
  "/students/:id/first-name",
  allow((a) => a.canViewStudents),
  require("../utils/caseFirstName").requirePii,
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (!found || !canSeeStudent(req.schoolAccess, found.raw))
      return fail(res, 404, "ไม่พบนักเรียน");
    res.set("Cache-Control", "no-store");
    res.json({
      first_name: require("../utils/caseFirstName").firstNameOf(
        found.student.first_name,
        true,
      ),
    });
  },
);

router.get(
  "/students/:id/last-name",
  allow((a) => a.canViewStudents),
  require("../utils/caseFirstName").requirePii,
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (!found || !canSeeStudent(req.schoolAccess, found.raw))
      return fail(res, 404, "ไม่พบนักเรียน");
    res.set("Cache-Control", "no-store");
    res.json({
      last_name: require("../utils/caseFirstName").lastNameOf(
        found.student.last_name,
        true,
      ),
    });
  },
);

router.post(
  "/students/export-data",
  allow((a) => a.canExportStudents),
  async (req, res) => {
    if (
      !req.authorization.isSystemAdmin &&
      !req.authorization.permissions.has("pii.view")
    )
      return fail(res, 403, "คุณไม่มีสิทธิ์ส่งออกข้อมูลส่วนบุคคล");
    const ids = req.body?.ids;
    if (
      !Array.isArray(ids) ||
      !ids.length ||
      ids.length > 200 ||
      ids.some((id) => !positiveId(id))
    )
      return fail(res, 422, "เลือกนักเรียน 1–200 คนต่อครั้ง");
    const students = (await scopedStudents(req, {})).filter((student) =>
      ids.map(Number).includes(Number(student.id)),
    );
    if (students.length !== new Set(ids.map(Number)).size)
      return fail(res, 403, "มีนักเรียนที่อยู่นอกขอบเขตสิทธิ์");
    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "students.export",
      "students",
      null,
      { count: students.length, format: "xlsx" },
    );
    res.json({ data: students });
  },
);

router.get(
  "/students",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const mental = require("../services/studentMentalStatus");
    const { mental_from: from, mental_status: wanted } = req.query;
    const to = req.query.mental_to || mental.todayKey();
    if (
      (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      (from && from > to) ||
      (wanted && !mental.MENTAL_STATUSES.includes(wanted))
    )
      return fail(res, 422, "ช่วงเวลาหรือสถานะสุขภาพจิตไม่ถูกต้อง");
    let students = await scopedStudents(req, req.query);
    // The same minimal risk view as the school risk queue: staff who may see
    // risk get each student's latest status in the period, except students
    // only a physical-health admin covers.
    const access = req.schoolAccess;
    const visible = access.canViewRisk
      ? students.filter(
          (s) =>
            !access.physicalSchoolIds?.includes(Number(s.school_id)) ||
            canViewStudentHealth(access, s),
        )
      : [];
    const summaries = await mental.mentalSummaries(
      db,
      req.organizationContext,
      visible,
      { from: from || null, to },
    );
    students = students.map((s) => ({
      ...s,
      mental: summaries.get(Number(s.id)) || null,
    }));
    const counts = Object.fromEntries(
      mental.MENTAL_STATUSES.map((status) => [
        status,
        students.filter((s) => mental.matchesStatus(s.mental, status)).length,
      ]),
    );
    if (wanted)
      students = students.filter((s) => mental.matchesStatus(s.mental, wanted));
    const period = { from: from || null, to, can_view: access.canViewRisk };
    if (req.query.all === "1" && req.schoolAccess.canExportStudents)
      return res.json({
        data: students,
        pagination: null,
        mental_period: period,
        mental_counts: access.canViewRisk ? counts : null,
      });
    res.json({
      ...paginate(students, req.query),
      mental_period: period,
      mental_counts: access.canViewRisk ? counts : null,
    });
  },
);

router.get(
  "/students/:id",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (!found || !canSeeStudent(req.schoolAccess, found.student))
      return fail(res, 404, "ไม่พบนักเรียน");
    const mental = canViewStudentHealth(req.schoolAccess, found.student);
    const physical = canViewPhysicalHealth(req.schoolAccess, found.student);
    res.json({
      ...found.student,
      can_view_health: mental || physical,
      can_update_health: !req.schoolAccess.isGuardian && physical,
      can_view_mental: mental,
      can_view_physical: physical,
    });
  },
);

// Resolves grade/classroom/type names of an import row against a school.
// With createMissing, a missing grade or classroom is created in the
// transaction (connection) of the import.
async function resolveStructure(
  connection,
  { school, row, academicYear, createMissing, cache },
) {
  let studentTypeId = null;
  if (row.student_type) {
    const type = cache.types.get(row.student_type.toLowerCase());
    if (!type)
      return {
        error: `ไม่พบประเภทนักเรียน "${row.student_type}"`,
        creatable: false,
      };
    studentTypeId = type.id;
  }

  const gradeKey = row.grade.toLowerCase();
  let grade = cache.grades.get(gradeKey);
  if (!grade && createMissing) {
    const [created] = await connection.query(
      "INSERT INTO school_grade_levels (school_id, name, level_order) VALUES (?, ?, ?)",
      [school.id, row.grade, cache.grades.size + 1],
    );
    grade = { id: created.insertId, name: row.grade };
    cache.grades.set(gradeKey, grade);
  }
  if (!grade)
    return {
      error: `ไม่พบชั้นปี "${row.grade}" ในโรงเรียนนี้`,
      creatable: true,
    };

  const classroomKey = `${grade.id}|${row.classroom.toLowerCase()}`;
  let classroom = cache.classrooms.get(classroomKey);
  if (!classroom && createMissing) {
    const [created] = await connection.query(
      "INSERT INTO school_classrooms (school_id, grade_level_id, name, academic_year) VALUES (?, ?, ?, ?)",
      [school.id, grade.id, row.classroom, academicYear],
    );
    classroom = { id: created.insertId, name: row.classroom };
    cache.classrooms.set(classroomKey, classroom);
  }
  if (!classroom)
    return {
      error: `ไม่พบห้อง "${row.classroom}" ของชั้น ${row.grade} ปีการศึกษา ${academicYear}`,
      creatable: true,
    };
  return { grade, classroom, studentTypeId };
}

// Whether a new account can be created (or an existing one linked) for a row.
async function accountProblem(connection, row) {
  if (row.email) {
    const [[owner]] = await connection.query(
      "SELECT id FROM patient_accounts WHERE email_hash=? OR (email_hash IS NULL AND email=?)",
      [require("../utils/accountEmail").lookup(row.email), row.email],
    );
    if (owner) {
      if (!row.national_id) return "อีเมลนี้มีบัญชีแล้ว กรุณาตรวจสอบบัญชีเดิม";
      const [[person]] = await connection.query(
        "SELECT id FROM persons WHERE identity_hash=? AND patient_account_id=?",
        [nationalIdHash(row.national_id), owner.id],
      );
      if (!person) return "อีเมลนี้เป็นของบัญชีอื่น กรุณาตรวจสอบข้อมูล";
    }
  }
  const [taken] = await connection.query(
    "SELECT 1 FROM patient_accounts WHERE username = ? LIMIT 1",
    [row.username],
  );
  if (!taken.length) return null;
  if (row.national_id) {
    const [owners] = await connection.query(
      "SELECT 1 FROM persons WHERE identity_hash = ? AND patient_account_id IS NOT NULL LIMIT 1",
      [nationalIdHash(row.national_id)],
    );
    if (owners.length) return null; // the existing account will be linked
  }
  return `ชื่อผู้ใช้ ${row.username} ถูกใช้แล้ว`;
}

async function structureCache(
  connection,
  school,
  organizationId,
  academicYear,
) {
  const [grades] = await connection.query(
    "SELECT id, name FROM school_grade_levels WHERE school_id = ?",
    [school.id],
  );
  const [classrooms] = await connection.query(
    "SELECT id, name, grade_level_id FROM school_classrooms WHERE school_id = ? AND academic_year = ?",
    [school.id, academicYear],
  );
  const [types] = await connection.query(
    "SELECT id, name FROM school_student_types WHERE organization_id = ? AND status = 'active'",
    [organizationId],
  );
  return {
    grades: new Map(grades.map((g) => [g.name.toLowerCase(), g])),
    classrooms: new Map(
      classrooms.map((c) => [`${c.grade_level_id}|${c.name.toLowerCase()}`, c]),
    ),
    types: new Map(types.map((t) => [t.name.toLowerCase(), t])),
  };
}

// Creates or links the student's patient account and person record. Returns
// { accountId, personId, password?, linked } — password only for a new account.
async function provisionAccount(connection, { row, existingAccountId }) {
  if (existingAccountId) {
    const person = await resolvePerson({
      connection,
      patientAccountId: existingAccountId,
      nationalId: row.national_id,
    });
    return {
      accountId: existingAccountId,
      personId: person.personId,
      linked: true,
    };
  }
  // A student who already has an account (same national ID) keeps it.
  if (row.national_id) {
    const person = await resolvePerson({
      connection,
      nationalId: row.national_id,
    });
    const [owners] = await connection.query(
      "SELECT pa.id FROM patient_accounts pa JOIN persons p ON p.patient_account_id = pa.id WHERE p.id = ? LIMIT 1",
      [person.personId],
    );
    if (owners[0])
      return {
        accountId: owners[0].id,
        personId: person.personId,
        linked: true,
      };
  }
  const [taken] = await connection.query(
    "SELECT 1 FROM patient_accounts WHERE username = ? LIMIT 1",
    [row.username],
  );
  if (taken.length) {
    const error = new Error(`ชื่อผู้ใช้ ${row.username} ถูกใช้แล้ว`);
    error.rowError = true;
    throw error;
  }
  const password = row.initial_password || generateTemporaryPassword();
  const [created] = await connection.query(
    `INSERT INTO patient_accounts
       (username, password_hash, first_name_encrypted, last_name_encrypted, email_encrypted, email_hash, status, verified_at, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 'active', NOW(), 1)`,
    [
      row.username,
      await bcrypt.hash(password, TEMP_PASSWORD_COST),
      require("../utils/privateField").writeField(
        row.first_name,
        "patient_accounts",
        "first_name_encrypted",
      ),
      require("../utils/privateField").writeField(
        row.last_name,
        "patient_accounts",
        "last_name_encrypted",
      ),
      require("../utils/accountEmail").encode(row.email, "patient_accounts"),
      row.email ? require("../utils/accountEmail").lookup(row.email) : null,
    ],
  );
  const person = await resolvePerson({
    connection,
    patientAccountId: created.insertId,
    nationalId: row.national_id,
  });
  return {
    accountId: created.insertId,
    personId: person.personId,
    password,
    linked: false,
  };
}

const studentValues = (row, { classroomId, studentTypeId, organizationId }) => [
  classroomId,
  studentTypeId,
  row.prefix,
  require("../utils/privateField").writeField(
    row.first_name,
    "school_students",
    "first_name_encrypted",
    organizationId,
  ),
  require("../utils/privateField").writeField(
    row.last_name,
    "school_students",
    "last_name_encrypted",
    organizationId,
  ),
  row.nickname
    ? require("../utils/privateField").writeField(
        row.nickname,
        "school_students",
        "nickname_encrypted",
        organizationId,
      )
    : null,
  row.gender,
  row.birth_date
    ? require("../utils/privateField").writeField(
        row.birth_date,
        "school_students",
        "birth_date_encrypted",
        organizationId,
      )
    : null,
];

// Imports up to MAX_IMPORT_ROWS rows. dry_run validates everything and writes
// nothing. Each applied batch is one transaction. The response lists every
// row with its outcome; new temporary passwords appear only in this response.
router.post(
  "/students/import",
  allow((a) => a.canCreateStudents),
  need("pii.create"),
  async (req, res) => {
    const {
      school_id: schoolId,
      rows,
      dry_run: dryRun = true,
      on_duplicate: onDuplicate = "skip",
      create_missing: createMissing = false,
      academic_year: academicYearInput,
      row_offset: rowOffset = 0,
    } = req.body || {};
    const school = await schoolInOrganization(req, schoolId);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    if (!Array.isArray(rows) || !rows.length)
      return fail(res, 422, "ไม่มีข้อมูลนักเรียนในไฟล์");
    if (rows.length > MAX_IMPORT_ROWS)
      return fail(res, 422, `ส่งได้ครั้งละไม่เกิน ${MAX_IMPORT_ROWS} แถว`);
    if (!["skip", "update"].includes(onDuplicate))
      return fail(res, 422, "ตัวเลือกเมื่อพบข้อมูลซ้ำไม่ถูกต้อง");
    const academicYear = Number(academicYearInput);
    if (!validAcademicYear(academicYearInput))
      return fail(
        res,
        422,
        `ปีการศึกษาต้องเป็น พ.ศ. 4 หลัก ย้อนหลังได้ไม่เกิน 10 ปี (ตั้งแต่ ${currentAcademicYear() - 10})`,
      );
    if (!(await registeredAcademicYear(school.id, academicYear)))
      return fail(res, 422, "กรุณาเพิ่มปีการศึกษาในข้อมูลหลักก่อน");
    if (onDuplicate === "update" && !req.schoolAccess.canUpdateStudents)
      return fail(res, 403, "ไม่มีสิทธิ์แก้ไขข้อมูลนักเรียนเดิม");

    const results = [];
    const seenCodes = new Set();
    const seenUsernames = new Set();
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const cache = await structureCache(
        connection,
        school,
        req.organizationContext,
        academicYear,
      );
      for (let index = 0; index < rows.length; index += 1) {
        const rowNumber = Number(rowOffset) + index + 1;
        const { row, errors } = prepareImportRow(rows[index], {
          schoolCode: school.code,
        });
        const result = {
          row: rowNumber,
          student_code: row.student_code,
          name: [row.prefix, row.first_name, row.last_name]
            .filter(Boolean)
            .join(" "),
          grade: row.grade,
          classroom: row.classroom,
          username: row.username,
          status: "error",
          errors,
        };
        results.push(result);
        if (row.student_code && seenCodes.has(row.student_code.toLowerCase()))
          errors.push("รหัสนักเรียนซ้ำกับแถวอื่นในไฟล์");
        if (row.username && seenUsernames.has(row.username))
          errors.push("ชื่อผู้ใช้ซ้ำกับแถวอื่นในไฟล์");
        seenCodes.add(row.student_code.toLowerCase());
        if (row.username) seenUsernames.add(row.username);
        if (errors.length) continue;

        const structure = await resolveStructure(connection, {
          school,
          row,
          academicYear,
          createMissing: Boolean(createMissing) && !dryRun,
          cache,
        });
        if (structure.error) {
          // A dry run never writes: a grade or room that the import would
          // create is reported as such instead of as an error.
          if (!(dryRun && createMissing && structure.creatable)) {
            errors.push(structure.error);
            continue;
          }
          result.notes = ["จะสร้างชั้นปี/ห้องที่ยังไม่มีให้อัตโนมัติ"];
        }

        const [existing] = await connection.query(
          "SELECT id, patient_account_id, status, classroom_id FROM school_students WHERE school_id = ? AND student_code = ? LIMIT 1",
          [school.id, row.student_code],
        );
        if (existing[0] && onDuplicate === "skip") {
          result.status = "skipped";
          result.notes = ["มีนักเรียนรหัสนี้อยู่แล้ว (ข้าม)"];
          continue;
        }
        if (!existing[0]?.patient_account_id) {
          const problem = await accountProblem(connection, row);
          if (problem) {
            errors.push(problem);
            continue;
          }
        }
        if (dryRun) {
          result.status = existing[0] ? "will_update" : "will_create";
          continue;
        }

        await connection.query("SAVEPOINT import_row");
        try {
          const account = await provisionAccount(connection, {
            row,
            existingAccountId: existing[0]?.patient_account_id || null,
          });
          const values = studentValues(row, {
            organizationId: req.organizationContext,
            classroomId: structure.classroom.id,
            studentTypeId: structure.studentTypeId,
          });
          if (existing[0]) {
            await connection.query(
              `UPDATE school_students SET classroom_id = ?, student_type_id = ?, prefix = ?, first_name_encrypted = ?,
                      last_name_encrypted = ?, nickname_encrypted = ?, gender = ?, birth_date_encrypted = ?,
                      person_id = ?, patient_account_id = ?, status = ?
                WHERE id = ?`,
              [
                ...values,
                account.personId,
                account.accountId,
                row.status || existing[0].status,
                existing[0].id,
              ],
            );
            result.status = "updated";
          } else {
            await connection.query(
              `INSERT INTO school_students (classroom_id, student_type_id, prefix, first_name_encrypted, last_name_encrypted,
                      nickname_encrypted, gender, birth_date_encrypted, school_id, student_code, person_id, patient_account_id, created_by, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                ...values,
                school.id,
                row.student_code,
                account.personId,
                account.accountId,
                req.user.id,
                row.status || "active",
              ],
            );
            result.status = account.linked ? "linked" : "created";
          }
          await connection.query(
            "UPDATE school_students SET is_boarder=COALESCE(?,is_boarder) WHERE school_id=? AND student_code=?",
            [row.is_boarder, school.id, row.student_code],
          );
          if (
            existing[0] &&
            Number(existing[0].classroom_id) !== Number(structure.classroom.id)
          )
            await connection.query(
              "INSERT INTO school_enrollment_history (student_id,from_classroom_id,to_classroom_id,changed_by) VALUES (?,?,?,?)",
              [
                existing[0].id,
                existing[0].classroom_id,
                structure.classroom.id,
                req.user.id,
              ],
            );
          if (account.password) result.password = account.password;
          else if (account.linked) {
            const [[linked]] = await connection.query(
              "SELECT username FROM patient_accounts WHERE id = ?",
              [account.accountId],
            );
            result.username = linked?.username || result.username;
            result.notes = ["ใช้บัญชีเดิมของนักเรียน (รหัสผ่านเดิม)"];
          }
          await connection.query("RELEASE SAVEPOINT import_row");
        } catch (error) {
          await connection.query("ROLLBACK TO SAVEPOINT import_row");
          if (
            error.rowError ||
            error instanceof PersonIdentityConflictError ||
            duplicate(error)
          ) {
            result.status = "error";
            errors.push(
              duplicate(error)
                ? "ข้อมูลซ้ำกับนักเรียนหรือบัญชีที่มีอยู่"
                : error.message,
            );
            continue;
          }
          throw error;
        }
      }
      if (dryRun) await connection.rollback();
      else await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const summary = results.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    if (!dryRun)
      await audit(req, {
        action: "students.create",
        targetType: "student_import",
        targetId: school.id,
        after: { rows: rows.length, summary, on_duplicate: onDuplicate },
      });
    res.json({ dry_run: Boolean(dryRun), summary, results });
  },
);

// Single student, created through the same rules as an import row.
router.post(
  "/students",
  allow((a) => a.canCreateStudents),
  need("pii.create"),
  async (req, res) => {
    const body = req.body || {};
    const school = await schoolInOrganization(req, body.school_id);
    if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
    const classroom = await classroomInOrganization(req, body.classroom_id);
    if (!classroom || classroom.school_id !== school.id)
      return fail(res, 422, "กรุณาเลือกห้องเรียนของโรงเรียนนี้");
    const type = await typeInOrganization(
      req,
      "school_student_types",
      body.student_type_id,
    );
    if (!type) return fail(res, 422, "ประเภทนักเรียนไม่ถูกต้อง");
    const { row, errors } = prepareImportRow(
      { ...body, grade: "-", classroom: classroom.name },
      { schoolCode: school.code },
    );
    if (body.gender && !GENDERS.includes(body.gender))
      errors.push("เพศไม่ถูกต้อง");
    if (errors.length) return fail(res, 422, errors.join(", "));
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const account = await provisionAccount(connection, {
        row,
        existingAccountId: null,
      });
      const [created] = await connection.query(
        `INSERT INTO school_students (classroom_id, student_type_id, prefix, first_name_encrypted, last_name_encrypted,
                nickname_encrypted, gender, birth_date_encrypted, school_id, student_code, person_id, patient_account_id, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ...studentValues(
            { ...row, gender: body.gender || row.gender },
            {
              classroomId: classroom.id,
              studentTypeId: type.id,
              organizationId: req.organizationContext,
            },
          ),
          school.id,
          row.student_code,
          account.personId,
          account.accountId,
          req.user.id,
          row.status || "active",
        ],
      );
      await connection.commit();
      await audit(req, {
        action: "students.create",
        targetType: "student",
        targetId: created.insertId,
        after: { school_id: school.id, student_code: row.student_code },
      });
      const [[linked]] = await db.query(
        "SELECT username FROM patient_accounts WHERE id = ?",
        [account.accountId],
      );
      res.status(201).json({
        id: created.insertId,
        username: linked?.username,
        password: account.password || null,
        linked: account.linked,
      });
    } catch (error) {
      await connection.rollback();
      if (error.rowError || error instanceof PersonIdentityConflictError)
        return fail(res, 409, error.message);
      if (duplicate(error))
        return fail(res, 409, "รหัสนักเรียนนี้มีอยู่แล้วในโรงเรียน");
      throw error;
    } finally {
      connection.release();
    }
  },
);

router.put(
  "/students/:id",
  allow((a) => a.canUpdateStudents),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (
      !found ||
      !canSeeStudent(req.schoolAccess, found.student) ||
      !canWriteSchool(req, found.student.school_id)
    )
      return fail(res, 404, "ไม่พบนักเรียน");
    const body = req.body || {};
    // Names need pii.update; moving to another classroom is students -> assign.
    const identityChanged = [
      "prefix",
      "first_name",
      "last_name",
      "nickname",
    ].some(
      (key) =>
        body[key] !== undefined &&
        String(body[key] ?? "").trim() !==
          String(found.student[key] ?? "").trim(),
    );
    if (identityChanged && denyUnless(req, res, "pii.update")) return;
    if (
      body.classroom_id !== undefined &&
      Number(body.classroom_id || 0) !==
        Number(found.student.classroom_id || 0) &&
      !(req.schoolAccess.isSystemAdmin || req.schoolAccess.canAssignStudents)
    )
      return fail(res, 403, "ไม่มีสิทธิ์ย้ายห้องเรียนของนักเรียน");
    const classroom = body.classroom_id
      ? await classroomInOrganization(req, body.classroom_id)
      : null;
    if (
      body.classroom_id &&
      (!classroom || classroom.school_id !== found.raw.school_id)
    )
      return fail(res, 422, "ห้องเรียนไม่อยู่ในโรงเรียนนี้");
    const type =
      body.student_type_id === undefined
        ? { id: found.student.student_type_id }
        : await typeInOrganization(
            req,
            "school_student_types",
            body.student_type_id,
            found.student.student_type_id,
          );
    if (!type) return fail(res, 422, "ประเภทนักเรียนไม่ถูกต้อง");
    const classroomId =
      body.classroom_id === undefined
        ? found.student.classroom_id
        : classroom?.id || null;
    const status = body.status || found.student.status;
    if (
      !CURRENT_STUDENT_STATUSES.includes(status) &&
      status !== found.student.status
    )
      return fail(res, 422, "สถานะนักเรียนไม่ถูกต้อง");
    const { row, errors } = prepareImportRow(
      {
        ...body,
        status: CURRENT_STUDENT_STATUSES.includes(status) ? status : undefined,
        student_code: found.student.student_code,
        grade: "-",
        classroom: "-",
        username: found.student.username || "keep",
      },
      { schoolCode: found.raw.school_code },
    );
    if (body.gender && !GENDERS.includes(body.gender))
      errors.push("เพศไม่ถูกต้อง");
    if (errors.length) return fail(res, 422, errors.join(", "));
    const enrollmentConnection = await db.getConnection();
    try {
      await enrollmentConnection.beginTransaction();
      await enrollmentConnection.query(
        `UPDATE school_students SET classroom_id = ?, student_type_id = ?, prefix = ?, first_name_encrypted = ?,
              last_name_encrypted = ?, nickname_encrypted = ?, gender = ?, birth_date_encrypted = ?, status = ?
        WHERE id = ?`,
        [
          ...studentValues(
            { ...row, gender: body.gender || row.gender },
            {
              classroomId,
              studentTypeId: type.id,
              organizationId: req.organizationContext,
            },
          ),
          status,
          found.student.id,
        ],
      );
      if (Number(classroomId) !== Number(found.student.classroom_id))
        await enrollmentConnection.query(
          "INSERT INTO school_enrollment_history (student_id,from_classroom_id,to_classroom_id,changed_by) VALUES (?,?,?,?)",
          [
            found.student.id,
            found.student.classroom_id,
            classroomId,
            req.user.id,
          ],
        );
      await enrollmentConnection.commit();
    } catch (error) {
      await enrollmentConnection.rollback();
      throw error;
    } finally {
      enrollmentConnection.release();
    }
    await audit(req, {
      action: "students.update",
      targetType: "student",
      targetId: found.student.id,
      before: {
        classroom_id: found.student.classroom_id,
        status: found.student.status,
      },
      after: { classroom_id: classroomId, status },
    });
    res.json({ success: true });
  },
);

// The existing deactivate action disables sign-in and preserves enrollment and history.
router.delete(
  "/students/:id",
  allow((a) => a.canDeleteStudents),
  need("pii.delete"),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (
      !found ||
      !canSeeStudent(req.schoolAccess, found.student) ||
      !canWriteSchool(req, found.student.school_id)
    )
      return fail(res, 404, "ไม่พบนักเรียน");
    // Enrollment state does not control whether a linked account can sign in.
    if (found.student.patient_account_id)
      await db.query(
        "UPDATE patient_accounts SET status = 'disabled', token_version = token_version + 1 WHERE id = ?",
        [found.student.patient_account_id],
      );
    await audit(req, {
      action: "students.delete",
      targetType: "student",
      targetId: found.student.id,
      before: { account_status: found.student.account_status },
      after: { account_disabled: Boolean(found.student.patient_account_id) },
    });
    res.json({ success: true });
  },
);

router.post(
  "/students/:id/reset-password",
  allow((a) => a.canUpdateStudents),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (
      !found ||
      !canSeeStudent(req.schoolAccess, found.student) ||
      !canWriteSchool(req, found.student.school_id)
    )
      return fail(res, 404, "ไม่พบนักเรียน");
    if (!found.student.patient_account_id)
      return fail(res, 409, "นักเรียนคนนี้ยังไม่มีบัญชีผู้ใช้");
    const password = generateTemporaryPassword();
    await db.query(
      "UPDATE patient_accounts SET password_hash = ?, must_change_password = 1, status = 'active', failed_login_count = 0, locked_until = NULL, token_version = token_version + 1, auth_version = auth_version + 1 WHERE id = ?",
      [
        await bcrypt.hash(password, TEMP_PASSWORD_COST),
        found.student.patient_account_id,
      ],
    );
    await audit(req, {
      action: "students.update",
      targetType: "student_password_reset",
      targetId: found.student.id,
    });
    res.json({ username: found.student.username, password });
  },
);

// ── Health ───────────────────────────────────────────────────────────────
const toNumber = (value, { min, max, digits = 1 } = {}) => {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max)
    return undefined;
  return Number(number.toFixed(digits));
};

function computeBmi(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const meters = heightCm / 100;
  return Number((weightKg / (meters * meters)).toFixed(1));
}

// Files every assessment under the semester and class it was taken in (so a
// student's record reads from first enrollment to graduation, across class
// changes) and returns the care steps recorded for the student, newest first.
async function mentalTimeline(req, student, assessments) {
  const mental = require("../services/studentMentalStatus");
  const [terms, history, care] = await Promise.all([
    mental.loadTerms(db, [student.school_id]),
    mental.loadEnrollmentHistory(db, [student.id]),
    mental.loadCareEvents(db, [student.id]),
  ]);
  const schoolTerms = terms.get(Number(student.school_id));
  const events = care.get(student.id) || [];
  const roomOf = new Map(
    assessments.map((a) => [
      a.id,
      mental.classroomAt(
        a.submitted_at,
        history.get(student.id),
        student.classroom_id,
      ),
    ]),
  );
  const rooms = await mental.loadClassrooms(db, [
    ...roomOf.values(),
    ...events.map((e) => e.classroom_id),
  ]);
  const roomLabel = (id) => {
    const room = rooms.get(Number(id));
    return room ? `${room.grade_name || ""} ห้อง ${room.name}`.trim() : null;
  };
  for (const a of assessments) {
    const term = mental.termOf(mental.dateKey(a.submitted_at), schoolTerms);
    Object.assign(a, {
      academic_year: term.academic_year,
      semester: term.semester,
      term_label: mental.termLabel(term),
      classroom_label: roomLabel(roomOf.get(a.id)),
    });
  }
  const { readJson, fieldContext } = require("../utils/privateData");
  const [users] = events.length
    ? await db.query("SELECT id,username FROM users WHERE id IN (?)", [
        [...new Set(events.map((e) => e.created_by))],
      ])
    : [[]];
  const names = new Map(users.map((u) => [u.id, u.username]));
  return [...events].reverse().map((e) => {
    const term = {
      academic_year: e.academic_year,
      semester: e.semester,
    };
    const payload = e.payload_encrypted
      ? readJson(
          e.payload_encrypted,
          fieldContext(
            "school_student_care_statuses",
            "payload_encrypted",
            req.organizationContext,
          ),
        )
      : null;
    return {
      id: e.id,
      status: e.status,
      effective_on: mental.dateKey(e.effective_on),
      academic_year: e.academic_year,
      semester: e.semester,
      term_label: mental.termLabel(term),
      classroom_label: roomLabel(e.classroom_id),
      note: payload?.note || "",
      recorded_by: names.get(e.created_by) || null,
      recorded_at: e.created_at,
    };
  });
}

async function assessmentsOf(req, student) {
  if (!student.person_id && !student.patient_account_id) return [];
  const [rows] = await db.query(
    `SELECT fr.id, fr.organization_id, fr.form_id, fr.submitted_at, fr.summary_data, fr.risk_level, fr.status,
            f.title AS form_title, f.health_domain, f.clinic_type
       FROM form_responses fr JOIN forms f ON f.id = fr.form_id
      WHERE (fr.person_id = ? OR (fr.person_id IS NULL AND fr.patient_account_id = ?))
        AND fr.organization_id = ?
      ORDER BY fr.submitted_at DESC, fr.id DESC`,
    [
      student.person_id || 0,
      student.patient_account_id || 0,
      req.organizationContext,
    ],
  );
  return rows.map((row) => {
    const record = decryptCaseResponse(
      row,
      (value) => safeDecrypt(value) || value,
    );
    const scoreResults = scoreResultsOf(record.summary_data);
    return {
      id: row.id,
      form_id: row.form_id,
      form_title: row.form_title,
      health_domain: row.health_domain || null,
      clinic_type: row.clinic_type,
      submitted_at: row.submitted_at,
      status: row.status,
      risk:
        record.summary_data?.school_risk_override?.level ||
        riskLevelOf(scoreResults),
      score_results: scoreResults,
    };
  });
}

router.get(
  "/students/:id/health",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (
      !found ||
      !(
        canViewStudentHealth(req.schoolAccess, found.student) ||
        canViewPhysicalHealth(req.schoolAccess, found.student)
      )
    )
      return fail(res, 404, "ไม่พบข้อมูลสุขภาพของนักเรียน");
    const [profiles] = await db.query(
      "SELECT * FROM school_student_health_profiles WHERE student_id = ?",
      [found.student.id],
    );
    const profile = profiles[0];
    const [records] = await db.query(
      "SELECT * FROM school_student_physical_records WHERE student_id = ? ORDER BY measured_at DESC, id DESC",
      [found.student.id],
    );
    const mental = canViewStudentHealth(req.schoolAccess, found.student);
    const physical = canViewPhysicalHealth(req.schoolAccess, found.student);
    const assessments = (await assessmentsOf(req, found.student)).filter((a) =>
      a.health_domain === "physical" ? physical : mental,
    );
    const careHistory = mental
      ? await mentalTimeline(req, found.student, assessments)
      : [];
    const activities = mental
      ? await require("../services/latestActivity").schoolActivities(
          db,
          req.organizationContext,
          [found.student],
        )
      : new Map();
    res.json({
      latest_activity: activities.get(found.student.id) || null,
      student: found.student,
      // Per-action health rights from the roles page, within physical scope.
      can_update: canHealthAction(
        req.schoolAccess,
        "update",
        found.student,
        true,
      ),
      can_create: canHealthAction(
        req.schoolAccess,
        "create",
        found.student,
        true,
      ),
      can_delete: canHealthAction(
        req.schoolAccess,
        "delete",
        found.student,
        true,
      ),
      can_view_mental: mental,
      can_view_physical: physical,
      // Recording a care step is a health update on the roles page.
      can_set_care_status:
        mental &&
        canHealthAction(req.schoolAccess, "update", found.student, false),
      // Guardians see the care steps but not staff notes or who wrote them.
      care_statuses: req.schoolAccess.isGuardian
        ? careHistory.map(({ note, recorded_by, ...step }) => step)
        : careHistory,
      profile: {
        blood_type: bloodType(profile, req.organizationContext),
        chronic_conditions: require("../utils/privateField").readField(
          profile?.chronic_conditions_encrypted,
          "school_student_health_profiles",
          "chronic_conditions_encrypted",
          req.organizationContext,
        ),
        allergies: require("../utils/privateField").readField(
          profile?.allergies_encrypted,
          "school_student_health_profiles",
          "allergies_encrypted",
          req.organizationContext,
        ),
        medications: require("../utils/privateField").readField(
          profile?.medications_encrypted,
          "school_student_health_profiles",
          "medications_encrypted",
          req.organizationContext,
        ),
        emergency_contact_name: require("../utils/privateField").readField(
          profile?.emergency_contact_name_encrypted,
          "school_student_health_profiles",
          "emergency_contact_name_encrypted",
          req.organizationContext,
          safeDecrypt,
        ),
        emergency_contact_phone: require("../utils/privateField").readField(
          profile?.emergency_contact_phone_encrypted,
          "school_student_health_profiles",
          "emergency_contact_phone_encrypted",
          req.organizationContext,
          safeDecrypt,
        ),
        notes: require("../utils/privateField").readField(
          profile?.notes_encrypted,
          "school_student_health_profiles",
          "notes_encrypted",
          req.organizationContext,
        ),
        updated_at: profile?.updated_at || null,
      },
      physical_records: records
        .map((row) => physicalRecord(row, req.organizationContext))
        .map(({ note_encrypted, ...record }) => ({
          ...record,
          measured_at: dateOnly(record.measured_at),
          weight_kg:
            record.weight_kg === null ? null : Number(record.weight_kg),
          height_cm:
            record.height_cm === null ? null : Number(record.height_cm),
          bmi: record.bmi === null ? null : Number(record.bmi),
          note: record.note || "",
        })),
      assessments: {
        mental: assessments.filter((a) => a.health_domain === "mental"),
        physical: assessments.filter((a) => a.health_domain === "physical"),
        other: assessments.filter(
          (a) => !["mental", "physical"].includes(a.health_domain),
        ),
      },
    });
  },
);

router.put(
  "/students/:id/health-profile",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (
      !found ||
      !canHealthAction(req.schoolAccess, "update", found.student, true)
    )
      return fail(res, 403, "คุณไม่มีสิทธิ์บันทึกข้อมูลสุขภาพของนักเรียนคนนี้");
    const body = req.body || {};
    const bloodType = body.blood_type || "unknown";
    if (!BLOOD_TYPES.includes(bloodType))
      return fail(res, 422, "กรุ๊ปเลือดไม่ถูกต้อง");
    const secret = (value, field, max = 2000) => {
      const clean = text(value).slice(0, max);
      return clean
        ? require("../utils/privateField").writeField(
            clean,
            "school_student_health_profiles",
            field,
            req.organizationContext,
          )
        : null;
    };
    await db.query(
      `INSERT INTO school_student_health_profiles
         (student_id, blood_type, health_payload_encrypted, chronic_conditions_encrypted, allergies_encrypted, medications_encrypted,
          emergency_contact_name_encrypted, emergency_contact_phone_encrypted, notes_encrypted, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE health_payload_encrypted=VALUES(health_payload_encrypted), blood_type = VALUES(blood_type),
         chronic_conditions_encrypted = VALUES(chronic_conditions_encrypted),
         allergies_encrypted = VALUES(allergies_encrypted),
         medications_encrypted = VALUES(medications_encrypted),
         notes_encrypted = VALUES(notes_encrypted),
         updated_by = VALUES(updated_by)`,
      [
        found.student.id,
        "unknown",
        sealText(
          { blood_type: bloodType },
          fieldContext(
            "school_student_health_profiles",
            "health",
            req.organizationContext,
          ),
        ),
        secret(body.chronic_conditions, "chronic_conditions_encrypted"),
        secret(body.allergies, "allergies_encrypted"),
        secret(body.medications, "medications_encrypted"),
        // Emergency contacts are edited with the student's contacts
        // (PUT /students/:id/contacts), so a health save leaves them as is.
        null,
        null,
        secret(body.notes, "notes_encrypted"),
        req.user.id,
      ],
    );
    await audit(req, {
      action: "student_health.update",
      targetType: "student_health_profile",
      targetId: found.student.id,
    });
    res.json({ success: true });
  },
);

function physicalPayload(body = {}) {
  const measuredAt = text(body.measured_at);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt))
    return { error: "กรุณาระบุวันที่ตรวจ" };
  if (new Date(measuredAt) > new Date())
    return { error: "วันที่ตรวจต้องไม่เกินวันนี้" };
  const value = {
    measured_at: measuredAt,
    weight_kg: toNumber(body.weight_kg, { min: 1, max: 300, digits: 2 }),
    height_cm: toNumber(body.height_cm, { min: 30, max: 250, digits: 1 }),
    systolic: toNumber(body.systolic, { min: 40, max: 260, digits: 0 }),
    diastolic: toNumber(body.diastolic, { min: 20, max: 200, digits: 0 }),
    pulse: toNumber(body.pulse, { min: 20, max: 250, digits: 0 }),
    vision_left: optionalText(body.vision_left, 10),
    vision_right: optionalText(body.vision_right, 10),
    hearing_left: body.hearing_left || "not_tested",
    hearing_right: body.hearing_right || "not_tested",
    note: optionalText(body.note, 2000),
    fitness: optionalText(body.fitness, 4000),
  };
  const invalid = Object.entries({
    weight_kg: "น้ำหนัก",
    height_cm: "ส่วนสูง",
    systolic: "ความดันตัวบน",
    diastolic: "ความดันตัวล่าง",
    pulse: "ชีพจร",
  }).find(([key]) => value[key] === undefined);
  if (invalid) return { error: `ค่า${invalid[1]}ไม่อยู่ในช่วงที่เป็นไปได้` };
  if (
    !HEARING.includes(value.hearing_left) ||
    !HEARING.includes(value.hearing_right)
  )
    return { error: "ผลการได้ยินไม่ถูกต้อง" };
  const measured = [
    "weight_kg",
    "height_cm",
    "systolic",
    "diastolic",
    "pulse",
    "vision_left",
    "vision_right",
  ].some((key) => value[key] !== null);
  if (
    !measured &&
    !value.fitness &&
    value.hearing_left === "not_tested" &&
    value.hearing_right === "not_tested"
  )
    return { error: "กรุณากรอกผลการตรวจอย่างน้อย 1 รายการ" };
  value.bmi = computeBmi(value.weight_kg, value.height_cm);
  return { value };
}

const physicalColumns = (v, org) => [
  v.measured_at,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  v.note
    ? require("../utils/privateField").writeField(
        v.note,
        "school_student_physical_records",
        "note_encrypted",
        org,
      )
    : null,
  encodeMeasurements(v, org),
];

// Saves a physical record and, in the same transaction, opens follow-up items
// for the school's approved physical risk rules it meets.
async function withPhysicalRisk(req, student, values, write) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await write(connection);
    await require("../services/physicalRisk").evaluatePhysicalRecord(
      connection,
      {
        organizationId: req.organizationContext,
        student,
        values,
        measuredAt: values.measured_at,
        actorId: req.user.id,
      },
    );
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

router.post(
  "/students/:id/physical-records",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const found = await loadStudent(req, req.params.id);
    if (
      !found ||
      !canHealthAction(req.schoolAccess, "create", found.student, true)
    )
      return fail(res, 403, "คุณไม่มีสิทธิ์บันทึกข้อมูลสุขภาพของนักเรียนคนนี้");
    const payload = physicalPayload(req.body);
    if (payload.error) return fail(res, 422, payload.error);
    const [result] = await withPhysicalRisk(
      req,
      found.student,
      payload.value,
      (c) =>
        c.query(
          `INSERT INTO school_student_physical_records
           (measured_at, weight_kg, height_cm, bmi, systolic, diastolic, pulse, vision_left, vision_right,
            hearing_left, hearing_right, note_encrypted, measurements_encrypted, student_id, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ...physicalColumns(payload.value, req.organizationContext),
            found.student.id,
            req.user.id,
          ],
        ),
    );
    await audit(req, {
      action: "student_health.update",
      targetType: "student_physical_record",
      targetId: result.insertId,
    });
    res.status(201).json({ id: result.insertId, bmi: payload.value.bmi });
  },
);

async function recordInScope(req, recordId) {
  const [rows] = await db.query(
    "SELECT id, student_id FROM school_student_physical_records WHERE id = ? LIMIT 1",
    [positiveId(recordId)],
  );
  if (!rows[0]) return null;
  const found = await loadStudent(req, rows[0].student_id);
  if (!found || !canViewPhysicalHealth(req.schoolAccess, found.student))
    return null;
  return rows[0];
}

router.put(
  "/physical-records/:id",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const record = await recordInScope(req, req.params.id);
    if (!record) return fail(res, 404, "ไม่พบบันทึกการตรวจ");
    if (!(req.schoolAccess.isSystemAdmin || req.schoolAccess.health?.update))
      return fail(res, 403, "คุณไม่มีสิทธิ์แก้ไขผลตรวจร่างกาย");
    const payload = physicalPayload(req.body);
    if (payload.error) return fail(res, 422, payload.error);
    const found = await loadStudent(req, record.student_id);
    await withPhysicalRisk(req, found.student, payload.value, (c) =>
      c.query(
        `UPDATE school_student_physical_records SET measured_at = ?, weight_kg = ?, height_cm = ?, bmi = ?, systolic = ?,
                diastolic = ?, pulse = ?, vision_left = ?, vision_right = ?, hearing_left = ?, hearing_right = ?,
                note_encrypted = ?, measurements_encrypted = ?, recorded_by = ?
          WHERE id = ?`,
        [
          ...physicalColumns(payload.value, req.organizationContext),
          req.user.id,
          record.id,
        ],
      ),
    );
    res.json({ success: true, bmi: payload.value.bmi });
  },
);

router.delete(
  "/physical-records/:id",
  allow((a) => a.canViewStudents),
  async (req, res) => {
    const record = await recordInScope(req, req.params.id);
    if (!record) return fail(res, 404, "ไม่พบบันทึกการตรวจ");
    if (!(req.schoolAccess.isSystemAdmin || req.schoolAccess.health?.delete))
      return fail(res, 403, "คุณไม่มีสิทธิ์ลบผลตรวจร่างกาย");
    await db.query("DELETE FROM school_student_physical_records WHERE id = ?", [
      record.id,
    ]);
    await audit(req, {
      action: "student_health.update",
      targetType: "student_physical_record_delete",
      targetId: record.id,
    });
    res.json({ success: true });
  },
);

// ── School cases ─────────────────────────────────────────────────────────
// One row per student with their latest mental and physical assessment and
// latest physical record. Health data, so it needs a health permission or
// the teacher scope.
router.get(
  "/cases",
  allow(
    (a) =>
      a.canViewAllHealth ||
      a.isTeacher ||
      a.isGuardian ||
      a.counselorClassroomIds?.length > 0,
    "คุณไม่มีสิทธิ์ดูข้อมูลสุขภาพนักเรียน",
  ),
  async (req, res) => {
    const students = (
      await scopedStudents(req, {
        ...req.query,
        status: req.query.status || "active",
      })
    ).filter(
      (student) =>
        canViewStudentHealth(req.schoolAccess, student) ||
        canViewPhysicalHealth(req.schoolAccess, student),
    );
    require("../utils/schoolWorkflows").dateWindow(req.query);
    const personIds = students.map((s) => s.person_id).filter(Boolean);
    const accountIds = students
      .map((s) => s.patient_account_id)
      .filter(Boolean);
    const formId = positiveId(req.query.form_id);
    const latest = new Map(); // student id -> { mental, physical }
    if (personIds.length || accountIds.length) {
      const [rows] = await db.query(
        `SELECT fr.id, fr.organization_id, fr.person_id, fr.patient_account_id, fr.submitted_at, fr.summary_data,
                f.id AS form_id, f.title AS form_title, f.health_domain
           FROM form_responses fr JOIN forms f ON f.id = fr.form_id
          WHERE fr.organization_id = ?
            AND f.health_domain IN ('mental', 'physical')
            AND (fr.person_id IN (?) OR fr.patient_account_id IN (?))${formId ? " AND fr.form_id = ?" : ""}${req.query.start_date ? " AND DATE(fr.submitted_at) >= ?" : ""}${req.query.end_date ? " AND DATE(fr.submitted_at) <= ?" : ""}
          ORDER BY fr.submitted_at DESC, fr.id DESC`,
        [
          req.organizationContext,
          personIds.length ? personIds : [0],
          accountIds.length ? accountIds : [0],
          ...(formId ? [formId] : []),
          ...(req.query.start_date ? [req.query.start_date] : []),
          ...(req.query.end_date ? [req.query.end_date] : []),
        ],
      );
      const byPerson = new Map(students.map((s) => [s.person_id, s]));
      const byAccount = new Map(students.map((s) => [s.patient_account_id, s]));
      for (const row of rows) {
        const student =
          (row.person_id && byPerson.get(row.person_id)) ||
          (row.patient_account_id && byAccount.get(row.patient_account_id));
        if (!student) continue;
        if (
          row.health_domain === "mental" &&
          !canViewStudentHealth(req.schoolAccess, student)
        )
          continue;
        if (
          row.health_domain === "physical" &&
          !canViewPhysicalHealth(req.schoolAccess, student)
        )
          continue;
        const entry = latest.get(student.id) || {};
        if (entry[row.health_domain]) continue;
        const summary = decryptCaseResponse(
          row,
          (value) => safeDecrypt(value) || value,
        ).summary_data;
        const scoreResults = scoreResultsOf(summary);
        entry[row.health_domain] = {
          response_id: row.id,
          form_id: row.form_id,
          form_title: row.form_title,
          submitted_at: row.submitted_at,
          risk:
            summary?.school_risk_override?.level || riskLevelOf(scoreResults),
          label: scoreResults[0]?.label || null,
          score: scoreResults[0]?.score ?? null,
        };
        latest.set(student.id, entry);
      }
    }
    const studentIds = students.map((s) => s.id);
    const vitals = new Map();
    if (studentIds.length) {
      const [rows] = await db.query(
        `SELECT student_id, measured_at, weight_kg, height_cm, bmi, measurements_encrypted FROM (
           SELECT r.*, ROW_NUMBER() OVER (PARTITION BY r.student_id ORDER BY r.measured_at DESC, r.id DESC) AS rn
             FROM school_student_physical_records r WHERE r.student_id IN (?)
         ) ranked WHERE rn = 1`,
        [studentIds],
      );
      rows
        .map((row) => physicalRecord(row, req.organizationContext))
        .forEach((row) =>
          vitals.set(row.student_id, {
            measured_at: dateOnly(row.measured_at),
            weight_kg: row.weight_kg === null ? null : Number(row.weight_kg),
            height_cm: row.height_cm === null ? null : Number(row.height_cm),
            bmi: row.bmi === null ? null : Number(row.bmi),
          }),
        );
    }
    const domain = ["mental", "physical"].includes(req.query.domain)
      ? req.query.domain
      : null;
    const activities =
      await require("../services/latestActivity").schoolActivities(
        db,
        req.organizationContext,
        students.filter((student) =>
          canViewStudentHealth(req.schoolAccess, student),
        ),
      );
    let items = students.map((student) => {
      const entry = latest.get(student.id) || {};
      const risks = (domain ? [entry[domain]] : [entry.mental, entry.physical])
        .filter(Boolean)
        .map((item) => item.risk);
      return {
        ...student,
        latest_activity: activities.get(student.id) || null,
        mental: entry.mental || null,
        physical: entry.physical || null,
        latest_vitals: vitals.get(student.id) || null,
        overall_risk: risks.length
          ? risks.reduce(higherRisk, "normal")
          : "none",
      };
    });
    if (domain) items = items.filter((item) => item[domain]);
    const counts = items.reduce(
      (acc, item) => {
        acc[item.overall_risk] += 1;
        return acc;
      },
      { high: 0, medium: 0, normal: 0, none: 0 },
    );
    const byClassroom = new Map();
    for (const item of items) {
      const key = item.classroom_id || 0;
      const room = byClassroom.get(key) || {
        classroom_id: item.classroom_id,
        name: item.classroom_name
          ? `${item.grade_name || ""} ห้อง ${item.classroom_name}`.trim()
          : "ไม่ระบุห้อง",
        high: 0,
        medium: 0,
        normal: 0,
        none: 0,
      };
      room[item.overall_risk] += 1;
      byClassroom.set(key, room);
    }
    if (["high", "medium", "normal", "none"].includes(req.query.risk))
      items = items.filter((item) => item.overall_risk === req.query.risk);
    const rank = { high: 0, medium: 1, normal: 2, none: 3 };
    items.sort(
      (a, b) =>
        rank[a.overall_risk] - rank[b.overall_risk] ||
        String(a.student_code).localeCompare(String(b.student_code)),
    );
    res.json({
      ...paginate(items, req.query),
      counts,
      classrooms: [...byClassroom.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "th"),
      ),
    });
  },
);

module.exports = router;
