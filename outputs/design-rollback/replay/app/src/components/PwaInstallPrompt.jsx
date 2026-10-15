import { useEffect, useState } from "react";
import { FaApple, FaDownload, FaShareAlt, FaTimes } from "react-icons/fa";
import "./PwaInstallPrompt.css";

const DISMISS_KEY = "suthiecare-pwa-install-dismissed-at";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000;

function isAppleMobileDevice() {
  const { userAgent, platform, maxTouchPoints } = window.navigator;
  return (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function wasRecentlyDismissed() {
  const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY));
  return (
    Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION
  );
}

/**
 * A privacy-preserving PWA install surface. It never caches or reads patient data;
 * browser installation is always initiated only after an explicit user action.
 */
export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const compactTouchScreen = window.matchMedia(
      "(max-width: 1023px) and (pointer: coarse)",
    ).matches;

    if (!compactTouchScreen || isStandalone() || wasRecentlyDismissed())
      return undefined;

    const appleMobile = isAppleMobileDevice();
    setIsIos(appleMobile);
    // iOS/iPadOS exposes Add to Home Screen through the browser share menu.
    if (appleMobile) setShowPrompt(true);

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setShowPrompt(true);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <aside className="pwa-install" aria-label="ติดตั้งแอป SUTH Suthiecare">
      <img
        className="pwa-install__icon"
        src="/icons/suthiecare-192.png"
        alt=""
        width="56"
        height="56"
      />
      <div className="pwa-install__content">
        <p className="pwa-install__eyebrow">SUTH Suthiecare</p>
        <h2>ติดตั้งแอปไว้ที่หน้าจอหลัก</h2>
        {isIos ? (
          <p>
            แตะ <FaShareAlt aria-hidden="true" /> แชร์ แล้วเลือก{" "}
            <strong>เพิ่มไปยังหน้าจอโฮม</strong>
          </p>
        ) : (
          <p>เปิดใช้ได้รวดเร็วขึ้นจากหน้าจอหลักของอุปกรณ์</p>
        )}
      </div>
      <div className="pwa-install__actions">
        {isIos ? (
          <span className="pwa-install__ios-hint">
            <FaApple aria-hidden="true" /> iPhone / iPad
          </span>
        ) : (
          <button
            className="pwa-install__button"
            type="button"
            onClick={install}
          >
            <FaDownload aria-hidden="true" /> ติดตั้ง
          </button>
        )}
        <button
          className="pwa-install__dismiss"
          type="button"
          onClick={dismiss}
          aria-label="ปิดคำแนะนำการติดตั้ง"
        >
          <FaTimes aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
