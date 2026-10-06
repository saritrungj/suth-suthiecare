const {
  concreteOrganization,
  responseOwner,
  ownedReference,
  httpError,
} = require("../utils/operationalOwnership");
const { encrypt } = require("../utils/encryption");
const { requiredAudit } = require("../utils/pdpaAudit");

async function createAppointment(db, req) {
  const organizationId = concreteOrganization(req),
    body = req.body || {};
  if (!body.appointment_date || Number.isNaN(Date.parse(body.appointment_date)))
    throw httpError(422, "INVALID_APPOINTMENT_DATE");
  if (
    body.note != null &&
    (typeof body.note !== "string" || body.note.length > 10000)
  )
    throw httpError(422, "INVALID_NOTE");
  if (
    body.appointment_no != null &&
    (!Number.isSafeInteger(Number(body.appointment_no)) ||
      Number(body.appointment_no) < 1 ||
      Number(body.appointment_no) > 1000)
  )
    throw httpError(422, "INVALID_APPOINTMENT_NUMBER");
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    let masterId;
    if (body.case_id != null)
      masterId = (
        await responseOwner(
          connection,
          req,
          body.case_id,
          body.master_case_id,
          true,
        )
      ).master_case_id;
    else {
      await ownedReference(
        connection,
        "mastercases",
        body.master_case_id,
        organizationId,
      );
      masterId = body.master_case_id;
    }
    if (!masterId) throw httpError(422, "MASTER_CASE_REQUIRED");
    await ownedReference(
      connection,
      "service_types",
      body.service_id,
      organizationId,
    );
    await ownedReference(connection, "staffs", body.staff_id, organizationId);
    const { fieldContext } = require("../utils/privateData");
    let staff = null;
    if (body.staff_id) {
      const [rows] = await connection.query(
        "SELECT fullname FROM staffs WHERE id=? AND organization_id=?",
        [body.staff_id, organizationId],
      );
      staff = encrypt(
        require("../utils/privateField").readField(
          rows[0]?.fullname,
          "staffs",
          "fullname",
          organizationId,
        ),
        fieldContext("appointments", "staff", organizationId),
      );
    }
    const [result] = await connection.query(
      "INSERT INTO appointments (case_id,master_case_id,service_id,appointment_no,appointment_date,staff,staff_id,note) VALUES (?,?,?,?,?,?,?,?)",
      [
        body.case_id || null,
        masterId,
        body.service_id || null,
        body.appointment_no || null,
        body.appointment_date,
        staff,
        body.staff_id || null,
        encrypt(
          body.note,
          fieldContext("appointments", "note", organizationId),
        ),
      ],
    );
    await requiredAudit(
      req,
      "appointments.create",
      "appointment",
      result.insertId,
      {},
      connection,
    );
    await connection.commit();
    return { id: result.insertId, message: "Appointment created" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
function readAppointment(row) {
  const { readField } = require("../utils/privateField");
  const result = {
    ...row,
    staff: readField(row.staff, "appointments", "staff", row.organization_id),
    note: readField(row.note, "appointments", "note", row.organization_id),
  };
  if (row.clinical_payload_encrypted)
    Object.assign(
      result,
      require("../utils/privateData").readJson(
        row.clinical_payload_encrypted,
        require("../utils/privateData").fieldContext(
          "appointments",
          "clinical",
          row.organization_id,
        ),
      ),
    );
  delete result.clinical_payload_encrypted;
  return result;
}
module.exports = { createAppointment, readAppointment };
