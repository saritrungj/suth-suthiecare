const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireAction,
  organizationWhere,
} = require("../authorization/authorization");
const { decryptCaseResponse } = require("../utils/decryptCaseData");
const { normalizeStoredAnswer } = require("../utils/storedAnswer");
const { decrypt } = require("../utils/encryption");
const { serialize } = require("../utils/privateDto");
const { requiredAudit } = require("../utils/pdpaAudit");
const router = express.Router();
router.post(
  "/cases/:id/export-data",
  verifyToken,
  requireAction("cases.view"),
  requireAction("cases.export"),
  async (req, res) => {
    const scope = organizationWhere("fr.organization_id", req);
    const [rows] = await db.query(
      `SELECT fr.*,f.title AS form_title,f.clinic_type FROM form_responses fr LEFT JOIN forms f ON f.id=fr.form_id WHERE fr.id=?${scope.sql} AND (fr.master_case_id IS NULL OR EXISTS (SELECT 1 FROM mastercases mc WHERE mc.id=fr.master_case_id AND mc.organization_id=fr.organization_id))`,
      [req.params.id, ...scope.params],
    );
    if (!rows[0] || !rows[0].organization_id)
      return res.status(404).json({ code: "CASE_NOT_FOUND" });
    const pii =
        req.authorization.isSystemAdmin ||
        req.authorization.permissions.has("pii.view"),
      clinical =
        req.authorization.isSystemAdmin ||
        req.authorization.permissions.has("clinical.view");
    if (!pii) return res.status(403).json({ code: "PII_PERMISSION_REQUIRED" });
    const data = decryptCaseResponse(rows[0], decrypt);
    const [answers] = clinical
      ? await db.query(
          "SELECT question_id,question_title,answer_value FROM form_answers WHERE response_id=? ORDER BY id",
          [data.id],
        )
      : [[]];
    const [logs] = clinical
      ? await db.query(
          "SELECT id,type,detail,created_at FROM case_logs WHERE response_id=? AND (master_case_id IS NULL OR master_case_id=?) ORDER BY created_at DESC",
          [data.id, data.master_case_id],
        )
      : [[]];
    await requiredAudit(req, "cases.export", "response", data.id, {
      count: 1,
      format: ["pdf", "copy", "json"].includes(req.body?.format)
        ? req.body.format
        : "json",
    });
    res.json({
      case: serialize(data, { pii, clinical }),
      answers: answers.map((row) => ({
        ...row,
        answer_value: normalizeStoredAnswer(
          row.answer_value,
          row.question_title,
          decrypt,
          data.organization_id,
        ),
      })),
      logs: logs.map((row) => ({
        ...row,
        detail: require("../utils/privateField").readField(
          row.detail,
          "case_logs",
          "detail",
          data.organization_id,
        ),
      })),
    });
  },
);
module.exports = router;
