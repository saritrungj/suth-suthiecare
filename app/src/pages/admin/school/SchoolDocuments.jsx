import { useCallback, useEffect, useState } from "react";
import {
  FiDownload,
  FiEdit2,
  FiExternalLink,
  FiFolder,
  FiPlus,
  FiTag,
} from "react-icons/fi";
import {
  createSchoolDocument,
  downloadSchoolDocument,
  getDocumentCategories,
  getSchoolDocuments,
  hideSchoolDocument,
  saveDocumentCategories,
  updateSchoolDocument,
} from "../../../services/api";
import { confirmAlert, showSuccessToast } from "../../../utils/alerts";
import { fileToBase64, saveBlobResponse } from "../../../utils/saveBlob";
import SearchableSelect from "../../../components/SearchableSelect";
import DataPanel from "../../../components/table/DataPanel";
import ResultSummary from "../../../components/table/ResultSummary";
import { DEFAULT_PAGE_SIZE } from "../../../components/table/TablePagination";
import {
  BarSelect,
  EmptyRow,
  LoadingRows,
  PageHeader,
  Pagination,
  SchoolModal,
  SearchField,
  TableScroll,
  formatThaiDate,
  useSchools,
} from "./schoolUi";
import "./school.css";
import "./behavior.css";
import ExportCsvButton from "../../../components/ExportCsvButton";

const ACCEPT = ".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg";
const MAX_MB = 10;
const size = (bytes) =>
  bytes == null
    ? ""
    : bytes > 1048576
      ? `${(bytes / 1048576).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;

function DocumentForm({ schoolId, initial, meta, onClose, onSaved }) {
  const actions = meta.actions || {};
  const [form, setForm] = useState({
    title: initial?.title || "",
    description: initial?.description || "",
    category_id: initial?.category_id ? String(initial.category_id) : "",
    kind: initial?.kind || "file",
    url: initial?.url || "",
    audience: initial?.audience || ["all_staff"],
  });
  const [file, setFile] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const contentEditable = !initial || actions.update;
  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setError("");
    if (!form.title.trim()) return setError("กรุณาตั้งชื่อเอกสาร");
    if (!initial && form.kind === "file" && !file)
      return setError("กรุณาเลือกไฟล์");
    if (file && file.size > MAX_MB * 1048576)
      return setError(`ไฟล์ใหญ่เกิน ${MAX_MB} MB`);
    if (actions.assign && !form.audience.length)
      return setError("กรุณาเลือกผู้มองเห็นอย่างน้อยหนึ่งกลุ่ม");
    setSaving(true);
    try {
      const body = {
        school_id: Number(schoolId),
        title: form.title,
        description: form.description,
        category_id: form.category_id ? Number(form.category_id) : null,
        ...(actions.assign ? { audience: form.audience } : {}),
      };
      if (
        contentEditable &&
        form.kind === "link" &&
        (!initial || form.url !== initial.url || initial.kind !== "link")
      )
        Object.assign(body, { kind: "link", url: form.url });
      if (contentEditable && form.kind === "file" && file)
        Object.assign(body, {
          kind: "file",
          file: { name: file.name, data: await fileToBase64(file) },
        });
      if (initial) await updateSchoolDocument(initial.id, body);
      else await createSchoolDocument(body);
      await showSuccessToast("บันทึกเอกสารแล้ว");
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "บันทึกเอกสารไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      title={initial ? "แก้ไขเอกสาร" : "เพิ่มเอกสาร"}
      onClose={onClose}
      size="small"
    >
      <form className="sch-form-grid" onSubmit={submit} noValidate>
        <label className="sch-field sch-full">
          <span>ชื่อเอกสาร</span>
          <input
            maxLength={200}
            value={form.title}
            disabled={!contentEditable}
            onChange={set("title")}
          />
        </label>
        <label className="sch-field sch-full">
          <span>คำอธิบาย</span>
          <textarea
            rows={2}
            maxLength={2000}
            value={form.description}
            disabled={!contentEditable}
            onChange={set("description")}
          />
        </label>
        <label className="sch-field">
          <span>หมวด</span>
          <SearchableSelect
            aria-label="หมวดเอกสาร"
            value={form.category_id}
            onChange={set("category_id")}
          >
            <option value="">ไม่ระบุหมวด</option>
            {meta.categories
              .filter((c) => c.status !== "inactive")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </SearchableSelect>
        </label>
        {contentEditable && (
          <fieldset className="sch-full behavior-levels">
            <legend>เนื้อหา</legend>
            {[
              ["file", "แนบไฟล์"],
              ["link", "ลิงก์"],
            ].map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="kind"
                  value={value}
                  checked={form.kind === value}
                  onChange={set("kind")}
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        {contentEditable && form.kind === "file" && (
          <label className="sch-field sch-full">
            <span>
              ไฟล์ (PDF, Word, Excel, PowerPoint, PNG, JPG ไม่เกิน {MAX_MB} MB)
              {initial?.file_name ? ` · ไฟล์เดิม: ${initial.file_name}` : ""}
            </span>
            <input
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
        )}
        {contentEditable && form.kind === "link" && (
          <label className="sch-field sch-full">
            <span>ลิงก์</span>
            <input
              type="url"
              inputMode="url"
              placeholder="https://"
              value={form.url}
              onChange={set("url")}
            />
          </label>
        )}
        {actions.assign && (
          <fieldset className="sch-full behavior-levels">
            <legend>ผู้มองเห็น</legend>
            {Object.entries(meta.audiences || {}).map(([code, label]) => (
              <label key={code}>
                <input
                  type="checkbox"
                  checked={form.audience.includes(code)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      audience: e.target.checked
                        ? [...form.audience, code]
                        : form.audience.filter((a) => a !== code),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <p className="sch-error sch-full" role="alert">
            {error}
          </p>
        )}
        <div className="sch-form-actions sch-full">
          <button type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button className="sch-btn" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกเอกสาร"}
          </button>
        </div>
      </form>
    </SchoolModal>
  );
}

function Categories({ schoolId, categories, onSaved }) {
  const [list, setList] = useState(categories),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const update = (i, patch) =>
    setList(list.map((c, j) => (i === j ? { ...c, ...patch } : c)));
  const save = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await saveDocumentCategories({
        school_id: Number(schoolId),
        categories: list.filter((c) => c.id || c.name.trim()),
      });
      await showSuccessToast("บันทึกหมวดแล้ว");
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || "บันทึกหมวดไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="sch-card" aria-labelledby="doc-categories-title">
      <h2 id="doc-categories-title" className="dz-section__title">
        หมวดเอกสาร
      </h2>
      {error && (
        <p className="sch-error" role="alert">
          {error}
        </p>
      )}
      <form className="sch-form-grid" onSubmit={save}>
        {list.map((c, i) => (
          <div className="sch-full appointment-topic" key={c.id || `new-${i}`}>
            <label className="sch-field">
              <span>หมวดที่ {i + 1}</span>
              <input
                maxLength={120}
                value={c.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
            </label>
            <label className="care-approve">
              <input
                type="checkbox"
                checked={c.status !== "inactive"}
                onChange={(e) =>
                  update(i, {
                    status: e.target.checked ? "active" : "inactive",
                  })
                }
              />
              เปิดใช้
            </label>
          </div>
        ))}
        <div className="sch-form-actions sch-full">
          <button
            type="button"
            className="sch-btn-secondary"
            onClick={() => setList([...list, { name: "", status: "active" }])}
          >
            <FiPlus aria-hidden="true" /> เพิ่มหมวด
          </button>
          <button className="sch-btn" disabled={saving}>
            {saving ? "กำลังบันทึก…" : "บันทึกหมวด"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default function SchoolDocuments() {
  const { schools, schoolId, setSchoolId } = useSchools();
  const [meta, setMeta] = useState(null),
    [filters, setFilters] = useState({ q: "", category_id: "", status: "" }),
    [page, setPage] = useState(1),
    [limit, setLimit] = useState(DEFAULT_PAGE_SIZE),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(null),
    [tab, setTab] = useState("library");
  const loadMeta = useCallback(() => {
    if (!schoolId) return;
    getDocumentCategories(schoolId)
      .then(({ data }) => setMeta(data))
      .catch((e) =>
        setError(e.response?.data?.message || "โหลดคลังเอกสารไม่สำเร็จ"),
      );
  }, [schoolId]);
  useEffect(() => {
    loadMeta();
  }, [loadMeta]);
  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const { data } = await getSchoolDocuments({
        ...filters,
        school_id: schoolId,
        page,
        limit,
      });
      setResult(data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.message || "โหลดเอกสารไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters, page, limit]);
  useEffect(() => {
    const t = setTimeout(load, filters.q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, filters.q]);
  const update = (key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  };
  const actions = meta?.actions || {};
  const download = async (doc) => {
    try {
      saveBlobResponse(
        await downloadSchoolDocument(doc.id),
        doc.file_name || doc.title,
      );
    } catch {
      setError("ดาวน์โหลดไม่สำเร็จ");
    }
  };
  const audienceLabel = (doc) =>
    doc.audience.map((a) => meta?.audiences?.[a] || a).join(", ");
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="คลังเอกสาร"
          description="คู่มือ แบบฟอร์ม และแนวทางจากงานส่งเสริมสุขภาวะ ดาวน์โหลดหรือเปิดลิงก์ได้ตามกลุ่มที่เอกสารเปิดให้"
        >
          {schools.length > 1 && (
            <BarSelect label="โรงเรียน" value={schoolId} onChange={setSchoolId}>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </BarSelect>
          )}
          {actions.create && meta && (
            <button
              type="button"
              className="sch-btn"
              onClick={() => setEditing({})}
            >
              <FiPlus aria-hidden="true" /> เพิ่มเอกสาร
            </button>
          )}
        </PageHeader>
        {actions.assign && (
          <nav className="sch-workflow-nav" aria-label="คลังเอกสาร">
            {[
              ["library", "เอกสาร", FiFolder],
              ["categories", "หมวด", FiTag],
            ].map(([key, label, Icon]) => (
              <button
                type="button"
                key={key}
                className={tab === key ? "is-active" : ""}
                aria-current={tab === key ? "page" : undefined}
                onClick={() => setTab(key)}
              >
                <Icon aria-hidden="true" /> {label}
              </button>
            ))}
          </nav>
        )}
        {tab === "categories" && meta && (
          <Categories
            schoolId={schoolId}
            categories={meta.categories}
            onSaved={() => {
              loadMeta();
              load();
            }}
          />
        )}
        {tab === "library" && (
          <DataPanel className="sch-card">
            <div className="sch-filter-bar">
              <SearchField
                label="ค้นหา"
                placeholder="ชื่อเอกสาร คำอธิบาย หรือชื่อไฟล์"
                value={filters.q}
                onChange={update("q")}
              />
              <BarSelect
                label="หมวด"
                value={filters.category_id}
                onChange={update("category_id")}
              >
                <option value="">ทุกหมวด</option>
                {(meta?.categories || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </BarSelect>
              {(actions.update || actions.delete) && (
                <BarSelect
                  label="สถานะ"
                  value={filters.status}
                  onChange={update("status")}
                >
                  <option value="">ใช้งาน</option>
                  <option value="hidden">ซ่อนแล้ว</option>
                </BarSelect>
              )}
              {actions.export && (
                <ExportCsvButton
                  path="/school/documents"
                  params={{ ...filters, school_id: schoolId }}
                  fileName="รายการเอกสาร.csv"
                />
              )}
            </div>
            <ResultSummary
              pagination={result?.pagination}
              loading={loading}
              onClearAll={() => {
                setFilters({ q: "", category_id: "", status: "" });
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
                  key: "category",
                  label: "หมวด",
                  value:
                    meta?.categories?.find(
                      (c) => String(c.id) === String(filters.category_id),
                    )?.name || "",
                  onRemove: () => update("category_id")(""),
                },
                {
                  key: "status",
                  label: "สถานะ",
                  value: filters.status ? "ซ่อนแล้ว" : "",
                  onRemove: () => update("status")(""),
                },
              ]}
            />
            {error && (
              <p className="sch-error" role="alert">
                {error}
              </p>
            )}
            <TableScroll label="คลังเอกสาร">
              <table className="sch-table admin-data-table">
                <thead>
                  <tr>
                    <th>เอกสาร</th>
                    <th>หมวด</th>
                    {actions.assign && <th>ผู้มองเห็น</th>}
                    <th>ปรับปรุงล่าสุด</th>
                    <th className="is-actions">จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !result && <LoadingRows columns={5} />}
                  {result && !result.data.length && (
                    <EmptyRow columns={5} title="ยังไม่มีเอกสาร" />
                  )}
                  {result?.data.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <strong>{doc.title}</strong>
                        <span className="sch-muted behavior-sub">
                          {doc.description}
                          {doc.kind === "file"
                            ? ` · ${doc.file_name || ""} ${size(doc.size_bytes)}`
                            : " · ลิงก์"}
                        </span>
                      </td>
                      <td>{doc.category_name || "-"}</td>
                      {actions.assign && <td>{audienceLabel(doc)}</td>}
                      <td>{formatThaiDate(doc.updated_at)}</td>
                      <td className="is-actions">
                        {doc.kind === "file" ? (
                          <button
                            type="button"
                            className="sch-btn-secondary"
                            aria-label={`ดาวน์โหลด ${doc.title}`}
                            onClick={() => download(doc)}
                          >
                            <FiDownload aria-hidden="true" />
                          </button>
                        ) : (
                          <a
                            className="sch-btn-secondary"
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`เปิดลิงก์ ${doc.title}`}
                          >
                            <FiExternalLink aria-hidden="true" />
                          </a>
                        )}
                        {(actions.update || actions.assign) && (
                          <button
                            type="button"
                            className="sch-btn-secondary"
                            aria-label={`แก้ไข ${doc.title}`}
                            onClick={() => setEditing(doc)}
                          >
                            <FiEdit2 aria-hidden="true" />
                          </button>
                        )}
                        {actions.delete && doc.status === "active" && (
                          <button
                            type="button"
                            className="sch-btn-ghost behavior-cancel"
                            onClick={async () => {
                              if (
                                await confirmAlert({
                                  title: "ซ่อนเอกสารนี้?",
                                  text: doc.title,
                                  confirmText: "ซ่อนเอกสาร",
                                  danger: true,
                                })
                              ) {
                                await hideSchoolDocument(doc.id);
                                load();
                              }
                            }}
                          >
                            ซ่อน
                          </button>
                        )}
                        {actions.delete && doc.status === "hidden" && (
                          <button
                            type="button"
                            className="sch-btn-secondary"
                            onClick={async () => {
                              await updateSchoolDocument(doc.id, {
                                title: doc.title,
                                description: doc.description,
                                category_id: doc.category_id,
                                status: "active",
                              });
                              load();
                            }}
                          >
                            แสดงอีกครั้ง
                          </button>
                        )}
                      </td>
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
        )}
        {editing && meta && (
          <DocumentForm
            schoolId={schoolId}
            initial={editing.id ? editing : null}
            meta={meta}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
            }}
          />
        )}
      </main>
    </div>
  );
}
