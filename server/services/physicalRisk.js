// School-defined physical risk rules ("BMI over X for ages 12-15") checked
// when a physical record is saved. A match opens one follow-up item per
// student and rule until it is closed. No rule is seeded: thresholds are a
// clinical decision each school approves itself.
const { sealText, readJson, fieldContext } = require("../utils/privateData");
const { notify, recipientsForStudent } = require("./schoolNotify");

const METRICS = Object.freeze({
  bmi: "ดัชนีมวลกาย (BMI)",
  weight_kg: "น้ำหนัก (กก.)",
  height_cm: "ส่วนสูง (ซม.)",
  systolic: "ความดันตัวบน (มม.ปรอท)",
  diastolic: "ความดันตัวล่าง (มม.ปรอท)",
  pulse: "ชีพจร (ครั้ง/นาที)",
});
const COMPARATORS = Object.freeze({
  lt: "ต่ำกว่า",
  lte: "ไม่เกิน",
  gt: "สูงกว่า",
  gte: "ตั้งแต่",
  outside: "อยู่นอกช่วง",
});
const context = (org) =>
  fieldContext("school_follow_up_items", "payload_encrypted", org);

const number = (value) =>
  value === null || value === undefined || value === ""
    ? null
    : Number.isFinite(Number(value))
      ? Number(value)
      : NaN;

// lt/lte compare with threshold_low, gt/gte with threshold_high, outside with both.
function validateRule(body = {}) {
  const value = {
    metric: body.metric,
    comparator: body.comparator,
    threshold_low: number(body.threshold_low),
    threshold_high: number(body.threshold_high),
    age_min: number(body.age_min),
    age_max: number(body.age_max),
    sex: body.sex || null,
    label: typeof body.label === "string" ? body.label.trim() : "",
    follow_up_days: number(body.follow_up_days),
    status: body.status === "inactive" ? "inactive" : "active",
  };
  const bad = (message) => ({ error: message });
  if (!METRICS[value.metric] || !COMPARATORS[value.comparator])
    return bad("กรุณาเลือกค่าที่ตรวจและเงื่อนไข");
  if (
    [
      value.threshold_low,
      value.threshold_high,
      value.age_min,
      value.age_max,
      value.follow_up_days,
    ].some(Number.isNaN)
  )
    return bad("ตัวเลขในเกณฑ์ไม่ถูกต้อง");
  const needsLow = ["lt", "lte", "outside"].includes(value.comparator),
    needsHigh = ["gt", "gte", "outside"].includes(value.comparator);
  if (
    (needsLow && value.threshold_low === null) ||
    (needsHigh && value.threshold_high === null)
  )
    return bad("กรุณาระบุค่าเกณฑ์ให้ครบตามเงื่อนไข");
  if (!needsLow) value.threshold_low = null;
  if (!needsHigh) value.threshold_high = null;
  if (
    value.comparator === "outside" &&
    value.threshold_low >= value.threshold_high
  )
    return bad("ค่าต่ำสุดของช่วงต้องน้อยกว่าค่าสูงสุด");
  if (
    [value.threshold_low, value.threshold_high].some(
      (v) => v !== null && (v < 0 || v > 999),
    )
  )
    return bad("ค่าเกณฑ์ต้องอยู่ระหว่าง 0–999");
  if (
    [value.age_min, value.age_max].some(
      (v) => v !== null && (!Number.isInteger(v) || v < 0 || v > 30),
    ) ||
    (value.age_min !== null &&
      value.age_max !== null &&
      value.age_min > value.age_max)
  )
    return bad("ช่วงอายุไม่ถูกต้อง");
  if (value.sex !== null && !["male", "female"].includes(value.sex))
    return bad("เพศในเกณฑ์ไม่ถูกต้อง");
  if (!value.label || value.label.length > 160)
    return bad("กรุณาตั้งชื่อเกณฑ์ (ไม่เกิน 160 ตัวอักษร)");
  if (
    value.follow_up_days !== null &&
    (!Number.isInteger(value.follow_up_days) ||
      value.follow_up_days < 1 ||
      value.follow_up_days > 365)
  )
    return bad("ระยะเวลาติดตามต้องเป็น 1–365 วัน");
  return { value };
}

function ruleMatches(rule, measured) {
  const value = Number(measured);
  if (measured === null || measured === undefined || !Number.isFinite(value))
    return false;
  const low = rule.threshold_low === null ? null : Number(rule.threshold_low),
    high = rule.threshold_high === null ? null : Number(rule.threshold_high);
  switch (rule.comparator) {
    case "lt":
      return value < low;
    case "lte":
      return value <= low;
    case "gt":
      return value > high;
    case "gte":
      return value >= high;
    case "outside":
      return value < low || value > high;
    default:
      return false;
  }
}

// Whole years on the measurement date; null when the birth date is unknown.
function ageOn(birthDate, date) {
  const born = new Date(`${String(birthDate || "").slice(0, 10)}T00:00:00Z`),
    on = new Date(`${String(date || "").slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(born.getTime()) || Number.isNaN(on.getTime())) return null;
  let years = on.getUTCFullYear() - born.getUTCFullYear();
  if (
    on.getUTCMonth() < born.getUTCMonth() ||
    (on.getUTCMonth() === born.getUTCMonth() &&
      on.getUTCDate() < born.getUTCDate())
  )
    years -= 1;
  return years >= 0 ? years : null;
}

function applies(rule, student, measuredAt) {
  if (rule.sex && rule.sex !== student.gender) return false;
  if (rule.age_min === null && rule.age_max === null) return true;
  const age = ageOn(student.birth_date, measuredAt);
  if (age === null) return false;
  return (
    (rule.age_min === null || age >= Number(rule.age_min)) &&
    (rule.age_max === null || age <= Number(rule.age_max))
  );
}

const addDays = (date, days) => {
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
};

// Runs inside the caller's transaction after a physical record is saved.
// Returns the number of follow-up items opened.
async function evaluatePhysicalRecord(
  connection,
  { organizationId, student, values, measuredAt, actorId },
) {
  const [rules] = await connection.query(
    "SELECT * FROM school_physical_risk_rules WHERE school_id=? AND status='active' AND approved_at IS NOT NULL",
    [student.school_id],
  );
  const matched = rules.filter(
    (rule) =>
      applies(rule, student, measuredAt) &&
      ruleMatches(rule, values[rule.metric]),
  );
  let opened = 0;
  const labels = [];
  for (const rule of matched) {
    const [[open]] = await connection.query(
      "SELECT id FROM school_follow_up_items WHERE student_id=? AND source_type='physical_rule' AND source_id=? AND status IN ('open','in_progress') LIMIT 1 FOR UPDATE",
      [student.id, rule.id],
    );
    if (open) continue;
    await connection.query(
      `INSERT INTO school_follow_up_items (school_id,student_id,domain,source_type,source_id,due_on,payload_encrypted,created_by)
       VALUES (?,?,'physical','physical_rule',?,?,?,?)`,
      [
        student.school_id,
        student.id,
        rule.id,
        rule.follow_up_days ? addDays(measuredAt, rule.follow_up_days) : null,
        sealText(
          {
            rule_label: rule.label,
            metric: rule.metric,
            value: Number(values[rule.metric]),
            measured_at: String(measuredAt).slice(0, 10),
          },
          context(organizationId),
        ),
        actorId || null,
      ],
    );
    opened += 1;
    labels.push(rule.label);
  }
  if (opened) {
    const recipients = (
      await recipientsForStudent(connection, student.id, {
        homeroom: true,
        physicalAdmins: true,
      })
    ).filter((id) => id !== Number(actorId));
    await notify(connection, {
      organizationId,
      schoolId: student.school_id,
      kind: "follow_up",
      studentId: student.id,
      sourceType: "physical_record",
      recipients,
      payload: {
        title: "พบภาวะเสี่ยงทางกายที่ต้องติดตาม",
        body: `${student.student_code} ห้อง ${student.classroom_name || "-"} · ${labels.join(", ")}`,
      },
      dedupeKey:
        `physical:${student.id}:${String(measuredAt).slice(0, 10)}:${labels.join("|")}`.slice(
          0,
          120,
        ),
    });
  }
  return opened;
}

const readFollowUp = (value, org) =>
  value == null ? {} : readJson(value, context(org));

module.exports = {
  METRICS,
  COMPARATORS,
  validateRule,
  ruleMatches,
  ageOn,
  applies,
  evaluatePhysicalRecord,
  readFollowUp,
  followUpContext: context,
};
