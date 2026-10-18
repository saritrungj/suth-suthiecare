const PREFIX =
  /^(?:นางสาว|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|น\.ส\.|นาย|นาง|Mr\.?|Mrs\.?|Ms\.?|Miss)(?=\s|[^a-z])/i;

function firstNameOf(value, structured = false) {
  let name = String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (!structured) name = name.replace(PREFIX, "").trim();
  if (!name || name === "-" || name.includes("*") || name.includes("•"))
    return null;
  return structured ? name : name.split(/\s+/)[0] || null;
}

function requirePii(req, res, next) {
  if (
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has("pii.view")
  )
    return next();
  return res.status(403).json({ code: "PII_PERMISSION_REQUIRED" });
}

function lastNameOf(value, structured = false) {
  const name = firstNameOf(value, true);
  if (!name) return null;
  return structured
    ? name
    : name.replace(PREFIX, "").trim().split(/\s+/).slice(1).join(" ") || null;
}

module.exports = { firstNameOf, lastNameOf, requirePii };
