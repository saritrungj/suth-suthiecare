// Creating a case referral, shared by the direct send (POST /case-referrals)
// and by approving a school's request to refer to a hospital
// (referralApprovalRoutes). Everything runs on the caller's connection, inside
// its transaction.
const { organizationLevelSql } = require("../authorization/authorization");
const { decrypt } = require("../utils/encryption");
const { writeField, readField } = require("../utils/privateField");

const reject = (status, body) => ({ error: { status, body } });

// Checks that the destination is an enabled link of the source unit, both are
// active units, and the response belongs to the source unit. Returns
// { source } with the case row, or { error: { status, body } }.
async function referralSource(connection, organizationId, body) {
  const [links] = await connection.query(
    "SELECT enabled FROM organization_referral_links WHERE source_organization_id=? AND destination_organization_id=? AND enabled=1 FOR UPDATE",
    [organizationId, body.destination_organization_id],
  );
  if (!links[0] || Number(links[0].enabled) !== 1)
    return reject(403, { code: "REFERRAL_DESTINATION_NOT_ALLOWED" });
  const level = await organizationLevelSql("o");
  const [units] = await connection.query(
    `SELECT o.id FROM organizations o WHERE o.id IN (?,?) AND o.status='active' AND ${level}='unit' FOR UPDATE`,
    [organizationId, body.destination_organization_id],
  );
  if (units.length !== 2)
    return reject(422, {
      message: "หน่วยงานต้นทางและปลายทางต้องเป็นหน่วยงานที่เปิดใช้งาน",
    });
  const [cases] = await connection.query(
    "SELECT fr.id, mc.id AS master_case_id, fr.summary_data, f.title AS form_title, pa.first_name_encrypted, pa.last_name_encrypted FROM form_responses fr LEFT JOIN forms f ON f.id=fr.form_id LEFT JOIN patient_accounts pa ON pa.id=fr.patient_account_id LEFT JOIN mastercases mc ON mc.id=fr.master_case_id AND mc.organization_id=fr.organization_id WHERE fr.id=? AND fr.organization_id=? FOR UPDATE",
    [body.source_response_id, organizationId],
  );
  if (!cases[0]) return reject(404, { message: "ไม่พบเคสในหน่วยงานต้นทาง" });
  return { source: cases[0] };
}

// A school unit referring to a hospital unit waits for approval first.
async function needsApproval(connection, organizationId, destinationId) {
  const [rows] = await connection.query(
    "SELECT id,org_type FROM organizations WHERE id IN (?,?)",
    [organizationId, destinationId],
  );
  const type = (id) => rows.find((r) => Number(r.id) === Number(id))?.org_type;
  return (
    type(organizationId) === "school" && type(destinationId) === "hospital"
  );
}

// What the requester may share: the person's name and the form title travel
// only with the "assign" rights on pii and clinical.
function shareRights(req) {
  const { can } = require("../authorization/can");
  return {
    shareName: can(req, "pii.view") && can(req, "pii.assign"),
    shareTitle: can(req, "clinical.view") && can(req, "clinical.assign"),
  };
}

function displayNameOf(source, organizationId) {
  const summary = require("../utils/decryptCaseData").decryptSummaryData(
    source.summary_data,
    decrypt,
    organizationId,
  );
  const submitted =
    typeof summary.display_name === "string" ? summary.display_name : "";
  return submitted && submitted.trim() !== "-"
    ? submitted
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
}

// Inserts the referral and its "created" update. writeUpdate is the route's
// helper (it names the acting staff member). Returns the new referral id.
async function insertReferral(
  connection,
  req,
  { source, destinationId, reason, shareName, shareTitle, createdBy },
  writeUpdate,
) {
  const organizationId = req.organizationContext;
  const [created] = await connection.query(
    "INSERT INTO case_referrals (source_organization_id,destination_organization_id,source_response_id,source_master_case_id,display_name_encrypted,form_title,reason_encrypted,created_by) VALUES (?,?,?,?,?,?,?,?)",
    [
      organizationId,
      Number(destinationId),
      source.id,
      source.master_case_id || null,
      writeField(
        shareName ? displayNameOf(source, organizationId) : "ไม่ระบุชื่อ",
        "case_referrals",
        "display_name_encrypted",
        organizationId,
      ),
      shareTitle ? source.form_title || null : null,
      writeField(reason, "case_referrals", "reason_encrypted", organizationId),
      createdBy,
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
  return created.insertId;
}

// The school student a response belongs to, for notifications and scope.
async function studentOfResponse(connection, organizationId, responseId) {
  const [[row]] = await connection.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.student_code,ss.archived_at FROM form_responses fr
     JOIN school_students ss ON ss.person_id=fr.person_id OR (fr.person_id IS NULL AND ss.patient_account_id=fr.patient_account_id)
     JOIN schools s ON s.id=ss.school_id AND s.organization_id=fr.organization_id
     WHERE fr.id=? AND fr.organization_id=? AND ss.archived_at IS NULL LIMIT 1`,
    [responseId, organizationId],
  );
  return row || null;
}

// Staff of the unit whose role may approve (referral_approvals update/manage).
async function approverIds(connection, organizationId) {
  const [rows] = await connection.query(
    `SELECT DISTINCT om.user_id FROM organization_memberships om
     JOIN users u ON u.id=om.user_id AND u.status='active'
     JOIN organization_role_permissions p ON p.organization_id=om.organization_id AND p.role_id=om.role_id
       AND p.permission_key IN ('referral_approvals.update','referral_approvals.manage')
     WHERE om.organization_id=? AND om.status='active'`,
    [organizationId],
  );
  return rows.map((r) => Number(r.user_id));
}

module.exports = {
  referralSource,
  needsApproval,
  shareRights,
  insertReferral,
  studentOfResponse,
  approverIds,
};
