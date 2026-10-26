// Approval of a school's referrals to hospital units, before they are sent.
// Mounted at /api/referral-approvals. A request is created by
// POST /api/case-referrals when a school refers to a hospital; here staff with
// referral_approvals rights approve (the referral is then created and sent),
// decline, or cancel it. The requester sees and may cancel their own requests.
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { audit } = require("../authorization/authorization");
const { requiredAudit } = require("../utils/pdpaAudit");
const { writeField, readField } = require("../utils/privateField");
const {
  loadSchoolAccess,
  canViewStudentHealth,
} = require("../utils/schoolAccess");
const { validId } = require("../utils/caseReferrals");
const referrals = require("../services/caseReferralCreate");
const router = express.Router();

const fail = (res, status, message) => res.status(status).json({ message });
const may = (req, key) =>
  Boolean(
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has(key) ||
    req.authorization?.permissions?.has("referral_approvals.manage"),
  );

router.use(verifyToken, async (req, res, next) => {
  if (!validId(req.organizationContext))
    return fail(res, 422, "กรุณาเลือกหน่วยงานหนึ่งแห่ง");
  req.schoolAccess = req.schoolAccess || (await loadSchoolAccess(db, req));
  if (req.schoolAccess.isGuardian)
    return fail(res, 403, "คุณไม่มีสิทธิ์ดูคำขอส่งต่อ");
  next();
});

const SELECT = `SELECT q.*,dest.name AS destination_name,f.title AS form_title,
  ru.username AS requested_by_name,du.username AS decided_by_name,
  ss.id AS student_id,ss.school_id,ss.classroom_id,ss.is_boarder,ss.student_code,ss.prefix,
  ss.first_name_encrypted,ss.last_name_encrypted,ss.archived_at
  FROM case_referral_requests q
  JOIN organizations dest ON dest.id=q.destination_organization_id
  JOIN form_responses fr ON fr.id=q.source_response_id
  LEFT JOIN forms f ON f.id=fr.form_id
  LEFT JOIN users ru ON ru.id=q.requested_by
  LEFT JOIN users du ON du.id=q.decided_by
  LEFT JOIN school_students ss ON (ss.person_id=fr.person_id OR (fr.person_id IS NULL AND ss.patient_account_id=fr.patient_account_id))
    AND ss.school_id IN (SELECT id FROM schools WHERE organization_id=q.source_organization_id)`;

// Only requests about students whose mental health the caller may see.
const inScope = (req, row) =>
  !row.student_id ||
  canViewStudentHealth(req.schoolAccess, {
    id: row.student_id,
    school_id: row.school_id,
    classroom_id: row.classroom_id,
    is_boarder: row.is_boarder,
    archived_at: row.archived_at,
  });

const view = (req, row) => {
  const org = req.organizationContext;
  const name = (value, field) =>
    readField(value, "school_students", field, org) || "";
  return {
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    decided_at: row.decided_at,
    source_response_id: row.source_response_id,
    destination_organization_id: row.destination_organization_id,
    destination_name: row.destination_name,
    form_title: row.form_title,
    reason: readField(
      row.reason_encrypted,
      "case_referral_requests",
      "reason_encrypted",
      org,
    ),
    decision_note: row.decision_note_encrypted
      ? readField(
          row.decision_note_encrypted,
          "case_referral_requests",
          "decision_note_encrypted",
          org,
        )
      : "",
    requested_by: row.requested_by,
    requested_by_name: row.requested_by_name,
    decided_by_name: row.decided_by_name,
    referral_id: row.referral_id,
    student: row.student_id
      ? {
          id: row.student_id,
          student_code: row.student_code,
          name: [
            row.prefix,
            name(row.first_name_encrypted, "first_name_encrypted"),
            name(row.last_name_encrypted, "last_name_encrypted"),
          ]
            .filter(Boolean)
            .join(" "),
        }
      : null,
    can_cancel:
      row.status === "pending" &&
      (Number(row.requested_by) === Number(req.user.id) ||
        may(req, "referral_approvals.delete")),
    can_decide:
      row.status === "pending" && may(req, "referral_approvals.update"),
  };
};

// GET /?source_response_id= lists the requests for one assessment (the
// student file's referral panel, cases.view). Without it, the approval queue
// (referral_approvals.view), optionally ?status=pending.
router.get("/", async (req, res) => {
  const responseId = validId(req.query.source_response_id)
    ? Number(req.query.source_response_id)
    : null;
  if (
    !(responseId ? may(req, "cases.view") : may(req, "referral_approvals.view"))
  )
    return fail(res, 403, "คุณไม่มีสิทธิ์ดูคำขอส่งต่อ");
  const status = ["pending", "approved", "declined", "cancelled"].includes(
    req.query.status,
  )
    ? req.query.status
    : null;
  const [rows] = await db.query(
    `${SELECT} WHERE q.source_organization_id=?${responseId ? " AND q.source_response_id=?" : ""}${status ? " AND q.status=?" : ""} ORDER BY q.status='pending' DESC,q.created_at DESC,q.id DESC`,
    [
      req.organizationContext,
      ...(responseId ? [responseId] : []),
      ...(status ? [status] : []),
    ],
  );
  const visible = rows.filter((r) => inScope(req, r));
  res.set("Cache-Control", "no-store");
  res.json({
    data: visible.map((r) => view(req, r)),
    // The queue says how many requests it holds back (students whose mental
    // health the caller may not see) and which rights would reveal them;
    // nothing about who they are.
    ...(!responseId && {
      hidden: {
        count: rows.length - visible.length,
        missing_permissions: [
          ...(req.schoolAccess.clinicalAllowed === false
            ? ["clinical.view"]
            : []),
          ...(req.schoolAccess.healthView === false &&
          !req.schoolAccess.health?.view
            ? ["student_health.view"]
            : []),
        ],
      },
    }),
  });
});

async function loadRequest(connection, req, res) {
  const [[row]] = await connection.query(
    `${SELECT} WHERE q.id=? AND q.source_organization_id=? FOR UPDATE`,
    [req.params.id, req.organizationContext],
  );
  if (!row || !inScope(req, row)) {
    fail(res, 404, "ไม่พบคำขอส่งต่อ");
    return null;
  }
  if (row.status !== "pending") {
    fail(res, 409, "คำขอนี้ได้รับการพิจารณาแล้ว");
    return null;
  }
  return row;
}

async function decide(req, res, run) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const row = await loadRequest(connection, req, res);
    if (!row) {
      await connection.rollback();
      return;
    }
    const result = await run(connection, row);
    if (result?.error) {
      await connection.rollback();
      return res.status(result.error.status).json(result.error.body);
    }
    await connection.commit();
    res.json({ success: true, ...(result || {}) });
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.code === "ER_DUP_ENTRY")
      return fail(
        res,
        409,
        "เคสนี้มีรายการส่งต่อไปหน่วยงานนี้ที่ยังไม่เสร็จสิ้นแล้ว",
      );
    throw error;
  } finally {
    connection.release();
  }
}

// Approving sends the referral exactly as the requester asked, sharing the
// name and form title only if the requester had those rights.
router.post("/:id/approve", async (req, res) => {
  if (!may(req, "referral_approvals.update"))
    return fail(res, 403, "คุณไม่มีสิทธิ์อนุมัติการส่งต่อ");
  await decide(req, res, async (connection, row) => {
    const { source, error } = await referrals.referralSource(
      connection,
      req.organizationContext,
      {
        source_response_id: row.source_response_id,
        destination_organization_id: row.destination_organization_id,
      },
    );
    if (error) return { error };
    const { writeUpdate } = require("./caseReferralRoutes");
    const referralId = await referrals.insertReferral(
      connection,
      req,
      {
        source,
        destinationId: row.destination_organization_id,
        reason: readField(
          row.reason_encrypted,
          "case_referral_requests",
          "reason_encrypted",
          req.organizationContext,
        ),
        shareName: Boolean(row.share_name),
        shareTitle: Boolean(row.share_form),
        createdBy: row.requested_by,
      },
      writeUpdate,
    );
    await connection.query(
      "UPDATE case_referral_requests SET status='approved',decided_by=?,decided_at=NOW(),referral_id=? WHERE id=?",
      [req.user.id, referralId, row.id],
    );
    await requiredAudit(
      req,
      "referral_request.approve",
      "referral_request",
      row.id,
      { status: "approved" },
      connection,
    );
    await audit(req, {
      action: "referrals.create",
      targetType: "case_referral",
      targetId: referralId,
    });
    return { referral_id: referralId };
  });
});

router.post("/:id/decline", async (req, res) => {
  if (!may(req, "referral_approvals.update"))
    return fail(res, 403, "คุณไม่มีสิทธิ์พิจารณาการส่งต่อ");
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  if (!note || note.length > 1000)
    return fail(
      res,
      422,
      "กรุณาระบุเหตุผลที่ไม่อนุมัติ ไม่เกิน 1,000 ตัวอักษร",
    );
  await decide(req, res, async (connection, row) => {
    await connection.query(
      "UPDATE case_referral_requests SET status='declined',decided_by=?,decided_at=NOW(),decision_note_encrypted=? WHERE id=?",
      [
        req.user.id,
        writeField(
          note,
          "case_referral_requests",
          "decision_note_encrypted",
          req.organizationContext,
        ),
        row.id,
      ],
    );
    await requiredAudit(
      req,
      "referral_request.decline",
      "referral_request",
      row.id,
      { status: "declined" },
      connection,
    );
  });
});

router.post("/:id/cancel", async (req, res) => {
  await decide(req, res, async (connection, row) => {
    if (
      Number(row.requested_by) !== Number(req.user.id) &&
      !may(req, "referral_approvals.delete")
    )
      return {
        error: {
          status: 403,
          body: { message: "ยกเลิกได้เฉพาะคำขอของตนเอง" },
        },
      };
    await connection.query(
      "UPDATE case_referral_requests SET status='cancelled',decided_by=?,decided_at=NOW() WHERE id=?",
      [req.user.id, row.id],
    );
    await requiredAudit(
      req,
      "referral_request.cancel",
      "referral_request",
      row.id,
      { status: "cancelled" },
      connection,
    );
  });
});

module.exports = router;
