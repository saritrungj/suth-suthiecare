const { serialize } = require("../utils/privateDto");
const { requiredAudit } = require("../utils/pdpaAudit");
const sensitivePath = (path) =>
  /^\/(cases|master-cases|all-cases|appointments|patient-members|history|charts|evaluations|case-referrals)(\/|$)/.test(
    path,
  ) ||
  /^\/forms\/[^/]+\/responses/.test(path) ||
  path.startsWith("/school/") ||
  path === "/dashboard/recent" ||
  path === "/admin/master-cases/stats";
function privateDisclosure(req, res, next) {
  if (!sensitivePath(req.path)) return next();
  const canClinical =
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has("clinical.view");
  const canPii =
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has("pii.view");
  if (
    req.authorization &&
    !canPii &&
    (/\/answers(\/|$)/.test(req.path) ||
      req.path.startsWith("/charts/") ||
      /^\/patient-members\/\d+$/.test(req.path))
  )
    return res.status(403).json({ code: "PII_PERMISSION_REQUIRED" });
  if (
    req.authorization &&
    !canClinical &&
    (/\/(answers|clinical-data|health|health-profile|physical-records)(\/|$)/.test(
      req.path,
    ) ||
      req.path.startsWith("/charts/") ||
      req.path.startsWith("/evaluations/") ||
      req.path === "/admin/master-cases/stats" ||
      req.path === "/school/cases")
  )
    return res.status(403).json({ code: "CLINICAL_PERMISSION_REQUIRED" });
  const original = res.json.bind(res);
  res.json = function (body) {
    if (res.statusCode >= 400 || !req.authorization) return original(body);
    const sys = req.authorization.isSystemAdmin;
    const pii = sys || req.authorization.permissions?.has("pii.view");
    const clinical = sys || req.authorization.permissions?.has("clinical.view");
    Promise.resolve()
      .then(async () => {
        const credential =
          req.method === "POST" &&
          /^\/school\/students(?:\/(import|\d+\/reset-password))?$/.test(
            req.path,
          );
        if (
          credential ||
          (["GET", "HEAD"].includes(req.method) && (pii || clinical))
        )
          await requiredAudit(
            req,
            credential
              ? "credentials.issue"
              : req.organizationContext === "all"
                ? "data.cross_organization.read"
                : "data.read",
            "route",
            req.path,
            {
              count: Array.isArray(body)
                ? body.length
                : body?.items?.length || 1,
            },
          );
        const list =
          req.method === "GET" &&
          (/^\/(cases|master-cases|all-cases|appointments|patient-members|case-referrals)$/.test(
            req.path,
          ) ||
            /^\/forms\/[^/]+\/responses/.test(req.path) ||
            req.path === "/dashboard/recent" ||
            /^\/school\/students$/.test(req.path));
        return original(serialize(body, { pii, clinical, list, credential }));
      })
      .catch((error) => {
        res.status(error.status || 503);
        original({
          success: false,
          code: error.code || "PRIVATE_DATA_UNAVAILABLE",
        });
      });
    return res;
  };
  next();
}
module.exports = { privateDisclosure, sensitivePath };
