import { FiActivity, FiCheckCircle, FiInfo, FiLock } from "react-icons/fi";
import { useTranslation } from "react-i18next";

const formatScore = (score) => {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return "-";
  return Number.isInteger(numericScore)
    ? numericScore.toLocaleString()
    : numericScore.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

export default function InteractiveResultPanel({
  results,
  totalTargets,
  isAuthenticated,
  className = "",
}) {
  const { t } = useTranslation();
  const hasResults = results.length > 0;

  return (
    <section
      className={`assessment-live-results ${className}`.trim()}
      aria-label={t("form_view.interactive_title")}
      aria-live="polite"
    >
      <header className="assessment-live-results__header">
        <span className="assessment-live-results__icon" aria-hidden="true">
          <FiActivity />
        </span>
        <div>
          <h2>{t("form_view.interactive_title")}</h2>
          <p>{t("form_view.interactive_updates")}</p>
        </div>
        {totalTargets > 0 && (
          <span className="assessment-live-results__progress">
            {results.length}/{totalTargets}
          </span>
        )}
      </header>

      {hasResults ? (
        <div className="assessment-live-results__list">
          {results.map((result, index) => (
            <article
              className={`assessment-live-result ${index === 0 ? "is-primary" : ""}`}
              key={result.question_id}
            >
              <div className="assessment-live-result__heading">
                <div>
                  <span>{t("form_view.interactive_current_status")}</span>
                  <h3>{result.label}</h3>
                </div>
                <div className="assessment-live-result__score">
                  <strong>{formatScore(result.score)}</strong>
                  <span>{t("form_view.interactive_score")}</span>
                </div>
              </div>
              <p className="assessment-live-result__title">{result.title}</p>
              {result.advice && (
                <div className="assessment-live-result__advice">
                  <FiCheckCircle aria-hidden="true" />
                  <div>
                    <strong>{t("form_view.interactive_advice")}</strong>
                    <p>{result.advice}</p>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="assessment-live-results__empty">
          <FiInfo aria-hidden="true" />
          <strong>{t("form_view.interactive_empty_title")}</strong>
          <p>{t("form_view.interactive_empty_desc")}</p>
        </div>
      )}

      <footer
        className={`assessment-live-results__session ${isAuthenticated ? "is-authenticated" : ""}`}
      >
        {isAuthenticated ? <FiCheckCircle aria-hidden="true" /> : <FiLock aria-hidden="true" />}
        <span>
          {t(
            isAuthenticated
              ? "form_view.interactive_signed_in"
              : "form_view.interactive_guest",
          )}
        </span>
      </footer>
    </section>
  );
}
