// Physical risk rules (school settings, roles-page school_workflows.* plus
// physical-health access) and the follow-up items they open (student health
// rights within the physical-health scope).
const express = require("express");
const db = require("../config/db");
const {
  canViewPhysicalHealth,
  canHealthAction,
} = require("../utils/schoolAccess");
const { readField } = require("../utils/privateField");
const { sealText } = require("../utils/privateData");
const { requiredAudit } = require("../utils/pdpaAudit");
const { recipientsForStudent } = require("../services/schoolNotify");
const {
  METRICS,
  COMPARATORS,
  validateRule,
  readFollowUp,
  followUpContext,
} = require("../services/physicalRisk");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const FOLLOW_UP_STATUSES = Object.freeze({
  open: "รอติดตาม",
  in_progress: "กำลังติดตาม",
  done: "ติดตามแล้ว",
  cancelled: "ยกเลิก",
});
const PAGE_SIZES = [10, 20, 50];

router.use(["/physical-risk-rules", "/follow-ups"], (req, res, next) =>
  req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);

// Rules are settings: workflow rights, and only for staff with physical scope.
const ruleRight = (req, action) =>
  req.schoolAccess.isSystemAdmin ||
  (Boolean(req.schoolAccess.workflows?.[action]) &&
    Boolean(req.schoolAccess.canPhysical));

async function schoolInUnit(req, schoolId) {
  const [[school]] = await db.query(
    "SELECT id FROM schools WHERE id=? AND organization_id=?",
    [positiveId(schoolId) || 0, req.organizationContext],
  );
  return school || null;
}

router.get("/physical-risk-rules", async (req, res) => {
  if (!ruleRight(req, "view"))
    return fail(res, 403, "ไม่มีสิทธิ์ดูเกณฑ์ภาวะเสี่ยงทางกาย");
  const school = await schoolInUnit(req, req.query.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const [rules] = await db.query(
    "SELECT * FROM school_physical_risk_rules WHERE school_id=? ORDER BY status='active' DESC,metric,id",
    [school.id],
  );
  res.json({ rules, metrics: METRICS, comparators: COMPARATORS });
});

router.post("/physical-risk-rules", async (req, res) => {
  if (!ruleRight(req, "create"))
    return fail(res, 403, "ไม่มีสิทธิ์เพิ่มเกณฑ์ภาวะเสี่ยงทางกาย");
  const school = await schoolInUnit(req, req.body?.school_id);
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  if (req.body?.approved !== true)
    return fail(
      res,
      422,
      "กรุณายืนยันว่าเกณฑ์นี้ผ่านการเห็นชอบจากผู้รับผิดชอบงานสุขภาพแล้ว",
    );
  const rule = validateRule(req.body);
  if (rule.error) return fail(res, 422, rule.error);
  const v = rule.value;
  const [result] = await db.query(
    `INSERT INTO school_physical_risk_rules (school_id,metric,comparator,threshold_low,threshold_high,age_min,age_max,sex,label,follow_up_days,status,created_by,approved_by,approved_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
    [
      school.id,
      v.metric,
      v.comparator,
      v.threshold_low,
      v.threshold_high,
      v.age_min,
      v.age_max,
      v.sex,
      v.label,
      v.follow_up_days,
      v.status,
      req.user.id,
      req.user.id,
    ],
  );
  await requiredAudit(
    req,
    "school.physical_rules.create",
    "school",
    school.id,
    {
      rule_id: result.insertId,
    },
  );
  res.status(201).json({ id: result.insertId });
});

router.put("/physical-risk-rules/:id", async (req, res) => {
  if (!ruleRight(req, "update"))
    return fail(res, 403, "ไม่มีสิทธิ์แก้ไขเกณฑ์ภาวะเสี่ยงทางกาย");
  const [[existing]] = await db.query(
    "SELECT r.id,r.school_id FROM school_physical_risk_rules r JOIN schools s ON s.id=r.school_id WHERE r.id=? AND s.organization_id=?",
    [positiveId(req.params.id) || 0, req.organizationContext],
  );
  if (!existing) return fail(res, 404, "ไม่พบเกณฑ์");
  if (req.body?.approved !== true)
    return fail(
      res,
      422,
      "กรุณายืนยันว่าเกณฑ์นี้ผ่านการเห็นชอบจากผู้รับผิดชอบงานสุขภาพแล้ว",
    );
  const rule = validateRule(req.body);
  if (rule.error) return fail(res, 422, rule.error);
  const v = rule.value;
  // A changed rule applies to records saved from now on; open items stay.
  await db.query(
    `UPDATE school_physical_risk_rules SET metric=?,comparator=?,threshold_low=?,threshold_high=?,age_min=?,age_max=?,sex=?,label=?,follow_up_days=?,status=?,approved_by=?,approved_at=NOW() WHERE id=?`,
    [
      v.metric,
      v.comparator,
      v.threshold_low,
      v.threshold_high,
      v.age_min,
      v.age_max,
      v.sex,
      v.label,
      v.follow_up_days,
      v.status,
      req.user.id,
      existing.id,
    ],
  );
  await requiredAudit(
    req,
    "school.physical_rules.update",
    "school",
    existing.school_id,
    { rule_id: existing.id, status: v.status },
  );
  res.json({ success: true });
});

// ── Follow-up items ─────────────────────────────────────────────────────
const ITEM_SELECT = `SELECT i.*, ss.student_code, ss.prefix, ss.first_name_encrypted, ss.last_name_encrypted,
    ss.school_id AS student_school_id, ss.classroom_id, ss.is_boarder, ss.archived_at,
    c.name AS classroom_name, g.name AS grade_name, au.name AS assignee_name, au.username AS assignee_username
  FROM school_follow_up_items i
  JOIN school_students ss ON ss.id=i.student_id
  JOIN schools s ON s.id=i.school_id AND s.organization_id=?
  LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
  LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id
  LEFT JOIN users au ON au.id=i.assigned_to
  WHERE i.domain='physical'`;
const studentOf = (row) => ({
  id: row.student_id,
  school_id: row.student_school_id,
  classroom_id: row.classroom_id,
  is_boarder: row.is_boarder,
  archived_at: row.archived_at,
});
function itemView(req, row) {
  const org = req.organizationContext;
  const name = (field) => readField(row[field], "school_students", field, org);
  const payload = readFollowUp(row.payload_encrypted, org);
  return {
    id: row.id,
    student_id: row.student_id,
    student_code: row.student_code,
    student_name:
      [row.prefix, name("first_name_encrypted"), name("last_name_encrypted")]
        .filter(Boolean)
        .join(" ") || null,
    grade_name: row.grade_name,
    classroom_name: row.classroom_name,
    rule_label: payload.rule_label || "",
    metric: payload.metric || null,
    value: payload.value ?? null,
    measured_at: payload.measured_at || null,
    result: payload.result || "",
    status: row.status,
    due_on: row.due_on,
    assigned_to: row.assigned_to,
    assignee_name: row.assigned_to
      ? readField(row.assignee_name, "users", "name") || row.assignee_username
      : null,
    created_at: row.created_at,
    closed_at: row.closed_at,
  };
}

router.get("/follow-ups", async (req, res) => {
  const where = [],
    params = [req.organizationContext];
  if (FOLLOW_UP_STATUSES[req.query.status]) {
    where.push("i.status=?");
    params.push(req.query.status);
  } else if (req.query.status === "active") {
    where.push("i.status IN ('open','in_progress')");
  }
  if (positiveId(req.query.student_id)) {
    where.push("i.student_id=?");
    params.push(Number(req.query.student_id));
  }
  if (req.query.overdue === "1")
    where.push("i.due_on < CURDATE() AND i.status IN ('open','in_progress')");
  const [rows] = await db.query(
    `${ITEM_SELECT}${where.map((w) => ` AND ${w}`).join("")} ORDER BY i.status IN ('open','in_progress') DESC, i.due_on IS NULL, i.due_on, i.id DESC LIMIT 2000`,
    params,
  );
  const search = String(req.query.q || "")
    .trim()
    .toLocaleLowerCase();
  const visible = rows
    .filter((row) => canViewPhysicalHealth(req.schoolAccess, studentOf(row)))
    .map((row) => itemView(req, row))
    .filter(
      (item) =>
        !search ||
        `${item.student_code} ${item.student_name || ""} ${item.rule_label}`
          .toLocaleLowerCase()
          .includes(search),
    );
  const limit = PAGE_SIZES.includes(Number(req.query.limit))
    ? Number(req.query.limit)
    : 10;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  res.set("Cache-Control", "no-store");
  res.json({
    data: visible.slice((page - 1) * limit, page * limit),
    pagination: {
      total: visible.length,
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(visible.length / limit)),
    },
    statuses: FOLLOW_UP_STATUSES,
    metrics: METRICS,
    can_update: Boolean(
      req.schoolAccess.isSystemAdmin || req.schoolAccess.health?.update,
    ),
  });
});

async function loadItem(req) {
  const [[row]] = await db.query(`${ITEM_SELECT} AND i.id=?`, [
    req.organizationContext,
    positiveId(req.params.id) || 0,
  ]);
  return row && canViewPhysicalHealth(req.schoolAccess, studentOf(row))
    ? row
    : null;
}

const assignees = async (studentId) => {
  const ids = await recipientsForStudent(db, studentId, {
    homeroom: true,
    physicalAdmins: true,
  });
  if (!ids.length) return [];
  const [users] = await db.query(
    "SELECT id,name,username FROM users WHERE id IN (?) ORDER BY username",
    [ids],
  );
  return users.map((u) => ({
    id: u.id,
    name: readField(u.name, "users", "name") || u.username,
  }));
};

router.get("/follow-ups/:id", async (req, res) => {
  const row = await loadItem(req);
  if (!row) return fail(res, 404, "ไม่พบรายการติดตาม");
  res.set("Cache-Control", "no-store");
  res.json({
    ...itemView(req, row),
    assignees: await assignees(row.student_id),
  });
});

router.put("/follow-ups/:id", async (req, res) => {
  const row = await loadItem(req);
  if (!row) return fail(res, 404, "ไม่พบรายการติดตาม");
  if (!canHealthAction(req.schoolAccess, "update", studentOf(row), true))
    return fail(res, 403, "ไม่มีสิทธิ์บันทึกการติดตามสุขภาพกาย");
  const b = req.body || {};
  const result = typeof b.result === "string" ? b.result.trim() : "";
  const assignedTo =
    b.assigned_to === null || b.assigned_to === ""
      ? null
      : positiveId(b.assigned_to);
  if (
    !FOLLOW_UP_STATUSES[b.status] ||
    result.length > 4000 ||
    (b.assigned_to && !assignedTo) ||
    (b.due_on &&
      !(typeof b.due_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.due_on)))
  )
    return fail(res, 422, "ข้อมูลการติดตามไม่ถูกต้อง");
  if (
    assignedTo &&
    !(await assignees(row.student_id)).some((u) => u.id === assignedTo)
  )
    return fail(
      res,
      422,
      "ผู้รับผิดชอบต้องเป็นครูประจำชั้นหรือผู้ดูแลสุขภาพกายของนักเรียนคนนี้",
    );
  const payload = {
    ...readFollowUp(row.payload_encrypted, req.organizationContext),
    result,
  };
  const closing = ["done", "cancelled"].includes(b.status);
  await db.query(
    `UPDATE school_follow_up_items SET status=?,assigned_to=?,due_on=?,payload_encrypted=?,closed_at=${closing ? "COALESCE(closed_at,NOW())" : "NULL"} WHERE id=?`,
    [
      b.status,
      assignedTo,
      b.due_on || row.due_on || null,
      sealText(payload, followUpContext(req.organizationContext)),
      row.id,
    ],
  );
  await requiredAudit(
    req,
    "student_health.follow_up.update",
    "student",
    row.student_id,
    {
      follow_up_id: row.id,
      status: b.status,
    },
  );
  res.json({ success: true });
});

module.exports = router;
