// The caller owns the transaction and locks the form before approving a notice.
// Published version labels are immutable so consent evidence remains reproducible.
async function approveNotice(
  connection,
  {
    organizationId,
    formId,
    actorId,
    purpose,
    legal_basis,
    notice_version,
    notice_text,
  },
) {
  const [versions] = await connection.query(
    "SELECT purpose,legal_basis,notice_text FROM pdpa_notice_versions WHERE organization_id=? AND form_id=? AND notice_version=? FOR UPDATE",
    [organizationId, formId, notice_version],
  );
  const previous = versions[0];
  if (
    previous &&
    ["purpose", "legal_basis", "notice_text"].some(
      (key) => previous[key] !== { purpose, legal_basis, notice_text }[key],
    )
  )
    throw Object.assign(new Error("NOTICE_VERSION_IMMUTABLE"), {
      code: "NOTICE_VERSION_IMMUTABLE",
      status: 409,
    });
  if (!previous)
    await connection.query(
      "INSERT INTO pdpa_notice_versions (organization_id,form_id,notice_version,purpose,legal_basis,notice_text,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,NOW())",
      [
        organizationId,
        formId,
        notice_version,
        purpose,
        legal_basis,
        notice_text,
        actorId,
      ],
    );
  await connection.query(
    "INSERT INTO pdpa_processing_purposes (organization_id,form_id,purpose,legal_basis,notice_version,notice_text,approved_by,approved_at) VALUES (?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE purpose=VALUES(purpose),legal_basis=VALUES(legal_basis),notice_version=VALUES(notice_version),notice_text=VALUES(notice_text),approved_by=VALUES(approved_by),approved_at=NOW()",
    [
      organizationId,
      formId,
      purpose,
      legal_basis,
      notice_version,
      notice_text,
      actorId,
    ],
  );
}
// A fixed, versioned fallback removes per-form setup without claiming that a
// staff member approved a notice. Existing approved notices retain precedence.
const STANDARD_NOTICE = Object.freeze({
  purpose: 'health_assessment_followup',
  legal_basis: 'consent',
  notice_version: 'standard-v1',
  notice_text: 'ระบบเก็บคำตอบและผลประเมินเพื่อประเมินสุขภาพและติดตามการดูแลโดยเจ้าหน้าที่ของหน่วยงานที่รับแบบประเมิน ข้อมูลจะแสดงตามสิทธิ์ของผู้ใช้งาน โปรดอ่านนโยบายความเป็นส่วนตัวของระบบก่อนยินยอมส่งแบบประเมิน',
});
async function getProcessingNotice(connection, formId, organizationId) {
  const [rows] = await connection.query(
    'SELECT purpose,legal_basis,notice_version,notice_text FROM pdpa_processing_purposes WHERE form_id=? AND organization_id=? AND approved_at IS NOT NULL',
    [formId, organizationId],
  );
  return rows[0] || {...STANDARD_NOTICE};
}
module.exports = { approveNotice, STANDARD_NOTICE, getProcessingNotice };
