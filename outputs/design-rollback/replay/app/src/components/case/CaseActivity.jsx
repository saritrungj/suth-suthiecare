import { FiActivity, FiClock } from "react-icons/fi";
import { formatCaseDate, stripHtml } from "./caseDisplay";

export function responseActivity(row) {
  return (
    row.latest_activity || {
      type: row.case_source === "walkin" ? "walkin" : "assessment",
      title:
        row.case_source === "walkin"
          ? "บันทึกโดยเจ้าหน้าที่"
          : row.form_title || "ส่งแบบฟอร์มประเมิน",
      occurred_at: row.submitted_at || row.created_at || row.createdAt,
    }
  );
}

export function logActivity(logs, row) {
  const titles = {
    status: "อัปเดตสถานะเคส",
    note: "บันทึกการติดตาม",
    appoint: "บันทึกนัดหมาย",
  };
  const newest = [...logs]
    .filter(
      (log) =>
        titles[log.type] && Number.isFinite(new Date(log.created_at).getTime()),
    )
    .sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at) || b.id - a.id,
    )[0];
  return newest
    ? {
        type: newest.type,
        title: titles[newest.type],
        occurred_at: newest.created_at,
      }
    : responseActivity({ ...row, latest_activity: null });
}

export default function CaseActivity({
  activity,
  school = false,
  full = false,
}) {
  const title = stripHtml(activity?.title);
  const date = activity?.occurred_at
    ? formatCaseDate(activity.occurred_at)
    : "-";
  const caption = school
    ? "กิจกรรมสุขภาพล่าสุด"
    : ["assessment", "walkin"].includes(activity?.type)
      ? "ข้อมูลเข้าระบบล่าสุด"
      : "กิจกรรมล่าสุด";
  return (
    <div className={`cw-activity ${full ? "cw-activity--full" : ""}`}>
      <div className="cw-activity-detail">
        <span className="cw-activity-caption">
          <FiActivity aria-hidden="true" />
          {caption}
        </span>
        <span className="cw-activity-title">{title || "ยังไม่มีกิจกรรม"}</span>
        {date !== "-" && (
          <span className="cw-activity-date">
            <FiClock aria-hidden="true" />
            {date} น.
          </span>
        )}
      </div>
    </div>
  );
}
