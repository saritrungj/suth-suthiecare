import { useEffect, useState } from "react";
import { FiEye } from "react-icons/fi";
import { getSchoolStudents } from "../../../services/api";
import {
  PageHeader,
  TableScroll,
  EmptyRow,
  LoadingRows,
  Pagination,
  studentName,
} from "./schoolUi";
import StudentDetailModal from "./StudentDetailModal";
import { DEFAULT_PAGE_SIZE } from "../../../components/table/TablePagination";
import DataPanel from "../../../components/table/DataPanel";
import ResultSummary from "../../../components/table/ResultSummary";

export default function GuardianStudents() {
  const [result, setResult] = useState({ data: [], pagination: null });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setResult({ data: [], pagination: null });
    getSchoolStudents({ page, limit })
      .then(({ data }) => {
        if (alive) setResult(data);
      })
      .catch((e) => {
        if (alive)
          setError(
            e.response?.data?.message ||
              "โหลดรายชื่อนักเรียนไม่สำเร็จ กรุณาลองใหม่",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, limit, revision]);
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="นักเรียนในความดูแล"
          description="ดูข้อมูลทั่วไป สุขภาพกาย สุขภาพจิต และข้อมูลเชิงลึกของนักเรียนในความดูแล"
        />
        <DataPanel className="sch-card" aria-label="นักเรียนในความดูแล">
          <p className="sch-muted">
            บัญชีผู้ปกครองมีสิทธิ์อ่านข้อมูล หากรายชื่อนักเรียนไม่ครบ
            กรุณาติดต่อโรงเรียนเพื่อปรับข้อมูลความสัมพันธ์
          </p>
          {error && (
            <p className="sch-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="sch-btn sch-btn-secondary"
            type="button"
            disabled={loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            โหลดใหม่
          </button>
          <ResultSummary loading={loading} pagination={result.pagination} />
          <TableScroll label="รายชื่อนักเรียนในความดูแล">
            <table className="sch-table admin-data-table" aria-busy={loading}>
              <thead>
                <tr>
                  <th>รหัสนักเรียน</th>
                  <th>ชื่อ–นามสกุล</th>
                  <th>ข้อมูล</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={3} />
                ) : !result.data.length ? (
                  <EmptyRow
                    columns={3}
                    title={
                      error
                        ? "ยังแสดงข้อมูลไม่ได้"
                        : "ยังไม่มีนักเรียนในความดูแล"
                    }
                    hint="ติดต่อโรงเรียนเพื่อตรวจสอบการผูกบัญชีผู้ปกครอง"
                  />
                ) : (
                  result.data.map((student) => (
                    <tr key={student.id}>
                      <td>{student.student_code}</td>
                      <td>{studentName(student)}</td>
                      <td>
                        <button
                          className="sch-btn sch-btn-secondary"
                          onClick={() => setViewing(student.id)}
                        >
                          <FiEye aria-hidden="true" />
                          ดูข้อมูล
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
          {result.pagination && (
            <Pagination
              pagination={result.pagination}
              onPage={setPage}
              onLimit={(value) => {
                setLimit(value);
                setPage(1);
              }}
            />
          )}
        </DataPanel>
        {viewing && (
          <StudentDetailModal
            studentId={viewing}
            onClose={() => setViewing(null)}
          />
        )}
      </main>
    </div>
  );
}
