// School overview report: counts only, never a student row. Needs the roles
// page dashboard.view (CSV with dashboard.export). Staff with a school duty or
// classroom get their own students; staff without one (e.g. หัวหน้างาน) get the
// whole school. Viewers who cannot see student lists get small counts (1–4)
// suppressed, so a figure never points at one child.
const express = require("express");
const db = require("../config/db");
const { studentScopeClause } = require("../utils/schoolAccess");
const { responseRisk } = require("../utils/schoolWorkflows");
const { csvCell } = require("../utils/csvCell");
const { inRoundTarget } = require("../services/schoolRescreen");
const router = express.Router();
const fail = (res, status, message) => res.status(status).json({ message });
const SMALL = 5;
const LEVELS = ["high", "medium", "normal"];

const can = (req, key) =>
  Boolean(
    req.authorization?.isSystemAdmin ||
    req.authorization?.permissions?.has(key),
  );
const validDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const dateOnly = (v) =>
  v instanceof Date
    ? v.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" })
    : String(v || "").slice(0, 10);
const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });

router.get("/reports/overview", async (req, res) => {
  const access = req.schoolAccess;
  if (!access) return fail(res, 422, "กรุณาเลือกโรงเรียน");
  if (!can(req, "dashboard.view"))
    return fail(res, 403, "ไม่มีสิทธิ์ดูรายงานภาพรวม");
  const csv = req.query.format === "csv";
  if (csv && !can(req, "dashboard.export"))
    return fail(res, 403, "ไม่มีสิทธิ์ส่งออกรายงาน");
  const [[school]] = await db.query(
    "SELECT id,name FROM schools WHERE id=? AND organization_id=?",
    [
      /^\d+$/.test(String(req.query.school_id))
        ? Number(req.query.school_id)
        : 0,
      req.organizationContext,
    ],
  );
  if (!school) return fail(res, 404, "ไม่พบโรงเรียน");
  const unitWide = access.isSystemAdmin || !access.hasSchoolRole;
  const scope = unitWide
    ? { sql: "", params: [] }
    : studentScopeClause(access, "ss");
  const aggregateOnly = !access.isSystemAdmin && !access.canViewStudents;
  const shown = (n) => (aggregateOnly && n > 0 && n < SMALL ? null : n);

  const [students] = await db.query(
    `SELECT ss.id,ss.person_id,ss.patient_account_id,ss.classroom_id,c.grade_level_id FROM school_students ss
      LEFT JOIN school_classrooms c ON c.id=ss.classroom_id
      WHERE ss.school_id=? AND ss.archived_at IS NULL AND ss.status='active'${scope.sql}`,
    [school.id, ...scope.params],
  );
  const ids = students.map((s) => s.id);
  const none = [0];

  // Risk by screening round (latest response of each student inside the
  // round), or by month for the last six months when the school has no rounds.
  const [rounds] = await db.query(
    `SELECT id,name,form_id,starts_on,ends_on FROM school_screening_rounds
      WHERE school_id=? AND health_domain='mental' ORDER BY starts_on DESC,id DESC LIMIT 8`,
    [school.id],
  );
  // A round limited to some grade levels or classrooms counts only those
  // students (same rule as the student's page and the progress page).
  const [roundGrades] = rounds.length
    ? await db.query(
        "SELECT round_id,grade_level_id FROM school_screening_round_grades WHERE round_id IN (?)",
        [rounds.map((r) => r.id)],
      )
    : [[]];
  const [roundClassrooms] = rounds.length
    ? await db.query(
        "SELECT round_id,classroom_id FROM school_screening_round_classrooms WHERE round_id IN (?)",
        [rounds.map((r) => r.id)],
      )
    : [[]];
  let periods = rounds.reverse().map((r) => {
    const target = {
      grades: roundGrades
        .filter((g) => g.round_id === r.id)
        .map((g) => g.grade_level_id),
      classrooms: roundClassrooms
        .filter((c) => c.round_id === r.id)
        .map((c) => c.classroom_id),
    };
    return {
      key: `round-${r.id}`,
      label: r.name,
      from: dateOnly(r.starts_on),
      to: dateOnly(r.ends_on),
      form_id: r.form_id,
      members:
        target.grades.length || target.classrooms.length
          ? new Set(
              students.filter((s) => inRoundTarget(target, s)).map((s) => s.id),
            )
          : null,
    };
  });
  if (!periods.length) {
    const now = new Date(`${today()}T00:00:00Z`);
    periods = Array.from({ length: 6 }, (_, i) => {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - i), 1),
      );
      const end = new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
      );
      return {
        key: `month-${start.toISOString().slice(0, 7)}`,
        label: start.toLocaleDateString("th-TH", {
          month: "short",
          year: "2-digit",
          timeZone: "UTC",
        }),
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      };
    });
  }
  let responses = [];
  if (ids.length)
    [responses] = await db.query(
      `SELECT ss.id AS student_id,fr.id,fr.form_id,fr.organization_id,fr.summary_data,DATE(fr.submitted_at) AS day,fr.submitted_at
         FROM school_students ss
         JOIN form_responses fr ON fr.person_id=ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id=ss.patient_account_id)
         JOIN forms f ON f.id=fr.form_id
        WHERE ss.id IN (?) AND fr.organization_id=? AND f.health_domain='mental'
          AND DATE(fr.submitted_at) BETWEEN ? AND ?
        ORDER BY fr.submitted_at DESC,fr.id DESC`,
      [ids, req.organizationContext, periods[0].from, periods.at(-1).to],
    );
  const trend = periods.map((p) => {
    const latest = new Map();
    for (const r of responses) {
      const day = dateOnly(r.day);
      if (day < p.from || day > p.to || (p.form_id && r.form_id !== p.form_id))
        continue;
      if (p.members && !p.members.has(r.student_id)) continue;
      if (!latest.has(r.student_id)) latest.set(r.student_id, r);
    }
    const counts = { high: 0, medium: 0, normal: 0 };
    for (const r of latest.values()) {
      const risk = responseRisk(r);
      counts[LEVELS.includes(risk) ? risk : "normal"] += 1;
    }
    const row = {
      key: p.key,
      label: p.label,
      from: p.from,
      to: p.to,
      high: shown(counts.high),
      medium: shown(counts.medium),
      normal: shown(counts.normal),
      assessed: latest.size,
      not_assessed: Math.max(
        0,
        (p.members ? p.members.size : ids.length) - latest.size,
      ),
    };
    // A hidden count must not be recoverable by subtraction from the totals.
    if (LEVELS.some((level) => row[level] === null)) {
      row.assessed = null;
      row.not_assessed = null;
    }
    return row;
  });

  // Follow-up status across the care features, counts only.
  const count = async (sql, params) =>
    Number((await db.query(sql, params))[0][0].n);
  const inIds = ids.length ? ids : none;
  const from = validDate(req.query.from) ? req.query.from : null;
  const to = validDate(req.query.to) ? req.query.to : null;
  // Optional date window on a fixed column expression, as bound parameters.
  const WHEN = "DATE(COALESCE(sl.starts_at,a.updated_at))";
  const windowSql = `${from ? ` AND ${WHEN}>=?` : ""}${to ? ` AND ${WHEN}<=?` : ""}`;
  const windowParams = [...(from ? [from] : []), ...(to ? [to] : [])];
  const [behaviorRows] = await db.query(
    "SELECT status,COUNT(*) AS n FROM school_behavior_reports WHERE student_id IN (?) AND status<>'cancelled' GROUP BY status",
    [inIds],
  );
  const behavior = Object.fromEntries(
    ["new", "acknowledged", "following", "closed"].map((s) => [s, 0]),
  );
  for (const r of behaviorRows) behavior[r.status] = Number(r.n);
  const followUps = {
    open: await count(
      "SELECT COUNT(*) AS n FROM school_follow_up_items WHERE student_id IN (?) AND status IN ('open','in_progress')",
      [inIds],
    ),
    overdue: await count(
      "SELECT COUNT(*) AS n FROM school_follow_up_items WHERE student_id IN (?) AND status IN ('open','in_progress') AND due_on<CURDATE()",
      [inIds],
    ),
    done: await count(
      "SELECT COUNT(*) AS n FROM school_follow_up_items WHERE student_id IN (?) AND status='done'",
      [inIds],
    ),
  };
  const rescreen = {
    pending: await count(
      "SELECT COUNT(*) AS n FROM school_rescreen_tasks WHERE student_id IN (?) AND status='pending'",
      [inIds],
    ),
    overdue: await count(
      "SELECT COUNT(*) AS n FROM school_rescreen_tasks WHERE student_id IN (?) AND status='pending' AND due_on<CURDATE()",
      [inIds],
    ),
    completed: await count(
      "SELECT COUNT(*) AS n FROM school_rescreen_tasks WHERE student_id IN (?) AND status='completed'",
      [inIds],
    ),
  };
  const guidance = {
    overdue: await count(
      `SELECT COUNT(DISTINCT g.student_id) AS n FROM school_guidance_records g
        WHERE g.student_id IN (?) AND g.follow_up_at<CURDATE()
          AND NOT EXISTS (SELECT 1 FROM school_guidance_records later WHERE later.student_id=g.student_id AND later.recorded_at>=g.follow_up_at)`,
      [inIds],
    ),
  };
  const [referralRows] = await db.query(
    `SELECT r.status,COUNT(*) AS n FROM case_referrals r JOIN form_responses fr ON fr.id=r.source_response_id
      JOIN school_students ss ON (fr.person_id=ss.person_id OR (fr.person_id IS NULL AND fr.patient_account_id=ss.patient_account_id))
     WHERE r.source_organization_id=? AND ss.id IN (?) GROUP BY r.status`,
    [req.organizationContext, inIds],
  );
  const referrals = Object.fromEntries(
    [
      "pending",
      "accepted",
      "in_progress",
      "completed",
      "rejected",
      "cancelled",
    ].map((s) => [s, 0]),
  );
  for (const r of referralRows) referrals[r.status] = Number(r.n);
  const appointments = {
    upcoming: await count(
      `SELECT COUNT(*) AS n FROM school_appointments a JOIN school_appointment_slots sl ON sl.id=a.slot_id
        WHERE a.student_id IN (?) AND a.status IN ('requested','confirmed','rescheduled') AND sl.starts_at>NOW()`,
      [inIds],
    ),
    completed: await count(
      `SELECT COUNT(*) AS n FROM school_appointments a LEFT JOIN school_appointment_slots sl ON sl.id=a.slot_id
        WHERE a.student_id IN (?) AND a.status='completed'${windowSql}`,
      [inIds, ...windowParams],
    ),
    no_show: await count(
      `SELECT COUNT(*) AS n FROM school_appointments a LEFT JOIN school_appointment_slots sl ON sl.id=a.slot_id
        WHERE a.student_id IN (?) AND a.status='no_show'${windowSql}`,
      [inIds, ...windowParams],
    ),
  };
  const mask = (group) =>
    Object.fromEntries(Object.entries(group).map(([k, v]) => [k, shown(v)]));
  const report = {
    school: { id: school.id, name: school.name },
    population: ids.length,
    scope: unitWide ? "school" : "mine",
    suppressed_below: aggregateOnly ? SMALL : null,
    trend_basis: rounds.length ? "rounds" : "months",
    trend,
    // Groups are combined before masking, so a hidden count is never added
    // to a visible one later.
    follow_up: {
      behavior: mask({
        new: behavior.new,
        following: behavior.acknowledged + behavior.following,
        closed: behavior.closed,
      }),
      physical: mask(followUps),
      rescreen: mask(rescreen),
      guidance: mask(guidance),
      referrals: mask({
        pending: referrals.pending,
        in_progress: referrals.accepted + referrals.in_progress,
        completed: referrals.completed,
      }),
      appointments: mask(appointments),
    },
  };
  res.set("Cache-Control", "no-store");
  if (!csv) return res.json(report);
  const value = (v) => (v === null ? `<${SMALL}` : v);
  const lines = [
    ["หมวด", "รายการ", "จำนวน"].map(csvCell).join(","),
    ...trend.flatMap((t) =>
      [
        ["ความเสี่ยง " + t.label, "เสี่ยงสูง", value(t.high)],
        ["ความเสี่ยง " + t.label, "เฝ้าระวัง", value(t.medium)],
        ["ความเสี่ยง " + t.label, "ปกติ", value(t.normal)],
        ["ความเสี่ยง " + t.label, "ยังไม่ได้ประเมิน", value(t.not_assessed)],
      ].map((row) => row.map(csvCell).join(",")),
    ),
    ...Object.entries(report.follow_up).flatMap(([group, values]) =>
      Object.entries(values).map(([k, v]) =>
        [group, k, value(v)].map(csvCell).join(","),
      ),
    ),
  ];
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("รายงานภาพรวม.csv")}`,
  });
  res.send(`﻿${lines.join("\r\n")}`);
});

module.exports = router;
module.exports.SMALL = SMALL;
