const express = require("express");
const db = require("../config/db");
const {
  canManageStaffAt,
  canViewStudentHealth,
  canUpdateStudentHealth,
} = require("../utils/schoolAccess");
const { sealText, readJson, fieldContext } = require("../utils/privateData");
const { requiredAudit } = require("../utils/pdpaAudit");
const router = express.Router();
// Insight fields edited on the insights tab. Guardian details, the student's
// own phone and the care note are kept in the same encrypted record but are
// edited with the contacts on the general tab (CONTACT_FIELDS).
const fields = [
  "living_with",
  "family_status",
  "living_conditions",
  "support_needs",
];
const {
  GUARDIAN_ROLE_CODE,
  SCHOOL_ROLE_LABELS,
  roleMatchesKind,
  normalizeGradeIds,
  saveCounselorGrades,
} = require("../utils/schoolStaffRoles");
const roleLabels = { ...SCHOOL_ROLE_LABELS, [GUARDIAN_ROLE_CODE]: "ผู้ปกครอง" };
const fail = (res, status, message) => res.status(status).json({ message });
router.use((req, res, next) =>
  req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);
const HEALTH_KEY_LABELS = {
  "clinical.view": "ดูข้อมูลสุขภาพ",
  "student_health.view": "ดูข้อมูลสุขภาพนักเรียน",
  "student_health.create": "บันทึกข้อมูลสุขภาพนักเรียน",
  "student_health.update": "แก้ไขข้อมูลสุขภาพนักเรียน",
  "student_health.delete": "ลบข้อมูลสุขภาพนักเรียน",
  "student_health.assign": "มอบหมายงานติดตามรายบุคคล",
};
// write: false to read, true to edit, or a roles-page health action ("create").
async function studentAccess(req, res, write = false) {
  const [[student]] = await db.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.is_boarder,ss.archived_at FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE ss.id=? AND s.organization_id=? AND ss.archived_at IS NULL`,
    [req.params.id, req.organizationContext],
  );
  if (
    !student ||
    !(typeof write === "string"
      ? require("../utils/schoolAccess").canHealthAction(
          req.schoolAccess,
          write,
          student,
        )
      : (write ? canUpdateStudentHealth : canViewStudentHealth)(
          req.schoolAccess,
          student,
        ))
  ) {
    // A student the caller can see but whose role lacks the right gets a
    // 403 naming the missing keys; anyone else still gets the 404.
    const missing = student
      ? require("../utils/schoolAccess").missingHealthKeys(
          req.schoolAccess,
          write,
          student,
        )
      : [];
    if (missing.length) {
      res.status(403).json({
        success: false,
        code: "PERMISSION_REQUIRED",
        permission: missing[0],
        permissions: missing,
        message: `บทบาทของคุณยังไม่มีสิทธิ์ ${missing
          .map((key) => `${HEALTH_KEY_LABELS[key]} (${key})`)
          .join(", ")} ติดต่อผู้ดูแลให้เพิ่มสิทธิ์ที่หน้าบทบาทและสิทธิ์`,
      });
      return null;
    }
    fail(res, 404, "ไม่พบข้อมูลนักเรียนในขอบเขตสิทธิ์");
    return null;
  }
  return student;
}
function strings(body, allowed) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !allowed.includes(k))
  )
    return null;
  if (
    allowed.some(
      (k) =>
        body[k] != null &&
        (typeof body[k] !== "string" || body[k].length > 4000),
    )
  )
    return null;
  return Object.fromEntries(allowed.map((k) => [k, (body[k] || "").trim()]));
}
const context = (table, org) => fieldContext(table, "payload_encrypted", org);
const CONTACT_FIELDS = [
  "guardian_name",
  "guardian_relationship",
  "guardian_phone",
  "student_phone",
  "care_instructions",
];
const PHONE_FIELDS = [
  "guardian_phone",
  "student_phone",
  "emergency_contact_phone",
];
const validPhone = (value) => !value || /^[0-9+\- ]{1,20}$/.test(value);
async function storedInsights(connection, req, studentId) {
  const [[row]] = await connection.query(
    "SELECT payload_encrypted FROM school_student_insights WHERE student_id=?",
    [studentId],
  );
  return row
    ? readJson(
        row.payload_encrypted,
        context("school_student_insights", req.organizationContext),
      ) || {}
    : {};
}
const contactAccess = (req, student) => {
  const access = require("../utils/schoolAccess");
  return {
    view:
      access.canViewStudentHealth(req.schoolAccess, student) ||
      access.canViewPhysicalHealth(req.schoolAccess, student),
    // The care note is written for staff, not for the family.
    careNote:
      !req.schoolAccess.isGuardian &&
      access.canViewStudentHealth(req.schoolAccess, student),
    edit:
      access.canUpdateStudentHealth(req.schoolAccess, student) &&
      access.canCounselStudent(req.schoolAccess, student),
  };
};
async function contactStudent(req, res) {
  const [[student]] = await db.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.is_boarder,ss.archived_at FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE ss.id=? AND s.organization_id=? AND ss.archived_at IS NULL`,
    [req.params.id, req.organizationContext],
  );
  const rights = student && contactAccess(req, student);
  if (!rights?.view) {
    fail(res, 404, "ไม่พบข้อมูลนักเรียนในขอบเขตสิทธิ์");
    return null;
  }
  return { student, rights };
}
const healthField = (value, field, org) =>
  require("../utils/privateField").readField(
    value,
    "school_student_health_profiles",
    field,
    org,
    (v) => {
      try {
        return require("../utils/encryption").decrypt(v);
      } catch {
        return null;
      }
    },
  ) || "";

// Contacts on the general tab: guardian, emergency contact and the student's
// own phone, plus the care note on how to work with this student. Anyone who
// may see the student's health sees the contacts; the care note needs mental
// health scope; editing needs a health update right at counselor level.
router.get("/students/:id/contacts", async (req, res) => {
  const found = await contactStudent(req, res);
  if (!found) return;
  const { student, rights } = found;
  const stored = await storedInsights(db, req, student.id);
  const [[profile]] = await db.query(
    "SELECT emergency_contact_name_encrypted,emergency_contact_phone_encrypted FROM school_student_health_profiles WHERE student_id=?",
    [student.id],
  );
  res.set("Cache-Control", "no-store");
  res.json({
    student_id: student.id,
    can_edit: rights.edit,
    can_view_care_note: rights.careNote,
    guardian_name: stored.guardian_name || "",
    guardian_relationship: stored.guardian_relationship || "",
    guardian_phone: stored.guardian_phone || "",
    student_phone: stored.student_phone || "",
    emergency_contact_name: healthField(
      profile?.emergency_contact_name_encrypted,
      "emergency_contact_name_encrypted",
      req.organizationContext,
    ),
    emergency_contact_phone: healthField(
      profile?.emergency_contact_phone_encrypted,
      "emergency_contact_phone_encrypted",
      req.organizationContext,
    ),
    ...(rights.careNote
      ? { care_instructions: stored.care_instructions || "" }
      : {}),
  });
});
router.put("/students/:id/contacts", async (req, res) => {
  const found = await contactStudent(req, res);
  if (!found) return;
  const { student, rights } = found;
  if (!rights.edit)
    return fail(res, 403, "แก้ไขข้อมูลติดต่อได้เฉพาะครูแนะแนวขึ้นไป");
  const body = strings(req.body, [
    ...CONTACT_FIELDS,
    "emergency_contact_name",
    "emergency_contact_phone",
  ]);
  if (
    !body ||
    PHONE_FIELDS.some((k) => !validPhone(body[k])) ||
    body.emergency_contact_name.length > 255 ||
    body.care_instructions.length > 2000
  )
    return fail(
      res,
      422,
      "ข้อมูลติดต่อไม่ถูกต้อง เบอร์โทรใช้ได้เฉพาะตัวเลข + - และเว้นวรรค ไม่เกิน 20 ตัว",
    );
  const writeHealth = (value, field) =>
    value
      ? require("../utils/privateField").writeField(
          value,
          "school_student_health_profiles",
          field,
          req.organizationContext,
        )
      : null;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const stored = await storedInsights(connection, req, student.id);
    const merged = {
      ...stored,
      ...Object.fromEntries(CONTACT_FIELDS.map((k) => [k, body[k]])),
    };
    await connection.query(
      `INSERT INTO school_student_insights (student_id,payload_encrypted,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE payload_encrypted=VALUES(payload_encrypted),updated_by=VALUES(updated_by)`,
      [
        student.id,
        sealText(
          merged,
          context("school_student_insights", req.organizationContext),
        ),
        req.user.id,
      ],
    );
    await connection.query(
      `INSERT INTO school_student_health_profiles (student_id,emergency_contact_name_encrypted,emergency_contact_phone_encrypted,updated_by) VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE emergency_contact_name_encrypted=VALUES(emergency_contact_name_encrypted),emergency_contact_phone_encrypted=VALUES(emergency_contact_phone_encrypted),updated_by=VALUES(updated_by)`,
      [
        student.id,
        writeHealth(
          body.emergency_contact_name,
          "emergency_contact_name_encrypted",
        ),
        writeHealth(
          body.emergency_contact_phone,
          "emergency_contact_phone_encrypted",
        ),
        req.user.id,
      ],
    );
    await requiredAudit(
      req,
      "student_contacts.update",
      "student",
      student.id,
      {},
      connection,
    );
    await connection.commit();
    res.json({ success: true });
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
});
// Creates a guardian sign-in account of one school linked to the given
// students, inside the caller's transaction. Returns { id } or
// { status, message } when the input cannot be used.
async function createGuardianAccount(
  connection,
  req,
  { schoolId, studentIds, username, name, email, password },
) {
  const accountEmail = require("../utils/accountEmail");
  const [[school]] = await connection.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [schoolId, req.organizationContext],
  );
  const [students] = await connection.query(
    "SELECT id FROM school_students WHERE id IN (?) AND school_id=? AND archived_at IS NULL FOR UPDATE",
    [studentIds, schoolId],
  );
  if (!school || students.length !== studentIds.length)
    return { status: 422, message: "นักเรียนต้องอยู่ในโรงเรียนที่เลือก" };
  const [[role]] = await connection.query(
    "SELECT id FROM roles WHERE name='school_guardian' LIMIT 1",
  );
  if (!role) throw new Error("School guardian migration is required");
  const [[duplicate]] = await connection.query(
    "SELECT id FROM users WHERE username=? OR email_hash=? OR (email_hash IS NULL AND email=?) LIMIT 1",
    [username, accountEmail.lookup(email), email],
  );
  if (duplicate)
    return { status: 409, message: "ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว" };
  const passwordHash = await require("bcryptjs").hash(password, 12);
  const [user] = await connection.query(
    `INSERT INTO users (username,password,name,email,email_encrypted,email_hash,role_id,status,email_verified_at,auth_version) VALUES (?,?,?,NULL,?,?,?,'active',NULL,0)`,
    [
      username,
      passwordHash,
      require("../utils/privateField").writeField(name, "users", "name"),
      accountEmail.encode(email, "users"),
      accountEmail.lookup(email),
      role.id,
    ],
  );
  await connection.query(
    "INSERT INTO organization_memberships (organization_id,user_id,role_id,is_primary) VALUES (?,?,?,1)",
    [req.organizationContext, user.insertId, role.id],
  );
  await connection.query(
    "INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,'guardian','active',?)",
    [schoolId, user.insertId, req.user.id],
  );
  for (const id of studentIds)
    await connection.query(
      "INSERT INTO school_student_guardians (student_id,user_id,status,updated_by) VALUES (?,?,'active',?)",
      [id, user.insertId, req.user.id],
    );
  await requiredAudit(
    req,
    "school.guardian.create",
    "user",
    user.insertId,
    { school_id: schoolId, student_ids: studentIds },
    connection,
  );
  return { id: user.insertId };
}

router.post("/guardian-accounts", async (req, res) => {
  const { school_id, student_ids } = req.body || {};
  if (!canManageStaffAt(req.schoolAccess, school_id, "create"))
    return fail(res, 403, "ไม่มีสิทธิ์สร้างบัญชีในโรงเรียนนี้");
  const validated = require("../utils/userValidation").validateUserInput(
    req.body,
    { requirePassword: true },
  );
  if (validated.error) return fail(res, 422, validated.error);
  if (
    !Array.isArray(student_ids) ||
    !student_ids.length ||
    student_ids.length > 200 ||
    student_ids.some((id) => !Number.isInteger(id) || id <= 0)
  )
    return fail(res, 422, "กรุณาเลือกนักเรียนในความดูแล");
  const { username, name, email, password } = validated.value;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await createGuardianAccount(connection, req, {
      schoolId: school_id,
      studentIds: [...new Set(student_ids)],
      username,
      name,
      email,
      password,
    });
    if (!result.id) {
      await connection.rollback();
      return fail(res, result.status, result.message);
    }
    await connection.commit();
    res.status(201).json({ id: result.id, username });
  } catch (e) {
    await connection.rollback();
    if (e.code === "ER_DUP_ENTRY")
      return fail(res, 409, "ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว");
    throw e;
  } finally {
    connection.release();
  }
});

// ── Guardians of one student, from the student file ─────────────────────
// Staff rights from the roles page: school_staff view (list), create (new
// account), assign (link an existing guardian, e.g. a sibling's, or unlink).
async function guardianStudent(req, res, action) {
  const [[student]] = await db.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.is_boarder,ss.archived_at FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE ss.id=? AND s.organization_id=? AND ss.archived_at IS NULL`,
    [req.params.id, req.organizationContext],
  );
  const { canSeeStudent } = require("../utils/schoolAccess");
  if (!student || !canSeeStudent(req.schoolAccess, student)) {
    fail(res, 404, "ไม่พบนักเรียนในขอบเขตสิทธิ์");
    return null;
  }
  if (!canManageStaffAt(req.schoolAccess, student.school_id, action)) {
    fail(res, 403, "ไม่มีสิทธิ์จัดการบัญชีผู้ปกครอง");
    return null;
  }
  return student;
}
router.get("/students/:id/guardians", async (req, res) => {
  const student = await guardianStudent(req, res, "view");
  if (!student) return;
  const [rows] = await db.query(
    `SELECT u.id,u.username,u.name,u.status,g.updated_at FROM school_student_guardians g
       JOIN users u ON u.id=g.user_id
      WHERE g.student_id=? AND g.status='active' ORDER BY u.username`,
    [student.id],
  );
  res.set("Cache-Control", "no-store");
  res.json({
    guardians: rows.map((r) => ({
      id: r.id,
      username: r.username,
      name:
        require("../utils/privateField").readField(r.name, "users", "name") ||
        r.username,
      active: r.status === "active",
    })),
    can_create: canManageStaffAt(req.schoolAccess, student.school_id, "create"),
    can_assign: canManageStaffAt(req.schoolAccess, student.school_id, "assign"),
  });
});
// Body: { username, name, email, password } for a new account, or
// { link_username } to link a guardian account the school already has.
router.post("/students/:id/guardians", async (req, res) => {
  const linking = typeof req.body?.link_username === "string";
  const student = await guardianStudent(
    req,
    res,
    linking ? "assign" : "create",
  );
  if (!student) return;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (linking) {
      const [[guardian]] = await connection.query(
        `SELECT u.id FROM users u JOIN school_staff_roles r ON r.user_id=u.id AND r.school_id=? AND r.role_code='guardian' AND r.status='active'
          WHERE u.username=? AND u.status='active' LIMIT 1`,
        [student.school_id, req.body.link_username.trim()],
      );
      if (!guardian) {
        await connection.rollback();
        return fail(
          res,
          404,
          "ไม่พบบัญชีผู้ปกครองชื่อนี้ในโรงเรียน (ต้องเป็นบัญชีผู้ปกครองที่สร้างไว้แล้ว)",
        );
      }
      await connection.query(
        `INSERT INTO school_student_guardians (student_id,user_id,status,updated_by) VALUES (?,?,'active',?)
         ON DUPLICATE KEY UPDATE status='active',updated_by=VALUES(updated_by)`,
        [student.id, guardian.id, req.user.id],
      );
      await requiredAudit(
        req,
        "school.guardian.link",
        "student",
        student.id,
        {},
        connection,
      );
      await connection.commit();
      return res.status(201).json({ id: guardian.id });
    }
    const validated = require("../utils/userValidation").validateUserInput(
      req.body,
      { requirePassword: true },
    );
    if (validated.error) {
      await connection.rollback();
      return fail(res, 422, validated.error);
    }
    const result = await createGuardianAccount(connection, req, {
      schoolId: student.school_id,
      studentIds: [student.id],
      ...validated.value,
    });
    if (!result.id) {
      await connection.rollback();
      return fail(res, result.status, result.message);
    }
    await connection.commit();
    res.status(201).json({ id: result.id, username: validated.value.username });
  } catch (e) {
    await connection.rollback();
    if (e.code === "ER_DUP_ENTRY")
      return fail(res, 409, "ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว");
    throw e;
  } finally {
    connection.release();
  }
});
router.delete("/students/:id/guardians/:userId", async (req, res) => {
  const student = await guardianStudent(req, res, "assign");
  if (!student) return;
  const [result] = await db.query(
    "UPDATE school_student_guardians SET status='inactive',updated_by=? WHERE student_id=? AND user_id=? AND status='active'",
    [req.user.id, student.id, Number(req.params.userId) || 0],
  );
  if (!result.affectedRows) return fail(res, 404, "ไม่พบผู้ปกครองที่เชื่อมไว้");
  await requiredAudit(req, "school.guardian.unlink", "student", student.id);
  res.json({ success: true });
});
router.get("/staff-roles", async (req, res) => {
  if (!req.schoolAccess.canManageStaff)
    return fail(res, 403, "ไม่มีสิทธิ์จัดการบทบาทโรงเรียน");
  const [schools] = await db.query(
    "SELECT id,name FROM schools WHERE organization_id=?",
    [req.organizationContext],
  );
  const allowed = schools.filter((s) =>
    canManageStaffAt(req.schoolAccess, s.id, "view"),
  );
  const [memberRows] = await db.query(
    `SELECT u.id,u.username,u.name FROM organization_memberships om JOIN users u ON u.id=om.user_id WHERE om.organization_id=? AND om.status='active' AND u.status='active'`,
    [req.organizationContext],
  );
  const members = memberRows.map((m) => ({
    id: m.id,
    username: m.username,
    name: require("../utils/privateField").readField(m.name, "users", "name"),
  }));
  const [roles] = await db.query(
    `SELECT r.* FROM school_staff_roles r JOIN schools s ON s.id=r.school_id WHERE s.organization_id=?`,
    [req.organizationContext],
  );
  const [students] = await db.query(
    `SELECT ss.id,ss.school_id,ss.student_code,ss.prefix,ss.first_name_encrypted,ss.last_name_encrypted FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE s.organization_id=? AND ss.archived_at IS NULL ORDER BY ss.student_code,ss.id`,
    [req.organizationContext],
  );
  const studentOptions = students
    .filter((s) => canManageStaffAt(req.schoolAccess, s.school_id, "view"))
    .map((s) => ({
      id: s.id,
      school_id: s.school_id,
      student_code: s.student_code,
      prefix: s.prefix,
      first_name: require("../utils/privateField").readField(
        s.first_name_encrypted,
        "school_students",
        "first_name_encrypted",
        req.organizationContext,
      ),
      last_name: require("../utils/privateField").readField(
        s.last_name_encrypted,
        "school_students",
        "last_name_encrypted",
        req.organizationContext,
      ),
    }));
  const [teachers] = await db.query(
    `SELECT t.school_id,t.user_id FROM school_teachers t JOIN schools s ON s.id=t.school_id WHERE s.organization_id=? AND t.status='active'`,
    [req.organizationContext],
  );
  const [guardians] = await db.query(
    `SELECT g.student_id,g.user_id,ss.school_id FROM school_student_guardians g JOIN school_students ss ON ss.id=g.student_id JOIN schools s ON s.id=ss.school_id WHERE s.organization_id=? AND g.status='active' AND ss.archived_at IS NULL`,
    [req.organizationContext],
  );
  // Grades a counselor can be limited to, and the limits already set.
  const [grades] = await db.query(
    `SELECT g.id,g.school_id,g.name FROM school_grade_levels g JOIN schools s ON s.id=g.school_id WHERE s.organization_id=? AND g.status='active' ORDER BY g.school_id,g.level_order,g.id`,
    [req.organizationContext],
  );
  const [roleGrades] = await db.query(
    `SELECT rg.school_id,rg.user_id,rg.grade_level_id FROM school_staff_role_grades rg JOIN schools s ON s.id=rg.school_id WHERE s.organization_id=?`,
    [req.organizationContext],
  );
  const managed = (row) =>
    canManageStaffAt(req.schoolAccess, row.school_id, "view");
  res.json({
    grades: grades.filter(managed),
    role_grades: roleGrades.filter(managed),
    schools: allowed,
    members,
    students: studentOptions,
    teachers: teachers.filter((t) =>
      canManageStaffAt(req.schoolAccess, t.school_id, "view"),
    ),
    guardians: guardians.filter((g) =>
      canManageStaffAt(req.schoolAccess, g.school_id, "view"),
    ),
    roles: roles.filter((r) =>
      canManageStaffAt(req.schoolAccess, r.school_id, "view"),
    ),
    role_labels: roleLabels,
  });
});
router.put("/staff-roles", async (req, res) => {
  const { school_id, user_id, role_code, status = "active" } = req.body || {};
  const [[school]] = await db.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [school_id, req.organizationContext],
  );
  // Revoking is "delete", linking a guardian to students is "assign", else "update".
  const staffAction =
    status === "inactive"
      ? "delete"
      : role_code === "guardian"
        ? "assign"
        : "update";
  if (!school || !canManageStaffAt(req.schoolAccess, school_id, staffAction))
    return fail(res, 403, "ไม่มีสิทธิ์จัดการโรงเรียนนี้");
  if (
    !Object.hasOwn(roleLabels, role_code) ||
    !["active", "inactive"].includes(status)
  )
    return fail(res, 422, "บทบาทหรือสถานะไม่ถูกต้อง");
  const grades = normalizeGradeIds(req.body.grade_level_ids);
  if (grades.error) return fail(res, 422, grades.error);
  const [[member]] = await db.query(
    `SELECT om.user_id,r.name role_name FROM organization_memberships om JOIN roles r ON r.id=om.role_id WHERE om.organization_id=? AND om.user_id=? AND om.status='active'`,
    [req.organizationContext, user_id],
  );
  if (!member) return fail(res, 422, "บัญชีต้องเป็นสมาชิกหน่วยงานนี้");
  // Same duty rules as the Add User modal: teacher duties need a teacher
  // record in this school, staff duties need a non-teacher.
  if (role_code !== GUARDIAN_ROLE_CODE && status === "active") {
    const [[teacher]] = await db.query(
      "SELECT id FROM school_teachers WHERE school_id=? AND user_id=? AND status='active'",
      [school_id, user_id],
    );
    if (!roleMatchesKind(role_code, teacher ? "teacher" : "staff"))
      return fail(
        res,
        422,
        teacher
          ? "หน้าที่นี้ใช้กับบุคลากรสนับสนุน ครูเลือกได้เฉพาะหน้าที่ของครู"
          : "หน้าที่นี้ใช้กับครู กรุณาเพิ่มบัญชีนี้เป็นครูก่อน",
      );
  }
  let studentIds = [];
  if (role_code === "guardian") {
    if (
      !Array.isArray(req.body.student_ids) ||
      req.body.student_ids.length > 200 ||
      req.body.student_ids.some((id) => !Number.isInteger(id) || id <= 0)
    )
      return fail(res, 422, "กรุณาเลือกนักเรียนในความดูแล");
    studentIds = [...new Set(req.body.student_ids)];
    if (status === "active" && !studentIds.length)
      return fail(res, 422, "กรุณาเลือกนักเรียนอย่างน้อยหนึ่งคน");
    // A system account cannot be narrowed to a parent by a school assignment.
    const [[system]] = await db.query(
      `SELECT u.id FROM users u WHERE u.id=? AND (u.role_id=1 OR EXISTS (SELECT 1 FROM user_system_roles usr JOIN system_roles sr ON sr.id=usr.system_role_id WHERE usr.user_id=u.id AND sr.code='system_admin'))`,
      [user_id],
    );
    if (system)
      return fail(res, 422, "กรุณาใช้บัญชีผู้ปกครองแยกจากบัญชีผู้ดูแลระบบ");
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (role_code === "guardian") {
      const [students] = studentIds.length
        ? await connection.query(
            "SELECT id FROM school_students WHERE id IN (?) AND school_id=? AND archived_at IS NULL FOR UPDATE",
            [studentIds, school_id],
          )
        : [[]];
      if (students.length !== studentIds.length) {
        await connection.rollback();
        return fail(res, 422, "นักเรียนต้องอยู่ในโรงเรียนที่เลือก");
      }
      const [[role]] = await connection.query(
        "SELECT id FROM roles WHERE name='school_guardian' LIMIT 1",
      );
      if (!role) throw new Error("School guardian migration is required");
      await connection.query(
        "UPDATE organization_memberships SET role_id=? WHERE organization_id=? AND user_id=?",
        [role.id, req.organizationContext, user_id],
      );
    }
    if (role_code !== "guardian" && member.role_name === "school_guardian") {
      const [[role]] = await connection.query(
        "SELECT id FROM roles WHERE name='school_import_staff' LIMIT 1",
      );
      if (!role) throw new Error("School workflow migration is required");
      await connection.query(
        "UPDATE organization_memberships SET role_id=? WHERE organization_id=? AND user_id=?",
        [role.id, req.organizationContext, user_id],
      );
    }
    await connection.query(
      `UPDATE school_student_guardians g JOIN school_students ss ON ss.id=g.student_id SET g.status='inactive',g.updated_by=? WHERE g.user_id=? AND ss.school_id=?`,
      [req.user.id, user_id, school_id],
    );
    for (const id of studentIds)
      await connection.query(
        `INSERT INTO school_student_guardians (student_id,user_id,status,updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),updated_by=VALUES(updated_by)`,
        [id, user_id, status, req.user.id],
      );
    await connection.query(
      `INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE role_code=VALUES(role_code),status=VALUES(status),updated_by=VALUES(updated_by)`,
      [school_id, user_id, role_code, status, req.user.id],
    );
    await saveCounselorGrades(connection, {
      schoolId: school_id,
      userId: user_id,
      roleCode: role_code,
      gradeLevelIds: grades.value,
      actorId: req.user.id,
    });
    await requiredAudit(
      req,
      "school.roles.update",
      "school",
      school_id,
      {
        user_id,
        role_code,
        status,
        ...(grades.value !== undefined && { grade_level_ids: grades.value }),
      },
      connection,
    );
    await connection.commit();
    res.json({ success: true });
  } catch (e) {
    await connection.rollback();
    if (e.status === 422) return fail(res, 422, e.message);
    throw e;
  } finally {
    connection.release();
  }
});
router.get("/students/:id/insights", async (req, res) => {
  // Family background and guidance records are the counselors' working
  // notes; guardians see their child's results, not these.
  if (req.schoolAccess.isGuardian)
    return fail(res, 404, "ไม่พบข้อมูลนักเรียนในขอบเขตสิทธิ์");
  const student = await studentAccess(req, res);
  if (!student) return;
  const [[row]] = await db.query(
    "SELECT * FROM school_student_insights WHERE student_id=?",
    [student.id],
  );
  const [records] = await db.query(
    `SELECT gr.id,gr.record_type,gr.recorded_at,gr.follow_up_at,gr.payload_encrypted,gr.recorded_by,u.name AS recorded_by_name_encrypted
    FROM school_guidance_records gr
    LEFT JOIN users u ON u.id=gr.recorded_by
    WHERE gr.student_id=?
    ORDER BY gr.recorded_at DESC,gr.id DESC`,
    [student.id],
  );
  res.set("Cache-Control", "no-store");
  res.json({
    student_id: student.id,
    can_update: canUpdateStudentHealth(req.schoolAccess, student),
    can_create: require("../utils/schoolAccess").canHealthAction(
      req.schoolAccess,
      "create",
      student,
    ),
    // Opening a screening or follow-up task (health "assign").
    can_assign: require("../utils/schoolAccess").canHealthAction(
      req.schoolAccess,
      "assign",
      student,
    ),
    profile: row
      ? readJson(
          row.payload_encrypted,
          context("school_student_insights", req.organizationContext),
        )
      : Object.fromEntries(fields.map((k) => [k, ""])),
    records: records.map((r) => ({
      id: r.id,
      record_type: r.record_type || "guidance",
      recorded_at: r.recorded_at,
      follow_up_at: r.follow_up_at,
      recorded_by: r.recorded_by,
      recorded_by_name: r.recorded_by_name_encrypted
        ? require("../utils/privateField").readField(
            r.recorded_by_name_encrypted,
            "users",
            "name",
          )
        : null,
      ...readJson(
        r.payload_encrypted,
        context("school_guidance_records", req.organizationContext),
      ),
    })),
  });
});
router.put("/students/:id/insights", async (req, res) => {
  const student = await studentAccess(req, res, true);
  if (!student) return;
  const payload = strings(req.body, fields);
  if (!payload) return fail(res, 422, "ข้อมูลเชิงลึกไม่ถูกต้อง");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    // Keep the contact fields stored in the same record.
    const stored = await storedInsights(connection, req, student.id);
    const merged = { ...stored, ...payload };
    await connection.query(
      `INSERT INTO school_student_insights (student_id,payload_encrypted,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE payload_encrypted=VALUES(payload_encrypted),updated_by=VALUES(updated_by)`,
      [
        student.id,
        sealText(
          merged,
          context("school_student_insights", req.organizationContext),
        ),
        req.user.id,
      ],
    );
    await requiredAudit(
      req,
      "student_insights.update",
      "student",
      student.id,
      {},
      connection,
    );
    await connection.commit();
    res.json({ success: true });
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
});
function validDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
router.post("/students/:id/guidance", async (req, res) => {
  const student = await studentAccess(req, res, "create");
  if (!student) return;
  const {
    recorded_at,
    follow_up_at,
    record_type = "guidance",
    task,
    ...body
  } = req.body || {};
  const payload = strings(body, ["issue", "support"]);
  if (
    !payload ||
    !payload.issue ||
    !validDate(recorded_at) ||
    (follow_up_at && !validDate(follow_up_at)) ||
    // Screening is done by rounds for a group; a record for one student is
    // general guidance or a follow-up.
    !["guidance", "follow_up"].includes(record_type)
  )
    return fail(res, 422, "กรุณาระบุวันที่และเรื่องที่พบให้ถูกต้อง");
  // A follow-up record can open the student's follow-up task at once, which
  // needs the health "assign" right on the roles page.
  if (task) {
    if (record_type !== "follow_up" || typeof task !== "object")
      return fail(res, 422, "สร้างงานได้เฉพาะบันทึกติดตาม");
    if (
      !require("../utils/schoolAccess").canHealthAction(
        req.schoolAccess,
        "assign",
        student,
      )
    )
      return fail(res, 403, "ไม่มีสิทธิ์สร้างงานติดตาม");
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO school_guidance_records (student_id,record_type,recorded_at,follow_up_at,payload_encrypted,recorded_by) VALUES (?,?,?,?,?,?)`,
      [
        student.id,
        record_type,
        recorded_at,
        follow_up_at || null,
        sealText(
          payload,
          context("school_guidance_records", req.organizationContext),
        ),
        req.user.id,
      ],
    );
    let taskId = null;
    if (task) {
      const [[ss]] = await connection.query(
        "SELECT id,school_id,classroom_id,person_id,patient_account_id FROM school_students WHERE id=?",
        [student.id],
      );
      taskId = await require("../services/rescreenTasks").createTask(
        connection,
        {
          organizationId: req.organizationContext,
          userId: req.user.id,
          ss,
          task: {
            target_form_id: task.target_form_id,
            assigned_user_id: task.assigned_user_id,
            due_on: task.due_on,
            task_kind: record_type,
            guidance_record_id: result.insertId,
          },
        },
      );
      await requiredAudit(
        req,
        "school.rescreen.create",
        "student",
        student.id,
        {},
        connection,
      );
    }
    await requiredAudit(
      req,
      "student_guidance.create",
      "student",
      student.id,
      {},
      connection,
    );
    await connection.commit();
    res.status(201).json({ id: result.insertId, task_id: taskId });
  } catch (e) {
    await connection.rollback();
    if (e.status === 422) return fail(res, 422, e.message);
    throw e;
  } finally {
    connection.release();
  }
});
// A care step (referred to the counselor, being followed, referred to
// hospital, or closed) is added to the student's history, never overwritten.
// It is filed under the semester of its date and the class the student is
// in now, so the record still reads correctly after the student moves up.
router.post("/students/:id/care-status", async (req, res) => {
  const student = await studentAccess(req, res, "update");
  if (!student) return;
  const mental = require("../services/studentMentalStatus");
  const { status, effective_on, note = "" } = req.body || {};
  if (
    !mental.CARE_STATUSES.includes(status) ||
    !validDate(effective_on) ||
    effective_on > mental.todayKey() ||
    typeof note !== "string" ||
    note.length > 2000
  )
    return fail(
      res,
      422,
      "กรุณาเลือกสถานะและวันที่ (ไม่เกินวันนี้) ให้ถูกต้อง",
    );
  const terms = await mental.loadTerms(db, [student.school_id]);
  const term = mental.termOf(
    effective_on,
    terms.get(Number(student.school_id)),
  );
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `INSERT INTO school_student_care_statuses (school_id,student_id,status,effective_on,academic_year,semester,classroom_id,payload_encrypted,created_by) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        student.school_id,
        student.id,
        status,
        effective_on,
        term.academic_year,
        term.semester,
        student.classroom_id || null,
        note.trim()
          ? sealText(
              { note: note.trim() },
              context("school_student_care_statuses", req.organizationContext),
            )
          : null,
        req.user.id,
      ],
    );
    await requiredAudit(
      req,
      "student_care_status.create",
      "student",
      student.id,
      { status },
      connection,
    );
    await connection.commit();
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    await connection.rollback();
    throw e;
  } finally {
    connection.release();
  }
});
module.exports = router;
