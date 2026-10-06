const express = require("express"),
  db = require("../config/db");
const {
  verifyToken,
  verifySuperAdmin,
} = require("../middleware/authMiddleware");
const { verifyPatientToken } = require("../middleware/patientAuthMiddleware");
const { requiredAudit } = require("../utils/pdpaAudit");
const { sealText, readJson, fieldContext } = require("../utils/privateData");
const router = express.Router();
const positive = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0;
const TYPES = [
  "access",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability",
  "withdrawal",
];
const STATES = [
  "submitted",
  "identity_verified",
  "under_review",
  "fulfilled",
  "rejected",
  "withdrawn",
];
const DTO = (row) => ({
  id: row.id,
  organization_id: row.organization_id,
  request_type: row.request_type,
  status: row.status,
  version: row.version,
  created_at: row.created_at,
  updated_at: row.updated_at,
  detail: row.detail_encrypted
    ? readJson(
        row.detail_encrypted,
        fieldContext("pdpa_rights_requests", "detail", row.organization_id),
      )
    : "",
});
router.get(
  "/patient/privacy/organizations",
  verifyPatientToken,
  async (req, res) => {
    const [rows] = await db.query(
      `SELECT DISTINCT o.id,o.name FROM organizations o JOIN form_responses fr ON fr.organization_id=o.id WHERE fr.patient_account_id=? OR (fr.patient_account_id IS NULL AND ? IS NOT NULL AND fr.identity_hash=?)
 UNION SELECT DISTINCT o.id,o.name FROM organizations o JOIN schools s ON s.organization_id=o.id JOIN school_students st ON st.school_id=s.id WHERE st.patient_account_id=?`,
      [
        req.patient.id,
        req.patient.identity_hash,
        req.patient.identity_hash,
        req.patient.id,
      ],
    );
    res.json(rows);
  },
);
router.get(
  "/patient/privacy/requests",
  verifyPatientToken,
  async (req, res) => {
    const [rows] = await db.query(
      "SELECT * FROM pdpa_rights_requests WHERE patient_account_id=? ORDER BY id DESC LIMIT 200",
      [req.patient.id],
    );
    res.json(rows.map(DTO));
  },
);
router.post(
  "/patient/privacy/requests",
  verifyPatientToken,
  async (req, res) => {
    const body = req.body || {};
    if (
      !positive(body.organization_id) ||
      !TYPES.includes(body.request_type) ||
      typeof body.detail !== "string" ||
      body.detail.length > 10000
    )
      return res.status(422).json({ code: "INVALID_RIGHTS_REQUEST" });
    const [orgs] = await db.query(
      `SELECT organization_id FROM form_responses WHERE organization_id=? AND (patient_account_id=? OR (patient_account_id IS NULL AND ? IS NOT NULL AND identity_hash=?))
 UNION SELECT s.organization_id FROM school_students st JOIN schools s ON s.id=st.school_id WHERE s.organization_id=? AND st.patient_account_id=? LIMIT 1`,
      [
        body.organization_id,
        req.patient.id,
        req.patient.identity_hash,
        req.patient.identity_hash,
        body.organization_id,
        req.patient.id,
      ],
    );
    if (!orgs.length)
      return res.status(403).json({ code: "ORGANIZATION_NOT_RELATED" });
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      const [created] = await c.query(
        "INSERT INTO pdpa_rights_requests (patient_account_id,organization_id,request_type,detail_encrypted) VALUES (?,?,?,?)",
        [
          req.patient.id,
          body.organization_id,
          body.request_type,
          sealText(
            body.detail,
            fieldContext(
              "pdpa_rights_requests",
              "detail",
              body.organization_id,
            ),
          ),
        ],
      );
      await c.query(
        'INSERT INTO pdpa_rights_request_events (request_id,actor_type,actor_id,status) VALUES (?,"patient",?,"submitted")',
        [created.insertId, req.patient.id],
      );
      await c.commit();
      res.status(201).json({ id: created.insertId, status: "submitted" });
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  },
);
router.use("/pdpa", verifyToken, verifySuperAdmin);
router.get("/pdpa/telemetry", (_req, res) =>
  res.json(require("../utils/privacyTelemetry").snapshot()),
);
router.get("/pdpa/migrations", async (req, res) => {
  const [progress] = await db.query(
    "SELECT migration_key,last_id,completed_count,failed_count,updated_at FROM pdpa_migration_progress",
  );
  const [issues] = await db.query(
    "SELECT migration_key,reason_code,COUNT(*) AS count FROM pdpa_migration_issues GROUP BY migration_key,reason_code",
  );
  res.json({ progress, issues });
});
router.use("/pdpa/organizations/:id", async (req, res, next) => {
  if (!positive(req.params.id))
    return res.status(422).json({ code: "INVALID_ORGANIZATION" });
  const [rows] = await db.query(
    "SELECT id FROM organizations WHERE id=? AND org_level='unit' AND status='active'",
    [req.params.id],
  );
  if (!rows.length)
    return res.status(404).json({ code: "ORGANIZATION_NOT_FOUND" });
  req.organizationContext = Number(req.params.id);
  next();
});
router.get("/pdpa/requests", async (req, res) => {
  if (!positive(req.query.organization_id))
    return res.status(422).json({ code: "ORGANIZATION_REQUIRED" });
  req.organizationContext = Number(req.query.organization_id);
  const [rows] = await db.query(
    "SELECT * FROM pdpa_rights_requests WHERE organization_id=? ORDER BY id DESC LIMIT 200",
    [req.query.organization_id],
  );
  await requiredAudit(
    req,
    "pdpa.request.read",
    "organization",
    req.query.organization_id,
    { count: rows.length },
  );
  res.json(rows.map(DTO));
});
router.patch("/pdpa/requests/:id", async (req, res) => {
  const b = req.body || {};
  if (
    !STATES.includes(b.status) ||
    !positive(b.version) ||
    !positive(b.organization_id) ||
    !/^([A-Z0-9_]{1,80})$/.test(b.reason_code || "REVIEW")
  )
    return res.status(422).json({ code: "INVALID_REQUEST_UPDATE" });
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [rows] = await c.query(
      "SELECT * FROM pdpa_rights_requests WHERE id=? AND organization_id=? FOR UPDATE",
      [req.params.id, b.organization_id],
    );
    const row = rows[0];
    req.organizationContext = Number(b.organization_id);
    if (!row || Number(row.version) !== Number(b.version)) {
      await c.rollback();
      return res.status(409).json({ code: "REQUEST_VERSION_CHANGED" });
    }
    const transitions = {
      submitted: ["identity_verified", "withdrawn"],
      identity_verified: ["under_review", "withdrawn"],
      under_review: ["fulfilled", "rejected", "withdrawn"],
      fulfilled: [],
      rejected: [],
      withdrawn: [],
    };
    if (
      !transitions[row.status]?.includes(b.status) ||
      (b.status === "identity_verified" && b.identity_verified !== true)
    ) {
      await c.rollback();
      return res
        .status(422)
        .json({ code: "IDENTITY_REVIEW_OR_VALID_TRANSITION_REQUIRED" });
    }
    await c.query(
      "UPDATE pdpa_rights_requests SET status=?,version=version+1,verified_by=IF(?, ?,verified_by),verified_at=IF(?,NOW(),verified_at) WHERE id=?",
      [
        b.status,
        b.status === "identity_verified",
        req.user.id,
        b.status === "identity_verified",
        row.id,
      ],
    );
    await c.query(
      'INSERT INTO pdpa_rights_request_events (request_id,actor_type,actor_id,status,reason_code) VALUES (?,"staff",?,?,?)',
      [row.id, req.user.id, b.status, b.reason_code || "REVIEW"],
    );
    await requiredAudit(
      req,
      "pdpa.request.update",
      "rights_request",
      row.id,
      { status: b.status },
      c,
    );
    await c.commit();
    res.json({ success: true, version: Number(row.version) + 1 });
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    c.release();
  }
});
router.get("/pdpa/organizations/:id/purposes", async (req, res) => {
  const [rows] = await db.query(
    "SELECT form_id,purpose,legal_basis,notice_version,notice_text,approved_by,approved_at FROM pdpa_processing_purposes WHERE organization_id=?",
    [req.params.id],
  );
  res.json(rows);
});
router.put("/pdpa/organizations/:id/purposes/:formId", async (req, res) => {
  const b = req.body || {};
  if (
    !/^[A-Za-z0-9_.-]{1,80}$/.test(b.purpose || "") ||
    ![
      "consent",
      "healthcare",
      "legal_obligation",
      "public_task",
      "vital_interests",
      "contract",
      "legitimate_interests",
    ].includes(b.legal_basis) ||
    !/^[A-Za-z0-9_.-]{1,80}$/.test(b.notice_version || "") ||
    typeof b.notice_text !== "string" ||
    !b.notice_text.trim() ||
    b.notice_text.length > 20000 ||
    b.approved !== true
  )
    return res
      .status(422)
      .json({ code: "CONFIRMED_PURPOSE_AND_NOTICE_REQUIRED" });
  const [forms] = await db.query(
    "SELECT id FROM forms WHERE id=? AND organization_id=?",
    [req.params.formId, req.params.id],
  );
  if (!forms.length) return res.status(404).json({ code: "FORM_NOT_FOUND" });
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    const [locked] = await c.query(
      "SELECT id FROM forms WHERE id=? AND organization_id=? FOR UPDATE",
      [req.params.formId, req.params.id],
    );
    if (!locked.length) {
      await c.rollback();
      return res.status(404).json({ code: "FORM_NOT_FOUND" });
    }
    await require("../services/privacyNoticeService").approveNotice(c, {
      ...b,
      organizationId: req.params.id,
      formId: req.params.formId,
      actorId: req.user.id,
    });
    await requiredAudit(
      req,
      "pdpa.purpose.update",
      "form",
      req.params.formId,
      { version: b.notice_version },
      c,
    );
    await c.commit();
    res.json({ success: true });
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
});
router.get("/forms/:id/privacy-notice", async (req, res) => {
  const [rows] = await db.query(
    `SELECT p.purpose,p.legal_basis,p.notice_version,p.notice_text FROM pdpa_processing_purposes p JOIN forms f ON f.id=p.form_id AND f.organization_id=p.organization_id WHERE p.form_id=? AND p.approved_at IS NOT NULL AND f.status='published'`,
    [req.params.id],
  );
  res.json(rows[0] || null);
});
router.get("/pdpa/organizations/:id/retention", async (req, res) => {
  const [rows] = await db.query(
    "SELECT * FROM pdpa_retention_policies WHERE organization_id=?",
    [req.params.id],
  );
  res.json(rows);
});
router.put("/pdpa/organizations/:id/retention", async (req, res) => {
  const b = req.body || {};
  if (
    !["form_responses", "case_logs", "auth_sessions", "audit"].includes(
      b.data_type,
    ) ||
    !positive(b.retention_days) ||
    b.retention_days > 36500 ||
    b.approved !== true
  )
    return res.status(422).json({ code: "APPROVED_RETENTION_REQUIRED" });
  const c = await db.getConnection();
  try {
    await c.beginTransaction();
    await c.query(
      "INSERT INTO pdpa_retention_policies (organization_id,data_type,retention_days,enabled,approved_by,approved_at) VALUES (?,?,?,0,?,NOW()) ON DUPLICATE KEY UPDATE retention_days=VALUES(retention_days),enabled=0,version=version+1,approved_by=VALUES(approved_by),approved_at=NOW()",
      [req.params.id, b.data_type, b.retention_days, req.user.id],
    );
    await c.query(
      "INSERT INTO pdpa_retention_policy_versions (organization_id,data_type,version,retention_days,approved_by,approved_at) SELECT organization_id,data_type,version,retention_days,approved_by,approved_at FROM pdpa_retention_policies WHERE organization_id=? AND data_type=?",
      [req.params.id, b.data_type],
    );
    await requiredAudit(
      req,
      "pdpa.retention.update",
      "organization",
      req.params.id,
      {},
      c,
    );
    await c.commit();
    res.json({ success: true, automatic_deletion: false });
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
});
router.put(
  "/pdpa/organizations/:id/legal-holds/:responseId",
  async (req, res) => {
    const [rows] = await db.query(
      "SELECT id FROM form_responses WHERE id=? AND organization_id=?",
      [req.params.responseId, req.params.id],
    );
    if (!rows.length) return res.status(404).json({ code: "CASE_NOT_FOUND" });
    if (typeof req.body?.held !== "boolean")
      return res.status(422).json({ code: "HOLD_VALUE_REQUIRED" });
    await requiredAudit(
      req,
      "pdpa.legal_hold.update",
      "response",
      req.params.responseId,
    );
    await db.query(
      'INSERT INTO pdpa_legal_holds (organization_id,target_type,target_id,created_by,released_at) VALUES (?,"form_responses",?,?,IF(?,NULL,NOW())) ON DUPLICATE KEY UPDATE released_at=IF(?,NULL,NOW())',
      [
        req.params.id,
        req.params.responseId,
        req.user.id,
        req.body.held,
        req.body.held,
      ],
    );
    res.json({ success: true });
  },
);
router.post("/pdpa/organizations/:id/retention/dry-run", async (req, res) => {
  const [policies] = await db.query(
    'SELECT retention_days,version FROM pdpa_retention_policies WHERE organization_id=? AND data_type="form_responses" AND approved_at IS NOT NULL',
    [req.params.id],
  );
  if (!policies.length)
    return res.status(409).json({ code: "APPROVED_POLICY_REQUIRED" });
  const [counts] = await db.query(
    `SELECT COUNT(*) AS candidates FROM form_responses fr WHERE fr.organization_id=? AND fr.submitted_at<DATE_SUB(NOW(),INTERVAL ? DAY) AND NOT EXISTS (SELECT 1 FROM pdpa_legal_holds h WHERE h.organization_id=fr.organization_id AND h.target_type='form_responses' AND h.target_id=fr.id AND h.released_at IS NULL)`,
    [req.params.id, policies[0].retention_days],
  );
  await requiredAudit(
    req,
    "pdpa.retention.dry_run",
    "organization",
    req.params.id,
    { count: counts[0].candidates, version: policies[0].version },
  );
  res.json({
    dry_run: true,
    automatic_deletion: false,
    candidates: counts[0].candidates,
    policy_version: policies[0].version,
  });
});
module.exports = router;
