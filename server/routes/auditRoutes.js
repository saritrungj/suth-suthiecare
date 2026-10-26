// Change history of the active unit (roles page audit.view, CSV with
// audit.export). Rows hold who, what action, on what and when, plus the names
// of changed fields: never the values. Reads ("data.read") are left out unless
// asked for.
const express = require("express");
const db = require("../config/db");
const { verifyToken } = require("../middleware/authMiddleware");
const { requireAction } = require("../authorization/authorization");
const { readField } = require("../utils/privateField");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const PAGE_SIZES = [10, 20, 50, 100];
const CSV_LIMIT = 5000;

router.use(verifyToken, requireAction("audit.view"), (req, res, next) =>
  Number.isSafeInteger(req.organizationContext)
    ? next()
    : fail(res, 422, "กรุณาเลือกหน่วยงานหนึ่งแห่งเพื่อดูประวัติการแก้ไข"),
);

const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const READ_SQL = "(l.target_type='route' OR l.action LIKE '%.read')";

function filters(req) {
  const where = ["l.organization_id=?"],
    params = [req.organizationContext];
  if (req.query.include_reads !== "1") where.push(`NOT ${READ_SQL}`);
  if (/^\d+$/.test(String(req.query.actor || ""))) {
    where.push("l.actor_user_id=?");
    params.push(Number(req.query.actor));
  }
  if (/^[a-z_]+$/.test(String(req.query.area || ""))) {
    where.push("l.action LIKE ?");
    params.push(`${req.query.area}.%`);
  }
  if (validDate(req.query.from)) {
    where.push("l.created_at>=?");
    params.push(`${req.query.from} 00:00:00`);
  }
  if (validDate(req.query.to)) {
    where.push("l.created_at<DATE_ADD(?,INTERVAL 1 DAY)");
    params.push(req.query.to);
  }
  return { sql: where.join(" AND "), params };
}

const parse = (value) => {
  if (value == null) return {};
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return {};
  }
};
function rowView(row) {
  const before = parse(row.before_data),
    after = parse(row.after_data);
  const { fields: afterFields, ...details } = after;
  return {
    id: row.id,
    created_at: row.created_at_local,
    actor_user_id: row.actor_user_id,
    actor_name:
      readField(row.actor_name, "users", "name") ||
      row.actor_username ||
      "ระบบ",
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    student_code: row.student_code || null,
    result: row.result,
    reason: row.reason,
    fields: [...new Set([...(before.fields || []), ...(afterFields || [])])],
    details,
  };
}
const SELECT = `SELECT l.id,l.actor_user_id,l.action,l.target_type,l.target_id,l.result,l.reason,l.before_data,l.after_data,
    DATE_FORMAT(l.created_at,'%Y-%m-%dT%H:%i:%s') AS created_at_local,
    u.name AS actor_name,u.username AS actor_username,
    (SELECT ss.student_code FROM school_students ss JOIN schools s ON s.id=ss.school_id
      WHERE l.target_type='student' AND ss.id=l.target_id AND s.organization_id=l.organization_id LIMIT 1) AS student_code
  FROM authorization_audit_logs l LEFT JOIN users u ON u.id=l.actor_user_id`;

router.get("/actors", async (req, res) => {
  const [rows] = await db.query(
    `SELECT DISTINCT u.id,u.name,u.username FROM authorization_audit_logs l JOIN users u ON u.id=l.actor_user_id
      WHERE l.organization_id=? ORDER BY u.username LIMIT 300`,
    [req.organizationContext],
  );
  res.json({
    actors: rows.map((u) => ({
      id: u.id,
      name: readField(u.name, "users", "name") || u.username,
    })),
  });
});

const { csvCell } = require("../utils/csvCell");

router.get("/", async (req, res) => {
  const where = filters(req);
  if (req.query.format === "csv") {
    if (!(
      req.authorization?.isSystemAdmin ||
      req.authorization?.permissions?.has("audit.export")
    ))
      return fail(res, 403, "ไม่มีสิทธิ์ส่งออกประวัติการแก้ไข");
    const [rows] = await db.query(
      `${SELECT} WHERE ${where.sql} ORDER BY l.id DESC LIMIT ${CSV_LIMIT}`,
      where.params,
    );
    const lines = [
      [
        "เวลา",
        "ผู้ดำเนินการ",
        "การกระทำ",
        "ประเภทรายการ",
        "รหัสรายการ",
        "รหัสนักเรียน",
        "ผล",
        "ช่องที่เปลี่ยน",
      ]
        .map(csvCell)
        .join(","),
      ...rows
        .map(rowView)
        .map((r) =>
          [
            r.created_at,
            r.actor_name,
            r.action,
            r.target_type,
            r.target_id,
            r.student_code,
            r.result,
            r.fields.join(" "),
          ]
            .map(csvCell)
            .join(","),
        ),
    ];
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("ประวัติการแก้ไข.csv")}`,
      "Cache-Control": "no-store",
    });
    return res.send(`﻿${lines.join("\r\n")}`);
  }
  const limit = PAGE_SIZES.includes(Number(req.query.limit))
    ? Number(req.query.limit)
    : 10;
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const [[count]] = await db.query(
    `SELECT COUNT(*) AS n FROM authorization_audit_logs l WHERE ${where.sql}`,
    where.params,
  );
  const [rows] = await db.query(
    `${SELECT} WHERE ${where.sql} ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    [...where.params, limit, (page - 1) * limit],
  );
  res.set("Cache-Control", "no-store");
  res.json({
    data: rows.map(rowView),
    pagination: {
      total: Number(count.n),
      page,
      limit,
      total_pages: Math.max(1, Math.ceil(Number(count.n) / limit)),
    },
  });
});

module.exports = router;
module.exports.rowView = rowView;
module.exports.SELECT = SELECT;
module.exports.READ_SQL = READ_SQL;
