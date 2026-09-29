// routes/roleRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { AGENCY_PERMISSIONS } = require("../agency/permissions");
const {
  verifyToken,
  verifySuperAdmin,
} = require("../middleware/authMiddleware");
const { normaliseText } = require("../utils/userValidation");

const permissionValue = (permission, english, thai) =>
  Boolean(permission?.[english] ?? permission?.[thai]);
const validRoleId = (value) =>
  Number.isInteger(Number(value)) && Number(value) > 0;

const PERMISSION_KEYS = [
  "dashboard.view",
  "cases.view",
  "cases.create",
  "cases.update",
  "cases.delete",
  "cases.assign",
  "cases.export",
  "appointments.view",
  "appointments.create",
  "appointments.update",
  "appointments.delete",
  "patient_members.view",
  "patient_members.update",
  "patient_members.delete",
  "forms.view",
  "forms.create",
  "forms.update",
  "forms.delete",
  "clinics.view",
  "clinics.create",
  "clinics.update",
  "clinics.delete",
  "help_center.view",
  "help_center.create",
  "help_center.update",
  "help_center.delete",
  "content.view",
  "content.create",
  "content.update",
  "content.delete",
  "agency_entries.create",
  "agency_entries.view",
  "agency_entries.verify",
];

async function isProtectedAgencyRole(id) {
  const [rows] = await db.query("SELECT code FROM roles WHERE id=?", [id]);
  return rows[0]?.code === "agency_data_encoder";
}

// Role templates are global administration and are never editable by an organization role.
router.get("/roles", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM roles");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 2. ดึง Permission ของแต่ละ Role
router.get(
  "/roles/:id/permissions",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    try {
      const requestedRoleId = Number(req.params.id);
      if (!validRoleId(requestedRoleId))
        return res.status(422).json({ message: "รหัสบทบาทไม่ถูกต้อง" });
      const [rows] = await db.query(
        "SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key",
        [requestedRoleId],
      );
      res.json(rows.map((row) => row.permission_key));
    } catch (err) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// 3. บันทึก/อัปเดต Permission
router.post(
  "/roles/:id/permissions",
  verifyToken,
  verifySuperAdmin,
  async (req, res) => {
    try {
      const roleId = Number(req.params.id);
      const permissions = req.body?.permissions || req.body;
      if (
        !validRoleId(roleId) ||
        !Array.isArray(permissions) ||
        permissions.some((permission) => !PERMISSION_KEYS.includes(permission))
      ) {
        return res.status(422).json({ message: "ข้อมูลสิทธิ์ไม่ถูกต้อง" });
      }
      const hasAgency = permissions.some((key) =>
        AGENCY_PERMISSIONS.includes(key),
      );
      const hasOther = permissions.some(
        (key) => !AGENCY_PERMISSIONS.includes(key),
      );
      const [agencyTables] = await db.query(
        "SHOW TABLES LIKE 'agency_memberships'",
      );
      const [agencyAccounts] = agencyTables.length
        ? await db.query(
            "SELECT 1 FROM users u JOIN agency_memberships am ON am.user_id=u.id WHERE u.role_id=? LIMIT 1",
            [roleId],
          )
        : [[]];
      if (
        hasOther &&
        (hasAgency ||
          agencyAccounts.length ||
          (await isProtectedAgencyRole(roleId)))
      )
        return res.status(422).json({
          message: "บทบาท Agency กำหนดได้เฉพาะสิทธิ์ในหมวด Agency เท่านั้น",
        });
      if (hasAgency) {
        const [organizationRoles] = await db.query(
          "SELECT 1 FROM organization_memberships om JOIN users u ON u.id=om.user_id WHERE om.role_id=? OR u.role_id=? LIMIT 1",
          [roleId, roleId],
        );
        if (organizationRoles.length || roleId === 1)
          return res.status(422).json({
            message: "สร้างบทบาท Agency แยกจากบทบาทที่ใช้ในระบบหลัก",
          });
      }
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          "DELETE FROM role_permissions WHERE role_id = ?",
          [roleId],
        );
        for (const permission of permissions)
          await connection.query(
            "INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)",
            [roleId, permission],
          );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
      res.json({ message: "Permissions saved" });
    } catch (err) {
      console.error("Error saving permissions:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

// 4. สร้าง Role ใหม่
router.post("/roles", verifyToken, verifySuperAdmin, async (req, res) => {
  try {
    const name = normaliseText(req.body.name);
    const description = normaliseText(req.body.description);
    if (name.length < 2 || name.length > 100 || description.length > 500) {
      return res.status(422).json({
        message:
          "ชื่อบทบาทต้องยาว 2-100 ตัวอักษร และคำอธิบายไม่เกิน 500 ตัวอักษร",
      });
    }
    const [result] = await db.query(
      "INSERT INTO roles (name, description) VALUES (?, ?)",
      [name, description],
    );
    res.status(201).json({ id: result.insertId, message: "สร้าง Role สำเร็จ" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/roles/:id", verifyToken, verifySuperAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!validRoleId(id))
    return res.status(422).json({ message: "รหัสบทบาทไม่ถูกต้อง" });
  if (await isProtectedAgencyRole(id))
    return res
      .status(403)
      .json({ message: "ไม่สามารถลบบทบาทเจ้าหน้าที่หน่วยงาน" });
  const [memberships] = await db.query(
    "SELECT 1 FROM organization_memberships WHERE role_id = ? LIMIT 1",
    [id],
  );
  if (memberships.length)
    return res.status(409).json({
      message:
        "บทบาทนี้ถูกใช้งานอยู่ ให้ปิดการใช้งานสมาชิกหรือเปลี่ยนบทบาทก่อน",
    });
  await db.query("DELETE FROM role_permissions WHERE role_id=?", [id]);
  const [result] = await db.query("DELETE FROM roles WHERE id=?", [id]);
  if (!result.affectedRows)
    return res.status(404).json({ message: "ไม่พบบทบาท" });
  return res.json({ success: true });
});

module.exports = router;
