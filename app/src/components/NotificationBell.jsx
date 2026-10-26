import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";
import { usePermissions } from "../permissions/PermissionsProvider";
import {
  ackSchoolNotification,
  getSchoolNotificationCount,
  getSchoolNotifications,
  readAllSchoolNotifications,
  readSchoolNotification,
} from "../services/api";
import "./NotificationBell.css";

const POLL_MS = 60_000;
const KIND_TITLES = {
  risk_alert: "พบนักเรียนกลุ่มเสี่ยง",
  behavior_report: "รายงานพฤติกรรมใหม่",
  appointment: "นัดหมายรับคำปรึกษา",
  follow_up: "รายการที่ต้องติดตาม",
  referral_approval: "คำขอส่งต่อโรงพยาบาลรออนุมัติ",
};
const when = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
};

// School staff inbox in the sidebar: an item with an unread badge that opens
// a panel. Only shown while a school unit is active (not to guardians).
export default function NotificationBell({ collapsed = false }) {
  const { activeOrganization, activeOrganizationType, schoolAccess } =
    usePermissions();
  const enabled =
    activeOrganizationType === "school" &&
    Boolean(schoolAccess) &&
    !schoolAccess.is_guardian;
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({
    items: [],
    total: 0,
    page: 1,
    loading: false,
    error: "",
  });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const refreshCount = useCallback(async () => {
    if (!enabled || document.visibilityState === "hidden") return;
    try {
      const { data } = await getSchoolNotificationCount();
      setCount(Number(data?.count) || 0);
    } catch {
      // A failed poll keeps the last count; the next poll tries again.
    }
  }, [enabled]);

  useEffect(() => {
    setCount(0);
    setOpen(false);
    if (!enabled) return undefined;
    refreshCount();
    const timer = setInterval(refreshCount, POLL_MS);
    const onVisible = () => refreshCount();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [enabled, activeOrganization, refreshCount]);

  const load = useCallback(async (page = 1) => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const { data } = await getSchoolNotifications({ page });
      setState((s) => ({
        items: page === 1 ? data.items : [...s.items, ...data.items],
        total: data.total,
        page,
        loading: false,
        error: "",
      }));
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "โหลดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง",
      }));
    }
  }, []);

  useEffect(() => {
    if (open) load(1);
  }, [open, load]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (event) => {
      if (
        !panelRef.current?.contains(event.target) &&
        !buttonRef.current?.contains(event.target)
      )
        setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const replace = (updated) =>
    setState((s) => ({
      ...s,
      items: s.items.map((item) => (item.id === updated.id ? updated : item)),
    }));
  const markRead = async (item) => {
    if (item.read_at) return;
    try {
      replace((await readSchoolNotification(item.id)).data);
      setCount((c) => Math.max(0, c - 1));
    } catch {
      // Opening the student still works; the item stays unread.
    }
  };
  const acknowledge = async (item) => {
    try {
      replace((await ackSchoolNotification(item.id)).data);
      if (!item.read_at) setCount((c) => Math.max(0, c - 1));
    } catch {
      setState((s) => ({ ...s, error: "รับเรื่องไม่สำเร็จ ลองใหม่อีกครั้ง" }));
    }
  };
  const readAll = async () => {
    try {
      await readAllSchoolNotifications();
      setCount(0);
      await load(1);
    } catch {
      setState((s) => ({
        ...s,
        error: "อ่านทั้งหมดไม่สำเร็จ ลองใหม่อีกครั้ง",
      }));
    }
  };

  if (!enabled) return null;
  const label = count
    ? `การแจ้งเตือน ยังไม่อ่าน ${count} รายการ`
    : "การแจ้งเตือน";
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="menu-item notification-bell"
        data-label="การแจ้งเตือน"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="icon">
          <FontAwesomeIcon icon={faBell} fixedWidth />
          {count > 0 && (
            <span className="notification-bell__badge" aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </span>
        <span className="label">การแจ้งเตือน</span>
      </button>
      {open &&
        createPortal(
          <section
            ref={panelRef}
            className={`notification-panel${collapsed ? " is-collapsed" : ""}`}
            role="dialog"
            aria-labelledby="notification-panel-title"
            tabIndex={-1}
          >
            <header className="notification-panel__header">
              <h2 id="notification-panel-title">การแจ้งเตือน</h2>
              <button
                type="button"
                className="notification-panel__link"
                onClick={readAll}
                disabled={!count}
              >
                อ่านทั้งหมด
              </button>
            </header>
            {state.error && (
              <p className="notification-panel__error" role="alert">
                {state.error}
              </p>
            )}
            {!state.loading && !state.error && !state.items.length && (
              <p className="notification-panel__empty">ยังไม่มีการแจ้งเตือน</p>
            )}
            <ul className="notification-panel__list">
              {state.items.map((item) => (
                <li
                  key={item.id}
                  className={`notification-item${item.read_at ? "" : " is-unread"}`}
                >
                  <p className="notification-item__title">
                    {item.payload?.title ||
                      KIND_TITLES[item.kind] ||
                      "แจ้งเตือน"}
                  </p>
                  {item.payload?.body && (
                    <p className="notification-item__body">
                      {item.payload.body}
                    </p>
                  )}
                  <p className="notification-item__meta">
                    <time dateTime={item.created_at}>
                      {when(item.created_at)}
                    </time>
                    {item.acknowledged_at && (
                      <span className="notification-item__chip">
                        รับเรื่องแล้ว
                      </span>
                    )}
                  </p>
                  <div className="notification-item__actions">
                    {item.kind === "referral_approval" && (
                      <Link
                        to="/admin/referrals/approvals"
                        onClick={() => {
                          markRead(item);
                          setOpen(false);
                        }}
                      >
                        เปิดหน้าอนุมัติ
                      </Link>
                    )}
                    {item.student_id && schoolAccess.can_view_students && (
                      <Link
                        to={`/admin/school/students/${item.student_id}`}
                        onClick={() => {
                          markRead(item);
                          setOpen(false);
                        }}
                      >
                        เปิดแฟ้มนักเรียน
                      </Link>
                    )}
                    {!item.acknowledged_at && (
                      <button type="button" onClick={() => acknowledge(item)}>
                        รับเรื่อง
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {state.loading && (
              <p className="notification-panel__empty" role="status">
                กำลังโหลด...
              </p>
            )}
            {!state.loading && state.items.length < state.total && (
              <button
                type="button"
                className="notification-panel__more"
                onClick={() => load(state.page + 1)}
              >
                ดูเพิ่มเติม
              </button>
            )}
          </section>,
          document.body,
        )}
    </>
  );
}
