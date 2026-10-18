// routes/dashboardRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// 🟢 นำเข้าระบบถอดรหัส (สำหรับใช้นับสถิตินักศึกษา/ความเสี่ยง)
const { decrypt } = require("../utils/encryption");
const { verifyToken } = require("../middleware/authMiddleware");
const { organizationWhere } = require("../authorization/authorization");
const {
  decryptCaseResponse,
  decryptSummaryData,
} = require("../utils/decryptCaseData");
const safeDecrypt = (val) => decrypt(val) || val;
const isDateInput = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

// Forms without a clinic belong to the "general" clinic, as on the forms page.
function addClinicFilter(sql, params, clinic) {
  if (!clinic || clinic === "all") return sql;
  if (clinic === "general")
    return (
      sql +
      " AND (f.clinic_type = 'general' OR f.clinic_type IS NULL OR f.clinic_type = '')"
    );
  params.push(clinic);
  return sql + " AND f.clinic_type = ?";
}

function addDateRange(sql, params, column, startDate, endDate) {
  if (isDateInput(startDate)) {
    sql += ` AND DATE(${column}) >= ?`;
    params.push(startDate);
  }
  if (isDateInput(endDate)) {
    sql += ` AND DATE(${column}) <= ?`;
    params.push(endDate);
  }
  return sql;
}

// 1. สรุปข้อมูล Dashboard
router.get("/dashboard/summary", verifyToken, async (req, res) => {
  try {
    const scope = organizationWhere("organization_id", req);
    const [totalRes] = await db.query(
      `SELECT COUNT(*) as total FROM form_responses WHERE 1=1${scope.sql}`,
      scope.params,
    );
    const [todayRes] = await db.query(
      `SELECT COUNT(*) as today FROM form_responses WHERE DATE(submitted_at) = CURDATE()${scope.sql}`,
      scope.params,
    );
    res.json({
      total: totalRes[0].total || 0,
      today: todayRes[0].today || 0,
      pending: 0,
    });
  } catch (err) {
    console.error(
      "Dashboard Summary Error:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "Server error" });
  }
});

// Chart workspaces are isolated by organization inside the existing settings row.
const { readWorkspace, mergeWorkspace } = require("../utils/dashboardSettings");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
const parseQuestions = (value) =>
  typeof value === "string" ? JSON.parse(value) : value || [];
const flattenQuestions = (items) =>
  items.flatMap((q) => [
    q,
    ...flattenQuestions(q.questions || []),
    ...flattenQuestions(q.subQuestions || []),
  ]);
router.get("/dashboard/forms", verifyToken, async (req, res) => {
  const params = [];
  let sql =
    "SELECT id,title,status,questions FROM forms WHERE organization_id IS NOT NULL";
  if (req.organizationContext !== "all") {
    sql += " AND organization_id=?";
    params.push(req.organizationContext);
  }
  const [rows] = await db.query(sql + " ORDER BY id DESC", params);
  res.json(rows.map((f) => ({ ...f, questions: parseQuestions(f.questions) })));
});
router.get("/dashboard-settings/settings", verifyToken, async (req, res) => {
  if (typeof req.organizationContext !== "number")
    return res.json({ last_selected_form_id: null, active_charts: {} });
  const [rows] = await db.query(
    "SELECT * FROM dashboard_settings WHERE role_id=?",
    [1],
  );
  res.json(readWorkspace(rows[0], req.organizationContext));
});
router.post("/dashboard-settings/settings", verifyToken, async (req, res) => {
  if (typeof req.organizationContext !== "number")
    return res
      .status(422)
      .json({ message: "กรุณาเลือกหน่วยงานก่อนบันทึกกราฟ" });
  const { formId, charts } = req.body || {};
  if (
    !charts ||
    typeof charts !== "object" ||
    Array.isArray(charts) ||
    Object.keys(charts).length > 200
  )
    return res.status(422).json({ message: "การตั้งค่ากราฟไม่ถูกต้อง" });
  const types = ["pie", "bar", "donut", "line", "horizontal", "table"];
  const clean = {};
  const chartIds = new Set();
  for (const [id, list] of Object.entries(charts)) {
    if (!/^\d+$/.test(id) || !Array.isArray(list) || list.length > 100)
      return res
        .status(422)
        .json({ message: "ข้อมูลแบบฟอร์มหรือกราฟไม่ถูกต้อง" });
    // Empty legacy groups carry no chart definitions and need no form access.
    if (!list.length) continue;
    const [[form]] = await db.query(
      "SELECT questions FROM forms WHERE id=? AND organization_id=?",
      [id, req.organizationContext],
    );
    if (!form)
      return res
        .status(422)
        .json({ message: "ไม่พบแบบฟอร์มในหน่วยงานที่เลือก" });
    const ids = new Set(
      flattenQuestions(parseQuestions(form.questions)).map((q) => String(q.id)),
    );
    clean[id] = [];
    for (const c of list) {
      if (c && chartIds.has(c.id))
        return res
          .status(422)
          .json({ message: "รหัสกราฟซ้ำ กรุณาโหลดหน้าใหม่" });
      if (
        !c ||
        typeof c.id !== "string" ||
        !c.id ||
        typeof c.title !== "string" ||
        !c.title.trim() ||
        c.title.length > 160 ||
        !types.includes(c.type) ||
        !ids.has(String(c.question)) ||
        !["answer", "result"].includes(c.mode || "answer") ||
        !["count", "sum", "average"].includes(c.aggregation || "count") ||
        !["desc", "asc", "label", "original"].includes(c.sort || "desc") ||
        !["", "day", "month"].includes(c.groupBy || "")
      )
        return res.status(422).json({
          message: "รายละเอียดกราฟไม่ถูกต้อง กรุณาตรวจสอบคำถามและรูปแบบ",
        });
      if (
        (c.mode === "result" && ["sum", "average"].includes(c.aggregation)) ||
        (["pie", "donut"].includes(c.type) &&
          ["sum", "average"].includes(c.aggregation))
      )
        return res
          .status(422)
          .json({ message: "วิธีคำนวณไม่เหมาะกับรูปแบบกราฟ" });
      clean[id].push({
        id: c.id,
        title: c.title.trim(),
        question: String(c.question),
        formId: id,
        type: c.type,
        mode: c.mode || "answer",
        aggregation: c.aggregation || "count",
        sort: c.sort || "desc",
        includeEmpty: Boolean(c.includeEmpty),
        answerPath:
          typeof c.answerPath === "string" ? c.answerPath.slice(0, 200) : "",
        position: Number.isSafeInteger(c.position) ? c.position : 0,
        groupBy: c.groupBy || "",
      });
      chartIds.add(c.id);
    }
  }
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      "INSERT IGNORE INTO dashboard_settings (role_id,organization_id,last_selected_form_id,active_charts) VALUES (?,?,NULL,?)",
      [1, req.organizationContext, "{}"],
    );
    const [rows] = await connection.query(
      "SELECT * FROM dashboard_settings WHERE role_id=? FOR UPDATE",
      [1],
    );
    // Roles page: new charts are "create", removed "delete", edited "update",
    // reordering or changing the default form "assign".
    const previous = readWorkspace(rows[0], req.organizationContext);
    const before = new Map(
      Object.values(previous.active_charts || {})
        .flat()
        .map((chart) => [chart.id, chart]),
    );
    const after = new Map(
      Object.values(clean)
        .flat()
        .map((chart) => [chart.id, chart]),
    );
    const needed = new Set();
    for (const [id, chart] of after) {
      const old = before.get(id);
      if (!old) needed.add("create");
      else {
        const { position, ...rest } = chart;
        const { position: oldPosition, ...oldRest } = old;
        if (JSON.stringify(rest) !== JSON.stringify(oldRest))
          needed.add("update");
        if (Number(position) !== Number(oldPosition)) needed.add("assign");
      }
    }
    for (const id of before.keys()) if (!after.has(id)) needed.add("delete");
    if (
      String(formId || "") !== String(previous.last_selected_form_id || "") &&
      formId
    )
      needed.add("assign");
    const { can } = require("../authorization/can");
    const missing = [...needed].find(
      (action) => !can(req, `dashboard.${action}`),
    );
    if (missing) {
      await connection.rollback();
      return res.status(403).json({
        code: "PERMISSION_REQUIRED",
        permission: `dashboard.${missing}`,
        message:
          "คุณไม่มีสิทธิ์" +
          {
            create: "สร้าง",
            update: "แก้ไข",
            delete: "ลบ",
            assign: "จัดลำดับหรือเลือกแบบฟอร์มเริ่มต้นของ",
          }[missing] +
          "กราฟในแดชบอร์ด",
      });
    }
    const merged = mergeWorkspace(rows[0], req.organizationContext, {
      last_selected_form_id: formId || null,
      active_charts: clean,
    });
    await connection.query(
      "UPDATE dashboard_settings SET active_charts=? WHERE role_id=?",
      [JSON.stringify(merged), 1],
    );
    await connection.commit();
    res.json({ message: "บันทึกกราฟสำเร็จ" });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});
router.get("/charts/:formId/:questionId", verifyToken, async (req, res) => {
  const { formId, questionId } = req.params,
    { startDate, endDate } = req.query;
  if (
    (startDate && !isDateInput(startDate)) ||
    (endDate && !isDateInput(endDate)) ||
    (startDate && endDate && startDate > endDate)
  )
    return res.status(422).json({ message: "ช่วงวันที่ไม่ถูกต้อง" });
  const formParams = [formId];
  let formSql = "SELECT questions FROM forms WHERE id=?";
  if (req.organizationContext !== "all") {
    formSql += " AND organization_id=?";
    formParams.push(req.organizationContext);
  }
  const [[form]] = await db.query(formSql, formParams);
  if (
    !form ||
    !flattenQuestions(parseQuestions(form.questions)).some(
      (q) => String(q.id) === questionId,
    )
  )
    return res
      .status(404)
      .json({ message: "ไม่พบแบบฟอร์มหรือคำถามในขอบเขตสิทธิ์" });
  let sql = `SELECT fa.response_id,fa.question_title,fa.answer_value,fr.summary_data,fr.organization_id,DATE_FORMAT(fr.submitted_at,'%Y-%m-%d') AS submitted_date FROM form_answers fa JOIN form_responses fr ON fa.response_id=fr.id WHERE fa.form_id=? AND fr.form_id=? AND fa.question_id=?`;
  const params = [formId, formId, questionId],
    scope = organizationWhere("fr.organization_id", req);
  sql += scope.sql;
  params.push(...scope.params);
  sql = addDateRange(sql, params, "fr.submitted_at", startDate, endDate);
  const [rows] = await db.query(sql, params),
    grouped = new Map();
  for (const row of rows) {
    const answer = normalizeStoredAnswer(
      row.answer_value,
      row.question_title,
      safeDecrypt,
      row.organization_id,
    );
    if (grouped.has(row.response_id)) continue;
    const summary =
      decryptSummaryData(row.summary_data, safeDecrypt, row.organization_id) ||
      {};
    const result = (summary.score_results || []).find(
      (r) => String(r.question_id ?? r.questionId ?? r.id) === questionId,
    );
    grouped.set(row.response_id, {
      answer,
      name: answer,
      value: 1,
      submitted_date: row.submitted_date,
      result:
        result?.label ||
        summary[`${questionId}_label`] ||
        summary[`${questionId}_result`] ||
        null,
    });
  }
  res.set("Cache-Control", "no-store");
  res.json([...grouped.values()]);
});

const emptyCaseStats = () => ({
  totalActive: 0,
  newToday: 0,
  closed: 0,
  highRisk: 0,
  waitingContact: 0,
  forwardSafeClinic: 0,
  totalStudent: 0,
  totalGeneral: 0,
  bloodTestNegative: 0,
  bloodTestPositive: 0,
  prepWithBlood: 0,
  prepWithoutBlood: 0,
});

// One row per case: responses of the same master case collapse to the
// latest one, standalone responses count on their own.
function dedupeCases(rows) {
  const uniqueCases = {};
  rows.forEach((row) => {
    const caseKey = row.master_id
      ? `master_${row.master_id}`
      : `resp_${row.response_id}`;
    const currentValidDate = row.submitted_at
      ? new Date(row.submitted_at).getTime()
      : 0;
    const existingValidDate = uniqueCases[caseKey]?.submitted_at
      ? new Date(uniqueCases[caseKey].submitted_at).getTime()
      : -1;
    if (!uniqueCases[caseKey] || currentValidDate > existingValidDate)
      uniqueCases[caseKey] = row;
  });
  return Object.values(uniqueCases);
}

// Case counts shared by the organization dashboard and the all-organizations
// overview, so both read the same numbers. With a date range every case in it
// counts as new; without one only today's.
function tallyCaseStats(cases, { rangeSelected = false } = {}) {
  const stats = emptyCaseStats();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  cases.forEach((c) => {
    const isClosed =
      c.master_status === "Closed" || c.response_status === "ปิดเคสเรียบร้อย";
    if (isClosed) stats.closed++;
    else stats.totalActive++;

    const caseDate = new Date(c.submitted_at);
    if (rangeSelected || caseDate >= today) stats.newToday++;

    const statusStr = String(c.response_status || "").trim();
    if (statusStr.includes("รอติดต่อ") || statusStr.includes("รอดำเนินการ"))
      stats.waitingContact++;
    if (statusStr.includes("Safe") || statusStr.includes("ส่งต่อ"))
      stats.forwardSafeClinic++;

    if (c.clinical_data) {
      let cData = c.clinical_data;
      try {
        cData = require("../utils/privateData").readJson(
          cData,
          require("../utils/privateData").fieldContext(
            "mastercases",
            "clinical_data",
            c.organization_id,
          ),
        );
        const bt = String(cData?.blood_test || "")
          .trim()
          .toLowerCase();
        const prep = String(cData?.prep || "")
          .trim()
          .toLowerCase();

        if (bt === "negative") stats.bloodTestNegative++;
        if (bt === "positive") stats.bloodTestPositive++;
        if (prep === "prep_with_blood") stats.prepWithBlood++;
        if (prep === "prep_without_blood") stats.prepWithoutBlood++;
      } catch (e) {
        if (e.name === "PrivateDataError") throw e;
      }
    }

    if (c.summary_data) {
      try {
        let summary = decryptSummaryData(
          c.summary_data,
          safeDecrypt,
          c.organization_id,
        );

        let foundStatus = false;
        let targetQuestionTitles = [];

        // 🟢 2. แกะโครงสร้างฟอร์ม เพื่อหาว่าคำถามข้อไหนที่มี type เป็น 'user_status' หรือ 'faculty'
        if (c.form_questions) {
          try {
            let formQs =
              typeof c.form_questions === "string"
                ? JSON.parse(c.form_questions)
                : c.form_questions;
            // 🟢 ดักจับจาก Flag isUserStatus ด้วย!
            const statusQs = formQs.filter(
              (q) =>
                q.type === "user_status" ||
                q.isUserStatus === true ||
                q.type === "faculty",
            );
            targetQuestionTitles = statusQs.map((q) => q.title);
          } catch (e) {
            if (e.name === "PrivateDataError") throw e;
          }
        }

        // 🟢 3. เข้าไปอ่านคำตอบ เฉพาะข้อที่เราดึง Title มาจาก Type ได้เท่านั้น!
        if (summary.raw_answers && targetQuestionTitles.length > 0) {
          for (const qTitle of targetQuestionTitles) {
            const answerValue = summary.raw_answers[qTitle]; // ดึงคำตอบมาตรงๆ
            if (answerValue) {
              const ansStr = String(answerValue);
              if (ansStr.includes("นักศึกษา") || ansStr.includes("สำนักวิชา")) {
                stats.totalStudent++;
                foundStatus = true;
                break;
              } else if (
                ansStr.includes("บุคคลทั่วไป") ||
                ansStr.includes("รับจ้าง") ||
                ansStr.includes("ค้าขาย")
              ) {
                stats.totalGeneral++;
                foundStatus = true;
                break;
              }
            }
          }
        }

        // 🟢 4. Fallback เผื่อเป็นเคสรุ่นเก่ามากๆ ที่ยังไม่ได้ใช้ระบบ Type ใหม่
        if (!foundStatus && summary.display_faculty) {
          const faculty = String(summary.display_faculty);
          if (
            faculty.includes("บุคคลทั่วไป") ||
            faculty.includes("รับจ้าง") ||
            faculty.includes("ค้าขาย")
          ) {
            stats.totalGeneral++;
          } else if (
            faculty.includes("นักศึกษา") ||
            faculty.includes("สำนักวิชา")
          ) {
            stats.totalStudent++;
          }
        }

        const results = summary.score_results || [];
        const isHighRisk = results.some((res) => {
          const c = res.color?.toLowerCase() || "";
          return (
            c.includes("d93025") ||
            c.includes("e53935") ||
            c.includes("f44336") ||
            c.includes("ef4444") ||
            c.includes("dc2626") ||
            c.includes("ff0000") ||
            c.includes("red") ||
            (res.label && res.label.includes("สูง"))
          );
        });
        if (isHighRisk && !isClosed) stats.highRisk++;
      } catch (e) {
        if (e.name === "PrivateDataError") throw e;
      }
    }
  });
  return stats;
}

// ==========================================
// 6. สรุปสถิติสำหรับ Dashboard (รวมของคลินิก STI)
// ==========================================
router.get("/admin/master-cases/stats", verifyToken, async (req, res) => {
  try {
    const { clinic, form_id, startDate, endDate } = req.query;

    // 🟢 1. ดึง f.questions (โครงสร้างฟอร์ม) มาด้วย เพื่อเอามาเช็ค Type
    let sql = `
            SELECT r.id AS response_id, r.organization_id, r.summary_data, r.status AS response_status, r.submitted_at,
                   m.id AS master_id, m.status AS master_status, m.clinical_data,
                   f.questions AS form_questions
            FROM form_responses r
            LEFT JOIN mastercases m ON r.master_case_id = m.id AND m.organization_id=r.organization_id
            LEFT JOIN forms f ON r.form_id = f.id
            WHERE 1=1
    `;
    const params = [];
    const scope = organizationWhere("r.organization_id", req);
    sql += scope.sql;
    params.push(...scope.params);
    sql = addClinicFilter(sql, params, clinic);
    if (form_id) {
      sql += " AND r.form_id = ?";
      params.push(form_id);
    }
    sql = addDateRange(sql, params, "r.submitted_at", startDate, endDate);

    const [rows] = await db.query(sql, params);
    const stats = tallyCaseStats(dedupeCases(rows), {
      rangeSelected: isDateInput(startDate) || isDateInput(endDate),
    });

    res.json(stats);
  } catch (error) {
    console.error(
      "Stats API Error:",
      require("../utils/safeError").safeError(error),
    );
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// 🟢 1. สร้างฟังก์ชันช่วยถอดรหัสแบบปลอดภัย
const decryptIfEncrypted = (text) => safeDecrypt(text);

// 2. ข้อมูลเคสล่าสุด
router.get("/dashboard/recent", verifyToken, async (req, res) => {
  try {
    const { clinic, form_id, startDate, endDate } = req.query;
    let sql = `
            SELECT r.id, r.organization_id, r.form_id, r.identity_value, r.summary_data, r.submitted_at,
                   r.status, r.risk_level, r.master_case_id, r.staff_id,
                   f.title as form_title, f.clinic_type
            FROM form_responses r
            LEFT JOIN forms f ON r.form_id = f.id
            WHERE 1=1
    `;
    const params = [];
    const scope = organizationWhere("r.organization_id", req);
    sql += scope.sql;
    params.push(...scope.params);
    sql = addClinicFilter(sql, params, clinic);
    if (/^\d+$/.test(String(form_id || ""))) {
      sql += " AND r.form_id = ?";
      params.push(Number(form_id));
    }
    sql = addDateRange(sql, params, "r.submitted_at", startDate, endDate);
    sql += " ORDER BY r.submitted_at DESC LIMIT 15";

    const [rows] = await db.query(sql, params);

    const decryptedRows = rows.map((r) => decryptCaseResponse(r, safeDecrypt));

    res.json(
      await require("../services/latestActivity").attachCaseActivities(
        db,
        decryptedRows,
      ),
    );
  } catch (err) {
    console.error(
      "Dashboard Recent Error:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "Server error" });
  }
});

// ==========================================
// 7. ภาพรวมทุกหน่วยงาน (ผู้ดูแลระบบ, ขอบเขต "ทุกหน่วยงาน")
// ==========================================
// Counts only: no names, answers or case codes leave this endpoint.
const missingTable = (error) => error?.code === "ER_NO_SUCH_TABLE";
async function countByOrganization(sql, params = []) {
  try {
    const [rows] = await db.query(sql, params);
    return new Map(rows.map((r) => [Number(r.organization_id), Number(r.n)]));
  } catch (error) {
    if (missingTable(error)) return new Map();
    throw error;
  }
}

router.get(
  "/dashboard/organizations-overview",
  verifyToken,
  async (req, res) => {
    if (req.organizationContext !== "all")
      return res
        .status(422)
        .json({ message: "ภาพรวมนี้ใช้ได้เมื่อเลือกทุกหน่วยงานเท่านั้น" });
    const { startDate, endDate } = req.query;
    if (
      (startDate && !isDateInput(startDate)) ||
      (endDate && !isDateInput(endDate)) ||
      (startDate && endDate && startDate > endDate)
    )
      return res.status(422).json({ message: "ช่วงวันที่ไม่ถูกต้อง" });
    try {
      const {
        organizationLevelSql,
      } = require("../authorization/authorization");
      const level = await organizationLevelSql("o");
      const [organizations] = await db.query(
        `SELECT o.id, o.code, o.name, o.org_type, p.name AS parent_name
           FROM organizations o LEFT JOIN organizations p ON p.id = o.parent_id
          WHERE o.status = 'active' AND ${level} = 'unit'
          ORDER BY o.name`,
      );

      // Same rows and counting as /admin/master-cases/stats, for every unit.
      let caseSql = `
            SELECT r.id AS response_id, r.organization_id, r.summary_data, r.status AS response_status, r.submitted_at,
                   m.id AS master_id, m.status AS master_status, m.clinical_data,
                   f.questions AS form_questions
            FROM form_responses r
            LEFT JOIN mastercases m ON r.master_case_id = m.id AND m.organization_id=r.organization_id
            LEFT JOIN forms f ON r.form_id = f.id
            WHERE r.organization_id IS NOT NULL`;
      const caseParams = [];
      caseSql = addDateRange(
        caseSql,
        caseParams,
        "r.submitted_at",
        startDate,
        endDate,
      );
      const [caseRows] = await db.query(caseSql, caseParams);
      const rowsByOrg = new Map();
      for (const row of caseRows) {
        const id = Number(row.organization_id);
        if (!rowsByOrg.has(id)) rowsByOrg.set(id, []);
        rowsByOrg.get(id).push(row);
      }

      const [lastRows] = await db.query(
        "SELECT organization_id, MAX(submitted_at) AS last_at FROM form_responses WHERE organization_id IS NOT NULL GROUP BY organization_id",
      );
      const lastActivity = new Map(
        lastRows.map((r) => [Number(r.organization_id), r.last_at]),
      );
      const formCounts = await countByOrganization(
        "SELECT organization_id, COUNT(*) AS n FROM forms WHERE organization_id IS NOT NULL AND status = 'published' GROUP BY organization_id",
      );

      // Schools: active students, classrooms and teachers, plus the latest
      // mental-health screening per student in the range, counted the same
      // way as the school dashboard.
      const students = await countByOrganization(
        "SELECT s.organization_id, COUNT(*) AS n FROM school_students ss JOIN schools s ON s.id = ss.school_id WHERE ss.archived_at IS NULL AND ss.status = 'active' GROUP BY s.organization_id",
      );
      const classrooms = await countByOrganization(
        "SELECT s.organization_id, COUNT(*) AS n FROM school_classrooms c JOIN schools s ON s.id = c.school_id WHERE c.status = 'active' GROUP BY s.organization_id",
      );
      const teachers = await countByOrganization(
        "SELECT s.organization_id, COUNT(*) AS n FROM school_teachers t JOIN schools s ON s.id = t.school_id WHERE t.status = 'active' GROUP BY s.organization_id",
      );
      const schoolRisk = new Map();
      try {
        const params = [];
        let sql = `SELECT ss.id AS student_id, s.organization_id AS school_org, fr.id, fr.organization_id, fr.summary_data, fr.submitted_at
                     FROM school_students ss
                     JOIN schools s ON s.id = ss.school_id
                     JOIN form_responses fr ON fr.organization_id = s.organization_id
                      AND (fr.person_id = ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id = ss.patient_account_id))
                     JOIN forms f ON f.id = fr.form_id AND f.health_domain = 'mental'
                    WHERE ss.archived_at IS NULL AND ss.status = 'active'`;
        sql = addDateRange(sql, params, "fr.submitted_at", startDate, endDate);
        const [rows] = await db.query(
          sql + " ORDER BY fr.submitted_at DESC, fr.id DESC",
          params,
        );
        const { responseRisk } = require("../utils/schoolWorkflows");
        const seen = new Set();
        for (const row of rows) {
          if (seen.has(row.student_id)) continue;
          seen.add(row.student_id);
          const org = Number(row.school_org);
          if (!schoolRisk.has(org))
            schoolRisk.set(org, { screened: 0, high: 0, medium: 0, normal: 0 });
          const tally = schoolRisk.get(org);
          tally.screened++;
          const risk = responseRisk(row);
          if (risk in tally) tally[risk]++;
        }
      } catch (error) {
        if (!missingTable(error)) throw error;
      }

      const rangeSelected = isDateInput(startDate) || isDateInput(endDate);
      const items = organizations.map((o) => {
        const id = Number(o.id);
        const cases = dedupeCases(rowsByOrg.get(id) || []);
        const stats = tallyCaseStats(cases, { rangeSelected });
        const orgType = o.org_type === "school" ? "school" : "hospital";
        return {
          id,
          code: o.code,
          name: o.name,
          org_type: orgType,
          parent_name: o.parent_name || null,
          last_activity_at: lastActivity.get(id) || null,
          published_forms: formCounts.get(id) || 0,
          cases: {
            total: cases.length,
            active: stats.totalActive,
            closed: stats.closed,
            highRisk: stats.highRisk,
            waitingContact: stats.waitingContact,
          },
          school:
            orgType === "school"
              ? {
                  students: students.get(id) || 0,
                  classrooms: classrooms.get(id) || 0,
                  teachers: teachers.get(id) || 0,
                  ...(schoolRisk.get(id) || {
                    screened: 0,
                    high: 0,
                    medium: 0,
                    normal: 0,
                  }),
                }
              : null,
        };
      });
      const sum = (pick) =>
        items.reduce((n, item) => n + (Number(pick(item)) || 0), 0);
      res.set("Cache-Control", "no-store");
      res.json({
        range: { startDate: startDate || null, endDate: endDate || null },
        totals: {
          organizations: items.length,
          hospitals: items.filter((i) => i.org_type === "hospital").length,
          schools: items.filter((i) => i.org_type === "school").length,
          cases: sum((i) => i.cases.total),
          active: sum((i) => i.cases.active),
          closed: sum((i) => i.cases.closed),
          highRisk: sum((i) => i.cases.highRisk),
          waitingContact: sum((i) => i.cases.waitingContact),
          students: sum((i) => i.school?.students),
          screened: sum((i) => i.school?.screened),
          studentHighRisk: sum((i) => i.school?.high),
        },
        organizations: items,
      });
    } catch (error) {
      console.error(
        "Organizations Overview Error:",
        require("../utils/safeError").safeError(error),
      );
      res.status(500).json({ message: "โหลดภาพรวมทุกหน่วยงานไม่สำเร็จ" });
    }
  },
);

module.exports = router;
