// routes/caseRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
// 🟢 นำเข้าระบบเข้ารหัส
const { encrypt, decrypt, hmacHash } = require("../utils/encryption");
const {
  verifyToken,
  requirePermission,
} = require("../middleware/authMiddleware");
const { organizationWhere } = require("../authorization/authorization");
const { need } = require("../authorization/can");
const { INITIAL_CASE_STATUS } = require("../utils/caseStatus");
const rateLimit = require("express-rate-limit");
const { clientIpKeyGenerator } = require("../utils/clientIp");
const NodeCache = require("node-cache");
const {
  decryptCaseResponse,
  decryptSummaryData,
} = require("../utils/decryptCaseData");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
const { normalizeNationalId } = require("../utils/personIdentity");
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
  if (!req.authorization) return next();
  const path = req.path;
  let sql = null;
  let id = null;
  if (/^\/cases\/(\d+)/.test(path)) {
    id = path.match(/^\/cases\/(\d+)/)[1];
    const column =
      req.query.target === "master"
        ? "mc.organization_id"
        : "fr.organization_id";
    const table =
      req.query.target === "master" ? "mastercases mc" : "form_responses fr";
    const scope = organizationWhere(column, req);
    sql = `SELECT 1 FROM ${table} WHERE ${table.startsWith("master") ? "mc" : "fr"}.id=?${scope.sql} LIMIT 1`;
    const [rows] = await db.query(sql, [id, ...scope.params]);
    if (rows.length) return next();
  } else if (
    /^\/master-cases\/(?:by-id\/(\d+)|(\d+)\/(?:clinical-data|close))/.test(
      path,
    )
  ) {
    // Covers /master-cases/by-id/:id as well as the write endpoints
    // /master-cases/:id/clinical-data and /master-cases/:id/close.
    // (/master-cases/:identity is a national-id lookup and is scoped in its handler.)
    const match = path.match(
      /^\/master-cases\/(?:by-id\/(\d+)|(\d+)\/(?:clinical-data|close))/,
    );
    id = match[1] || match[2];
    const scope = organizationWhere("organization_id", req);
    const [rows] = await db.query(
      `SELECT 1 FROM mastercases WHERE id=?${scope.sql} LIMIT 1`,
      [id, ...scope.params],
    );
    if (rows.length) return next();
  } else if (/^\/appointments\/(\d+)/.test(path)) {
    id = path.match(/^\/appointments\/(\d+)/)[1];
    const scope = organizationWhere("mc.organization_id", req);
    const [rows] = await db.query(
      `SELECT 1 FROM appointments a LEFT JOIN form_responses fr ON fr.id=a.case_id JOIN mastercases mc ON mc.id=COALESCE(a.master_case_id,fr.master_case_id) WHERE a.id=?${scope.sql} AND (a.case_id IS NULL OR (fr.organization_id=mc.organization_id AND fr.master_case_id=mc.id)) LIMIT 1`,
      [id, ...scope.params],
    );
    if (rows.length) return next();
  } else if (/^\/history\/(?:response|answer)\/(\d+)/.test(path)) {
    id = path.match(/^\/history\/(?:response|answer)\/(\d+)/)[1];
    const scope = organizationWhere("organization_id", req);
    const [rows] = await db.query(
      `SELECT 1 FROM form_responses WHERE id=?${scope.sql} LIMIT 1`,
      [id, ...scope.params],
    );
    if (rows.length) return next();
  } else return next();
  require("../utils/privacyTelemetry").record("scope_denial");
  return res.status(403).json({
    success: false,
    message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลของหน่วยงานอื่น",
  });
}
router.use(enforceOrganizationOwnership);

// ==========================================
// 1. CASE LOGS
// ==========================================
router.get(
  "/cases/:id/logs",
  verifyToken,
  requirePermission("Case Management", "view"),
  async (req, res) => {
    try {
      const { target } = req.query; // 🟢 รับพารามิเตอร์เป้าหมาย
      let sql =
        "SELECT l.*,fr.organization_id FROM case_logs l JOIN form_responses fr ON fr.id=l.response_id LEFT JOIN mastercases mc ON mc.id=l.master_case_id WHERE l.response_id=? AND (l.master_case_id IS NULL OR (mc.organization_id=fr.organization_id AND mc.id=fr.master_case_id)) ORDER BY created_at DESC";
      if (target === "master") {
        sql =
          "SELECT l.*,fr.organization_id FROM case_logs l JOIN form_responses fr ON fr.id=l.response_id JOIN mastercases mc ON mc.id=l.master_case_id AND mc.organization_id=fr.organization_id AND mc.id=fr.master_case_id WHERE l.master_case_id=? ORDER BY created_at DESC";
      }
      const [rows] = await db.query(sql, [req.params.id]);
      res.json(
        rows.map((row) => ({
          ...row,
          staff: require("../utils/privateField").readField(
            row.staff,
            "case_logs",
            "staff",
            row.organization_id,
          ),
          detail: require("../utils/privateField").readField(
            row.detail,
            "case_logs",
            "detail",
            row.organization_id,
          ),
        })),
      );
    } catch (err) {
      res.status(503).json({ message: "เกิดข้อผิดพลาดในการดึงประวัติ" });
    }
  },
);

// ==========================================
// บันทึกประวัติ (Log) และอัปเดตสถานะเคสล่าสุด
// ==========================================
router.post("/cases/:id/logs", verifyToken, async (req, res) => {
  try {
    res.json(await require("../services/caseLogService").saveCaseLog(db, req));
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.status ? error.code : "CASE_LOG_UNAVAILABLE" });
  }
});

// ==========================================
// 2. DELETE CASE
// ==========================================
// Deleting a case removes its assessment result too.
router.delete(
  "/cases/:id",
  verifyToken,
  need("clinical.delete"),
  async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const id = req.params.id;
      await require("../utils/operationalOwnership").responseOwner(
        conn,
        req,
        id,
        undefined,
        true,
      );
      await conn.query("DELETE FROM form_answers WHERE response_id = ?", [id]);
      await conn.query("DELETE FROM case_logs WHERE response_id = ?", [id]);
      await conn.query("DELETE FROM appointments WHERE case_id = ?", [id]);
      await conn.query("DELETE FROM form_responses WHERE id = ?", [id]);
      await require("../utils/pdpaAudit").requiredAudit(
        req,
        "cases.delete",
        "response",
        id,
        {},
        conn,
      );
      await conn.commit();
      res.json({ message: "ลบเคสสำเร็จ" });
    } catch (err) {
      await conn.rollback();
      if (err.code === "ER_ROW_IS_REFERENCED_2")
        return res.status(409).json({
          message:
            "เคสนี้มีประวัติส่งต่อหรือข้อมูลเชื่อมโยงอยู่ กรุณาใช้การปิดเคสเพื่อเก็บประวัติ",
        });
      res
        .status(err.status || 500)
        .json({ message: "เกิดข้อผิดพลาดในการลบเคส" });
    } finally {
      conn.release();
    }
  },
);

// ==========================================
// 3. APPOINTMENTS
// ==========================================
router.post("/appointments", verifyToken, async (req, res) => {
  // Naming the responsible staff member is "assign".
  if (
    req.body?.staff_id &&
    require("../authorization/can").denyUnless(req, res, "appointments.assign")
  )
    return;
  try {
    res
      .status(201)
      .json(
        await require("../services/appointmentService").createAppointment(
          db,
          req,
        ),
      );
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ message: error.status ? error.code : "APPOINTMENT_UNAVAILABLE" });
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
    const scope = organizationWhere("mc.organization_id", req);
    const params = [...scope.params];
    let where = `WHERE (a.case_id IS NULL OR (r.organization_id=mc.organization_id AND r.master_case_id=mc.id))${scope.sql}`;

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
             COALESCE(r.organization_id,mc.organization_id) AS organization_id, r.form_id, r.identity_value, r.summary_data,
             r.status AS case_status, r.risk_level, r.submitted_at,
             f.title AS form_title, f.clinic_type, f.status AS form_status,
             s.name AS service_name
      FROM appointments a
      LEFT JOIN form_responses r ON a.case_id = r.id
      JOIN mastercases mc ON mc.id = COALESCE(a.master_case_id, r.master_case_id)
      LEFT JOIN forms f ON f.id = r.form_id
      LEFT JOIN service_types s ON a.service_id = s.id AND s.organization_id=mc.organization_id
      ${where}
      ORDER BY a.appointment_date ASC
      ${wantsAll ? "" : "LIMIT ? OFFSET ?"}
    `,
      wantsAll ? params : [...params, limit, offset],
    );

    // 🟢 ใช้ Promise.all เพื่อกระจายภาระการถอดรหัส
    const decryptedRows = await Promise.all(
      rows.map(async (row) =>
        require("../services/appointmentService").readAppointment(
          decryptCaseResponse(row, safeDecrypt),
        ),
      ),
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
      "SELECT a.*,mc.organization_id FROM appointments a JOIN form_responses fr ON fr.id=a.case_id JOIN mastercases mc ON mc.id=COALESCE(a.master_case_id,fr.master_case_id) AND fr.organization_id=mc.organization_id AND fr.master_case_id=mc.id WHERE a.case_id=? ORDER BY a.appointment_date ASC";
    if (target === "master") {
      sql =
        "SELECT a.*,mc.organization_id FROM appointments a LEFT JOIN form_responses fr ON fr.id=a.case_id JOIN mastercases mc ON mc.id=COALESCE(a.master_case_id,fr.master_case_id) WHERE mc.id=? AND (a.case_id IS NULL OR (fr.organization_id=mc.organization_id AND fr.master_case_id=mc.id)) ORDER BY a.appointment_date ASC";
    }
    const [rows] = await db.query(sql, [req.params.id]);
    res.json(
      rows.map((row) =>
        require("../services/appointmentService").readAppointment(row),
      ),
    );
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// ==========================================
// 4. FORM ANSWERS (🟢 ถอดรหัส)
// ==========================================
router.get(
  "/cases/:id/answers",
  verifyToken,
  requirePermission("Case Management", "view"),
  async (req, res) => {
    try {
      const [rows] = await db.query(
        `SELECT fa.question_id,fa.question_title,fa.answer_value,fr.organization_id FROM form_answers fa JOIN form_responses fr ON fr.id=fa.response_id WHERE response_id = ? ORDER BY fa.id ASC`,
        [req.params.id],
      );
      const result = rows.map((row) => ({
        question_id: row.question_id,
        question_title: row.question_title,
        answer_value: normalizeStoredAnswer(
          row.answer_value,
          row.question_title,
          safeDecrypt,
          row.organization_id,
        ),
      }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงคำตอบ" });
    }
  },
);

// ==========================================
// 5. EDIT RESPONSE (🟢 เข้ารหัสตอนเซฟ)
// ==========================================
router.patch(
  "/history/response/:id",
  verifyToken,
  requirePermission("Case Management", "manage"),
  need("clinical.update"),
  async (req, res) => {
    try {
      const { field, value } = req.body;
      const ALLOWED = ["display_name", "phone", "weight", "height"];
      if (!ALLOWED.includes(field))
        return res.status(400).json({ message: "field not allowed" });
      const owner =
        await require("../utils/operationalOwnership").responseOwner(
          db,
          req,
          req.params.id,
        );

      const [rows] = await db.query(
        "SELECT summary_data, organization_id FROM form_responses WHERE id = ? AND organization_id=?",
        [req.params.id, owner.organization_id],
      );
      let summary = decryptSummaryData(
        rows[0].summary_data,
        safeDecrypt,
        rows[0].organization_id,
      );
      const now = new Date().toISOString();

      // เข้ารหัสก่อนบันทึกกลับ
      let valToSave = value;

      summary[field] = valToSave;
      summary[`${field}_updated_at`] = now;

      if (summary.raw_answers) {
        if (field === "phone") summary.raw_answers["เบอร์โทรศัพท์"] = valToSave;
        if (field === "weight") summary.raw_answers["น้ำหนัก (กก.)"] = value; // ตัวเลขไม่ต้องเข้ารหัส
        if (field === "height") summary.raw_answers["ส่วนสูง (ซม.)"] = value;
        if (field === "display_name")
          summary.raw_answers["ชื่อ-นามสกุล"] = valToSave;
      }

      await db.query(
        "UPDATE form_responses SET summary_data = ? WHERE id = ?",
        [
          JSON.stringify(
            require("../utils/privateData").sealJson(
              summary,
              require("../utils/privateData").fieldContext(
                "form_responses",
                "summary_data",
                rows[0].organization_id,
              ),
            ),
          ),
          req.params.id,
        ],
      );
      res.json({ message: "อัปเดตสำเร็จ", updated_at: now });
    } catch (err) {
      console.error(
        "Edit response Error:",
        require("../utils/safeError").safeError(err),
      );
      res
        .status(err.status || 500)
        .json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
  },
);

// ==========================================
// 6. EDIT ANSWER (🟢 เข้ารหัสตอนเซฟ)
// ==========================================
router.patch(
  "/history/answer/:responseId/:questionId",
  verifyToken,
  requirePermission("Case Management", "manage"),
  need("clinical.update"),
  async (req, res) => {
    try {
      const { responseId, questionId } = req.params;
      const { value } = req.body;
      // 0 is a legitimate numeric answer, so only reject empty input.
      if (value === undefined)
        return res.status(400).json({ message: "กรุณาระบุค่า" });

      // ดึง title เพื่อดูว่าต้องเข้ารหัสไหม
      const [qRows] = await db.query(
        "SELECT question_title FROM form_answers WHERE response_id = ? AND (question_id = ? OR question_title = ?)",
        [responseId, questionId, questionId],
      );
      let qTitle = qRows.length ? qRows[0].question_title : "";

      const { responseOwner } = require("../utils/operationalOwnership");
      const owner = await responseOwner(db, req, responseId);
      const valToSave = require("../utils/privateData").sealJson(
        value,
        require("../utils/privateData").fieldContext(
          "form_answers",
          "answer_value",
          owner.organization_id,
        ),
      );

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
      console.error(
        "Edit answer Error:",
        require("../utils/safeError").safeError(err),
      );
      res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
    }
  },
);

// ==========================================
// 7. HISTORY SEARCH (🟢 ค้นหาด้วย Hash และถอดรหัสก่อนโชว์หน้า HistoryResult)
// ==========================================
router.get(
  "/history/:identity",
  verifyToken,
  requirePermission("Case Management", "view"),
  async (req, res) => {
    try {
      const identity = (req.params.identity || "").replace(/\D/g, "");
      if (!identity)
        return res.status(400).json({ message: "เลขบัตรไม่ถูกต้อง" });

      // แฮชเลขบัตรที่แอดมินพิมพ์มา เพื่อไปจับคู่ในฐานข้อมูล
      const hashInput = hmacHash(identity);
      const scope = organizationWhere("r.organization_id", req);

      const [rows] = await db.query(
        `
      SELECT
        r.id, r.organization_id, r.form_id, r.identity_value, r.summary_data,
        r.submitted_at, r.status, r.risk_level,
        f.title AS form_title, f.clinic_type
      FROM form_responses r
      LEFT JOIN forms f ON r.form_id = f.id
      WHERE r.identity_hash = ?${scope.sql}
      ORDER BY r.submitted_at DESC
    `,
        [hashInput, ...scope.params],
      );

      if (!rows.length)
        return res.status(404).json({ message: "ไม่พบประวัติ" });

      const result = rows.map((r) => decryptCaseResponse(r, safeDecrypt));

      res.json(result);
    } catch (err) {
      console.error(require("../utils/safeError").safeError(err));
      res.status(500).json({ message: "server error" });
    }
  },
);

// ==========================================
// 3.5 SERVICES
// ==========================================
router.get(
  "/master-cases/:identity",
  verifyToken,
  requirePermission("Case Management", "view"),
  async (req, res) => {
    try {
      const identity = (req.params.identity || "").replace(/\D/g, "");
      if (!identity)
        return res.status(400).json({ message: "เลขบัตรไม่ถูกต้อง" });

      const hashInput = hmacHash(identity);
      const scope = organizationWhere("organization_id", req);

      const [masterCases] = await db.query(
        `SELECT * FROM mastercases WHERE identity_hash = ?${scope.sql} ORDER BY createdAt DESC`,
        [hashInput, ...scope.params],
      );

      if (masterCases.length === 0)
        return res.status(404).json({ message: "ไม่พบประวัติการรักษา" });

      const decryptedMasterCases = masterCases.map((mc) =>
        decryptCaseResponse(mc, safeDecrypt),
      );

      const masterCaseIds = masterCases.map((mc) => mc.id);

      const [responses] = await db.query(
        `
            SELECT fr.*, f.title as form_title, f.form_type, f.clinic_type 
            FROM form_responses fr
            JOIN forms f ON fr.form_id = f.id
            WHERE fr.master_case_id IN (?) AND fr.organization_id = (SELECT organization_id FROM mastercases WHERE id=fr.master_case_id)
            ORDER BY fr.submitted_at DESC, fr.id DESC
        `,
        [masterCaseIds],
      );

      const decryptedResponses = responses.map((r) =>
        decryptCaseResponse(r, safeDecrypt),
      );

      res.json({
        masterCases: decryptedMasterCases,
        responses: decryptedResponses,
      });
    } catch (error) {
      console.error(
        "MasterCase API Error:",
        require("../utils/safeError").safeError(error),
      );
      res.status(500).json({ message: "Server error fetching master cases" });
    }
  },
);

router.get("/master-cases/by-id/:id", verifyToken, async (req, res) => {
  try {
    const masterCaseId = req.params.id;

    const [masterCases] = await db.query(
      "SELECT * FROM mastercases WHERE id = ?",
      [masterCaseId],
    );

    if (masterCases.length === 0)
      return res.status(404).json({ message: "ไม่พบประวัติการรักษา" });

    const decryptedMasterCases = masterCases.map((mc) =>
      decryptCaseResponse(mc, safeDecrypt),
    );

    const [responses] = await db.query(
      `
            SELECT fr.*, f.title as form_title, f.form_type, f.clinic_type 
            FROM form_responses fr
            JOIN forms f ON fr.form_id = f.id
            WHERE fr.master_case_id = ? AND fr.organization_id = (SELECT organization_id FROM mastercases WHERE id=?)
            ORDER BY fr.submitted_at DESC, fr.id DESC
        `,
      [masterCaseId, masterCaseId],
    );

    const decryptedResponses = responses.map((r) =>
      decryptCaseResponse(r, safeDecrypt),
    );

    res.json({
      masterCases: decryptedMasterCases,
      responses: decryptedResponses,
    });
  } catch (error) {
    console.error(
      "MasterCase API Error:",
      require("../utils/safeError").safeError(error),
    );
    res.status(500).json({ message: "Server error fetching master cases" });
  }
});

// Every assessment of the person behind one Master Case, across forms and
// clinics, so the case view shows the whole file and not one clinic episode.
// Falls back to the account, then the identity hash, for rows that predate
// person_id. Limited to the active organization.
router.get(
  "/master-cases/:id/person-timeline",
  verifyToken,
  async (req, res) => {
    const scoped = (column) =>
      req.organizationContext === undefined
        ? { sql: "", params: [] }
        : organizationWhere(column, req);
    const caseScope = scoped("organization_id");
    const [cases] = await db.query(
      `SELECT id, person_id, patient_account_id, identity_hash FROM mastercases WHERE id = ?${caseScope.sql} LIMIT 1`,
      [req.params.id, ...caseScope.params],
    );
    const anchor = cases[0];
    if (!anchor)
      return res.status(404).json({ message: "ไม่พบประวัติการรักษา" });

    const [personColumn, personValue] = anchor.person_id
      ? ["person_id", anchor.person_id]
      : anchor.patient_account_id
        ? ["patient_account_id", anchor.patient_account_id]
        : anchor.identity_hash
          ? ["identity_hash", anchor.identity_hash]
          : ["master_case_id", anchor.id];
    const caseColumn = personColumn === "master_case_id" ? "id" : personColumn;

    const masterScope = scoped("mc.organization_id");
    const [masterCases] = await db.query(
      `SELECT mc.id, mc.organization_id, mc.clinicType, mc.status, mc.currentStage, mc.overall_risk, mc.createdAt, mc.updatedAt
         FROM mastercases mc
        WHERE mc.${caseColumn} = ?${masterScope.sql}
        ORDER BY mc.createdAt DESC`,
      [personValue, ...masterScope.params],
    );

    const responseScope = scoped("fr.organization_id");
    const [responses] = await db.query(
      `SELECT fr.*, f.title AS form_title, f.form_type, f.clinic_type
         FROM form_responses fr
         JOIN forms f ON f.id = fr.form_id
        WHERE fr.${personColumn} = ?${responseScope.sql}
        ORDER BY fr.submitted_at DESC, fr.id DESC`,
      [personValue, ...responseScope.params],
    );

    let person = null;
    if (anchor.person_id) {
      const [rows] = await db.query(
        `SELECT p.id, p.patient_account_id, p.identity_hash IS NOT NULL AS has_national_id,
                COALESCE(pa.first_name_encrypted, p.first_name_encrypted) AS first_name_encrypted,
                COALESCE(pa.last_name_encrypted, p.last_name_encrypted) AS last_name_encrypted,
                pa.username
           FROM persons p
           LEFT JOIN patient_accounts pa ON pa.id = p.patient_account_id
          WHERE p.id = ?`,
        [anchor.person_id],
      );
      if (rows[0])
        person = {
          id: rows[0].id,
          patient_account_id: rows[0].patient_account_id,
          username: rows[0].username || null,
          has_national_id: Boolean(rows[0].has_national_id),
          display_name: [
            rows[0].first_name_encrypted,
            rows[0].last_name_encrypted,
          ]
            .map((value) => (value ? safeDecrypt(value) : ""))
            .filter(Boolean)
            .join(" "),
        };
    }

    res.json({
      person,
      masterCases: masterCases.map((mc) =>
        decryptCaseResponse(mc, safeDecrypt),
      ),
      responses: responses.map((row) => {
        const record = decryptCaseResponse(row, safeDecrypt);
        delete record.identity_value;
        return record;
      }),
    });
  },
);

// ==========================================
// 🎯 API 10: Secure URL Tokens (เข้ารหัสลิงก์ส่งให้คนไข้เพื่อป้องกันข้อมูลหลุด)
// ==========================================
router.post(["/generate-token", "/decode-token"], (_req, res) =>
  res
    .status(410)
    .json({ code: "LEGACY_LINK_RETIRED", message: "กรุณาออกลิงก์เชิญใหม่" }),
);

// ==========================================
// 🎯 API 3: บันทึกข้อมูลทางคลินิก (ผลเลือด, PrEP)
// ==========================================
router.put(
  "/master-cases/:id/clinical-data",
  verifyToken,
  need("clinical.create"),
  async (req, res) => {
    try {
      const org = require("../utils/operationalOwnership").concreteOrganization(
        req,
      );
      await require("../utils/operationalOwnership").ownedReference(
        db,
        "mastercases",
        req.params.id,
        org,
      );
      const { clinical_data } = req.body; // เป็น Object เช่น { blood_test: 'negative', prep: 'prep_with_blood' }
      if (
        !clinical_data ||
        typeof clinical_data !== "object" ||
        Array.isArray(clinical_data)
      )
        return res.status(422).json({ code: "INVALID_CLINICAL_DATA" });
      await require("../utils/pdpaAudit").requiredAudit(
        req,
        "clinical.update",
        "mastercase",
        req.params.id,
      );
      await db.query(
        "UPDATE mastercases SET clinical_data = ? WHERE id = ? AND organization_id=?",
        [
          JSON.stringify(
            require("../utils/privateData").sealJson(
              clinical_data,
              require("../utils/privateData").fieldContext(
                "mastercases",
                "clinical_data",
                req.organizationContext,
              ),
            ),
          ),
          req.params.id,
          org,
        ],
      );
      res.json({ message: "บันทึกข้อมูลทางคลินิกสำเร็จ" });
    } catch (error) {
      console.error(
        "Update clinical-data Error:",
        require("../utils/safeError").safeError(error),
      );
      res
        .status(error.status || 500)
        .json({ code: error.code || "CLINICAL_UPDATE_FAILED" });
    }
  },
);

// 🟢 1. API ใหม่สำหรับอัปเดตสถานะนัดหมาย (Quick Action: เช็คอิน/ยกเลิก)
router.patch("/appointments/:id/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Scheduled", "Completed", "Cancelled"].includes(status))
      return res.status(422).json({ code: "INVALID_APPOINTMENT_STATUS" });
    // Cancelling an appointment is "delete"; other status changes are "update".
    if (
      require("../authorization/can").denyUnless(
        req,
        res,
        status === "Cancelled" ? "appointments.delete" : "appointments.update",
      )
    )
      return;
    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "appointments.update",
      "appointment",
      req.params.id,
    );
    const result = await db.query(
      "UPDATE appointments a LEFT JOIN form_responses fr ON fr.id=a.case_id JOIN mastercases mc ON mc.id=COALESCE(a.master_case_id,fr.master_case_id) SET a.status=? WHERE a.id=? AND mc.organization_id=? AND (a.case_id IS NULL OR (fr.organization_id=mc.organization_id AND fr.master_case_id=mc.id))",
      [
        status,
        req.params.id,
        require("../utils/operationalOwnership").concreteOrganization(req),
      ],
    );
    if (!result[0].affectedRows)
      return res.status(404).json({ code: "APPOINTMENT_NOT_FOUND" });
    res.json({ message: "อัปเดตสถานะการนัดหมายสำเร็จ" });
  } catch (error) {
    console.error(
      "Update Appt Status Error:",
      require("../utils/safeError").safeError(error),
    );
    res
      .status(error.status || 500)
      .json({ code: error.code || "APPOINTMENT_UPDATE_FAILED" });
  }
});

// 🟢 2. แก้ไข API ปิดเคสเดิม ให้มียกเลิกนัดค้างอยู่อัตโนมัติ
router.put("/master-cases/:id/close", verifyToken, async (req, res) => {
  let connection;
  try {
    const masterCaseId = req.params.id;
    connection = await db.getConnection();
    await connection.beginTransaction();
    const org = require("../utils/operationalOwnership").concreteOrganization(
      req,
    );
    await require("../utils/operationalOwnership").ownedReference(
      connection,
      "mastercases",
      masterCaseId,
      org,
    );

    await connection.query(
      "UPDATE mastercases SET status = 'Closed' WHERE id = ? AND organization_id=?",
      [masterCaseId, org],
    );

    await connection.query(
      "UPDATE form_responses SET status = 'ปิดเคสเรียบร้อย' WHERE master_case_id = ? AND organization_id=?",
      [masterCaseId, org],
    );

    await connection.query(
      "UPDATE appointments a LEFT JOIN form_responses fr ON fr.id=a.case_id JOIN mastercases mc ON mc.id=COALESCE(a.master_case_id,fr.master_case_id) SET a.status='Cancelled' WHERE mc.id=? AND mc.organization_id=? AND (a.case_id IS NULL OR (fr.organization_id=mc.organization_id AND fr.master_case_id=mc.id)) AND (a.status='Scheduled' OR a.status IS NULL)",
      [masterCaseId, org],
    );

    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "case.close",
      "mastercase",
      masterCaseId,
      {},
      connection,
    );
    await connection.commit();
    res.json({ message: "ปิดเคสสำเร็จ" });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error(
      "Close Case API Error:",
      require("../utils/safeError").safeError(error),
    );
    res
      .status(error.status || 500)
      .json({ code: error.code || "CASE_CLOSE_FAILED" });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// CREATE WALK-IN CASE
// ==========================================
// A walk-in case records who the person is.
router.post("/cases", verifyToken, need("pii.create"), async (req, res) => {
  let connection;
  try {
    const data = req.body;
    require("../utils/operationalOwnership").concreteOrganization(req);

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

    // A Thai national ID is hashed digits-only, the same as registration and
    // form submissions, so a walk-in joins the person's existing file.
    const nationalId = normalizeNationalId(rawIdentity);
    if (nationalId) {
      encryptedIdentity = encrypt(nationalId);
      hashedIdentity = hmacHash(nationalId);
    } else if (rawIdentity.trim() !== "") {
      encryptedIdentity = encrypt(rawIdentity);
      hashedIdentity = hmacHash(rawIdentity);
    } else {
      const fallbackId = `walkin_${Date.now()}`;
      encryptedIdentity = encrypt(fallbackId);
      hashedIdentity = hmacHash(fallbackId);
    }
    const summary = JSON.parse(JSON.stringify(data.summary_data || {}));
    // Preserve the manual entry source across reloads without a schema change.
    summary.case_source = "walkin";

    // A walk-in case belongs to the organization that owns the selected form.
    // Without this the record is invisible to every organization-scoped view.
    const formId = Number(data.form_id) || 1;
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [formRows] = await connection.query(
      "SELECT organization_id,clinic_type FROM forms WHERE id = ? LIMIT 1",
      [formId],
    );
    if (!formRows.length)
      return res.status(404).json({ message: "ไม่พบข้อมูลฟอร์ม" });
    const formOrganizationId = formRows[0].organization_id
      ? Number(formRows[0].organization_id)
      : null;
    if (
      typeof req.organizationContext === "number" &&
      formOrganizationId !== null &&
      formOrganizationId !== req.organizationContext
    ) {
      return res
        .status(403)
        .json({ message: "ฟอร์มนี้ไม่ได้อยู่ในหน่วยงานที่กำลังใช้งาน" });
    }
    if (formOrganizationId == null)
      return res.status(503).json({ code: "FORM_OWNER_REVIEW_REQUIRED" });
    const organizationId =
      formOrganizationId ??
      (typeof req.organizationContext === "number"
        ? req.organizationContext
        : null);

    await require("../utils/operationalOwnership").ownedReference(
      connection,
      "mastercases",
      data.master_case_id,
      organizationId,
    );
    await require("../utils/operationalOwnership").ownedReference(
      connection,
      "staffs",
      data.staff_id,
      organizationId,
    );
    if (
      typeof (data.status || INITIAL_CASE_STATUS) !== "string" ||
      typeof (data.risk_level || "ต่ำ") !== "string" ||
      (data.risk_level || "ต่ำ").length > 100
    )
      return res.status(422).json({ code: "INVALID_CASE_VALUES" });
    const [statuses] = await connection.query(
      "SELECT id FROM case_statuses WHERE organization_id=? AND name=? AND is_active=1 FOR UPDATE",
      [organizationId, data.status || INITIAL_CASE_STATUS],
    );
    if (!statuses.length)
      return res.status(422).json({
        code: "STATUS_NOT_IN_ORGANIZATION",
        message: `ไม่พบสถานะ "${data.status || INITIAL_CASE_STATUS}" ที่เปิดใช้งานในหน่วยงานนี้ กรุณาเปิดใช้งานที่หน้าจัดการข้อมูลหลัก > สถานะเคส`,
      });
    let personId = null;
    if (nationalId) {
      const [people] = await connection.query(
        "SELECT id FROM persons WHERE identity_hash = ? AND merged_into_person_id IS NULL LIMIT 1",
        [hashedIdentity],
      );
      personId = people[0]?.id || null;
    }
    if (data.master_case_id) {
      const [masters] = await connection.query(
        "SELECT identity_hash,person_id FROM mastercases WHERE id=? AND organization_id=? FOR UPDATE",
        [data.master_case_id, organizationId],
      );
      const master = masters[0];
      if (
        !master ||
        !(
          (personId && Number(master.person_id) === Number(personId)) ||
          (hashedIdentity && master.identity_hash === hashedIdentity)
        )
      )
        return res.status(422).json({ code: "MASTER_CASE_PERSON_MISMATCH" });
    }
    // A walk-in needs a case file so the case window can book appointments and
    // record clinical data: the known person's open file, else a new anonymous
    // one. A staff-typed ID never creates a person record without consent.
    let masterCaseId = data.master_case_id || null;
    if (!masterCaseId) {
      const owner =
        await require("../utils/submissionIdentity").resolveGuestSubmissionOwner(
          {
            connection,
            nationalId: personId ? nationalId : null,
            clinicType:
              formRows[0].clinic_type || data.clinic_type || "general",
            organizationId,
          },
        );
      masterCaseId = owner.masterCaseId;
      personId = personId || owner.personId || null;
    }

    const sql = `
      INSERT INTO form_responses (
        form_id,
        master_case_id,
        person_id,
        submitted_at,
        identity_value,
        identity_hash,
        summary_data,
        status,
        risk_level,
        staff_id,
        organization_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      formId,
      masterCaseId,
      personId,
      new Date(),
      require("../utils/privateField").writeField(
        safeDecrypt(encryptedIdentity),
        "form_responses",
        "identity_value",
        organizationId,
      ),
      hashedIdentity,
      JSON.stringify(
        require("../utils/privateData").sealJson(
          summary,
          require("../utils/privateData").fieldContext(
            "form_responses",
            "summary_data",
            organizationId,
          ),
        ),
      ),
      data.status || INITIAL_CASE_STATUS,
      encrypt(
        data.risk_level || "ต่ำ",
        require("../utils/privateData").fieldContext(
          "form_responses",
          "risk_level",
          organizationId,
        ),
      ),
      data.staff_id || null,
      organizationId,
    ];

    const [result] = await connection.query(sql, values);
    await require("../utils/pdpaAudit").requiredAudit(
      req,
      "cases.create",
      "response",
      result.insertId,
      {},
      connection,
    );
    await connection.commit();
    // A walk-in case may name the member's faculty or status.
    require("../services/memberType").refreshPersonAnswerQuietly(db, personId);
    res.status(201).json({
      success: true,
      id: result.insertId,
      master_case_id: masterCaseId,
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(
      "CREATE CASE ERROR:",
      require("../utils/safeError").safeError(err),
    );

    res.status(err.status || 500).json({
      success: false,
      message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์",
    });
  } finally {
    if (connection) {
      await connection.rollback().catch(() => {});
      connection.release();
    }
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
      `SELECT r.*, m.status AS master_status
       FROM form_responses r
       LEFT JOIN mastercases m ON r.master_case_id = m.id AND m.organization_id=r.organization_id
       WHERE r.form_id = ?${scope.sql} ORDER BY r.submitted_at DESC`,
      [id, ...scope.params],
    );

    // 🟢 เพิ่มตัวแปลงข้อมูลและถอดรหัสแบบปลอดภัยก่อนส่งออกไปหน้าบ้านค่ะ
    const parsedResponses = responseData.map((r) =>
      decryptCaseResponse(r, safeDecrypt),
    );

    res.json(
      await require("../services/latestActivity").attachCaseActivities(
        db,
        parsedResponses,
      ),
    );
  } catch (error) {
    console.error(
      "Error fetching responses:",
      require("../utils/safeError").safeError(error),
    );
    res.status(500).json({ message: "Error fetching responses" });
  }
});

router.get(
  "/cases/:id/first-name",
  verifyToken,
  requirePermission("Case Management", "view"),
  require("../utils/caseFirstName").requirePii,
  async (req, res) => {
    try {
      if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(Number(req.params.id))
      )
        return res.status(422).json({ message: "รหัสเคสไม่ถูกต้อง" });
      const scope = organizationWhere("fr.organization_id", req);
      const [rows] = await db.query(
        `SELECT fr.id,fr.organization_id,fr.summary_data,pa.first_name_encrypted AS account_first_name
         FROM form_responses fr LEFT JOIN patient_accounts pa ON pa.id=fr.patient_account_id
        WHERE fr.id=?${scope.sql} LIMIT 1`,
        [req.params.id, ...scope.params],
      );
      if (!rows.length) return res.status(404).json({ message: "ไม่พบเคส" });
      const row = rows[0];
      const summary = decryptSummaryData(
        row.summary_data,
        safeDecrypt,
        row.organization_id,
      );
      const { firstNameOf } = require("../utils/caseFirstName");
      const accountName = row.account_first_name
        ? require("../utils/privateField").readField(
            row.account_first_name,
            "patient_accounts",
            "first_name_encrypted",
            null,
          )
        : null;
      res.set("Cache-Control", "no-store");
      res.json({
        first_name:
          firstNameOf(summary.display_name || summary.name) ||
          firstNameOf(accountName, true),
      });
    } catch (error) {
      res.status(503).json({ message: "ไม่สามารถเปิดดูชื่อได้" });
    }
  },
);

router.get(
  "/cases/:id/last-name",
  verifyToken,
  requirePermission("Case Management", "view"),
  require("../utils/caseFirstName").requirePii,
  async (req, res) => {
    try {
      if (
        !/^[1-9]\d*$/.test(req.params.id) ||
        !Number.isSafeInteger(Number(req.params.id))
      )
        return res.status(422).json({ message: "รหัสเคสไม่ถูกต้อง" });
      const scope = organizationWhere("fr.organization_id", req);
      const [rows] = await db.query(
        `SELECT fr.id,fr.organization_id,fr.summary_data,pa.last_name_encrypted AS account_last_name
         FROM form_responses fr LEFT JOIN patient_accounts pa ON pa.id=fr.patient_account_id
        WHERE fr.id=?${scope.sql} LIMIT 1`,
        [req.params.id, ...scope.params],
      );
      if (!rows.length) return res.status(404).json({ message: "ไม่พบเคส" });
      const row = rows[0];
      const summary = decryptSummaryData(
        row.summary_data,
        safeDecrypt,
        row.organization_id,
      );
      const { lastNameOf } = require("../utils/caseFirstName");
      const accountName = row.account_last_name
        ? require("../utils/privateField").readField(
            row.account_last_name,
            "patient_accounts",
            "last_name_encrypted",
            null,
          )
        : null;
      res.set("Cache-Control", "no-store");
      res.json({
        last_name:
          lastNameOf(summary.display_name || summary.name) ||
          lastNameOf(accountName, true),
      });
    } catch (error) {
      res.status(503).json({ message: "ไม่สามารถเปิดดูชื่อได้" });
    }
  },
);

router.get("/cases/:id", verifyToken, async (req, res) => {
  try {
    const scope = organizationWhere("organization_id", req);
    const [rows] = await db.query(
      `SELECT * FROM form_responses WHERE id = ?${scope.sql}`,
      [req.params.id, ...scope.params],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: "Case not found" });
    const caseData = decryptCaseResponse(rows[0], safeDecrypt);
    res.json(caseData);
  } catch (error) {
    console.error(
      "Error fetching case:",
      require("../utils/safeError").safeError(error),
    );
    res.status(500).json({ message: "Error fetching case" });
  }
});

router.get("/all-cases", verifyToken, async (req, res) => {
  try {
    const scope = organizationWhere("r.organization_id", req);
    const [rows] = await db.query(
      `SELECT r.*, f.title as form_title, m.status AS master_status
             FROM form_responses r
             JOIN forms f ON r.form_id = f.id
             LEFT JOIN mastercases m ON r.master_case_id = m.id AND m.organization_id=r.organization_id
             WHERE 1=1${scope.sql} ORDER BY r.submitted_at DESC`,
      scope.params,
    );
    const parsedResponses = rows.map((r) =>
      decryptCaseResponse(r, safeDecrypt),
    );

    res.json(
      await require("../services/latestActivity").attachCaseActivities(
        db,
        parsedResponses,
      ),
    );
  } catch (error) {
    console.error(
      "Error fetching cases:",
      require("../utils/safeError").safeError(error),
    );
    res.status(500).json({ message: "Error fetching cases" });
  }
});

module.exports = router;
