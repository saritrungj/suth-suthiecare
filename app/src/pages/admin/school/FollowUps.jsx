import { useCallback, useEffect, useState } from "react";
import { getFollowUps } from "../../../services/api";
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
import { FollowUpDetail, FollowUpStatus, isOverdue } from "./followUpParts";
import "./school.css";

const COLUMNS = 7;
const EMPTY = { q: "", status: "active", overdue: "" };

// Students whose physical check met a risk rule the school approved.
export default function FollowUps() {
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
      const { data } = await getFollowUps({
        ...filters,
        overdue: filters.overdue || undefined,
        page,
        limit,
      });
      setResult(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดรายการติดตามไม่สำเร็จ");
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
  const labels = result?.statuses;
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="ติดตามสุขภาพกาย"
          description="นักเรียนที่ผลตรวจร่างกายเข้าเกณฑ์ภาวะเสี่ยงที่โรงเรียนกำหนด บันทึกผู้รับผิดชอบ กำหนด และผลการติดตาม"
        />
        <DataPanel className="sch-card">
          <div className="sch-filter-bar">
            <SearchField
              label="ค้นหา"
              placeholder="รหัสนักเรียน ชื่อนักเรียน หรือเกณฑ์"
              value={filters.q}
              onChange={update("q")}
            />
            <BarSelect
              label="สถานะ"
              value={filters.status}
              onChange={update("status")}
            >
              <option value="">ทุกสถานะ</option>
              <option value="active">ยังไม่เสร็จ</option>
              {Object.entries(labels || {}).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </BarSelect>
            <BarSelect
              label="กำหนด"
              value={filters.overdue}
              onChange={update("overdue")}
            >
              <option value="">ทั้งหมด</option>
              <option value="1">เลยกำหนด</option>
            </BarSelect>
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
                value:
                  filters.status === "active"
                    ? "ยังไม่เสร็จ"
                    : labels?.[filters.status] || "",
                onRemove: () => update("status")(""),
              },
              {
                key: "overdue",
                label: "กำหนด",
                value: filters.overdue ? "เลยกำหนด" : "",
                onRemove: () => update("overdue")(""),
              },
            ]}
          />
          {error && (
            <p className="sch-error" role="alert">
              {error}
            </p>
          )}
          <TableScroll label="รายการติดตามสุขภาพกาย">
            <table className="sch-table admin-data-table">
              <thead>
                <tr>
                  <th>นักเรียน</th>
                  <th>เกณฑ์ที่พบ</th>
                  <th>ค่าที่ตรวจได้</th>
                  <th>กำหนดติดตาม</th>
                  <th>ผู้รับผิดชอบ</th>
                  <th>สถานะ</th>
                  <th className="is-actions">ดู</th>
                </tr>
              </thead>
              <tbody>
                {loading && !result && <LoadingRows columns={COLUMNS} />}
                {result && !result.data.length && (
                  <EmptyRow
                    columns={COLUMNS}
                    title="ไม่มีรายการที่ต้องติดตาม"
                    hint="รายการจะเกิดเมื่อผลตรวจร่างกายเข้าเกณฑ์ที่ตั้งไว้ในหน้าคัดกรองและติดตาม"
                  />
                )}
                {result?.data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.student_code}</strong>
                      <span className="sch-muted behavior-sub">
                        {item.student_name || ""}
                        {item.classroom_name
                          ? ` · ${[item.grade_name, item.classroom_name].filter(Boolean).join("/")}`
                          : ""}
                      </span>
                    </td>
                    <td>{item.rule_label}</td>
                    <td>
                      {item.value ?? "-"}
                      <span className="sch-muted behavior-sub">
                        {formatThaiDate(item.measured_at)}
                      </span>
                    </td>
                    <td className={isOverdue(item) ? "sch-error" : undefined}>
                      {item.due_on ? formatThaiDate(item.due_on) : "-"}
                      {isOverdue(item) ? " (เลยกำหนด)" : ""}
                    </td>
                    <td>{item.assignee_name || "-"}</td>
                    <td>
                      <FollowUpStatus status={item.status} labels={labels} />
                    </td>
                    <td className="is-actions">
                      <button
                        type="button"
                        className="sch-btn-secondary"
                        aria-label={`เปิดรายการติดตามของ ${item.student_code}`}
                        onClick={() => setOpenId(item.id)}
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
          <FollowUpDetail
            id={openId}
            labels={labels}
            canUpdate={result?.can_update}
            onClose={() => setOpenId(null)}
            onChanged={load}
          />
        )}
      </main>
    </div>
  );
}
