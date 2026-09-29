import { useEffect, useState } from "react";
import {
  createAgencyRecord,
  getAgencyRecord,
  getAgencyRecords,
  reviewAgencyRecord,
} from "../../services/api";
import "./AgencyEntry.css";
import "./AgencyRecords.css";
import { usePermissions } from "../../permissions/PermissionsProvider";

const labels = {
  pending: "รอตรวจสอบ",
  verified: "ยืนยันแล้ว",
  rejected: "ไม่ผ่าน",
};
const fallbackFieldLabels = {
  employee_id: "รหัสพนักงาน",
  first_name: "ชื่อ",
  last_name: "นามสกุล",
  department: "แผนก",
  phone: "เบอร์ติดต่อ",
  email: "อีเมล",
  checkup_date: "วันที่เริ่มตรวจสุขภาพ",
  checkup_end_date: "วันที่สิ้นสุดตรวจสุขภาพ",
};
const entryMethodLabels = {
  import: "นำเข้าจากไฟล์",
  single: "บันทึกทีละรายการ",
};
const fieldLabel = (fields, key) =>
  fields?.find((field) => field.id === key)?.label ||
  fallbackFieldLabels[key] ||
  key.replace(/[_-]+/g, " ");
export default function AgencyRecords() {
  const { can } = usePermissions();
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const load = () =>
    getAgencyRecords({ status: status || undefined })
      .then((response) => setRecords(response.data || []))
      .catch(() => setMessage("ไม่สามารถโหลดรายการได้"));
  useEffect(() => {
    load();
  }, [status]);
  const open = async (id) => {
    try {
      setSelected((await getAgencyRecord(id)).data);
      setNote("");
    } catch {
      setMessage("ไม่สามารถโหลดรายละเอียดได้");
    }
  };
  const review = async (decision) => {
    setIsSaving(true);
    try {
      await reviewAgencyRecord(selected.id, { decision, note });
      setMessage("บันทึกผลการตรวจสอบแล้ว");
      setSelected(null);
      load();
    } catch (error) {
      setMessage(error.response?.data?.message || "ไม่สามารถบันทึกผลได้");
    } finally {
      setIsSaving(false);
    }
  };
  const replacement = async () => {
    const revision = selected.revisions?.[0];
    setIsSaving(true);
    try {
      const response = await createAgencyRecord({
        master_id: selected.master_id,
        source_record_id: selected.source_record_id,
        data: revision.data || {},
        replaces_revision_id: revision.id,
      });
      setMessage(
        `สร้างรายการแก้ไขแล้ว · เลขที่รายการ ${response.data.recordId}`,
      );
      setSelected(null);
      load();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "ไม่สามารถสร้างรายการแก้ไขได้",
      );
    } finally {
      setIsSaving(false);
    }
  };
  const currentRevision = selected?.revisions?.[0];
  return (
    <main className="agency-page agency-records-page">
      <header className="agency-page-header">
        <div>
          <p className="agency-eyebrow">AGENCY DATA</p>
          <h1>ตรวจสอบข้อมูล</h1>
          <p>
            ดูและตรวจสอบรายการจาก Master data ของ Agency
            ภายในขอบเขตที่ได้รับสิทธิ์
          </p>
        </div>
      </header>
      {message && (
        <p className="agency-notice" role="status">
          {message}
        </p>
      )}
      <section className="agency-workspace">
        <div className="agency-toolbar">
          <label>
            สถานะรายการ
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">ทั้งหมด</option>
              <option value="pending">รอตรวจสอบ</option>
              <option value="verified">ยืนยันแล้ว</option>
              <option value="rejected">ไม่ผ่าน</option>
            </select>
          </label>
          <span className="agency-selection">{records.length} รายการ</span>
        </div>
        <div className="agency-table-wrap agency-record-list">
          <table className="agency-table">
            <thead>
              <tr>
                <th>Source ID</th>
                <th>Master data</th>
                <th>สถานะ</th>
                <th>วันที่บันทึก</th>
                <th aria-label="การทำงาน" />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>{record.source_record_id}</strong>
                  </td>
                  <td>{record.master_name}</td>
                  <td>
                    <span
                      className={`agency-status ${record.verification_status}`}
                    >
                      {labels[record.verification_status] ||
                        record.verification_status}
                    </span>
                  </td>
                  <td>{new Date(record.created_at).toLocaleString("th-TH")}</td>
                  <td>
                    <button
                      type="button"
                      className="agency-secondary"
                      onClick={() => open(record.id)}
                    >
                      ดูรายละเอียด
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!records.length && (
            <div className="agency-empty">
              <strong>ไม่พบรายการ</strong>
              <span>
                ลองเลือกสถานะอื่น หรือเริ่มบันทึกข้อมูลจากเมนูบันทึกข้อมูล
              </span>
            </div>
          )}
        </div>
      </section>
      {selected && (
        <section className="agency-workspace agency-detail">
          <div className="agency-detail-header">
            <div className="agency-detail-heading">
              <h2>รายการ: {selected.source_record_id}</h2>
              <p>แบบฟอร์ม: {selected.master_name}</p>
              <span className="agency-entry-method">
                {entryMethodLabels[currentRevision?.entry_method] ||
                  "รายการที่บันทึกในระบบ"}
              </span>
            </div>
            <span className={`agency-status ${selected.verification_status}`}>
              {labels[selected.verification_status] ||
                selected.verification_status}
            </span>
          </div>
          <div className="agency-detail-data">
            {Object.entries(currentRevision?.data || {}).map(([key, value]) => (
              <div key={key}>
                <small>{fieldLabel(selected.fields, key)}</small>
                <span>
                  {Array.isArray(value)
                    ? value.join(", ")
                    : String(value || "—")}
                </span>
              </div>
            ))}
          </div>
          {selected.verification_status === "pending" &&
            can("agency_entries.verify") && (
              <div className="agency-review">
                <label>
                  หมายเหตุ <small>จำเป็นเมื่อไม่ผ่านการตรวจสอบ</small>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
                <div className="agency-form-actions">
                  <button
                    type="button"
                    className="agency-secondary"
                    disabled={isSaving}
                    onClick={() => review("rejected")}
                  >
                    ไม่ผ่านการตรวจสอบ
                  </button>
                  <button
                    type="button"
                    className="agency-primary"
                    disabled={isSaving}
                    onClick={() => review("verified")}
                  >
                    {isSaving ? "กำลังบันทึก…" : "ยืนยันข้อมูล"}
                  </button>
                </div>
              </div>
            )}
          {selected.verification_status === "rejected" &&
            can("agency_entries.create") && (
              <div className="agency-form-actions">
                <button
                  type="button"
                  className="agency-primary"
                  disabled={isSaving}
                  onClick={replacement}
                >
                  {isSaving ? "กำลังสร้าง…" : "สร้างรายการแก้ไข"}
                </button>
              </div>
            )}
        </section>
      )}
    </main>
  );
}
