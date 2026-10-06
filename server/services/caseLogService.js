const {
  responseOwner,
  ownedReference,
  concreteOrganization,
  httpError,
} = require("../utils/operationalOwnership");
const { encrypt } = require("../utils/encryption");
const { requiredAudit } = require("../utils/pdpaAudit");
const { fieldContext } = require("../utils/privateData");
async function saveCaseLog(db, req) {
  const org = concreteOrganization(req),
    input = req.body || {};
  if (
    !Number.isSafeInteger(Number(req.params.id)) ||
    Number(req.params.id) < 1 ||
    typeof input.type !== "string" ||
    !input.type.trim() ||
    input.type.length > 20 ||
    typeof input.detail !== "string" ||
    input.detail.length > 10000
  )
    throw httpError(422, "INVALID_CASE_LOG");
  if (req.query.target === "master")
    throw httpError(422, "RESPONSE_ID_REQUIRED_FOR_WRITE");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const owner = await responseOwner(
      connection,
      req,
      req.params.id,
      input.master_case_id,
      true,
    );
    await ownedReference(connection, "staffs", input.staff_id, org);
    await ownedReference(connection, "case_statuses", input.status_id, org);
    if (input.status !== undefined) {
      const [statuses] = await connection.query(
        "SELECT id,name FROM case_statuses WHERE organization_id=? AND name=? AND is_active=1",
        [org, input.status],
      );
      if (!statuses.length) throw httpError(422, "STATUS_OUTSIDE_ORGANIZATION");
      if (
        input.status_id &&
        Number(statuses[0]?.id) !== Number(input.status_id)
      )
        throw httpError(422, "STATUS_REFERENCE_MISMATCH");
    }
    if (
      input.patient_visible !== undefined &&
      typeof input.patient_visible !== "boolean"
    )
      throw httpError(422, "INVALID_VISIBILITY");
    if (
      input.risk_level !== undefined &&
      (typeof input.risk_level !== "string" || input.risk_level.length > 100)
    )
      throw httpError(422, "INVALID_RISK");
    const actor =
      req.authorization?.user?.name ||
      req.authorization?.user?.username ||
      String(req.user.id);
    await connection.query(
      "INSERT INTO case_logs (response_id,master_case_id,type,staff,staff_id,detail,status_id,patient_visible) VALUES (?,?,?,?,?,?,?,?)",
      [
        owner.id,
        owner.master_case_id || null,
        input.type,
        encrypt(actor, fieldContext("case_logs", "staff", org)),
        input.staff_id || null,
        encrypt(input.detail, fieldContext("case_logs", "detail", org)),
        input.status_id || null,
        input.patient_visible === true ? 1 : 0,
      ],
    );
    const updates = [],
      values = [];
    if (input.status !== undefined) {
      if (typeof input.status !== "string" || input.status.length > 100)
        throw httpError(422, "INVALID_STATUS");
      updates.push("status=?");
      values.push(input.status);
    }
    if (input.risk_level !== undefined) {
      updates.push("risk_level=?");
      values.push(
        encrypt(
          input.risk_level,
          fieldContext("form_responses", "risk_level", org),
        ),
      );
    }
    if (input.staff_id !== undefined) {
      updates.push("staff_id=?");
      values.push(input.staff_id || null);
    }
    if (updates.length)
      await connection.query(
        `UPDATE form_responses SET ${updates.join(",")} WHERE id=? AND organization_id=?`,
        [...values, owner.id, org],
      );
    if (owner.master_case_id && input.risk_level !== undefined)
      await connection.query(
        "UPDATE mastercases SET overall_risk=? WHERE id=? AND organization_id=?",
        [
          encrypt(
            input.risk_level,
            fieldContext("mastercases", "overall_risk", org),
          ),
          owner.master_case_id,
          org,
        ],
      );
    await requiredAudit(
      req,
      "case.log.create",
      "form_response",
      owner.id,
      {},
      connection,
    );
    await connection.commit();
    return { message: "บันทึกประวัติและอัปเดตสถานะสำเร็จ" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
module.exports = { saveCaseLog };
