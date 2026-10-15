// routes/formRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { dispatchTelegramAlert } = require("../utils/telegram");
// 🟢 นำเข้าระบบเข้ารหัส
const { encrypt, decrypt } = require("../utils/encryption");
const {
  resolveSubmissionOwner,
  resolveGuestSubmissionOwner,
} = require("../utils/submissionIdentity");
const { submittedBy } = require("../utils/submissionOwner");
const {
  PersonIdentityConflictError,
  normalizeNationalId,
} = require("../utils/personIdentity");
const {
  verifyToken,
  requirePermission,
} = require("../middleware/authMiddleware");
const { organizationWhere } = require("../authorization/authorization");
const {
  attachOptionalPatient,
} = require("../middleware/patientAuthMiddleware");
const {
  hasValidLoginEnforcement,
  hasValidResultDisplayMode,
  isFormOpenForSubmission,
  normalizeLoginEnforcement,
  normalizeResultDisplayMode,
  requiresAuthenticatedSubmission,
  hasValidHealthDomain,
  normalizeHealthDomain,
} = require("../utils/formSettings");
const NodeCache = require("node-cache");
const sharp = require("sharp");
const {
  sanitizeFormContent,
  sanitizeRichText,
} = require("../utils/contentSecurity");
const { decryptCaseResponse } = require("../utils/decryptCaseData");
// ตั้งค่าให้จำไว้ 60 วินาที (1 นาที) เพื่อให้หน้าเว็บไม่อืด แต่แอดมินแก้ฟอร์มแล้วยังอัปเดตไวอยู่
const formCache = new NodeCache({ stdTTL: 60 });
const coverCache = new NodeCache({ stdTTL: 3600, useClones: false });
// Helper ถอดรหัส (ถ้าเป็น plain text เดิม จะคืนค่าเดิมกลับไป)
const safeDecrypt = (val) => decrypt(val) || val;

const isBlankDisplay = (value) =>
  value === undefined ||
  value === null ||
  ["", "-"].includes(String(value).trim());

const patientAccountName = (patient) =>
  [patient.first_name_encrypted, patient.last_name_encrypted]
    .map((value) => (value ? safeDecrypt(value) : ""))
    .filter(Boolean)
    .join(" ")
    .trim();

// Question ids whose answers are personal data, decided by question type so a
// title without a Thai keyword (e.g. "ID card") is still encrypted.
const SENSITIVE_QUESTION_TYPES = new Set([
  "national_id",
  "full_name",
  "phone_number",
]);
function sensitiveQuestionIdSet(questionsJson) {
  const ids = new Set();
  let questions = questionsJson;
  if (typeof questions === "string") {
    try {
      questions = JSON.parse(questions);
    } catch {
      questions = [];
    }
  }
  const visit = (items) => {
    if (!Array.isArray(items)) return;
    for (const question of items) {
      if (!question || typeof question !== "object") continue;
      if (
        SENSITIVE_QUESTION_TYPES.has(question.type) ||
        question.systemRole === "name"
      )
        ids.add(String(question.id));
      visit(question.subQuestions);
    }
  };
  visit(questions);
  return ids;
}

const formScope = (req, column = "f.organization_id") =>
  req.organizationContext === undefined
    ? { sql: "", params: [] }
    : organizationWhere(column, req);
const canManageForms = (req) =>
  Boolean(
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has("forms.view"),
  );

async function requireFormScope(req, res, formId) {
  const [rows] = await db.query(
    "SELECT organization_id FROM forms WHERE id = ?",
    [formId],
  );
  if (!rows.length) {
    res.status(404).json({ message: "ไม่พบข้อมูลฟอร์ม" });
    return false;
  }
  if (!rows[0].organization_id) {
    res.status(503).json({ code: "FORM_OWNER_REVIEW_REQUIRED" });
    return false;
  }
  if (
    req.organizationContext === undefined ||
    req.organizationContext === "all"
  )
    return true;
  const allowed =
    Number(rows[0].organization_id) === Number(req.organizationContext);
  if (!allowed) {
    res
      .status(403)
      .json({ message: "คุณไม่มีสิทธิ์เข้าถึงฟอร์มของหน่วยงานนี้" });
    return false;
  }
  return true;
}

// A form inherits its organization from the clinic selected for that form.
// This keeps a clinic's forms inside the same tenant even when a request body
// is edited manually.
async function organizationForClinic(req, res, clinicType) {
  // "general" is the UI's shared/no-specific-clinic option and is not backed
  // by a row in `clinics` — resolve it from the already-verified active
  // organization instead of requiring a matching clinic to exist.
  if (clinicType === "general" && typeof req.organizationContext === "number") {
    return req.organizationContext;
  }
  const [rows] = await db.query(
    "SELECT organization_id FROM clinics WHERE slug = ? AND organization_id IS NOT NULL LIMIT 1",
    [clinicType],
  );
  if (!rows.length) {
    res.status(422).json({ error: "กรุณาเลือกคลินิกที่มีหน่วยงานเจ้าของ" });
    return null;
  }
  const organizationId = Number(rows[0].organization_id);
  if (
    typeof req.organizationContext === "number" &&
    organizationId !== Number(req.organizationContext)
  ) {
    res
      .status(403)
      .json({ error: "คลินิกนี้ไม่ได้อยู่ในหน่วยงานที่กำลังใช้งาน" });
    return null;
  }
  return organizationId;
}

// 1. บันทึกฟอร์มใหม่ (🟢 เพิ่ม form_type)
router.post("/save-form", verifyToken, async (req, res) => {
  const {
    title,
    description,
    formStepName,
    theme,
    questions,
    status,
    clinic_type,
    form_type,
    publish_start_date,
    publish_end_date,
    login_enforcement,
    result_display_mode,
    health_domain,
  } = req.body;
  try {
    if (
      !hasValidLoginEnforcement(login_enforcement) ||
      !hasValidResultDisplayMode(result_display_mode) ||
      !hasValidHealthDomain(health_domain)
    ) {
      return res
        .status(422)
        .json({ error: "รูปแบบการเข้าสู่ระบบหรือการแสดงผลลัพธ์ไม่ถูกต้อง" });
    }
    const organizationId = await organizationForClinic(
      req,
      res,
      clinic_type || "general",
    );
    if (!organizationId) return;
    const query = `
      INSERT INTO forms
      (title, description, step_name, theme, questions, status, clinic_type, form_type, publish_start_date, publish_end_date, login_enforcement, result_display_mode, health_domain, organization_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      sanitizeRichText(title || "แบบฟอร์มไม่มีชื่อ"),
      sanitizeRichText(description || ""),
      sanitizeRichText(formStepName || "ส่วนที่ 1"),
      JSON.stringify(theme || {}),
      JSON.stringify(sanitizeFormContent(questions || [])),
      status || "draft",
      clinic_type || "general",
      form_type || "Registration",
      publish_start_date || null,
      publish_end_date || null,
      normalizeLoginEnforcement(login_enforcement),
      normalizeResultDisplayMode(result_display_mode),
      normalizeHealthDomain(health_domain),
      organizationId,
    ];
    const [result] = await db.query(query, values);
    formCache.flushAll();
    res.json({ message: "Form saved successfully", id: result.insertId });
  } catch (error) {
    console.error(require("../utils/safeError").safeError(error));
    res.status(500).json({ error: "Failed to save form" });
  }
});

// 2. ดึงข้อมูลฟอร์มทั้งหมด (🟢 เพิ่ม form_type)
router.get("/forms", async (req, res) => {
  try {
    const sort = req.query.sort || "lastOpened";

    const management = canManageForms(req);
    const cacheKey = `all_forms_${sort}_${req.organizationContext || "public"}_${management ? "management" : "published"}`;

    if (formCache.has(cacheKey)) {
      return res.json(formCache.get(cacheKey));
    }

    const scope = formScope(req);
    const [rows] = await db.query(
      `SELECT f.id, f.title, f.description, f.updated_at, f.status, f.clinic_type, f.form_type,
              publish_start_date, publish_end_date, f.login_enforcement, f.result_display_mode, f.health_domain,
              f.organization_id, o.name AS organization_name, o.code AS organization_code,
              CASE
                WHEN JSON_VALID(f.theme) = 1
                  THEN COALESCE(JSON_UNQUOTE(JSON_EXTRACT(f.theme, '$.headerImage')), '') NOT IN ('', 'null')
                ELSE 0
              END AS has_cover
         FROM forms f LEFT JOIN organizations o ON o.id = f.organization_id WHERE 1=1${scope.sql}${!management ? " AND f.status='published' AND f.organization_id IS NOT NULL" : ""}`,
      scope.params,
    );

    rows.sort((a, b) => {
      if (sort === "title") return (a.title || "").localeCompare(b.title || "");
      else return new Date(b.updated_at) - new Date(a.updated_at);
    });

    const formattedForms = rows.map((form) => {
      const d = new Date(form.updated_at);
      const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear() + 543}`;

      return {
        id: form.id,
        title: form.title,
        description: form.description,
        image: form.has_cover ? `/api/forms/${form.id}/cover` : null,
        lastOpenedDate: dateStr,
        status: form.status,
        clinic_type: form.clinic_type,
        form_type: form.form_type,
        publish_start_date: form.publish_start_date,
        publish_end_date: form.publish_end_date,
        login_enforcement: normalizeLoginEnforcement(form.login_enforcement),
        result_display_mode: normalizeResultDisplayMode(
          form.result_display_mode,
        ),
        health_domain: normalizeHealthDomain(form.health_domain),
        organization_id: form.organization_id,
        organization_name: form.organization_name,
        organization_code: form.organization_code,
      };
    });
    formCache.set(cacheKey, formattedForms);
    res.json(formattedForms);
  } catch (err) {
    console.error(
      "Error fetching forms:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลฟอร์ม" });
  }
});

// 3. ดึงจำนวนผู้ตอบฟอร์ม
// Serve covers separately instead of embedding every base64 image in /forms.
router.get(
  "/forms/:id/cover",
  async (req, res, next) => {
    try {
      const [rows] = await db.query(
        "SELECT status,organization_id FROM forms WHERE id=?",
        [req.params.id],
      );
      const form = rows[0];
      if (!form?.organization_id) return res.status(404).end();
      if (form.status === "published") return next();
      const checked = async () => {
        if (
          !canManageForms(req) ||
          !(await requireFormScope(req, res, req.params.id))
        )
          return res.headersSent ? undefined : res.status(404).end();
        await require("../utils/pdpaAudit").requiredAudit(
          req,
          "form.cover.read",
          "form",
          req.params.id,
        );
        next();
      };
      if (req.authorization) return await checked();
      if (
        !req.cookies?.[
          require("../services/sessionService").cookieName("staff")
        ]
      )
        return res.status(404).end();
      // Image tags cannot send the active-unit header. Resolve the unit from the
      // stored form, then prove membership and permission on the authenticated server.
      return verifyToken(req, res, () => {
        req.headers["x-organization-id"] = String(form.organization_id);
        return require("../authorization/authorization").resolveContext(
          req,
          res,
          () => checked().catch(next),
        );
      });
    } catch (error) {
      next(error);
    }
  },
  async (req, res) => {
    try {
      const formId = Number(req.params.id);
      if (!Number.isInteger(formId) || formId <= 0) {
        return res.status(400).json({ message: "Invalid form ID" });
      }

      const [rows] = await db.query(
        "SELECT theme, updated_at,status,organization_id FROM forms WHERE id = ?",
        [formId],
      );
      if (!rows.length) return res.status(404).end();
      if (
        !rows[0].organization_id ||
        (!canManageForms(req) && rows[0].status !== "published")
      )
        return res.status(404).end();
      if (
        req.organizationContext !== undefined &&
        !(await requireFormScope(req, res, formId))
      )
        return;

      const theme =
        typeof rows[0].theme === "string"
          ? JSON.parse(rows[0].theme)
          : rows[0].theme || {};
      const cover = theme.headerImage;
      if (!cover || typeof cover !== "string") return res.status(404).end();
      // Do not turn a first-party image endpoint into an open redirect/tracker.
      if (!cover.startsWith("data:")) return res.status(404).end();

      const match =
        /^data:(image\/(?:avif|gif|jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
          cover,
        );
      if (!match) return res.status(415).end();

      const sourceImage = Buffer.from(match[2].replace(/\s/g, ""), "base64");
      const updatedAt = new Date(rows[0].updated_at).getTime() || 0;
      const cacheKey = `${formId}-${updatedAt}-${sourceImage.length}`;
      let image = coverCache.get(cacheKey);
      if (!image) {
        image = await sharp(sourceImage)
          .rotate()
          .resize({ width: 800, withoutEnlargement: true })
          .webp({ quality: 78, effort: 4 })
          .toBuffer();
        coverCache.set(cacheKey, image);
      }

      const etag = `W/\"${cacheKey}-${image.length}\"`;
      if (req.headers["if-none-match"] === etag) return res.status(304).end();

      res.set({
        "Content-Type": "image/webp",
        "Content-Length": image.length,
        "Cache-Control": "private, no-store",
        ETag: etag,
      });
      return res.send(image);
    } catch (err) {
      console.error(
        "Error fetching form cover:",
        require("../utils/safeError").safeError(err),
      );
      return res.status(500).end();
    }
  },
);

router.get("/forms/:id/submission-count", verifyToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM form_responses WHERE form_id = ?",
      [req.params.id],
    );
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ count: 0 });
  }
});

// 3.5 ✅ ดึงจำนวนผู้ตอบฟอร์มหลายรายการในครั้งเดียว (Batch API + 🟢 Caching)
router.post("/counts", async (req, res) => {
  try {
    const { formIds } = req.body;

    if (
      !Array.isArray(formIds) ||
      formIds.length === 0 ||
      formIds.length > 200 ||
      formIds.some((id) => !Number.isSafeInteger(Number(id)) || Number(id) < 1)
    ) {
      return res.status(400).json({ error: "Invalid formIds" });
    }

    const management = canManageForms(req),
      scope = formScope(req);
    const cacheKey = `counts_${req.organizationContext || "public"}_${management ? "management" : "published"}_${[...formIds].sort().join("_")}`;

    if (formCache.has(cacheKey)) {
      return res.json({ data: formCache.get(cacheKey) });
    }

    const placeholders = formIds.map(() => "?").join(",");
    const query = `
            SELECT fr.form_id, COUNT(*) as count
            FROM form_responses fr JOIN forms f ON f.id=fr.form_id AND f.organization_id=fr.organization_id
            WHERE fr.form_id IN (${placeholders}) AND f.organization_id IS NOT NULL${scope.sql}${management ? "" : " AND f.status='published'"}
            GROUP BY fr.form_id
        `;

    const [rows] = await db.query(query, [...formIds, ...scope.params]);

    const countMap = {};
    rows.forEach((row) => {
      countMap[row.form_id] = row.count;
    });
    formIds.forEach((formId) => {
      if (!(formId in countMap)) countMap[formId] = 0;
    });

    formCache.set(cacheKey, countMap, 60);

    res.json({ data: countMap });
  } catch (err) {
    console.error(
      "Error fetching counts:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ error: "Failed to fetch counts" });
  }
});

// 4. ดึงข้อมูลฟอร์มตาม ID
router.get("/forms/:id", async (req, res) => {
  try {
    if (!(await requireFormScope(req, res, req.params.id))) return;
    const [rows] = await db.query("SELECT * FROM forms WHERE id = ?", [
      req.params.id,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ message: "ไม่พบข้อมูลฟอร์ม" });

    // Calculate option usage for quota limits
    const [usageRows] = await db.query(
      "SELECT fa.question_id,fa.question_title,fa.answer_value,fr.organization_id FROM form_answers fa JOIN form_responses fr ON fr.id=fa.response_id WHERE fa.form_id=? AND fr.organization_id=?",
      [req.params.id, rows[0].organization_id],
    );
    const form = rows[0];
    if (
      !canManageForms(req) &&
      (form.status !== "published" || !form.organization_id)
    )
      return res.status(404).json({ code: "FORM_UNAVAILABLE" });
    form.title = sanitizeRichText(form.title);
    form.description = sanitizeRichText(form.description);
    form.step_name = sanitizeRichText(form.step_name);
    const parsedQuestions =
      typeof form.questions === "string"
        ? JSON.parse(form.questions)
        : form.questions;
    form.questions = sanitizeFormContent(parsedQuestions || []);
    form.optionUsage = require("../utils/formOptionUsage").optionUsage(
      form.questions,
      usageRows,
    );

    res.json(form);
  } catch (err) {
    console.error(
      "Error fetching form:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// 5. อัปเดตข้อมูลฟอร์มทั้งหมด (🟢 เพิ่ม form_type)
router.put("/forms/:id", verifyToken, async (req, res) => {
  const formId = req.params.id;
  const {
    title,
    description,
    formStepName,
    theme,
    questions,
    status,
    clinic_type,
    form_type,
    publish_start_date,
    publish_end_date,
    login_enforcement,
    result_display_mode,
    health_domain,
  } = req.body;
  try {
    if (
      !hasValidLoginEnforcement(login_enforcement) ||
      !hasValidResultDisplayMode(result_display_mode) ||
      !hasValidHealthDomain(health_domain)
    ) {
      return res
        .status(422)
        .json({ error: "รูปแบบการเข้าสู่ระบบหรือการแสดงผลลัพธ์ไม่ถูกต้อง" });
    }
    if (!(await requireFormScope(req, res, formId))) return;
    const organizationId = await organizationForClinic(
      req,
      res,
      clinic_type || "general",
    );
    if (!organizationId) return;
    const query = `
      UPDATE forms SET title=?, description=?, step_name=?, theme=?, questions=?, status=?, clinic_type=?, form_type=?, publish_start_date=?, publish_end_date=?, login_enforcement=?, result_display_mode=?, health_domain=?, organization_id=? WHERE id=?
    `;
    const values = [
      sanitizeRichText(title || "แบบฟอร์มไม่มีชื่อ"),
      sanitizeRichText(description || ""),
      sanitizeRichText(formStepName || "ส่วนที่ 1"),
      JSON.stringify(theme || {}),
      JSON.stringify(sanitizeFormContent(questions || [])),
      status || "draft",
      clinic_type || "general",
      form_type || "Registration",
      publish_start_date || null,
      publish_end_date || null,
      normalizeLoginEnforcement(login_enforcement),
      normalizeResultDisplayMode(result_display_mode),
      normalizeHealthDomain(health_domain),
      organizationId,
      formId,
    ];
    await db.query(query, values);
    formCache.flushAll();
    res.json({ message: "Form updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update form" });
  }
});

// 6. ลบฟอร์ม
router.delete("/forms/:id", verifyToken, async (req, res) => {
  try {
    if (!(await requireFormScope(req, res, req.params.id))) return;
    await db.query("DELETE FROM forms WHERE id = ?", [req.params.id]);
    formCache.flushAll();
    res.json({ message: "ลบฟอร์มสำเร็จ!" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการลบฟอร์ม" });
  }
});

// 7. เปลี่ยนชื่อฟอร์ม
router.patch("/forms/:id/rename", verifyToken, async (req, res) => {
  try {
    if (!(await requireFormScope(req, res, req.params.id))) return;
    await db.query("UPDATE forms SET title = ? WHERE id = ?", [
      sanitizeRichText(req.body.title),
      req.params.id,
    ]);
    res.json({ message: "เปลี่ยนชื่อฟอร์มสำเร็จ!" });
  } catch (err) {
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการเปลี่ยนชื่อฟอร์ม" });
  }
});

// 8. เปลี่ยนรูปปกฟอร์ม
router.patch("/forms/:id/image", verifyToken, async (req, res) => {
  try {
    const formId = req.params.id;
    if (!(await requireFormScope(req, res, formId))) return;
    const [rows] = await db.query("SELECT theme FROM forms WHERE id = ?", [
      formId,
    ]);
    if (rows.length === 0)
      return res.status(404).json({ message: "ไม่พบฟอร์ม" });
    let themeData = rows[0].theme
      ? typeof rows[0].theme === "string"
        ? JSON.parse(rows[0].theme)
        : rows[0].theme
      : {};
    themeData.headerImage = req.body.image;
    await db.query("UPDATE forms SET theme = ? WHERE id = ?", [
      JSON.stringify(themeData),
      formId,
    ]);
    formCache.flushAll();
    res.json({ success: true, message: "อัปเดตรูปปกสำเร็จ!" });
  } catch (err) {
    console.error(
      "Error updating form image:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// 9. อัปเดตสถานะของฟอร์ม
router.patch("/forms/:id/status", verifyToken, async (req, res) => {
  try {
    if (!(await requireFormScope(req, res, req.params.id))) return;
    await db.query("UPDATE forms SET status = ? WHERE id = ?", [
      req.body.status,
      req.params.id,
    ]);
    formCache.flushAll();
    res.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    res.status(500).json({ error: "ไม่สามารถอัปเดตสถานะได้" });
  }
});

// 10. รับคำตอบของฟอร์ม (🟢 ผูก MasterCase และระบบเข้ารหัส)
router.post("/forms/:id/submit", attachOptionalPatient, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const formId = req.params.id;
    const {
      answers,
      questionTitles = {},
      summaryData,
      identityValue,
      consent_given: consentGiven,
    } = req.body;

    // 🔒 ตรวจสอบความถูกต้องของ input เบื้องต้น
    if (isNaN(Number(formId))) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }
    if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
      return res.status(400).json({ message: "กรุณาตอบแบบฟอร์มให้ครบถ้วน" });
    }
    if (
      summaryData !== undefined &&
      summaryData !== null &&
      typeof summaryData !== "object"
    ) {
      return res.status(400).json({ message: "ข้อมูลไม่ถูกต้อง" });
    }

    // Verify the form before opening a transaction. A missing form must never
    // create a response or a Master Case.
    const [formRows] = await connection.query(
      "SELECT title, clinic_type, form_type, organization_id, login_enforcement, status, publish_start_date, publish_end_date, questions FROM forms WHERE id = ?",
      [formId],
    );
    if (!formRows[0])
      return res.status(404).json({ message: "ไม่พบข้อมูลฟอร์ม" });
    const form = formRows[0];
    if (
      !Number.isSafeInteger(Number(form.organization_id)) ||
      Number(form.organization_id) < 1
    )
      return res
        .status(503)
        .json({ code: "FORM_ORGANIZATION_REVIEW_REQUIRED" });
    // The landing page hides unpublished forms, but the API must enforce it too:
    // a draft or an expired form must not accept answers by direct URL.
    if (!isFormOpenForSubmission(form)) {
      return res.status(403).json({
        success: false,
        message: "แบบประเมินนี้ยังไม่เปิดรับคำตอบในขณะนี้",
      });
    }
    const clinicType = form.clinic_type || "general";
    const loginEnforcement = normalizeLoginEnforcement(form.login_enforcement);
    if (requiresAuthenticatedSubmission(loginEnforcement) && !req.patient) {
      return res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบก่อนส่งแบบประเมินนี้",
        login_enforcement: loginEnforcement,
      });
    }

    // The national ID only identifies the person after explicit PDPA consent.
    // Without consent the submission stays anonymous (or tied to the account).
    const hasIdentityAnswer =
      consentGiven === true && String(identityValue ?? "").trim() !== "";
    const nationalId = hasIdentityAnswer
      ? normalizeNationalId(identityValue)
      : null;
    if (hasIdentityAnswer && !nationalId)
      return res
        .status(422)
        .json({ message: "เลขบัตรประชาชนไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง" });

    await connection.beginTransaction();
    const processingPurpose = await require('../services/privacyNoticeService').getProcessingNotice(connection, formId, form.organization_id);
    if (
      processingPurpose?.legal_basis === "consent" &&
      (req.body.processing_consent !== true ||
        req.body.notice_version !== processingPurpose.notice_version)
    )
      throw Object.assign(new Error("CURRENT_NOTICE_CONSENT_REQUIRED"), {
        status: 422,
      });
    const invitation = req.body.invitation_token
      ? await require("../services/formInvitationService").resolveInvitation(
          connection,
          req.body.invitation_token,
          req.patient,
          formId,
          { lock: true },
        )
      : null;
    const owner = invitation
      ? {
          masterCaseId: invitation.master_case_id,
          personId: invitation.person_id,
          patientAccountId: req.patient.id,
          identityHash: req.patient.identity_hash,
        }
      : req.patient
        ? await resolveSubmissionOwner({
            connection,
            patientAccountId: req.patient.id,
            nationalId,
            clinicType,
            organizationId: Number(form.organization_id),
          })
        : await resolveGuestSubmissionOwner({
            connection,
            nationalId,
            clinicType,
            organizationId: Number(form.organization_id),
          });

    // โคลน summaryData เพื่อนำไปเข้ารหัส
    const dbSummary = JSON.parse(JSON.stringify(summaryData || {}));
    // Clients cannot inject or suppress a school risk override. Evaluate
    // the approved rule against the actual submitted answers on the server.
    delete dbSummary.school_risk_override;
    if(Array.isArray(dbSummary.score_results)) dbSummary.score_results=dbSummary.score_results.filter(r=>r.question_id!=='school_risk_trigger');
    const [schoolTriggers] = await connection.query(`SELECT DISTINCT tr.id,tr.question_id,tr.answer_path,tr.answer_value,tr.enabled FROM school_risk_triggers tr JOIN schools s ON s.id=tr.school_id JOIN school_students ss ON ss.school_id=s.id WHERE tr.form_id=? AND tr.enabled=1 AND s.organization_id=? AND ss.archived_at IS NULL AND ss.status='active' AND (ss.person_id=? OR ss.patient_account_id=?)`,[formId,form.organization_id,owner.personId||0,owner.patientAccountId||0]);
    const schoolOverride = require('../utils/schoolWorkflows').evaluateRiskTriggers(schoolTriggers,answers);
    if (schoolOverride) {
      dbSummary.school_risk_override = schoolOverride;
      dbSummary.score_results = [...(Array.isArray(dbSummary.score_results)?dbSummary.score_results:[]),{question_id:'school_risk_trigger',title:'เกณฑ์รายข้อที่โรงเรียนกำหนด',label:'เสี่ยงสูง',color:'#d93025',score:null,advice:''}];
    }
    // A logged-in submitter is known: when the form asked no name (or phone),
    // record the account's own so every case view can show who submitted.
    const accountName = req.patient ? patientAccountName(req.patient) : "";
    if (accountName && isBlankDisplay(dbSummary.display_name)) {
      dbSummary.display_name = accountName;
      dbSummary.display_name_source = "account";
    }
    const accountPhone = req.patient?.phone_encrypted
      ? safeDecrypt(req.patient.phone_encrypted)
      : "";
    if (accountPhone && isBlankDisplay(dbSummary.display_phone)) {
      dbSummary.display_phone = accountPhone;
      dbSummary.display_phone_source = "account";
    }
    const plainDisplayName = dbSummary.display_name;
    const plainDisplayPhone = dbSummary.display_phone;
    if (nationalId) dbSummary.consent_given = true;

    // 🟢 3. Insert response พร้อมผูก master_case_id
    const [respResult] = await connection.query(
      "INSERT INTO form_responses (form_id, master_case_id, person_id, patient_account_id, identity_value, identity_hash, summary_data, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        formId,
        owner.masterCaseId,
        owner.personId || null,
        owner.patientAccountId,
        nationalId
          ? require("../utils/privateField").writeField(
              nationalId,
              "form_responses",
              "identity_value",
              form.organization_id,
            )
          : null,
        owner.identityHash,
        JSON.stringify(
          require("../utils/privateData").sealJson(
            dbSummary,
            require("../utils/privateData").fieldContext(
              "form_responses",
              "summary_data",
              form.organization_id,
            ),
          ),
        ),
        formRows[0].organization_id || null,
      ],
    );
    if (formRows[0].organization_id) {
      await connection.query(
        "UPDATE mastercases SET organization_id = COALESCE(organization_id, ?) WHERE id = ?",
        [formRows[0].organization_id, owner.masterCaseId],
      );
    }
    const responseId = respResult.insertId;

    // A person without an account (guest with a consented ID) is named after
    // the latest answer. A linked account keeps its own name.
    if (
      owner.personId &&
      !owner.patientAccountId &&
      !isBlankDisplay(plainDisplayName)
    ) {
      await connection.query(
        "UPDATE persons SET first_name_encrypted = ?, last_name_encrypted = NULL WHERE id = ? AND patient_account_id IS NULL",
        [
          require("../utils/privateField").writeField(
            String(plainDisplayName),
            "persons",
            "display_name_encrypted",
          ),
          owner.personId,
        ],
      );
    }

    // บันทึกคำตอบรายข้อ
    const titleMap = new Map();
    const visit = (items) => {
      for (const question of Array.isArray(items) ? items : []) {
        titleMap.set(
          String(question.id),
          String(question.title || question.label || ""),
        );
        visit(question.subQuestions);
      }
    };
    visit(
      typeof form.questions === "string"
        ? JSON.parse(form.questions)
        : form.questions,
    );
    for (const [qId, ansValue] of Object.entries(answers)) {
      const value = require("../utils/privateData").sealJson(
        ansValue,
        require("../utils/privateData").fieldContext(
          "form_answers",
          "answer_value",
          form.organization_id,
        ),
      );
      await connection.query(
        "INSERT INTO form_answers (response_id, form_id, question_id, question_title, answer_value) VALUES (?, ?, ?, ?, ?)",
        [
          responseId,
          formId,
          qId,
          titleMap.get(String(qId)) || "Unknown Question",
          JSON.stringify(value),
        ],
      );
    }
    if (processingPurpose?.legal_basis === "consent")
      await connection.query(
        "INSERT INTO pdpa_consent_evidence (organization_id,patient_account_id,response_id,purpose,notice_version,granted) VALUES (?,?,?,?,?,1)",
        [
          form.organization_id,
          req.patient?.id || null,
          responseId,
          processingPurpose.purpose,
          processingPurpose.notice_version,
        ],
      );
    if (invitation)
      await require("../services/formInvitationService").consumeInvitation(
        connection,
        invitation,
        responseId,
      );
    const [notification] = await connection.query(
      'INSERT INTO organization_notification_events (organization_id,response_id,status,reason_code) VALUES (?,? ,"pending",NULL)',
      [form.organization_id, responseId],
    );
    await connection.commit();

    require("../services/organizationNotificationService")
      .notifySubmission({
        organizationId: form.organization_id,
        responseId,
        eventId: notification.insertId,
      })
      .catch(() => console.warn("Notification unavailable"));

    res.status(201).json({
      message: "บันทึกคำตอบสำเร็จ",
      responseId,
      masterCaseId: owner.masterCaseId,
      ...(schoolOverride ? {score_results:dbSummary.score_results} : {}),
    });
  } catch (err) {
    await connection.rollback();
    if (err.status)
      return res.status(err.status).json({
        code: err.code,
        message: "ไม่สามารถส่งแบบฟอร์มด้วยลิงก์นี้ได้",
      });
    if (err instanceof PersonIdentityConflictError)
      return res.status(409).json({ code: err.code, message: err.message });
    console.error(require("../utils/safeError").safeError(err));
    res.status(500).json({ message: "เกิดข้อผิดพลาดในการบันทึกคำตอบ" });
  } finally {
    connection.release();
  }
});

// 11. ดึงคำตอบทั้งหมด (Dashboard ฝั่งแอดมิน - 🟢 ถอดรหัส & เพิ่ม Pagination)
router.get(
  "/forms/:id/responses",
  verifyToken,
  requirePermission("Case Management", "view"),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const wantsAll = req.query.limit === "all";
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const limit = Number.isInteger(requestedLimit)
        ? Math.min(Math.max(requestedLimit, 1), 500)
        : 100;
      const requestedOffset = Number.parseInt(req.query.offset, 10);
      const offset =
        Number.isInteger(requestedOffset) && requestedOffset > 0
          ? requestedOffset
          : 0;

      let sql =
        "SELECT fr.*, f.title AS form_title, pa.username AS patient_username, pa.first_name_encrypted AS patient_first_name_encrypted, pa.last_name_encrypted AS patient_last_name_encrypted FROM form_responses fr JOIN forms f ON f.id=fr.form_id AND f.organization_id=fr.organization_id LEFT JOIN patient_accounts pa ON pa.id = fr.patient_account_id WHERE fr.form_id = ?";
      const params = [req.params.id];
      const scope = organizationWhere("fr.organization_id", req);
      sql += scope.sql;
      params.push(...scope.params);
      if (
        typeof startDate === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(startDate)
      ) {
        sql += " AND DATE(fr.submitted_at) >= ?";
        params.push(startDate);
      }
      if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        sql += " AND DATE(fr.submitted_at) <= ?";
        params.push(endDate);
      }
      sql += " ORDER BY fr.submitted_at DESC";
      if (!wantsAll) {
        sql += " LIMIT ? OFFSET ?";
        params.push(limit, offset);
      }

      const [rows] = await db.query(sql, params);

      const decryptedRows = await Promise.all(
        rows.map(async (row) => {
          const response = decryptCaseResponse(row, safeDecrypt);
          response.submitted_by = submittedBy(response);
          delete response.patient_username;
          delete response.patient_first_name_encrypted;
          delete response.patient_last_name_encrypted;
          return response;
        }),
      );

      res.json(await require("../services/latestActivity").attachCaseActivities(db, decryptedRows));
    } catch (err) {
      console.error(require("../utils/safeError").safeError(err));
      res.status(500).json({ message: "เกิดข้อผิดพลาดในการดึงข้อมูลคำตอบ" });
    }
  },
);

// 12. โหลดคำถามของ form
router.get("/forms/:id/questions", async (req, res) => {
  try {
    if (!(await requireFormScope(req, res, req.params.id))) return;
    const [rows] = await db.query("SELECT questions FROM forms WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length)
      return res.status(404).json({ message: "Form not found" });
    const questions =
      typeof rows[0].questions === "string"
        ? JSON.parse(rows[0].questions)
        : rows[0].questions;
    // คืนค่า questions ทั้งหมดเพื่อให้ frontend นำไปใช้จัดการได้ครบถ้วน (เช่น scoringRules)
    res.json(sanitizeFormContent(questions || []));
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 13. อัปเดตประเภทคลินิก
router.patch("/forms/:id/clinic", verifyToken, async (req, res) => {
  try {
    if (!(await requireFormScope(req, res, req.params.id))) return;
    const organizationId = await organizationForClinic(
      req,
      res,
      req.body.clinic_type,
    );
    if (!organizationId) return;
    await db.query(
      "UPDATE forms SET clinic_type = ?, organization_id = ? WHERE id = ?",
      [req.body.clinic_type, organizationId, req.params.id],
    );
    formCache.flushAll();
    res.json({ message: "Clinic updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to update clinic" });
  }
});

// 🟢 API สำหรับคัดลอกฟอร์ม (Duplicate)
router.post("/forms/:id/duplicate", verifyToken, async (req, res) => {
  try {
    const formId = req.params.id;

    if (!(await requireFormScope(req, res, formId))) return;

    const [rows] = await db.query("SELECT * FROM forms WHERE id = ?", [formId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "ไม่พบฟอร์มที่ต้องการทำสำเนา" });
    }

    const originalForm = rows[0];
    const newTitle = `(สำเนา) ${originalForm.title}`;

    // 🟢 ตรวจสอบข้อมูลก่อนบันทึก (กันข้อมูลเพี้ยนจากการที่ MySQL Driver คืนค่าเป็น Object/String ต่างกัน)
    const themeData =
      typeof originalForm.theme === "object"
        ? JSON.stringify(originalForm.theme)
        : originalForm.theme;
    const questionsData =
      typeof originalForm.questions === "object"
        ? JSON.stringify(originalForm.questions)
        : originalForm.questions;

    const [result] = await db.query(
      `INSERT INTO forms (title, description, step_name, theme, questions, image, status, clinic_type, form_type, publish_start_date, publish_end_date, login_enforcement, result_display_mode, health_domain, organization_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newTitle,
        originalForm.description || "",
        originalForm.step_name || "ส่วนที่ 1",
        themeData,
        questionsData,
        originalForm.image || null,
        "draft",
        originalForm.clinic_type || "general",
        originalForm.form_type || "Registration",
        originalForm.publish_start_date || null,
        originalForm.publish_end_date || null,
        normalizeLoginEnforcement(originalForm.login_enforcement),
        normalizeResultDisplayMode(originalForm.result_display_mode),
        normalizeHealthDomain(originalForm.health_domain),
        originalForm.organization_id,
      ],
    );

    // 🟢 ล้าง Cache ทั้งหมดเพื่อให้ฟอร์มใหม่แสดงขึ้นมาทันที
    formCache.flushAll();

    res.status(201).json({
      message: "ทำสำเนาฟอร์มสำเร็จ",
      newFormId: result.insertId,
    });
  } catch (err) {
    console.error(
      "Error duplicating form:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ message: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
});

// รับข้อมูลจาก Popup ประเมินความพึงพอใจของระบบ
router.post("/submit-system-feedback", async (req, res) => {
  const d = req.body;
  try {
    const query = `
            INSERT INTO system_satisfaction_evaluations
            (sat_ui, sat_speed, sat_content, sat_access, sat_overall,
             sus1, sus2, sus3, sus4, sus5, sus6, sus7, sus8, sus9, sus10,
             sus_total_score, suggestions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
    const values = [
      d.sat_ui,
      d.sat_speed,
      d.sat_content,
      d.sat_access,
      d.sat_overall,
      d.sus1,
      d.sus2,
      d.sus3,
      d.sus4,
      d.sus5,
      d.sus6,
      d.sus7,
      d.sus8,
      d.sus9,
      d.sus10,
      d.sus_total_score,
      d.suggestions,
    ];

    await db.query(query, values);
    res.status(201).json({ message: "บันทึกการประเมินสำเร็จ" });
  } catch (err) {
    console.error(require("../utils/safeError").safeError(err));
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
});

router.get("/evaluations/stats", verifyToken, async (req, res) => {
  try {
    const [stats] = await db.query(`
            SELECT
                COUNT(id) as total_votes,
                AVG(sat_ui) as avg_ui,
                AVG(sat_speed) as avg_speed,
                AVG(sat_content) as avg_content,
                AVG(sat_access) as avg_access,
                AVG(sat_overall) as avg_overall,
                AVG(sus_total_score) as avg_sus,
                AVG(sus1) as avg_sus1, AVG(sus2) as avg_sus2, AVG(sus3) as avg_sus3,
                AVG(sus4) as avg_sus4, AVG(sus5) as avg_sus5, AVG(sus6) as avg_sus6,
                AVG(sus7) as avg_sus7, AVG(sus8) as avg_sus8, AVG(sus9) as avg_sus9, AVG(sus10) as avg_sus10
            FROM system_satisfaction_evaluations
        `);

    const [comments] = await db.query(`
            SELECT suggestions, created_at
            FROM system_satisfaction_evaluations
            WHERE suggestions IS NOT NULL AND TRIM(suggestions) != ''
            ORDER BY created_at DESC
            LIMIT 10
        `);

    res.json({
      ...stats[0],
      recent_comments: comments,
    });
  } catch (err) {
    console.error(
      "Fetch Eval Stats Error:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ error: "Failed to fetch evaluation stats" });
  }
});

router.get("/evaluations/list", verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const [totalRows] = await db.query(
      `SELECT COUNT(*) as count FROM system_satisfaction_evaluations`,
    );
    const total = totalRows[0].count;

    const [rows] = await db.query(
      `
            SELECT
                id, sat_ui, sat_speed, sat_content, sat_access, sat_overall,
                sus_total_score, suggestions, created_at
            FROM system_satisfaction_evaluations
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `,
      [limit, offset],
    );

    res.json({
      data: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error(
      "Fetch Eval List Error:",
      require("../utils/safeError").safeError(err),
    );
    res.status(500).json({ error: "Failed to fetch evaluation list" });
  }
});

module.exports = router;
