import { useCallback, useEffect, useState } from "react";
import { getBehaviorReports } from "../../../services/api";
import DataPanel from "../../../components/table/DataPanel";
import ResultSummary from "../../../components/table/ResultSummary";
import { DEFAULT_PAGE_SIZE } from "../../../components/table/TablePagination";
import {
  BarSelect,
  EmptyRow,
  LoadingRows,
  PageHeader,
  Pagination,
  SearchField,
  TableScroll,
  formatThaiDate,
} from "./schoolUi";
import {
  BehaviorReportDetail,
  BehaviorStatus,
  ConcernLevel,
  useBehaviorOptions,
} from "./behavior";
import "./school.css";
import "./behavior.css";
import ExportCsvButton from "../../../components/ExportCsvButton";

const COLUMNS = 7;
const EMPTY = { q: "", status: "open", concern_level: "", mine: "" };

// Behaviour reports across the students the caller looks after. New reports
// are written from the student file, where the student is already chosen.
export default function BehaviorReports() {
  const options = useBehaviorOptions();
  const actions = options?.actions || {};
  const [filters, setFilters] = useState(EMPTY),
    [page, setPage] = useState(1),
    [limit, setLimit] = useState(DEFAULT_PAGE_SIZE),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [openId, setOpenId] = useState(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getBehaviorReports({
        ...filters,
        mine: filters.mine || undefined,
        page,
        limit,
      });
      setResult(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดรายงานพฤติกรรมไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);
  useEffect(() => {
    const timer = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, filters.q]);
  const update = (key) => (value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const statusLabel =
    filters.status === "open"
      ? "ยังไม่ปิด"
      : options?.statuses?.[filters.status] || "";
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="บันทึกพฤติกรรม"
          description="รายงานพฤติกรรมจากครูรายวิชาและครูที่ปรึกษา ติดตามและปิดเรื่องได้ที่นี่ บันทึกรายงานใหม่ได้จากแฟ้มนักเรียน"
        >
          {actions.export && (
            <ExportCsvButton
              path="/school/behavior-reports"
              params={{ ...filters, mine: filters.mine || undefined }}
              fileName="รายงานพฤติกรรม.csv"
            />
          )}
        </PageHeader>
        {!actions.view && options && (
          <p className="sch-muted">แสดงเฉพาะรายงานที่คุณเป็นผู้ส่ง</p>
        )}
        <DataPanel className="sch-card">
          <div className="sch-filter-bar">
            <SearchField
              label="ค้นหา"
              placeholder="รหัสนักเรียน ชื่อนักเรียน หรือผู้รายงาน"
              value={filters.q}
              onChange={update("q")}
            />
            <BarSelect
              label="สถานะ"
              value={filters.status}
              onChange={update("status")}
            >
              <option value="">ทุกสถานะ</option>
              <option value="open">ยังไม่ปิด</option>
              {Object.entries(options?.statuses || {}).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </BarSelect>
            <BarSelect
              label="ระดับความกังวล"
              value={filters.concern_level}
              onChange={update("concern_level")}
            >
              <option value="">ทุกระดับ</option>
              {Object.entries(options?.levels || {}).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </BarSelect>
            {actions.view && (
              <BarSelect
                label="ผู้รายงาน"
                value={filters.mine}
                onChange={update("mine")}
              >
                <option value="">ทุกคน</option>
                <option value="1">เฉพาะที่ฉันรายงาน</option>
              </BarSelect>
            )}
          </div>
          <ResultSummary
            pagination={result?.pagination}
            loading={loading}
            onClearAll={() => {
              setFilters({ ...EMPTY, status: "" });
              setPage(1);
            }}
            chips={[
              {
                key: "q",
                label: "ค้นหา",
                value: filters.q,
                onRemove: () => update("q")(""),
              },
              {
                key: "status",
                label: "สถานะ",
                value: statusLabel,
                onRemove: () => update("status")(""),
              },
              {
                key: "level",
                label: "ระดับ",
                value: options?.levels?.[filters.concern_level] || "",
                onRemove: () => update("concern_level")(""),
              },
              {
                key: "mine",
                label: "ผู้รายงาน",
                value: filters.mine ? "ฉัน" : "",
                onRemove: () => update("mine")(""),
              },
            ]}
          />
          {error && (
            <p className="sch-error" role="alert">
              {error}
            </p>
          )}
          <TableScroll label="รายงานพฤติกรรม">
            <table className="sch-table admin-data-table">
              <thead>
                <tr>
                  <th>วันที่พบ</th>
                  <th>นักเรียน</th>
                  <th>เรื่อง</th>
                  <th>ระดับ</th>
                  <th>สถานะ</th>
                  <th>ผู้รับผิดชอบ</th>
                  <th className="is-actions">ดู</th>
                </tr>
              </thead>
              <tbody>
                {loading && !result && <LoadingRows columns={COLUMNS} />}
                {result && !result.data.length && (
                  <EmptyRow
                    columns={COLUMNS}
                    title="ไม่พบรายงานพฤติกรรม"
                    hint="ลองล้างตัวกรอง หรือบันทึกรายงานใหม่จากแฟ้มนักเรียน"
                  />
                )}
                {result?.data.map((r) => (
                  <tr key={r.id}>
                    <td>{formatThaiDate(r.observed_on)}</td>
                    <td>
                      <strong>{r.student_code}</strong>
                      <span className="sch-muted behavior-sub">
                        {r.student_name || ""}
                        {r.classroom_name
                          ? ` · ${[r.grade_name, r.classroom_name].filter(Boolean).join("/")}`
                          : ""}
                      </span>
                    </td>
                    <td>{options?.categories?.[r.category] || r.category}</td>
                    <td>
                      <ConcernLevel
                        level={r.concern_level}
                        labels={options?.levels}
                      />
                    </td>
                    <td>
                      <BehaviorStatus
                        status={r.status}
                        labels={options?.statuses}
                      />
                    </td>
                    <td>{r.assignee_name || "-"}</td>
                    <td className="is-actions">
                      <button
                        type="button"
                        className="sch-btn-secondary"
                        aria-label={`เปิดรายงานของ ${r.student_code}`}
                        onClick={() => setOpenId(r.id)}
                      >
                        เปิด
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
          <Pagination
            pagination={result?.pagination}
            onPage={setPage}
            onLimit={(value) => {
              setLimit(value);
              setPage(1);
            }}
          />
        </DataPanel>
        {openId && (
          <BehaviorReportDetail
            id={openId}
            onClose={() => setOpenId(null)}
            onChanged={load}
          />
        )}
      </main>
    </div>
  );
}
