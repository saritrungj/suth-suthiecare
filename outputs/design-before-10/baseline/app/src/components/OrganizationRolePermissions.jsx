import { toDisplayText } from "../utils/textPresentation.js";
import { useEffect, useRef, useState } from "react";
import { FiRefreshCw, FiSave } from "react-icons/fi";
import { PERMISSION_GROUPS } from "../permissions/permissionRegistry";
import {
  getOrganizationRolePermissions,
  saveOrganizationRolePermissions,
} from "../services/api";
import {
  SettingsCheck,
  SettingsEmpty,
  SettingsFeedback,
  SettingsLoading,
} from "./ManagementSettings";

const actions = {
  view: "ดูข้อมูล",
  manage: "จัดการ",
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  assign: "จัดสรร",
  export: "ส่งออก",
};
export default function OrganizationRolePermissions({ organization, roles }) {
  const [roleId, setRoleId] = useState("");
  const [state, setState] = useState(null);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const generation = useRef(0);
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
      setState({ ...data, permissions: new Set(data.permissions) });
      setSaved(data.permissions);
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
    state &&
    (state.permissions.size !== saved.length ||
      saved.some((key) => !state.permissions.has(key)));
  const save = async () => {
    const currentGeneration = generation.current;
    setBusy(true);
    setNotice(null);
    try {
      const permissions = [...state.permissions];
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
    <section
      className="management-settings"
      aria-label="บทบาทและสิทธิ์ในหน่วยงาน"
    >
      <div className="settings-heading">
        <div>
          <h2>บทบาทและสิทธิ์ในหน่วยงาน</h2>
          <p>
            กำหนดสิทธิ์เฉพาะ {organization.name}{" "}
            บทบาทชื่อเดียวกันในหน่วยงานอื่นตั้งสิทธิ์ต่างกันได้ สิทธิ์ System
            Admin แยกจากส่วนนี้
          </p>
        </div>
      </div>
      <div className="settings-toolbar">
        <label className="settings-field">
          บทบาทที่ตั้งสิทธิ์{" "}
          <select
            value={roleId}
            disabled={busy}
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
        {state && (
          <span className="settings-count">
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
      ) : !state ? (
        <button className="settings-button" type="button" onClick={load}>
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
          <div className="settings-permissions">
            {PERMISSION_GROUPS.filter((group) => group.id !== "content").map(
              (group) => (
                <fieldset
                  key={group.id}
                  disabled={busy}
                  className="settings-permission-row"
                >
                  <legend>{toDisplayText(group.label)}</legend>
                  <div className="settings-permission-options">
                    {group.actions.map((action) => {
                      const key = `${group.id}.${action}`;
                      return (
                        <SettingsCheck
                          key={key}
                          checked={state.permissions.has(key)}
                          onChange={(event) => {
                            const granted = event.target.checked;
                            setState((current) => {
                              const permissions = new Set(current.permissions);
                              granted
                                ? permissions.add(key)
                                : permissions.delete(key);
                              return { ...current, permissions };
                            });
                          }}
                        >
                          {actions[action]}
                        </SettingsCheck>
                      );
                    })}
                  </div>
                </fieldset>
              ),
            )}
          </div>
          <div className="settings-actions">
            <p className="settings-hint">
              สิทธิ์ข้อมูลละเอียดรายสมาชิกและขอบเขตข้อมูลเดิมยังมีผล
            </p>
            <button
              type="button"
              className="settings-button"
              disabled={busy}
              onClick={load}
            >
              <FiRefreshCw aria-hidden="true" />
              โหลดสิทธิ์ล่าสุด
            </button>
            <button
              type="button"
              className="settings-button settings-button--primary"
              disabled={busy || (!dirty && state.configured)}
              onClick={save}
            >
              <FiSave aria-hidden="true" />
              {busy ? "กำลังบันทึก..." : "บันทึกสิทธิ์ในหน่วยงานนี้"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
