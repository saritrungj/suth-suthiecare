const express = require("express");
const { db, decrypt, audit, publicAccount } = require("../utils/patientAuth");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");

const router = express.Router();
const safeDecrypt = (value) => {
  if (!value) return value;
  try { return decrypt(value) || value; } catch { return value; }
};
const parseJson = (value) => {
  try { return typeof value === "string" ? JSON.parse(value) : value || {}; } catch { return {}; }
};
const decryptSummary = (summary) => {
  const result = parseJson(summary);
  for (const key of ["display_name", "display_phone", "phone"]) if (result[key]) result[key] = safeDecrypt(result[key]);
  if (result.raw_answers && typeof result.raw_answers === "object") {
    for (const key of Object.keys(result.raw_answers)) {
      if (/ชื่อ|เบอร์|โทร|บัตร/.test(key)) result.raw_answers[key] = safeDecrypt(result.raw_answers[key]);
    }
  }
  return result;
};

const cleanProfileValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" && typeof value !== "number") return "";
  const cleaned = String(value).replace(/<[^>]*>/g, "").trim();
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
    "SELECT id, master_case_id, form_id, identity_hash FROM form_responses WHERE id = ? AND (patient_account_id = ? OR (patient_account_id IS NULL AND ? IS NOT NULL AND identity_hash = ?)) LIMIT 1",
    [responseId, req.patient.id, req.patient.identity_hash, req.patient.identity_hash],
  );
  return rows[0] || null;
}

router.use(verifyPatientToken);

router.get("/me", async (req, res) => {
  res.json({ success: true, user: publicAccount(req.patient) });
});

router.get("/history", async (req, res) => {
  try {
    const [responses] = await db.query(
      "SELECT fr.id, fr.master_case_id, fr.form_id, fr.submitted_at, fr.status, fr.risk_level, f.title AS form_title, f.clinic_type, fr.summary_data FROM form_responses fr LEFT JOIN forms f ON fr.form_id = f.id WHERE fr.patient_account_id = ? OR (fr.patient_account_id IS NULL AND ? IS NOT NULL AND fr.identity_hash = ?) ORDER BY fr.submitted_at DESC",
      [req.patient.id, req.patient.identity_hash, req.patient.identity_hash],
    );
    const ids = [...new Set(responses.map((row) => row.master_case_id).filter(Boolean))];
    let masterCases = [];
    if (ids.length) {
      [masterCases] = await db.query(
        "SELECT id, identityValue, clinicType, status, overall_risk, currentStage, createdAt, updatedAt FROM mastercases WHERE id IN (?) ORDER BY createdAt DESC",
        [ids],
      );
    } else if (req.patient.identity_hash) {
      [masterCases] = await db.query(
        "SELECT id, identityValue, clinicType, status, overall_risk, currentStage, createdAt, updatedAt FROM mastercases WHERE identity_hash = ? ORDER BY createdAt DESC",
        [req.patient.identity_hash],
      );
    }
    const sanitized = responses.map((row) => ({ ...row, summary_data: decryptSummary(row.summary_data) }));
    const identityValue = safeDecrypt(masterCases[0]?.identityValue);
    const identityMasked = identityValue && /^\d{13}$/.test(String(identityValue)) ? `${String(identityValue).slice(0, 4)}*****${String(identityValue).slice(-4)}` : "บัญชีผู้รับบริการ";
    const profile = publicAccount(req.patient);
    const historicalProfile = getHistoricalProfile(sanitized);
    const accountDisplayName = [profile.first_name, profile.last_name]
      .map(cleanProfileValue)
      .filter(Boolean)
      .join(" ");
    profile.display_name = accountDisplayName || historicalProfile.displayName || profile.username;
    profile.phone = cleanProfilePhone(safeDecrypt(req.patient.phone_encrypted)) || historicalProfile.phone;
    return res.json({ success: true, profile, identity_masked: identityMasked, masterCases: masterCases.map(({ identityValue: _identityValue, ...row }) => row), responses: sanitized });
  } catch (error) {
    console.error("Patient history failed:", error.message);
    return res.status(500).json({ success: false, message: "ไม่สามารถโหลดประวัติได้" });
  }
});

router.get("/history/responses/:id/answers", async (req, res) => {
  const response = await ownResponse(req, req.params.id);
  if (!response) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  try {
    const [rows] = await db.query("SELECT question_id, question_title, answer_value FROM form_answers WHERE response_id = ? ORDER BY id ASC", [response.id]);
    res.json(
      rows.map((row) => ({
        ...row,
        answer_value: normalizeStoredAnswer(
          row.answer_value,
          row.question_title,
          safeDecrypt,
        ),
      })),
    );
  } catch (error) { res.status(500).json({ success: false, message: "ไม่สามารถโหลดคำตอบได้" }); }
});

router.get("/history/responses/:id/logs", async (req, res) => {
  const response = await ownResponse(req, req.params.id);
  if (!response) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  try {
    const [rows] = await db.query("SELECT * FROM case_logs WHERE response_id = ? ORDER BY created_at DESC", [response.id]);
    res.json(rows);
  } catch { res.status(500).json({ success: false, message: "ไม่สามารถโหลดประวัติการติดตามได้" }); }
});

router.patch("/history/responses/:id", async (req, res) => {
  const response = await ownResponse(req, req.params.id);
  if (!response) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  const { field, value } = req.body || {};
  const allowed = ["display_name", "phone", "weight", "height"];
  if (!allowed.includes(field) || typeof value !== "string" || value.trim().length === 0 || value.length > 255) return res.status(400).json({ success: false, message: "ข้อมูลที่แก้ไขไม่ถูกต้อง" });
  try {
    const [rows] = await db.query("SELECT summary_data FROM form_responses WHERE id = ?", [response.id]);
    // Keep the stored encrypted representation of unrelated fields intact.
    const summary = parseJson(rows[0]?.summary_data);
    summary[field] = ["display_name", "phone"].includes(field) ? require("../utils/patientAuth").encrypt(value.trim()) : value.trim();
    summary[`${field}_updated_at`] = new Date().toISOString();
    await db.query("UPDATE form_responses SET summary_data = ? WHERE id = ?", [JSON.stringify(summary), response.id]);
    await audit(req.patient.id, "history_response_updated", req, { field });
    res.json({ success: true, updated_at: new Date().toISOString() });
  } catch { res.status(500).json({ success: false, message: "ไม่สามารถบันทึกข้อมูลได้" }); }
});

router.patch("/history/responses/:responseId/answers/:questionId", async (req, res) => {
  const response = await ownResponse(req, req.params.responseId);
  if (!response) return res.status(404).json({ success: false, message: "ไม่พบข้อมูลประวัติ" });
  const value = typeof req.body?.value === "string" ? req.body.value.trim() : "";
  if (!value || value.length > 2000) return res.status(400).json({ success: false, message: "คำตอบไม่ถูกต้อง" });
  try {
    const [answerRows] = await db.query("SELECT id, question_title FROM form_answers WHERE response_id = ? AND question_id = ? LIMIT 1", [response.id, req.params.questionId]);
    if (!answerRows.length) return res.status(404).json({ success: false, message: "ไม่พบคำถามนี้ในแบบประเมิน" });
    const sensitive = /ชื่อ|เบอร์|โทร|บัตร/.test(answerRows[0].question_title || "");
    const saved = sensitive ? require("../utils/patientAuth").encrypt(value) : value;
    await db.query("UPDATE form_answers SET answer_value = ? WHERE id = ? AND response_id = ?", [JSON.stringify(saved), answerRows[0].id, response.id]);
    await audit(req.patient.id, "history_answer_updated", req, { question_id: req.params.questionId });
    res.json({ success: true, updated_at: new Date().toISOString() });
  } catch { res.status(500).json({ success: false, message: "ไม่สามารถบันทึกคำตอบได้" }); }
});

module.exports = router;
