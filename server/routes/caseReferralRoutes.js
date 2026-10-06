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
  next();
});
const selectReferral = `SELECT r.*, so.name AS source_organization_name, dest.name AS destination_organization_name
  FROM case_referrals r JOIN organizations so ON so.id=r.source_organization_id
  JOIN organizations dest ON dest.id=r.destination_organization_id`;
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
  const column =
    direction === "incoming"
      ? "destination_organization_id"
      : "source_organization_id";
  const params = [req.organizationContext];
  let where = ` WHERE r.${column}=?`;
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
    const [rows] = await db.query(
      `${selectReferral}${where} ORDER BY r.updated_at DESC,r.id DESC LIMIT 51 OFFSET ?`,
      [...params, (page - 1) * 50],
    );
    res.json({
      items: rows
        .slice(0, 50)
        .map((row) => publicReferral(row, req.organizationContext)),
      has_more: rows.length > 50,
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
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [links] = await connection.query(
      "SELECT enabled FROM organization_referral_links WHERE source_organization_id=? AND destination_organization_id=? AND enabled=1 FOR UPDATE",
      [req.organizationContext, body.destination_organization_id],
    );
    if (!links[0] || Number(links[0].enabled) !== 1) {
      await connection.rollback();
      return res.status(403).json({ code: "REFERRAL_DESTINATION_NOT_ALLOWED" });
    }
    const level = await organizationLevelSql("o");
    const [units] = await connection.query(
      `SELECT o.id FROM organizations o WHERE o.id IN (?,?) AND o.status='active' AND ${level}='unit' FOR UPDATE`,
      [req.organizationContext, body.destination_organization_id],
    );
    if (units.length !== 2) {
      await connection.rollback();
      return res.status(422).json({
        message: "หน่วยงานต้นทางและปลายทางต้องเป็นหน่วยงานที่เปิดใช้งาน",
      });
    }
    const [cases] = await connection.query(
      "SELECT fr.id, mc.id AS master_case_id, fr.summary_data, f.title AS form_title, pa.first_name_encrypted, pa.last_name_encrypted FROM form_responses fr LEFT JOIN forms f ON f.id=fr.form_id LEFT JOIN patient_accounts pa ON pa.id=fr.patient_account_id LEFT JOIN mastercases mc ON mc.id=fr.master_case_id AND mc.organization_id=fr.organization_id WHERE fr.id=? AND fr.organization_id=? FOR UPDATE",
      [body.source_response_id, req.organizationContext],
    );
    if (!cases[0]) {
      await connection.rollback();
      return res.status(404).json({ message: "ไม่พบเคสในหน่วยงานต้นทาง" });
    }
    const source = cases[0];
    let summary = require("../utils/decryptCaseData").decryptSummaryData(
      source.summary_data,
      decrypt,
      req.organizationContext,
    );
    const submittedName =
      typeof summary.display_name === "string" ? summary.display_name : "";
    const displayName =
      submittedName && submittedName.trim() !== "-"
        ? submittedName
        : [
            readField(
              source.first_name_encrypted,
              "patient_accounts",
              "first_name_encrypted",
            ),
            readField(
              source.last_name_encrypted,
              "patient_accounts",
              "last_name_encrypted",
            ),
          ]
            .filter(Boolean)
            .join(" ");
    const [created] = await connection.query(
      "INSERT INTO case_referrals (source_organization_id,destination_organization_id,source_response_id,source_master_case_id,display_name_encrypted,form_title,reason_encrypted,created_by) VALUES (?,?,?,?,?,?,?,?)",
      [
        req.organizationContext,
        Number(body.destination_organization_id),
        source.id,
        source.master_case_id || null,
        writeField(
          displayName,
          "case_referrals",
          "display_name_encrypted",
          req.organizationContext,
        ),
        source.form_title || null,
        writeField(
          body.reason.trim(),
          "case_referrals",
          "reason_encrypted",
          req.organizationContext,
        ),
        req.user.id,
      ],
    );
    await writeUpdate(
      connection,
      req,
      created.insertId,
      "created",
      "pending",
      null,
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
      targetId: created.insertId,
    });
    res.status(201).json({ id: created.insertId });
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
