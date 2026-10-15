import { Surface as UiSurface, Badge as UiBadge } from '../../components/ui/index.jsx';
import { Button as UiButton, TextInput as UiTextInput, DataTable as UiDataTable, TextArea as UiTextArea } from '../../components/ui/index.jsx';
import SearchableSelect from '../../components/SearchableSelect';
import { toDisplayText } from '../../utils/textPresentation.js';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiEdit2, FiPlus, FiRefreshCw, FiSearch } from "react-icons/fi";
import api from "../../services/api";
import { usePageExport } from "../../components/ExcelExport";
import { invalidateMasterOptions } from "../../components/MasterSelect";
import { usePermissions } from "../../permissions/PermissionsProvider";
import { getSelectableOrganizations } from "../../permissions/organizationContext";
import { PageHeader, TableScroll, SchoolModal, EmptyRow, LoadingRows } from "./school/schoolUi";
import "./school/school.css";
import "./master-data.css";

const labels = { name: "ชื่อ", description: "คำอธิบาย", label: "ชื่อรายการ", text: "ข้อความแม่แบบ", color: "สี", clinic_type: "ประเภทคลินิก" };
const messageOf = (error, fallback) => error.response?.data?.message || fallback;

export default function MasterData() {
  return <MasterDataContent />;
}

function MasterDataContent() {
  const { activeOrganization, authorization } = usePermissions();
  const system = authorization?.is_system_admin === true;
  const [organization, setOrganization] = useState(system ? 'all' : activeOrganization);
  const organizations = getSelectableOrganizations(authorization).filter(org => org.org_level !== 'main' && (!org.status || org.status === 'active'));
  const params = system ? { organization_id: organization } : {};
  const all = system && organization === 'all';
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
  const selected = categories.find(item => item.code === category);
  const fields = selected?.fields || ["label"];
  const hasCode = !fields.includes("name") && !fields.includes("text");

  usePageExport({ title: selected?.label || "ข้อมูลหลัก", sources: category ? [{ resource: "master", id: category, filters: params }] : [], disabled: !category || loading || Boolean(error) });

  useEffect(() => {
    let alive = true;
    setLoading(true); setError("");
    api.get("/master-data/categories", { params }).then(({ data }) => {
      if (!alive) return;
      setCategories(data.categories || []); setManage(Boolean(data.can_manage));
      setCategory(current => data.categories?.some(item => item.code === current) ? current : data.categories?.[0]?.code || "");
      if (!data.categories?.length) setLoading(false);
    }).catch(error => { if (alive) { setError(messageOf(error, "โหลดหมวดข้อมูลไม่สำเร็จ กรุณาลองใหม่")); setLoading(false); } });
    return () => { alive = false; };
  }, [revision, organization]);

  const loadRows = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true); setError(""); setRows([]);
    try {
      const { data } = await api.get(`/master-data/${category}`, { params });
      if (version === requestVersion.current) setRows(data);
    } catch (error) {
      if (version === requestVersion.current) setError(messageOf(error, "โหลดข้อมูลหลักไม่สำเร็จ กรุณาลองใหม่"));
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [category, organization]);
  useEffect(() => {
    setEditing(null); setSearch(""); setStatus(""); setNotice("");
    if (category) loadRows();
    return () => { requestVersion.current++; };
  }, [category, loadRows, revision, organization]);

  const visible = useMemo(() => rows.filter(row =>
    (!status || Boolean(row.is_active) === (status === "active")) &&
    [row.code, row.label, row.name, row.description, row.organization_name].some(value => String(value || "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),
  ), [rows, search, status]);

  const openEditor = row => { setEditorError(""); setNotice(""); setEditing(row); };
  const closeEditor = () => { if (!saving) setEditing(null); };
  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setEditorError("");
    try {
      const data = { ...Object.fromEntries(fields.map(key => [key, editing[key] || ""])), ...(hasCode ? { code: editing.code } : {}), sort_order: Number(editing.sort_order), is_active: Boolean(editing.is_active) };
      if (editing.id) await api.put(`/master-data/${category}/${editing.id}`, data, { params: { ...params, ...(editing.organization_id ? { organization_id: editing.organization_id } : {}) } });
      else await api.post(`/master-data/${category}`, data, { params });
      invalidateMasterOptions(category, editing.organization_id || organization);
      setEditing(null); setNotice("บันทึกข้อมูลหลักเรียบร้อยแล้ว");
      await loadRows();
    } catch (error) { setEditorError(messageOf(error, "บันทึกข้อมูลหลักไม่สำเร็จ กรุณาลองใหม่")); }
    finally { setSaving(false); }
  };

  return <div className="sch-wrapper organization-workspace"><main className="sch-page master-page">
    <PageHeader title="จัดการข้อมูลหลัก" description={system ? "จัดการตัวเลือกและแม่แบบของทุกหน่วยงานในระบบ" : "จัดการตัวเลือกและแม่แบบของหน่วยงานคุณ"}>
      {manage && !all && selected && !selected.fixed && <UiButton variant="primary" type="button" className="sch-btn" disabled={loading || Boolean(error)} onClick={() => openEditor({ code: "", label: "", name: "", text: "", color: "#1d5c8c", clinic_type: "general", description: "", sort_order: Math.max(-1, ...rows.map(row => Number(row.sort_order) || 0)) + 1, is_active: true })}><FiPlus aria-hidden="true" />เพิ่มรายการ</UiButton>}
    </PageHeader>
    <UiSurface as="section" className="sch-card" aria-label="รายการข้อมูลหลัก">
      <div className="master-filters">
        {system && <label className="sch-field">หน่วยงานที่จัดการ<SearchableSelect value={organization} onChange={event => { setOrganization(event.target.value); setRows([]); setCategories([]); setCategory(''); setEditing(null); }}><option value="all">ทุกหน่วยงาน</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</SearchableSelect></label>}
        <label className="sch-field">หมวดข้อมูล<SearchableSelect value={category} onChange={event => setCategory(event.target.value)} disabled={!categories.length}>{categories.map(item => <option key={item.code} value={item.code}>{toDisplayText(item.label)}</option>)}</SearchableSelect></label>
        <label className="sch-field master-search">ค้นหารายการ<div className="sch-search-group"><FiSearch aria-hidden="true" /><UiTextInput type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัสหรือชื่อรายการ" /></div></label>
        <label className="sch-field">สถานะ<SearchableSelect value={status} onChange={event => setStatus(event.target.value)}><option value="">ทั้งหมด</option><option value="active">ใช้งาน</option><option value="inactive">ปิดใช้งาน</option></SearchableSelect></label>
        <UiButton variant="secondary" type="button" className="sch-btn sch-btn-secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}><FiRefreshCw aria-hidden="true" />โหลดใหม่</UiButton>
      </div>
      {selected?.fixed && <p className="sch-muted master-note">รหัสรายการควบคุมการทำงานของระบบ เปลี่ยนรหัสหรือเพิ่มรหัสใหม่ไม่ได้</p>}
      {!manage && !loading && !error && <p className="sch-muted master-note">คุณมีสิทธิ์ดูข้อมูลหลัก หากต้องการแก้ไข กรุณาติดต่อผู้ดูแลระบบ</p>}
      {notice && <p className="master-success" role="status">{notice}</p>}
      {error && <div className="sch-error" role="alert">{error}</div>}
      <div className="sch-card-head master-table-heading"><h2>{selected?.label || "ข้อมูลหลัก"}</h2><span className="sch-muted">{loading ? "กำลังโหลด…" : `${visible.length.toLocaleString("th-TH")} จาก ${rows.length.toLocaleString("th-TH")} รายการ`}</span></div>
      <TableScroll label="ตารางข้อมูลหลัก"><UiDataTable className="sch-table" aria-busy={loading}><thead><tr>{all && <th>หน่วยงาน</th>}<th>รหัส</th><th>ชื่อรายการ</th><th className="sch-num">ลำดับ</th><th>สถานะ</th>{manage && <th className="sch-actions-col">จัดการ</th>}</tr></thead><tbody>
        {loading ? <LoadingRows columns={(manage ? 5 : 4) + (all ? 1 : 0)} /> : error ? <EmptyRow columns={(manage ? 5 : 4) + (all ? 1 : 0)} title="ยังแสดงข้อมูลไม่ได้" hint="กดโหลดใหม่เพื่อลองอีกครั้ง" /> : !visible.length ? <EmptyRow columns={(manage ? 5 : 4) + (all ? 1 : 0)} title={search || status ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีรายการในหมวดนี้"} hint={search || status ? "ลองเปลี่ยนคำค้นหาหรือสถานะ" : manage && !selected?.fixed ? "กดเพิ่มรายการเพื่อเริ่มใช้งาน" : undefined} /> : visible.map(row => <tr key={`${row.organization_id || organization}-${row.id}`}>
          {all && <td>{toDisplayText(row.organization_name)}</td>}
          <td className="sch-code">{row.code}</td><td className="sch-name">{toDisplayText(row.label)}{row.description && <div className="sch-muted">{toDisplayText(row.description)}</div>}</td><td className="sch-num">{row.sort_order}</td><td><UiBadge className={`sch-badge status-${row.is_active ? "active" : "inactive"}`}>{row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}</UiBadge></td>
          {manage && <td><UiButton variant="secondary" type="button" className="sch-btn sch-btn-secondary" onClick={() => openEditor({ ...row, is_active: Boolean(row.is_active) })}><FiEdit2 aria-hidden="true" />แก้ไข</UiButton></td>}
        </tr>)}
      </tbody></UiDataTable></TableScroll>
    </UiSurface>
    {editing && selected && <SchoolModal title={editing.id ? "แก้ไขรายการ" : "เพิ่มรายการ"} subtitle={editing.organization_name ? `${selected.label} · ${editing.organization_name}` : selected.label} onClose={closeEditor} size="small" footer={<div className="sch-form-actions"><UiButton variant="secondary" type="button" className="sch-btn sch-btn-secondary" onClick={closeEditor} disabled={saving}>ยกเลิก</UiButton><UiButton variant="primary" type="submit" form="master-data-form" className="sch-btn" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึก"}</UiButton></div>}>
      <form id="master-data-form" className="sch-form-grid" onSubmit={save} aria-busy={saving}>
        {editorError && <p className="sch-error sch-full" role="alert">{editorError}</p>}
        {hasCode && <label className="sch-field sch-full">รหัส<UiTextInput aria-label="รหัส" required maxLength={64} pattern="[a-zA-Z0-9_.\-]+" disabled={Boolean(editing.id) || saving} value={editing.code} onChange={event => setEditing({ ...editing, code: event.target.value })} /><small className="sch-field-hint">ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง เมื่อสร้างแล้วเปลี่ยนรหัสไม่ได้</small></label>}
        {fields.map(key => <label className={`sch-field ${key === "text" || key === "description" ? "sch-full" : ""}`} key={key}>{labels[key] || key}
          {key === "text" || key === "description" ? <UiTextArea required={key !== "description"} disabled={saving} maxLength={key === "text" ? 4000 : 255} value={editing[key] || ""} onChange={event => setEditing({ ...editing, [key]: event.target.value })} /> : <input required disabled={saving || Boolean(editing.id) && selected.locked_fields?.includes(key)} maxLength={255} type={key === "color" ? "color" : "text"} value={editing[key] || (key === "color" ? "#1d5c8c" : "")} onChange={event => setEditing({ ...editing, [key]: event.target.value })} />}
        </label>)}
        <label className="sch-field">ลำดับ<UiTextInput type="number" min="0" max="100000" step="1" required disabled={saving} value={editing.sort_order} onChange={event => setEditing({ ...editing, sort_order: event.target.value })} /></label>
        <label className="master-active"><input type="checkbox" disabled={saving} checked={editing.is_active} onChange={event => setEditing({ ...editing, is_active: event.target.checked })} />ใช้งาน</label>
      </form>
    </SchoolModal>}
  </main></div>;
}
