const accountEmail = require("../utils/accountEmail");
const express = require("express");
const { db, decrypt, audit, publicAccount } = require("../utils/patientAuth");
const {
  verifyPatientToken,
  verifyPatientTokenAllowingPasswordChange,
} = require("../middleware/patientAuthMiddleware");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
const rateLimit = require("express-rate-limit");
const {
  createChallenge,
  verifyChallenge,
  resendChallenge,
  normalizeEmail,
} = require("../services/otpService");

const router = express.Router();
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
});
const validEmail = (email) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
const safeDecrypt = (value) => decrypt(value);
const { decryptSummaryData } = require("../utils/decryptCaseData");
const decryptSummary = (value) => decryptSummaryData(value, safeDecrypt);
const { sealJson, fieldContext } = require("../utils/privateData");

const cleanProfileValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";
  const cleaned = String(value)
    .replace(/<[^>]*>/g, "")
    .trim();
  return cleaned && cleaned !== "-" ? cleaned : "";
};

const cleanProfilePhone = (value) => {
  const cleaned = cleanProfileValue(value);
  const digits = cleaned.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? cleaned : "";
};

const findRawAnswer = (summary, keyPattern) => {
  const rawAnswers = summary?.raw_answers;
  if (!rawAnswers || typeof rawAnswers !== "object") return "";
  const match = Object.entries(rawAnswers).find(
    ([key, value]) => keyPattern.test(String(key)) && cleanProfileValue(value),
  );
  return cleanProfileValue(match?.[1]);
};

const getHistoricalProfile = (responses) => {
  let displayName = "";
  let phone = "";

  for (const response of responses) {
    const summary = response.summary_data || {};
    displayName ||= cleanProfileValue(summary.display_name);
    displayName ||= findRawAnswer(summary, /ชื่อ|name/i);
    phone ||= cleanProfilePhone(summary.phone || summary.display_phone);
    phone ||= findRawAnswer(summary, /โทร|phone|mobile/i);
    if (displayName && phone) break;
  }

  return { displayName, phone: cleanProfilePhone(phone) };
};

async function ownResponse(req, responseId) {
  const [rows] = await db.query(
    "SELECT id, master_case_id, form_id, organization_id FROM form_responses WHERE id = ? AND organization_id IS NOT NULL AND (patient_account_id = ? OR (patient_account_id IS NULL AND ? IS NOT NULL AND identity_hash = ?)) LIMIT 1",
    [
      responseId,
      req.patient.id,
      req.patient.identity_hash,
      req.patient.identity_hash,
    ],
  );
  return rows[0] || null;
}

// Readable during a pending password change so the client can show who is
// signed in on the change-password page.
router.get(
  "/me",
  verifyPatientTokenAllowingPasswordChange,
  async (req, res) => {
    res.json({ success: true, user: publicAccount(req.patient) });
  },
);

router.use(verifyPatientToken);

const emailInUse = async (email, patientId) => {
  const [existing] = await db.query(
    "SELECT id FROM patient_accounts WHERE (email_hash=? OR (email_hash IS NULL AND email=?)) AND id<>? LIMIT 1",
    [accountEmail.lookup(email), email, patientId],
  );
  return existing.length > 0;
};
const emailInUseResponse = {
  success: false,
  message: "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว",
};

// The address is held in pending_email until the patient proves they own it;
// password recovery only trusts verified addresses.
router.patch("/me/email", otpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!validEmail(email))
    return res
      .status(400)
      .json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" });

  try {
    if (await emailInUse(email, req.patient.id))
      return res.status(409).json(emailInUseResponse);

    await db.query(
      "UPDATE patient_accounts SET pending_email=NULL,pending_email_encrypted=?,pending_email_hash=? WHERE id=?",
      [
        accountEmail.encode(email, "patient_accounts", "pending_email"),
        accountEmail.lookup(email),
        req.patient.id,
      ],
    );
    const challenge = await createChallenge(db, {
      accountType: "patient",
      accountId: req.patient.id,
      email,
      purpose: "email_verification",
      authVersion: Number(req.patient.auth_version || 0),
    });
    await audit(req.patient.id, "email_verification_sent_from_history", req);
    return res.json({
      success: true,
      requiresEmailVerification: true,
      ...challenge,
    });
  } catch (error) {
    console.error(
      "Patient email update failed:",
      require("../utils/safeError").safeError(error),
    );
    return res.status(503).json({
      success: false,
      message: "ไม่สามารถส่งรหัสยืนยันอีเมลได้ กรุณาลองใหม่",
    });
  }
});

router.post("/me/email/verify", otpLimiter, async (req, res) => {
  try {
    const result = await verifyChallenge(db, {
      challengeToken: req.body?.challengeToken,
      otp: req.body?.otp,
      accountType: "patient",
      purpose: "email_verification",
      loadAccount: async (connection, id) => {
        if (Number(id) !== Number(req.patient.id)) return null;
        const [rows] = await connection.query(
          "SELECT id,auth_version,pending_email,pending_email_encrypted FROM patient_accounts WHERE id=? AND status='active' LIMIT 1",
          [id],
        );
        const account = accountEmail.readAccount(rows[0], "patient_accounts");
        return account?.pending_email ? account : null;
      },
    });
    if (result.error)
      return res.status(400).json({ success: false, message: result.error });

    // Bind the verified address to the one the code was actually sent to, so a
    // newer pending_email written by a parallel request is never trusted.
    const challengeId = Number(String(req.body.challengeToken).split(".")[0]);
    const [[challenge]] = await db.query(
      "SELECT destination,destination_encrypted FROM auth_email_challenges WHERE id=? LIMIT 1",
      [challengeId],
    );
    const email = accountEmail.decode(
      challenge,
      "auth_email_challenges",
      "destination",
    );
    if (!email || email !== result.account.pending_email)
      return res.status(400).json({
        success: false,
        message: "คำขอยืนยันนี้ไม่สามารถใช้งานได้",
      });
    if (await emailInUse(email, req.patient.id))
      return res.status(409).json(emailInUseResponse);

    await db.query(
      "UPDATE patient_accounts SET email=NULL,email_encrypted=?,email_hash=?, email_verified_at=NOW(), pending_email=NULL,pending_email_encrypted=NULL,pending_email_hash=NULL WHERE id=? AND (pending_email_hash=? OR (pending_email_hash IS NULL AND pending_email=?))",
      [
        accountEmail.encode(email, "patient_accounts"),
        accountEmail.lookup(email),
        req.patient.id,
        accountEmail.lookup(email),
        email,
      ],
    );
    Object.assign(req.patient, {
      email,
      email_encrypted: accountEmail.encode(email, "patient_accounts"),
      email_verified_at: new Date(),
      pending_email: null,
    });
    await audit(req.patient.id, "email_verified_from_history", req);
    return res.json({ success: true, user: publicAccount(req.patient) });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY")
      return res.status(409).json(emailInUseResponse);
    console.error(
      "Patient email verification failed:",
      require("../utils/safeError").safeError(error),
    );
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถยืนยันอีเมลได้" });
  }
});

router.post("/me/email/resend", otpLimiter, async (req, res) => {
  try {
    const challengeId = Number(
      String(req.body?.challengeToken || "").split(".")[0],
    );
    const [[challenge]] = await db.query(
      "SELECT account_id FROM auth_email_challenges WHERE id=? LIMIT 1",
      [challengeId],
    );
    if (!challenge || Number(challenge.account_id) !== Number(req.patient.id))
      return res.status(400).json({
        success: false,
        message: "คำขอยืนยันไม่ถูกต้องหรือหมดอายุ",
      });
    const result = await resendChallenge(db, {
      challengeToken: req.body.challengeToken,
      accountType: "patient",
      purpose: "email_verification",
    });
    if (result.error)
      return res.status(429).json({
        success: false,
        message: result.error,
        resendAfter: result.resendAfter,
      });
    return res.json(result);
  } catch (error) {
    console.error("Patient email resend failed:", error.code || error.name);
    return res
      .status(503)
      .json({ success: false, message: "ไม่สามารถส่งรหัสใหม่ได้" });
  }
});

// A school student's own physical health from the school roster: health
// profile and every physical check, newest first. Only for members whose
// type is school student. Staff notes and the emergency contact stay with
// the school; everything else is the student's own measurements.
router.get("/me/school-health", async (req, res) => {
  const memberTypes = require("../services/memberType");
  const { physicalRecord, bloodType } = require("../utils/schoolPrivateData");
  const { readField } = require("../utils/privateField");
  try {
    const type = (await memberTypes.memberTypesFor(db, [req.patient.id])).get(
      req.patient.id,
    );
    if (type?.type !== "school_student")
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบข้อมูลสุขภาพจากโรงเรียน" });
    const [students] = await db.query(
      `SELECT s.id, s.status, s.archived_at, sc.organization_id
         FROM school_students s
         JOIN schools sc ON sc.id = s.school_id
         LEFT JOIN persons p ON p.id = s.person_id
        WHERE s.patient_account_id = ? OR p.patient_account_id = ?
        ORDER BY (s.status = 'active' AND s.archived_at IS NULL) DESC, s.updated_at DESC`,
      [req.patient.id, req.patient.id],
    );
    if (!students.length)
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบข้อมูลสุขภาพจากโรงเรียน" });
    const orgOf = new Map(students.map((s) => [s.id, s.organization_id]));
    const [rows] = await db.query(
      "SELECT * FROM school_student_physical_records WHERE student_id IN (?) ORDER BY measured_at DESC, id DESC",
      [students.map((s) => s.id)],
    );
    const records = rows.map((row) => {
      const record = physicalRecord(row, orgOf.get(row.student_id));
      return {
        id: record.id,
        measured_at: record.measured_at,
        weight_kg: record.weight_kg ?? null,
        height_cm: record.height_cm ?? null,
        bmi: record.bmi ?? null,
        systolic: record.systolic ?? null,
        diastolic: record.diastolic ?? null,
        pulse: record.pulse ?? null,
        vision_left: record.vision_left || null,
        vision_right: record.vision_right || null,
        hearing_left: record.hearing_left || "not_tested",
        hearing_right: record.hearing_right || "not_tested",
        fitness: record.fitness || null,
      };
    });
    const current = students[0];
    const org = current.organization_id;
    const [profiles] = await db.query(
      "SELECT * FROM school_student_health_profiles WHERE student_id = ?",
      [current.id],
    );
    const profile = profiles[0];
    const field = (name) =>
      profile
        ? readField(profile[name], "school_student_health_profiles", name, org)
        : null;
    await require("../utils/pdpaAudit").requiredPatientAudit(
      req,
      "school_health.read",
      req.patient.id,
      { records: records.length },
    );
    return res.json({
      success: true,
      profile: {
        blood_type: profile ? bloodType(profile, org) : null,
        chronic_conditions: field("chronic_conditions_encrypted"),
        allergies: field("allergies_encrypted"),
        medications: field("medications_encrypted"),
      },
      records,
    });
  } catch (error) {
    console.error(
      "Member school health failed:",
      require("../utils/safeError").safeError(error),
    );
    return res
      .status(error.status || 500)
      .json({ success: false, message: "ไม่สามารถโหลดข้อมูลสุขภาพได้" });
  }
});

// What the student's school asks them to do: screening rounds for their
// group (`rounds`) and their own follow-up tasks (`tasks`). Only the form,
// round name and due date are returned; the reason for a follow-up stays
// with school staff.
router.get("/me/assessment-tasks", async (req, res) => {
  try {
    const school = require("../services/schoolRescreen");
    const [tasks, rounds] = await Promise.all([
      school.pendingTasksForPatient(db, req.patient.id),
      school.pendingRoundsForPatient(db, req.patient.id),
    ]);
    return res.json({ success: true, tasks, rounds });
  } catch (error) {
    console.error(
      "Member assessment tasks failed:",
      require("../utils/safeError").safeError(error),
    );
    return res
      .status(500)
      .json({ success: false, message: "ไม่สามารถโหลดแบบประเมินที่ต้องทำได้" });
  }
});

// The member chooses their own type when no school roster or case says it.
// It counts like a new answer (see services/memberType.js). School student is
// never self-declared: it comes from the school roster.
router.put("/me/member-type", async (req, res) => {
  const memberTypes = require("../services/memberType");
  const type = String(req.body?.type || "");
  const faculty = String(req.body?.faculty || "").trim();
  if (!["university_student", "general"].includes(type))
    return res
      .status(422)
      .json({ success: false, message: "กรุณาเลือกประเภทผู้มารับบริการ" });
  if (type === "university_student" && !faculty)
    return res
      .status(422)
      .json({ success: false, message: "กรุณาเลือกสำนักวิชา" });
  try {
    await memberTypes.declareMemberType(db, req.patient.id, type, faculty);
    const memberType = (
      await memberTypes.memberTypesFor(db, [req.patient.id])
    ).get(req.patient.id);
    const school =
      memberType?.type === "school_student"
        ? await memberTypes.memberSchoolRecord(db, req.patient.id)
        : null;
    return res.json({ success: true, member_type: { ...memberType, school } });
  } catch (error) {
    console.error(
      "Member type update failed:",
      require("../utils/safeError").safeError(error),
    );
    return res
      .status(error.status || 500)
      .json({ success: false, message: "บันทึกประเภทไม่สำเร็จ กรุณาลองใหม่" });
  }
});

router.get("/history", async (req, res) => {
  try {
    const [responses] = await db.query(
      "SELECT fr.id, fr.organization_id, fr.master_case_id, fr.form_id, fr.submitted_at, fr.status, fr.risk_level, f.title AS form_title, f.clinic_type, fr.summary_data FROM form_responses fr LEFT JOIN forms f ON fr.form_id = f.id WHERE fr.organization_id IS NOT NULL AND (fr.patient_account_id = ? OR (fr.patient_account_id IS NULL AND ? IS NOT NULL AND fr.identity_hash = ?)) ORDER BY fr.submitted_at DESC",
      [req.patient.id, req.patient.identity_hash, req.patient.identity_hash],
    );
    const ids = [
      ...new Set(responses.map((row) => row.master_case_id).filter(Boolean)),
    ];
    let masterCases = [];
    if (ids.length) {
      [masterCases] = await db.query(
        "SELECT mc.id,mc.organization_id,mc.identityValue,mc.clinicType,mc.status,mc.overall_risk,mc.currentStage,mc.createdAt,mc.updatedAt FROM mastercases mc WHERE mc.id IN (?) AND EXISTS (SELECT 1 FROM form_responses fr WHERE fr.master_case_id=mc.id AND fr.organization_id=mc.organization_id AND (fr.patient_account_id=? OR (fr.patient_account_id IS NULL AND ? IS NOT NULL AND fr.identity_hash=?))) ORDER BY mc.createdAt DESC",
        [
          ids,
          req.patient.id,
          req.patient.identity_hash,
          req.patient.identity_hash,
        ],
      );
    } else if (req.patient.identity_hash) {
      [masterCases] = await db.query(
        "SELECT id,organization_id, identityValue, clinicType, status, overall_risk, currentStage, createdAt, updatedAt FROM mastercases WHERE identity_hash = ? AND organization_id IS NOT NULL ORDER BY createdAt DESC",
        [req.patient.identity_hash],
      );
    }
    masterCases = masterCases.map((row) =>
      require("../utils/decryptCaseData").decryptCaseResponse(row, safeDecrypt),
    );
    const sanitized = responses.map((row) =>
      require("../utils/decryptCaseData").decryptCaseResponse(row, safeDecrypt),
    );
    const identityValue = safeDecrypt(masterCases[0]?.identityValue);
    const identityMasked =
      identityValue && /^\d{13}$/.test(String(identityValue))
        ? `${String(identityValue).slice(0, 4)}*****${String(identityValue).slice(-4)}`
        : "บัญชีผู้รับบริการ";
    const profile = publicAccount(req.patient);
    const memberTypes = require("../services/memberType");
    const memberType = (
      await memberTypes.memberTypesFor(db, [req.patient.id])
    ).get(req.patient.id) || {
      type: "unknown",
      label: memberTypes.MEMBER_TYPE_LABELS.unknown,
      source: "none",
      faculty: null,
    };
    const school =
      memberType.type === "school_student"
        ? await memberTypes.memberSchoolRecord(db, req.patient.id)
        : null;
    const historicalProfile = getHistoricalProfile(sanitized);
    const accountDisplayName = [profile.first_name, profile.last_name]
      .map(cleanProfileValue)
      .filter(Boolean)
      .join(" ");
    profile.display_name =
      accountDisplayName || historicalProfile.displayName || profile.username;
    profile.phone =
      cleanProfilePhone(safeDecrypt(req.patient.phone_encrypted)) ||
      historicalProfile.phone;
    await require("../utils/pdpaAudit").requiredPatientAudit(
      req,
      "history.read",
      req.patient.id,
      { count: responses.length },
    );
    return res.json({
      success: true,
      profile,
      identity_masked: identityMasked,
      member_type: { ...memberType, school },
      masterCases: masterCases.map(
        ({ identityValue: _identityValue, ...row }) => ({
          ...row,
          overall_risk: safeDecrypt(row.overall_risk),
        }),
      ),
      responses: sanitized,
    });
  } catch (error) {
    console.error(
      "Patient history failed:",
      require("../utils/safeError").safeError(error),
    );
    return res
      .status(error.status || 500)
      .json({ success: false, message: "ไม่สามารถโหลดประวัติได้" });
  }
});

router.get("/history/responses/:id/answers", async (req, res) => {
  const response = await ownResponse(req, req.params.id);
  if (!response)
    return res
      .status(404)
      .json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  try {
    const [rows] = await db.query(
      "SELECT question_id, question_title, answer_value FROM form_answers WHERE response_id = ? ORDER BY id ASC",
      [response.id],
    );
    await require("../utils/pdpaAudit").requiredPatientAudit(
      req,
      "answers.read",
      response.id,
      { count: rows.length },
    );
    res.json(
      rows.map((row) => ({
        ...row,
        answer_value: normalizeStoredAnswer(
          row.answer_value,
          row.question_title,
          safeDecrypt,
          response.organization_id,
        ),
      })),
    );
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ success: false, message: "ไม่สามารถโหลดคำตอบได้" });
  }
});

router.get("/history/responses/:id/logs", async (req, res) => {
  const response = await ownResponse(req, req.params.id);
  if (!response)
    return res
      .status(404)
      .json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  try {
    const [rows] = await db.query(
      "SELECT id,type,detail,created_at FROM case_logs WHERE response_id = ? AND patient_visible=1 AND (master_case_id IS NULL OR master_case_id=?) ORDER BY created_at DESC",
      [response.id, response.master_case_id],
    );
    await require("../utils/pdpaAudit").requiredPatientAudit(
      req,
      "patient_notes.read",
      response.id,
      { count: rows.length },
    );
    res.json(
      rows.map((row) => ({
        ...row,
        detail: require("../utils/privateField").readField(
          row.detail,
          "case_logs",
          "detail",
          response.organization_id,
        ),
      })),
    );
  } catch (error) {
    res
      .status(error.status || 500)
      .json({ success: false, message: "ไม่สามารถโหลดประวัติการติดตามได้" });
  }
});

router.patch("/history/responses/:id", async (req, res) => {
  const response = await ownResponse(req, req.params.id);
  if (!response)
    return res
      .status(404)
      .json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  const { field, value } = req.body || {};
  const allowed = ["display_name", "phone", "weight", "height"];
  if (
    !allowed.includes(field) ||
    typeof value !== "string" ||
    value.trim().length === 0 ||
    value.length > 255
  )
    return res
      .status(400)
      .json({ success: false, message: "ข้อมูลที่แก้ไขไม่ถูกต้อง" });
  try {
    const [rows] = await db.query(
      "SELECT summary_data FROM form_responses WHERE id = ?",
      [response.id],
    );
    // Keep the stored encrypted representation of unrelated fields intact.
    const summary = decryptSummaryData(
      rows[0]?.summary_data,
      safeDecrypt,
      response.organization_id,
    );
    summary[field] = value.trim();
    summary[`${field}_updated_at`] = new Date().toISOString();
    await db.query("UPDATE form_responses SET summary_data = ? WHERE id = ?", [
      JSON.stringify(
        sealJson(
          summary,
          fieldContext(
            "form_responses",
            "summary_data",
            response.organization_id,
          ),
        ),
      ),
      response.id,
    ]);
    await audit(req.patient.id, "history_response_updated", req, { field });
    res.json({ success: true, updated_at: new Date().toISOString() });
  } catch {
    res
      .status(500)
      .json({ success: false, message: "ไม่สามารถบันทึกข้อมูลได้" });
  }
});

router.patch(
  "/history/responses/:responseId/answers/:questionId",
  async (req, res) => {
    const response = await ownResponse(req, req.params.responseId);
    if (!response)
      return res
        .status(404)
        .json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
    const value = req.body?.value;
    if (value === undefined || JSON.stringify(value).length > 20000)
      return res
        .status(400)
        .json({ success: false, message: "คำตอบไม่ถูกต้อง" });
    try {
      const [answerRows] = await db.query(
        "SELECT id, question_title FROM form_answers WHERE response_id = ? AND question_id = ? LIMIT 1",
        [response.id, req.params.questionId],
      );
      if (!answerRows.length)
        return res
          .status(404)
          .json({ success: false, message: "ไม่พบคำถามนี้ในแบบประเมิน" });
      const saved = sealJson(
        value,
        fieldContext("form_answers", "answer_value", response.organization_id),
      );
      await db.query(
        "UPDATE form_answers SET answer_value = ? WHERE id = ? AND response_id = ?",
        [JSON.stringify(saved), answerRows[0].id, response.id],
      );
      await audit(req.patient.id, "history_answer_updated", req, {
        question_id: req.params.questionId,
      });
      res.json({ success: true, updated_at: new Date().toISOString() });
    } catch {
      res
        .status(500)
        .json({ success: false, message: "ไม่สามารถบันทึกคำตอบได้" });
    }
  },
);

module.exports = router;
