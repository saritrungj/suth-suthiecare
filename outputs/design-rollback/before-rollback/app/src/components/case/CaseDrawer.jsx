import { Button as UiButton } from "../ui/index.jsx";
import { toDisplayText } from "../../utils/textPresentation.js";
import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiMinusCircle,
  FiX,
} from "react-icons/fi";
import { useDialogFocus } from "../useDialogFocus";
import { RISK_SHORT, riskLevel, statusTone } from "./caseDisplay";

const RISK_ICONS = {
  high: FiAlertTriangle,
  medium: FiAlertCircle,
  low: FiCheckCircle,
  none: FiMinusCircle,
};

// Risk as icon shape + word + color. `label` overrides the word (e.g. a
// clinic's own wording); `level` overrides the parsed level.
export function RiskPill({ risk, level, label, short = false }) {
  const tone = level || riskLevel(risk);
  const Icon = RISK_ICONS[tone];
  const text =
    label || (short && RISK_SHORT[tone] ? RISK_SHORT[tone] : risk) || "ไม่ระบุ";
  return (
    <span className={`cw-risk cw-risk--${tone}`}>
      <Icon aria-hidden="true" />
      {toDisplayText(text)}
    </span>
  );
}

export function StatusPill({ status, emptyLabel = "เคสใหม่" }) {
  return (
    <span
      className={`cw-status cw-status--${statusTone(status)}`}
      title={status || emptyLabel}
    >
      <span className="cw-status-label">
        {toDisplayText(status || emptyLabel)}
      </span>
    </span>
  );
}

// Side drawer for one case or one student file, opened beside the list.
// Focus stays inside, the page behind is inert, Escape or the backdrop
// closes it, and focus returns to the row that opened it. `nav` adds
// previous/next so staff can work down the queue without closing.
// `after` renders inside the overlay but outside the drawer: sub-dialogs and
// toasts that must stay reachable while the drawer is open.
export default function CaseDrawer({
  title,
  meta,
  badges,
  tools,
  nav,
  steps,
  tabs,
  activeTab,
  onTabChange,
  onClose,
  after,
  children,
}) {
  const titleId = useId();
  const baseId = useId();
  const overlayRef = useRef(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const tabRefs = useRef({});
  const { onKeyDown } = useDialogFocus({
    id: titleId,
    overlayRef,
    dialogRef,
    closeButtonRef,
    onClose,
    initialFocus: "close",
  });

  // Arrow keys, Home and End move between tabs (roving tabIndex).
  const moveTab = (event) => {
    const index = tabs.findIndex((item) => item.id === activeTab);
    const last = tabs.length - 1;
    const next = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onTabChange(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="cw-drawer-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="cw-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <header className="cw-drawer-head">
          <div className="cw-drawer-bar">
            {nav && (
              <div className="cw-drawer-nav">
                <UiButton
                  variant="secondary"
                  size="icon"
                  type="button"
                  className="cw-icon-btn"
                  aria-label="รายการก่อนหน้า"
                  disabled={!nav.onPrev}
                  onClick={nav.onPrev}
                >
                  <FiChevronLeft aria-hidden="true" />
                </UiButton>
                <span aria-live="polite">
                  {nav.position} / {nav.total}
                </span>
                <UiButton
                  variant="secondary"
                  size="icon"
                  type="button"
                  className="cw-icon-btn"
                  aria-label="รายการถัดไป"
                  disabled={!nav.onNext}
                  onClick={nav.onNext}
                >
                  <FiChevronRight aria-hidden="true" />
                </UiButton>
              </div>
            )}
            <div className="cw-drawer-tools">{tools}</div>
            <UiButton
              variant="secondary"
              size="icon"
              ref={closeButtonRef}
              type="button"
              className="cw-icon-btn"
              aria-label="ปิดหน้าต่าง"
              onClick={onClose}
            >
              <FiX aria-hidden="true" />
            </UiButton>
          </div>
          <h2 id={titleId}>{title}</h2>
          {meta && <p className="cw-drawer-meta">{meta}</p>}
          {badges && <div className="cw-drawer-badges">{badges}</div>}
        </header>
        {steps}
        {tabs?.length > 0 && (
          <div
            className="cw-tabs"
            role="tablist"
            aria-orientation="horizontal"
            aria-label={`ข้อมูล ${title}`}
            onKeyDown={moveTab}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[tab.id] = node;
                }}
                id={`${baseId}-tab-${tab.id}`}
                type="button"
                role="tab"
                className="cw-tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${baseId}-panel`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
              >
                {tab.icon && (
                  <tab.icon className="cw-tab-icon" aria-hidden="true" />
                )}
                <span className="cw-tab-text">
                  <span className="cw-tab-label">
                    {toDisplayText(tab.label)}
                  </span>
                  {tab.count > 0 && (
                    <small
                      className="cw-tab-count"
                      aria-label={`${tab.count} รายการ`}
                    >
                      {tab.count}
                    </small>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
        <div
          className="cw-drawer-body"
          data-dialog-body
          {...(tabs?.length
            ? {
                role: "tabpanel",
                id: `${baseId}-panel`,
                "aria-labelledby": `${baseId}-tab-${activeTab}`,
                tabIndex: 0,
              }
            : {})}
        >
          {children}
        </div>
      </section>
      {after}
    </div>,
    document.body,
  );
}
