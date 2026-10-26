import { useEffect, useRef, useState } from "react";
import { FiLayers, FiPlus, FiTrash2 } from "react-icons/fi";
import SearchableSelect from "../../components/SearchableSelect";
import OrganizationRolePermissions from "../../components/OrganizationRolePermissions";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  getOrganizations,
  getOrganizationRoles,
  createOrganizationRole,
  deleteOrganizationRole,
} from "../../services/api";
import { confirmAlert, showSuccessToast } from "../../utils/alerts";
import "../../components/ManagementSettings.css";
import "./RolesPermissions.css";
import { PageHero } from "../../components/dashboard/DashboardKit";

const TYPE_LABELS = { school: "โรงเรียน", hospital: "โรงพยาบาล" };
// Starting rights for a new role (server: authorization/rolePresets.js).
const ROLE_PRESETS = [
  { id: "", label: "เริ่มจากว่าง แล้วติ๊กสิทธิ์เอง" },
  {
    id: "supervisor",
    label: "หัวหน้างาน: ดูภาพรวม รายงาน และประวัติการแก้ไข",
    name: "หัวหน้างาน",
  },
  {
    id: "school_admin",
    type: "school",
    label: "ผู้ดูแลโรงเรียน: โครงสร้างโรงเรียน ทะเบียนและนำเข้านักเรียน",
    name: "ผู้ดูแลโรงเรียน",
  },
  {
    id: "mental_admin",
    type: "school",
    label: "ผู้ดูแลสุขภาพจิต: รอบคัดกรอง ดูแลนักเรียน และอนุมัติการส่งต่อ",
    name: "ผู้ดูแลสุขภาพจิต",
  },
  {
    id: "counselor",
    type: "school",
    label: "ครูแนะแนว: บันทึกแนะแนว มอบหมายงานติดตาม และดูแลเคส",
    name: "ครูแนะแนว",
  },
  {
    id: "subject_teacher",
    type: "school",
    label: "ครูรายวิชา: ดูรายชื่อนักเรียนและรายงานพฤติกรรม",
    name: "ครูรายวิชา",
  },
];

export default function RolesPermissions() {
  const { authorization, activeOrganization, setActiveOrganization } =
    usePermissions();
  const system = authorization?.is_system_admin === true;
  const [organizations, setOrganizations] = useState([]),
    [error, setError] = useState("");
  const [list, setList] = useState({ org: null, roles: [] });
  const [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false);
  const [roleId, setRoleId] = useState(""),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [preset, setPreset] = useState("");
  const generation = useRef(0);
  const orgId =
    activeOrganization && activeOrganization !== "all"
      ? String(activeOrganization)
      : "";
  const currentOrg = useRef(orgId);
  currentOrg.current = orgId;
  const available = organizations.filter(
    (o) =>
      o.org_level !== "main" && o.kind !== "main" && o.status !== "inactive",
  );
  const organization = available.find((o) => String(o.id) === orgId);
  const ready = list.org === orgId;
  const roles = ready ? list.roles : [];
  useEffect(() => {
    let alive = true;
    if (!system) {
      setOrganizations(authorization?.organizations || []);
      return;
    }
    getOrganizations()
      .then(({ data }) => {
        if (alive)
          setOrganizations(
            Array.isArray(data) && data.length
              ? data
              : authorization?.organizations || [],
          );
      })
      .catch(() => {
        if (alive) setError("โหลดรายชื่อหน่วยงานไม่สำเร็จ");
      });
    return () => {
      alive = false;
    };
  }, [system, authorization]);
  const load = async (preferred) => {
    if (currentOrg.current !== orgId) return;
    const current = ++generation.current;
    if (!orgId || !system) {
      setList({ org: orgId, roles: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await getOrganizationRoles(orgId);
      if (current !== generation.current) return;
      const nextRoles = Array.isArray(response.data) ? response.data : [];
      setList({ org: orgId, roles: nextRoles });
      setRoleId((previous) =>
        nextRoles.some((r) => String(r.id) === String(preferred ?? previous))
          ? String(preferred ?? previous)
          : String(nextRoles[0]?.id || ""),
      );
    } catch {
      if (current === generation.current)
        setError("โหลดบทบาทของหน่วยงานไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      if (current === generation.current) setLoading(false);
    }
  };
  useEffect(() => {
    setRoleId("");
    setName("");
    setDescription("");
    setPreset("");
    load();
    return () => {
      generation.current++;
    };
  }, [orgId, system]);
  const create = async (event) => {
    event.preventDefault();
    if (busy || !organization) return;
    const scope = orgId,
      current = generation.current;
    setBusy(true);
    setError("");
    try {
      const { data } = await createOrganizationRole(scope, {
        name,
        description,
        ...(preset && { preset }),
      });
      if (current !== generation.current) return;
      setName("");
      setDescription("");
      setPreset("");
      event.target.closest("details")?.removeAttribute("open");
      await load(data.id);
      await showSuccessToast("เพิ่มบทบาทในหน่วยงานแล้ว");
    } catch (e) {
      if (current === generation.current)
        setError(
          e.response?.status === 409
            ? "หน่วยงานนี้มีบทบาทดังกล่าวแล้ว"
            : "เพิ่มบทบาทไม่สำเร็จ กรุณาลองใหม่",
        );
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!roleId || busy) return;
    const scope = orgId,
      id = roleId,
      current = generation.current;
    const role = roles.find((r) => String(r.id) === id);
    if (
      !(await confirmAlert({
        title: "ลบบทบาทจากหน่วยงาน?",
        text: "ลบ " + role.name + " ออกจาก " + organization.name,
        confirmText: "ลบบทบาท",
        danger: true,
      }))
    )
      return;
    if (current !== generation.current) return;
    setBusy(true);
    setError("");
    try {
      await deleteOrganizationRole(scope, id);
      if (current === generation.current) await load();
    } catch (e) {
      if (current === generation.current)
        setError(
          e.response?.status === 409
            ? "บทบาทนี้ยังมีสมาชิกใช้งานอยู่ กรุณาเปลี่ยนบทบาทสมาชิกก่อน"
            : "ลบบทบาทไม่สำเร็จ",
        );
    } finally {
      setBusy(false);
    }
  };
  const roleTools = {
    remove: (
      <button
        type="button"
        className="rp-btn rp-btn--danger rp-btn--small"
        disabled={!roleId || busy}
        onClick={remove}
      >
        <FiTrash2 aria-hidden="true" />
        ลบบทบาทที่เลือก
      </button>
    ),
    create: (
      <details className="rp-create">
        <summary>
          <FiPlus aria-hidden="true" />
          เพิ่มบทบาทในหน่วยงานนี้
        </summary>
        <form onSubmit={create}>
          <label>
            ชุดสิทธิ์ตั้งต้น
            <SearchableSelect
              aria-label="ชุดสิทธิ์ตั้งต้น"
              value={preset}
              disabled={busy}
              onChange={(e) => {
                const chosen = ROLE_PRESETS.find(
                  (p) => p.id === e.target.value,
                );
                setPreset(e.target.value);
                if (chosen?.name && !name.trim()) setName(chosen.name);
              }}
            >
              {ROLE_PRESETS.filter(
                (p) =>
                  !p.type || p.type === (organization?.org_type || "hospital"),
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </SearchableSelect>
          </label>
          <label>
            ชื่อบทบาท
            <input
              required
              minLength={2}
              maxLength={100}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            คำอธิบาย
            <input
              maxLength={255}
              value={description}
              disabled={busy}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <button className="rp-btn rp-btn--primary" disabled={busy}>
            {busy ? "กำลังเพิ่ม…" : "เพิ่มบทบาท"}
          </button>
        </form>
      </details>
    ),
  };
  return (
    <main className="srp-roles-permissions-page">
      <div className="srp-main-content-area">
        <PageHero
          title="บทบาทและสิทธิ์"
          description="สร้างบทบาทและกำหนดชุดสิทธิ์ตามโมดูลของแต่ละหน่วยงาน การมอบหมายบุคลากรจัดการที่หน้าผู้ดูแลระบบและเจ้าหน้าที่"
        />
        <div className="rp-card rp-context">
          <FiLayers className="rp-context-icon" aria-hidden="true" />
          <label className="rp-context-field">
            หน่วยงานที่จัดการ
            <SearchableSelect
              aria-label="หน่วยงานที่จัดการ"
              value={orgId}
              disabled={busy}
              onChange={(e) => setActiveOrganization(e.target.value)}
            >
              <option value="" disabled>
                เลือกหน่วยงาน
              </option>
              {available.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </SearchableSelect>
          </label>
          {organization && (
            <span
              className={`rp-type rp-type--${organization.org_type || "hospital"}`}
            >
              {TYPE_LABELS[organization.org_type] || TYPE_LABELS.hospital}
            </span>
          )}
        </div>
        {error && (
          <div
            className="settings-feedback settings-feedback--error rp-error"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              className="rp-btn rp-btn--small"
              onClick={() => load()}
            >
              ลองใหม่
            </button>
          </div>
        )}
        {!organization ? (
          <div className="rp-card rp-empty" role="status">
            เลือกหน่วยงานย่อยเพื่อดูบทบาทและสิทธิ์ของหน่วยงานนั้น
          </div>
        ) : loading || !ready ? (
          <div className="rp-card rp-empty" role="status">
            กำลังโหลดบทบาทของ {organization.name}…
          </div>
        ) : (
          <OrganizationRolePermissions
            key={orgId}
            organization={organization}
            roles={roles}
            roleId={roleId}
            onRoleChange={setRoleId}
            roleTools={roleTools}
          />
        )}
      </div>
    </main>
  );
}
