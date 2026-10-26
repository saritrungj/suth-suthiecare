const { upsertSchoolTeacher } = require("../utils/schoolTeachers");
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { canManageStaffAt } = require("../utils/schoolAccess");
const { validateUserInput } = require("../utils/userValidation");
const {
  generateTemporaryPassword,
  MAX_IMPORT_ROWS,
} = require("../utils/studentImport");
const { isStrongPassword } = require("../utils/passwordPolicy");
const { requiredAudit } = require("../utils/pdpaAudit");
const accountEmail = require("../utils/accountEmail");
const { saveCounselorGrades } = require("../utils/schoolStaffRoles");
const router = express.Router();

router.post("/teachers/import", async (req, res) => {
  const { school_id, rows, dry_run = true } = req.body || {};
  const [[school]] = await db.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [school_id, req.organizationContext],
  );
  if (!school || !canManageStaffAt(req.schoolAccess, school.id, "create"))
    return res
      .status(403)
      .json({ message: "ไม่มีสิทธิ์นำเข้าครูของโรงเรียนนี้" });
  if (
    typeof dry_run !== "boolean" ||
    !Array.isArray(rows) ||
    !rows.length ||
    rows.length > MAX_IMPORT_ROWS
  )
    return res
      .status(422)
      .json({ message: "จำนวนแถวหรือโหมดนำเข้าไม่ถูกต้อง" });
  const connection = await db.getConnection(),
    results = [],
    seen = new Set();
  try {
    await connection.beginTransaction();
    const [[baseRole]] = await connection.query(
      "SELECT id FROM roles WHERE name='school_import_staff' AND id<>1 LIMIT 1",
    );
    if (!baseRole)
      throw Object.assign(new Error("กรุณาใช้ migration School ก่อนนำเข้า"), {
        status: 503,
      });
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] || {},
        checked = validateUserInput({
          username: raw.username,
          name: raw.name,
          email: raw.email,
        });
      const result = {
        row: i + 1,
        username: raw.username,
        status: "error",
        errors: [],
      };
      results.push(result);
      if (checked.error) {
        result.errors.push(checked.error);
        continue;
      }
      const value = checked.value,
        role = raw.role_code || "other";
      if (
        ![
          "other",
          "homeroom",
          "counselor",
          "subject_teacher",
          "dorm_staff",
        ].includes(role)
      ) {
        result.errors.push(
          "บทบาทที่นำเข้าได้: ครูทั่วไป ครูประจำชั้น ครูแนะแนว ครูรายวิชา หรือเจ้าหน้าที่หอพัก",
        );
        continue;
      }
      if (
        raw.initial_password &&
        !isStrongPassword(String(raw.initial_password))
      ) {
        result.errors.push("รหัสผ่านตั้งต้นไม่ผ่านนโยบาย");
        continue;
      }
      const key = value.username.toLowerCase();
      if (seen.has(key)) {
        result.errors.push("ชื่อผู้ใช้ซ้ำในไฟล์");
        continue;
      }
      seen.add(key);
      const [existing] = await connection.query(
        "SELECT u.id,om.status AS membership_status FROM users u LEFT JOIN organization_memberships om ON om.user_id=u.id AND om.organization_id=? WHERE u.username=?",
        [req.organizationContext, value.username],
      );
      if (existing[0] && existing[0].membership_status !== "active") {
        result.errors.push(
          "บัญชีนี้มีอยู่แล้วแต่ไม่ใช่สมาชิกที่ใช้งานในหน่วยงานนี้",
        );
        continue;
      }
      // A subject teacher may list several rooms of one grade ("1, 2, 3");
      // every other duty takes at most one room.
      const roomCell = String(raw.classroom || "");
      const roomNames = (
        role === "subject_teacher" ? roomCell.split(",") : [roomCell]
      )
        .map((name) => name.trim())
        .filter(Boolean);
      const rooms = [];
      for (const name of roomNames) {
        const [[found]] = await connection.query(
          "SELECT c.id FROM school_classrooms c JOIN school_grade_levels g ON g.id=c.grade_level_id WHERE c.school_id=? AND c.name=? AND g.name=? AND c.academic_year=? AND c.status='active'",
          [school.id, name, String(raw.grade || ""), Number(raw.academic_year)],
        );
        if (!found) break;
        rooms.push(found);
      }
      if (rooms.length !== roomNames.length) {
        result.errors.push("ไม่พบห้องเรียน ชั้นปี และปีการศึกษาที่ระบุ");
        continue;
      }
      const room = rooms[0] || null;
      if (role === "homeroom" && !room) {
        result.errors.push("ครูประจำชั้นต้องระบุชั้นปี ห้อง และปีการศึกษา");
        continue;
      }
      // A counselor row with grades but no room limits them to those grades
      // ("ม.1, ม.2, ม.3"); no grade = the whole school.
      let counselorGrades;
      if (role === "counselor" && raw.grade && !room) {
        const names = [
          ...new Set(
            String(raw.grade)
              .split(/\s*,\s*/)
              .map((name) => name.trim())
              .filter(Boolean),
          ),
        ];
        const [grades] = await connection.query(
          "SELECT id,name FROM school_grade_levels WHERE school_id=? AND status='active' AND name IN (?)",
          [school.id, names],
        );
        if (grades.length !== names.length) {
          result.errors.push("ไม่พบระดับชั้นที่ครูแนะแนวดูแลตามที่ระบุ");
          continue;
        }
        counselorGrades = grades.map((g) => Number(g.id));
      }
      if (!existing[0]) {
        const [[emailOwner]] = await connection.query(
          "SELECT id FROM users WHERE email_hash=? OR (email_hash IS NULL AND email=?)",
          [accountEmail.lookup(value.email), value.email],
        );
        if (emailOwner) {
          result.errors.push("อีเมลนี้มีบัญชีแล้ว กรุณาใช้ชื่อผู้ใช้เดิม");
          continue;
        }
      }
      if (dry_run) {
        result.status = existing[0] ? "will_link" : "will_create";
        continue;
      }
      await connection.query("SAVEPOINT teacher_row");
      try {
        let userId = existing[0]?.id;
        if (!userId) {
          const password = raw.initial_password || generateTemporaryPassword();
          const [insert] = await connection.query(
            "INSERT INTO users (username,password,name,email,email_encrypted,email_hash,role_id,status,email_verified_at,auth_version) VALUES (?,?,?,NULL,?,?,?,'active',NULL,0)",
            [
              value.username,
              await bcrypt.hash(password, 12),
              require("../utils/privateField").writeField(
                value.name,
                "users",
                "name",
              ),
              accountEmail.encode(value.email, "users"),
              accountEmail.lookup(value.email),
              baseRole.id,
            ],
          );
          userId = insert.insertId;
          result.password = password;
          await connection.query(
            "INSERT INTO organization_memberships (user_id,organization_id,role_id,status) VALUES (?,?,?,'active')",
            [userId, req.organizationContext, baseRole.id],
          );
        }
        await upsertSchoolTeacher(connection, {
          schoolId: school.id,
          userId,
          employeeCode: String(raw.employee_code || "").slice(0, 50) || null,
        });
        await connection.query(
          "INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,?,'active',?) ON DUPLICATE KEY UPDATE role_code=VALUES(role_code),status='active',updated_by=VALUES(updated_by)",
          [school.id, userId, role, req.user.id],
        );
        await saveCounselorGrades(connection, {
          schoolId: school.id,
          userId,
          roleCode: role,
          gradeLevelIds:
            role === "counselor" ? (counselorGrades ?? null) : null,
          actorId: req.user.id,
        });
        if (rooms.length) {
          const [[teacher]] = await connection.query(
            "SELECT id FROM school_teachers WHERE school_id=? AND user_id=?",
            [school.id, userId],
          );
          const seat = role === "subject_teacher" ? "subject" : "homeroom";
          for (const seated of rooms)
            await connection.query(
              "INSERT INTO school_classroom_teachers (classroom_id,teacher_id,role) VALUES (?,?,?) ON DUPLICATE KEY UPDATE role=VALUES(role)",
              [seated.id, teacher.id, seat],
            );
        }
        result.status = existing[0] ? "linked" : "created";
        await connection.query("RELEASE SAVEPOINT teacher_row");
      } catch (error) {
        await connection.query("ROLLBACK TO SAVEPOINT teacher_row");
        delete result.password;
        if (error.code !== "ER_DUP_ENTRY") throw error;
        result.errors.push("ข้อมูลซ้ำกับบัญชีหรือครูที่มีอยู่");
      }
    }
    if (dry_run) await connection.rollback();
    else {
      await requiredAudit(
        req,
        "school.teachers.import",
        "school",
        school.id,
        { count: results.filter((r) => r.status !== "error").length },
        connection,
      );
      await connection.commit();
    }
    res.set("Cache-Control", "no-store");
    res.json({ dry_run, results });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
module.exports = router;
