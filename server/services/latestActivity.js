// Metadata only: never read or disclose clinical notes in a case queue.
const { firstNameOf, lastNameOf } = require("../utils/caseFirstName");
const ACTIVITY_TITLES = {
  status: "อัปเดตสถานะเคส",
  note: "บันทึกการติดตาม",
  appoint: "บันทึกนัดหมาย",
};

function newestActivity(candidates) {
  return (
    candidates
      .filter(
        (item) => item && Number.isFinite(new Date(item.occurred_at).getTime()),
      )
      .sort(
        (a, b) =>
          new Date(b.occurred_at) - new Date(a.occurred_at) ||
          Number(b.id || 0) - Number(a.id || 0) ||
          String(a.type || "").localeCompare(String(b.type || "")),
      )[0] || null
  );
}

async function attachCaseActivities(db, responses) {
  if (!responses.length) return responses;
  const scopes = new Map();
  for (const row of responses) {
    const master = row.master_case_id;
    const key = `${row.organization_id}:${master ? "master" : "response"}:${master || row.id}`;
    scopes.set(key, { org: row.organization_id, master, id: row.id });
  }
  const values = [];
  const conditions = [...scopes.values()].map(({ org, master, id }) => {
    values.push(org, master || id);
    return `(fr.organization_id=? AND l.${master ? "master_case_id" : "response_id"}=?)`;
  });
  const [logs] = await db.query(
    `SELECT l.id,l.type,l.created_at,l.response_id,l.master_case_id,fr.organization_id
       FROM case_logs l JOIN form_responses fr ON fr.id=l.response_id
       LEFT JOIN mastercases mc ON mc.id=l.master_case_id AND mc.organization_id=fr.organization_id
      WHERE (${conditions.join(" OR ")})
        AND (l.master_case_id IS NULL OR (mc.id=fr.master_case_id))
        AND l.type IN ('status','note','appoint') ORDER BY l.created_at DESC,l.id DESC`,
    values,
  );
  const latest = new Map();
  for (const log of logs) {
    const key = `${log.organization_id}:${log.master_case_id ? "master" : "response"}:${log.master_case_id || log.response_id}`;
    if (!latest.has(key))
      latest.set(key, {
        type: log.type,
        title: ACTIVITY_TITLES[log.type],
        occurred_at: log.created_at,
      });
  }
  return responses.map((row) => {
    const recordedName =
      row.summary_data?.display_name || row.summary_data?.name;
    const accountName = row.submitted_by?.display_name;
    return {
      ...row,
      first_name: firstNameOf(recordedName) || firstNameOf(accountName),
      last_name: lastNameOf(recordedName) || lastNameOf(accountName),
      latest_activity:
        latest.get(
          `${row.organization_id}:${row.master_case_id ? "master" : "response"}:${row.master_case_id || row.id}`,
        ) || null,
    };
  });
}

async function schoolActivities(db, organizationId, students) {
  if (!students.length) return new Map();
  const [events] = await db.query(
    `SELECT s.id AS student_id,fr.id AS id,'assessment' AS type,f.title AS title,fr.submitted_at AS occurred_at
       FROM school_students s JOIN schools sch ON sch.id=s.school_id JOIN form_responses fr ON fr.organization_id=sch.organization_id
        AND ((s.person_id IS NOT NULL AND fr.person_id=s.person_id) OR (s.patient_account_id IS NOT NULL AND fr.patient_account_id=s.patient_account_id))
       JOIN forms f ON f.id=fr.form_id AND f.organization_id=fr.organization_id
      WHERE sch.organization_id=? AND s.id IN (?)
      UNION ALL
     SELECT s.id,r.id,'physical',CASE WHEN r.updated_at > r.created_at THEN 'แก้ไขผลตรวจร่างกาย' ELSE 'บันทึกผลตรวจร่างกาย' END,r.updated_at
       FROM school_students s JOIN schools sch ON sch.id=s.school_id JOIN school_student_physical_records r ON r.student_id=s.id
      WHERE sch.organization_id=? AND s.id IN (?)
      UNION ALL
     SELECT s.id,r.id,'referral','อัปเดตการส่งต่อ',r.updated_at
       FROM school_students s JOIN schools sch ON sch.id=s.school_id JOIN form_responses fr ON fr.organization_id=sch.organization_id
        AND ((s.person_id IS NOT NULL AND fr.person_id=s.person_id) OR (s.patient_account_id IS NOT NULL AND fr.patient_account_id=s.patient_account_id))
       JOIN case_referrals r ON r.source_response_id=fr.id AND r.source_organization_id=fr.organization_id
      WHERE sch.organization_id=? AND s.id IN (?)`,
    [
      organizationId,
      students.map((s) => s.id),
      organizationId,
      students.map((s) => s.id),
      organizationId,
      students.map((s) => s.id),
    ],
  );
  const grouped = new Map();
  for (const event of events) {
    const previous = grouped.get(event.student_id);
    const newest = newestActivity([previous, event]);
    if (newest) grouped.set(event.student_id, newest);
  }
  return new Map(
    [...grouped].map(([id, { type, title, occurred_at }]) => [
      id,
      { type, title, occurred_at },
    ]),
  );
}

module.exports = {
  ACTIVITY_TITLES,
  newestActivity,
  attachCaseActivities,
  schoolActivities,
};
