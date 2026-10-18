import { useEffect, useRef, useState } from "react";
import { FiRefreshCw, FiSave } from "react-icons/fi";
import {
  PERMISSION_CATEGORIES,
  permissionGroupsForOrganization,
} from "../permissions/permissionRegistry";
import {
  getOrganizationRolePermissions,
  saveOrganizationRolePermissions,
} from "../services/api";
import { confirmAlert } from "../utils/alerts";
import {
  SettingsEmpty,
  SettingsFeedback,
  SettingsLoading,
} from "./ManagementSettings";

const ACTIONS = {
  view: "ดูข้อมูล",
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  assign: "จัดสรร",
  export: "ส่งออก",
  manage: "จัดการ",
};
const ACTION_ORDER = Object.keys(ACTIONS);

// Unit roles workspace: pick a role on the left, set its rights in the matrix.
export default function OrganizationRolePermissions({
  organization,
  roles,
  roleId: selectedRoleId,
  onRoleChange,
  roleTools,
}) {
  const [localRoleId, setLocalRoleId] = useState("");
  const roleId = selectedRoleId ?? localRoleId;
  const setRoleId = onRoleChange || setLocalRoleId;
  const [state, setState] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const scope = `${organization.id}:${roleId}`;
  const loaded = state?.scope === scope;
  const generation = useRef(0);
  const permissionGroups = permissionGroupsForOrganization(organization);
  const allowedPermissions = new Set(
    permissionGroups.flatMap((group) =>
      group.actions.map((action) => `${group.id}.${action}`),
    ),
  );
  const columns = ACTION_ORDER.filter((action) =>
    permissionGroups.some((group) => group.actions.includes(action)),
  );
  const sections = PERMISSION_CATEGORIES.map((category) => ({
    ...category,
    groups: permissionGroups.filter((group) => group.category === category.id),
  })).filter((category) => category.groups.length);
  const role = roles.find((item) => String(item.id) === String(roleId));
  const load = async () => {
    const current = ++generation.current;
    if (!roleId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setState(null);
    setNotice(null);
    try {
      const { data } = await getOrganizationRolePermissions(
        organization.id,
        roleId,
      );
      if (current !== generation.current) return;
      const permissions = data.permissions.filter((key) =>
        allowedPermissions.has(key),
      );
      setState({
        ...data,
        scope: `${organization.id}:${roleId}`,
        permissions: new Set(permissions),
      });
      setSaved(permissions);
    } catch {
      if (current === generation.current)
        setNotice({
          type: "error",
          text: "โหลดสิทธิ์ไม่สำเร็จ กดโหลดสิทธิ์ล่าสุดเพื่อลองอีกครั้ง",
        });
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    load();
    return () => {
      generation.current++;
    };
  }, [organization.id, roleId]);
  const dirty =
    loaded &&
    (state.permissions.size !== saved.length ||
      saved.some((key) => !state.permissions.has(key)));
  const chooseRole = async (nextId) => {
    if (String(nextId) === String(roleId) || busy) return;
    if (
      dirty &&
      !(await confirmAlert({
        title: "ยังไม่ได้บันทึกสิทธิ์",
        text: `การเปลี่ยนแปลงของ ${role?.name || "บทบาทนี้"} จะหายไป`,
        confirmText: "เปลี่ยนบทบาท",
      }))
    )
      return;
    setRoleId(String(nextId));
  };
  const toggle = (key, granted) =>
    setState((current) => {
      const permissions = new Set(current.permissions);
      granted ? permissions.add(key) : permissions.delete(key);
      return { ...current, permissions };
    });
  const save = async () => {
    if (!loaded || busy) return;
    const currentGeneration = generation.current;
    setBusy(true);
    setNotice(null);
    try {
      const permissions = [...state.permissions].filter((key) =>
        allowedPermissions.has(key),
      );
      const { data } = await saveOrganizationRolePermissions(
        organization.id,
        roleId,
        { permissions, version: state.version },
      );
      if (currentGeneration !== generation.current) return;
      setState((current) => ({
        ...current,
        version: data.version,
        configured: true,
      }));
      setSaved(permissions);
      setNotice({
        type: "success",
        text: `บันทึกสิทธิ์ของ ${organization.name} แล้ว ไม่มีผลกับหน่วยงานอื่น`,
      });
    } catch (error) {
      if (currentGeneration !== generation.current) return;
      setNotice({
        type: "error",
        text:
          error.response?.status === 409
            ? "สิทธิ์ถูกแก้ไขโดยผู้ดูแลคนอื่น กดโหลดสิทธิ์ล่าสุดก่อนแก้ไขและบันทึกอีกครั้ง"
            : "บันทึกสิทธิ์ไม่สำเร็จ การเปลี่ยนแปลงยังอยู่ในหน้านี้ กรุณาลองอีกครั้ง",
      });
    } finally {
      if (currentGeneration === generation.current) setBusy(false);
    }
  };
  return (
    <section className="rp-workspace" aria-label="บทบาทและสิทธิ์ในหน่วยงาน">
      <div className="rp-card rp-roles">
        <div className="rp-card-head">
          <div>
            <h2>บทบาท</h2>
            <p className="rp-muted">
              {roles.length} บทบาทใน {organization.name}
            </p>
          </div>
          {roleTools?.remove}
        </div>
        <fieldset className="rp-role-list" disabled={busy}>
          <legend>บทบาทที่ตั้งสิทธิ์</legend>
          {roles.length ? (
            roles.map((item) => {
              const selected = String(item.id) === String(roleId);
              return (
                <label
                  key={item.id}
                  className={`rp-role ${selected ? "is-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name={`unit-role-${organization.id}`}
                    value={item.id}
                    checked={selected}
                    onChange={() => chooseRole(item.id)}
                  />
                  <span className="rp-role-text">
                    <span className="rp-role-name">{item.name}</span>
                    {item.description && <small>{item.description}</small>}
                  </span>
                </label>
              );
            })
          ) : (
            <p className="rp-muted rp-role-empty">ยังไม่มีบทบาทในหน่วยงานนี้</p>
          )}
        </fieldset>
        {roleTools?.create}
      </div>

      <div className="rp-card rp-editor">
        <div className="rp-card-head">
          <div>
            <h2>{role ? `สิทธิ์ของ ${role.name}` : "สิทธิ์ของบทบาท"}</h2>
            <p className="rp-muted">
              มีผลเฉพาะ {organization.name}{" "}
              บทบาทชื่อเดียวกันในหน่วยงานอื่นตั้งสิทธิ์ต่างกันได้
            </p>
          </div>
          {loaded && (
            <span className={`rp-chip ${dirty ? "rp-chip--warn" : ""}`}>
              เลือก {state.permissions.size} สิทธิ์
              {dirty ? " · ยังไม่ได้บันทึก" : ""}
            </span>
          )}
        </div>
        <SettingsFeedback notice={notice} />
        {loading ? (
          <SettingsLoading>กำลังโหลดสิทธิ์ของบทบาท...</SettingsLoading>
        ) : !roleId ? (
          <SettingsEmpty>
            เลือกบทบาทเพื่อดูและกำหนดสิทธิ์ในหน่วยงานนี้
          </SettingsEmpty>
        ) : !loaded ? (
          <button className="rp-btn" type="button" onClick={load}>
            <FiRefreshCw aria-hidden="true" />
            โหลดสิทธิ์ล่าสุด
          </button>
        ) : (
          <>
            {!state.configured && (
              <SettingsFeedback
                notice={{
                  type: "info",
                  text: "ยังไม่ได้กำหนดสิทธิ์ในหน่วยงานนี้ ค่าเริ่มต้นไม่ให้สิทธิ์ เลือกสิทธิ์แล้วบันทึกเพื่อเริ่มใช้งาน",
                }}
              />
            )}
            <div
              className="rp-matrix"
              style={{ "--rp-columns": columns.length }}
            >
              <div className="rp-matrix-head" aria-hidden="true">
                <span>โมดูล</span>
                {columns.map((action) => (
                  <span key={action}>{ACTIONS[action]}</span>
                ))}
              </div>
              {sections.map((section) => (
                <div key={section.id} className="rp-section">
                  <h3 className="rp-section-title">{section.label}</h3>
                  {section.groups.map((group) => {
                    const titleId = `rp-${organization.id}-${group.id}`;
                    const granted = group.actions.some((action) =>
                      state.permissions.has(`${group.id}.${action}`),
                    );
                    return (
                      <div
                        key={group.id}
                        role="group"
                        aria-labelledby={titleId}
                        className={`rp-row ${granted ? "has-grant" : ""}`}
                      >
                        <div className="rp-row-label">
                          <span id={titleId} className="rp-row-title">
                            {group.label}
                          </span>
                          <small>{group.hint}</small>
                        </div>
                        {columns.map((action) => {
                          const key = `${group.id}.${action}`;
                          // "manage" covers the whole module, so its row shows as included.
                          const implied =
                            action !== "manage" &&
                            state.permissions.has(`${group.id}.manage`);
                          return (
                            <label
                              key={action}
                              className={`rp-cell ${implied ? "is-implied" : ""}`}
                              title={
                                implied
                                  ? `${group.meanings[action]} (รวมอยู่ในสิทธิ์จัดการ)`
                                  : group.meanings[action]
                              }
                            >
                              <input
                                type="checkbox"
                                checked={implied || state.permissions.has(key)}
                                disabled={busy || implied}
                                onChange={(event) =>
                                  toggle(key, event.target.checked)
                                }
                              />
                              <span className="rp-cell-label">
                                {ACTIONS[action]}
                              </span>
                            </label>
                          );
                        })}
                        <details className="rp-row-meanings">
                          <summary>ความหมายของแต่ละสิทธิ์</summary>
                          <dl>
                            {group.actions.map((action) => (
                              <div key={action}>
                                <dt>{ACTIONS[action]}</dt>
                                <dd>{group.meanings[action]}</dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="rp-savebar">
              <p className="rp-savebar-hint">
                {organization.org_type === "school"
                  ? "บทบาทในโรงเรียน การมอบหมายห้อง และข้อจำกัดข้อมูลรายสมาชิกยังมีผลร่วมกับสิทธิ์ชุดนี้"
                  : "สิทธิ์ข้อมูลละเอียดรายสมาชิกและขอบเขตข้อมูลเดิมยังมีผล"}
              </p>
              <div className="rp-savebar-actions">
                <button
                  type="button"
                  className="rp-btn"
                  disabled={busy}
                  onClick={load}
                >
                  <FiRefreshCw aria-hidden="true" />
                  โหลดสิทธิ์ล่าสุด
                </button>
                <button
                  type="button"
                  className="rp-btn rp-btn--primary"
                  disabled={busy || (!dirty && state.configured)}
                  onClick={save}
                >
                  <FiSave aria-hidden="true" />
                  {busy ? "กำลังบันทึก..." : "บันทึกสิทธิ์ในหน่วยงานนี้"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
