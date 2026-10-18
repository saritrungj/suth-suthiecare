const catalog = require("../utils/masterCatalog");
// Only resolve metadata for identifiers already returned by authorized export
// handlers. Do not look up arbitrary client-supplied ids or unmask patient data.
const metadata = {
  organization_id: ["organizations", "name"],
  school_id: ["schools", "name"],
  classroom_id: ["school_classrooms", "name"],
  grade_level_id: ["school_grade_levels", "name"],
  student_type_id: ["school_student_types", "name"],
  teacher_type_id: ["school_teacher_types", "name"],
  role_id: ["roles", "name"],
  form_id: ["forms", "title"],
  clinic_id: ["clinics", "name"],
};
async function exportDisplayContext(req, sheets, db = require("../config/db")) {
  const pii =
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has("pii.view");
  const descriptors = {
    ...metadata,
    ...(pii
      ? {
          staff_id: ["users", "name"],
          recorded_by: ["users", "name"],
          updated_by: ["users", "name"],
          created_by: ["users", "name"],
        }
      : {}),
    user_id: ["users", "username"],
  };
  const ids = new Map(),
    organizations = new Set(),
    clinicTypes = new Set();
  const add = (key, id) => {
    if (Number.isSafeInteger(Number(id)) && Number(id) > 0) {
      if (!ids.has(key)) ids.set(key, new Set());
      ids.get(key).add(Number(id));
    }
  };
  if (Number.isInteger(req.organizationContext))
    organizations.add(req.organizationContext);
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object" || value instanceof Date) return;
    for (const [key, item] of Object.entries(value)) {
      if (Object.hasOwn(descriptors, key)) add(key, item);
      if (
        key === "organization_id" &&
        Number.isSafeInteger(Number(item)) &&
        Number(item) > 0
      )
        organizations.add(Number(item));
      if (
        (key === "clinic_type" || key === "clinicType") &&
        typeof item === "string"
      )
        clinicTypes.add(item);
      if (item && typeof item === "object") visit(item);
    }
  };
  sheets.forEach((sheet) => visit(sheet.data));
  const lookups = {};
  for (const [key, values] of ids) {
    const [table, column] = descriptors[key];
    lookups[key] = {};
    const all = [...values];
    for (let offset = 0; offset < all.length; offset += 500) {
      const [rows] = await db.query(
        `SELECT id,${column} AS label${["schools", "school_student_types", "school_teacher_types", "forms", "clinics"].includes(table) ? ",organization_id" : ""} FROM ${table} WHERE id IN (?)`,
        [all.slice(offset, offset + 500)],
      );
      for (const row of rows) {
        lookups[key][row.id] =
          table === "users" && column === "name"
            ? require("../utils/privateField").readField(
                row.label,
                "users",
                "name",
              )
            : row.label;
        if (row.organization_id) organizations.add(Number(row.organization_id));
      }
    }
  }
  const clinics = {};
  if (clinicTypes.size) {
    const scope =
      req.authorization?.isSystemAdmin && req.organizationContext === "all"
        ? ""
        : " AND organization_id=?";
    const [rows] = await db.query(
      `SELECT slug,name FROM clinics WHERE slug IN (?)${scope}`,
      [...[[...clinicTypes]], ...(scope ? [req.organizationContext] : [])],
    );
    for (const row of rows) clinics[row.slug] = row.name;
  }
  let options = [];
  if (organizations.size) {
    const [rows] = await db.query(
      "SELECT organization_id,category,code,label FROM master_data_options WHERE organization_id IN (?)",
      [[...organizations]],
    );
    options = rows;
  }
  return {
    organizationId: Number.isInteger(req.organizationContext)
      ? req.organizationContext
      : null,
    lookups,
    clinics,
    options,
    defaults: Object.fromEntries(
      Object.entries(catalog)
        .filter(([, definition]) => definition.defaults)
        .map(([category, definition]) => [
          category,
          Object.fromEntries(definition.defaults),
        ]),
    ),
  };
}
module.exports = { exportDisplayContext };
