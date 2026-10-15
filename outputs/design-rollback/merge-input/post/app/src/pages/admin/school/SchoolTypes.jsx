import { Surface as UiSurface, Badge as UiBadge } from '../../../components/ui/index.jsx';
import { Button as UiButton, DataTable as UiDataTable, TextInput as UiTextInput } from '../../../components/ui/index.jsx';
import SearchableSelect from '../../../components/SearchableSelect';
import SchoolManagementNav from './SchoolManagementNav';
import { toDisplayText } from '../../../utils/textPresentation.js';
import { useCallback, useEffect, useState } from "react";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";
import {
  createSchoolType,
  deleteSchoolType,
  getSchoolTypes,
  updateSchoolType,
} from "../../../services/api";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessToast,
} from "../../../utils/alerts";
import {
  EmptyRow,
  LoadingRows,
  PageHeader,
  SchoolModal,
  RequiredMark,
  useFieldErrors,
  TableScroll,
} from "./schoolUi";
import "./school.css";

const KINDS = [
  {
    kind: "teacher-types",
    title: "ประเภทครู",
    hint: "เช่น ครูประจำชั้น ครูแนะแนว ครูพยาบาล",
  },
  {
    kind: "student-types",
    title: "ประเภทนักเรียน",
    hint: "เช่น นักเรียนปกติ นักเรียนทุน นักเรียนที่ต้องดูแลพิเศษ",
  },
];

export default function SchoolTypes() {
  return (
    <div className="sch-wrapper">
      <main className="sch-page">
        <PageHeader
          title="ประเภทครูและนักเรียน"
          description="ใช้จัดกลุ่มครูและนักเรียนของโรงเรียน ชื่อประเภทนักเรียนต้องตรงกับคอลัมน์ในไฟล์นำเข้านักเรียน"
        />
        <SchoolManagementNav />
        {KINDS.map((item) => (
          <TypePanel key={item.kind} {...item} />
        ))}
      </main>
    </div>
  );
}

function TypePanel({ kind, title, hint }) {
  const { schoolAccess: access } = usePermissions();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSchoolTypes(kind);
      setRows(data || []);
    } catch (err) {
      await showErrorAlert({ error: err, title: `โหลด${title}ไม่สำเร็จ` });
    } finally {
      setLoading(false);
    }
  }, [kind, title]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (row) => {
    if (
      !(await confirmAlert({
        title: `ลบ "${row.name}"?`,
        text: "ลบได้เฉพาะประเภทที่ยังไม่มีผู้ใช้ หากมีผู้ใช้แล้วให้ปิดใช้งานแทน",
        confirmText: "ลบ",
        danger: true,
      }))
    )
      return;
    try {
      await deleteSchoolType(kind, row.id);
      await load();
      await showSuccessToast("ลบแล้ว");
    } catch (err) {
      await showErrorAlert({ error: err, title: "ลบไม่สำเร็จ" });
    }
  };

  return (
    <UiSurface as="section" className="sch-card" aria-labelledby={`${kind}-title`}>
      <div className="sch-card-head">
        <div>
          <h2 id={`${kind}-title`}>{title}</h2>
          <span className="sch-muted">{hint}</span>
        </div>
        {access?.can_create_school && (
          <UiButton variant="primary"
            type="button"
            className="sch-btn"
            onClick={() =>
              setEditing({
                name: "",
                description: "",
                sort_order: rows.length + 1,
                status: "active",
              })
            }
          >
            <FiPlus aria-hidden="true" /> เพิ่ม{title}
          </UiButton>
        )}
      </div>
      <TableScroll label={`ตาราง${title}`}>
        <UiDataTable className="sch-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>คำอธิบาย</th>
              <th className="sch-num">ใช้งานอยู่</th>
              <th>สถานะ</th>
              <th className="sch-actions-col">จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows columns={5} rows={2} />
            ) : !rows.length ? (
              <EmptyRow columns={5} title={`ยังไม่มี${title}`} hint={hint} />
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td className="sch-name">{row.name}</td>
                  <td>{toDisplayText(row.description || "-")}</td>
                  <td className="sch-num">{row.usage_count}</td>
                  <td>
                    <UiBadge className={`sch-badge status-${row.status}`}>
                      {row.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                    </UiBadge>
                  </td>
                  <td>
                    <div className="sch-row-actions">
                      {access?.can_update_school && (
                        <UiButton variant="secondary" size="icon"
                          type="button"
                          className="sch-icon-btn"
                          aria-label={`แก้ไข ${row.name}`}
                          onClick={() => setEditing({ ...row })}
                        >
                          <FiEdit2 aria-hidden="true" />
                        </UiButton>
                      )}
                      {access?.can_delete_school && (
                        <UiButton variant="danger" size="icon"
                          type="button"
                          className="sch-icon-btn sch-danger"
                          aria-label={`ลบ ${row.name}`}
                          onClick={() => remove(row)}
                        >
                          <FiTrash2 aria-hidden="true" />
                        </UiButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </UiDataTable>
      </TableScroll>
      {editing && (
        <TypeModal
          kind={kind}
          title={title}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </UiSurface>
  );
}

function TypeModal({ kind, title, initial, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: initial.name,
    description: initial.description || "",
    sort_order: initial.sort_order ?? 0,
    status: initial.status || "active",
  });
  const [saving, setSaving] = useState(false);
  const { bind, errorFor } = useFieldErrors();
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (initial.id) await updateSchoolType(kind, initial.id, form);
      else await createSchoolType(kind, form);
      await showSuccessToast("บันทึกแล้ว");
      await onSaved();
    } catch (err) {
      await showErrorAlert({ error: err, title: "บันทึกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <SchoolModal
      size="small"
      title={initial.id ? `แก้ไข${title}` : `เพิ่ม${title}`}
      onClose={onClose}
      footer={
        <>
          <UiButton variant="secondary" type="button" className="sch-btn-secondary" onClick={onClose}>
            ยกเลิก
          </UiButton>
          <UiButton variant="primary"
            type="submit"
            form={`${kind}-form`}
            className="sch-btn"
            disabled={saving}
          >
            {saving ? "กำลังบันทึก..." : "บันทึก"}
          </UiButton>
        </>
      }
    >
      <form id={`${kind}-form`} className="sch-form-grid" onSubmit={save}>
        <label className="sch-field sch-full">
          <span>
            ชื่อ
            <RequiredMark />
          </span>
          <UiTextInput
            required
            {...bind("name", "กรุณากรอกชื่อ")}
            maxLength={100}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
          {errorFor("name")}
        </label>
        <label className="sch-field sch-full">
          คำอธิบาย
          <UiTextInput
            maxLength={255}
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        <label className="sch-field">
          ลำดับ
          <UiTextInput
            inputMode="numeric"
            value={form.sort_order}
            onChange={(event) =>
              setForm({
                ...form,
                sort_order: event.target.value.replace(/\D/g, ""),
              })
            }
          />
        </label>
        <label className="sch-field">
          สถานะ
          <SearchableSelect
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value })
            }
          >
            <option value="active">ใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </SearchableSelect>
        </label>
      </form>
    </SchoolModal>
  );
}
