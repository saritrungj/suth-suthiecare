import { Fragment, useEffect, useState } from "react";
import ExcelJS from "exceljs";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { parseAgencyCsv } from "../../utils/agencyCsv";
import { Link } from "react-router-dom";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  createAgencyRecord,
  getAgencyMasterSchema,
  getAgencyMasters,
  importAgencyRecords,
  validateAgencyImport,
} from "../../services/api";
import "./AgencyEntry.css";
import "./AgencyEntryLayout.css";
import { createAgencyTemplate } from "../../utils/agencyTemplate";
import { checkupDuration } from "../../utils/checkupRange";
import { agencyFieldPlaceholder } from "../../utils/agencyFieldPlaceholder";

const newSourceId = () => `MANUAL-${crypto.randomUUID()}`;
const displayValue = (item) => (item == null ? "" : String(item));
function cellValue(cell) {
  if (cell?.formula) throw new Error("ไม่อนุญาตให้ใช้สูตรในไฟล์นำเข้า");
  return cell?.text ?? cell?.value ?? "";
}

export default function AgencyEntry() {
  const { activeAgency, authorization } = usePermissions();
  const [fileName, setFileName] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [imported, setImported] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [masters, setMasters] = useState([]);
  const [masterId, setMasterId] = useState("");
  const [master, setMaster] = useState(null);
  const [data, setData] = useState({});
  const [sourceRecordId, setSourceRecordId] = useState(newSourceId);
  const [tab, setTab] = useState("single");
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState([]);
  const [expandedPreviewRows, setExpandedPreviewRows] = useState(
    () => new Set(),
  );
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    if (!activeAgency) {
      setIsLoading(false);
      return;
    }
    getAgencyMasters()
      .then(({ data: items }) => {
        if (!alive) return;
        setMasters(items || []);
        setMasterId(String(items?.[0]?.id || ""));
      })
      .catch((error) => {
        if (alive)
          setMessage(error.response?.data?.message || "โหลดแบบฟอร์มไม่สำเร็จ");
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeAgency]);
  useEffect(() => {
    let alive = true;
    setMaster(null);
    if (!masterId) return;
    getAgencyMasterSchema(masterId)
      .then(({ data: schema }) => {
        if (!alive) return;
        setMaster(schema);
        setData({});
        setRows([]);
        setPreview([]);
        setExpandedPreviewRows(new Set());
        setMessage("");
      })
      .catch(() => {
        if (alive) setMessage("โหลดแบบฟอร์มไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [masterId]);

  const update = (field, fieldValue) =>
    setData((current) => ({
      ...current,
      [field.id]:
        field.type === "multiselect"
          ? fieldValue
              .split("|")
              .map((item) => item.trim())
              .filter(Boolean)
          : fieldValue,
    }));
  const save = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    try {
      const response = await createAgencyRecord({
        master_id: Number(masterId),
        source_record_id: sourceRecordId || undefined,
        data,
      });
      setMessage(
        `บันทึกข้อมูลเรียบร้อยแล้ว · เลขที่รายการ ${response.data.recordId}`,
      );
      setData({});
      setSourceRecordId(newSourceId());
    } catch (error) {
      setMessage(error.response?.data?.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };
  const downloadTemplate = async () => {
    setDownloading(true);
    try {
      const buffer = await createAgencyTemplate(master);
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `agency-master-${masterId}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setMessage("ดาวน์โหลด Template ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setDownloading(false);
    }
  };
  const parse = async (file) => {
    if (!file || !master) return;
    setFileName(file.name);
    setRows([]);
    setPreview([]);
    setExpandedPreviewRows(new Set());
    setImported(false);
    setMessage("");
    if (file.size > 10 * 1024 * 1024) {
      setMessage("ไฟล์ต้องมีขนาดไม่เกิน 10 MB");
      return;
    }
    setIsParsing(true);
    try {
      const book = new ExcelJS.Workbook();
      if (/\.csv$/i.test(file.name)) {
        const csv = new TextDecoder("utf-8", { fatal: true }).decode(
          await file.arrayBuffer(),
        );
        book.addWorksheet("Import").addRows(parseAgencyCsv(csv));
      } else if (/\.xlsx$/i.test(file.name))
        await book.xlsx.load(await file.arrayBuffer());
      else throw new Error("รองรับไฟล์ .xlsx และ .csv เท่านั้น");
      const sheet = book.worksheets[0];
      if (!sheet) throw new Error("ไฟล์ไม่มีชีตข้อมูล");
      const headers = sheet
        .getRow(1)
        .values.slice(1)
        .map((item) => String(item || "").trim());
      const expected = [
        "source_record_id",
        ...master.fields.map((field) => field.id),
      ];
      if (headers.join("|") !== expected.join("|"))
        throw new Error("หัวตารางไม่ตรงกับ Template ของ แบบฟอร์ม ที่เลือก");
      const imported = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const values = headers.map((_, column) =>
          displayValue(cellValue(row.getCell(column + 1))).trim(),
        );
        if (values.every((item) => !item)) return;
        const raw = Object.fromEntries(
          headers.map((header, column) => [header, values[column]]),
        );
        imported.push({
          source_record_id:
            raw.source_record_id || `IMPORT-${crypto.randomUUID()}`,
          data: Object.fromEntries(
            master.fields.map((field) => [
              field.id,
              field.type === "multiselect"
                ? raw[field.id].split("|").filter(Boolean)
                : raw[field.id],
            ]),
          ),
        });
      });
      if (!imported.length) throw new Error("ไม่พบรายการในไฟล์ที่เลือก");
      if (imported.length > 1000)
        throw new Error("นำเข้าได้ไม่เกิน 1,000 แถวต่อครั้ง");
      setRows(imported);
      const response = await validateAgencyImport({
        master_id: Number(masterId),
        rows: imported,
      });
      setPreview(
        response.data.rows.map((row) => ({
          ...row,
          valid: !Object.keys(row.errors || {}).length,
        })),
      );
      setMessage(`ตรวจสอบไฟล์แล้ว ${imported.length} แถว`);
    } catch (error) {
      setMessage(error.message || "อ่านไฟล์ไม่สำเร็จ");
      setRows([]);
      setPreview([]);
      setExpandedPreviewRows(new Set());
    } finally {
      setIsParsing(false);
    }
  };
  const upload = async () => {
    setIsSaving(true);
    try {
      const response = await importAgencyRecords({
        master_id: Number(masterId),
        rows,
      });
      setPreview(
        response.data.rows.map((row) => ({
          ...row,
          valid: !Object.keys(row.errors || {}).length,
        })),
      );
      setImported(true);
      setMessage(
        `นำเข้าสำเร็จ ${response.data.accepted} รายการ · ไม่สำเร็จ ${response.data.rejected} รายการ`,
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "นำเข้าข้อมูลไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  };
  const company = (
    authorization?.is_system_admin
      ? authorization.agencies
      : authorization?.agency_memberships?.map((item) => item.agency)
  )?.find((item) => String(item.id) === String(activeAgency));
  const orderedFields = master?.fields
    ? [...master.fields].sort((a, b) => {
        const order = [
          "first_name",
          "last_name",
          "employee_id",
          "department",
          "phone",
          "checkup_date",
        ];
        const rank = (field) =>
          order.includes(field.id) ? order.indexOf(field.id) : order.length;
        return rank(a) - rank(b);
      })
    : [];
  const readyCount = preview.filter((row) => row.valid).length;
  const hasRange =
    master?.fields.some((field) => field.id === "checkup_date") &&
    master?.fields.some((field) => field.id === "checkup_end_date");
  const toggleAllPreviewRows = () =>
    setExpandedPreviewRows((current) =>
      current.size === preview.length
        ? new Set()
        : new Set(preview.map((row) => row.row)),
    );
  return (
    <main className="agency-page agency-entry-page">
      <header className="agency-page-header">
        <div>
          <h1>ลงทะเบียนตรวจสุขภาพ</h1>
          <p>กรอกรายชื่อพนักงานทีละคน หรือนำเข้ารายชื่อจากไฟล์</p>
        </div>
      </header>
      {message && (
        <p className="agency-notice" role="status">
          {message}
        </p>
      )}
      <section className="agency-workspace">
        <div className="entry-context">
          <div className="entry-company">
            <span>บริษัทที่กำลังใช้งาน</span>
            <strong>{company?.name || "ยังไม่ได้เลือกบริษัท"}</strong>
            <small>เปลี่ยนบริษัทได้จาก Sidebar</small>
          </div>
          <label htmlFor="entry-master">
            แบบฟอร์ม / รอบตรวจสุขภาพ
            <select
              id="entry-master"
              value={masterId}
              onChange={(event) => {
                setMasterId(event.target.value);
                setFileName("");
                setImported(false);
              }}
              disabled={isLoading || isSaving || isParsing}
            >
              <option value="">
                {isLoading ? "กำลังโหลด…" : "เลือกแบบฟอร์ม"}
              </option>
              {masters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!isLoading && !masters.length && (
          <div className="agency-empty">
            <strong>ยังไม่มีแบบฟอร์มตรวจสุขภาพ</strong>
            <span>
              {authorization?.is_system_admin
                ? "สร้างบริษัทและรอบตรวจสุขภาพก่อนเริ่มลงทะเบียน"
                : "ติดต่อแอดมินเพื่อสร้างรอบตรวจสุขภาพของบริษัทนี้"}
            </span>
            {authorization?.is_system_admin && (
              <Link to="/admin/agencies">
                สร้างบริษัท / แบบฟอร์มตรวจสุขภาพ →
              </Link>
            )}
          </div>
        )}
        {master && (
          <>
            <div
              className="agency-tabs"
              role="tablist"
              aria-label="รูปแบบการบันทึก"
            >
              {["single", "bulk"].map((key) => (
                <button
                  key={key}
                  id={`entry-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  aria-controls="entry-panel"
                  className={tab === key ? "is-active" : ""}
                  onClick={() => setTab(key)}
                >
                  {key === "single" ? "บันทึกทีละรายการ" : "นำเข้าหลายรายการ"}
                </button>
              ))}
            </div>
            <div
              id="entry-panel"
              role="tabpanel"
              aria-labelledby={`entry-tab-${tab}`}
            >
              {tab === "single" ? (
                <form className="agency-form entry-manual" onSubmit={save}>
                  <div className="agency-form-heading">
                    <h2>ข้อมูลผู้ตรวจสุขภาพ</h2>
                    <p>ช่องที่มี * จำเป็นต้องกรอก</p>
                  </div>
                  <div className="agency-form-grid">
                    {orderedFields
                      .filter(
                        (field) =>
                          !hasRange ||
                          !["checkup_date", "checkup_end_date"].includes(
                            field.id,
                          ),
                      )
                      .map((field) => (
                        <Field
                          key={field.id}
                          field={field}
                          value={data[field.id]}
                          onChange={update}
                          disabled={isSaving}
                        />
                      ))}
                  </div>
                  {hasRange && (
                    <fieldset className="entry-date-range">
                      <legend>ช่วงวันที่ตรวจสุขภาพ</legend>
                      <div className="agency-form-grid">
                        <label>
                          <span>วันที่เริ่มต้น</span>
                          <input
                            type="date"
                            value={data.checkup_date || ""}
                            max={data.checkup_end_date || undefined}
                            required={
                              Boolean(data.checkup_end_date) ||
                              master.fields.find(
                                (field) => field.id === "checkup_date",
                              )?.required
                            }
                            disabled={isSaving}
                            onChange={(event) =>
                              update({ id: "checkup_date" }, event.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>วันที่สิ้นสุด</span>
                          <input
                            type="date"
                            value={data.checkup_end_date || ""}
                            min={data.checkup_date || undefined}
                            required={Boolean(data.checkup_date)}
                            disabled={isSaving}
                            onChange={(event) =>
                              update(
                                { id: "checkup_end_date" },
                                event.target.value,
                              )
                            }
                          />
                        </label>
                      </div>
                      <p aria-live="polite">
                        {checkupDuration(
                          data.checkup_date,
                          data.checkup_end_date,
                        ) || "เลือกวันเริ่มต้นและวันสิ้นสุดเพื่อคำนวณระยะเวลา"}
                      </p>
                      <small>
                        นับรวมวันเริ่มต้นและวันสิ้นสุด เดือนและปีนับตามปฏิทิน
                        หากตรวจวันเดียวให้เลือกวันเดียวกันทั้งสองช่อง
                      </small>
                    </fieldset>
                  )}
                  <div className="entry-reference">
                    <label htmlFor="entry-source">Source record ID</label>
                    <input id="entry-source" value={sourceRecordId} readOnly />
                    <small>
                      ระบบสร้างรหัสให้อัตโนมัติ ใช้อ้างอิงรายการหลังบันทึก
                    </small>
                  </div>
                  <div className="agency-form-actions">
                    <span>ตรวจสอบชื่อและนามสกุลก่อนบันทึก</span>
                    <button className="agency-primary" disabled={isSaving}>
                      {isSaving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
                    </button>
                  </div>
                </form>
              ) : (
                <section className="agency-import entry-bulk">
                  <div className="entry-import-steps">
                    <section className="entry-import-step">
                      <span className="entry-step-label">ขั้นตอน 1</span>
                      <h2>เตรียมรายชื่อ</h2>
                      <p>
                        ดาวน์โหลด Template ของแบบฟอร์มนี้ มีข้อมูลสมมติ 3
                        แถวตามช่องกรอก Manual
                      </p>
                      <button
                        type="button"
                        className="agency-secondary"
                        disabled={downloading}
                        onClick={downloadTemplate}
                      >
                        {downloading ? "กำลังสร้างไฟล์…" : "ดาวน์โหลด Template"}
                      </button>
                      <small>
                        ลบหรือแทนที่ข้อมูลตัวอย่างก่อนนำเข้ารายชื่อจริง
                      </small>
                    </section>
                    <section className="entry-import-step">
                      <span className="entry-step-label">ขั้นตอน 2</span>
                      <h2>เลือกไฟล์นำเข้า</h2>
                      <p>
                        รองรับ .xlsx และ .csv ไม่เกิน 10 MB หรือ 1,000 รายการ
                      </p>
                      <label className="entry-upload" htmlFor="entry-upload">
                        ไฟล์รายชื่อพนักงาน
                        <input
                          id="entry-upload"
                          type="file"
                          accept=".xlsx,.csv,text/csv"
                          disabled={isParsing || isSaving}
                          onChange={(event) => {
                            parse(event.target.files?.[0]);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <small className="entry-file-name">
                        {isParsing
                          ? "กำลังตรวจสอบข้อมูล…"
                          : fileName || "ยังไม่ได้เลือกไฟล์"}
                      </small>
                    </section>
                  </div>
                  <section className="entry-preview-section">
                    <span className="entry-step-label">ขั้นตอน 3</span>
                    <h2>{imported ? "ผลการนำเข้า" : "ตรวจสอบก่อนนำเข้า"}</h2>
                    {!preview.length ? (
                      <p className="entry-preview-empty">
                        เมื่อเลือกไฟล์
                        ระบบจะแสดงรายการที่พร้อมนำเข้าและข้อผิดพลาดที่ต้องแก้ไขที่นี่
                      </p>
                    ) : (
                      <>
                        <div
                          className="agency-import-summary"
                          aria-label="สรุปผลการตรวจสอบไฟล์"
                        >
                          <div className="entry-summary-item is-total">
                            <span className="entry-summary-label">ทั้งหมด</span>
                            <strong>{preview.length}</strong>
                            <span className="entry-summary-unit">รายการ</span>
                          </div>
                          <div className="entry-summary-item is-ready">
                            <span className="entry-summary-label">
                              {imported ? "นำเข้าสำเร็จ" : "พร้อมนำเข้า"}
                            </span>
                            <strong>{readyCount}</strong>
                            <span className="entry-summary-unit">รายการ</span>
                          </div>
                          <div
                            className={`entry-summary-item is-problem ${preview.length - readyCount ? "has-errors" : ""}`}
                          >
                            <span className="entry-summary-label">
                              {imported ? "นำเข้าไม่สำเร็จ" : "ต้องแก้ไข"}
                            </span>
                            <strong>{preview.length - readyCount}</strong>
                            <span className="entry-summary-unit">รายการ</span>
                          </div>
                        </div>
                        <div className="entry-preview-toolbar">
                          <p>
                            ใช้ไอคอนรูปตาเพื่อดูข้อมูลครบทุกช่องของแต่ละรายการก่อนนำเข้า
                          </p>
                          <button
                            type="button"
                            className="agency-secondary entry-preview-all"
                            onClick={toggleAllPreviewRows}
                            aria-pressed={
                              expandedPreviewRows.size === preview.length
                            }
                          >
                            {expandedPreviewRows.size === preview.length ? (
                              <FiEyeOff aria-hidden="true" />
                            ) : (
                              <FiEye aria-hidden="true" />
                            )}
                            {expandedPreviewRows.size === preview.length
                              ? "ซ่อนข้อมูลทั้งหมด"
                              : "ดูข้อมูลทั้งหมด"}
                          </button>
                        </div>
                        <Preview
                          rows={preview}
                          sourceRows={rows}
                          fields={master.fields}
                          imported={imported}
                          expandedRows={expandedPreviewRows}
                          onToggle={(rowNumber) =>
                            setExpandedPreviewRows((current) => {
                              const next = new Set(current);
                              next.has(rowNumber)
                                ? next.delete(rowNumber)
                                : next.add(rowNumber);
                              return next;
                            })
                          }
                        />
                        {preview.length > 100 && (
                          <p>แสดง 100 รายการแรกจาก {preview.length} รายการ</p>
                        )}
                        <div className="agency-form-actions">
                          <span>
                            {imported
                              ? "เลือกไฟล์ใหม่เพื่อเริ่มนำเข้าครั้งถัดไป"
                              : "นำเข้าเฉพาะรายการที่ผ่านการตรวจสอบ"}
                          </span>
                          <button
                            type="button"
                            className="agency-primary"
                            disabled={
                              isSaving || isParsing || imported || !readyCount
                            }
                            onClick={upload}
                          >
                            {isSaving
                              ? "กำลังนำเข้า…"
                              : imported
                                ? "นำเข้าแล้ว"
                                : `นำเข้า ${readyCount} รายการ`}
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                </section>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
function Field({ field, value, onChange, disabled }) {
  const shared = {
    value: Array.isArray(value) ? value.join("|") : displayValue(value),
    onChange: (event) => onChange(field, event.target.value),
    required: Boolean(field.required),
    placeholder: agencyFieldPlaceholder(field),
    disabled,
  };
  return (
    <label className={field.type === "textarea" ? "agency-field-wide" : ""}>
      <span>
        {field.label}
        {field.required && <b aria-hidden="true"> *</b>}
      </span>
      {field.type === "select" ? (
        <select {...shared}>
          <option value="">เลือกข้อมูล</option>
          {(field.options || []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.type === "textarea" ? (
        <textarea {...shared} />
      ) : (
        <input
          {...shared}
          type={
            ["number", "date", "email"].includes(field.type)
              ? field.type
              : field.type === "phone"
                ? "tel"
                : "text"
          }
        />
      )}
      {field.type === "multiselect" && <small>คั่นหลายค่าด้วย |</small>}
    </label>
  );
}
function Preview({
  rows,
  sourceRows,
  fields,
  imported,
  expandedRows,
  onToggle,
}) {
  const sourceByRow = new Map(
    sourceRows.map((item, index) => [index + 1, item]),
  );
  return (
    <div className="agency-table-wrap">
      <table className="agency-table entry-preview-table">
        <thead>
          <tr>
            <th>รายการ</th>
            <th>รหัสอ้างอิง</th>
            <th>ผลการตรวจสอบ</th>
            <th aria-label="ดูข้อมูล" />
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 100).map((row) => {
            const isOpen = expandedRows.has(row.row);
            const data = sourceByRow.get(row.row)?.data || {};
            return (
              <Fragment key={row.row}>
                <tr>
                  <td>{row.row}</td>
                  <td className="entry-source-cell">
                    {row.source_record_id || "—"}
                  </td>
                  <td>
                    <span
                      className={`agency-status ${row.valid ? "verified" : "rejected"}`}
                    >
                      {row.valid
                        ? imported
                          ? "นำเข้าสำเร็จ"
                          : "พร้อมนำเข้า"
                        : Object.values(row.errors || {}).join(", ")}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="entry-preview-icon"
                      onClick={() => onToggle(row.row)}
                      aria-label={`${isOpen ? "ซ่อน" : "ดู"}ข้อมูลรายการ ${row.row}`}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? (
                        <FiEyeOff aria-hidden="true" />
                      ) : (
                        <FiEye aria-hidden="true" />
                      )}
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="entry-preview-detail">
                    <td colSpan="4">
                      <dl>
                        {fields.map((field) => (
                          <div key={field.id}>
                            <dt>{field.label}</dt>
                            <dd>
                              {Array.isArray(data[field.id])
                                ? data[field.id].join(" | ")
                                : displayValue(data[field.id]) || "—"}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
