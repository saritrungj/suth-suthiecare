import { useEffect, useState } from "react";
import {
  FiArrowUp,
  FiArrowUpRight,
  FiHeart,
  FiHelpCircle,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import peeHomAvatar from "../../assets/pee-hom-ai.webp";
import "./FloatingActions.css";

const SHOW_SCROLL_TOP_AFTER = 400;
// Use the same Suthie Care referral link in development and production.
export const AI_CHAT_URL =
  "https://chat.suth.go.th/chat?source=suthiecare&return=https%3A%2F%2Fwww.suth.go.th%2F";

function Sparkle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" focusable="false">
      <path
        d="m12 1 3.2 7.8L23 12l-7.8 3.2L12 23l-3.2-7.8L1 12l7.8-3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function FloatingActions() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [showTop, setShowTop] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const isEnglish = i18n.resolvedLanguage?.startsWith("en");

  useEffect(() => {
    let scrollFrame;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        setShowTop(window.scrollY > SHOW_SCROLL_TOP_AFTER);
        scrollFrame = undefined;
      });
    };
    const onVisibilityChange = () => setPageHidden(document.hidden);
    onScroll();
    onVisibilityChange();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    };
  }, []);

  return (
    <div className={`sut-fab-stack${pageHidden ? " is-paused" : ""}`}>
      <a
        className="sut-fab-chat"
        href={AI_CHAT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("sutlanding.ai_chat_pee_hom_aria", {
          defaultValue: isEnglish
            ? "Chat with Pee Hom, AI health assistant (opens in a new tab)"
            : "คุยกับพี่หอม ผู้ช่วย AI ด้านสุขภาพ (เปิดแท็บใหม่)",
        })}
        data-testid="ai-chat-button"
      >
        <span className="sut-fab-invite" aria-hidden="true">
          <strong>
            {t("sutlanding.ai_chat_invite", {
              defaultValue: isEnglish ? "Chat with Pee Hom" : "คุยกับพี่หอม",
            })}
            <FiArrowUpRight />
          </strong>
          <span>
            <FiHeart />
            {t("sutlanding.ai_chat_check_in", {
              defaultValue: isEnglish ? "How's your day?" : "วันนี้เป็นไงบ้าง?",
            })}
          </span>
        </span>
        <span className="sut-fab-mascot">
          <span className="sut-fab-mascot__ring" aria-hidden="true" />
          <span className="sut-fab-mascot__portrait">
            <img
              src={peeHomAvatar}
              width="256"
              height="256"
              alt=""
              decoding="async"
            />
          </span>
          <span className="sut-fab-mascot__badge" aria-hidden="true">
            AI
          </span>
          <span className="sut-fab-mascot__confetti" aria-hidden="true">
            <Sparkle className="sut-fab-spark sut-fab-spark--mint" />
            <Sparkle className="sut-fab-spark sut-fab-spark--peach" />
            <Sparkle className="sut-fab-spark sut-fab-spark--pink" />
            <FiHeart className="sut-fab-heart" />
          </span>
        </span>
      </a>

      {showTop && (
        <button
          type="button"
          className="sut-fab-round sut-fab-top"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            })
          }
          aria-label={t("sutlanding.scroll_top", {
            defaultValue: isEnglish ? "Back to top" : "กลับด้านบน",
          })}
        >
          <FiArrowUp aria-hidden="true" />
        </button>
      )}

      <button
        type="button"
        className="sut-fab-round sut-fab-help"
        onClick={() => navigate("/help-center")}
        aria-label={t("sutlanding.help_center", {
          defaultValue: isEnglish ? "Help center" : "ศูนย์ช่วยเหลือ",
        })}
      >
        <FiHelpCircle aria-hidden="true" />
      </button>
    </div>
  );
}
