import { useEffect, useRef, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { getCaseLastName } from "../../services/api";
import { usePermissions } from "../../permissions/PermissionsProvider";
import { stripHtml } from "./caseDisplay";

export default function CasePerson({
  id,
  name,
  lastName: providedLastName,
  code,
  onOpen,
  school = false,
}) {
  const { can, activeOrganization } = usePermissions();
  const canReveal = can("pii.view");
  const requestId = useRef(0);
  const [lastName, setLastName] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    requestId.current += 1;
    setLastName(null);
    setRevealed(false);
    setError("");
    setLoading(false);
    return () => {
      requestId.current += 1;
    };
  }, [id, name, providedLastName, school, activeOrganization, canReveal]);
  const firstName = stripHtml(name).trim();
  const visibleLastName = stripHtml(providedLastName).trim();
  const display =
    firstName && !firstName.startsWith("ไม่ระบุ")
      ? canReveal
        ? firstName
        : `${Array.from(firstName)[0]}***`
      : "ไม่ระบุชื่อ";
  const hasFullName = canReveal && Boolean(visibleLastName);
  const toggleName = async () => {
    if (revealed) {
      setRevealed(false);
      setLastName(null);
      return;
    }
    setLoading(true);
    setError("");
    const request = ++requestId.current;
    try {
      const { data } = await getCaseLastName(id, school);
      if (request !== requestId.current) return;
      if (!data.last_name) {
        setError("ยังไม่มีนามสกุล");
        return;
      }
      setLastName(data.last_name);
      setRevealed(true);
    } catch {
      if (request === requestId.current)
        setError("เปิดนามสกุลไม่สำเร็จ ลองอีกครั้ง");
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  };
  return (
    <div className="cw-person">
      <div className="cw-person-line">
        <button
          type="button"
          className="cw-person-open"
          onClick={onOpen}
          aria-haspopup="dialog"
        >
          <span className="cw-person-name">
            <span>{display}</span>
            <span
              className={
                hasFullName || (revealed && canReveal)
                  ? "cw-person-surname"
                  : "cw-hidden-surname"
              }
              aria-label={
                hasFullName || (revealed && canReveal)
                  ? undefined
                  : "นามสกุลถูกซ่อน"
              }
            >
              {hasFullName
                ? visibleLastName
                : revealed && canReveal
                  ? lastName
                  : "•••"}
            </span>
          </span>
          <span className="cw-person-code">{code}</span>
        </button>
        {canReveal && !hasFullName && (
          <button
            type="button"
            className="cw-person-reveal"
            onClick={toggleName}
            disabled={loading}
            aria-pressed={revealed}
            title={revealed ? "ซ่อนนามสกุล" : "เปิดดูนามสกุล"}
            aria-label={revealed ? "ซ่อนนามสกุล" : "เปิดดูนามสกุล"}
          >
            {revealed ? (
              <FiEyeOff aria-hidden="true" />
            ) : (
              <FiEye aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      <span className="cw-person-feedback" role="status">
        {loading ? "กำลังเปิดนามสกุล…" : error}
      </span>
    </div>
  );
}
