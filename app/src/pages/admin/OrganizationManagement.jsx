import PdpaOrganizationSettings from "../../components/PdpaOrganizationSettings";
import OrganizationRolePermissions from "../../components/OrganizationRolePermissions";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createOrganization,
  createOrganizationMember,
  getOrganizationMembers,
  getOrganizations,
  getRoles,
  getUsers,
  updateOrganization,
  updateOrganizationMember,
} from "../../services/api";
import {
  confirmAlert,
  showErrorAlert,
  showSuccessAlert,
  showSuccessToast,
} from "../../utils/alerts";
import { FiSearch, FiUserMinus } from "react-icons/fi";
import StaffCheckboxPicker from "../../components/StaffCheckboxPicker";
import "./OrganizationManagement.css";

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
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  // "view" an existing organization, or create a "main" one or a "unit".
  const [mode, setMode] = useState("view");
  const [form, setForm] = useState(blankForm);
  const [members, setMembers] = useState([]);
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
      const [orgs, staff, roleRows] = await Promise.all([
        getOrganizations(),
        getUsers(),
        getRoles(),
      ]);
      const list = (response) =>
        Array.isArray(response.data) ? response.data : [];
      setOrganizations(list(orgs));
      setUsers(list(staff));
      setRoles(list(roleRows));
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

  useEffect(() => {
    if (mode !== "view" || !selected || selected.kind !== "unit") {
      setMembers([]);
      return;
    }
    let current = true;
    setMembers([]);
    getOrganizationMembers(selected.id)
      .then(({ data }) => {
        if (current) setMembers(data || []);
      })
      .catch(() => {
        if (current) setError("ไม่สามารถโหลดสมาชิกหน่วยงานได้");
      });
    return () => {
      current = false;
    };
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

  const refreshMembers = async () => {
    const { data } = await getOrganizationMembers(selected.id);
    setMembers(data || []);
    await load();
  };

  const updateMember = async (member, patch) => {
    const isRemoving =
      patch.status === "inactive" && member.status === "active";
    if (isRemoving) {
      const confirmed = await confirmAlert({
        title: "ถอดสมาชิกออกจากหน่วยงาน?",
        text: `${member.name || member.username} จะไม่อยู่ในหน่วยงานนี้และเลือกหน่วยงานนี้ไม่ได้อีก (เพิ่มกลับได้ภายหลัง)`,
        confirmText: "ถอดสมาชิก",
        danger: true,
      });
      if (!confirmed) return;
    }
    try {
      await updateOrganizationMember(selected.id, member.id, {
        role_id: Number(patch.role_id ?? member.role_id),
        status: patch.status ?? member.status,
        is_primary: patch.is_primary ?? member.is_primary,
      });
      await refreshMembers();
      await showSuccessToast(
        isRemoving ? "ถอดสมาชิกเรียบร้อยแล้ว" : "เปลี่ยนบทบาทแล้ว",
      );
    } catch (err) {
      setError(err.response?.data?.message || "ไม่สามารถแก้ไขสมาชิกได้");
      await showErrorAlert({ error: err, title: "แก้ไขสมาชิกไม่สำเร็จ" });
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
        <header className="org-header">
          <div>
            <h1>หน่วยงานหลักและหน่วยงานย่อย</h1>
            <p>
              หน่วยงานหลักใช้จัดกลุ่ม ส่วนหน่วยงานย่อยคือหน่วยที่ทำงานจริง
              (โรงพยาบาลหรือโรงเรียน) มีสมาชิก บทบาท และข้อมูลของตัวเอง
            </p>
          </div>
          <div className="org-header-actions">
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
          </div>
        </header>
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
                      <select
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
                      </select>
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
                            <strong>{label}</strong>
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
              <MemberSection
                organization={selected}
                members={members}
                users={users}
                roles={roles}
                onAdded={refreshMembers}
                onUpdate={updateMember}
                onError={setError}
              />
            )}
            {mode === "view" && selected?.kind === "unit" && (
              <OrganizationRolePermissions
                key={`permissions-${selected.id}`}
                organization={selected}
                roles={roles}
              />
            )}
            {mode === "view" && selected?.kind === "unit" && (
              <PdpaOrganizationSettings
                key={selected.id}
                organization={selected}
                organizations={organizations}
                members={members}
              />
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function MemberSection({
  organization,
  members,
  users,
  roles,
  onAdded,
  onUpdate,
  onError,
}) {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState(new Set());
  const [roleId, setRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setPicked(new Set());
    setAdding(false);
    setQuery("");
  }, [organization.id]);

  const memberIds = new Set(members.map((member) => Number(member.user_id)));
  const candidates = users
    .filter((user) => user.status === "active")
    .filter((user) => !memberIds.has(Number(user.id)))
    .map((user) => ({
      id: Number(user.id),
      name: user.name || user.username,
      username: user.username,
      hint:
        (user.memberships || [])
          .filter((membership) => membership.status === "active")
          .map((membership) => membership.organization_name)
          .join(", ") ||
        user.email ||
        "",
    }));

  const shownMembers = query.trim()
    ? members.filter((member) =>
        [member.name, member.username, member.email, member.role_name]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query.trim().toLowerCase()),
          ),
      )
    : members;

  const closeAdd = () => {
    setAdding(false);
    setPicked(new Set());
  };

  const addMembers = async (event) => {
    event.preventDefault();
    if (!picked.size || !roleId) return;
    setSaving(true);
    try {
      const { data } = await createOrganizationMember(organization.id, {
        user_ids: [...picked],
        role_id: Number(roleId),
      });
      closeAdd();
      await onAdded();
      const count = (data.added?.length || 0) + (data.reactivated?.length || 0);
      await showSuccessToast(`เพิ่มสมาชิก ${count} คนแล้ว`);
    } catch (err) {
      onError(err.response?.data?.message || "ไม่สามารถเพิ่มสมาชิกได้");
      await showErrorAlert({ error: err, title: "เพิ่มสมาชิกไม่สำเร็จ" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="org-members" aria-labelledby="org-members-title">
      <div className="org-members-head">
        <h2 id="org-members-title">
          สมาชิก <span className="org-count">{members.length}</span>
        </h2>
        {!adding && (
          <button
            type="button"
            className="org-btn"
            onClick={() => setAdding(true)}
          >
            + เพิ่มสมาชิก
          </button>
        )}
      </div>

      {adding && (
        <form className="org-add-panel" onSubmit={addMembers}>
          <StaffCheckboxPicker
            people={candidates}
            selected={picked}
            onChange={setPicked}
            label="ติ๊กเลือกเจ้าหน้าที่ (เลือกได้หลายคน)"
            emptyText="เจ้าหน้าที่ทุกคนเป็นสมาชิกของหน่วยงานนี้แล้ว"
          />
          <div className="org-add-panel-footer">
            <label className="org-field">
              <span>บทบาทในหน่วยงานนี้</span>
              <select
                required
                value={roleId}
                onChange={(event) => setRoleId(event.target.value)}
              >
                <option value="">เลือกบทบาท</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="org-add-panel-actions">
              <button
                type="button"
                className="org-btn-secondary"
                onClick={closeAdd}
              >
                ยกเลิก
              </button>
              <button
                className="org-btn"
                disabled={saving || !picked.size || !roleId}
              >
                {saving
                  ? "กำลังเพิ่ม…"
                  : picked.size
                    ? `เพิ่ม ${picked.size} คน`
                    : "เพิ่มสมาชิก"}
              </button>
            </div>
          </div>
        </form>
      )}

      {members.length > 6 && (
        <label className="org-member-search">
          <FiSearch aria-hidden="true" />
          <span className="org-sr-only">ค้นหาสมาชิก</span>
          <input
            type="search"
            placeholder="ค้นหาสมาชิก ชื่อ ชื่อผู้ใช้ หรือบทบาท"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      )}

      {members.length === 0 ? (
        <p className="org-empty">
          ยังไม่มีสมาชิก กด &quot;+ เพิ่มสมาชิก&quot; เพื่อเลือกเจ้าหน้าที่
        </p>
      ) : (
        <ul className="org-member-rows">
          {shownMembers.map((member) => (
            <li key={member.id}>
              <span className="org-avatar" aria-hidden="true">
                {(member.name || member.username).trim().charAt(0)}
              </span>
              <span className="org-member-identity">
                <strong>{member.name || member.username}</strong>
                <small>
                  @{member.username}
                  {member.email ? ` · ${member.email}` : ""}
                </small>
              </span>
              <select
                className="org-role-select"
                aria-label={`บทบาทของ ${member.username}`}
                value={member.role_id}
                onChange={(event) =>
                  onUpdate(member, { role_id: event.target.value })
                }
              >
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="org-icon-btn org-icon-btn--danger"
                aria-label={`ถอด ${member.username} ออกจากหน่วยงาน`}
                title="ถอดออกจากหน่วยงาน"
                onClick={() => onUpdate(member, { status: "inactive" })}
              >
                <FiUserMinus aria-hidden="true" />
              </button>
            </li>
          ))}
          {!shownMembers.length && (
            <li className="org-member-empty">ไม่พบสมาชิกที่ค้นหา</li>
          )}
        </ul>
      )}
    </section>
  );
}
