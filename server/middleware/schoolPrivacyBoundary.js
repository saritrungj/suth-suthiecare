const db = require("../config/db");
const {
  loadSchoolAccess,
  canViewStudentHealth,
} = require("../utils/schoolAccess");
// Hospital endpoints can also be called from a school. Apply the same student
// boundary before their handlers and before returning their collections.
async function schoolPrivacyBoundary(req, res, next) {
  const path = req.path;
  if (
    !req.authorization ||
    req.authorization.isSystemAdmin ||
    typeof req.organizationContext !== "number"
  )
    return next();
  const [[org]] = await db.query(
    "SELECT org_type FROM organizations WHERE id=?",
    [req.organizationContext],
  );
  if (org?.org_type !== "school") return next();
  // One export request uses one permission/role snapshot across its batches.
  // Ordinary requests always reload roles, so revocation applies immediately.
  req.schoolAccess =
    req.exporting && req.schoolAccess
      ? req.schoolAccess
      : await loadSchoolAccess(db, req);
  if (
    req.schoolAccess.isGuardian &&
    !["GET", "HEAD"].includes(req.method) &&
    !/^\/me(\/|$)/.test(path)
  )
    return res
      .status(403)
      .json({ message: "ผู้ปกครองมีสิทธิ์ดูข้อมูลเท่านั้น" });
  const sensitive =
    /^\/(cases|all-cases|master-cases|appointments|case-referrals|patient-members|dashboard|charts|evaluations|admin\/master-cases|history)(\/|$)/.test(
      path,
    ) || /^\/forms\/[^/]+\/responses/.test(path);
  if (!sensitive || path.startsWith("/dashboard-settings/")) return next();
  const [students] = await db.query(
    "SELECT ss.id,ss.school_id,ss.classroom_id,ss.person_id,ss.patient_account_id,ss.archived_at FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE s.organization_id=? AND ss.archived_at IS NULL",
    [req.organizationContext],
  );
  const allowed = students.filter(
    (s) => !s.archived_at && canViewStudentHealth(req.schoolAccess, s),
  );
  const personIds = new Set(
    allowed.map((s) => Number(s.person_id)).filter(Boolean),
  );
  const accountIds = new Set(
    allowed.map((s) => Number(s.patient_account_id)).filter(Boolean),
  );
  const [responses] = await db.query(
    "SELECT id,person_id,patient_account_id,master_case_id FROM form_responses WHERE organization_id=?",
    [req.organizationContext],
  );
  const permitted = responses.filter(
    (r) =>
      personIds.has(Number(r.person_id)) ||
      accountIds.has(Number(r.patient_account_id)),
  );
  const responseIds = new Set(permitted.map((r) => Number(r.id)));
  req.schoolResourcePath = path;
  req.schoolSubjectScope = {
    accountIds: [...accountIds],
    responseIds: [...responseIds],
    masterIds: [
      ...new Set(
        permitted.map((r) => Number(r.master_case_id)).filter(Boolean),
      ),
    ],
  };
  const masterIds = new Set(
    permitted.map((r) => Number(r.master_case_id)).filter(Boolean),
  );
  const denied = () =>
    res.status(403).json({
      code: "STUDENT_INSIGHT_SCOPE_REQUIRED",
      message: "ไม่มีสิทธิ์ข้อมูลเชิงลึกของนักเรียนในขอบเขตนี้",
    });
  const aggregate =
    /^\/(evaluations|admin\/master-cases)(\/|$)/.test(path) ||
    path === "/dashboard/summary";
  if (
    aggregate &&
    (allowed.length !== students.length || !req.schoolAccess.canClinical)
  )
    return denied();
  const caseId =
    path.match(/^\/cases\/(\d+)/)?.[1] ||
    req.body?.response_id ||
    req.body?.case_id ||
    req.query?.source_response_id;
  const masterId =
    path.match(/^\/master-cases\/by-id\/(\d+)/)?.[1] ||
    (!["GET", "HEAD"].includes(req.method)
      ? path.match(/^\/master-cases\/(\d+)/)?.[1]
      : null) ||
    req.body?.master_case_id;
  if (caseId && !responseIds.has(Number(caseId))) return denied();
  if (masterId && !masterIds.has(Number(masterId))) return denied();
  if (path.startsWith("/history/") && !req.schoolAccess.canViewAllHealth)
    return denied();
  const memberId = path.match(/^\/patient-members\/(\d+)/)?.[1];
  if (memberId && !accountIds.has(Number(memberId))) return denied();
  if (/^\/appointments\/\d+/.test(path)) {
    const [[appointment]] = await db.query(
      "SELECT case_id,master_case_id FROM appointments WHERE id=?",
      [path.split("/")[2]],
    );
    if (
      !appointment ||
      (!responseIds.has(Number(appointment.case_id)) &&
        !masterIds.has(Number(appointment.master_case_id)))
    )
      return denied();
  }
  if (/^\/case-referrals\/\d+/.test(path)) {
    const [[referral]] = await db.query(
      "SELECT source_response_id,source_master_case_id FROM case_referrals WHERE id=?",
      [path.split("/")[2]],
    );
    if (
      !referral ||
      (!responseIds.has(Number(referral.source_response_id)) &&
        !masterIds.has(Number(referral.source_master_case_id)))
    )
      return denied();
  }
  // Creation without a subject cannot establish an authorized health scope.
  if (
    !["GET", "HEAD"].includes(req.method) &&
    !caseId &&
    !masterId &&
    !/^\/(appointments|case-referrals)\/\d+/.test(path)
  )
    return denied();
  const original = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400) return original(body);
    const accepts = (row) => {
      if (!row || typeof row !== "object") return false;
      if (path.startsWith("/patient-members"))
        return accountIds.has(Number(row.id));
      if (path.startsWith("/case-referrals"))
        return (
          responseIds.has(Number(row.source_response_id)) ||
          masterIds.has(Number(row.source_master_case_id))
        );
      if (path.startsWith("/appointments"))
        return (
          responseIds.has(Number(row.case_id)) ||
          masterIds.has(Number(row.master_case_id))
        );
      if (path.startsWith("/master-cases"))
        return masterIds.has(Number(row.id));
      return responseIds.has(Number(row.id || row.response_id));
    };
    const isCollection =
      /^\/(cases|all-cases|master-cases|appointments|case-referrals|patient-members)$/.test(
        path,
      ) ||
      path === "/dashboard/recent" ||
      /^\/forms\/[^/]+\/responses/.test(path);
    if (isCollection) {
      if (Array.isArray(body)) body = body.filter(accepts);
      else if (body && typeof body === "object") {
        body = { ...body };
        for (const key of ["data", "items", "responses", "cases"])
          if (Array.isArray(body[key])) body[key] = body[key].filter(accepts);
        // A server total for a broader population must never disclose it.
        // Counts are computed with the subject scope before SQL pagination.
      }
    }
    return original(body);
  };
  next();
}
module.exports = { schoolPrivacyBoundary };
