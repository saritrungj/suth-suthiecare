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
const { verifyToken, requirePermission, verifySuperAdmin } = require("../middleware/authMiddleware");
const { validateUserInput } = require("../utils/userValidation");
const {
  audit: auditPatient,
  validatePersonName,
  validatePhone,
  getExistingPhone,
  hmacHash,
} = require("../utils/patientAuth");

const { encrypt, decrypt, maskName } = require("../utils/encryption");
const { organizationWhere } = require("../authorization/authorization");

function safeDecrypt(value) {
  try {
    return decrypt(value);
  } catch (e) {
    return value;
  }
}

function safePatientDecrypt(value) {
  if (!value) return "";
  try {
    return decrypt(value) || "";
  } catch {
    return "";
  }
}

const patientMemberStatuses = new Set([
  "pending_verification",
  "active",
  "locked",
  "disabled",
]);

function patientOrganizationClause(req, alias = "patient_accounts") {
  const scope = organizationWhere("fr.organization_id", req);
  return { sql: `EXISTS (SELECT 1 FROM form_responses fr WHERE fr.patient_account_id = ${alias}.id${scope.sql})`, params: scope.params };
}

async function ensurePatientOrganization(req, res, next) {
  if (!req.path.match(/^\/patient-members\/\d+/) || !req.authorization) return next();
  if (req.authorization.isSystemAdmin) return next();
  const clause = patientOrganizationClause(req);
  const [rows] = await db.query(`SELECT id FROM patient_accounts WHERE id=? AND ${clause.sql} LIMIT 1`, [req.params.id, ...clause.params]);
  if (!rows.length) return res.status(403).json({ success: false, message: "คุณไม่มีสิทธิ์เข้าถึงผู้มารับบริการรายนี้" });
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
    const search = String(req.query.search || "").trim().slice(0, 80);
    const status = String(req.query.status || "").trim();

    if (status && !patientMemberStatuses.has(status)) {
      return res.status(422).json({ message: "สถานะสมาชิกไม่ถูกต้อง" });
    }

    const conditions = [];
    const values = [];
    if (req.authorization && !req.authorization.isSystemAdmin) {
      const clause = patientOrganizationClause(req);
      conditions.push(clause.sql);
      values.push(...clause.params);
    }
    if (search) {
      conditions.push("username LIKE ?");
      values.push(`%${search}%`);
    }
    if (status) {
      conditions.push("status = ?");
      values.push(status);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const [[countRow]] = await db.query(
        `SELECT COUNT(*) AS total FROM patient_accounts ${where}`,
        values,
      );
      const [rows] = await db.query(
        `SELECT id, username, first_name_encrypted, last_name_encrypted,
                status, verified_at, last_login_at, created_at
         FROM patient_accounts
         ${where}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset],
      );
      const total = Number(countRow?.total || 0);

      return res.json({
        data: rows.map((row) => ({
          id: row.id,
          username: row.username,
          full_name: [
            safePatientDecrypt(row.first_name_encrypted),
            safePatientDecrypt(row.last_name_encrypted),
          ]
            .filter(Boolean)
            .join(" ") || "—",
          status: row.status,
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
      console.error("Error fetching patient members:", error.message);
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
                identity_hash, phone_encrypted, status, verified_at, last_login_at, created_at
         FROM patient_accounts WHERE id = ? LIMIT 1`,
        [memberId],
      );
      if (!rows.length) {
        return res.status(404).json({ message: "ไม่พบบัญชีผู้มารับบริการ" });
      }
      const member = rows[0];
      const phone =
        safePatientDecrypt(member.phone_encrypted) ||
        (await getExistingPhone(member.identity_hash)) ||
        "";
      return res.json({
        id: member.id,
        username: member.username,
        first_name: safePatientDecrypt(member.first_name_encrypted),
        last_name: safePatientDecrypt(member.last_name_encrypted),
        phone,
        status: member.status,
        verified_at: member.verified_at,
        last_login_at: member.last_login_at,
        created_at: member.created_at,
      });
    } catch (error) {
      console.error("Error fetching patient member:", error.message);
      return res.status(500).json({ message: "ไม่สามารถเปิดข้อมูลผู้มารับบริการได้" });
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

    const username = String(req.body.username || "").trim().toLowerCase();
    const firstName = validatePersonName(req.body.first_name, "ชื่อ");
    const lastName = validatePersonName(req.body.last_name, "นามสกุล");
    const phoneInput = String(req.body.phone || "").trim();
    const phone = phoneInput ? validatePhone(phoneInput) : null;
    const password = String(req.body.password || "");
    const status = String(req.body.status || "").trim();

    if (!/^[a-z0-9][a-z0-9._-]{2,79}$/.test(username)) {
      return res.status(422).json({ message: "ชื่อผู้ใช้ต้องเป็นภาษาอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง 3-80 ตัวอักษร" });
    }
    if (firstName.error) return res.status(422).json({ message: firstName.error });
    if (lastName.error) return res.status(422).json({ message: lastName.error });
    if (phoneInput && !phone) {
      return res.status(422).json({ message: "หมายเลขโทรศัพท์ไม่ถูกต้อง" });
    }
    if (password && (password.length < 8 || password.length > 128)) {
      return res.status(422).json({ message: "รหัสผ่านใหม่ต้องมีความยาว 8-128 ตัวอักษร" });
    }
    if (!patientMemberStatuses.has(status)) {
      return res.status(422).json({ message: "สถานะผู้มารับบริการไม่ถูกต้อง" });
    }

    try {
      const [existingRows] = await db.query(
        "SELECT id FROM patient_accounts WHERE id = ? LIMIT 1",
        [memberId],
      );
      if (!existingRows.length) {
        return res.status(404).json({ message: "ไม่พบบัญชีผู้มารับบริการ" });
      }

      const fields = [
        "username = ?",
        "first_name_encrypted = ?",
        "last_name_encrypted = ?",
        "phone_hash = ?",
        "phone_encrypted = ?",
        "status = ?",
        "failed_login_count = 0",
        "locked_until = NULL",
        "token_version = token_version + 1",
      ];
      const values = [
        username,
        encrypt(firstName.value),
        encrypt(lastName.value),
        phone ? hmacHash(phone) : null,
        phone ? encrypt(phone) : null,
        status,
      ];
      if (password) {
        fields.push("password_hash = ?");
        values.push(await bcrypt.hash(password, 12));
      }
      values.push(memberId);
      await db.query(
        `UPDATE patient_accounts SET ${fields.join(", ")} WHERE id = ?`,
        values,
      );
      await auditPatient(memberId, "admin_account_updated", req, {
        actor_user_id: req.user.id,
        password_changed: Boolean(password),
        status,
      });
      return res.json({ message: "บันทึกข้อมูลผู้มารับบริการเรียบร้อยแล้ว" });
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "ชื่อผู้ใช้นี้มีผู้ใช้งานแล้ว" });
      }
      console.error("Error updating patient member:", error.message);
      return res.status(500).json({ message: "ไม่สามารถบันทึกข้อมูลผู้มารับบริการได้" });
    }
  },
);

router.delete(
  "/patient-members/:id",
  verifyToken,
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
      await connection.query("DELETE FROM patient_accounts WHERE id = ?", [memberId]);
      await connection.commit();
      await auditPatient(null, "admin_account_deleted", req, {
        actor_user_id: req.user.id,
        deleted_patient_account_id: memberId,
        username: rows[0].username,
      });
      return res.json({ message: "ลบบัญชีผู้มารับบริการเรียบร้อยแล้ว" });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error("Error deleting patient member:", error.message);
      return res.status(500).json({ message: "ไม่สามารถลบบัญชีผู้มารับบริการได้" });
    } finally {
      connection?.release();
    }
  },
);

// ============================================================
//  1. ดึงข้อมูลผู้ใช้งานทั้งหมด  GET /users
//     → แสดงข้อมูลแบบ mask (ปลอดภัย ไม่เปิดเผยข้อมูลจริง)
// ============================================================
router.get("/users", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, name, email, role_id, status, created_at FROM users ORDER BY id DESC",
    );
    const [membershipRows] = await db.query(
      `SELECT om.user_id, om.id, om.organization_id, om.role_id, om.status, om.is_primary,
              o.name organization_name, r.name role_name
         FROM organization_memberships om
         JOIN organizations o ON o.id=om.organization_id
         JOIN roles r ON r.id=om.role_id`,
    );
    const membershipsByUser = membershipRows.reduce((map, membership) => {
      (map[membership.user_id] ||= []).push(membership); return map;
    }, {});

    // Decrypt แล้ว mask ก่อนส่งกลับ
    const data = rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      role_id: row.role_id,
      status: row.status,
      created_at: row.created_at,
      // ── ข้อมูลที่ encrypt → decrypt → mask ──
      name: maskName(safeDecrypt(row.name)),
      memberships: membershipsByUser[row.id] || [],
    }));

    res.json(data);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ============================================================
//  GET /users/:id/full  →  ดูข้อมูลจริง (สำหรับ admin)
//  เพิ่มใหม่: ดูข้อมูลเต็มโดย decrypt ไม่ mask
// ============================================================
router.get("/users/:id/full", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, username, name, email, role_id, status, created_at FROM users WHERE id = ?",
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
    const actorRoleId = Number(req.user.role_id);
    if (actorRoleId !== 1 && Number(row.role_id) <= actorRoleId && Number(row.id) !== Number(req.user.id)) {
      return res.status(403).json({ message: "คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้นี้" });
    }
    res.json({
      id: row.id,
      username: row.username,
      email: row.email,
      role_id: row.role_id,
      status: row.status,
      created_at: row.created_at,
      // ── decrypt ข้อมูลจริง ──
      name: decrypt(row.name),
      memberships,
    });
  } catch (err) {
    console.error("Error fetching user full:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

// ============================================================
//  2. สร้างผู้ใช้งานใหม่  POST /users
//     → encrypt name ก่อน INSERT
//     → hash password ด้วย bcryptjs
// ============================================================
router.post("/users", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const { role_id, status } = req.body;
    const validated = validateUserInput(req.body, { requirePassword: true });
    if (validated.error) return res.status(422).json({ message: validated.error });
    const { username, password, name, email } = validated.value;
    const requestedRoleId = Number(role_id);
    if (!Number.isInteger(requestedRoleId) || requestedRoleId < 1) {
      return res.status(422).json({ message: "ระดับสิทธิ์ไม่ถูกต้อง" });
    }
    if (Number(req.user.role_id) !== 1 && requestedRoleId <= Number(req.user.role_id)) {
      return res.status(403).json({ message: "Admin เพิ่มได้เฉพาะผู้ใช้ระดับ Staff" });
    }
    if (status && !["active", "inactive", "suspended"].includes(status)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const encName = name ? encrypt(name) : null;

    const [result] = await db.query(
      `INSERT INTO users
        (username, password, name, email, role_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, encName, email, requestedRoleId, status || "active"],
    );
    if (requestedRoleId === 1) {
      await db.query("INSERT IGNORE INTO user_system_roles (user_id, system_role_id) VALUES (?, 1)", [result.insertId]);
    }

    res
      .status(201)
      .json({ id: result.insertId, message: "สร้างผู้ใช้งานสำเร็จ" });
  } catch (err) {
    console.error("Error creating user:", err);

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
    if (validated.error) return res.status(422).json({ message: validated.error });
    const { username, name, email, password } = validated.value;
    const requestedRoleId = Number(role_id);
    if (!Number.isInteger(requestedRoleId) || requestedRoleId < 1) {
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

    const [existingRows] = await db.query("SELECT id, role_id, status FROM users WHERE id = ?", [req.params.id]);
    if (!existingRows.length) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const existing = existingRows[0];
    const actorRoleId = Number(req.user.role_id);
    const isSelf = Number(existing.id) === Number(req.user.id);
    if (actorRoleId !== 1) {
      const canManageTarget = Number(existing.role_id) > actorRoleId;
      const preservesOwnAccess = isSelf && requestedRoleId === Number(existing.role_id) && status === existing.status;
      if (!canManageTarget && !preservesOwnAccess) {
        return res.status(403).json({ message: "คุณไม่มีสิทธิ์แก้ไขผู้ใช้นี้" });
      }
      if (!isSelf && requestedRoleId <= actorRoleId) {
        return res.status(403).json({ message: "Admin กำหนดได้เฉพาะระดับ Staff" });
      }
    }

    // ✅ Encrypt เฉพาะตอนมีค่า
    const encName = name ? encrypt(name) : null;

    let fields = [];
    let values = [];

    // ── field พื้นฐาน ──
    fields.push("username=?");
    values.push(username);
    fields.push("name=?");
    values.push(encName);
    fields.push("email=?");
    values.push(email);
    fields.push("role_id=?");
    values.push(requestedRoleId);
    fields.push("status=?");
    values.push(status);

    // 🔐 password
    if (password && password.trim() !== "") {
      const hashedPassword = await bcrypt.hash(password, 12);
      fields.push("password=?");
      values.push(hashedPassword);
    }

    values.push(req.params.id);

    await db.query(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, values);
    if (requestedRoleId === 1) {
      await db.query("INSERT IGNORE INTO user_system_roles (user_id, system_role_id) VALUES (?, 1)", [req.params.id]);
    } else {
      await db.query("DELETE FROM user_system_roles WHERE user_id=? AND system_role_id=1", [req.params.id]);
    }

    res.json({ message: "อัปเดตข้อมูลผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
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
    const [rows] = await db.query("SELECT id, role_id FROM users WHERE id = ?", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "ไม่พบผู้ใช้" });
    const target = rows[0];
    if (Number(target.id) === Number(req.user.id)) {
      return res.status(422).json({ message: "ไม่สามารถลบบัญชีของตนเองได้" });
    }
    if (Number(req.user.role_id) !== 1 && Number(target.role_id) <= Number(req.user.role_id)) {
      return res.status(403).json({ message: "คุณไม่มีสิทธิ์ลบผู้ใช้นี้" });
    }
    await db.query("DELETE FROM users WHERE id=?", [req.params.id]);
    res.json({ message: "ลบผู้ใช้สำเร็จ" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
