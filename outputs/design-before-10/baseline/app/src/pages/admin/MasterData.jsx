import { toDisplayText } from "../../utils/textPresentation.js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import api from "../../services/api";
import { usePageExport } from "../../components/ExcelExport";
import { invalidateMasterOptions } from "../../components/MasterSelect";
import { usePermissions } from "../../permissions/PermissionsProvider";
import OrganizationWorkspace from "../../permissions/OrganizationWorkspace";
import {
  PageHeader,
  TableScroll,
  SchoolModal,
  EmptyRow,
  LoadingRows,
} from "./school/schoolUi";
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
const messageOf = (error, fallback) =>
  error.response?.data?.message || fallback;

export default function MasterData() {
  return (
    <OrganizationWorkspace>
      <MasterDataContent />
    </OrganizationWorkspace>
  );
}

function MasterDataContent() {
  const { activeOrganization } = usePermissions();
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("");
  const [rows, setRows] = useState([]);
  const [manage, setManage] = useState(false);
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

  usePageExport({
    title: selected?.label || "ข้อมูลหลัก",
    sources: category ? [{ resource: "master", id: category }] : [],
    disabled: !category || loading || Boolean(error),
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    api
      .get("/master-data/categories")
      .then(({ data }) => {
        if (!alive) return;
        setCategories(data.categories || []);
        setManage(Boolean(data.can_manage));
        setCategory((current) =>
          data.categories?.some((item) => item.code === current)
            ? current
            : data.categories?.[0]?.code || "",
        );
        if (!data.categories?.length) setLoading(false);
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
  }, [revision]);

  const loadRows = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    setRows([]);
    try {
      const { data } = await api.get(`/master-data/${category}`);
      if (version === requestVersion.current) setRows(data);
    } catch (error) {
      if (version === requestVersion.current)
        setError(messageOf(error, "โหลดข้อมูลหลักไม่สำเร็จ กรุณาลองใหม่"));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [category]);
  useEffect(() => {
    setEditing(null);
    setSearch("");
    setStatus("");
    setNotice("");
    if (category) loadRows();
    return () => {
      requestVersion.current++;
    };
  }, [category, loadRows, revision]);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) =>
          (!status || Boolean(row.is_active) === (status === "active")) &&
          [row.code, row.label, row.name, row.description].some((value) =>
            String(value || "")
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase()),
          ),
      ),
    [rows, search, status],
  );

  const openEditor = (row) => {
    setEditorError("");
    setNotice("");
    setEditing(row);
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
        await api.put(`/master-data/${category}/${editing.id}`, data);
      else await api.post(`/master-data/${category}`, data);
      invalidateMasterOptions(category, activeOrganization);
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
    <div className="sch-wrapper">
      <main className="sch-page master-page">
        <PageHeader
          title="จัดการข้อมูลหลัก"
          description="จัดการตัวเลือกและแม่แบบที่ใช้ร่วมกันภายในหน่วยงาน"
        >
          {manage && selected && !selected.fixed && (
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
                  color: "#1d5c8c",
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
        </PageHeader>
        <section className="sch-card" aria-label="รายการข้อมูลหลัก">
          <div className="master-filters">
            <label className="sch-field">
              หมวดข้อมูล
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                disabled={!categories.length}
              >
                {categories.map((item) => (
                  <option key={item.code} value={item.code}>
                    {toDisplayText(item.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="sch-field master-search">
              ค้นหารายการ
              <div className="sch-search-group">
                <FiSearch aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ค้นหารหัสหรือชื่อรายการ"
                />
              </div>
            </label>
            <label className="sch-field">
              สถานะ
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </select>
            </label>
            <button
              type="button"
              className="sch-btn sch-btn-secondary"
              disabled={loading}
              onClick={() => setRevision((value) => value + 1)}
            >
              <FiRefreshCw aria-hidden="true" />
              โหลดใหม่
            </button>
          </div>
          {selected?.fixed && (
            <p className="sch-muted master-note">
              รหัสรายการควบคุมการทำงานของระบบ เปลี่ยนรหัสหรือเพิ่มรหัสใหม่ไม่ได้
            </p>
          )}
          {!manage && !loading && !error && (
            <p className="sch-muted master-note">
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
          <div className="sch-card-head master-table-heading">
            <h2>{selected?.label || "ข้อมูลหลัก"}</h2>
            <span className="sch-muted">
              {loading
                ? "กำลังโหลด…"
                : `${visible.length.toLocaleString("th-TH")} จาก ${rows.length.toLocaleString("th-TH")} รายการ`}
            </span>
          </div>
          <TableScroll label="ตารางข้อมูลหลัก">
            <table className="sch-table" aria-busy={loading}>
              <thead>
                <tr>
                  <th>รหัส</th>
                  <th>ชื่อรายการ</th>
                  <th className="sch-num">ลำดับ</th>
                  <th>สถานะ</th>
                  {manage && <th className="sch-actions-col">จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <LoadingRows columns={manage ? 5 : 4} />
                ) : error ? (
                  <EmptyRow
                    columns={manage ? 5 : 4}
                    title="ยังแสดงข้อมูลไม่ได้"
                    hint="กดโหลดใหม่เพื่อลองอีกครั้ง"
                  />
                ) : !visible.length ? (
                  <EmptyRow
                    columns={manage ? 5 : 4}
                    title={
                      search || status
                        ? "ไม่พบรายการตามตัวกรอง"
                        : "ยังไม่มีรายการในหมวดนี้"
                    }
                    hint={
                      search || status
                        ? "ลองเปลี่ยนคำค้นหาหรือสถานะ"
                        : manage && !selected?.fixed
                          ? "กดเพิ่มรายการเพื่อเริ่มใช้งาน"
                          : undefined
                    }
                  />
                ) : (
                  visible.map((row) => (
                    <tr key={row.id}>
                      <td className="sch-code">{row.code}</td>
                      <td className="sch-name">
                        {toDisplayText(row.label)}
                        {row.description && (
                          <div className="sch-muted">
                            {toDisplayText(row.description)}
                          </div>
                        )}
                      </td>
                      <td className="sch-num">{row.sort_order}</td>
                      <td>
                        <span
                          className={`sch-badge status-${row.is_active ? "active" : "inactive"}`}
                        >
                          {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                        </span>
                      </td>
                      {manage && (
                        <td>
                          <button
                            type="button"
                            className="sch-btn sch-btn-secondary"
                            onClick={() =>
                              openEditor({
                                ...row,
                                is_active: Boolean(row.is_active),
                              })
                            }
                          >
                            <FiEdit2 aria-hidden="true" />
                            แก้ไข
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
        </section>
        {editing && selected && (
          <SchoolModal
            title={editing.id ? "แก้ไขรายการ" : "เพิ่มรายการ"}
            subtitle={selected.label}
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
              {fields.map((key) => (
                <label
                  className={`sch-field ${key === "text" || key === "description" ? "sch-full" : ""}`}
                  key={key}
                >
                  {labels[key] || key}
                  {key === "text" || key === "description" ? (
                    <textarea
                      required={key !== "description"}
                      disabled={saving}
                      maxLength={key === "text" ? 4000 : 255}
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
                      maxLength={255}
                      type={key === "color" ? "color" : "text"}
                      value={editing[key] || (key === "color" ? "#1d5c8c" : "")}
                      onChange={(event) =>
                        setEditing({ ...editing, [key]: event.target.value })
                      }
                    />
                  )}
                </label>
              ))}
              <label className="sch-field">
                ลำดับ
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="1"
                  required
                  disabled={saving}
                  value={editing.sort_order}
                  onChange={(event) =>
                    setEditing({ ...editing, sort_order: event.target.value })
                  }
                />
              </label>
              <label className="master-active">
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={editing.is_active}
                  onChange={(event) =>
                    setEditing({ ...editing, is_active: event.target.checked })
                  }
                />
                ใช้งาน
              </label>
            </form>
          </SchoolModal>
        )}
      </main>
    </div>
  );
}
