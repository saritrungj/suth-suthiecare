import { toDisplayText } from '../utils/textPresentation.js';
import {
  FiAlertCircle,
  FiCheckCircle,
  FiChevronDown,
  FiInfo,
  FiLoader,
} from "react-icons/fi";
import "./ManagementSettings.css";

export function SettingsFeedback({ notice }) {
  if (!notice?.text) return null;
  const Icon =
    notice.type === "error"
      ? FiAlertCircle
      : notice.type === "success"
        ? FiCheckCircle
        : FiInfo;
  return (
    <div
      className={`settings-feedback settings-feedback--${notice.type || "info"}`}
      role={notice.type === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" />
      <span>{toDisplayText(notice.text)}</span>
    </div>
  );
}
export function SettingsLoading({ children = "กำลังโหลดข้อมูล..." }) {
  return (
    <p className="settings-loading" role="status">
      <FiLoader aria-hidden="true" />
      {children}
    </p>
  );
}
export function SettingsEmpty({ children }) {
  return (
    <div className="settings-empty">
      <FiInfo aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}
export function SettingsCheck({
  children,
  description,
  className = "",
  ...props
}) {
  return (
    <label className={`settings-check ${className}`}>
      <input type="checkbox" {...props} />
      <span>
        <span>{children}</span>
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
export function SettingsPanel({ title, description, icon: Icon, children }) {
  return (
    <details className="settings-panel">
      <summary>
        {Icon && <Icon className="settings-panel-icon" aria-hidden="true" />}
        <span className="settings-panel-heading">
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        <FiChevronDown className="settings-chevron" aria-hidden="true" />
      </summary>
      <div className="settings-panel-content">{children}</div>
    </details>
  );
}
