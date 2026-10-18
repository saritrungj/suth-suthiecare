import { toDisplayText } from "../utils/textPresentation.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiBell, FiGitMerge, FiRefreshCw, FiSave } from "react-icons/fi";
import {
  getReferralDestinationsConfig,
  setReferralDestinationsConfig,
  getNotificationTarget,
  setNotificationTarget,
} from "../services/api";
import {
  SettingsCheck,
  SettingsEmpty,
  SettingsFeedback,
  SettingsLoading,
  SettingsPanel,
} from "./ManagementSettings";

const list = (value) => (Array.isArray(value) ? value : []);
const initialResource = () => ({ loading: true, error: false, data: null });
const RESOURCE_KEYS = ["referrals", "notification"];
const buttonClass = "settings-button settings-button--primary";

export default function OrganizationServiceSettings({
  organization,
  organizations,
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
  const generation = useRef(0);
  const loadResources = useCallback(
    async (keys) => {
      const current = generation.current;
      const loaders = {
        referrals: getReferralDestinationsConfig,
        notification: getNotificationTarget,
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
  const destinationsList = organizations.filter(
    (item) =>
      item.kind === "unit" &&
      item.status === "active" &&
      Number(item.id) !== Number(org),
  );
  const busy = (key) => Boolean(actions[key]?.busy);
  return (
    <section
      className="management-settings"
      aria-label="การส่งต่อและการแจ้งเตือน"
    >
      <div className="settings-heading">
        <div>
          <h2>การส่งต่อและการแจ้งเตือน</h2>
          <p>
            จัดการปลายทางส่งต่อและการแจ้งเตือนของหน่วยงาน
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
    </section>
  );
}
