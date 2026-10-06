import React from "react";
import { FiChevronDown, FiShield } from "react-icons/fi";
import "./FormPrivacyNotice.css";

export default function FormPrivacyNotice({
  notice,
  consent,
  onConsentChange,
  language = "th",
}) {
  if (!notice) return null;
  const th = language.startsWith("th");
  const title = th ? "ประกาศความเป็นส่วนตัว" : "Privacy notice";
  return (
    <section className="preview-sec form-privacy-notice" aria-label={title}>
      <details>
        <summary>
          <FiShield aria-hidden="true" />
          <span>
            {title}
            <small>
              {th ? "ฉบับ" : "Version"} {notice.notice_version}
            </small>
          </span>
          <FiChevronDown className="form-privacy-chevron" aria-hidden="true" />
        </summary>
        <p>{notice.notice_text}</p>
      </details>
      {notice.legal_basis === "consent" && (
        <label className="form-privacy-consent">
          <input
            type="checkbox"
            checked={Boolean(consent)}
            onChange={(event) => onConsentChange(event.target.checked)}
          />
          <span>
            {th
              ? "ฉันได้อ่านและยินยอมตามวัตถุประสงค์ในประกาศฉบับนี้"
              : "I have read and consent to the purposes described in this notice."}
          </span>
        </label>
      )}
    </section>
  );
}
