const { requiredAudit } = require("../utils/pdpaAudit");
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const {
  requireAction,
  organizationLevelSql,
  audit,
} = require("../authorization/authorization");
const { encrypt, decrypt } = require("../utils/encryption");
const { writeField, readField } = require("../utils/privateField");
const {
  STATUSES,
  transitionsFor,
  publicReferral,
  publicUpdate,
  validId,
  summaryText,
  allowedFields,
} = require("../utils/caseReferrals");
const router = express.Router();

router.use(verifyToken, requireAction("cases.view"), (req, res, next) => {
  if (!validId(req.organizationContext))
    return res
      .status(422)
      .json({ message: "กรุณาเลือกหน่วยงานหนึ่งแห่งเพื่อใช้งานการส่งต่อ" });
  // Referrals are between units; a school guardian account has no part in
  // them (req.schoolAccess is set by the school privacy boundary).
  if (req.schoolAccess?.isGuardian)
    return res.status(403).json({ message: "คุณไม่มีสิทธิ์ดำเนินการนี้" });
  next();
});
const referralFrom = `FROM case_referrals r JOIN organizations so ON so.id=r.source_organization_id
  JOIN organizations dest ON dest.id=r.destination_organization_id`;
const selectReferral = `SELECT r.*, so.name AS source_organization_name, dest.name AS destination_organization_name
  ${referralFrom}`;
// Same page sizes as every admin table; anything else falls back to 10.
const REFERRAL_PAGE_SIZES = [10, 25, 50, 100];
const scopedReferral = (id, org) => [id, org, org];
const participantWhere =
  " WHERE r.id=? AND (r.source_organization_id=? OR r.destination_organization_id=?)";

function fail(res, error) {
  if (error.code === "ER_NO_SUCH_TABLE")
    return res.status(503).json({
      message:
        "ระบบส่งต่อยังไม่พร้อมใช้งาน กรุณาให้ผู้ดูแลติดตั้งฐานข้อมูลส่งต่อ",
    });
  if (error.code === "ER_DUP_ENTRY")
    return res.status(409).json({
      message: "เคสนี้มีรายการส่งต่อไปหน่วยงานนี้ที่ยังไม่เสร็จสิ้นแล้ว",
    });
  console.error("Case referral failed:", error.code || error.name);
  return res
    .status(error.status || 500)
    .json({ message: "ดำเนินการส่งต่อไม่สำเร็จ กรุณาลองใหม่" });
}
async function writeUpdate(connection, req, id, kind, status, summary) {
  const actor =
    req.authorization?.user?.name ||
    req.authorization?.user?.username ||
    req.user?.username ||
    "เจ้าหน้าที่";
  await connection.query(
    "INSERT INTO case_referral_updates (referral_id, organization_id, actor_name_encrypted, kind, status, summary_encrypted) VALUES (?,?,?,?,?,?)",
    [
      id,
      req.organizationContext,
      writeField(
        actor,
        "case_referral_updates",
        "actor_name_encrypted",
        req.organizationContext,
      ),
      kind,
      status || null,
      summary
        ? writeField(
            summary,
            "case_referral_updates",
            "summary_encrypted",
            req.organizationContext,
          )
        : null,
    ],
  );
}

router.get("/destinations", requireAction("cases.assign"), async (req, res) => {
  try {
    const level = await organizationLevelSql("o");
    const [rows] = await db.query(
      `SELECT o.id, o.code, o.name FROM organizations o JOIN organization_referral_links l ON l.destination_organization_id=o.id AND l.source_organization_id=? AND l.enabled=1 WHERE o.status='active' AND ${level}='unit' AND o.id<>? ORDER BY o.name`,
      [req.organizationContext, req.organizationContext],
    );
    res.json(rows);
  } catch (error) {
    fail(res, error);
  }
});

router.get("/", async (req, res) => {
  const direction = req.query.direction || "incoming";
  if (
    !["incoming", "outgoing"].includes(direction) ||
    (req.query.status && !STATUSES.includes(req.query.status))
  )
    return res.status(400).json({ message: "ตัวกรองการส่งต่อไม่ถูกต้อง" });
  if (req.query.source_response_id && !validId(req.query.source_response_id))
    return res.status(400).json({ message: "รหัสเคสไม่ถูกต้อง" });
  const page = Number(req.query.page || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000)
    return res.status(400).json({ message: "เลขหน้าไม่ถูกต้อง" });
  const limit = REFERRAL_PAGE_SIZES.includes(Number(req.query.limit))
    ? Number(req.query.limit)
    : 10;
  const column =
    direction === "incoming"
      ? "destination_organization_id"
      : "source_organization_id";
  const params = [req.organizationContext];
  let where = ` WHERE r.${column}=?`;
  if (req.schoolSubjectScope) {
    where +=
      " AND (r.source_response_id IN (?) OR r.source_master_case_id IN (?))";
    params.push(
      req.schoolSubjectScope.responseIds.length
        ? req.schoolSubjectScope.responseIds
        : [0],
      req.schoolSubjectScope.masterIds.length
        ? req.schoolSubjectScope.masterIds
        : [0],
    );
  }
  if (req.query.status) {
    where += " AND r.status=?";
    params.push(req.query.status);
  }
  // Case-scoped browsing is available only to its originating organization.
  if (req.query.source_response_id) {
    if (direction !== "outgoing")
      return res
        .status(400)
        .json({ message: "ตัวกรองเคสใช้กับรายการส่งออกเท่านั้น" });
  }
  try {
    if (req.query.source_response_id) {
      const [anchors] = await db.query(
        "SELECT fr.id, mc.id AS master_case_id FROM form_responses fr LEFT JOIN mastercases mc ON mc.id=fr.master_case_id AND mc.organization_id=fr.organization_id WHERE fr.id=? AND fr.organization_id=?",
        [Number(req.query.source_response_id), req.organizationContext],
      );
      if (!anchors[0])
        return res.status(404).json({ message: "ไม่พบเคสในหน่วยงานต้นทาง" });
      where += " AND (r.source_response_id=? OR r.source_master_case_id=?)";
      params.push(anchors[0].id, anchors[0].master_case_id || null);
    }
    const [[counted]] = await db.query(
      `SELECT COUNT(*) AS total ${referralFrom}${where}`,
      params,
    );
    const total = Number(counted?.total || 0);
    const [rows] = await db.query(
      `${selectReferral}${where} ORDER BY r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit],
    );
    res.json({
      items: rows.map((row) => publicReferral(row, req.organizationContext)),
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
      limit,
      has_more: page * limit < total,
      page,
    });
  } catch (error) {
    fail(res, error);
  }
});

router.get("/:id", async (req, res) => {
  if (!validId(req.params.id))
    return res.status(400).json({ message: "รหัสการส่งต่อไม่ถูกต้อง" });
  try {
    const [rows] = await db.query(
      `${selectReferral}${participantWhere}`,
      scopedReferral(req.params.id, req.organizationContext),
    );
    if (!rows[0])
      return res
        .status(404)
        .json({ message: "ไม่พบรายการส่งต่อในหน่วยงานนี้" });
    const [updates] = await db.query(
      "SELECT u.*, o.name AS organization_name FROM case_referral_updates u JOIN organizations o ON o.id=u.organization_id WHERE u.referral_id=? ORDER BY u.id ASC",
      [rows[0].id],
    );
    res.json({
      ...publicReferral(rows[0], req.organizationContext),
      updates: updates.map(publicUpdate),
    });
  } catch (error) {
    fail(res, error);
  }
});

router.post("/", requireAction("cases.assign"), async (req, res) => {
  const body = req.body || {};
  if (
    !allowedFields(body, [
      "source_response_id",
      "destination_organization_id",
      "reason",
    ]) ||
    !validId(body.source_response_id) ||
    !validId(body.destination_organization_id) ||
    !summaryText(body.reason)
  )
    return res.status(400).json({
      message:
        "กรุณาระบุเคส หน่วยงานปลายทาง และเหตุผลส่งต่อไม่เกิน 1,000 ตัวอักษร",
    });
  if (
    Number(body.destination_organization_id) === Number(req.organizationContext)
  )
    return res
      .status(422)
      .json({ message: "กรุณาเลือกหน่วยงานปลายทางที่ต่างจากต้นทาง" });
  const referrals = require("../services/caseReferralCreate");
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const { source, error } = await referrals.referralSource(
      connection,
      req.organizationContext,
      body,
    );
    if (error) {
      await connection.rollback();
      return res.status(error.status).json(error.body);
    }
    const { shareName, shareTitle } = referrals.shareRights(req);
    // A school referring to a hospital waits for approval inside the school.
    if (
      await referrals.needsApproval(
        connection,
        req.organizationContext,
        body.destination_organization_id,
      )
    ) {
      const [request] = await connection.query(
        "INSERT INTO case_referral_requests (source_organization_id,destination_organization_id,source_response_id,reason_encrypted,share_name,share_form,requested_by) VALUES (?,?,?,?,?,?,?)",
        [
          req.organizationContext,
          Number(body.destination_organization_id),
          source.id,
          writeField(
            body.reason.trim(),
            "case_referral_requests",
            "reason_encrypted",
            req.organizationContext,
          ),
          shareName ? 1 : 0,
          shareTitle ? 1 : 0,
          req.user.id,
        ],
      );
      const student = await referrals.studentOfResponse(
        connection,
        req.organizationContext,
        source.id,
      );
      if (student)
        await require("../services/schoolNotify").notify(connection, {
          organizationId: req.organizationContext,
          schoolId: student.school_id,
          kind: "referral_approval",
          studentId: student.id,
          sourceType: "referral_request",
          sourceId: request.insertId,
          recipients: (
            await referrals.approverIds(connection, req.organizationContext)
          ).filter((id) => id !== Number(req.user.id)),
          payload: {
            title: "คำขอส่งต่อโรงพยาบาลรออนุมัติ",
            body: `นักเรียนรหัส ${student.student_code} รอการอนุมัติส่งต่อ`,
          },
          dedupeKey: `referral_request:${request.insertId}`,
        });
      await requiredAudit(
        req,
        "referral_request.create",
        "referral_request",
        request.insertId,
        {},
        connection,
      );
      await connection.commit();
      return res
        .status(201)
        .json({ request_id: request.insertId, status: "awaiting_approval" });
    }
    const id = await referrals.insertReferral(
      connection,
      req,
      {
        source,
        destinationId: body.destination_organization_id,
        reason: body.reason.trim(),
        shareName,
        shareTitle,
        createdBy: req.user.id,
      },
      writeUpdate,
    );
    await requiredAudit(
      req,
      "referral.change",
      "referral",
      req.params.id || body.source_response_id,
      {},
      connection,
    );
    await connection.commit();
    await audit(req, {
      action: "referrals.create",
      targetType: "case_referral",
      targetId: id,
    });
    res.status(201).json({ id });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    fail(res, error);
  } finally {
    if (connection) connection.release();
  }
});

router.post("/:id/updates", requireAction("cases.update"), async (req, res) => {
  const body = req.body || {};
  if (
    !validId(req.params.id) ||
    !allowedFields(body, ["version", "status", "summary"]) ||
    !validId(body.version) ||
    (body.summary !== undefined && !summaryText(body.summary)) ||
    (body.status !== undefined && !STATUSES.includes(body.status)) ||
    (!body.status && !body.summary)
  )
    return res
      .status(400)
      .json({ message: "กรุณาระบุสถานะหรือบันทึกสรุปไม่เกิน 1,000 ตัวอักษร" });
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.query(
      `${selectReferral}${participantWhere} FOR UPDATE`,
      scopedReferral(req.params.id, req.organizationContext),
    );
    const referral = rows[0];
    if (!referral) {
      await connection.rollback();
      return res
        .status(404)
        .json({ message: "ไม่พบรายการส่งต่อในหน่วยงานนี้" });
    }
    if (Number(referral.version) !== Number(body.version)) {
      await connection.rollback();
      return res.status(409).json({
        message: "รายการนี้มีการอัปเดตแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึก",
      });
    }
    if (
      body.status &&
      !transitionsFor(referral, req.organizationContext).includes(body.status)
    ) {
      await connection.rollback();
      return res
        .status(422)
        .json({ message: "หน่วยงานนี้ไม่สามารถเปลี่ยนเป็นสถานะที่เลือกได้" });
    }
    if (["completed", "rejected", "cancelled"].includes(referral.status)) {
      await connection.rollback();
      return res
        .status(422)
        .json({ message: "รายการส่งต่อสิ้นสุดแล้ว ไม่สามารถเพิ่มบันทึกได้" });
    }
    if (["completed", "rejected"].includes(body.status) && !body.summary) {
      await connection.rollback();
      return res
        .status(422)
        .json({ message: "กรุณาบันทึกผลสรุปหรือเหตุผลประกอบสถานะนี้" });
    }
    await connection.query(
      "UPDATE case_referrals SET status=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      [body.status || referral.status, referral.id],
    );
    await writeUpdate(
      connection,
      req,
      referral.id,
      body.status ? "status" : "note",
      body.status,
      body.summary?.trim(),
    );
    await requiredAudit(
      req,
      "referral.change",
      "referral",
      req.params.id || body.source_response_id,
      {},
      connection,
    );
    await connection.commit();
    await audit(req, {
      action: "referrals.update",
      targetType: "case_referral",
      targetId: referral.id,
    });
    res.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback().catch(() => {});
    fail(res, error);
  } finally {
    if (connection) connection.release();
  }
});
module.exports = router;
module.exports.writeUpdate = writeUpdate;
module.exports.fail = fail;
