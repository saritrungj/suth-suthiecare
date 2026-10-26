// Behaviour reports: a teacher reports what they noticed about a student in
// their scope, the people responsible follow it up. Rights come from the roles
// page (student_behavior.*), the student scope from schoolAccess. A reporter
// without "view" still sees their own reports and their status, never the
// follow-up notes.
const express = require("express");
const db = require("../config/db");
const { canSeeStudent } = require("../utils/schoolAccess");
const { readField } = require("../utils/privateField");
const { sealText, readJson, fieldContext } = require("../utils/privateData");
const { requiredAudit } = require("../utils/pdpaAudit");
const { notify, recipientsForStudent } = require("../services/schoolNotify");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });

const CATEGORIES = Object.freeze({
  learning: "การเรียน",
  attendance: "การมาเรียน",
  emotion: "อารมณ์และความรู้สึก",
  social: "ความสัมพันธ์กับเพื่อน",
  conduct: "ความประพฤติ",
  health: "สุขภาพ",
  other: "อื่น ๆ",
});
const LEVELS = Object.freeze({
  low: "เล็กน้อย",
  medium: "ควรติดตาม",
  high: "เร่งด่วน",
});
const STATUSES = Object.freeze({
  new: "ใหม่",
  acknowledged: "รับทราบแล้ว",
  following: "กำลังติดตาม",
  closed: "ปิดแล้ว",
  cancelled: "ยกเลิก",
});
const PAGE_SIZES = [10, 20, 50];
const context = (table, org) => fieldContext(table, "payload_encrypted", org);
const positiveId = (value) =>
  /^\d+$/.test(String(value)) && Number(value) > 0 ? Number(value) : null;
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

router.use("/behavior-reports", (req, res, next) =>
  req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);

const rights = (req) => {
  const a = req.schoolAccess;
  return Object.fromEntries(
    ["view", "create", "update", "delete", "assign", "export"].map((action) => [
      action,
      Boolean(a.isSystemAdmin || a.behavior?.[action]),
    ]),
  );
};

const REPORT_SELECT = `SELECT r.*, ss.student_code, ss.prefix, ss.first_name_encrypted, ss.last_name_encrypted,
    ss.classroom_id AS current_classroom_id, ss.is_boarder, ss.archived_at, ss.school_id AS student_school_id,
    c.name AS classroom_name, g.name AS grade_name, ru.name AS reporter_name, ru.username AS reporter_username,
    au.name AS assignee_name, au.username AS assignee_username
  FROM school_behavior_reports r
  JOIN school_students ss ON ss.id=r.student_id
  JOIN schools s ON s.id=r.school_id AND s.organization_id=?
  LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
  LEFT JOIN school_grade_levels g ON g.id=c.grade_level_id
  LEFT JOIN users ru ON ru.id=r.reported_by
  LEFT JOIN users au ON au.id=r.assigned_to`;

const studentOf = (row) => ({
  id: row.student_id,
  school_id: row.student_school_id,
  classroom_id: row.current_classroom_id,
  is_boarder: row.is_boarder,
  archived_at: row.archived_at,
});
const userName = (name, username) =>
  readField(name, "users", "name") || username || null;

// "full" = may read the details and follow-up; "own" = the reporter only.
function visibility(req, row) {
  if (rights(req).view && canSeeStudent(req.schoolAccess, studentOf(row)))
    return "full";
  if (Number(row.reported_by) === Number(req.user.id)) return "own";
  return null;
}

function view(req, row, level) {
  const org = req.organizationContext;
  const first = readField(
    row.first_name_encrypted,
    "school_students",
    "first_name_encrypted",
    org,
  );
  const last = readField(
    row.last_name_encrypted,
    "school_students",
    "last_name_encrypted",
    org,
  );
  const payload =
    row.payload_encrypted == null
      ? {}
      : readJson(
          row.payload_encrypted,
          context("school_behavior_reports", org),
        );
  return {
    id: row.id,
    student_id: row.student_id,
    student_code: row.student_code,
    student_name: [row.prefix, first, last].filter(Boolean).join(" ") || null,
    grade_name: row.grade_name,
    classroom_name: row.classroom_name,
    category: row.category,
    concern_level: row.concern_level,
    observed_on: row.observed_on,
    details: payload.details || "",
    status: row.status,
    reported_by: row.reported_by,
    reporter_name: userName(row.reporter_name, row.reporter_username),
    assigned_to: row.assigned_to,
    assignee_name: row.assigned_to
      ? userName(row.assignee_name, row.assignee_username)
      : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    access: level,
  };
}

async function loadReport(req, id, connection = db) {
  const [[row]] = await connection.query(`${REPORT_SELECT} WHERE r.id=?`, [
    req.organizationContext,
    positiveId(id) || 0,
  ]);
  return row || null;
}

// Staff who may be given the report: the room's homeroom teachers, the
// counselors covering the grade and the mental-health admins.
async function assignees(connection, studentId) {
  const ids = await recipientsForStudent(connection, studentId, {
    homeroom: true,
    counselors: true,
    mentalAdmins: true,
  });
  if (!ids.length) return [];
  const [rows] = await connection.query(
    "SELECT id,name,username FROM users WHERE id IN (?) ORDER BY username",
    [ids],
  );
  return rows.map((u) => ({ id: u.id, name: userName(u.name, u.username) }));
}

router.get("/behavior-reports/options", (req, res) => {
  res.json({
    categories: CATEGORIES,
    levels: LEVELS,
    statuses: STATUSES,
    actions: rights(req),
  });
});

router.get("/behavior-reports", async (req, res) => {
  const r = rights(req);
  if (!r.view && !r.create)
    return fail(res, 403, "ไม่มีสิทธิ์ดูรายงานพฤติกรรม");
  const where = [],
    params = [req.organizationContext];
  if (STATUSES[req.query.status]) {
    where.push("r.status=?");
    params.push(req.query.status);
  } else if (req.query.status === "open") {
    where.push("r.status IN ('new','acknowledged','following')");
  }
  if (LEVELS[req.query.concern_level]) {
    where.push("r.concern_level=?");
    params.push(req.query.concern_level);
  }
  if (positiveId(req.query.student_id)) {
    where.push("r.student_id=?");
    params.push(Number(req.query.student_id));
  }
  if (req.query.mine === "1") {
    where.push("r.reported_by=?");
    params.push(req.user.id);
  }
  const [rows] = await db.query(
    `${REPORT_SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY r.observed_on DESC,r.id DESC LIMIT 2000`,
    params,
  );
  const search = String(req.query.q || "")
    .trim()
    .toLocaleLowerCase();
  const visible = rows
    .map((row) => [row, visibility(req, row)])
    .filter(([, level]) => level)
    .map(([row, level]) => view(req, row, level))
    .filter(
      (item) =>
        !search ||
        `${item.student_code} ${item.student_name || ""} ${item.reporter_name || ""}`
          .toLocaleLowerCase()
          .includes(search),
    );
  if (req.query.format === "csv") {
    if (!r.export) return fail(res, 403, "ไม่มีสิทธิ์ส่งออกรายงานพฤติกรรม");
    await requiredAudit(req, "student_behavior.export", "school", null, {
      count: visible.length,
    });
    return require("../utils/sendCsv").sendCsv(
      res,
      "รายงานพฤติกรรม.csv",
      [
        "วันที่พบ",
        "รหัสนักเรียน",
        "ชื่อ",
        "ชั้น/ห้อง",
        "เรื่อง",
        "ระดับ",
        "สถานะ",
        "ผู้รายงาน",
        "ผู้รับผิดชอบ",
        "รายละเอียด",
      ],
      visible.map((v) => [
        String(
          v.observed_on instanceof Date
            ? v.observed_on.toLocaleDateString("sv-SE", {
                timeZone: "Asia/Bangkok",
              })
            : v.observed_on,
        ).slice(0, 10),
        v.student_code,
        v.student_name,
        [v.grade_name, v.classroom_name].filter(Boolean).join("/"),
        CATEGORIES[v.category] || v.category,
        LEVELS[v.concern_level] || v.concern_level,
        STATUSES[v.status] || v.status,
        v.reporter_name,
        v.assignee_name,
        v.details,
      ]),
    );
  }
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
  });
});

router.get("/behavior-reports/:id", async (req, res) => {
  const row = await loadReport(req, req.params.id);
  const level = row && visibility(req, row);
  if (!level) return fail(res, 404, "ไม่พบรายงานพฤติกรรม");
  const [updates] = await db.query(
    `SELECT u.id,u.status,u.payload_encrypted,u.created_by,u.created_at,cu.name,cu.username
       FROM school_behavior_updates u LEFT JOIN users cu ON cu.id=u.created_by
      WHERE u.report_id=? ORDER BY u.created_at,u.id`,
    [row.id],
  );
  const org = req.organizationContext;
  res.set("Cache-Control", "no-store");
  res.json({
    ...view(req, row, level),
    history: updates.map((u) => {
      const payload =
        u.payload_encrypted == null
          ? {}
          : readJson(
              u.payload_encrypted,
              context("school_behavior_updates", org),
            );
      return {
        id: u.id,
        status: u.status,
        // Follow-up notes stay with the people responsible.
        note: level === "full" ? payload.note || "" : "",
        assigned_to: level === "full" ? payload.assigned_to || null : null,
        by: userName(u.name, u.username),
        created_at: u.created_at,
      };
    }),
    assignees:
      level === "full" && rights(req).assign
        ? await assignees(db, row.student_id)
        : [],
  });
});

async function studentInScope(req, studentId) {
  const [[row]] = await db.query(
    `SELECT ss.id,ss.school_id,ss.classroom_id,ss.is_boarder,ss.archived_at,ss.student_code,c.name AS classroom_name
       FROM school_students ss JOIN schools s ON s.id=ss.school_id
       LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
      WHERE ss.id=? AND s.organization_id=? AND ss.archived_at IS NULL`,
    [positiveId(studentId) || 0, req.organizationContext],
  );
  return row && canSeeStudent(req.schoolAccess, row) ? row : null;
}

async function inTransaction(work) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

const addUpdate = (connection, req, reportId, status, payload) =>
  connection.query(
    "INSERT INTO school_behavior_updates (report_id,status,payload_encrypted,created_by) VALUES (?,?,?,?)",
    [
      reportId,
      status,
      payload
        ? sealText(
            payload,
            context("school_behavior_updates", req.organizationContext),
          )
        : null,
      req.user.id,
    ],
  );

router.post("/behavior-reports", async (req, res) => {
  if (!rights(req).create)
    return fail(res, 403, "ไม่มีสิทธิ์ส่งรายงานพฤติกรรม");
  const b = req.body || {};
  const details = typeof b.details === "string" ? b.details.trim() : "";
  if (
    !CATEGORIES[b.category] ||
    !LEVELS[b.concern_level] ||
    !validDate(b.observed_on) ||
    b.observed_on > today() ||
    !details ||
    details.length > 4000
  )
    return fail(
      res,
      422,
      "กรุณาระบุเรื่อง ระดับความกังวล วันที่พบ (ไม่เกินวันนี้) และรายละเอียด",
    );
  const student = await studentInScope(req, b.student_id);
  if (!student) return fail(res, 404, "ไม่พบนักเรียนในความรับผิดชอบ");
  const id = await inTransaction(async (connection) => {
    const [result] = await connection.query(
      `INSERT INTO school_behavior_reports (school_id,student_id,classroom_id,reported_by,category,concern_level,observed_on,payload_encrypted)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        student.school_id,
        student.id,
        student.classroom_id,
        req.user.id,
        b.category,
        b.concern_level,
        b.observed_on,
        sealText(
          { details },
          context("school_behavior_reports", req.organizationContext),
        ),
      ],
    );
    await addUpdate(connection, req, result.insertId, "new", null);
    // Only who, where and what kind: the details stay in the report.
    const recipients = (
      await recipientsForStudent(connection, student.id, {
        homeroom: true,
        counselors: true,
        mentalAdmins: b.concern_level === "high",
      })
    ).filter((userId) => userId !== Number(req.user.id));
    await notify(connection, {
      organizationId: req.organizationContext,
      schoolId: student.school_id,
      kind: "behavior_report",
      studentId: student.id,
      sourceType: "behavior_report",
      sourceId: result.insertId,
      recipients,
      payload: {
        title:
          b.concern_level === "high"
            ? "รายงานพฤติกรรมเร่งด่วน"
            : "รายงานพฤติกรรมใหม่",
        body: `${student.student_code} ห้อง ${student.classroom_name || "-"} · ${CATEGORIES[b.category]} · ${LEVELS[b.concern_level]}`,
      },
      dedupeKey: `behavior:${result.insertId}`,
    });
    await requiredAudit(
      req,
      "student_behavior.create",
      "student",
      student.id,
      { report_id: result.insertId },
      connection,
    );
    return result.insertId;
  });
  res.status(201).json({ id });
});

// Shared guard for actions on an existing report by the people responsible.
async function editable(req, res, action) {
  if (!rights(req)[action]) {
    fail(res, 403, "ไม่มีสิทธิ์ดำเนินการกับรายงานพฤติกรรม");
    return null;
  }
  const row = await loadReport(req, req.params.id);
  if (!row || !canSeeStudent(req.schoolAccess, studentOf(row))) {
    fail(res, 404, "ไม่พบรายงานพฤติกรรม");
    return null;
  }
  if (row.status === "cancelled") {
    fail(res, 409, "รายงานนี้ถูกยกเลิกแล้ว");
    return null;
  }
  return row;
}

router.put("/behavior-reports/:id/status", async (req, res) => {
  const row = await editable(req, res, "update");
  if (!row) return;
  const { status } = req.body || {};
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  if (!STATUSES[status] || status === "cancelled" || note.length > 4000)
    return fail(res, 422, "สถานะหรือบันทึกการติดตามไม่ถูกต้อง");
  await inTransaction(async (connection) => {
    await connection.query(
      "UPDATE school_behavior_reports SET status=? WHERE id=?",
      [status, row.id],
    );
    await addUpdate(connection, req, row.id, status, note ? { note } : null);
    await requiredAudit(
      req,
      "student_behavior.update",
      "student",
      row.student_id,
      { report_id: row.id, status },
      connection,
    );
  });
  res.json({ success: true });
});

router.put("/behavior-reports/:id/assign", async (req, res) => {
  const row = await editable(req, res, "assign");
  if (!row) return;
  const userId = positiveId(req.body?.assigned_to);
  if (!userId) return fail(res, 422, "กรุณาเลือกผู้รับผิดชอบ");
  try {
    await inTransaction(async (connection) => {
      if (
        !(await assignees(connection, row.student_id)).some(
          (u) => u.id === userId,
        )
      )
        throw Object.assign(
          new Error("ผู้รับผิดชอบต้องเป็นครูหรือผู้ดูแลของนักเรียนคนนี้"),
          {
            status: 422,
          },
        );
      await connection.query(
        "UPDATE school_behavior_reports SET assigned_to=? WHERE id=?",
        [userId, row.id],
      );
      const [update] = await addUpdate(connection, req, row.id, row.status, {
        assigned_to: userId,
      });
      await notify(connection, {
        organizationId: req.organizationContext,
        schoolId: row.school_id,
        kind: "behavior_report",
        studentId: row.student_id,
        sourceType: "behavior_report",
        sourceId: row.id,
        recipients: userId === Number(req.user.id) ? [] : [userId],
        payload: {
          title: "ได้รับมอบหมายให้ติดตามรายงานพฤติกรรม",
          body: `${row.student_code} · ${CATEGORIES[row.category] || row.category} · ${LEVELS[row.concern_level]}`,
        },
        dedupeKey: `behavior:${row.id}:assign:${update.insertId}`,
      });
      await requiredAudit(
        req,
        "student_behavior.assign",
        "student",
        row.student_id,
        { report_id: row.id, assigned_to: userId },
        connection,
      );
    });
  } catch (error) {
    if (error.status === 422) return fail(res, 422, error.message);
    throw error;
  }
  res.json({ success: true });
});

router.delete("/behavior-reports/:id", async (req, res) => {
  const row = await editable(req, res, "delete");
  if (!row) return;
  const note =
    typeof req.body?.note === "string"
      ? req.body.note.trim().slice(0, 4000)
      : "";
  await inTransaction(async (connection) => {
    await connection.query(
      "UPDATE school_behavior_reports SET status='cancelled' WHERE id=?",
      [row.id],
    );
    await addUpdate(
      connection,
      req,
      row.id,
      "cancelled",
      note ? { note } : null,
    );
    await requiredAudit(
      req,
      "student_behavior.delete",
      "student",
      row.student_id,
      { report_id: row.id },
      connection,
    );
  });
  res.json({ success: true });
});

module.exports = router;
module.exports.CATEGORIES = CATEGORIES;
module.exports.LEVELS = LEVELS;
module.exports.STATUSES = STATUSES;
