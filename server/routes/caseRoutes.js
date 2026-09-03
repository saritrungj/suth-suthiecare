// routes/caseRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
// 🟢 นำเข้าระบบเข้ารหัส
const { encrypt, decrypt, hmacHash } = require("../utils/encryption");
const { verifyToken, requirePermission } = require("../middleware/authMiddleware");
const { organizationWhere } = require("../authorization/authorization");
const rateLimit = require("express-rate-limit");
const { clientIpKeyGenerator } = require("../utils/clientIp");
const NodeCache = require("node-cache");
const { decryptCaseResponse } = require("../utils/decryptCaseData");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
// ตั้งค่าให้จำไว้ 5 นาที (300 วินาที) ข้อมูลพวกนี้เปลี่ยนไม่บ่อย
const myCache = new NodeCache({ stdTTL: 300 });

// 🔒 เกราะป้องกันสำหรับ endpoint ที่ประชาชนเข้าถึงได้แบบไม่ต้อง login (patient portal ค้นประวัติด้วยเลขบัตร)
// จำกัดจำนวนครั้งต่อ IP กัน brute-force ไล่เดาเลขบัตร/รหัสเคส
const publicHistoryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientIpKeyGenerator,
  message: {
    success: false,
    message: "มีการค้นหาบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
  },
});

// Helper ถอดรหัส
const safeDecrypt = (val) => decrypt(val) || val;
const isDateInput = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

async function enforceOrganizationOwnership(req, res, next) {
  if (!req.authorization || req.organizationContext === "all") return next();
  const path = req.path;
  let sql = null;
  let id = null;
  if (/^\/cases\/(\d+)/.test(path)) {
    id = path.match(/^\/cases\/(\d+)/)[1];
    const column = req.query.target === "master" ? "mc.organization_id" : "fr.organization_id";
    const table = req.query.target === "master" ? "mastercases mc" : "form_responses fr";
    const scope = organizationWhere(column, req);
    sql = `SELECT 1 FROM ${table} WHERE ${table.startsWith("master") ? "mc" : "fr"}.id=?${scope.sql} LIMIT 1`;
    const [rows] = await db.query(sql, [id, ...scope.params]);
    if (rows.length) return next();
  } else if (/^\/master-cases\/by-id\/(\d+)/.test(path)) {
    id = path.match(/^\/master-cases\/by-id\/(\d+)/)[1]; const scope = organizationWhere("organization_id", req);
    const [rows] = await db.query(`SELECT 1 FROM mastercases WHERE id=?${scope.sql} LIMIT 1`, [id, ...scope.params]); if (rows.length) return next();
  } else if (/^\/appointments\/(\d+)/.test(path)) {
    id = path.match(/^\/appointments\/(\d+)/)[1]; const scope = organizationWhere("mc.organization_id", req);
    const [rows] = await db.query(`SELECT 1 FROM appointments a JOIN mastercases mc ON mc.id=a.master_case_id WHERE a.id=?${scope.sql} LIMIT 1`, [id, ...scope.params]); if (rows.length) return next();
  } else if (/^\/history\/response\/(\d+)/.test(path)) {
    id = path.match(/^\/history\/response\/(\d+)/)[1]; const scope = organizationWhere("organization_id", req);
    const [rows] = await db.query(`SELECT 1 FROM form_responses WHERE id=?${scope.sql} LIMIT 1`, [id, ...scope.params]); if (rows.length) return next();
  } else return next();
  return res.status(403).json({ success: false, message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลของหน่วยงานอื่น" });
}
router.use(enforceOrganizationOwnership);

// ==========================================
// 1. CASE LOGS
// ==========================================
  router.get("/cases/:id/logs", verifyToken, requirePermission("Case Management", "view"), async (req, res) => {
  try {
    const { target } = req.query; // 🟢 รับพารามิเตอร์เป้าหมาย
    let sql =
      "SELECT * FROM case_logs WHERE response_id = ? ORDER BY created_at DESC";
    if (target === "master") {
      sql =
        "SELECT * FROM case_logs WHERE master_case_id = ? ORDER BY created_at DESC";
    }
    const [rows] = await db.query(sql, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงประวัติ" });
  }
});

// ==========================================
// บันทึกประวัติ (Log) และอัปเดตสถานะเคสล่าสุด
// ==========================================
router.post("/cases/:id/logs", verifyToken, async (req, res) => {
  const caseId = req.params.id; // ไอดีของ form_responses
  const {
    master_case_id,
    type,
    staff,
    staff_id,
    detail,
    status,
    status_id,
    risk_level,
  } = req.body;

  if (isNaN(Number(caseId))) {
    return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
  }
  if (!type || typeof type !== "string") {
    return res.status(400).json({ message: "กรุณาระบุประเภทของบันทึก" });
  }

  try {
    // 1. บันทึกประวัติลงตาราง case_logs (เหมือนเดิม)
    const sqlLog =
      "INSERT INTO case_logs (response_id, master_case_id, type, staff, staff_id, detail, status_id) VALUES (?, ?, ?, ?, ?, ?, ?)";
    await db.query(sqlLog, [
      caseId,
      master_case_id || null,
      type,
      staff,
      staff_id || null,
      detail,
      status_id || null,
    ]);

    // 🟢 2. สำคัญมาก! อัปเดตสถานะและความเสี่ยงล่าสุด กลับไปที่ตาราง form_responses
    if (status) {
      await db.query("UPDATE form_responses SET status = ? WHERE id = ?", [
        status,
        caseId,
      ]);
    }
    if (risk_level) {
      await db.query("UPDATE form_responses SET risk_level = ? WHERE id = ?", [
        risk_level,
        caseId,
      ]);
    }
    if (staff_id !== undefined && staff_id !== null) {
      await db.query("UPDATE form_responses SET staff_id = ? WHERE id = ?", [
        staff_id,
        caseId,
      ]);
    }

    // 🟢 3. ถ้ามีการเชื่อม Master Case ให้อัปเดตความเสี่ยงภาพรวมด้วย
    if (master_case_id && risk_level) {
      await db.query("UPDATE mastercases SET overall_risk = ? WHERE id = ?", [
        risk_level,
        master_case_id,
      ]);
    }

    res.json({ message: "บันทึกประวัติและอัปเดตสถานะสำเร็จ" });
  } catch (err) {
    console.error("Case Log & Update Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ==========================================
// 2. DELETE CASE
// ==========================================
router.delete("/cases/:id", verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const id = req.params.id;
    await conn.query("DELETE FROM form_answers WHERE response_id = ?", [id]);
    await conn.query("DELETE FROM case_logs WHERE response_id = ?", [id]);
    await conn.query("DELETE FROM appointments WHERE case_id = ?", [id]);
    await conn.query("DELETE FROM form_responses WHERE id = ?", [id]);
    await conn.commit();
    res.json({ message: "ลบเคสสำเร็จ" });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบเคส" });
  } finally {
    conn.release();
  }
});

// ==========================================
// 3. APPOINTMENTS
// ==========================================
router.post("/appointments", verifyToken, async (req, res) => {
  // 🟢 รับ master_case_id เพิ่มเข้ามา
  const {
    case_id,
    master_case_id,
    service_id,
    appointment_no,
    appointment_date,
    staff,
    staff_id,
    note,
  } = req.body;

  if (!appointment_date || isNaN(Date.parse(appointment_date))) {
    return res
      .status(400)
      .json({ message: "กรุณาระบุวันที่นัดหมายให้ถูกต้อง" });
  }
  if (case_id !== undefined && case_id !== null && isNaN(Number(case_id))) {
    return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
  }

  try {
    const sql =
      "INSERT INTO appointments (case_id, master_case_id, service_id, appointment_no, appointment_date, staff, staff_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    await db.query(sql, [
      case_id,
      master_case_id || null,
      service_id,
      appointment_no,
      appointment_date,
      staff,
      staff_id || null,
      note,
    ]);
    res.status(201).json({ message: "Appointment created" });
  } catch (error) {
    res.status(500).json({ error: "Server Error" });
  }
});

// routes/caseRoutes.js

router.get("/appointments", verifyToken, async (req, res) => {
  try {
    const wantsAll = req.query.limit === "all";
    const requestedLimit = parseInt(req.query.limit, 10);
    const limit = Number.isInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 100;
    const offset = parseInt(req.query.offset) || 0;
    const { startDate, endDate } = req.query;
    const scope = organizationWhere(
      "COALESCE(r.organization_id, mc.organization_id)",
      req,
    );
    const params = [...scope.params];
    let where = `WHERE 1=1${scope.sql}`;

    if (isDateInput(startDate)) {
      where += " AND a.appointment_date >= ?";
      params.push(startDate);
    }
    if (isDateInput(endDate)) {
      // Use an exclusive next-day boundary so all appointments on the selected
      // end date are included without relying on a time component from the UI.
      where += " AND a.appointment_date < DATE_ADD(?, INTERVAL 1 DAY)";
      params.push(endDate);
    }

    const [rows] = await db.query(
      `
      SELECT a.*, a.status AS appt_status,
             r.form_id, r.identity_value, r.summary_data,
             r.status AS case_status, r.risk_level, r.submitted_at,
             f.title AS form_title, f.clinic_type, f.status AS form_status,
             s.name AS service_name
      FROM appointments a
      LEFT JOIN form_responses r ON a.case_id = r.id
      LEFT JOIN mastercases mc ON mc.id = COALESCE(a.master_case_id, r.master_case_id)
      LEFT JOIN forms f ON f.id = r.form_id
      LEFT JOIN service_types s ON a.service_id = s.id
      ${where}
      ORDER BY a.appointment_date ASC
      ${wantsAll ? "" : "LIMIT ? OFFSET ?"}
    `,
      wantsAll ? params : [...params, limit, offset],
    );

    // 🟢 ใช้ Promise.all เพื่อกระจายภาระการถอดรหัส
    const decryptedRows = await Promise.all(
      rows.map(async (row) => decryptCaseResponse(row, safeDecrypt)),
    );

    res.json(decryptedRows);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลนัดหมาย" });
  }
});

router.get("/cases/:id/appointments", verifyToken, async (req, res) => {
  try {
    const { target } = req.query; // 🟢 รับพารามิเตอร์เป้าหมาย
    let sql =
      "SELECT * FROM appointments WHERE case_id = ? ORDER BY appointment_date ASC";
    if (target === "master") {
      sql =
        "SELECT * FROM appointments WHERE master_case_id = ? ORDER BY appointment_date ASC";
    }
    const [rows] = await db.query(sql, [req.params.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 4. FORM ANSWERS (🟢 ถอดรหัส)
// ==========================================
 router.get("/cases/:id/answers", verifyToken, requirePermission("Case Management", "view"), async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT question_id, question_title, answer_value FROM form_answers WHERE response_id = ? ORDER BY id ASC`,
      [req.params.id],
    );
    const result = rows.map((row) => ({
      question_id: row.question_id,
      question_title: row.question_title,
      answer_value: normalizeStoredAnswer(
        row.answer_value,
        row.question_title,
        safeDecrypt,
      ),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงคำตอบ" });
  }
});

// ==========================================
// 5. EDIT RESPONSE (🟢 เข้ารหัสตอนเซฟ)
// ==========================================
router.patch("/history/response/:id", verifyToken, requirePermission("Case Management", "manage"), async (req, res) => {
  try {
    const { field, value } = req.body;
    const ALLOWED = ["display_name", "phone", "weight", "height"];
    if (!ALLOWED.includes(field))
      return res.status(400).json({ message: "field not allowed" });

    const [rows] = await db.query(
      "SELECT summary_data FROM form_responses WHERE id = ?",
      [req.params.id],
    );
    let summary =
      typeof rows[0].summary_data === "string"
        ? JSON.parse(rows[0].summary_data)
        : rows[0].summary_data || {};
    const now = new Date().toISOString();

    // เข้ารหัสก่อนบันทึกกลับ
    let valToSave = value;
    if (field === "display_name" || field === "phone") {
      valToSave = encrypt(value);
    }

    summary[field] = valToSave;
    summary[`${field}_updated_at`] = now;

    if (summary.raw_answers) {
      if (field === "phone") summary.raw_answers["เบอร์โทรศัพท์"] = valToSave;
      if (field === "weight") summary.raw_answers["น้ำหนัก (กก.)"] = value; // ตัวเลขไม่ต้องเข้ารหัส
      if (field === "height") summary.raw_answers["ส่วนสูง (ซม.)"] = value;
      if (field === "display_name")
        summary.raw_answers["ชื่อ-นามสกุล"] = valToSave;
    }

    await db.query("UPDATE form_responses SET summary_data = ? WHERE id = ?", [
      JSON.stringify(summary),
      req.params.id,
    ]);
    res.json({ message: "อัปเดตสำเร็จ", updated_at: now });
  } catch (err) {
    console.error("Edit response Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// ==========================================
// 6. EDIT ANSWER (🟢 เข้ารหัสตอนเซฟ)
// ==========================================
router.patch(
  "/history/answer/:responseId/:questionId",
  verifyToken,
  async (req, res) => {
    try {
      const { responseId, questionId } = req.params;
      const { value } = req.body;
      if (!value || String(value).trim() === "")
        return res.status(400).json({ message: "กรุณาระบุค่า" });

      // ดึง title เพื่อดูว่าต้องเข้ารหัสไหม
      const [qRows] = await db.query(
        "SELECT question_title FROM form_answers WHERE response_id = ? AND (question_id = ? OR question_title = ?)",
        [responseId, questionId, questionId],
      );
      let qTitle = qRows.length ? qRows[0].question_title : "";

      let valToSave = String(value).trim();
      if (
        qTitle.includes("ชื่อ") ||
        qTitle.includes("เบอร์") ||
        qTitle.includes("โทร") ||
        qTitle.includes("บัตร")
      ) {
        valToSave = encrypt(valToSave);
      }

      const [ansRows] = await db.query(
        "SELECT id FROM form_answers WHERE response_id = ? AND question_id = ?",
        [responseId, questionId],
      );

      if (ansRows.length) {
        await db.query(
          `UPDATE form_answers SET answer_value = ? WHERE response_id = ? AND question_id = ?`,
          [JSON.stringify(valToSave), responseId, questionId],
        );
      } else {
        await db.query(
          `UPDATE form_answers SET answer_value = ? WHERE response_id = ? AND question_title = ?`,
          [JSON.stringify(valToSave), responseId, questionId],
        );
      }
      res.json({
        message: "อัปเดตสำเร็จ",
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Edit answer Error:", err);
      res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
  },
);

// ==========================================
// 7. HISTORY SEARCH (🟢 ค้นหาด้วย Hash และถอดรหัสก่อนโชว์หน้า HistoryResult)
// ==========================================
router.get("/history/:identity", verifyToken, requirePermission("Case Management", "view"), async (req, res) => {
  try {
    const identity = (req.params.identity || "").replace(/\D/g, "");
    if (!identity)
      return res.status(400).json({ message: "เลขบัตรไม่ถูกต้อง" });

    // แฮชเลขบัตรที่แอดมินพิมพ์มา เพื่อไปจับคู่ในฐานข้อมูล
    const hashInput = hmacHash(identity);

    const [rows] = await db.query(
      `
      SELECT
        r.id, r.form_id, r.identity_value, r.summary_data,
        r.submitted_at, r.status, r.risk_level,
        f.title AS form_title, f.clinic_type
      FROM form_responses r
      LEFT JOIN forms f ON r.form_id = f.id
      WHERE r.identity_hash = ?
      ORDER BY r.submitted_at DESC
    `,
      [hashInput],
    );

    if (!rows.length) return res.status(404).json({ message: "ไม่พบประวัติ" });

    // 🔒 ฟังก์ชันเช็คว่าข้อความถูกเข้ารหัสมาหรือไม่ ถ้าเป็นข้อความดิบจากฟอร์มจะคืนค่าเดิมทันที
    const decryptIfEncrypted = (text) => {
      if (!text) return text;
      try {
        const decrypted = safeDecrypt(text);
        return decrypted ? decrypted : text; // ถ้าระบบแกะสลักรหัสผ่านสำเร็จ ให้ส่งค่ากลับ
      } catch (e) {
        return text; // ถ้าถอดรหัสพัง (แปลว่าเป็นข้อความดิบ) ให้ส่งตัวหนังสือดิบกลับไปทันที
      }
    };

    const result = rows.map((r) => {
      let summary = {};
      try {
        summary =
          typeof r.summary_data === "string"
            ? JSON.parse(r.summary_data)
            : r.summary_data || {};
      } catch {}

      // 🟢 เรียกใช้ตัวดักถอดรหัสอย่างปลอดภัย เพื่อป้องกันฟอร์มตรงของคนไข้พังค่ะ
      if (summary.display_name)
        summary.display_name = decryptIfEncrypted(summary.display_name);
      if (summary.display_phone)
        summary.display_phone = decryptIfEncrypted(summary.display_phone);
      if (summary.phone) summary.phone = decryptIfEncrypted(summary.phone);

      // ตรวจสอบข้อมูลในคำถามดิบทีละข้อ
      if (summary.raw_answers) {
        for (const key in summary.raw_answers) {
          if (
            key.includes("ชื่อ") ||
            key.includes("เบอร์") ||
            key.includes("โทร") ||
            key.includes("บัตร")
          ) {
            // ครอบด้วยตัวตรวจเช็คเพื่อป้องกันการเกิดรหัสต่างดาว
            summary.raw_answers[key] = decryptIfEncrypted(
              summary.raw_answers[key],
            );
          }
        }
      }

      return {
        id: r.id,
        form_id: r.form_id,
        form_title: r.form_title,
        clinic_type: r.clinic_type,
        submitted_at: r.submitted_at,
        status: r.status,
        risk_level: r.risk_level,
        summary_data: summary,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "server error" });
  }
});

// ==========================================
// 3.5 SERVICES
// ==========================================
router.get("/services", verifyToken, async (req, res) => {
  try {
    // 🟢 1. เช็คว่ามีใน Cache ไหม ถ้ามีให้ส่งกลับทันที (ไม่กวน DB)
    if (myCache.has("services")) {
      return res.json(myCache.get("services"));
    }

    const [rows] = await db.query(
      "SELECT * FROM service_types ORDER BY id ASC",
    );

    // 🟢 2. ถ้าไม่มีให้ดึงจาก DB แล้วจำใส่ Cache ไว้
    myCache.set("services", rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

router.post("/services", verifyToken, async (req, res) => {
  try {
    const { name } = req.body;
    const [result] = await db.query(
      "INSERT INTO service_types (name, color) VALUES (?, '#2d7d81')",
      [name],
    );
    myCache.del("services");
    res.status(201).json({ id: result.insertId, message: "Created" });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

router.put("/services/:id", verifyToken, async (req, res) => {
  try {
    await db.query("UPDATE service_types SET name = ? WHERE id = ?", [
      req.body.name,
      req.params.id,
    ]);
    myCache.del("services");
    res.json({ message: "Updated" });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

router.delete("/services/:id", verifyToken, async (req, res) => {
  try {
    await db.query("DELETE FROM service_types WHERE id = ?", [req.params.id]);
    myCache.del("services");
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error" });
  }
});

// ==========================================
// 🎯 ระบบจัดการสถานะเคส (Unified Status Management)
// รองรับทั้ง API เก่าและใหม่ ป้องกันสถานะพื้นฐานหาย
// ==========================================
const getStatusesHandler = async (req, res) => {
  try {
    const clinic_type = req.query.clinic_type || req.query.clinic || "general";
    const cacheKey = `statuses_${clinic_type}`; // 🟢 สร้างชื่อ Key แยกตามคลินิก

    // 🟢 1. เช็ค Cache ก่อน
    if (myCache.has(cacheKey)) {
      return res.json(myCache.get(cacheKey));
    }

    // 🟢 ดึงสถานะของคลินิกนี้ "รวมถึง" สถานะพื้นฐาน (all หรือ NULL) เพื่อไม่ให้สถานะหลักหาย
    let sql =
      "SELECT * FROM case_statuses WHERE is_active = 1 AND (clinic_type = ? OR clinic_type = 'all' OR clinic_type IS NULL) ORDER BY id ASC";
    let [rows] = await db.query(sql, [clinic_type]);

    // Auto-Seed: ถ้ายังไม่มีข้อมูลในระบบ ให้สร้างค่าเริ่มต้น
    if (rows.length === 0) {
      const defaultStatuses = [
        { name: "รอติดต่อ (รอดำเนินการ)", color: "#f59e0b", type: "all" },
        { name: "นัดหมายสำเร็จ", color: "#10b981", type: "all" },
        { name: "ติดต่อไม่ได้ / ไม่รับสาย", color: "#ef4444", type: "all" },
        { name: "ขอเลื่อนนัด", color: "#8b5cf6", type: "all" },
        { name: "อยู่ระหว่างติดตามต่อเนื่อง", color: "#3b82f6", type: "all" },
        { name: "ปฏิเสธบริการ", color: "#64748b", type: "all" },
        { name: "ส่งต่อผู้เชี่ยวชาญ", color: "#0ea5e9", type: "all" },
        { name: "ปิดเคสเรียบร้อย", color: "#10b981", type: "all" },
      ];

      // สำหรับ STI คลินิก ให้เพิ่มสถานะพิเศษเข้าไปด้วย
      if (clinic_type === "sti") {
        defaultStatuses.push({
          name: "ส่งต่อ Safe Clinic",
          color: "#ec4899",
          type: "sti",
        });
      }

      for (const def of defaultStatuses) {
        // ข้ามการบันทึกถ้าเป็นสถานะเฉพาะคลินิกอื่น
        if (def.type !== "all" && def.type !== clinic_type) continue;

        await db.query(
          "INSERT INTO case_statuses (name, color, clinic_type, is_active) VALUES (?, ?, ?, 1)",
          [def.name, def.color, def.type],
        );
      }
      [rows] = await db.query(sql, [clinic_type]);
    }
    // 🟢 2. เซฟลง Cache
    myCache.set(cacheKey, rows);
    res.json(rows);
  } catch (err) {
    console.error("GET Statuses Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
};

const createStatusHandler = async (req, res) => {
  try {
    const { name, color, clinic_type } = req.body;
    // 🟢 ผูกสถานะที่สร้างใหม่เข้ากับคลินิกปัจจุบันอย่างถูกต้อง
    const targetClinic =
      clinic_type && clinic_type !== "all" ? clinic_type : "general";
    const targetColor = color || "#64748b";

    const [result] = await db.query(
      "INSERT INTO case_statuses (name, color, clinic_type, is_active) VALUES (?, ?, ?, 1)",
      [name, targetColor, targetClinic],
    );
    res.json({
      id: result.insertId,
      name,
      color: targetColor,
      clinic_type: targetClinic,
      is_active: 1,
    });
  } catch (err) {
    console.error("POST Status Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
};

const deactivateStatusHandler = async (req, res) => {
  try {
    await db.query("UPDATE case_statuses SET is_active = 0 WHERE id = ?", [
      req.params.id,
    ]);
    res.json({ message: "Status deactivated" });
  } catch (err) {
    console.error("Deactivate Status Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
};

// 🟢 ผูก Route ทั้งชื่อเก่าและชื่อใหม่เข้าด้วยกัน (Frontend เรียกอันไหนก็ทำงานได้ 100%)
router.get("/case-statuses/active", verifyToken, getStatusesHandler);
router.get("/status-options", verifyToken, getStatusesHandler);

router.post("/case-statuses", verifyToken, createStatusHandler);
router.post("/status-options", verifyToken, createStatusHandler);

router.put(
  "/case-statuses/:id/deactivate",
  verifyToken,
  deactivateStatusHandler,
);
router.put(
  "/status-options/:id/deactivate",
  verifyToken,
  deactivateStatusHandler,
);

// ==========================================
// 8. NOTE TEMPLATES (ระบบชุดคำถามล่วงหน้า)
// ==========================================
router.get("/templates", verifyToken, async (req, res) => {
  const { clinic_type } = req.query;
  try {
    let sql = "SELECT * FROM note_templates";
    let params = [];

    if (clinic_type) {
      sql += " WHERE clinic_type = ?";
      params.push(clinic_type);
    }

    sql += " ORDER BY created_at DESC";
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("❌ Get Templates Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูล Template" });
  }
});

router.post("/templates", verifyToken, async (req, res) => {
  const { clinic_type, label, text } = req.body;
  if (!clinic_type || !label || !text) {
    return res.status(400).json({ message: "กรุณากรอกข้อมูลให้ครบถ้วน" });
  }
  try {
    const [result] = await db.query(
      "INSERT INTO note_templates (clinic_type, label, text) VALUES (?, ?, ?)",
      [clinic_type, label, text],
    );
    res
      .status(201)
      .json({ id: result.insertId, message: "สร้าง Template สำเร็จ" });
  } catch (err) {
    console.error("❌ Post Template Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึก Template" });
  }
});

router.put("/templates/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { label, text } = req.body;
  try {
    await db.query(
      "UPDATE note_templates SET label = ?, text = ? WHERE id = ?",
      [label, text, id],
    );
    res.json({ message: "อัปเดต Template สำเร็จ" });
  } catch (err) {
    console.error("❌ Put Template Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการแก้ไข Template" });
  }
});

router.delete("/templates/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query("DELETE FROM note_templates WHERE id = ?", [id]);
    res.json({ message: "ลบ Template สำเร็จ" });
  } catch (err) {
    console.error("❌ Delete Template Error:", err);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบ Template" });
  }
});

// ==========================================
// 9. MASTER CASES (ระบบการจัดการแผนการรักษา)
// ==========================================
router.get("/master-cases/:identity", verifyToken, requirePermission("Case Management", "view"), async (req, res) => {
  try {
    const identity = (req.params.identity || "").replace(/\D/g, "");
    if (!identity)
      return res.status(400).json({ message: "เลขบัตรไม่ถูกต้อง" });

    const hashInput = hmacHash(identity);

    const [masterCases] = await db.query(
      "SELECT * FROM mastercases WHERE identity_hash = ? ORDER BY createdAt DESC",
      [hashInput],
    );

    if (masterCases.length === 0)
      return res.status(404).json({ message: "ไม่พบประวัติการรักษา" });

    const decryptedMasterCases = masterCases.map((mc) => ({
      ...mc,
      identityValue: safeDecrypt(mc.identityValue),
    }));

    const masterCaseIds = masterCases.map((mc) => mc.id);

    const [responses] = await db.query(
      `
            SELECT fr.*, f.title as form_title, f.form_type, f.clinic_type 
            FROM form_responses fr
            JOIN forms f ON fr.form_id = f.id
            WHERE fr.master_case_id IN (?)
            ORDER BY fr.submitted_at DESC
        `,
      [masterCaseIds],
    );

    const decryptedResponses = responses.map((r) => {
      if (r.identity_value) r.identity_value = safeDecrypt(r.identity_value);
      if (r.summary_data) {
        let summary =
          typeof r.summary_data === "string"
            ? JSON.parse(r.summary_data)
            : r.summary_data;
        if (summary.display_name)
          summary.display_name = safeDecrypt(summary.display_name);
        if (summary.display_phone)
          summary.display_phone = safeDecrypt(summary.display_phone);
        if (summary.phone) summary.phone = safeDecrypt(summary.phone);
        if (summary.raw_answers) {
          for (const key in summary.raw_answers) {
            if (
              key.includes("ชื่อ") ||
              key.includes("เบอร์") ||
              key.includes("โทร") ||
              key.includes("บัตร")
            ) {
              summary.raw_answers[key] = safeDecrypt(summary.raw_answers[key]);
            }
          }
        }
        r.summary_data = summary;
      }
      return r;
    });

    res.json({
      masterCases: decryptedMasterCases,
      responses: decryptedResponses,
    });
  } catch (error) {
    console.error("MasterCase API Error:", error);
    res.status(500).json({ message: "Server error fetching master cases" });
  }
});

router.get("/master-cases/by-id/:id", verifyToken, async (req, res) => {
  try {
    const masterCaseId = req.params.id;

    const [masterCases] = await db.query(
      "SELECT * FROM mastercases WHERE id = ?",
      [masterCaseId],
    );

    if (masterCases.length === 0)
      return res.status(404).json({ message: "ไม่พบประวัติการรักษา" });

    const decryptedMasterCases = masterCases.map((mc) => ({
      ...mc,
      identityValue: safeDecrypt(mc.identityValue),
    }));

    const [responses] = await db.query(
      `
            SELECT fr.*, f.title as form_title, f.form_type, f.clinic_type 
            FROM form_responses fr
            JOIN forms f ON fr.form_id = f.id
            WHERE fr.master_case_id = ?
            ORDER BY fr.submitted_at DESC
        `,
      [masterCaseId],
    );

    const decryptedResponses = responses.map((r) => {
      if (r.identity_value) r.identity_value = safeDecrypt(r.identity_value);
      if (r.summary_data) {
        let summary =
          typeof r.summary_data === "string"
            ? JSON.parse(r.summary_data)
            : r.summary_data;
        if (summary.display_name)
          summary.display_name = safeDecrypt(summary.display_name);
        if (summary.display_phone)
          summary.display_phone = safeDecrypt(summary.display_phone);
        if (summary.phone) summary.phone = safeDecrypt(summary.phone);
        if (summary.raw_answers) {
          for (const key in summary.raw_answers) {
            if (
              key.includes("ชื่อ") ||
              key.includes("เบอร์") ||
              key.includes("โทร") ||
              key.includes("บัตร")
            ) {
              summary.raw_answers[key] = safeDecrypt(summary.raw_answers[key]);
            }
          }
        }
        r.summary_data = summary;
      }
      return r;
    });

    res.json({
      masterCases: decryptedMasterCases,
      responses: decryptedResponses,
    });
  } catch (error) {
    console.error("MasterCase API Error:", error);
    res.status(500).json({ message: "Server error fetching master cases" });
  }
});

// ==========================================
// 🎯 API 10: Secure URL Tokens (เข้ารหัสลิงก์ส่งให้คนไข้เพื่อป้องกันข้อมูลหลุด)
// ==========================================
router.post(
  "/generate-token",
  verifyToken,
  requirePermission("Case Management", "manage"),
  (req, res) => {
  try {
    const { identity } = req.body;
    if (!identity) return res.status(400).json({ error: "Missing identity" });
    // 🟢 นำข้อมูลมาเข้ารหัส AES ทันที
    const token = encrypt(identity);
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
  },
);

router.post(
  "/decode-token",
  verifyToken,
  requirePermission("Case Management", "view"),
  (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Missing token" });
    // 🟢 ถอดรหัสกลับมาเป็นข้อมูลปกติ
    const identity = safeDecrypt(token);
    res.json({ identity });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
  },
);

// ==========================================
// 🎯 API 3: บันทึกข้อมูลทางคลินิก (ผลเลือด, PrEP)
// ==========================================
router.put("/master-cases/:id/clinical-data", verifyToken, async (req, res) => {
  try {
    const { clinical_data } = req.body; // เป็น Object เช่น { blood_test: 'negative', prep: 'prep_with_blood' }
    await db.query("UPDATE mastercases SET clinical_data = ? WHERE id = ?", [
      JSON.stringify(clinical_data),
      req.params.id,
    ]);
    res.json({ message: "บันทึกข้อมูลทางคลินิกสำเร็จ" });
  } catch (error) {
    console.error("Update clinical-data Error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// 🟢 1. API ใหม่สำหรับอัปเดตสถานะนัดหมาย (Quick Action: เช็คอิน/ยกเลิก)
router.patch("/appointments/:id/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query("UPDATE appointments SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);
    res.json({ message: "อัปเดตสถานะการนัดหมายสำเร็จ" });
  } catch (error) {
    console.error("Update Appt Status Error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการอัปเดตสถานะนัดหมาย" });
  }
});

// 🟢 2. แก้ไข API ปิดเคสเดิม ให้มียกเลิกนัดค้างอยู่อัตโนมัติ
router.put("/master-cases/:id/close", verifyToken, async (req, res) => {
  let connection;
  try {
    const masterCaseId = req.params.id;
    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.query("UPDATE mastercases SET status = 'Closed' WHERE id = ?", [
      masterCaseId,
    ]);

    await connection.query(
      "UPDATE form_responses SET status = 'ปิดเคสเรียบร้อย' WHERE master_case_id = ?",
      [masterCaseId],
    );

    await connection.query(
      "UPDATE appointments SET status = 'Cancelled' WHERE master_case_id = ? AND (status = 'Scheduled' OR status IS NULL)",
      [masterCaseId],
    );

    await connection.commit();
    res.json({ message: "ปิดเคสสำเร็จ" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Close Case API Error:", error);
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการปิดเคส" });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// CREATE WALK-IN CASE
// ==========================================
router.post("/cases", verifyToken, async (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (
      data.identity_value !== undefined &&
      typeof data.identity_value !== "string"
    ) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (
      data.summary_data !== undefined &&
      typeof data.summary_data !== "object"
    ) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    const rawIdentity = data.identity_value || "";
    let encryptedIdentity = "";
    let hashedIdentity = null;

    if (rawIdentity.trim() !== "") {
      encryptedIdentity = encrypt(rawIdentity);
      hashedIdentity = hmacHash(rawIdentity);
    } else {
      const fallbackId = `walkin_${Date.now()}`;
      encryptedIdentity = encrypt(fallbackId);
      hashedIdentity = hmacHash(fallbackId);
    }
    const summary = JSON.parse(JSON.stringify(data.summary_data || {}));

    if (summary.citizenId) summary.citizenId = encrypt(summary.citizenId);
    if (summary.idCard) summary.idCard = encrypt(summary.idCard);
    if (summary.name) summary.name = encrypt(summary.name);
    if (summary.phone) summary.phone = encrypt(summary.phone);

    if (summary.display_name)
      summary.display_name = encrypt(String(summary.display_name));
    if (summary.display_phone)
      summary.display_phone = encrypt(String(summary.display_phone));

    if (summary.raw_answers) {
      for (const key in summary.raw_answers) {
        if (
          key.includes("ชื่อ") ||
          key.includes("เบอร์") ||
          key.includes("โทร") ||
          key.includes("บัตร") ||
          key.includes("name") ||
          key.includes("phone")
        ) {
          const value = summary.raw_answers[key];
          if (value && typeof value === "string" && value.trim() !== "") {
            summary.raw_answers[key] = encrypt(value);
          }
        }
      }
    }

    const sql = `
      INSERT INTO form_responses (
        form_id,
        master_case_id,
        submitted_at,
        identity_value,
        identity_hash,
        summary_data,
        status,
        risk_level,
        staff_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      data.form_id || 1,
      data.master_case_id || null,
      new Date(),
      encryptedIdentity,
      hashedIdentity,
      JSON.stringify(summary),
      data.status || "รอดำเนินการ",
      data.risk_level || "ต่ำ",
      data.staff_id || null,
    ];

    const [result] = await db.query(sql, values);
    res.status(201).json({
      success: true,
      id: result.insertId,
    });
  } catch (err) {
    console.error("CREATE CASE ERROR:", err);

    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
    });
  }
});

// ==========================================
// WALK-IN CASE ถอดรหัส
// ==========================================
router.get("/forms/:id/responses-v2", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const scope = organizationWhere("r.organization_id", req);
    const [responseData] = await db.query(
      `SELECT r.*, m.status_name 
       FROM form_responses r
       LEFT JOIN mastercases m ON r.master_case_id = m.id
       WHERE r.form_id = ?${scope.sql} ORDER BY r.submitted_at DESC`,
      [id, ...scope.params],
    );

    // 🟢 เพิ่มตัวแปลงข้อมูลและถอดรหัสแบบปลอดภัยก่อนส่งออกไปหน้าบ้านค่ะ
    const parsedResponses = responseData.map((r) => {
      let summary =
        typeof r.summary_data === "string"
          ? JSON.parse(r.summary_data)
          : r.summary_data || {};

      const decryptIfEncrypted = (text) => {
        if (!text) return text;
        try {
          const decrypted = safeDecrypt(text);
          return decrypted ? decrypted : text;
        } catch (e) {
          return text;
        }
      };

      if (summary.citizenId)
        summary.citizenId = decryptIfEncrypted(summary.citizenId);
      if (summary.idCard) summary.idCard = decryptIfEncrypted(summary.idCard);
      if (summary.name) summary.name = decryptIfEncrypted(summary.name);
      if (summary.phone) summary.phone = decryptIfEncrypted(summary.phone);

      return {
        ...r,
        case_source: r.case_source || "assessment_form",
        identity_value: safeDecrypt(r.identity_value),
        summary_data: summary,
      };
    });

    res.json(parsedResponses);
  } catch (error) {
    console.error("Error fetching responses:", error);
    res.status(500).json({ message: "Error fetching responses" });
  }
});

router.get("/cases/:id", verifyToken, async (req, res) => {
  try {
    const scope = organizationWhere("organization_id", req);
    const [rows] = await db.query(`SELECT * FROM form_responses WHERE id = ?${scope.sql}`, [req.params.id, ...scope.params]);
    if (rows.length === 0)
      return res.status(404).json({ message: "Case not found" });
    const caseData = rows[0];
    let summary =
      typeof caseData.summary_data === "string"
        ? JSON.parse(caseData.summary_data)
        : caseData.summary_data || {};

    const decryptIfEncrypted = (text) => {
      if (!text) return text;
      try {
        const decrypted = safeDecrypt(text);
        return decrypted ? decrypted : text;
      } catch (e) {
        return text;
      }
    };

    if (summary.citizenId)
      summary.citizenId = decryptIfEncrypted(summary.citizenId);
    if (summary.idCard) summary.idCard = decryptIfEncrypted(summary.idCard);
    if (summary.name) summary.name = decryptIfEncrypted(summary.name);
    if (summary.phone) summary.phone = decryptIfEncrypted(summary.phone);

    caseData.identity_value = safeDecrypt(caseData.identity_value);
    caseData.summary_data = summary;

    res.json(caseData);
  } catch (error) {
    console.error("Error fetching case:", error);
    res.status(500).json({ message: "Error fetching case" });
  }
});

router.get("/all-cases", verifyToken, async (req, res) => {
  try {
    const scope = organizationWhere("r.organization_id", req);
    const [rows] = await db.query(
      `SELECT r.*, f.title as form_title, m.status_name 
             FROM form_responses r
             JOIN forms f ON r.form_id = f.id
             LEFT JOIN mastercases m ON r.master_case_id = m.id
             WHERE 1=1${scope.sql} ORDER BY r.submitted_at DESC`,
      scope.params,
    );
    const parsedResponses = rows.map((r) => {
      let summary =
        typeof r.summary_data === "string"
          ? JSON.parse(r.summary_data)
          : r.summary_data || {};

      const decryptIfEncrypted = (text) => {
        if (!text) return text;
        try {
          const decrypted = safeDecrypt(text);
          return decrypted ? decrypted : text;
        } catch (e) {
          return text;
        }
      };

      if (summary.citizenId)
        summary.citizenId = decryptIfEncrypted(summary.citizenId);
      if (summary.idCard) summary.idCard = decryptIfEncrypted(summary.idCard);
      if (summary.name) summary.name = decryptIfEncrypted(summary.name);
      if (summary.phone) summary.phone = decryptIfEncrypted(summary.phone);

      return {
        ...r,
        identity_value: safeDecrypt(r.identity_value),
        summary_data: summary,
      };
    });

    res.json(parsedResponses);
  } catch (error) {
    console.error("Error fetching cases:", error);
    res.status(500).json({ message: "Error fetching cases" });
  }
});

module.exports = router;
