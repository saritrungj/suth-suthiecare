// Semester dates of one academic year. Mental assessments and care steps are
// filed under the semester whose dates contain them; without dates only the
// academic year is shown.
import { useEffect, useState } from "react";
import { FiSave } from "react-icons/fi";
import { saveAcademicYearTerms } from "../../../services/api";
import { showSuccessToast } from "../../../utils/alerts";
import AcademicYearSelect from "./AcademicYearSelect";
import { ThaiDateField } from "./schoolUi";

const FIELDS = [
  ["term1_starts_on", "ภาคเรียนที่ 1 เปิด"],
  ["term1_ends_on", "ภาคเรียนที่ 1 ปิด"],
  ["term2_starts_on", "ภาคเรียนที่ 2 เปิด"],
  ["term2_ends_on", "ภาคเรียนที่ 2 ปิด"],
];
const blank = Object.fromEntries(FIELDS.map(([key]) => [key, ""]));

export default function AcademicTermsForm({ schoolId, academic }) {
  const [year, setYear] = useState(String(academic.current_year));
  const [dates, setDates] = useState(blank);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saved = academic.terms?.[year];

  useEffect(() => {
    setDates({ ...blank, ...(saved || {}) });
    setError("");
    // Reload the form when the year changes or saved dates arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, JSON.stringify(saved || null)]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await saveAcademicYearTerms(schoolId, year, dates);
      window.dispatchEvent(new Event("school:academic-years"));
      await showSuccessToast("บันทึกวันเปิด-ปิดภาคเรียนแล้ว");
    } catch (err) {
      setError(err.response?.data?.message || "บันทึกวันภาคเรียนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="sch-terms-form" onSubmit={submit}>
      <label className="sch-field">
        วันเปิด-ปิดภาคเรียนของปีการศึกษา
        <AcademicYearSelect
          years={academic.years}
          currentYear={academic.current_year}
          value={year}
          onChange={(e) => setYear(e.target.value)}
        />
      </label>
      <div className="sch-terms-grid">
        {FIELDS.map(([key, label]) => (
          <ThaiDateField
            key={`${year}-${key}`}
            label={label}
            allowFuture
            value={dates[key]}
            onChange={(value) => setDates((d) => ({ ...d, [key]: value }))}
          />
        ))}
      </div>
      <p className="sch-muted">
        ใช้จัดผลประเมินสุขภาพจิตและสถานะการดูแลเข้าภาคเรียน
        ถ้ายังไม่กำหนดจะแสดงเฉพาะปีการศึกษา
      </p>
      {error && (
        <p role="alert" className="sch-error">
          {error}
        </p>
      )}
      <button className="sch-btn-secondary" disabled={busy}>
        <FiSave aria-hidden="true" />{" "}
        {busy ? "กำลังบันทึก…" : "บันทึกวันภาคเรียน"}
      </button>
    </form>
  );
}
