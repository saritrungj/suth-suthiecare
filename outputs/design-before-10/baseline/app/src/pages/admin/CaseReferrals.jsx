import { toDisplayText } from '../../utils/textPresentation.js';
import {usePageExport,ExportButton} from "../../components/ExcelExport";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FiArrowDownLeft, FiArrowUpRight, FiRefreshCw } from "react-icons/fi";
import CaseDrawer from "../../components/case/CaseDrawer";
import {
  REFERRAL_STATUSES,
  REFERRAL_ACTIONS,
  referralDate,
  referralError,
} from "../../components/case/referralDisplay";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  getCaseReferral,
  getCaseReferrals,
  updateCaseReferral,
} from "../../services/api";
import "../../styles/case-workspace.css";
import "./CaseReferrals.css";

const terminal = ["completed", "rejected", "cancelled"];
export default function CaseReferrals() {
  const { activeOrganization } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [direction, setDirection] = useState("incoming");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const selectedId = searchParams.get("referral");
  usePageExport({title:"การส่งต่อ",sources:[{resource:"referrals",filters:{direction,status}}]});
  const hasOrganization = /^\d+$/.test(String(activeOrganization));

  useEffect(() => {
    setResult(null);
    setPage(1);
  }, [activeOrganization, direction, status]);
  useEffect(() => {
    if (!hasOrganization) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    let request = 0;
    const load = async (initial = false) => {
      if (!initial && document.hidden) return;
      const sequence = ++request;
      try {
        const { data } = await getCaseReferrals({
          direction,
          status: status || undefined,
          page,
        });
        if (!active || sequence !== request) return;
        setResult(data);
        setError("");
      } catch (err) {
        if (active && sequence === request) setError(referralError(err));
      } finally {
        if (active && sequence === request) setLoading(false);
      }
    };
    setLoading(true);
    load(true);
    const timer = window.setInterval(() => load(), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeOrganization, hasOrganization, direction, status, page, reload]);
  const open = (id) => setSearchParams({ referral: String(id) });
  const rows = result?.items || [];

  return (
    <div className="cw-wrapper">
      <main className="cw-page ref-page">
        <header className="cw-header">
          <div className="cw-header-text">
            <h1>ส่งต่อระหว่างหน่วยงาน</h1>
            <p>
              รับเรื่อง ติดตามสถานะ และแลกเปลี่ยนบันทึกสรุปกับหน่วยงานคู่ส่งต่อ
            </p>
          </div>
          <button
            className="cw-btn-secondary"
            onClick={() => setReload((value) => value + 1)}
            disabled={loading || !hasOrganization}
          >
            <FiRefreshCw aria-hidden="true" />
            โหลดล่าสุด
          </button>
        </header>
        {!hasOrganization ? (
          <p className="ref-empty">
            กรุณาเลือกหน่วยงานหนึ่งแห่งเพื่อดูรายการรับเข้าและส่งออก
          </p>
        ) : (
          <>
            <div className="ref-toolbar">
              <div
                className="ref-directions"
                role="group"
                aria-label="ทิศทางการส่งต่อ"
              >
                <button
                  type="button"
                  aria-pressed={direction === "incoming"}
                  onClick={() => {
                    setDirection("incoming");
                    setPage(1);
                  }}
                >
                  <FiArrowDownLeft aria-hidden="true" />
                  รับเข้า
                </button>
                <button
                  type="button"
                  aria-pressed={direction === "outgoing"}
                  onClick={() => {
                    setDirection("outgoing");
                    setPage(1);
                  }}
                >
                  <FiArrowUpRight aria-hidden="true" />
                  ส่งออก
                </button>
              </div>
              <label className="ref-filter">
                สถานะ
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">ทุกสถานะ</option>
                  {Object.entries(REFERRAL_STATUSES).map(([value, label]) => (
                    <option value={value} key={value}>
                      {toDisplayText(label)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="ref-hint">
              สถานะและบันทึกสรุปเป็นข้อมูลร่วมของต้นทางกับปลายทาง
              ตรวจข้อมูลล่าสุดทุก 15 วินาทีขณะเปิดหน้านี้
            </p>
            {error && (
              <p role="alert" className="ref-error">
                {error}{" "}
                <button
                  type="button"
                  className="cw-btn-ghost"
                  onClick={() => setReload((value) => value + 1)}
                >
                  ลองใหม่
                </button>
              </p>
            )}
            {loading && !result ? (
              <p className="ref-empty" role="status">
                กำลังโหลดรายการส่งต่อ…
              </p>
            ) : !rows.length ? (
              !error && (
                <div className="ref-empty">
                  <h2>
                    {status
                      ? "ไม่พบรายการตามสถานะที่เลือก"
                      : direction === "incoming"
                        ? "ยังไม่มีเคสส่งต่อเข้ามา"
                        : "ยังไม่มีเคสส่งออก"}
                  </h2>
                  <p>
                    {direction === "outgoing"
                      ? "เปิดเคสแล้วเลือกแท็บส่งต่อเพื่อส่งไปหน่วยงานอื่น"
                      : "รายการที่หน่วยงานอื่นส่งมาจะแสดงที่นี่"}
                  </p>
                </div>
              )
            ) : (
              <ul
                className="ref-queue"
                aria-label={
                  direction === "incoming" ? "เคสรับเข้า" : "เคสส่งออก"
                }
              >
                {rows.map((item) => (
                  <li key={item.id} className="ref-queue-row">
                    <div>
                      <button
                        className="ref-name"
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => open(item.id)}
                      >
                        {item.display_name}
                      </button>
                      <span className="ref-sub">
                        REF-{String(item.id).padStart(4, "0")} ·{" "}
                        {toDisplayText(item.form_title || "เคสส่งต่อ")}
                      </span>
                    </div>
                    <div>
                      <span className="ref-sub">
                        {direction === "incoming"
                          ? "จากหน่วยงาน"
                          : "ไปหน่วยงาน"}
                      </span>
                      <span>
                        {direction === "incoming"
                          ? item.source_organization_name
                          : item.destination_organization_name}
                      </span>
                    </div>
                    <span className={`ref-status ref-status--${item.status}`}>
                      {REFERRAL_STATUSES[item.status]}
                    </span>
                    <time className="ref-sub" dateTime={item.updated_at}>
                      อัปเดต {referralDate(item.updated_at)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
            {(page > 1 || result?.has_more) && (
              <div className="ref-pagination">
                <button
                  className="cw-btn-secondary"
                  disabled={page === 1 || loading}
                  onClick={() => setPage((value) => value - 1)}
                >
                  ก่อนหน้า
                </button>
                <span>หน้า {page}</span>
                <button
                  className="cw-btn-secondary"
                  disabled={!result?.has_more || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  ถัดไป
                </button>
              </div>
            )}
          </>
        )}
      </main>
      {selectedId && hasOrganization && (
        <ReferralDetail
          key={`${activeOrganization}:${selectedId}`}
          id={selectedId}
          onClose={() => setSearchParams({})}
          onUpdated={() => setReload((value) => value + 1)}
        />
      )}
    </div>
  );
}

function ReferralDetail({ id, onClose, onUpdated }) {
  const { can } = usePermissions();
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState("");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reload, setReload] = useState(0);
  const editing = Boolean(status || summary.trim());
  useEffect(() => {
    let active = true;
    let request = 0;
    const load = async (initial = false) => {
      if (!initial && (document.hidden || editing || saving)) return;
      const sequence = ++request;
      try {
        const { data } = await getCaseReferral(id);
        if (active && sequence === request) {
          setDetail(data);
          setError("");
        }
      } catch (err) {
        if (active && sequence === request) setError(referralError(err));
      } finally {
        if (active && sequence === request) setRefreshing(false);
      }
    };
    // Preserve the version displayed when the user started composing a note.
    // A refresh is explicit while editing, so background polling cannot make
    // an outdated decision look current to the server.
    if (!editing && !saving) {
      setRefreshing(true);
      load(true);
    }
    const timer = window.setInterval(() => load(), 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [id, reload, editing, saving]);
  const refresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await getCaseReferral(id);
      setDetail(data);
      setStatus("");
      setError("");
    } catch (err) {
      setError(referralError(err));
    } finally {
      setRefreshing(false);
    }
  };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateCaseReferral(id, {
        version: detail.version,
        ...(status ? { status } : {}),
        ...(summary.trim() ? { summary: summary.trim() } : {}),
      });
      setStatus("");
      setSummary("");
      setMessage("บันทึกแล้ว หน่วยงานคู่ส่งต่อจะเห็นสถานะและข้อมูลเดียวกัน");
      setReload((value) => value + 1);
      onUpdated();
    } catch (err) {
      setError(referralError(err));
    } finally {
      setSaving(false);
    }
  };
  const canUpdate =
    detail && can("cases.update") && !terminal.includes(detail.status);
  const needsSummary = ["completed", "rejected"].includes(status);
  return (
    <CaseDrawer
      title={detail?.display_name || "รายละเอียดการส่งต่อ"}
      meta={
        detail
          ? `REF-${String(detail.id).padStart(4, "0")} · ${detail.source_organization_name} → ${detail.destination_organization_name}`
          : "กำลังโหลดข้อมูล"
      }
      onClose={onClose}
      tools={
        <button
          type="button"
          className="cw-btn-secondary"
          disabled={refreshing || saving}
          onClick={refresh}
        >
          <FiRefreshCw aria-hidden="true" />
          โหลดล่าสุด
        </button>
      }
      badges={
        detail && (
          <span className={`ref-status ref-status--${detail.status}`}>
            {REFERRAL_STATUSES[detail.status]}
          </span>
        )
      }
    >
      <ExportButton sources={[{resource:"referral",id}]} title="รายละเอียดการส่งต่อ" />
      <div className="ref-panel">
        {error && (
          <p className="ref-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="ref-success" role="status">
            {message}
          </p>
        )}
        {!detail ? (
          <p role="status">
            {error ? "ไม่สามารถเปิดรายการนี้ได้" : "กำลังโหลดรายละเอียด…"}
          </p>
        ) : (
          <>
            <h3>ข้อมูลส่งต่อเบื้องต้น</h3>
            <dl className="ref-facts">
              <div>
                <dt>ฟอร์มอ้างอิง</dt>
                <dd>{toDisplayText(detail.form_title || "ไม่ระบุ")}</dd>
              </div>
              <div>
                <dt>ส่งต่อเมื่อ</dt>
                <dd>{referralDate(detail.created_at)}</dd>
              </div>
              <div>
                <dt>เหตุผลส่งต่อ</dt>
                <dd className="ref-prose">{detail.reason}</dd>
              </div>
            </dl>
            <p className="ref-hint">
              แสดงข้อมูลสรุปที่แชร์ระหว่างสองหน่วยงานเท่านั้น
            </p>
            <h3>ประวัติสถานะและบันทึกสรุป</h3>
            <ol className="ref-history">
              {detail.updates.map((update) => (
                <li key={update.id}>
                  <div className="ref-history-head">
                    <strong>
                      {update.kind === "created"
                        ? "ส่งต่อเคส"
                        : update.kind === "note"
                          ? "บันทึกสรุป"
                          : REFERRAL_STATUSES[update.status]}
                    </strong>
                    <time dateTime={update.created_at}>
                      {referralDate(update.created_at)}
                    </time>
                  </div>
                  <span className="ref-sub">
                    {update.organization_name} · {update.actor_name}
                  </span>
                  {update.summary && (
                    <p className="ref-prose">{update.summary}</p>
                  )}
                </li>
              ))}
            </ol>
            {canUpdate ? (
              <form className="ref-form" onSubmit={save}>
                <h3>
                  {detail.direction === "incoming"
                    ? "ดำเนินการรับเรื่อง"
                    : "เพิ่มข้อมูลให้ปลายทาง"}
                </h3>
                {detail.allowed_statuses.length > 0 && (
                  <>
                    <label htmlFor="referral-next-status">การดำเนินการ</label>
                    <select
                      id="referral-next-status"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                      disabled={saving}
                    >
                      <option value="">เพิ่มบันทึกสรุปอย่างเดียว</option>
                      {detail.allowed_statuses.map((value) => (
                        <option key={value} value={value}>
                          {REFERRAL_ACTIONS[value]}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label htmlFor="referral-shared-summary">
                  บันทึกสรุปที่แชร์ร่วมกัน{needsSummary ? " (จำเป็น)" : ""}
                </label>
                <textarea
                  id="referral-shared-summary"
                  rows={4}
                  maxLength={1000}
                  required={needsSummary}
                  value={summary}
                  onChange={(event) => setSummary(event.target.value)}
                  disabled={saving}
                  aria-describedby="referral-summary-help"
                />
                <p className="ref-hint" id="referral-summary-help">
                  ทั้งสองหน่วยงานเห็นข้อความนี้
                  กรุณาบันทึกเฉพาะผลดำเนินการเบื้องต้น
                </p>
                <button
                  type="submit"
                  className="cw-btn"
                  disabled={
                    saving || !editing || (needsSummary && !summary.trim())
                  }
                >
                  {saving ? "กำลังบันทึก…" : "บันทึกการดำเนินการ"}
                </button>
              </form>
            ) : (
              <p className="ref-hint">
                {terminal.includes(detail.status)
                  ? "รายการนี้สิ้นสุดแล้ว เก็บประวัติไว้สำหรับติดตามผล"
                  : "คุณมีสิทธิ์ดูรายการนี้ การบันทึกต้องมีสิทธิ์แก้ไขเคส"}
              </p>
            )}
          </>
        )}
      </div>
    </CaseDrawer>
  );
}
