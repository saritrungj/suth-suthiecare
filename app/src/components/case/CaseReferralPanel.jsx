import SearchableSelect from "../SearchableSelect";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowUpRight,
  FiCheck,
  FiChevronRight,
  FiClock,
  FiInbox,
  FiRefreshCw,
  FiX,
} from "react-icons/fi";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  cancelReferralRequest,
  createCaseReferral,
  getCaseReferrals,
  getReferralDestinations,
  getReferralRequests,
} from "../../services/api";
import {
  REFERRAL_STATUSES,
  referralDate,
  referralError,
} from "./referralDisplay";
import "../../pages/admin/CaseReferrals.css";

export const REQUEST_STATUSES = {
  pending: "รออนุมัติในโรงเรียน",
  approved: "อนุมัติแล้ว",
  declined: "ไม่อนุมัติ",
  cancelled: "ยกเลิกคำขอ",
};

export default function CaseReferralPanel({ sourceResponseId, onUpdated }) {
  const { activeOrganization, can } = usePermissions();
  const [destinations, setDestinations] = useState([]);
  const [items, setItems] = useState([]);
  // Requests still waiting for approval inside the school (to a hospital).
  const [requests, setRequests] = useState([]);
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const canSend = can("cases.assign");
  const hasOrganization = /^\d+$/.test(String(activeOrganization));

  useEffect(() => {
    if (!hasOrganization) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    let sequence = 0;
    setLoading(true);
    setError("");
    const loadHistory = async () => {
      const request = ++sequence;
      try {
        const { data } = await getCaseReferrals({
          direction: "outgoing",
          source_response_id: sourceResponseId,
        });
        if (active && request === sequence) setItems(data.items || []);
        const pending = await getReferralRequests({
          source_response_id: sourceResponseId,
        }).catch(() => ({ data: { data: [] } }));
        if (active && request === sequence)
          setRequests(
            (pending.data?.data || []).filter((r) => r.status !== "approved"),
          );
      } catch (err) {
        if (active && request === sequence) setError(referralError(err));
      } finally {
        if (active && request === sequence) setLoading(false);
      }
    };
    loadHistory();
    if (canSend)
      getReferralDestinations()
        .then(({ data }) => {
          if (active) setDestinations(data);
        })
        .catch((err) => {
          if (active) {
            setDestinations([]);
            setError(referralError(err));
          }
        });
    const timer = window.setInterval(() => {
      if (!document.hidden) loadHistory();
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [activeOrganization, sourceResponseId, canSend, hasOrganization, reload]);

  const send = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { data } = await createCaseReferral({
        source_response_id: sourceResponseId,
        destination_organization_id: Number(destination),
        reason: reason.trim(),
      });
      setDestination("");
      setReason("");
      setMessage(
        data?.status === "awaiting_approval"
          ? "ส่งคำขอแล้ว การส่งต่อโรงพยาบาลต้องรอผู้มีสิทธิ์ในโรงเรียนอนุมัติก่อน"
          : "ส่งต่อแล้ว ปลายทางสามารถรับเรื่องและบันทึกผลสรุปได้",
      );
      setReload((value) => value + 1);
      await onUpdated?.();
    } catch (err) {
      setError(referralError(err));
    } finally {
      setSaving(false);
    }
  };
  if (!hasOrganization)
    return (
      <div className="ref-tab-empty">
        <FiInbox aria-hidden="true" />
        <strong>ยังไม่ได้เลือกหน่วยงานต้นทาง</strong>
        <span>กรุณาเลือกหน่วยงานต้นทางหนึ่งแห่งก่อนส่งต่อเคส</span>
      </div>
    );
  return (
    <div className="ref-panel ref-tab" aria-label="ส่งต่อเคสระหว่างหน่วยงาน">
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
      <section className="cw-section">
        <h3>ส่งต่อไปหน่วยงานอื่น</h3>
        <div className="ref-share" aria-label="ข้อมูลที่ปลายทางเห็น">
          <div>
            <span className="ref-share-title">
              <FiCheck aria-hidden="true" /> ปลายทางเห็น
            </span>
            <span>
              ชื่อแบบย่อ ฟอร์มอ้างอิง เหตุผลส่งต่อ สถานะ
              และบันทึกสรุปที่แชร์ร่วมกัน
            </span>
          </div>
          <div>
            <span className="ref-share-title is-private">
              <FiX aria-hidden="true" /> ไม่ส่งไป
            </span>
            <span>คำตอบแบบฟอร์มและบันทึกภายในเคส</span>
          </div>
        </div>
        {canSend ? (
          <form className="ref-form" onSubmit={send}>
            <label htmlFor="referral-destination">หน่วยงานปลายทาง</label>
            <SearchableSelect
              id="referral-destination"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              required
              disabled={loading || saving}
            >
              <option value="">เลือกหน่วยงาน</option>
              {destinations.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} ({unit.code})
                </option>
              ))}
            </SearchableSelect>
            {!loading && !destinations.length && (
              <p className="ref-hint">ยังไม่มีหน่วยงานปลายทางที่เปิดใช้งาน</p>
            )}
            <div className="ref-label-row">
              <label htmlFor="referral-reason">
                เหตุผลส่งต่อ / ข้อมูลเบื้องต้น
              </label>
              <span className="ref-count" aria-hidden="true">
                {reason.length}/1000
              </span>
            </div>
            <textarea
              id="referral-reason"
              rows={4}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              disabled={saving}
              aria-describedby="referral-share-hint"
            />
            <p id="referral-share-hint" className="ref-hint">
              ข้อความนี้จะแชร์กับปลายทาง กรุณาสรุปเฉพาะข้อมูลที่จำเป็น
              ไม่ใส่เลขบัตรหรือรายละเอียดเชิงลึก
            </p>
            <div className="ref-form-actions">
              <button
                className="cw-btn"
                type="submit"
                disabled={saving || loading || !destination || !reason.trim()}
              >
                <FiArrowUpRight aria-hidden="true" />
                {saving ? "กำลังส่งต่อ…" : "ส่งต่อเคส"}
              </button>
            </div>
          </form>
        ) : (
          <p className="ref-hint">
            การส่งต่อใช้สิทธิ์มอบหมายเคส
            กรุณาติดต่อผู้ดูแลหน่วยงานหากต้องการส่งต่อ
          </p>
        )}
      </section>
      {requests.length > 0 && (
        <section className="cw-section">
          <h3>คำขอส่งต่อโรงพยาบาล</h3>
          <ul className="ref-case-list">
            {requests.map((item) => (
              <li key={`q${item.id}`} className="ref-case-row">
                <span className="ref-case-main">
                  <strong>{item.destination_name}</strong>
                  <small>
                    <FiClock aria-hidden="true" />
                    ขอเมื่อ {referralDate(item.created_at)} โดย{" "}
                    {item.requested_by_name || "-"}
                  </small>
                  {item.status === "declined" && item.decision_note && (
                    <small>เหตุผลที่ไม่อนุมัติ: {item.decision_note}</small>
                  )}
                </span>
                <span
                  className={`ref-status ref-status--request-${item.status}`}
                >
                  {REQUEST_STATUSES[item.status]}
                </span>
                {item.can_cancel && (
                  <button
                    type="button"
                    className="cw-btn-ghost"
                    onClick={async () => {
                      try {
                        await cancelReferralRequest(item.id);
                        setReload((value) => value + 1);
                      } catch (err) {
                        setError(referralError(err));
                      }
                    }}
                  >
                    ยกเลิกคำขอ
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="cw-section">
        <div className="ref-section-heading">
          <h3>
            รายการส่งต่อของเคสนี้
            {items.length > 0 && (
              <span className="ref-count-pill">{items.length}</span>
            )}
          </h3>
          <button
            className="cw-btn-ghost"
            type="button"
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            <FiRefreshCw aria-hidden="true" />
            โหลดล่าสุด
          </button>
        </div>
        {loading ? (
          <p className="ref-hint" role="status">
            กำลังโหลดรายการส่งต่อ…
          </p>
        ) : !items.length ? (
          <div className="ref-tab-empty">
            <FiInbox aria-hidden="true" />
            <strong>ยังไม่มีรายการส่งต่อ</strong>
            <span>เมื่อส่งต่อแล้ว สถานะจากปลายทางจะแสดงที่นี่</span>
          </div>
        ) : (
          <ul className="ref-case-list">
            {items.map((item) => (
              <li key={item.id} className="ref-case-row">
                <span className="ref-case-main">
                  <Link
                    className="ref-case-link"
                    to={`/admin/referrals?referral=${item.id}`}
                  >
                    {item.destination_organization_name}
                  </Link>
                  <small>
                    <FiClock aria-hidden="true" />
                    อัปเดต {referralDate(item.updated_at)}
                  </small>
                </span>
                <span className={`ref-status ref-status--${item.status}`}>
                  {REFERRAL_STATUSES[item.status]}
                </span>
                <FiChevronRight className="ref-case-arrow" aria-hidden="true" />
              </li>
            ))}
          </ul>
        )}
        <Link className="ref-link ref-all-link" to="/admin/referrals">
          เปิดรายการรับเข้าและส่งออกทั้งหมด
          <FiArrowUpRight aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}
