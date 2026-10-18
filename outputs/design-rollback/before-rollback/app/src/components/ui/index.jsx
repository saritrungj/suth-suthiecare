import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { FiInbox, FiX } from "react-icons/fi";
import { useDialogFocus } from "../useDialogFocus";

const classes = (...values) => values.filter(Boolean).join(" ");

/** Native button props (including refs) are forwarded. Use submit explicitly
 * in forms; busy keeps the accessible label while blocking duplicate writes. */
export function Button({
  variant = "secondary",
  size = "default",
  busy = false,
  type = "button",
  disabled,
  className,
  children,
  ...props
}) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || props["aria-busy"] || undefined}
      className={classes(
        "suth-button",
        `suth-button--${variant}`,
        size === "icon" && "suth-button--icon",
        className,
      )}
    >
      {busy && <span className="suth-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}

/** Use title/description/actions for new pages; children preserves the content
 * of migrated headers without changing permissions, counts or scope labels. */
export function PageHeader({
  title,
  description,
  actions,
  className,
  children,
  ...props
}) {
  return (
    <header {...props} className={classes("suth-page-header", className)}>
      {title ? (
        <>
          <div className="suth-page-header__copy">
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {actions && (
            <div className="suth-page-header__actions">{actions}</div>
          )}
        </>
      ) : (
        children
      )}
    </header>
  );
}

export function FilterBar({ className, children, ...props }) {
  return (
    <div {...props} className={classes("suth-filter-bar", className)}>
      {children}
    </div>
  );
}

export function Surface({
  as: Tag = "section",
  className,
  children,
  ...props
}) {
  return (
    <Tag {...props} className={classes("suth-surface", className)}>
      {children}
    </Tag>
  );
}

/** Preserve native links/buttons and their existing selection semantics. */
export function SelectionGroup({
  as: Tag = "div",
  className,
  children,
  ...props
}) {
  return (
    <Tag {...props} className={classes("suth-selection-group", className)}>
      {children}
    </Tag>
  );
}

/** Status text is always visible. Clinical risk pills keep their own mapping. */
export function Badge({ tone, className, children, ...props }) {
  return (
    <span
      {...props}
      className={classes(
        "suth-badge",
        tone && `suth-badge--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Keep native table semantics and the caller's columns, sort and mobile
 * presentation. Scroll regions remain the responsibility of TableScroll. */
export function DataTable({ className, children, ...props }) {
  return (
    <table {...props} className={classes("suth-table", className)}>
      {children}
    </table>
  );
}

export function TextInput({ className, ...props }) {
  return <input {...props} className={classes("suth-input", className)} />;
}

export function TextArea({ className, ...props }) {
  return (
    <textarea
      {...props}
      className={classes("suth-input", "suth-textarea", className)}
    />
  );
}

export function EmptyState({ title, hint, icon: Icon = FiInbox, children }) {
  return (
    <div className="suth-empty-state">
      <Icon aria-hidden="true" />
      <strong>{title}</strong>
      {hint && <p>{hint}</p>}
      {children}
    </div>
  );
}

export function EmptyRow({ columns, title, hint, icon }) {
  return (
    <tr>
      <td colSpan={columns} className="suth-empty-cell">
        <EmptyState title={title} hint={hint} icon={icon} />
      </td>
    </tr>
  );
}

export function LoadingRows({ columns, rows = 4 }) {
  return Array.from({ length: rows }, (_, index) => (
    <tr key={index} aria-hidden="true">
      <td colSpan={columns}>
        <span className="suth-skeleton" />
      </td>
    </tr>
  ));
}

/** Owns the portal and focus stack for dialogs with task-specific content. */
export function DialogFrame({
  as: Tag = "section",
  onClose,
  dismissible = true,
  children,
  className,
  legacy = true,
  size = "large",
  ...props
}) {
  const id = useId();
  const overlayRef = useRef(null),
    dialogRef = useRef(null);
  const requestClose = () => {
    if (dismissible) onClose();
  };
  const { onKeyDown } = useDialogFocus({
    id,
    overlayRef,
    dialogRef,
    onClose: requestClose,
  });
  return createPortal(
    <div
      ref={overlayRef}
      className="ui-modal-overlay suth-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <Tag
        {...props}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={classes(
          "suth-dialog",
          legacy && "suth-dialog--legacy",
          size === "small" && "suth-dialog--small",
          className,
        )}
        onKeyDown={(event) => {
          props.onKeyDown?.(event);
          if (!event.defaultPrevented) onKeyDown(event);
        }}
      >
        {children}
      </Tag>
    </div>,
    document.body,
  );
}

/** Standard header/body/footer on the same portal and focus implementation. */
export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "large",
  className,
  dismissible,
  ...props
}) {
  const titleId = useId();
  return (
    <DialogFrame
      {...props}
      legacy={false}
      onClose={onClose}
      dismissible={dismissible}
      size={size}
      className={className}
      aria-labelledby={props["aria-label"] ? undefined : titleId}
    >
      <header className="suth-dialog__header">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          disabled={dismissible === false}
          aria-label="ปิดหน้าต่าง"
        >
          <FiX aria-hidden="true" />
        </Button>
      </header>
      <div className="suth-dialog__body" data-dialog-body>
        {children}
      </div>
      {footer && <footer className="suth-dialog__footer">{footer}</footer>}
    </DialogFrame>
  );
}
