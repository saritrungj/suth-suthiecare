// The signed-in staff member's own school notifications. Each read re-checks
// the student scope, so a notification about a student the recipient no
// longer looks after (moved room, revoked duty) is hidden.
const express = require("express");
const db = require("../config/db");
const { canSeeStudent } = require("../utils/schoolAccess");
const { readPayload } = require("../services/schoolNotify");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const PAGE_SIZE = 10;
const LIMIT = 500;

router.use("/notifications", (req, res, next) =>
  req.schoolAccess ? next() : fail(res, 422, "กรุณาเลือกโรงเรียน"),
);

async function inbox(req, { unreadOnly = false, id = null } = {}) {
  const [rows] = await db.query(
    `SELECT n.id,n.school_id,n.student_id,n.kind,n.source_type,n.source_id,n.payload_encrypted,
        n.read_at,n.acknowledged_at,n.created_at,
        ss.school_id AS student_school_id,ss.classroom_id,ss.is_boarder,ss.archived_at
      FROM school_notifications n
      JOIN schools s ON s.id=n.school_id AND s.organization_id=?
      LEFT JOIN school_students ss ON ss.id=n.student_id
      WHERE n.recipient_user_id=?${unreadOnly ? " AND n.read_at IS NULL" : ""}${id ? " AND n.id=?" : ""}
      ORDER BY n.created_at DESC,n.id DESC LIMIT ${LIMIT}`,
    [req.organizationContext, req.user.id, ...(id ? [id] : [])],
  );
  return rows.filter(
    (row) =>
      row.student_id == null ||
      canSeeStudent(req.schoolAccess, {
        id: row.student_id,
        school_id: row.student_school_id,
        classroom_id: row.classroom_id,
        is_boarder: row.is_boarder,
        archived_at: row.archived_at,
      }),
  );
}

const view = (req, row) => ({
  id: row.id,
  kind: row.kind,
  student_id: row.student_id,
  source_type: row.source_type,
  source_id: row.source_id,
  payload: readPayload(row.payload_encrypted, req.organizationContext),
  read_at: row.read_at,
  acknowledged_at: row.acknowledged_at,
  created_at: row.created_at,
});

router.get("/notifications", async (req, res) => {
  const rows = await inbox(req, { unreadOnly: req.query.status === "unread" });
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  res.json({
    items: rows
      .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
      .map((row) => view(req, row)),
    total: rows.length,
    page,
    page_size: PAGE_SIZE,
  });
});

router.get("/notifications/unread-count", async (req, res) => {
  res.json({ count: (await inbox(req, { unreadOnly: true })).length });
});

router.put("/notifications/read-all", async (req, res) => {
  const ids = (await inbox(req, { unreadOnly: true })).map((row) => row.id);
  if (ids.length)
    await db.query(
      "UPDATE school_notifications SET read_at=NOW() WHERE recipient_user_id=? AND id IN (?) AND read_at IS NULL",
      [req.user.id, ids],
    );
  res.json({ updated: ids.length });
});

function mark(column) {
  return async (req, res) => {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isSafeInteger(id) || id < 1)
      return fail(res, 404, "ไม่พบการแจ้งเตือน");
    const [row] = await inbox(req, { id });
    if (!row) return fail(res, 404, "ไม่พบการแจ้งเตือน");
    // Acknowledging also marks the notification as read.
    await db.query(
      `UPDATE school_notifications SET ${column}=COALESCE(${column},NOW())${column === "acknowledged_at" ? ",read_at=COALESCE(read_at,NOW())" : ""} WHERE id=? AND recipient_user_id=?`,
      [id, req.user.id],
    );
    const [updated] = await inbox(req, { id });
    res.json(view(req, updated));
  };
}
router.put("/notifications/:id/read", mark("read_at"));
router.put("/notifications/:id/ack", mark("acknowledged_at"));

module.exports = router;
