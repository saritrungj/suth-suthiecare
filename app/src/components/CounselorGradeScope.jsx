import { useId } from "react";
import "./CounselorGradeScope.css";

// Which grades a counselor looks after. value: null = the whole school,
// an array of grade ids = only those grades (ม.ต้น / ม.ปลาย).
export default function CounselorGradeScope({
  grades = [],
  value = null,
  onChange,
  disabled = false,
}) {
  const id = useId();
  const limited = Array.isArray(value);
  const selected = new Set((value || []).map(Number));
  const toggle = (gradeId, checked) => {
    const next = checked
      ? [...selected, gradeId]
      : [...selected].filter((v) => v !== gradeId);
    onChange(next);
  };
  return (
    <fieldset className="grade-scope" disabled={disabled}>
      <legend>ระดับชั้นที่ดูแล</legend>
      <div className="grade-scope__modes">
        <label>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={!limited}
            onChange={() => onChange(null)}
          />
          ทุกระดับชั้น
        </label>
        <label>
          <input
            type="radio"
            name={`${id}-mode`}
            checked={limited}
            onChange={() => onChange([])}
          />
          เฉพาะระดับชั้นที่เลือก
        </label>
      </div>
      {limited && (
        <>
          {grades.length ? (
            <div className="grade-scope__grades">
              {grades.map((grade) => (
                <label key={grade.id}>
                  <input
                    type="checkbox"
                    checked={selected.has(Number(grade.id))}
                    onChange={(event) =>
                      toggle(Number(grade.id), event.target.checked)
                    }
                  />
                  {grade.name}
                </label>
              ))}
            </div>
          ) : (
            <p className="grade-scope__hint">
              โรงเรียนนี้ยังไม่มีระดับชั้น
              เพิ่มระดับชั้นที่หน้าโครงสร้างโรงเรียนก่อน
            </p>
          )}
          <p className="grade-scope__hint">
            ครูแนะแนวจะเห็นเฉพาะนักเรียนในระดับชั้นที่เลือก
            ถ้าระดับชั้นถูกลบจนไม่เหลือ จะไม่เห็นนักเรียนจนกว่าจะเลือกใหม่
          </p>
        </>
      )}
    </fieldset>
  );
}

// Client-side check shared by the forms that use this control.
export const gradeScopeError = (roleCode, value) =>
  roleCode === "counselor" && Array.isArray(value) && !value.length
    ? "กรุณาเลือกระดับชั้นที่ครูแนะแนวดูแลอย่างน้อยหนึ่งระดับ"
    : "";
