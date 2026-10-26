const {
  deactivateSchoolTeacher,
  upsertSchoolTeacher,
} = require("../utils/schoolTeachers");
const accountEmail = require("../utils/accountEmail");
/**
 * ============================================================
 * server/routes/userRoutes.js  —  เวอร์ชัน AES
 * แก้จากของเดิม: เพิ่ม encrypt/decrypt ใน route ที่มีอยู่
 * + แก้ password ให้ hash ด้วย bcryptjs
 * + ลบ Phone และ National ID ออกตาม Database
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs"); // ใช้ bcryptjs ตาม package.json
const db = require("../config/db");
const {
  verifyToken,
  requirePermission,
  verifySuperAdmin,
} = require("../middleware/authMiddleware");
const {
  normaliseSystemRoleId,
  validateUserInput,
} = require("../utils/userValidation");
const {
  audit: auditPatient,
  validatePersonName,
  validatePhone,
  getExistingPhone,
  hmacHash,
} = require("../utils/patientAuth");
const { normalizeEmail } = require("../services/otpService");

const { encrypt, decrypt } = require("../utils/encryption");
const { organizationWhere } = require("../authorization/authorization");

function safeDecrypt(value) {
  return decrypt(value);
}

function safePatientDecrypt(value) {
  if (!value) return "";
  return decrypt(value) || "";
}

const patientMemberStatuses = new Set([
  "pending_verification",
  "active",
  "locked",
  "disabled",
]);
const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

const {
  SCHOOL_ROLE_LABELS: schoolRoleLabels,
  TEACHER_ROLE_CODES: teacherSchoolRoles,
  STAFF_ROLE_CODES: staffSchoolRoles,
  normalizeGradeIds,
  saveCounselorGrades,
} = require("../utils/schoolStaffRoles");
const positiveId = (value) =>
  /^\d+$/.test(String(value)) &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

function normalizeUserAssignments(body = {}) {
  if (!Array.isArray(body.memberships) || body.memberships.length > 100)
    return { error: "ข้อมูลหน่วยงานไม่ถูกต้อง" };
  const organizationIds = new Set();
  const memberships = [];
  for (const item of body.memberships) {
    if (!positiveId(item?.organization_id) || !positiveId(item?.role_id))
      return { error: "กรุณาเลือกหน่วยงานและบทบาทให้ครบถ้วน" };
    const organizationId = Number(item.organization_id);
    if (organizationIds.has(organizationId))
      return { error: "ไม่สามารถเลือกหน่วยงานซ้ำได้" };
    organizationIds.add(organizationId);
    let schoolAssignment = null;
    if (item.school_assignment) {
      const assignment = item.school_assignment;
      if (
        !positiveId(assignment.school_id) ||
        !Object.hasOwn(schoolRoleLabels, assignment.role_code) ||
        !["teacher", "staff"].includes(assignment.personnel_kind)
      )
        return {
          error: "กรุณาระบุโรงเรียน ประเภทบุคลากร และหน้าที่ให้ครบถ้วน",
        };
      if (
        assignment.personnel_kind === "teacher" &&
        !positiveId(assignment.teacher_type_id)
      )
        return { error: "กรุณาเลือกประเภทครู" };
      if (
        !(
          assignment.personnel_kind === "teacher"
            ? teacherSchoolRoles
            : staffSchoolRoles
        ).has(assignment.role_code)
      )
        return { error: "หน้าที่ในโรงเรียนไม่ตรงกับประเภทบุคลากร" };
      const employeeCode = String(assignment.employee_code || "").trim();
      const position = String(assignment.position || "").trim();
      if (employeeCode.length > 50 || position.length > 100)
        return { error: "รหัสบุคลากรหรือตำแหน่งยาวเกินกำหนด" };
      const grades = normalizeGradeIds(assignment.grade_level_ids);
      if (grades.error) return { error: grades.error };
      schoolAssignment = {
        grade_level_ids: grades.value,
        school_id: Number(assignment.school_id),
        role_code: assignment.role_code,
        personnel_kind: assignment.personnel_kind,
        teacher_type_id:
          assignment.personnel_kind === "teacher"
            ? Number(assignment.teacher_type_id)
            : null,
        employee_code: employeeCode || null,
        position: position || null,
      };
    }
    memberships.push({
      organization_id: organizationId,
      role_id: Number(item.role_id),
      is_primary: Boolean(item.is_primary),
      school_assignment: schoolAssignment,
    });
  }
  return { value: memberships };
}

function patientOrganizationClause(req, alias = "patient_accounts") {
  const scope = organizationWhere("fr.organization_id", req);
  return {
    sql: `EXISTS (SELECT 1 FROM form_responses fr WHERE fr.patient_account_id = ${alias}.id${scope.sql})`,
    params: scope.params,
  };
}

async function ensurePatientOrganization(req, res, next) {
  // router.use() middleware never receives route params, so the member id must
  // be read from the path itself.
  const match = req.path.match(/^\/patient-members\/(\d+)/);
  if (!match || !req.authorization) return next();
  // An administrator may choose "all" for cross-organization work. When a
  // concrete organization is selected, the same tenant boundary applies to
  // administrators and regular staff alike.
  if (req.organizationContext === "all") return next();
  const clause = patientOrganizationClause(req);
  const [rows] = await db.query(
    `SELECT id FROM patient_accounts WHERE id=? AND ${clause.sql} LIMIT 1`,
    [Number(match[1]), ...clause.params],
  );
  if (!rows.length)
    return res.status(403).json({
      success: false,
      message: "คุณไม่มีสิทธิ์เข้าถึงผู้มารับบริการรายนี้",
    });
  return next();
}
router.use(ensurePatientOrganization);

// Read-only patient member directory for authorized staff. Sensitive identity,
// phone and credential fields are intentionally never selected or returned.
router.get(
  "/patient-members",
  verifyToken,
  requirePermission("User Management"),
  async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(10, Number.parseInt(req.query.limit, 10) || 20),
    );
    const offset = (page - 1) * limit;
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 80);
    const status = String(req.query.status || "").trim();
    const memberType = String(req.query.type || "").trim();
    const typeRules = require("../services/memberType");
    const typeSql = typeRules.memberTypeSql("patient_accounts");

    if (status && !patientMemberStatuses.has(status)) {
      return res.status(422).json({ message: "สถานะสมาชิกไม่ถูกต้อง" });
    }
    if (memberType && !typeRules.FILTERABLE_TYPES.has(memberType)) {
      return res
        .status(422)
        .json({ message: "ประเภทผู้มารับบริการไม่ถูกต้อง" });
    }

    const conditions = [];
    const values = [];
    if (typeof req.organizationContext === "number") {
      const clause = patientOrganizationClause(req);
      conditions.push(clause.sql);
      values.push(...clause.params);
    }
    if (req.schoolSubjectScope) {
      conditions.push("patient_accounts.id IN (?)");
      values.push(
        req.schoolSubjectScope.accountIds.length
          ? req.schoolSubjectScope.accountIds
          : [0],
      );
    }
    if (search) {
      conditions.push("patient_accounts.username LIKE ?");
      values.push(`%${search}%`);
    }
    if (status) {
      conditions.push("patient_accounts.status = ?");
      values.push(status);
    }
    if (memberType) {
      conditions.push(`${typeSql.type} = ?`);
      values.push(memberType);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const [[countRow]] = await db.query(
        `SELECT COUNT(*) AS total FROM patient_accounts ${typeSql.joins} ${where}`,
        values,
      );
      const [rows] = await db.query(
        `SELECT patient_accounts.id, patient_accounts.username,
                patient_accounts.first_name_encrypted, patient_accounts.last_name_encrypted,
                patient_accounts.status, patient_accounts.verified_at,
                patient_accounts.last_login_at, patient_accounts.created_at,
                ${typeSql.type} AS member_type
         FROM patient_accounts ${typeSql.joins}
         ${where}
         ORDER BY patient_accounts.created_at DESC, patient_accounts.id DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      );
      const total = Number(countRow?.total || 0);

      return res.json({
        data: rows.map((row) => ({
          id: row.id,
          username: row.username,
          full_name:
            [
              require("../utils/privateField").readField(
                row.first_name_encrypted,
                "patient_accounts",
                "first_name_encrypted",
              ),
              require("../utils/privateField").readField(
                row.last_name_encrypted,
                "patient_accounts",
                "last_name_encrypted",
              ),
            ]
              .filter(Boolean)
              .join(" ") || "—",
          status: row.status,
          member_type: row.member_type,
          member_type_label: typeRules.MEMBER_TYPE_LABELS[row.member_type],
          verified_at: row.verified_at,
          last_login_at: row.last_login_at,
          created_at: row.created_at,
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      console.error(
        "Error fetching patient members:",
        require("../utils/safeError").safeError(error),
      );
      return res.status(500).json({
        message: "ไม่สามารถโหลดข้อมูลสมาชิกได้ กรุณาลองใหม่",
      });
    }
  },
);

router.get(
  "/patient-members/:id",
  verifyToken,
  requirePermission("User Management"),
  async (req, res) => {
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId) || memberId < 1) {
      return res.status(422).json({ message: "รหัสผู้มารับบริการไม่ถูกต้อง" });
    }
    try {
      const [rows] = await db.query(
        `SELECT id, username, first_name_encrypted, last_name_encrypted,
                identity_hash, phone_encrypted, email, email_encrypted, status, verified_at, last_login_at, created_at
         FROM patient_accounts WHERE id = ? LIMIT 1`,
        [memberId],
      );
      if (!rows.length) {
        return res.status(404).json({ message: "ไม่พบบัญชีผู้มารับบริการ" });
      }
      const member = rows[0];
      const phone =
        require("../utils/privateField").readField(
          member.phone_encrypted,
          "patient_accounts",
          "phone_encrypted",
        ) ||
        (await getExistingPhone(member.identity_hash)) ||
        "";
      return res.json({
        id: member.id,
        username: member.username,
        first_name: require("../utils/privateField").readField(
          member.first_name_encrypted,
          "patient_accounts",
          "first_name_encrypted",
        ),
        last_name: require("../utils/privateField").readField(
          member.last_name_encrypted,
          "patient_accounts",
          "last_name_encrypted",
        ),
        phone,
        email: accountEmail.decode(member, "patient_accounts"),
        status: member.status,
        verified_at: member.verified_at,
        last_login_at: member.last_login_at,
        created_at: member.created_at,
      });
    } catch (error) {
      console.error(
        "Error fetching patient member:",
        require("../utils/safeError").safeError(error),
      );
      return res
        .status(500)
        .json({ message: "ไม่สามารถเปิดข้อมูลผู้มารับบริการได้" });
    }
  },
);

router.put(
  "/patient-members/:id",
  verifyToken,
  requirePermission("User Management", "manage"),
  async (req, res) => {
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId) || memberId < 1) {
      return res.status(422).json({ message: "รหัสผู้มารับบริการไม่ถูกต้อง" });
    }

    const username = String(req.body.username || "")
      .trim()
      .toLowerCase();
    const firstName = validatePersonName(req.body.first_name, "ชื่อ");
    const lastName = validatePersonName(req.body.last_name, "นามสกุล");
    const phoneInput = String(req.body.phone || "").trim();
    const phone = phoneInput ? validatePhone(phoneInput) : null;
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const status = String(req.body.status || "").trim();

    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) {
      return res.status(422).json({
        message:
          "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3-80 ตัวอักษร",
      });
    }
    if (firstName.error)
      return res.status(422).json({ message: firstName.error });
    if (lastName.error)
      return res.status(422).json({ message: lastName.error });
    if (phoneInput && !phone) {
      return res.status(422).json({ message: "หมายเลขโทรศัพท์ไม่ถูกต้อง" });
    }
    if (!validEmail(email)) {
      return res.status(422).json({ message: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    if (password && (password.length < 8 || password.length > 128)) {
      return res
        .status(422)
        .json({ message: "รหัสผ่านใหม่ต้องมีความยาว 8-128 ตัวอักษร" });
    }
    if (!patientMemberStatuses.has(status)) {
      return res.status(422).json({ message: "สถานะผู้มารับบริการไม่ถูกต้อง" });
    }

    try {
      const [existingRows] = await db.query(
        "SELECT id, email,email_encrypted,first_name_encrypted,last_name_encrypted,phone_hash,status FROM patient_accounts WHERE id = ? LIMIT 1",
        [memberId],
      );
      if (!existingRows.length) {
        return res.status(404).json({ message: "ไม่พบบัญชีผู้มารับบริการ" });
      }
      // Roles page: names/phone need pii.update, a new password "assign",
      // deactivating the account "delete".
      const { denyUnless } = require("../authorization/can");
      const { readField } = require("../utils/privateField");
      const current = existingRows[0];
      const identityChanged =
        readField(
          current.first_name_encrypted,
          "patient_accounts",
          "first_name_encrypted",
        ) !== firstName.value ||
        readField(
          current.last_name_encrypted,
          "patient_accounts",
          "last_name_encrypted",
        ) !== lastName.value ||
        (current.phone_hash || null) !== (phone ? hmacHash(phone) : null);
      if (identityChanged && denyUnless(req, res, "pii.update")) return;
      if (password && denyUnless(req, res, "patient_members.assign")) return;
      if (
        status !== current.status &&
        status !== "active" &&
        denyUnless(req, res, "patient_members.delete")
      )
        return;
      const emailChanged =
        normalizeEmail(
          accountEmail.decode(existingRows[0], "patient_accounts"),
        ) !== email;

      const fields = [
        "username = ?",
        "first_name_encrypted = ?",
        "last_name_encrypted = ?",
        "phone_hash = ?",
        "phone_encrypted = ?",
        "email = NULL",
        "email_encrypted = ?",
        "email_hash = ?",
        "status = ?",
        "failed_login_count = 0",
        "locked_until = NULL",
        "token_version = token_version + 1",
      ];
      const values = [
        username,
        require("../utils/privateField").writeField(
          firstName.value,
          "patient_accounts",
          "first_name_encrypted",
        ),
        require("../utils/privateField").writeField(
          lastName.value,
          "patient_accounts",
          "last_name_encrypted",
        ),
        phone ? hmacHash(phone) : null,
        phone
          ? require("../utils/privateField").writeField(
              phone,
              "patient_accounts",
              "phone_encrypted",
            )
          : null,
        accountEmail.encode(email, "patient_accounts"),
        accountEmail.lookup(email),
        status,
      ];
      if (emailChanged) {
        fields.push(
          "email_verified_at = NULL",
          "pending_email = NULL",
          "pending_email_encrypted = NULL",
          "pending_email_hash = NULL",
          "auth_version = auth_version + 1",
        );
      }
      if (status === "pending_verification") fields.push("status = 'active'");
      if (password) {
        fields.push("password_hash = ?");
        values.push(await bcrypt.hash(password, 12));
      }
      values.push(memberId);
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          `UPDATE patient_accounts SET ${fields.join(", ")} WHERE id = ?`,
          values,
        );
        if (emailChanged) {
          await connection.query(
            "UPDATE auth_email_challenges SET invalidated_at=NOW() WHERE account_type='patient' AND account_id=? AND consumed_at IS NULL AND invalidated_at IS NULL",
            [memberId],
          );
        }
        await require("../utils/pdpaAudit").requiredAudit(
          req,
          "patient_account.update",
          "patient_account",
          memberId,
          {},
          connection,
        );
        await connection.commit();
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }
      await auditPatient(memberId, "admin_account_updated", req, {
        actor_user_id: req.user.id,
        password_changed: Boolean(password),
        email_changed: emailChanged,
        status,
      });
      return res.json({ message: "บันทึกข้อมูลผู้มารับบริการเรียบร้อยแล้ว" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res
          .status(409)
          .json({ message: "ชื่อผู้ใช้หรืออีเมลนี้มีผู้ใช้งานแล้ว" });
      }
      console.error(
        "Error updating patient member:",
        require("../utils/safeError").safeError(error),
      );
      return res
        .status(error.status || 500)
        .json({ message: "ไม่สามารถบันทึกข้อมูลผู้มารับบริการได้" });
    }
  },
);

router.delete(
  "/patient-members/:id",
  verifyToken,
  verifySuperAdmin,
  requirePermission("User Management", "manage"),
  async (req, res) => {
    const memberId = Number(req.params.id);
    if (!Number.isInteger(memberId) || memberId < 1) {
      return res.status(422).json({ message: "รหัสผู้มารับบริการไม่ถูกต้อง" });
    }

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.query(
        "SELECT id, username FROM patient_accounts WHERE id = ? FOR UPDATE",
        [memberId],
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ message: "ไม่พบบัญชีผู้มารับบริการ" });
      }

      // Preserve clinical records but remove their association with the deleted login.
      await connection.query(
        "UPDATE form_responses SET patient_account_id = NULL WHERE patient_account_id = ?",
        [memberId],
      );
      await connection.query("DELETE FROM patient_accounts WHERE id = ?", [
        memberId,
      ]);
      await require("../utils/pdpaAudit").requiredAudit(
        req,
        "patient_account.delete",
        "patient_account",
        memberId,
        {},
        connection,
      );
      await connection.commit();
      await auditPatient(null, "admin_account_deleted", req, {
        actor_user_id: req.user.id,
        deleted_patient_account_id: memberId,
        username: rows[0].username,
      });
      return res.json({ message: "ลบบัญชีผู้มารับบริการเรียบร้อยแล้ว" });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error(
        "Error deleting patient member:",
        require("../utils/safeError").safeError(error),
      );
      return res
        .status(500)
        .json({ message: "ไม่สามารถลบบัญชีผู้มารับบริการได้" });
    } finally {
      connection?.release();
    }
  },
);

// ============================================================
//  1. ดึงข้อมูลผู้ใช้งานทั้งหมด  GET /users
//     → จำกัดเฉพาะผู้ดูแลระบบและบันทึก audit ก่อนเปิดเผยชื่อ/อีเมลเต็ม
// ============================================================
router.get("/users", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, name, email,email_encrypted, email_verified_at, role_id, status, created_at FROM users ORDER BY id DESC",
    );
    const [membershipRows] = await db.query(
      `SELECT om.user_id, om.id, om.organization_id, om.role_id, om.status, om.is_primary,
              o.name organization_name, r.name role_name
         FROM organization_memberships om
         JOIN organizations o ON o.id=om.organization_id
         JOIN roles r ON r.id=om.role_id`,
    );
    const membershipsByUser = membershipRows.reduce((map, membership) => {
      (map[membership.user_id] ||= []).push(membership);
      return map;
    }, {});

    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "users.list.read",
      "user",
      "all",
      { count: rows.length },
    );

    const data = rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: accountEmail.decode(row, "users"),
      email_verified_at: row.email_verified_at,
      role_id: row.role_id,
      status: row.status,
      created_at: row.created_at,
      name: require("../utils/privateField").readField(
        row.name,
        "users",
        "name",
      ),
      memberships: membershipsByUser[row.id] || [],
    }));

    res.json(data);
  } catch (err) {
    console.error(
      "Error fetching users:",
      require("../utils/safeError").safeError(err),
    );
    res.status(err.status || 500).json({ message: "Server Error" });
  }
});

// The add/edit user modal needs school-specific choices for every organization,
// independent of the organization currently selected in the application shell.
router.get(
  "/users/assignment-options",
  verifyToken,
  verifySuperAdmin,
  async (_req, res) => {
    try {
      const [schools] = await db.query(
        `SELECT s.id, s.name, s.organization_id
           FROM schools s
           JOIN organizations o ON o.id=s.organization_id
          WHERE o.status='active' AND o.org_type='school'
          ORDER BY s.name`,
      );
      const [teacherTypes] = await db.query(
        `SELECT t.id, t.name, t.organization_id
           FROM school_teacher_types t
           JOIN organizations o ON o.id=t.organization_id
          WHERE t.status='active' AND o.status='active' AND o.org_type='school'
          ORDER BY t.sort_order,t.name`,
      );
      const [grades] = await db.query(
        `SELECT g.id, g.name, g.school_id, s.organization_id
           FROM school_grade_levels g
           JOIN schools s ON s.id=g.school_id
           JOIN organizations o ON o.id=s.organization_id
          WHERE g.status='active' AND o.status='active' AND o.org_type='school'
          ORDER BY g.level_order,g.id`,
      );
      const organizationIds = new Set([
        ...schools.map((row) => Number(row.organization_id)),
        ...teacherTypes.map((row) => Number(row.organization_id)),
      ]);
      res.json({
        organizations: Object.fromEntries(
          [...organizationIds].map((organizationId) => [
            organizationId,
            {
              schools: schools.filter(
                (row) => Number(row.organization_id) === organizationId,
              ),
              teacher_types: teacherTypes.filter(
                (row) => Number(row.organization_id) === organizationId,
              ),
              grades: grades
                .filter((row) => Number(row.organization_id) === organizationId)
                .map(({ id, name, school_id }) => ({ id, name, school_id })),
              role_labels: schoolRoleLabels,
            },
          ]),
        ),
      });
    } catch (error) {
      console.error(
        "Error fetching user assignment options:",
        require("../utils/safeError").safeError(error),
      );
      res
        .status(500)
        .json({ message: "ไม่สามารถโหลดตัวเลือกบุคลากรโรงเรียนได้" });
    }
  },
);

// ============================================================
//  GET /users/:id/full  →  ดูข้อมูลจริง (สำหรับ admin)
//  เพิ่มใหม่: ดูข้อมูลเต็มโดย decrypt ไม่ mask
// ============================================================
router.get(
  "/users/:id/full",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    try {
      const [rows] = await db.query(
        "SELECT id, username, name, email,email_encrypted, email_verified_at, role_id, status, created_at FROM users WHERE id = ?",
        [req.params.id],
      );
      if (rows.length === 0)
        return res.status(404).json({ message: "ไม่พบผู้ใช้" });

      const row = rows[0];
      const [memberships] = await db.query(
        `SELECT om.id, om.organization_id, om.role_id, om.status, om.is_primary, o.name organization_name, r.name role_name
         FROM organization_memberships om JOIN organizations o ON o.id=om.organization_id JOIN roles r ON r.id=om.role_id WHERE om.user_id=?`,
        [row.id],
      );
      const [schoolAssignments] = await db.query(
        `SELECT s.organization_id, s.id AS school_id, s.name AS school_name,
                COALESCE(sr.role_code,'other') AS role_code,
                COALESCE(sr.grade_scoped,0) AS grade_scoped,
                (SELECT JSON_ARRAYAGG(rg.grade_level_id) FROM school_staff_role_grades rg
                  WHERE rg.school_id=s.id AND rg.user_id=?) AS grade_level_ids,
                CASE WHEN t.id IS NULL OR t.status <> 'active' THEN 'staff' ELSE 'teacher' END AS personnel_kind,
                t.id AS teacher_id, t.teacher_type_id, t.employee_code, t.position
           FROM schools s
           LEFT JOIN school_staff_roles sr
             ON sr.school_id=s.id AND sr.user_id=? AND sr.status='active'
           LEFT JOIN school_teachers t
             ON t.school_id=s.id AND t.user_id=? AND t.status='active'
          WHERE sr.user_id IS NOT NULL OR t.user_id IS NOT NULL
          ORDER BY s.name`,
        [row.id, row.id, row.id],
      );
      // null = the whole school; a list = a counselor limited to those grades.
      for (const assignment of schoolAssignments) {
        const ids =
          typeof assignment.grade_level_ids === "string"
            ? JSON.parse(assignment.grade_level_ids)
            : assignment.grade_level_ids;
        assignment.grade_level_ids = Number(assignment.grade_scoped)
          ? (ids || []).map(Number)
          : null;
        delete assignment.grade_scoped;
      }
      const actorRoleId = Number(req.user.role_id);
      if (
        actorRoleId !== 1 &&
        Number(row.role_id) <= actorRoleId &&
        Number(row.id) !== Number(req.user.id)
      ) {
        return res
          .status(403)
          .json({ message: "คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้นี้" });
      }
      await require("../utils/pdpaAudit").requiredAudit(
        req,
        "users.full.read",
        "user",
        row.id,
      );
      res.json({
        id: row.id,
        username: row.username,
        email: accountEmail.decode(row, "users"),
        email_verified_at: row.email_verified_at,
        role_id: row.role_id,
        status: row.status,
        created_at: row.created_at,
        // ── decrypt ข้อมูลจริง ──
        name: require("../utils/privateField").readField(
          row.name,
          "users",
          "name",
        ),
        memberships,
        school_assignments: schoolAssignments,
      });
    } catch (err) {
      console.error(
        "Error fetching user full:",
        require("../utils/safeError").safeError(err),
      );
      res.status(err.status || 500).json({ message: "Server Error" });
    }
  },
);

// ============================================================
//  2. สร้างผู้ใช้งานใหม่  POST /users
//     → encrypt name ก่อน INSERT
//     → hash password ด้วย bcryptjs
// ============================================================
router.post("/users", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { role_id, status } = req.body;
    const validated = validateUserInput(req.body, { requirePassword: true });
    if (validated.error)
      return res.status(422).json({ message: validated.error });
    const { username, password, name, email } = validated.value;
    const requestedRoleId = normaliseSystemRoleId(role_id);
    if (!requestedRoleId) {
      return res.status(422).json({ message: "ระดับสิทธิ์ไม่ถูกต้อง" });
    }
    if (
      !req.authorization?.isSystemAdmin &&
      requestedRoleId <= Number(req.user.role_id)
    ) {
      return res
        .status(403)
        .json({ message: "Admin เพิ่มได้เฉพาะผู้ใช้ระดับ Staff" });
    }
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const encName = name
      ? require("../utils/privateField").writeField(name, "users", "name")
      : null;

    const [result] = await db.query(
      `INSERT INTO users
        (username, password, name, email, email_encrypted,email_hash, role_id, status, email_verified_at, auth_version)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?, NULL, 0)`,
      [
        username,
        hashedPassword,
        encName,
        accountEmail.encode(email, "users"),
        accountEmail.lookup(email),
        requestedRoleId,
        status || "active",
      ],
    );
    if (requestedRoleId === 1) {
      await db.query(
        "INSERT IGNORE INTO user_system_roles (user_id, system_role_id) VALUES (?, 1)",
        [result.insertId],
      );
    }

    res
      .status(201)
      .json({ id: result.insertId, message: "สร้างผู้ใช้งานสำเร็จ" });
  } catch (err) {
    console.error(
      "Error creating user:",
      require("../utils/safeError").safeError(err),
    );

    // 🔥 เพิ่มส่วนนี้: ดักจับ Error กรณีข้อมูลซ้ำ (ER_DUP_ENTRY)
    if (err.code === "ER_DUP_ENTRY") {
      return res
        .status(400)
        .json({ message: "Username นี้มีคนใช้แล้ว กรุณาเปลี่ยนใหม่" });
    }

    // ถ้าเป็น Error อื่นๆ ก็ปล่อยไปตามปกติ
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// Keep organization membership, school duty, and teacher-list membership in
// one transaction. This is the canonical assignment write used by the user
// editor, so a school employee never has to be entered a second time.
router.put(
  "/users/:id/assignments",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    if (!positiveId(req.params.id))
      return res.status(422).json({ message: "รหัสผู้ใช้ไม่ถูกต้อง" });
    const normalized = normalizeUserAssignments(req.body);
    if (normalized.error)
      return res.status(422).json({ message: normalized.error });
    const memberships = normalized.value;
    if (memberships.filter((item) => item.is_primary).length > 1)
      return res
        .status(422)
        .json({ message: "กำหนดหน่วยงานหลักได้เพียงหนึ่งหน่วยงาน" });

    const userId = Number(req.params.id);
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const [users] = await connection.query(
        "SELECT id,status FROM users WHERE id=? FOR UPDATE",
        [userId],
      );
      if (!users.length) {
        await connection.rollback();
        return res.status(404).json({ message: "ไม่พบผู้ใช้" });
      }

      const [existingMemberships] = await connection.query(
        "SELECT id,organization_id,role_id,status FROM organization_memberships WHERE user_id=? FOR UPDATE",
        [userId],
      );
      const wantedOrganizations = new Set(
        memberships.map((item) => item.organization_id),
      );

      for (const membership of memberships) {
        const [[organization]] = await connection.query(
          "SELECT id,org_type FROM organizations WHERE id=? AND status='active' AND org_level='unit' FOR UPDATE",
          [membership.organization_id],
        );
        if (!organization)
          throw Object.assign(new Error("ไม่พบหน่วยงานที่เลือก"), {
            status: 422,
          });
        const [[role]] = await connection.query(
          `SELECT r.id FROM roles r
            WHERE r.id=? AND r.id<>1
              AND (EXISTS (SELECT 1 FROM organization_role_permission_sets s WHERE s.organization_id=? AND s.role_id=r.id)
                OR EXISTS (SELECT 1 FROM organization_role_permissions p WHERE p.organization_id=? AND p.role_id=r.id)
                OR EXISTS (SELECT 1 FROM organization_memberships m WHERE m.organization_id=? AND m.role_id=r.id))
            LIMIT 1`,
          [
            membership.role_id,
            membership.organization_id,
            membership.organization_id,
            membership.organization_id,
          ],
        );
        if (!role)
          throw Object.assign(new Error("บทบาทไม่อยู่ในหน่วยงานที่เลือก"), {
            status: 422,
          });
        if (organization.org_type === "school" && !membership.school_assignment)
          throw Object.assign(
            new Error("กรุณาระบุข้อมูลบุคลากรของหน่วยงานโรงเรียน"),
            { status: 422 },
          );
        if (organization.org_type !== "school" && membership.school_assignment)
          throw Object.assign(
            new Error("ข้อมูลบุคลากรโรงเรียนไม่ตรงกับหน่วยงาน"),
            {
              status: 422,
            },
          );

        await connection.query(
          `INSERT INTO organization_memberships
             (user_id,organization_id,role_id,status,is_primary)
           VALUES (?,?,?,'active',?)
           ON DUPLICATE KEY UPDATE role_id=VALUES(role_id),status='active',is_primary=VALUES(is_primary)`,
          [
            userId,
            membership.organization_id,
            membership.role_id,
            membership.is_primary,
          ],
        );
        const [[savedMembership]] = await connection.query(
          "SELECT id FROM organization_memberships WHERE user_id=? AND organization_id=?",
          [userId, membership.organization_id],
        );
        await require("../authorization/dataPermissions").resetMigratedGrants(
          connection,
          savedMembership.id,
          membership.role_id,
          membership.organization_id,
        );

        if (organization.org_type !== "school") continue;
        const assignment = membership.school_assignment;
        const [[school]] = await connection.query(
          "SELECT id FROM schools WHERE id=? AND organization_id=? FOR UPDATE",
          [assignment.school_id, membership.organization_id],
        );
        if (!school)
          throw Object.assign(new Error("โรงเรียนไม่อยู่ในหน่วยงานที่เลือก"), {
            status: 422,
          });
        if (assignment.personnel_kind === "teacher") {
          const [[teacherType]] = await connection.query(
            "SELECT id FROM school_teacher_types WHERE id=? AND organization_id=? AND status='active' FOR UPDATE",
            [assignment.teacher_type_id, membership.organization_id],
          );
          if (!teacherType)
            throw Object.assign(
              new Error("ประเภทครูไม่อยู่ในหน่วยงานที่เลือก"),
              {
                status: 422,
              },
            );
        }

        await connection.query(
          `UPDATE school_staff_roles sr
             JOIN schools s ON s.id=sr.school_id
              SET sr.status='inactive',sr.updated_by=?
            WHERE sr.user_id=? AND s.organization_id=? AND sr.school_id<>?`,
          [req.user.id, userId, membership.organization_id, school.id],
        );
        await connection.query(
          `UPDATE school_teachers t
             JOIN schools s ON s.id=t.school_id
              SET t.status='inactive'
            WHERE t.user_id=? AND s.organization_id=? AND t.school_id<>?`,
          [userId, membership.organization_id, school.id],
        );
        await connection.query(
          `INSERT INTO school_staff_roles
             (school_id,user_id,role_code,status,updated_by)
           VALUES (?,?,?,'active',?)
           ON DUPLICATE KEY UPDATE role_code=VALUES(role_code),status='active',updated_by=VALUES(updated_by)`,
          [school.id, userId, assignment.role_code, req.user.id],
        );
        await saveCounselorGrades(connection, {
          schoolId: school.id,
          userId,
          roleCode: assignment.role_code,
          gradeLevelIds: assignment.grade_level_ids,
          actorId: req.user.id,
        });
        if (assignment.personnel_kind === "teacher") {
          await upsertSchoolTeacher(connection, {
            schoolId: school.id,
            userId,
            teacherTypeId: assignment.teacher_type_id,
            employeeCode: assignment.employee_code,
            position: assignment.position,
          });
        } else {
          await deactivateSchoolTeacher(connection, {
            schoolId: school.id,
            userId,
          });
        }
      }

      for (const membership of existingMemberships) {
        if (wantedOrganizations.has(Number(membership.organization_id)))
          continue;
        await connection.query(
          "UPDATE organization_memberships SET status='inactive',is_primary=0 WHERE id=?",
          [membership.id],
        );
        await connection.query(
          `UPDATE school_staff_roles sr JOIN schools s ON s.id=sr.school_id
              SET sr.status='inactive',sr.updated_by=?
            WHERE sr.user_id=? AND s.organization_id=?`,
          [req.user.id, userId, membership.organization_id],
        );
        await connection.query(
          `UPDATE school_teachers t JOIN schools s ON s.id=t.school_id
              SET t.status='inactive'
            WHERE t.user_id=? AND s.organization_id=?`,
          [userId, membership.organization_id],
        );
      }

      await require("../utils/pdpaAudit").requiredAudit(
        req,
        "users.assignments.update",
        "user",
        userId,
        {
          organizations: memberships.map((item) => item.organization_id),
          school_count: memberships.filter((item) => item.school_assignment)
            .length,
        },
        connection,
      );
      await connection.commit();
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      console.error(
        "Error updating user assignments:",
        require("../utils/safeError").safeError(error),
      );
      res.status(error.status || 500).json({
        message:
          error.status && error.message
            ? error.message
            : "ไม่สามารถบันทึกหน่วยงานและบทบาทได้",
      });
    } finally {
      connection.release();
    }
  },
);

// ============================================================
//  3. แก้ไขข้อมูลผู้ใช้  PUT /users/:id
//     → re-encrypt ทุกครั้งที่แก้ไข
// ============================================================
router.put("/users/:id", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    if (isNaN(Number(req.params.id))) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    const { role_id, status } = req.body;
    const validated = validateUserInput(req.body);
    if (validated.error)
      return res.status(422).json({ message: validated.error });
    const { username, name, email, password } = validated.value;
    const requestedRoleId = normaliseSystemRoleId(role_id);
    if (!requestedRoleId) {
      return res.status(422).json({ message: "ระดับสิทธิ์ไม่ถูกต้อง" });
    }
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (
      password &&
      (typeof password !== "string" ||
        password.length < 8 ||
        password.length > 200)
    ) {
      return res
        .status(400)
        .json({ message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" });
    }

    const [existingRows] = await db.query(
      "SELECT id, role_id, status, email,email_encrypted FROM users WHERE id = ?",
      [req.params.id],
    );
    if (!existingRows.length)
      return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const existing = existingRows[0];
    const actorRoleId = Number(req.user.role_id);
    const isSelf = Number(existing.id) === Number(req.user.id);
    if (!req.authorization?.isSystemAdmin) {
      const canManageTarget = Number(existing.role_id) > actorRoleId;
      const preservesOwnAccess =
        isSelf &&
        requestedRoleId === Number(existing.role_id) &&
        status === existing.status;
      if (!canManageTarget && !preservesOwnAccess) {
        return res
          .status(403)
          .json({ message: "คุณไม่มีสิทธิ์แก้ไขผู้ใช้นี้" });
      }
      if (!isSelf && requestedRoleId <= actorRoleId) {
        return res
          .status(403)
          .json({ message: "Admin กำหนดได้เฉพาะระดับ Staff" });
      }
    }

    // ✅ Encrypt เฉพาะตอนมีค่า
    const encName = name
      ? require("../utils/privateField").writeField(name, "users", "name")
      : null;

    let fields = [];
    let values = [];

    // ── field พื้นฐาน ──
    fields.push("username=?");
    values.push(username);
    fields.push("name=?");
    values.push(encName);
    fields.push("email=NULL", "email_encrypted=?", "email_hash=?");
    values.push(
      accountEmail.encode(email, "users"),
      accountEmail.lookup(email),
    );
    if (email !== accountEmail.decode(existing, "users")) {
      fields.push("email_verified_at=NULL");
      fields.push("auth_version=auth_version+1");
    }
    fields.push("role_id=?");
    values.push(requestedRoleId);
    fields.push("status=?");
    values.push(status || existing.status);

    // 🔐 password
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 12);
      fields.push("password=?");
      values.push(hashedPassword);
      fields.push("auth_version=auth_version+1");
    }

    values.push(req.params.id);

    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "users.permissions.update",
      "user",
      req.params.id,
    );
    await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, values);
    if (requestedRoleId === 1) {
      await db.query(
        "INSERT IGNORE INTO user_system_roles (user_id, system_role_id) VALUES (?, 1)",
        [req.params.id],
      );
    } else {
      await db.query(
        "DELETE FROM user_system_roles WHERE user_id=? AND system_role_id=1",
        [req.params.id],
      );
    }

    res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error(
      "Error updating user:",
      require("../utils/safeError").safeError(err),
    );
    res
      .status(err.status || 500)
      .json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ============================================================
//  4. ลบผู้ใช้  DELETE /users/:id
// ============================================================
router.delete("/users/:id", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    if (!Number.isInteger(Number(req.params.id))) {
      return res.status(422).json({ message: "รหัสผู้ใช้ไม่ถูกต้อง" });
    }
    const [rows] = await db.query(
      "SELECT id, role_id FROM users WHERE id = ?",
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const target = rows[0];
    if (Number(target.id) === Number(req.user.id)) {
      return res.status(422).json({ message: "ไม่สามารถลบบัญชีของตนเองได้" });
    }
    if (
      !req.authorization?.isSystemAdmin &&
      Number(target.role_id) <= Number(req.user.role_id)
    ) {
      return res.status(403).json({ message: "คุณไม่มีสิทธิ์ลบผู้ใช้นี้" });
    }
    // organization_memberships and user_system_roles reference users with
    // ON DELETE RESTRICT, so they must be removed in the same transaction.
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        "DELETE FROM organization_memberships WHERE user_id=?",
        [req.params.id],
      );
      await connection.query("DELETE FROM user_system_roles WHERE user_id=?", [
        req.params.id,
      ]);
      await connection.query("DELETE FROM users WHERE id=?", [req.params.id]);
      await require("../utils/pdpaAudit").requiredAudit(
        req,
        "users.permissions.delete",
        "user",
        req.params.id,
        {},
        connection,
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    res.json({ message: "ลบผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error(
      "Error deleting user:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
