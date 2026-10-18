import { useEffect, useState } from "react";
import api from "../../../services/api";
import SearchableSelect from "../../../components/SearchableSelect";
import { currentAcademicYear } from "./schoolUi";

export function useAcademicYears(schoolId) {
  const current = currentAcademicYear();
  const [data, setData] = useState({
    years: [current],
    current_year: current,
    minimum_year: current - 10,
  });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!schoolId) return;
    let alive = true;
    const load = () =>
      api
        .get(`/school/schools/${schoolId}/academic-years`)
        .then(({ data: result }) => {
          if (alive && Array.isArray(result.years)) {
            setData(result);
            setError("");
          }
        })
        .catch(() => {
          if (alive) setError("โหลดปีการศึกษาไม่สำเร็จ กรุณาลองใหม่");
        });
    setData({
      years: [current],
      current_year: current,
      minimum_year: current - 10,
    });
    load();
    window.addEventListener("school:academic-years", load);
    return () => {
      alive = false;
      window.removeEventListener("school:academic-years", load);
    };
  }, [schoolId, current]);
  return { ...data, error };
}

export default function AcademicYearSelect({
  schoolId,
  years: suppliedYears,
  currentYear = currentAcademicYear(),
  value,
  onChange,
  ...props
}) {
  const data = useAcademicYears(suppliedYears ? null : schoolId);
  const years = suppliedYears || data.years;
  const options = [
    ...new Set([...years, ...(value ? [Number(value)] : [])]),
  ].sort((a, b) => b - a);
  return (
    <SearchableSelect
      aria-label="ปีการศึกษา (พ.ศ.)"
      {...props}
      value={value}
      onChange={onChange}
    >
      {options.map((year) => (
        <option key={year} value={year}>
          {year}
          {year === currentYear ? " (ปีปัจจุบัน)" : ""}
        </option>
      ))}
    </SearchableSelect>
  );
}
