import { useTranslation } from "react-i18next";

export default function PatientLanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "th";

  const changeLanguage = (language) => {
    if (language !== currentLanguage) i18n.changeLanguage(language);
  };

  return (
    <div
      className="patient-language-switcher"
      role="group"
      aria-label={currentLanguage === "th" ? "เปลี่ยนภาษา" : "Change language"}
    >
      <button
        type="button"
        className={currentLanguage === "th" ? "is-active" : ""}
        onClick={() => changeLanguage("th")}
        aria-pressed={currentLanguage === "th"}
        lang="th"
      >
        ไทย
      </button>
      <button
        type="button"
        className={currentLanguage === "en" ? "is-active" : ""}
        onClick={() => changeLanguage("en")}
        aria-pressed={currentLanguage === "en"}
        lang="en"
      >
        EN
      </button>
    </div>
  );
}
