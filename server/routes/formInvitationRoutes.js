const express = require("express"),
  crypto = require("crypto");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const { requireAction } = require("../authorization/authorization");
const {
  concreteOrganization,
  httpError,
  responseOwner,
} = require("../utils/operationalOwnership");
const {
  hash,
  resolveInvitation,
} = require("../services/formInvitationService");
const { requiredAudit } = require("../utils/pdpaAudit");
const { isFormOpenForSubmission } = require("../utils/formSettings");
const router = express.Router();
function fail(res, error) {
  res.status(error.status || 503).json({
    code: error.status ? error.code : "INVITATIONS_UNAVAILABLE",
    message: "ไม่สามารถใช้ลิงก์เชิญนี้ได้",
  });
}
router.post(
  "/form-invitations",
  verifyToken,
  // Sending an assessment invitation to a patient account (roles page).
  requireAction("patient_members.create"),
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const org = concreteOrganization(req),
        { response_id, form_id } = req.body;
      if (!Number.isSafeInteger(Number(form_id)) || Number(form_id) < 1)
        throw httpError(422, "INVALID_FORM");
      await connection.beginTransaction();
      const owner = await responseOwner(
        connection,
        req,
        response_id,
        undefined,
        true,
      );
      const [cases] = await connection.query(
        "SELECT patient_account_id,status FROM mastercases WHERE id=? AND organization_id=? FOR UPDATE",
        [owner.master_case_id, org],
      );
      const [responses] = await connection.query(
        "SELECT patient_account_id FROM form_responses WHERE id=?",
        [owner.id],
      );
      const patient = responses[0]?.patient_account_id;
      if (
        !patient ||
        Number(patient) !== Number(cases[0]?.patient_account_id) ||
        cases[0].status !== "Open"
      )
        throw httpError(422, "LINKED_PATIENT_ACCOUNT_REQUIRED");
      const [forms] = await connection.query(
        "SELECT id,status,publish_start_date,publish_end_date FROM forms WHERE id=? AND organization_id=?",
        [form_id, org],
      );
      if (!forms[0] || !isFormOpenForSubmission(forms[0]))
        throw httpError(422, "FORM_UNAVAILABLE");
      const token = crypto.randomBytes(32).toString("base64url"),
        ttl = Number(process.env.FORM_INVITATION_TTL_SECONDS || 86400);
      if (!Number.isSafeInteger(ttl) || ttl < 60 || ttl > 604800)
        throw new Error("INVALID_INVITATION_TTL");
      const [result] = await connection.query(
        "INSERT INTO form_invitations (token_hash,form_id,organization_id,response_id,master_case_id,patient_account_id,created_by,expires_at) VALUES (?,?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL ? SECOND))",
        [
          hash(token),
          form_id,
          org,
          owner.id,
          owner.master_case_id,
          patient,
          req.user.id,
          ttl,
        ],
      );
      await requiredAudit(
        req,
        "invitation.create",
        "form_invitation",
        result.insertId,
        {},
        connection,
      );
      await connection.commit();
      const base = process.env.FRONTEND_URL || "http://localhost:3001";
      res.status(201).json({
        id: result.insertId,
        token,
        link: `${base.replace(/\/$/, "")}/assessment/${form_id}?invitation=${token}`,
        expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
      });
    } catch (error) {
      await connection.rollback();
      fail(res, error);
    } finally {
      connection.release();
    }
  },
);
router.post(
  "/form-invitations/resolve",
  verifyPatientToken,
  async (req, res) => {
    try {
      const row = await resolveInvitation(
        db,
        req.body.token,
        req.patient,
        req.body.form_id,
      );
      res.json({
        valid: true,
        form_id: row.form_id,
        expires_at: row.expires_at,
      });
    } catch (error) {
      fail(res, error);
    }
  },
);
router.post(
  "/form-invitations/:id/revoke",
  verifyToken,
  requireAction("patient_members.delete"),
  async (req, res) => {
    const connection = await db.getConnection();
    try {
      const org = concreteOrganization(req);
      await connection.beginTransaction();
      const [result] = await connection.query(
        `UPDATE form_invitations SET revoked_at=NOW() WHERE id=? AND organization_id=? AND consumed_at IS NULL${req.authorization?.isSystemAdmin ? "" : " AND created_by=?"}`,
        [
          req.params.id,
          org,
          ...(req.authorization?.isSystemAdmin ? [] : [req.user.id]),
        ],
      );
      if (!result.affectedRows) throw httpError(404, "INVITATION_NOT_FOUND");
      await requiredAudit(
        req,
        "invitation.revoke",
        "form_invitation",
        req.params.id,
        {},
        connection,
      );
      await connection.commit();
      res.json({ success: true });
    } catch (error) {
      await connection.rollback();
      fail(res, error);
    } finally {
      connection.release();
    }
  },
);
module.exports = router;
