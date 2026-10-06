// Organization hierarchy rules (pure, see test/organizationHierarchy.test.js).
//
//   main organization (org_level "main") — groups sub-units and decides their
//     type: "hospital" (sub-units hold clinics) or "school" (sub-units hold
//     schools). It has no members and owns no data.
//   sub-unit (org_level "unit") — the working unit: members, roles, forms,
//     cases, clinics or schools. Under a main organization it inherits the
//     main organization's type, which is stored on the row as a copy.
//
// Organizations created before the hierarchy existed are sub-units without a
// parent; they keep their own type until placed under a main organization.
const ORGANIZATION_TYPES = ["hospital", "school"];
const ORGANIZATION_STATUSES = ["active", "inactive"];

const isMainOrganization = (organization) =>
  Boolean(organization) && organization.org_level === "main";

const text = (value) => String(value ?? "").trim();

const parentIdOf = (body, existing) => {
  if (body.parent_id === undefined && existing) return existing.parent_id;
  if (
    body.parent_id === undefined ||
    body.parent_id === "" ||
    body.parent_id === null
  )
    return null;
  return Number(body.parent_id);
};

/**
 * Validates a create (existing undefined) or update of an organization.
 * `parent` is the row named by the requested parent_id, looked up by the caller.
 * Returns { error } or
 *   { value: { kind, name, description, status, org_type, parent_id } }.
 */
function planOrganizationWrite({ body = {}, existing, parent }) {
  const name = text(body.name);
  if (!name || name.length > 255) return { error: "กรุณาระบุชื่อหน่วยงาน" };
  const status = existing ? body.status || existing.status : "active";
  if (!ORGANIZATION_STATUSES.includes(status))
    return { error: "สถานะหน่วยงานไม่ถูกต้อง" };
  const kind = existing
    ? isMainOrganization(existing)
      ? "main"
      : "unit"
    : body.kind;
  if (!["main", "unit"].includes(kind))
    return { error: "กรุณาเลือกว่าเป็นหน่วยงานหลักหรือหน่วยงานย่อย" };
  const value = {
    kind,
    name,
    description: text(body.description) || null,
    status,
    org_type: null,
    parent_id: null,
  };

  if (kind === "main") {
    const orgType =
      body.org_type === undefined && existing
        ? existing.org_type
        : body.org_type;
    if (!ORGANIZATION_TYPES.includes(orgType))
      return {
        error:
          "กรุณาเลือกประเภทของหน่วยงานหลัก (โรงพยาบาลหรือโรงเรียน) หน่วยงานย่อยภายใต้จะเป็นประเภทนี้",
      };
    value.org_type = orgType;
    return { value };
  }

  const requestedParent = parentIdOf(body, existing);
  if (requestedParent === null) {
    // Only a legacy unit that never had a parent may stay without one, and it
    // keeps a type of its own.
    if (!existing || existing.parent_id)
      return { error: "กรุณาเลือกหน่วยงานหลักของหน่วยงานย่อยนี้" };
    const orgType =
      body.org_type === undefined ? existing.org_type : body.org_type;
    if (!ORGANIZATION_TYPES.includes(orgType))
      return { error: "กรุณาเลือกประเภทหน่วยงาน (โรงพยาบาลหรือโรงเรียน)" };
    value.org_type = orgType;
    return { value };
  }
  if (!Number.isInteger(requestedParent) || requestedParent < 1)
    return { error: "หน่วยงานหลักไม่ถูกต้อง" };
  if (existing && requestedParent === Number(existing.id))
    return { error: "หน่วยงานไม่สามารถเป็นหน่วยงานหลักของตัวเองได้" };
  if (!parent || Number(parent.id) !== requestedParent)
    return { error: "ไม่พบหน่วยงานหลักที่เลือก" };
  if (!isMainOrganization(parent))
    return { error: "หน่วยงานย่อยต้องอยู่ภายใต้หน่วยงานหลักเท่านั้น" };
  if (
    parent.status !== "active" &&
    !(existing && Number(existing.parent_id) === Number(parent.id))
  )
    return { error: "หน่วยงานหลักที่เลือกถูกปิดใช้งาน" };
  if (!ORGANIZATION_TYPES.includes(parent.org_type))
    return {
      error:
        "หน่วยงานหลักที่เลือกยังไม่ได้กำหนดประเภท กรุณากำหนดประเภทของหน่วยงานหลักก่อน",
    };
  value.parent_id = requestedParent;
  value.org_type = parent.org_type; // inherited from the main organization
  return { value };
}

// Unique, positive user ids from a request ({ user_ids: [] } or { user_id }).
function memberUserIds(body = {}) {
  const raw = Array.isArray(body.user_ids) ? body.user_ids : [body.user_id];
  const ids = [...new Set(raw.map(Number))].filter(
    (id) => Number.isInteger(id) && id > 0,
  );
  return ids.length === raw.length && ids.length <= 200 ? ids : null;
}

module.exports = {
  ORGANIZATION_TYPES,
  isMainOrganization,
  planOrganizationWrite,
  memberUserIds,
};
