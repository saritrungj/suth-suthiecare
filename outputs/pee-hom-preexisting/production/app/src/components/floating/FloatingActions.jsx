import { useEffect, useState } from "react";
import { FiArrowUp, FiHeart, FiHelpCircle } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import "./FloatingActions.css";

const SHOW_SCROLL_TOP_AFTER = 400;
const LOCAL_CHAT_URL =
  "https://infectious-bones-chain-camel.trycloudflare.com/chat";
const PRODUCTION_CHAT_URL = "https://chat.suth.go.th/chat";

// Local dev points at the tunnel; production builds go to chat.suth.go.th.
// VITE_AI_CHAT_URL overrides both (the tunnel URL changes between sessions).
export const AI_CHAT_URL =
  import.meta.env.VITE_AI_CHAT_URL ||
  (import.meta.env.DEV ? LOCAL_CHAT_URL : PRODUCTION_CHAT_URL);

// Solid speech bubble with an AI star knocked out of it; one spark outside.
function AiChatIcon() {
  return (
    <svg
      className="sut-fab-chat__icon"
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11 4h12a7 7 0 0 1 7 7v8a7 7 0 0 1-7 7h-7.5l-5.9 4.6a.8.8 0 0 1-1.3-.6v-4.4A7 7 0 0 1 4 19v-8a7 7 0 0 1 7-7z"
        fill="#fff"
      />
      <path
        className="sut-fab-chat__star"
        d="M17.5 8.5l1.9 4.6 4.6 1.9-4.6 1.9-1.9 4.6-1.9-4.6-4.6-1.9 4.6-1.9z"
        fill="var(--fab-orange-deep)"
      />
      <path
        className="sut-fab-chat__star sut-fab-chat__star--sm"
        d="M23.5 18.2l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"
        fill="var(--fab-orange)"
      />
      <path
        className="sut-fab-chat__spark"
        d="M32 1.2l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z"
        fill="#fff"
      />
    </svg>
  );
}

export default function FloatingActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setShowTop(window.scrollY > SHOW_SCROLL_TOP_AFTER);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="sut-fab-stack">
      <div className="sut-fab-chat-wrap">
        <a
          className="sut-fab-chat"
          href={AI_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("sutlanding.ai_chat_aria")}
          aria-describedby="sut-fab-chat-card"
          data-testid="ai-chat-button"
        >
          <span className="sut-fab-chat__pulse" aria-hidden="true" />
          <AiChatIcon />
          <span className="sut-fab-chat__badge" aria-hidden="true">
            AI
          </span>
        </a>
        <div className="sut-fab-hello" id="sut-fab-chat-card" role="tooltip">
          <p className="sut-fab-hello__greet">
            {t("sutlanding.ai_chat_greet")}
            <FiHeart aria-hidden="true" />
          </p>
          <p className="sut-fab-hello__ask">
            {t("sutlanding.ai_chat_ask_pre")}{" "}
            <b>{t("sutlanding.ai_chat_ask_brand")}</b>{" "}
            {t("sutlanding.ai_chat_ask_post")}
          </p>
        </div>
        <div className="sut-fab-tag" aria-hidden="true">
          <strong>{t("sutlanding.ai_chat_label")}</strong>
          <span>{t("sutlanding.ai_chat_hint")}</span>
        </div>
      </div>

      <button
        type="button"
        className={`sut-fab-round sut-fab-top${showTop ? " is-visible" : ""}`}
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label={t("sutlanding.scroll_top")}
        title={t("sutlanding.scroll_top")}
        tabIndex={showTop ? 0 : -1}
        aria-hidden={!showTop}
      >
        <FiArrowUp />
      </button>

      <button
        type="button"
        className="sut-fab-round sut-fab-help"
        onClick={() => navigate("/help-center")}
        aria-label={t("sutlanding.help_center")}
        title={t("sutlanding.help_center")}
      >
        <FiHelpCircle />
      </button>
    </div>
  );
}
