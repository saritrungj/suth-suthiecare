import TablePagination from "../../components/table/TablePagination";
import usePagedRows from "../../components/table/usePagedRows";
import ResultSummary from "../../components/table/ResultSummary";
import SearchableSelect from "../../components/SearchableSelect";
import { toDisplayText } from "../../utils/textPresentation.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiEdit2,
  FiLock,
  FiPlus,
  FiRefreshCw,
} from "react-icons/fi";
import api from "../../services/api";
import { usePageExport } from "../../components/ExcelExport";
import { invalidateMasterOptions } from "../../components/MasterSelect";
import { usePermissions } from "../../permissions/PermissionsProvider";
import { getSelectableOrganizations } from "../../permissions/organizationContext";
import {
  PageHeader,
  SearchField,
  BarSelect,
  TableScroll,
  SchoolModal,
  EmptyRow,
  LoadingRows,
} from "./school/schoolUi";
import { DEFAULT_RECORD_COLOR } from "../../utils/dataColors";
import "./school/school.css";
import "./master-data.css";

const labels = {
  name: "ชื่อ",
  description: "คำอธิบาย",
  label: "ชื่อรายการ",
  text: "ข้อความแม่แบบ",
  color: "สี",
  clinic_type: "ประเภทคลินิก",
};
// Category groups in the order the category list shows them.
const GROUPS = [
  ["general", "ข้อมูลทั่วไป"],
  ["school", "ข้อมูลโรงเรียน"],
  ["service", "งานบริการและเคส"],
  ["system", "รหัสระบบ"],
];
const messageOf = (error, fallback) =>
  error.response?.data?.message || fallback;
const formatCount = (value) => Number(value || 0).toLocaleString("th-TH");

export default function MasterData() {
  return <MasterDataContent />;
}

function MasterDataContent() {
  const { activeOrganization, authorization } = usePermissions();
  const system = authorization?.is_system_admin === true;
  const [organization, setOrganization] = useState(
    system ? "all" : activeOrganization,
  );
  const organizations = getSelectableOrganizations(authorization).filter(
    (org) =>
      org.org_level !== "main" && (!org.status || org.status === "active"),
  );
  const params = system ? { organization_id: organization } : {};
  const all = system && organization === "all";
  const [searchParams, setSearchParams] = useSearchParams();
  const category = searchParams.get("category") || "";
  const setCategory = useCallback(
    (code) =>
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (code) next.set("category", code);
          else next.delete("category");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [manage, setManage] = useState(false);
  // Per-action rights from the roles page (create, update, delete = on/off, assign = order).
  const [actions, setActions] = useState({});
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [revision, setRevision] = useState(0);
  const requestVersion = useRef(0);
  const selected = categories.find((item) => item.code === category);
  const fields = selected?.fields || ["label"];
  const hasCode = !fields.includes("name") && !fields.includes("text");
  const hasUsage = rows.some((row) => row.usage_count !== undefined);
  const hasColor = fields.includes("color");
  const canCreate =
    manage && actions.create !== false && !all && selected && !selected.fixed;
  const groups = useMemo(
    () =>
      GROUPS.map(([key, label]) => ({
        key,
        label,
        items: categories.filter((item) => (item.group || "general") === key),
      })).filter((group) => group.items.length),
    [categories],
  );

  usePageExport({
    title: selected?.label || "ข้อมูลหลัก",
    sources: category
      ? [{ resource: "master", id: category, filters: params }]
      : [],
    disabled: !category || loading || Boolean(error),
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/master-data/categories", { params })
      .then(({ data }) => {
        if (!alive) return;
        const list = data.categories || [];
        setCategories(list);
        setManage(Boolean(data.can_manage));
        setActions(data.actions || {});
        if (!list.some((item) => item.code === category))
          setCategory(list[0]?.code || "");
        if (!list.length) setLoading(false);
      })
      .catch((error) => {
        if (alive) {
          setError(messageOf(error, "โหลดหมวดข้อมูลไม่สำเร็จ กรุณาลองใหม่"));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // The category is checked against the fresh list, not refetched on change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, organization]);

  const loadRows = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const { data } = await api.get(`/master-data/${category}`, { params });
      if (version === requestVersion.current) setRows(data);
    } catch (error) {
      if (version === requestVersion.current)
        setError(messageOf(error, "โหลดข้อมูลหลักไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, organization]);
  useEffect(() => {
    setEditing(null);
    setSearch("");
    setStatus("");
    setNotice("");
    if (category && categories.some((item) => item.code === category))
      loadRows();
    return () => {
      requestVersion.current++;
    };
  }, [category, categories, loadRows, revision, organization]);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!status || Boolean(row.is_active) === (status === "active")) &&
          [
            row.code,
            row.label,
            row.name,
            row.description,
            row.organization_name,
          ].some((value) =>
            String(value || "")
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
          ),
      ),
    [rows, search, status],
  );
  const { pageRows, pagination, setPage, setLimit } = usePagedRows(visible, {
    resetKeys: [category, search, status],
  });
  const columnCount =
    3 +
    (all ? 1 : 0) +
    (hasCode ? 1 : 0) +
    (hasUsage ? 1 : 0) +
    (manage ? 1 : 0);

  const openEditor = (row) => {
    setEditorError("");
    setNotice("");
    setEditing({ ...row, was_active: row.is_active });
  };
  const closeEditor = () => {
    if (!saving) setEditing(null);
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setEditorError("");
    try {
      const data = {
        ...Object.fromEntries(fields.map((key) => [key, editing[key] || ""])),
        ...(hasCode ? { code: editing.code } : {}),
        sort_order: Number(editing.sort_order),
        is_active: Boolean(editing.is_active),
      };
      if (editing.id)
        await api.put(`/master-data/${category}/${editing.id}`, data, {
          params: {
            ...params,
            ...(editing.organization_id
              ? { organization_id: editing.organization_id }
              : {}),
          },
        });
      else await api.post(`/master-data/${category}`, data, { params });
      invalidateMasterOptions(
        category,
        editing.organization_id || organization,
      );
      setEditing(null);
      setNotice("บันทึกข้อมูลหลักเรียบร้อยแล้ว");
      await loadRows();
    } catch (error) {
      setEditorError(
        messageOf(error, "บันทึกข้อมูลหลักไม่สำเร็จ กรุณาลองใหม่"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sch-wrapper organization-workspace">
      <main className="sch-page master-page">
        <PageHeader
          title="จัดการข้อมูลหลัก"
          description={
            system
              ? "จัดการตัวเลือกและแม่แบบของทุกหน่วยงานในระบบ"
              : "จัดการตัวเลือกและแม่แบบของหน่วยงานคุณ"
          }
        />
        {system && (
          <label className="sch-field master-organization">
            หน่วยงานที่จัดการ
            <SearchableSelect
              value={organization}
              onChange={(event) => {
                setOrganization(event.target.value);
                setRows([]);
                setCategories([]);
                setEditing(null);
              }}
            >
              <option value="all">ทุกหน่วยงาน</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
        )}

        <section className="master-workspace" aria-label="รายการข้อมูลหลัก">
          <nav className="master-rail" aria-label="หมวดข้อมูล">
            {groups.map((group) => (
              <div className="master-rail-group" key={group.key}>
                <h2 className="master-rail-title">{group.label}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.code}>
                      <button
                        type="button"
                        aria-current={
                          item.code === category ? "true" : undefined
                        }
                        onClick={() => setCategory(item.code)}
                      >
                        {item.fixed && (
                          <FiLock
                            className="master-rail-lock"
                            aria-hidden="true"
                          />
                        )}
                        <span className="master-rail-label">
                          {toDisplayText(item.label)}
                        </span>
                        {item.count !== undefined && (
                          <span className="master-rail-count">
                            {formatCount(item.count)}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="master-panel">
            <label className="sch-field master-category-select">
              หมวดข้อมูล
              <SearchableSelect
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={!categories.length}
              >
                {groups.map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item.code} value={item.code}>
                        {toDisplayText(item.label)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SearchableSelect>
            </label>

            <header className="master-panel-head">
              <div>
                <h2>
                  {toDisplayText(selected?.label || "ข้อมูลหลัก")}
                  {selected?.fixed && (
                    <span className="master-fixed-tag">
                      <FiLock aria-hidden="true" />
                      รหัสระบบ
                    </span>
                  )}
                </h2>
                {selected?.hint && <p>{toDisplayText(selected.hint)}</p>}
              </div>
              {canCreate && (
                <button
                  type="button"
                  className="sch-btn"
                  disabled={loading || Boolean(error)}
                  onClick={() =>
                    openEditor({
                      code: "",
                      label: "",
                      name: "",
                      text: "",
                      color: "var(--suth-info)",
                      clinic_type: "general",
                      description: "",
                      sort_order:
                        Math.max(
                          -1,
                          ...rows.map((row) => Number(row.sort_order) || 0),
                        ) + 1,
                      is_active: true,
                    })
                  }
                >
                  <FiPlus aria-hidden="true" />
                  เพิ่มรายการ
                </button>
              )}
            </header>

            <div className="sch-filter-bar master-toolbar">
              <SearchField
                label="ค้นหารายการ"
                placeholder={
                  hasCode ? "ค้นหารหัสหรือชื่อรายการ" : "ค้นหาชื่อรายการ"
                }
                value={search}
                onChange={setSearch}
              />
              <BarSelect label="สถานะ" value={status} onChange={setStatus}>
                <option value="">ทุกสถานะ</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </BarSelect>
              <button
                type="button"
                className="sch-icon-btn master-reload"
                aria-label="โหลดใหม่"
                title="โหลดใหม่"
                disabled={loading}
                onClick={() => setRevision((value) => value + 1)}
              >
                <FiRefreshCw aria-hidden="true" />
              </button>
            </div>

            <ResultSummary
              loading={loading}
              pagination={pagination}
              chips={[
                {
                  key: "status",
                  label: "สถานะ",
                  value:
                    status === "active"
                      ? "ใช้งาน"
                      : status === "inactive"
                        ? "ปิดใช้งาน"
                        : "",
                  onRemove: () => setStatus(""),
                },
              ]}
            />

            {selected?.fixed && (
              <p className="master-note">
                รหัสในหมวดนี้ควบคุมการทำงานของระบบ แก้ชื่อที่แสดง ลำดับ
                หรือเปิดปิดได้ แต่เพิ่มหรือเปลี่ยนรหัสไม่ได้
              </p>
            )}
            {!manage && !loading && !error && (
              <p className="master-note">
                คุณมีสิทธิ์ดูข้อมูลหลัก หากต้องการแก้ไข กรุณาติดต่อผู้ดูแลระบบ
              </p>
            )}
            {notice && (
              <p className="master-success" role="status">
                {notice}
              </p>
            )}
            {error && (
              <div className="sch-error" role="alert">
                {error}
              </div>
            )}

            <TableScroll label="ตารางข้อมูลหลัก">
              <table
                className="sch-table admin-data-table master-table"
                aria-busy={loading}
              >
                <thead>
                  <tr>
                    {all && <th>หน่วยงาน</th>}
                    {hasCode && <th>รหัส</th>}
                    <th>ชื่อรายการ</th>
                    {hasUsage && <th className="sch-num">ใช้อยู่</th>}
                    <th className="sch-num">ลำดับ</th>
                    <th>สถานะ</th>
                    {manage && <th className="sch-actions-col">จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <LoadingRows columns={columnCount} />
                  ) : error ? (
                    <EmptyRow
                      columns={columnCount}
                      title="ยังแสดงข้อมูลไม่ได้"
                      hint="กดโหลดใหม่เพื่อลองอีกครั้ง"
                    />
                  ) : !visible.length ? (
                    <EmptyRow
                      columns={columnCount}
                      title={
                        search || status
                          ? "ไม่พบรายการตามตัวกรอง"
                          : "ยังไม่มีรายการในหมวดนี้"
                      }
                      hint={
                        search || status
                          ? "ลองเปลี่ยนคำค้นหาหรือสถานะ"
                          : canCreate
                            ? "กดเพิ่มรายการเพื่อเริ่มใช้งาน"
                            : undefined
                      }
                    />
                  ) : (
                    pageRows.map((row) => (
                      <tr
                        key={`${row.organization_id || organization}-${row.id}`}
                      >
                        {all && <td>{toDisplayText(row.organization_name)}</td>}
                        {hasCode && <td className="sch-code">{row.code}</td>}
                        <td className="sch-name">
                          <span className="master-name">
                            {hasColor && row.color && (
                              <span
                                className="master-swatch"
                                style={{ background: row.color }}
                                aria-hidden="true"
                              />
                            )}
                            {toDisplayText(row.label)}
                          </span>
                          {row.description && (
                            <div className="sch-muted">
                              {toDisplayText(row.description)}
                            </div>
                          )}
                        </td>
                        {hasUsage && (
                          <td className="sch-num">
                            {formatCount(row.usage_count)}
                          </td>
                        )}
                        <td className="sch-num">{row.sort_order}</td>
                        <td>
                          <span
                            className={`master-status ${row.is_active ? "is-active" : "is-inactive"}`}
                          >
                            {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        {manage && (
                          <td className="is-actions">
                            <button
                              type="button"
                              className="sch-icon-btn"
                              aria-label="แก้ไข"
                              title={`แก้ไข ${row.label || ""}`}
                              onClick={() =>
                                openEditor({
                                  ...row,
                                  is_active: Boolean(row.is_active),
                                })
                              }
                            >
                              <FiEdit2 aria-hidden="true" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableScroll>
            <TablePagination
              page={pagination.page}
              totalPages={pagination.total_pages}
              total={pagination.total}
              limit={pagination.limit}
              onPage={setPage}
              onLimit={setLimit}
            />
          </div>
        </section>

        {editing && selected && (
          <SchoolModal
            title={editing.id ? "แก้ไขรายการ" : "เพิ่มรายการ"}
            subtitle={
              editing.organization_name
                ? `${selected.label} · ${editing.organization_name}`
                : selected.label
            }
            onClose={closeEditor}
            size="small"
            footer={
              <div className="sch-form-actions">
                <button
                  type="button"
                  className="sch-btn sch-btn-secondary"
                  onClick={closeEditor}
                  disabled={saving}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  form="master-data-form"
                  className="sch-btn"
                  disabled={saving}
                >
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            }
          >
            <form
              id="master-data-form"
              className="sch-form-grid"
              onSubmit={save}
              aria-busy={saving}
            >
              {editorError && (
                <p className="sch-error sch-full" role="alert">
                  {editorError}
                </p>
              )}
              {hasCode && (
                <label className="sch-field sch-full">
                  รหัส
                  <input
                    aria-label="รหัส"
                    required
                    maxLength={64}
                    pattern="[a-zA-Z0-9_.\-]+"
                    disabled={Boolean(editing.id) || saving}
                    value={editing.code}
                    onChange={(event) =>
                      setEditing({ ...editing, code: event.target.value })
                    }
                  />
                  <small className="sch-field-hint">
                    ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง
                    เมื่อสร้างแล้วเปลี่ยนรหัสไม่ได้
                  </small>
                </label>
              )}
              {fields.map((key) => {
                const wide =
                  key === "text" ||
                  key === "description" ||
                  key === "name" ||
                  key === "label";
                return (
                  <label
                    className={`sch-field ${wide ? "sch-full" : ""}`}
                    key={key}
                  >
                    {labels[key] || key}
                    {key === "text" || key === "description" ? (
                      <textarea
                        required={key !== "description"}
                        disabled={saving}
                        maxLength={key === "text" ? 4000 : 255}
                        rows={key === "text" ? 6 : 3}
                        value={editing[key] || ""}
                        onChange={(event) =>
                          setEditing({ ...editing, [key]: event.target.value })
                        }
                      />
                    ) : (
                      <input
                        required
                        disabled={
                          saving ||
                          (Boolean(editing.id) &&
                            selected.locked_fields?.includes(key))
                        }
                        maxLength={key === "name" && !hasCode ? 100 : 255}
                        type={key === "color" ? "color" : "text"}
                        value={
                          editing[key] || (key === "color" ? DEFAULT_RECORD_COLOR : "")
                        }
                        onChange={(event) =>
                          setEditing({ ...editing, [key]: event.target.value })
                        }
                      />
                    )}
                  </label>
                );
              })}
              <label className="sch-field">
                ลำดับ
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  required
                  disabled={
                    saving || (Boolean(editing.id) && actions.assign === false)
                  }
                  value={editing.sort_order}
                  onChange={(event) =>
                    setEditing({ ...editing, sort_order: event.target.value })
                  }
                />
              </label>
              <label className="master-active">
                <input
                  type="checkbox"
                  disabled={
                    saving || (Boolean(editing.id) && actions.delete === false)
                  }
                  checked={editing.is_active}
                  onChange={(event) =>
                    setEditing({ ...editing, is_active: event.target.checked })
                  }
                />
                ใช้งาน
              </label>
              {editing.was_active &&
                !editing.is_active &&
                Number(editing.usage_count) > 0 && (
                  <p className="master-usage-warning sch-full" role="note">
                    <FiAlertTriangle aria-hidden="true" />
                    ยังมี {formatCount(editing.usage_count)} คนใช้รายการนี้อยู่
                    ข้อมูลเดิมจะยังแสดงอยู่ แต่จะเลือกรายการนี้ใหม่ไม่ได้
                  </p>
                )}
            </form>
          </SchoolModal>
        )}
      </main>
    </div>
  );
}
