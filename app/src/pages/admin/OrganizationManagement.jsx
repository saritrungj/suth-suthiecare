import SearchableSelect from "../../components/SearchableSelect";
import { toDisplayText } from "../../utils/textPresentation.js";
import { usePageExport } from "../../components/ExcelExport";
import OrganizationServiceSettings from "../../components/OrganizationServiceSettings";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createOrganization,
  getOrganizations,
  updateOrganization,
} from "../../services/api";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessAlert,
  showSuccessToast,
} from "../../utils/alerts";
import StaffCheckboxPicker from "../../components/StaffCheckboxPicker";
import "./OrganizationManagement.css";
import { PageHero } from "../../components/dashboard/DashboardKit";

const ORG_TYPE_LABELS = { hospital: "โรงพยาบาล", school: "โรงเรียน" };
// The type is chosen on the main organization and inherited by its sub-units.
const ORG_TYPE_HINTS = {
  hospital:
    "หน่วยย่อยภายในคือคลินิก ใช้เมนูคลินิก ตารางนัดหมาย และเคสแบบโรงพยาบาล",
  school:
    "หน่วยย่อยภายในคือโรงเรียน ใช้เมนูนักเรียน ครู ชั้นปี/ห้อง และเคสแบบรายนักเรียน",
};
const blankForm = {
  name: "",
  description: "",
  org_type: "",
  parent_id: "",
};

// Organization hierarchy: a main organization groups sub-units. Each sub-unit
// has a type (hospital or school), its own members and its own data.
export default function OrganizationManagement() {
  const [organizations, setOrganizations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  // "view" an existing organization, or create a "main" one or a "unit".
  usePageExport({
    title: "หน่วยงาน",
    sources: [
      { resource: "organizations" },
      ...(selectedId
        ? [{ resource: "organization_members", id: selectedId }]
        : []),
    ],
  });
  const [mode, setMode] = useState("view");
  const [form, setForm] = useState(blankForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // On a phone the form sits below the directory: after choosing an
  // organization (or starting a new one) scroll to it and focus its title.
  const formTitleRef = useRef(null);
  const [formReveal, setFormReveal] = useState(0);

  const selected = useMemo(
    () =>
      organizations.find(
        (organization) => Number(organization.id) === Number(selectedId),
      ),
    [organizations, selectedId],
  );
  const mains = useMemo(
    () => organizations.filter((organization) => organization.kind === "main"),
    [organizations],
  );
  const childrenOf = (id) =>
    organizations.filter(
      (organization) => Number(organization.parent_id) === Number(id),
    );
  const ungrouped = organizations.filter(
    (organization) => organization.kind === "unit" && !organization.parent_id,
  );

  const load = async () => {
    try {
      const orgs = await getOrganizations();
      const list = (response) =>
        Array.isArray(response.data) ? response.data : [];
      setOrganizations(list(orgs));
      setSelectedId((current) => current || list(orgs)[0]?.id || null);
    } catch {
      setError("ไม่สามารถโหลดข้อมูลการจัดการหน่วยงานได้");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const isUnit =
    mode === "create-unit" || (mode === "view" && selected?.kind === "unit");
  const chosenParent = mains.find(
    (main) => Number(main.id) === Number(form.parent_id),
  );
  // A main organization picks the type. A sub-unit takes its main
  // organization's type, except a legacy unit that has no main organization.
  const choosesType = !isUnit || !form.parent_id;

  useEffect(() => {
    if (mode !== "view" || !selected) return;
    setForm({
      name: selected.name,
      description: selected.description || "",
      org_type: selected.org_type || "",
      parent_id: selected.parent_id ? String(selected.parent_id) : "",
    });
  }, [selected, mode]);

  const startCreate = (kind, parentId = "") => {
    setMode(kind === "main" ? "create-main" : "create-unit");
    setForm({ ...blankForm, parent_id: parentId ? String(parentId) : "" });
    setError("");
    setFormReveal((current) => current + 1);
  };

  const select = (id) => {
    setMode("view");
    setSelectedId(id);
    setError("");
    setFormReveal((current) => current + 1);
  };

  useEffect(() => {
    if (!formReveal) return;
    if (!window.matchMedia?.("(max-width: 820px)").matches) return;
    const title = formTitleRef.current;
    if (!title) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    title.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
    title.focus({ preventScroll: true });
  }, [formReveal]);

  const saveOrganization = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (mode === "view") {
        await updateOrganization(selected.id, {
          name: form.name,
          description: form.description,
          status: selected.status,
          ...(selected.kind === "unit"
            ? {
                parent_id: form.parent_id ? Number(form.parent_id) : null,
                ...(form.parent_id ? {} : { org_type: form.org_type }),
              }
            : { org_type: form.org_type }),
        });
        await load();
      } else {
        const { data } = await createOrganization({
          kind: mode === "create-main" ? "main" : "unit",
          name: form.name,
          description: form.description,
          ...(mode === "create-unit"
            ? { parent_id: Number(form.parent_id) }
            : { org_type: form.org_type }),
        });
        await load();
        setMode("view");
        setSelectedId(data.id);
      }
      await showSuccessAlert({ title: "บันทึกหน่วยงานเรียบร้อยแล้ว" });
    } catch (err) {
      setError(err.response?.data?.message || "ไม่สามารถบันทึกหน่วยงานได้");
      await showErrorAlert({
        error: err,
        title: "บันทึกหน่วยงานไม่สำเร็จ",
        fallback: "ไม่สามารถบันทึกหน่วยงานได้",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!selected) return;
    const nextActive = selected.status !== "active";
    const confirmed = await confirmAlert({
      title: nextActive ? "เปิดใช้งานหน่วยงาน?" : "ปิดใช้งานหน่วยงาน?",
      text: nextActive
        ? `ต้องการเปิดใช้งาน ${selected.name} หรือไม่`
        : selected.kind === "main"
          ? `ปิดเฉพาะ ${selected.name} หน่วยงานย่อยภายในยังใช้งานได้ตามปกติ`
          : `เจ้าหน้าที่จะไม่สามารถเลือกขอบเขต ${selected.name} ได้จนกว่าจะเปิดใช้งานอีกครั้ง`,
      confirmText: nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน",
      danger: !nextActive,
    });
    if (!confirmed) return;
    try {
      await updateOrganization(selected.id, {
        name: selected.name,
        description: selected.description || "",
        status: nextActive ? "active" : "inactive",
      });
      await load();
      await showSuccessToast(
        nextActive ? "เปิดใช้งานหน่วยงานแล้ว" : "ปิดใช้งานหน่วยงานแล้ว",
      );
    } catch (err) {
      await showErrorAlert({ error: err, title: "เปลี่ยนสถานะไม่สำเร็จ" });
    }
  };

  const directoryItem = (organization, nested = false) => (
    <button
      type="button"
      key={organization.id}
      onClick={() => select(organization.id)}
      aria-current={
        mode === "view" && Number(selectedId) === Number(organization.id)
          ? "true"
          : undefined
      }
      className={`org-tree-item ${nested ? "org-tree-item--child" : "org-tree-item--main"} ${mode === "view" && Number(selectedId) === Number(organization.id) ? "is-selected" : ""}`}
    >
      <span className="org-tree-text">
        <span className="org-tree-name">{organization.name}</span>
        <small>
          {organization.kind === "main"
            ? `หน่วยงานหลัก${organization.org_type ? `ประเภท${ORG_TYPE_LABELS[organization.org_type]}` : " (ยังไม่กำหนดประเภท)"} · ${organization.child_count} หน่วยงานย่อย`
            : `${ORG_TYPE_LABELS[organization.org_type] || "โรงพยาบาล"} · สมาชิก ${organization.member_count} คน`}
        </small>
      </span>
      {organization.status !== "active" && (
        <span className="org-badge org-badge--off">ปิด</span>
      )}
    </button>
  );

  const parentName = (id) =>
    mains.find((main) => Number(main.id) === Number(id))?.name;

  return (
    <div className="org-wrapper">
      <main className="org-page">
        <PageHero
          title="หน่วยงานหลักและหน่วยงานย่อย"
          description="หน่วยงานหลักใช้จัดกลุ่ม ส่วนหน่วยงานย่อยคือหน่วยที่ทำงานจริง (โรงพยาบาลหรือโรงเรียน) มีสมาชิก บทบาท และข้อมูลของตัวเอง"
          actions={
            <>
              <button
                className="org-btn"
                type="button"
                onClick={() => startCreate("main")}
              >
                + หน่วยงานหลัก
              </button>
              <button
                className="org-btn-secondary"
                type="button"
                disabled={!mains.length}
                title={!mains.length ? "สร้างหน่วยงานหลักก่อน" : undefined}
                onClick={() =>
                  startCreate(
                    "unit",
                    selected?.kind === "main"
                      ? selected.id
                      : selected?.parent_id || mains[0]?.id,
                  )
                }
              >
                + หน่วยงานย่อย
              </button>
            </>
          }
        />
        {error && (
          <p className="org-error" role="alert">
            {error}
          </p>
        )}
        <div className="org-workspace">
          <aside className="org-tree" aria-label="โครงสร้างหน่วยงาน">
            <div className="org-tree-title">
              โครงสร้างหน่วยงาน <span>{organizations.length}</span>
            </div>
            {mains.map((main) => (
              <div className="org-tree-group" key={main.id}>
                {directoryItem(main)}
                {childrenOf(main.id).length > 0 && (
                  <div className="org-tree-children">
                    {childrenOf(main.id).map((child) =>
                      directoryItem(child, true),
                    )}
                  </div>
                )}
              </div>
            ))}
            {ungrouped.length > 0 && (
              <div className="org-tree-group">
                <div className="org-tree-subtitle">
                  ยังไม่ได้อยู่ภายใต้หน่วยงานหลัก
                </div>
                <div className="org-tree-children">
                  {ungrouped.map((unit) => directoryItem(unit, true))}
                </div>
              </div>
            )}
          </aside>

          <section className="org-content">
            {(mode !== "view" || selected) && (
              <form className="org-form" onSubmit={saveOrganization}>
                <div className="org-form-title">
                  <h2 ref={formTitleRef} tabIndex={-1}>
                    {mode === "create-main"
                      ? "สร้างหน่วยงานหลัก"
                      : mode === "create-unit"
                        ? "สร้างหน่วยงานย่อย"
                        : selected.kind === "main"
                          ? "รายละเอียดหน่วยงานหลัก"
                          : "รายละเอียดหน่วยงานย่อย"}
                  </h2>
                  {mode === "view" && (
                    <button
                      className={
                        selected.status === "active"
                          ? "org-btn-quiet org-btn-quiet--danger"
                          : "org-btn-quiet"
                      }
                      type="button"
                      onClick={toggleStatus}
                    >
                      {selected.status === "active"
                        ? "ปิดใช้งาน"
                        : "เปิดใช้งาน"}
                    </button>
                  )}
                </div>
                <div className="org-form-grid">
                  {mode === "view" && (
                    <label>
                      รหัสหน่วยงาน
                      <input
                        readOnly
                        value={selected.code}
                        aria-label="รหัสหน่วยงานที่ระบบสร้าง"
                      />
                    </label>
                  )}
                  {isUnit && (
                    <label>
                      อยู่ภายใต้หน่วยงานหลัก
                      <SearchableSelect
                        required={
                          mode === "create-unit" || Boolean(selected?.parent_id)
                        }
                        value={form.parent_id}
                        onChange={(event) =>
                          setForm({ ...form, parent_id: event.target.value })
                        }
                      >
                        <option value="">
                          {mode === "create-unit"
                            ? "เลือกหน่วยงานหลัก"
                            : "ยังไม่ได้อยู่ภายใต้หน่วยงานหลัก"}
                        </option>
                        {mains
                          .filter(
                            (main) =>
                              main.status === "active" ||
                              Number(main.id) === Number(form.parent_id),
                          )
                          .map((main) => (
                            <option key={main.id} value={main.id}>
                              {main.name}
                            </option>
                          ))}
                      </SearchableSelect>
                    </label>
                  )}
                  <label
                    className={!isUnit && mode !== "view" ? "org-full" : ""}
                  >
                    {isUnit ? "ชื่อหน่วยงานย่อย" : "ชื่อหน่วยงานหลัก"}
                    <input
                      required
                      maxLength={255}
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                    />
                  </label>
                  {isUnit && form.parent_id && (
                    <p className="org-full org-inherited-type">
                      ประเภท:{" "}
                      <strong>
                        {chosenParent?.org_type
                          ? ORG_TYPE_LABELS[chosenParent.org_type]
                          : "หน่วยงานหลักนี้ยังไม่ได้กำหนดประเภท"}
                      </strong>{" "}
                      (ตามหน่วยงานหลัก {chosenParent?.name || "-"})
                    </p>
                  )}
                  {choosesType && (
                    <fieldset className="org-full org-type-choice">
                      <legend>
                        {isUnit
                          ? "ประเภทหน่วยงาน"
                          : "ประเภทของหน่วยงานหลัก (หน่วยงานย่อยทั้งหมดภายใต้จะเป็นประเภทนี้)"}
                      </legend>
                      {Object.entries(ORG_TYPE_LABELS).map(([value, label]) => (
                        <label
                          key={value}
                          className={
                            form.org_type === value ? "is-checked" : ""
                          }
                        >
                          <input
                            type="radio"
                            name="org_type"
                            value={value}
                            checked={form.org_type === value}
                            required
                            onChange={() =>
                              setForm({ ...form, org_type: value })
                            }
                          />
                          <span>
                            <strong>{toDisplayText(label)}</strong>
                            <small>{ORG_TYPE_HINTS[value]}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                  <label className="org-full">
                    รายละเอียด
                    <textarea
                      value={form.description}
                      onChange={(event) =>
                        setForm({ ...form, description: event.target.value })
                      }
                    />
                  </label>
                </div>
                {mode !== "view" && (
                  <p className="org-auto-code-note">
                    ระบบจะสร้างรหัสหน่วยงานให้อัตโนมัติหลังบันทึก
                    {mode === "create-unit" && form.parent_id
                      ? ` · อยู่ภายใต้ ${parentName(form.parent_id) || "-"}`
                      : ""}
                  </p>
                )}
                <div className="org-form-actions">
                  {mode !== "view" && (
                    <button
                      type="button"
                      className="org-btn-secondary"
                      onClick={() => setMode("view")}
                    >
                      ยกเลิก
                    </button>
                  )}
                  <button className="org-btn" disabled={saving}>
                    {saving ? "กำลังบันทึก…" : "บันทึกหน่วยงาน"}
                  </button>
                </div>
              </form>
            )}

            {mode === "view" && selected?.kind === "main" && (
              <section className="org-members">
                <div className="org-section-head">
                  <div>
                    <h2>หน่วยงานย่อยภายใต้ {selected.name}</h2>
                    <p>
                      หน่วยงานหลักไม่มีสมาชิกโดยตรง
                      เพิ่มเจ้าหน้าที่ที่หน่วยงานย่อยที่ทำงานจริง
                    </p>
                  </div>
                  <button
                    type="button"
                    className="org-btn"
                    disabled={!selected.org_type}
                    title={
                      !selected.org_type
                        ? "กำหนดประเภทของหน่วยงานหลักก่อน"
                        : undefined
                    }
                    onClick={() => startCreate("unit", selected.id)}
                  >
                    + เพิ่มหน่วยงานย่อย
                  </button>
                </div>
                <div className="org-unit-list">
                  {childrenOf(selected.id).length === 0 ? (
                    <p className="org-empty">ยังไม่มีหน่วยงานย่อย</p>
                  ) : (
                    childrenOf(selected.id).map((child) => (
                      <article key={child.id} className="org-unit-row">
                        <div className="org-unit-text">
                          <strong>{child.name}</strong>
                          <small>
                            {ORG_TYPE_LABELS[child.org_type]} · สมาชิก{" "}
                            {child.member_count} คน
                          </small>
                        </div>
                        <span
                          className={`org-badge ${child.status === "active" ? "org-badge--on" : "org-badge--off"}`}
                        >
                          {child.status === "active" ? "ใช้งาน" : "ปิด"}
                        </span>
                        <button
                          type="button"
                          className="org-btn-secondary"
                          onClick={() => select(child.id)}
                        >
                          จัดการ
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </section>
            )}

            {mode === "view" && selected?.kind === "unit" && (
              <OrganizationServiceSettings
                key={selected.id}
                organization={selected}
                organizations={organizations}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
