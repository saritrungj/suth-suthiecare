import React from "react";
import { useTranslation } from "react-i18next";
import { FiGlobe } from "react-icons/fi";
import "./LanguageSwitcher.css";

export default function LanguageSwitcher({ darkText = false, className = "" }) {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "th";

  const toggleLanguage = () => {
    const nextLang = currentLanguage === "th" ? "en" : "th";
    i18n.changeLanguage(nextLang);
  };

  return (
    <button
      type="button"
      className={`language-switcher ${darkText ? "language-switcher--dark" : ""} ${className}`}
      onClick={toggleLanguage}
      aria-label={currentLanguage === "th" ? "เปลี่ยนภาษาเป็นภาษาอังกฤษ" : "Change language to Thai"}
    >
      <FiGlobe aria-hidden="true" />
      {currentLanguage === "th" ? "EN" : "TH"}
    </button>
  );
}
