import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiRefreshCw, FiSend, FiShield } from "react-icons/fi";
import {
  getRightsOrganizations,
  getMyRightsRequests,
  createRightsRequest,
} from "../services/api";
import {
  PRIVACY_REQUEST_TYPES,
  requestTypeLabel,
  requestStatusLabel,
} from "../utils/privacyLabels";
import { isoToThai } from "../utils/thaiDate";
import {
  SettingsEmpty,
  SettingsFeedback,
  SettingsLoading,
  SettingsPanel,
} from "./ManagementSettings";
import "./PatientPrivacyRequests.css";

export default function PatientPrivacyRequests() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "th",
    en = language.startsWith("en");
  const [organizations, setOrganizations] = useState([]),
    [requests, setRequests] = useState([]);
  const [org, setOrg] = useState(""),
    [type, setType] = useState("access"),
    [detail, setDetail] = useState("");
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [notice, setNotice] = useState(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = generation.current;
    setLoading(true);
    setError(false);
    try {
      const [units, items] = await Promise.all([
        getRightsOrganizations(),
        getMyRightsRequests(),
      ]);
      if (current !== generation.current) return;
      setOrganizations(Array.isArray(units.data) ? units.data : []);
      setRequests(Array.isArray(items.data) ? items.data : []);
    } catch {
      if (current === generation.current) setError(true);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    generation.current++;
    load();
    return () => {
      generation.current++;
    };
  }, [load]);
  const submit = async (event) => {
    const current = generation.current;
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await createRightsRequest({
        organization_id: Number(org),
        request_type: type,
        detail: detail.trim(),
      });
      if (current !== generation.current) return;
      setDetail("");
      setNotice({
        type: "success",
        text: en
          ? "Request submitted. The organization will verify your identity and review it."
          : "ส่งคำขอแล้ว หน่วยงานจะตรวจสอบตัวตนและพิจารณาคำขอ",
      });
      await load();
    } catch {
      if (current === generation.current)
        setNotice({
          type: "error",
          text: en
            ? "Request could not be submitted. Your details are kept here. Please try again."
            : "ส่งคำขอไม่สำเร็จ รายละเอียดที่กรอกยังอยู่ กรุณาลองอีกครั้ง",
        });
    } finally {
      if (current === generation.current) setBusy(false);
    }
  };
  return (
    <section
      className="management-settings patient-privacy"
      aria-label={en ? "Privacy requests" : "คำขอเกี่ยวกับข้อมูลส่วนบุคคล"}
    >
      <SettingsPanel
        title={en ? "Privacy requests" : "คำขอเกี่ยวกับข้อมูลส่วนบุคคล"}
        description={
          en
            ? "Submit a request and follow its progress with your organization"
            : "ส่งคำขอและติดตามการพิจารณาจากหน่วยงานที่เคยรับบริการ"
        }
        icon={FiShield}
      >
        <SettingsFeedback notice={notice} />
        {loading ? (
          <SettingsLoading>
            {en ? "Loading requests..." : "กำลังโหลดคำขอ..."}
          </SettingsLoading>
        ) : error ? (
          <>
            <SettingsFeedback
              notice={{
                type: "error",
                text: en
                  ? "Requests could not be loaded. Please try again."
                  : "โหลดคำขอไม่สำเร็จ กรุณาลองโหลดข้อมูลอีกครั้ง",
              }}
            />
            <button className="settings-button" type="button" onClick={load}>
              <FiRefreshCw aria-hidden="true" />
              {en ? "Try again" : "โหลดข้อมูลอีกครั้ง"}
            </button>
          </>
        ) : (
          <>
            {organizations.length ? (
              <form onSubmit={submit}>
                <div className="settings-grid">
                  <label className="settings-field">
                    {en ? "Organization" : "หน่วยงาน"}
                    <select
                      required
                      value={org}
                      disabled={busy}
                      onChange={(event) => setOrg(event.target.value)}
                    >
                      <option value="">
                        {en
                          ? "Select an organization you received services from"
                          : "เลือกหน่วยงานที่เคยรับบริการ"}
                      </option>
                      {organizations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field">
                    {en ? "Request type" : "ประเภทคำขอ"}
                    <select
                      value={type}
                      disabled={busy}
                      onChange={(event) => setType(event.target.value)}
                    >
                      {Object.keys(PRIVACY_REQUEST_TYPES).map((key) => (
                        <option key={key} value={key}>
                          {requestTypeLabel(key, language)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="settings-field settings-wide">
                    {en ? "Details" : "รายละเอียด"}
                    <textarea
                      required
                      maxLength={10000}
                      rows={4}
                      value={detail}
                      disabled={busy}
                      onChange={(event) => setDetail(event.target.value)}
                    />
                    <small>
                      {en
                        ? "Describe the data and action you are requesting."
                        : "ระบุข้อมูลและสิ่งที่ต้องการให้หน่วยงานดำเนินการ"}
                    </small>
                  </label>
                </div>
                <div className="settings-actions">
                  <button
                    type="submit"
                    className="settings-button settings-button--primary"
                    disabled={busy || !org || !detail.trim()}
                  >
                    <FiSend aria-hidden="true" />
                    {busy
                      ? en
                        ? "Submitting..."
                        : "กำลังส่ง..."
                      : en
                        ? "Submit request"
                        : "ส่งคำขอ"}
                  </button>
                </div>
              </form>
            ) : (
              <SettingsEmpty>
                {en
                  ? "No related organization was found for your account. Contact your service provider to request assistance."
                  : "ยังไม่พบหน่วยงานที่เกี่ยวข้องกับบัญชีนี้ ติดต่อหน่วยงานที่เคยรับบริการเพื่อขอความช่วยเหลือ"}
              </SettingsEmpty>
            )}
            <div className="settings-heading patient-privacy-history">
              <h3>{en ? "Your requests" : "คำขอของฉัน"}</h3>
              <button
                className="settings-button"
                type="button"
                disabled={busy}
                onClick={load}
              >
                <FiRefreshCw aria-hidden="true" />
                {en ? "Refresh" : "โหลดคำขอล่าสุด"}
              </button>
            </div>
            {requests.length ? (
              <ul className="settings-list">
                {requests.map((item) => (
                  <li className="settings-record" key={item.id}>
                    <div className="settings-record-heading">
                      <div>
                        <strong>
                          #{item.id} ·{" "}
                          {requestTypeLabel(item.request_type, language)}
                        </strong>
                        {item.created_at && (
                          <p className="settings-hint">
                            <time dateTime={item.created_at}>
                              {en
                                ? new Date(item.created_at).toLocaleDateString(
                                    "en-GB",
                                  )
                                : isoToThai(item.created_at)}
                            </time>
                          </p>
                        )}
                      </div>
                      <span
                        className={`settings-status settings-status--${item.status}`}
                      >
                        {requestStatusLabel(item.status, language)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <SettingsEmpty>
                {en
                  ? "You have no requests yet."
                  : "ยังไม่มีคำขอที่ส่งจากบัญชีนี้"}
              </SettingsEmpty>
            )}
          </>
        )}
      </SettingsPanel>
    </section>
  );
}
