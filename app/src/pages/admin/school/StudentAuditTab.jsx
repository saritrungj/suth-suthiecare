import { useEffect, useState } from "react";
import api from "../../../services/api";
import { TableScroll } from "./schoolUi";
import {
  auditActionLabel,
  auditTargetLabel,
  auditTime,
} from "../../../utils/auditLabels";

// "ประวัติการแก้ไข" tab of the student file: who changed this student's
// records and when. Field names only, never values.
export default function StudentAuditTab({ studentId }) {
  const [rows, setRows] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    api
      .get(`/school/students/${studentId}/audit`)
      .then(({ data }) => setRows(Array.isArray(data?.data) ? data.data : []))
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดประวัติการแก้ไขไม่สำเร็จ"),
      );
  }, [studentId]);
  return (
    <section className="sch-section">
      <h3>ประวัติการแก้ไข</h3>
      <p className="sch-muted">
        แสดงผู้แก้ไข เวลา และชื่อช่องที่เปลี่ยน ไม่แสดงค่าข้อมูล
      </p>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      {rows && !rows.length && (
        <p className="sch-muted">ยังไม่มีประวัติการแก้ไข</p>
      )}
      {rows?.length > 0 && (
        <TableScroll label="ประวัติการแก้ไขของนักเรียน">
          <table className="sch-table admin-data-table">
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ผู้ดำเนินการ</th>
                <th>การกระทำ</th>
                <th>รายการ</th>
                <th>ช่องที่เปลี่ยน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{auditTime(row.created_at)}</td>
                  <td>{row.actor_name}</td>
                  <td>{auditActionLabel(row.action)}</td>
                  <td>{auditTargetLabel(row)}</td>
                  <td>{row.fields.length ? row.fields.join(", ") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </section>
  );
}
