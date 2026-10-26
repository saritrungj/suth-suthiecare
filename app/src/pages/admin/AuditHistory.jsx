import { useCallback, useEffect, useState } from "react";
import { FiDownload } from "react-icons/fi";
import api from "../../services/api";
import { usePermissions } from "../../permissions/PermissionsProvider";
import DataPanel from "../../components/table/DataPanel";
import ResultSummary from "../../components/table/ResultSummary";
import { DEFAULT_PAGE_SIZE } from "../../components/table/TablePagination";
import { PageHero } from "../../components/dashboard/DashboardKit";
import {
  BarSelect,
  EmptyRow,
  LoadingRows,
  Pagination,
  TableScroll,
  ThaiDateField,
} from "./school/schoolUi";
import { saveBlobResponse } from "../../utils/saveBlob";
import {
  AUDIT_AREAS,
  auditActionLabel,
  auditTargetLabel,
  auditTime,
} from "../../utils/auditLabels";
import "./school/school.css";

const EMPTY = { actor: "", area: "", from: "", to: "", include_reads: "" };

// Who changed what in the active unit, newest first. Values are never shown,
// only the names of the fields that changed.
export default function AuditHistory() {
  const { can, activeOrganization } = usePermissions();
  const canExport = can("audit.export");
  const [filters, setFilters] = useState(EMPTY),
    [page, setPage] = useState(1),
    [limit, setLimit] = useState(DEFAULT_PAGE_SIZE),
    [result, setResult] = useState(null),
    [actors, setActors] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v),
  );
  useEffect(() => {
    api
      .get("/audit-logs/actors")
      .then(({ data }) => setActors(data.actors || []))
      .catch(() => setActors([]));
  }, [activeOrganization]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/audit-logs", {
        params: { ...params, page, limit },
      });
      setResult(data);
      setError("");
    } catch (e) {
      setResult(null);
      setError(e.response?.data?.message || "โหลดประวัติการแก้ไขไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params), page, limit, activeOrganization]);
  useEffect(() => {
    load();
  }, [load]);
  const update = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const exportCsv = async () => {
    try {
      saveBlobResponse(
        await api.get("/audit-logs", {
          params: { ...params, format: "csv" },
          responseType: "blob",
        }),
        "ประวัติการแก้ไข.csv",
      );
    } catch {
      setError("ส่งออกไม่สำเร็จ");
    }
  };
  return (
    <main className="sch-page">
      <PageHero
        title="ประวัติการแก้ไขข้อมูล"
        description="ใครแก้ไขข้อมูลสำคัญของหน่วยงานเมื่อไร แสดงเฉพาะชื่อช่องที่เปลี่ยน ไม่แสดงค่าข้อมูล ประวัติแก้ไขหรือลบไม่ได้"
      />
      <DataPanel className="sch-card">
        <div className="sch-filter-bar">
          <BarSelect
            label="ผู้ดำเนินการ"
            value={filters.actor}
            onChange={update("actor")}
          >
            <option value="">ทุกคน</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </BarSelect>
          <BarSelect
            label="เรื่อง"
            value={filters.area}
            onChange={update("area")}
          >
            <option value="">ทุกเรื่อง</option>
            {Object.entries(AUDIT_AREAS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </BarSelect>
          <ThaiDateField
            label="ตั้งแต่วันที่"
            value={filters.from}
            onChange={update("from")}
          />
          <ThaiDateField
            label="ถึงวันที่"
            value={filters.to}
            onChange={update("to")}
          />
          <BarSelect
            label="การเปิดดูข้อมูล"
            value={filters.include_reads}
            onChange={update("include_reads")}
          >
            <option value="">ไม่รวม</option>
            <option value="1">รวมการเปิดดูข้อมูล</option>
          </BarSelect>
          {canExport && (
            <button
              type="button"
              className="sch-btn-secondary"
              onClick={exportCsv}
            >
              <FiDownload aria-hidden="true" /> ส่งออก CSV
            </button>
          )}
        </div>
        <ResultSummary
          pagination={result?.pagination}
          loading={loading}
          onClearAll={() => {
            setFilters(EMPTY);
            setPage(1);
          }}
          chips={[
            {
              key: "actor",
              label: "ผู้ดำเนินการ",
              value:
                actors.find((a) => String(a.id) === String(filters.actor))
                  ?.name || "",
              onRemove: () => update("actor")(""),
            },
            {
              key: "area",
              label: "เรื่อง",
              value: AUDIT_AREAS[filters.area] || "",
              onRemove: () => update("area")(""),
            },
            {
              key: "from",
              label: "ตั้งแต่",
              value: filters.from,
              onRemove: () => update("from")(""),
            },
            {
              key: "to",
              label: "ถึง",
              value: filters.to,
              onRemove: () => update("to")(""),
            },
            {
              key: "reads",
              label: "การเปิดดู",
              value: filters.include_reads ? "รวม" : "",
              onRemove: () => update("include_reads")(""),
            },
          ]}
        />
        {error && (
          <p className="sch-error" role="alert">
            {error}
          </p>
        )}
        <TableScroll label="ประวัติการแก้ไขข้อมูล">
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
              {loading && !result && <LoadingRows columns={5} />}
              {result && !result.data.length && (
                <EmptyRow columns={5} title="ไม่พบประวัติตามตัวกรอง" />
              )}
              {result?.data.map((row) => (
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
        <Pagination
          pagination={result?.pagination}
          onPage={setPage}
          onLimit={(v) => {
            setLimit(v);
            setPage(1);
          }}
        />
      </DataPanel>
    </main>
  );
}
