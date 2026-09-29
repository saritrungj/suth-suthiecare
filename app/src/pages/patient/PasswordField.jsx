import { useState } from "react";
import { FiCheck, FiEye, FiEyeOff, FiX } from "react-icons/fi";
import { checkPassword, PASSWORD_MAX_LENGTH } from "../../utils/passwordPolicy";

export function PasswordInput({ id, language, ...inputProps }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="patient-password-control">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete="new-password"
        maxLength={PASSWORD_MAX_LENGTH}
        {...inputProps}
      />
      <button
        className="patient-password-toggle"
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={
          visible
            ? language === "en"
              ? "Hide password"
              : "ซ่อนรหัสผ่าน"
            : language === "en"
              ? "Show password"
              : "แสดงรหัสผ่าน"
        }
        aria-pressed={visible}
        aria-controls={id}
      >
        {visible ? <FiEyeOff /> : <FiEye />}
      </button>
    </div>
  );
}

export function PasswordRules({ id, password, language }) {
  return (
    <ul id={id} className="patient-password-rules" aria-live="polite">
      {checkPassword(password).map((rule) => (
        <li key={rule.id} className={rule.met ? "is-met" : undefined}>
          {rule.met ? (
            <FiCheck aria-hidden="true" />
          ) : (
            <FiX aria-hidden="true" />
          )}
          <span>{language === "en" ? rule.en : rule.th}</span>
          <span className="sr-only">
            {rule.met
              ? language === "en"
                ? " (met)"
                : " (ผ่าน)"
              : language === "en"
                ? " (not met)"
                : " (ยังไม่ผ่าน)"}
          </span>
        </li>
      ))}
    </ul>
  );
}
