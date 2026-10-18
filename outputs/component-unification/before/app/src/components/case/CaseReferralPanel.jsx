import SearchableSelect from "../SearchableSelect";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiArrowUpRight, FiRefreshCw } from "react-icons/fi";
import { usePermissions } from "../../permissions/PermissionsProvider";
import {
  createCaseReferral,
  getCaseReferrals,
  getReferralDestinations,
} from "../../services/api";
import {
  REFERRAL_STATUSES,
  referralDate,
  referralError,
} from "./referralDisplay";
import "../../pages/admin/CaseReferrals.css";

export default function CaseReferralPanel({ sourceResponseId, onUpdated }) {
  const { activeOrganization, can } = usePermissions();
  const [destinations, setDestinations] = useState([]);
  const [items, setItems] = useState([]);
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
      await createCaseReferral({
        source_response_id: sourceResponseId,
        destination_organization_id: Number(destination),
        reason: reason.trim(),
      });
      setDestination("");
      setReason("");
      setMessage("ส่งต่อแล้ว ปลายทางสามารถรับเรื่องและบันทึกผลสรุปได้");
      setReload((value) => value + 1);
      await onUpdated?.();
    } catch (err) {
      setError(referralError(err));
    } finally {
      setSaving(false);
    }
  };
  if (!hasOrganization)
    return <p>กรุณาเลือกหน่วยงานต้นทางหนึ่งแห่งก่อนส่งต่อเคส</p>;
  return (
    <section className="ref-panel" aria-label="ส่งต่อเคสระหว่างหน่วยงาน">
      <h3>ส่งต่อไปหน่วยงานอื่น</h3>
      <p className="ref-hint">
        ปลายทางเห็นชื่อแบบย่อ ฟอร์มอ้างอิง เหตุผลส่งต่อ สถานะ
        และบันทึกสรุปที่แชร์ร่วมกัน
      </p>
      <p className="ref-hint">
        คำตอบแบบฟอร์มและบันทึกภายในเคสจะไม่ถูกส่งไปด้วย
      </p>
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
          <label htmlFor="referral-reason">
            เหตุผลส่งต่อ / ข้อมูลเบื้องต้น
          </label>
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
          <button
            className="cw-btn"
            type="submit"
            disabled={saving || loading || !destination || !reason.trim()}
          >
            <FiArrowUpRight aria-hidden="true" />
            {saving ? "กำลังส่งต่อ…" : "ส่งต่อเคส"}
          </button>
        </form>
      ) : (
        <p className="ref-hint">
          การส่งต่อใช้สิทธิ์มอบหมายเคส
          กรุณาติดต่อผู้ดูแลหน่วยงานหากต้องการส่งต่อ
        </p>
      )}
      <div className="ref-section-heading">
        <h3>รายการส่งต่อของเคสนี้</h3>
        <button
          className="cw-btn-ghost"
          type="button"
          disabled={loading}
          onClick={() => setReload((value) => value + 1)}
          aria-label="โหลดรายการส่งต่อล่าสุด"
        >
          <FiRefreshCw aria-hidden="true" />
        </button>
      </div>
      {loading ? (
        <p role="status">กำลังโหลดรายการส่งต่อ…</p>
      ) : !items.length ? (
        <p className="ref-hint">ยังไม่มีรายการส่งต่อ</p>
      ) : (
        <ul className="ref-case-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/admin/referrals?referral=${item.id}`}>
                {item.destination_organization_name}
              </Link>
              <span className={`ref-status ref-status--${item.status}`}>
                {REFERRAL_STATUSES[item.status]}
              </span>
              <small>อัปเดต {referralDate(item.updated_at)}</small>
            </li>
          ))}
        </ul>
      )}
      <Link className="ref-link" to="/admin/referrals">
        เปิดรายการรับเข้าและส่งออกทั้งหมด
      </Link>
    </section>
  );
}
