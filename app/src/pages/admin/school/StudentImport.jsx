import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiDownload,
  FiFileText,
  FiUploadCloud,
} from "react-icons/fi";
import { importSchoolStudents } from "../../../services/api";
import { showErrorAlert } from "../../../utils/alerts";
import {
  downloadCredentialsWorkbook,
  downloadImportTemplate,
  readStudentFile,
} from "../../../utils/studentImport";
import {
  PageHeader,
  TableScroll,
  currentAcademicYear,
  useSchools,
} from "./schoolUi";
import "./school.css";

const BATCH_SIZE = 100;
const MAX_ROWS = 3000;
const STATUS_LABELS = {
  will_create: "จะสร้างใหม่",
  will_update: "จะอัปเดต",
  created: "สร้างแล้ว",
  linked: "ผูกบัญชีเดิม",
  updated: "อัปเดตแล้ว",
  skipped: "ข้าม (มีอยู่แล้ว)",
  error: "มีปัญหา",
};
const STEPS = ["เลือกไฟล์", "ตรวจสอบข้อมูล", "นำเข้า", "เสร็จสิ้น"];

// Sends the rows in batches; the server accepts 200 rows per request.
async function runBatches(payload, rows, onProgress) {
  const results = [];
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const { data } = await importSchoolStudents({
      ...payload,
      rows: rows.slice(offset, offset + BATCH_SIZE),
      row_offset: offset,
    });
    results.push(...data.results);
    onProgress(Math.min(rows.length, offset + BATCH_SIZE));
  }
  return results;
}

export default function StudentImport() {
  const { schools, schoolId } = useSchools();
  const school = schools.find((item) => String(item.id) === String(schoolId));
  const [academicYear, setAcademicYear] = useState(
    String(currentAcademicYear()),
  );
  const [onDuplicate, setOnDuplicate] = useState("skip");
  const [createMissing, setCreateMissing] = useState(true);
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [preview, setPreview] = useState(null);
  const [final, setFinal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const inputRef = useRef(null);

  const step = final ? 3 : busy && preview ? 2 : preview ? 1 : 0;
  const options = {
    school_id: schoolId,
    academic_year: Number(academicYear),
    on_duplicate: onDuplicate,
    create_missing: createMissing,
  };

  const reset = () => {
    setFile(null);
    setParsed(null);
    setPreview(null);
    setFinal(null);
    setProgress(0);
    setDownloaded(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const chooseFile = async (selected) => {
    if (!selected) return;
    reset();
    setFile(selected);
    try {
      const result = await readStudentFile(selected);
      if (!result.rows.length) throw new Error("ไม่พบข้อมูลนักเรียนในไฟล์");
      if (result.rows.length > MAX_ROWS)
        throw new Error(
          `ไฟล์มี ${result.rows.length} แถว นำเข้าได้ครั้งละไม่เกิน ${MAX_ROWS} แถว กรุณาแบ่งไฟล์`,
        );
      setParsed(result);
    } catch (err) {
      setFile(null);
      await showErrorAlert({ error: err, title: "อ่านไฟล์ไม่สำเร็จ" });
    }
  };

  const check = async () => {
    setBusy(true);
    setProgress(0);
    try {
      const results = await runBatches(
        { ...options, dry_run: true },
        parsed.rows,
        setProgress,
      );
      setPreview(results);
    } catch (err) {
      await showErrorAlert({ error: err, title: "ตรวจสอบข้อมูลไม่สำเร็จ" });
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    setBusy(true);
    setProgress(0);
    try {
      const results = await runBatches(
        { ...options, dry_run: false },
        parsed.rows,
        setProgress,
      );
      setFinal(results);
    } catch (err) {
      await showErrorAlert({
        error: err,
        title: "นำเข้าไม่สำเร็จ",
        text: `${err.response?.data?.message || "เกิดข้อผิดพลาด"} (แถวที่นำเข้าสำเร็จก่อนหน้านี้ยังถูกบันทึกไว้ กรุณาตรวจสอบรายชื่อก่อนนำเข้าซ้ำ)`,
      });
    } finally {
      setBusy(false);
    }
  };

  const shown = final || preview || [];
  const summary = useMemo(
    () =>
      shown.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {}),
    [shown],
  );
  const problems = summary.error || 0;
  const importable = shown.length - problems - (summary.skipped || 0);
  const newPasswords = (final || []).filter((item) => item.password).length;
  const rowsToShow = onlyProblems
    ? shown.filter((item) => item.status === "error")
    : shown;

  const saveCredentials = async () => {
    await downloadCredentialsWorkbook(final, school?.name);
    setDownloaded(true);
  };

  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="นำเข้านักเรียนจาก Excel / CSV"
          description="ระบบจะสร้างข้อมูลนักเรียนและบัญชีผู้ใช้ให้นักเรียนทุกคน พร้อมรหัสผ่านชั่วคราวที่นักเรียนต้องเปลี่ยนเมื่อเข้าสู่ระบบครั้งแรก"
        >
          <Link className="sch-btn-secondary" to="/admin/school/students">
            <FiArrowLeft aria-hidden="true" /> กลับไปรายชื่อนักเรียน
          </Link>
        </PageHeader>

        <ol className="sch-steps" aria-label="ขั้นตอนการนำเข้า">
          {STEPS.map((label, index) => (
            <li key={label} aria-current={index === step ? "step" : undefined}>
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        {!final && (
          <section className="sch-card" aria-labelledby="import-setup-title">
            <h2 id="import-setup-title">ตั้งค่าการนำเข้า</h2>
            <div className="sch-form-grid">
              <label className="sch-field">
                ปีการศึกษาของห้องเรียน (พ.ศ.)
                <input
                  inputMode="numeric"
                  value={academicYear}
                  onChange={(event) => {
                    setAcademicYear(
                      event.target.value.replace(/\D/g, "").slice(0, 4),
                    );
                    setPreview(null);
                  }}
                />
              </label>
              <label className="sch-field">
                เมื่อพบรหัสนักเรียนที่มีอยู่แล้ว
                <select
                  value={onDuplicate}
                  onChange={(event) => {
                    setOnDuplicate(event.target.value);
                    setPreview(null);
                  }}
                >
                  <option value="skip">ข้าม (ไม่แก้ไขข้อมูลเดิม)</option>
                  <option value="update">อัปเดตข้อมูลและห้องเรียน</option>
                </select>
              </label>
              <label className="sch-check sch-full">
                <input
                  type="checkbox"
                  checked={createMissing}
                  onChange={(event) => {
                    setCreateMissing(event.target.checked);
                    setPreview(null);
                  }}
                />
                <span>
                  สร้างชั้นปีและห้องเรียนที่ยังไม่มีในระบบให้อัตโนมัติ
                  (ตามชื่อในไฟล์ ปีการศึกษา {academicYear || "-"})
                </span>
              </label>
            </div>

            <div className="sch-stack-top">
              <div
                className={`sch-dropzone ${dragging ? "is-dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  chooseFile(event.dataTransfer.files?.[0]);
                }}
              >
                <FiUploadCloud size={32} aria-hidden="true" />
                <strong>
                  {file ? file.name : "ลากไฟล์มาวางที่นี่ หรือเลือกไฟล์"}
                </strong>
                <span className="sch-muted">
                  รองรับ .xlsx และ .csv (UTF-8) แถวแรกต้องเป็นหัวคอลัมน์
                </span>
                <div className="sch-button-row sch-button-row--center">
                  <label className="sch-btn sch-file-btn">
                    <FiFileText aria-hidden="true" /> เลือกไฟล์
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="sch-file-input"
                      onChange={(event) => chooseFile(event.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    onClick={downloadImportTemplate}
                  >
                    <FiDownload aria-hidden="true" /> ดาวน์โหลดแบบฟอร์ม
                  </button>
                </div>
              </div>
            </div>

            {parsed && (
              <div className="sch-stack-top sch-stack">
                <p>
                  พบนักเรียน <strong>{parsed.rows.length}</strong> แถว
                </p>
                {parsed.missingRequired.length > 0 && (
                  <p className="sch-error" role="alert">
                    ไม่พบคอลัมน์ที่จำเป็น: {parsed.missingRequired.join(", ")}{" "}
                    กรุณาใช้หัวคอลัมน์ตามแบบฟอร์ม
                  </p>
                )}
                {parsed.unknownHeaders.length > 0 && (
                  <p className="sch-warning">
                    คอลัมน์ที่ระบบไม่รู้จักจะไม่ถูกนำเข้า:{" "}
                    {parsed.unknownHeaders.join(", ")}
                  </p>
                )}
                <div>
                  <button
                    type="button"
                    className="sch-btn"
                    disabled={
                      busy ||
                      !schoolId ||
                      academicYear.length !== 4 ||
                      parsed.missingRequired.length > 0
                    }
                    onClick={check}
                  >
                    {busy && !preview ? "กำลังตรวจสอบ..." : "ตรวจสอบข้อมูล"}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {busy && parsed && (
          <section className="sch-card" aria-live="polite">
            <p className="sch-progress-label">
              {preview ? "กำลังนำเข้า" : "กำลังตรวจสอบ"} {progress} /{" "}
              {parsed.rows.length} แถว
            </p>
            <div
              className="sch-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={parsed.rows.length}
              aria-valuenow={progress}
            >
              <span
                style={{
                  transform: `scaleX(${parsed.rows.length ? progress / parsed.rows.length : 0})`,
                }}
              />
            </div>
          </section>
        )}

        {shown.length > 0 && !busy && (
          <section className="sch-card" aria-labelledby="import-result-title">
            <div className="sch-card-head">
              <h2 id="import-result-title">
                {final ? "ผลการนำเข้า" : "ผลการตรวจสอบ (ยังไม่บันทึก)"}
              </h2>
              <label className="sch-check">
                <input
                  type="checkbox"
                  checked={onlyProblems}
                  onChange={(event) => setOnlyProblems(event.target.checked)}
                />
                <span>แสดงเฉพาะแถวที่มีปัญหา ({problems})</span>
              </label>
            </div>
            <div className="sch-tiles">
              {Object.entries(summary).map(([status, count]) => (
                <div
                  key={status}
                  className={`sch-tile ${status === "error" ? "risk-high" : status === "skipped" ? "risk-medium" : "risk-normal"}`}
                >
                  <span>{STATUS_LABELS[status] || status}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>

            {final ? (
              <div className="sch-stack sch-stack-bottom">
                {newPasswords > 0 && (
                  <p className="sch-warning" role="alert">
                    มีรหัสผ่านชั่วคราว {newPasswords} บัญชี
                    แสดงเพียงครั้งเดียวในหน้านี้
                    กรุณาดาวน์โหลดไฟล์บัญชีนักเรียนก่อนออกจากหน้า
                    และเก็บไฟล์อย่างปลอดภัย
                  </p>
                )}
                <div className="sch-button-row">
                  <button
                    type="button"
                    className="sch-btn"
                    onClick={saveCredentials}
                  >
                    <FiDownload aria-hidden="true" /> ดาวน์โหลดบัญชีนักเรียน
                    (Excel)
                  </button>
                  <button
                    type="button"
                    className="sch-btn-secondary"
                    disabled={newPasswords > 0 && !downloaded}
                    title={
                      newPasswords > 0 && !downloaded
                        ? "ดาวน์โหลดบัญชีนักเรียนก่อน"
                        : undefined
                    }
                    onClick={reset}
                  >
                    นำเข้าไฟล์อื่น
                  </button>
                </div>
              </div>
            ) : (
              <div className="sch-button-row sch-stack-bottom">
                <button
                  type="button"
                  className="sch-btn"
                  disabled={!importable}
                  onClick={apply}
                >
                  นำเข้า {importable} คน
                  {problems ? ` (ข้ามแถวที่มีปัญหา ${problems} แถว)` : ""}
                </button>
                <button
                  type="button"
                  className="sch-btn-secondary"
                  onClick={reset}
                >
                  เลือกไฟล์ใหม่
                </button>
              </div>
            )}

            <TableScroll
              label={final ? "ตารางผลการนำเข้า" : "ตารางผลการตรวจสอบ"}
            >
              <table className="sch-table">
                <thead>
                  <tr>
                    <th className="sch-num">แถว</th>
                    <th>รหัส</th>
                    <th>ชื่อ</th>
                    <th>ชั้น/ห้อง</th>
                    <th>ชื่อผู้ใช้</th>
                    {final && <th>รหัสผ่านชั่วคราว</th>}
                    <th>ผล</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsToShow.map((item) => (
                    <tr
                      key={item.row}
                      className={item.status === "error" ? "sch-row-error" : ""}
                    >
                      <td className="sch-num">{item.row + 1}</td>
                      <td>{item.student_code || "-"}</td>
                      <td>{item.name || "-"}</td>
                      <td>
                        {item.grade || "-"} ห้อง {item.classroom || "-"}
                      </td>
                      <td>{item.username || "-"}</td>
                      {final && (
                        <td className="sch-code">{item.password || "-"}</td>
                      )}
                      <td>
                        <span
                          className={`sch-badge ${item.status === "error" ? "risk-high" : item.status === "skipped" ? "risk-medium" : "risk-normal"}`}
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                        {item.errors?.length > 0 && (
                          <ul className="sch-errors">
                            {item.errors.map((message) => (
                              <li key={message}>{message}</li>
                            ))}
                          </ul>
                        )}
                        {item.notes?.length > 0 && (
                          <span className="sch-sub">
                            {item.notes.join(" ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <p className="sch-muted">
              เลขแถวนับตามไฟล์ (แถวที่ 1 คือหัวคอลัมน์)
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
