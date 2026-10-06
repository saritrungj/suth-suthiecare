import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiClock,
  FiFileText,
  FiGitMerge,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiUserCheck,
} from "react-icons/fi";
import {
  getReferralDestinationsConfig,
  setReferralDestinationsConfig,
  getNotificationTarget,
  setNotificationTarget,
  getMemberDataPermissions,
  setMemberDataPermissions,
  getPdpaRequests,
  updatePdpaRequest,
  getOrganizationForms,
  getProcessingPurposes,
  setProcessingPurpose,
  getRetentionPolicies,
  setRetentionPolicy,
  previewRetention,
} from "../services/api";
import {
  SettingsCheck,
  SettingsEmpty,
  SettingsFeedback,
  SettingsLoading,
  SettingsPanel,
} from "./ManagementSettings";
import { requestTypeLabel, requestStatusLabel } from "../utils/privacyLabels";
import { isoToThai } from "../utils/thaiDate";

const KEYS = {
  "pii.view": "เปิดข้อมูลส่วนบุคคลเต็ม",
  "clinical.view": "เปิดข้อมูลสุขภาพ",
};
const blankPurpose = () => ({
  purpose: "",
  legal_basis: "",
  notice_version: "",
  notice_text: "",
});
const basisLabels = {
  consent: "ความยินยอม",
  healthcare: "การดูแลรักษาสุขภาพ",
  legal_obligation: "การปฏิบัติตามกฎหมาย",
  public_task: "ภารกิจเพื่อประโยชน์สาธารณะ",
  vital_interests: "การป้องกันอันตรายต่อชีวิต",
  contract: "การปฏิบัติตามสัญญา",
  legitimate_interests: "ประโยชน์โดยชอบด้วยกฎหมาย",
};
const list = (value) => (Array.isArray(value) ? value : []);
const initialResource = () => ({ loading: true, error: false, data: null });
const RESOURCE_KEYS = [
  "referrals",
  "notification",
  "requests",
  "forms",
  "purposes",
  "retention",
];
const buttonClass = "settings-button settings-button--primary";

export default function PdpaOrganizationSettings({
  organization,
  organizations,
  members,
}) {
  const org = organization.id;
  const [resources, setResources] = useState(() =>
    Object.fromEntries(RESOURCE_KEYS.map((key) => [key, initialResource()])),
  );
  const [actions, setActions] = useState({});
  const [destinations, setDestinations] = useState([]);
  const [destination, setDestination] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [verified, setVerified] = useState(false);
  const [permissions, setPermissions] = useState({});
  const [memberLoading, setMemberLoading] = useState({});
  const [formId, setFormId] = useState("");
  const [purpose, setPurpose] = useState(blankPurpose);
  const [approved, setApproved] = useState(false);
  const [days, setDays] = useState("");
  const generation = useRef(0);
  const loadResources = useCallback(
    async (keys) => {
      const current = generation.current;
      const loaders = {
        referrals: getReferralDestinationsConfig,
        notification: getNotificationTarget,
        requests: getPdpaRequests,
        forms: getOrganizationForms,
        purposes: getProcessingPurposes,
        retention: getRetentionPolicies,
      };
      setResources((previous) => ({
        ...previous,
        ...Object.fromEntries(
          keys.map((key) => [
            key,
            { ...previous[key], loading: true, error: false },
          ]),
        ),
      }));
      await Promise.allSettled(
        keys.map(async (key) => {
          try {
            const { data } = await loaders[key](org);
            if (current !== generation.current) return;
            const value = key === "notification" ? data : list(data);
            setResources((previous) => ({
              ...previous,
              [key]: { loading: false, error: false, data: value },
            }));
            if (key === "referrals")
              setDestinations(
                value
                  .filter((item) => item.enabled)
                  .map((item) => Number(item.destination_organization_id)),
              );
            if (key === "notification") setEnabled(Boolean(value?.enabled));
            if (key === "retention")
              setDays(
                String(
                  value.find((item) => item.data_type === "form_responses")
                    ?.retention_days || "",
                ),
              );
          } catch {
            if (current === generation.current)
              setResources((previous) => ({
                ...previous,
                [key]: { ...previous[key], loading: false, error: true },
              }));
          }
        }),
      );
    },
    [org],
  );
  useEffect(() => {
    generation.current++;
    loadResources(RESOURCE_KEYS);
    return () => {
      generation.current++;
    };
  }, [loadResources]);
  const act = async (key, fn, reload, success) => {
    const current = generation.current;
    setActions((previous) => ({ ...previous, [key]: { busy: true } }));
    try {
      const result = await fn();
      if (current !== generation.current) return false;
      if (reload?.length) await loadResources(reload);
      if (current !== generation.current) return false;
      setActions((previous) => ({
        ...previous,
        [key]: {
          busy: false,
          notice: {
            type: "success",
            text:
              typeof success === "function"
                ? success(result)
                : success || "บันทึกแล้ว",
          },
        },
      }));
      return true;
    } catch (error) {
      const text =
        error.response?.status === 409
          ? "ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง"
          : error.response?.status === 422
            ? "ข้อมูลยังไม่ครบหรือไม่ถูกต้อง กรุณาตรวจช่องกรอกและการยืนยันก่อนลองอีกครั้ง"
            : "ดำเนินการไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง";
      if (current === generation.current)
        setActions((previous) => ({
          ...previous,
          [key]: { busy: false, notice: { type: "error", text } },
        }));
      return false;
    }
  };
  const available = (key) => !resources[key].loading && !resources[key].error;
  const feedback = (key) => <SettingsFeedback notice={actions[key]?.notice} />;
  const resourceState = (keys, label) =>
    keys.some((key) => resources[key].loading) ? (
      <SettingsLoading />
    ) : keys.some((key) => resources[key].error) ? (
      <>
        <SettingsFeedback
          notice={{
            type: "error",
            text: `โหลด${label}ไม่สำเร็จ ลองโหลดข้อมูลอีกครั้ง`,
          }}
        />
        <button
          type="button"
          className="settings-button"
          onClick={() => loadResources(keys)}
        >
          <FiRefreshCw aria-hidden="true" />
          โหลดข้อมูลอีกครั้ง
        </button>
      </>
    ) : null;
  const target = resources.notification.data;
  const forms = list(resources.forms.data).filter(
    (form) => Number(form.organization_id) === Number(org),
  );
  const requests = list(resources.requests.data);
  const retention = list(resources.retention.data).find(
    (item) => item.data_type === "form_responses",
  );
  const destinationsList = organizations.filter(
    (item) =>
      item.kind === "unit" &&
      item.status === "active" &&
      Number(item.id) !== Number(org),
  );
  const busy = (key) => Boolean(actions[key]?.busy);
  const loadMember = async (member) => {
    const key = `member-${member.id}`,
      current = generation.current;
    setMemberLoading((previous) => ({ ...previous, [member.id]: true }));
    setActions((previous) => ({ ...previous, [key]: {} }));
    try {
      const { data } = await getMemberDataPermissions(org, member.id);
      if (current === generation.current)
        setPermissions((previous) => ({
          ...previous,
          [member.id]: Object.fromEntries(
            Object.keys(KEYS).map((key) => [
              key,
              Boolean(
                list(data).find((item) => item.permission_key === key)?.granted,
              ),
            ]),
          ),
        }));
    } catch {
      if (current === generation.current)
        setActions((previous) => ({
          ...previous,
          [key]: {
            notice: {
              type: "error",
              text: "โหลดสิทธิ์ไม่สำเร็จ กดตรวจสิทธิ์เพื่อลองอีกครั้ง",
            },
          },
        }));
    } finally {
      if (current === generation.current)
        setMemberLoading((previous) => ({ ...previous, [member.id]: false }));
    }
  };
  const updateRequest = (request, status) =>
    act(
      `request-${request.id}`,
      () =>
        updatePdpaRequest(request.id, {
          organization_id: org,
          version: request.version,
          status,
          ...(status === "identity_verified"
            ? { identity_verified: true }
            : {}),
          reason_code: {
            identity_verified: "IDENTITY_CHECKED",
            under_review: "REVIEW_STARTED",
            fulfilled: "FULFILLED",
            rejected: "EXCEPTION_REVIEWED",
          }[status],
        }),
      ["requests"],
      "อัปเดตสถานะคำขอแล้ว",
    );

  return (
    <section
      className="management-settings"
      aria-label="การตั้งค่าความปลอดภัยและ PDPA"
    >
      <div className="settings-heading">
        <div>
          <h2>ความปลอดภัยและ PDPA</h2>
          <p>
            จัดการการส่งต่อ การแจ้งเตือน และการใช้ข้อมูลเฉพาะหน่วยงานนี้
            เลือกหัวข้อที่ต้องการตั้งค่า
          </p>
        </div>
      </div>
      <SettingsPanel
        title="หน่วยงานปลายทางที่อนุญาตให้ส่งต่อ"
        description="กำหนดคู่ส่งต่อและตรวจปลายทางที่เปิดใช้งาน"
        icon={FiGitMerge}
      >
        <p className="settings-hint">
          การปิดปลายทางหยุดการส่งต่อใหม่ ประวัติเดิมยังติดตามได้
        </p>
        {resourceState(["referrals"], "คู่ส่งต่อ")}
        {available("referrals") && (
          <>
            {destinationsList.length ? (
              <ul className="settings-list">
                {destinationsList.map((item) => (
                  <li key={item.id}>
                    <SettingsCheck
                      checked={destinations.includes(Number(item.id))}
                      disabled={busy("referrals")}
                      onChange={(event) =>
                        setDestinations((current) =>
                          event.target.checked
                            ? [...current, Number(item.id)]
                            : current.filter((id) => id !== Number(item.id)),
                        )
                      }
                    >
                      {item.name}
                    </SettingsCheck>
                  </li>
                ))}
              </ul>
            ) : (
              <SettingsEmpty>
                ยังไม่มีหน่วยงานปลายทางที่เปิดใช้งานให้เลือก
              </SettingsEmpty>
            )}
            {feedback("referrals")}
            <div className="settings-actions">
              <span className="settings-count">
                อนุญาต {destinations.length} หน่วยงาน
              </span>
              <button
                type="button"
                className={buttonClass}
                disabled={busy("referrals")}
                onClick={() =>
                  act(
                    "referrals",
                    () =>
                      setReferralDestinationsConfig(
                        org,
                        destinations.map((id) => ({
                          organization_id: id,
                          enabled: true,
                        })),
                      ),
                    ["referrals"],
                    "บันทึกคู่ส่งต่อแล้ว",
                  )
                }
              >
                <FiSave aria-hidden="true" />
                {busy("referrals") ? "กำลังบันทึก..." : "บันทึกคู่ส่งต่อ"}
              </button>
            </div>
          </>
        )}
      </SettingsPanel>
      <SettingsPanel
        title="กลุ่มแจ้งเตือน Telegram ของหน่วยงาน"
        description="กำหนดปลายทางที่ตรวจสอบสมาชิกแล้ว"
        icon={FiBell}
      >
        {resourceState(["notification"], "ปลายทางแจ้งเตือน")}
        {available("notification") && (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                await act(
                  "notification",
                  () =>
                    setNotificationTarget(org, {
                      destination: destination.trim(),
                      enabled,
                      verified,
                    }),
                  ["notification"],
                  "บันทึกปลายทางแจ้งเตือนแล้ว",
                )
              ) {
                setDestination("");
                setVerified(false);
              }
            }}
          >
            <div className="settings-toolbar">
              <p className="settings-hint">
                ปลายทางปัจจุบัน:{" "}
                <strong>
                  {target?.destination_masked || "ยังไม่ได้ตั้งค่า"}
                </strong>
              </p>
              <span className="settings-status">
                {target?.enabled ? "เปิดแจ้งเตือน" : "ปิดแจ้งเตือน"}
              </span>
            </div>
            <label className="settings-field">
              Chat ID ใหม่{" "}
              <input
                required
                pattern="-?[0-9]{1,30}"
                maxLength={31}
                autoComplete="off"
                value={destination}
                disabled={busy("notification")}
                onChange={(event) => setDestination(event.target.value)}
              />
              <small>
                กรอก Chat ID
                ของหน่วยงานเมื่อต้องการเปลี่ยนปลายทางหรือสถานะการแจ้งเตือน
              </small>
            </label>
            <SettingsCheck
              checked={enabled}
              disabled={busy("notification")}
              onChange={(event) => setEnabled(event.target.checked)}
            >
              เปิดแจ้งเตือน
            </SettingsCheck>
            <SettingsCheck
              className="settings-check--confirmation"
              checked={verified}
              disabled={busy("notification")}
              onChange={(event) => setVerified(event.target.checked)}
            >
              ตรวจสมาชิกและปลายทางกับผู้รับผิดชอบหน่วยงานแล้ว
            </SettingsCheck>
            {feedback("notification")}
            <div className="settings-actions">
              <button
                type="submit"
                className={buttonClass}
                disabled={
                  busy("notification") || !destination.trim() || !verified
                }
              >
                <FiSave aria-hidden="true" />
                {busy("notification") ? "กำลังบันทึก..." : "บันทึกปลายทาง"}
              </button>
            </div>
          </form>
        )}
      </SettingsPanel>
      <SettingsPanel
        title="สิทธิ์ข้อมูลละเอียดรายสมาชิก"
        description="กำหนดการเปิดข้อมูลส่วนบุคคลและสุขภาพรายคน"
        icon={FiShield}
      >
        <p className="settings-hint">
          สิทธิ์เหล่านี้ใช้ร่วมกับสิทธิ์อ่านและขอบเขตข้อมูลเดิม
        </p>
        {members.length ? (
          members.map((member) => {
            const key = `member-${member.id}`;
            return (
              <article key={member.id} className="settings-record">
                <div className="settings-record-heading">
                  <div>
                    <strong>{member.name || member.username}</strong>
                    <p className="settings-hint">
                      {member.role_name || "สมาชิกหน่วยงาน"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="settings-button"
                    disabled={memberLoading[member.id] || busy(key)}
                    onClick={() => loadMember(member)}
                  >
                    {memberLoading[member.id]
                      ? "กำลังตรวจสิทธิ์..."
                      : "ตรวจสิทธิ์"}
                  </button>
                </div>
                {permissions[member.id] && (
                  <>
                    <div className="settings-permission-options">
                      {Object.entries(KEYS).map(([key, label]) => (
                        <SettingsCheck
                          key={key}
                          checked={permissions[member.id][key]}
                          disabled={busy(`member-${member.id}`)}
                          onChange={(event) =>
                            setPermissions((current) => ({
                              ...current,
                              [member.id]: {
                                ...current[member.id],
                                [key]: event.target.checked,
                              },
                            }))
                          }
                        >
                          {label}
                        </SettingsCheck>
                      ))}
                    </div>
                    <div className="settings-actions">
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={busy(key)}
                        onClick={() =>
                          act(
                            key,
                            () =>
                              setMemberDataPermissions(
                                org,
                                member.id,
                                permissions[member.id],
                              ),
                            [],
                            "บันทึกสิทธิ์ของสมาชิกแล้ว",
                          )
                        }
                      >
                        <FiSave aria-hidden="true" />
                        {busy(key) ? "กำลังบันทึก..." : "บันทึกสิทธิ์"}
                      </button>
                    </div>
                  </>
                )}
                {feedback(key)}
              </article>
            );
          })
        ) : (
          <SettingsEmpty>
            ยังไม่มีสมาชิก เพิ่มสมาชิกในหน่วยงานก่อนกำหนดสิทธิ์รายคน
          </SettingsEmpty>
        )}
      </SettingsPanel>
      <SettingsPanel
        title="วัตถุประสงค์และประกาศความเป็นส่วนตัว"
        description="เลือกฟอร์มและบันทึกประกาศที่ผู้รับผิดชอบยืนยันแล้ว"
        icon={FiFileText}
      >
        {resourceState(["forms", "purposes"], "ฟอร์มและประกาศ")}
        {available("forms") &&
          available("purposes") &&
          (forms.length ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                act(
                  "purposes",
                  () =>
                    setProcessingPurpose(org, formId, {
                      ...purpose,
                      approved: true,
                    }),
                  ["purposes"],
                  "บันทึกประกาศแล้ว",
                );
              }}
            >
              <div className="settings-grid">
                <label className="settings-field settings-wide">
                  ฟอร์ม{" "}
                  <select
                    required
                    value={formId}
                    disabled={busy("purposes")}
                    onChange={(event) => {
                      const id = event.target.value;
                      setFormId(id);
                      setApproved(false);
                      const row = list(resources.purposes.data).find(
                        (item) => String(item.form_id) === id,
                      );
                      setPurpose(
                        row
                          ? {
                              purpose: row.purpose,
                              legal_basis: row.legal_basis,
                              notice_version: row.notice_version,
                              notice_text: row.notice_text,
                            }
                          : blankPurpose(),
                      );
                    }}
                  >
                    <option value="">เลือกฟอร์ม</option>
                    {forms.map((form) => (
                      <option key={form.id} value={form.id}>
                        {String(form.title || "ฟอร์ม").replace(/<[^>]*>/g, "")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {formId && (
                <>
                  <div className="settings-grid">
                    <label className="settings-field">
                      รหัสวัตถุประสงค์{" "}
                      <input
                        required
                        pattern="[A-Za-z0-9_.-]{1,80}"
                        maxLength={80}
                        value={purpose.purpose}
                        disabled={busy("purposes")}
                        onChange={(event) => {
                          setApproved(false);
                          setPurpose((current) => ({
                            ...current,
                            purpose: event.target.value,
                          }));
                        }}
                      />
                      <small>
                        ใช้ตัวอักษรอังกฤษ ตัวเลข จุด ขีดกลาง หรือขีดล่าง
                      </small>
                    </label>
                    <label className="settings-field">
                      รุ่นประกาศ{" "}
                      <input
                        required
                        pattern="[A-Za-z0-9_.-]{1,80}"
                        maxLength={80}
                        value={purpose.notice_version}
                        disabled={busy("purposes")}
                        onChange={(event) => {
                          setApproved(false);
                          setPurpose((current) => ({
                            ...current,
                            notice_version: event.target.value,
                          }));
                        }}
                      />
                      <small>เมื่อแก้เนื้อหาประกาศเดิม ต้องใช้รุ่นใหม่</small>
                    </label>
                    <label className="settings-field settings-wide">
                      ฐานการประมวลผลที่ผู้รับผิดชอบยืนยัน{" "}
                      <select
                        required
                        value={purpose.legal_basis}
                        disabled={busy("purposes")}
                        onChange={(event) => {
                          setApproved(false);
                          setPurpose((current) => ({
                            ...current,
                            legal_basis: event.target.value,
                          }));
                        }}
                      >
                        <option value="">เลือกฐานการประมวลผล</option>
                        {Object.entries(basisLabels).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="settings-field settings-wide">
                      ข้อความประกาศ{" "}
                      <textarea
                        required
                        maxLength={20000}
                        rows={8}
                        value={purpose.notice_text}
                        disabled={busy("purposes")}
                        onChange={(event) => {
                          setApproved(false);
                          setPurpose((current) => ({
                            ...current,
                            notice_text: event.target.value,
                          }));
                        }}
                      />
                    </label>
                  </div>
                  <SettingsCheck
                    className="settings-check--confirmation"
                    checked={approved}
                    disabled={busy("purposes")}
                    onChange={(event) => setApproved(event.target.checked)}
                  >
                    ผู้รับผิดชอบ PDPA ยืนยันข้อความและฐานการประมวลผลแล้ว
                  </SettingsCheck>
                </>
              )}
              {feedback("purposes")}
              <div className="settings-actions">
                <button
                  type="submit"
                  className={buttonClass}
                  disabled={busy("purposes") || !approved || !formId}
                >
                  <FiSave aria-hidden="true" />
                  {busy("purposes") ? "กำลังบันทึก..." : "บันทึกประกาศ"}
                </button>
              </div>
            </form>
          ) : (
            <SettingsEmpty>
              ยังไม่มีฟอร์มในหน่วยงานนี้ สร้างฟอร์มก่อนตั้งวัตถุประสงค์และประกาศ
            </SettingsEmpty>
          ))}
      </SettingsPanel>
      <SettingsPanel
        title="คำขอใช้สิทธิ"
        description="ตรวจสอบตัวตนและติดตามการพิจารณาคำขอ"
        icon={FiUserCheck}
      >
        {resourceState(["requests"], "คำขอใช้สิทธิ")}
        {available("requests") && (
          <>
            {requests.length ? (
              requests.map((request) => (
                <article key={request.id} className="settings-record">
                  <div className="settings-record-heading">
                    <div>
                      <strong>
                        คำขอ #{request.id} ·{" "}
                        {requestTypeLabel(request.request_type)}
                      </strong>
                      <p className="settings-hint">
                        {request.created_at
                          ? `ส่งคำขอ ${isoToThai(request.created_at)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`settings-status settings-status--${request.status}`}
                    >
                      {requestStatusLabel(request.status)}
                    </span>
                  </div>
                  <p className="settings-prose">
                    {request.detail || "ไม่มีรายละเอียดเพิ่มเติม"}
                  </p>
                  {feedback(`request-${request.id}`)}
                  {["submitted", "identity_verified", "under_review"].includes(
                    request.status,
                  ) && (
                    <div className="settings-actions">
                      {request.status === "submitted" && (
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={busy(`request-${request.id}`)}
                          onClick={() =>
                            updateRequest(request, "identity_verified")
                          }
                        >
                          ยืนยันว่าตรวจสอบตัวตนแล้ว
                        </button>
                      )}
                      {request.status === "identity_verified" && (
                        <button
                          type="button"
                          className={buttonClass}
                          disabled={busy(`request-${request.id}`)}
                          onClick={() => updateRequest(request, "under_review")}
                        >
                          เริ่มตรวจข้อยกเว้นและดำเนินการ
                        </button>
                      )}
                      {request.status === "under_review" && (
                        <>
                          <button
                            type="button"
                            className="settings-button settings-button--danger"
                            disabled={busy(`request-${request.id}`)}
                            onClick={() => updateRequest(request, "rejected")}
                          >
                            บันทึกปฏิเสธหลังตรวจข้อยกเว้น
                          </button>
                          <button
                            type="button"
                            className={buttonClass}
                            disabled={busy(`request-${request.id}`)}
                            onClick={() => updateRequest(request, "fulfilled")}
                          >
                            บันทึกว่าดำเนินการครบแล้ว
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <SettingsEmpty>ยังไม่มีคำขอใช้สิทธิในหน่วยงานนี้</SettingsEmpty>
            )}
            <div className="settings-actions">
              <button
                type="button"
                className="settings-button"
                onClick={() => loadResources(["requests"])}
              >
                <FiRefreshCw aria-hidden="true" />
                โหลดคำขอล่าสุด
              </button>
            </div>
          </>
        )}
      </SettingsPanel>
      <SettingsPanel
        title="อายุเก็บข้อมูลและการตรวจรายการก่อนลบ"
        description="บันทึกนโยบายและตรวจจำนวนรายการ ระบบยังไม่ลบอัตโนมัติ"
        icon={FiClock}
      >
        {resourceState(["retention"], "นโยบายเก็บข้อมูล")}
        {available("retention") && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              act(
                "retention",
                () =>
                  setRetentionPolicy(org, {
                    data_type: "form_responses",
                    retention_days: Number(days),
                    approved: true,
                  }),
                ["retention"],
                "บันทึกนโยบายที่ยืนยันแล้ว ระบบยังไม่ลบข้อมูลอัตโนมัติ",
              );
            }}
          >
            <p className="settings-hint">
              ระบบยังไม่ลบอัตโนมัติ นโยบายปัจจุบัน:{" "}
              <strong>
                {retention?.retention_days
                  ? `${retention.retention_days} วัน`
                  : "ยังไม่กำหนด"}
              </strong>
            </p>
            <label className="settings-field">
              อายุเก็บคำตอบฟอร์มที่หน่วยงานยืนยัน (วัน){" "}
              <input
                required
                type="number"
                min="1"
                max="36500"
                step="1"
                value={days}
                disabled={busy("retention") || busy("preview")}
                onChange={(event) => setDays(event.target.value)}
              />
              <small>
                บันทึกเฉพาะจำนวนวันที่ผู้รับผิดชอบหน่วยงานยืนยันแล้ว
              </small>
            </label>
            {feedback("retention")}
            {feedback("preview")}
            <div className="settings-actions">
              <button
                type="button"
                className="settings-button"
                disabled={
                  busy("retention") ||
                  busy("preview") ||
                  !retention?.retention_days
                }
                onClick={() =>
                  act(
                    "preview",
                    async () => (await previewRetention(org)).data,
                    [],
                    (data) =>
                      `พบ ${data.candidates} รายการตามนโยบาย ยังไม่ได้ลบข้อมูล`,
                  )
                }
              >
                {busy("preview") ? "กำลังตรวจรายการ..." : "ตรวจรายการโดยไม่ลบ"}
              </button>
              <button
                type="submit"
                className={buttonClass}
                disabled={busy("retention") || busy("preview") || !days}
              >
                <FiSave aria-hidden="true" />
                {busy("retention")
                  ? "กำลังบันทึก..."
                  : "บันทึกนโยบายที่ยืนยันแล้ว"}
              </button>
            </div>
          </form>
        )}
      </SettingsPanel>
    </section>
  );
}
