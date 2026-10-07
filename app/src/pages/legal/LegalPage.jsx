import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FiArrowLeft } from "react-icons/fi";
import LanguageSwitcher from "../../components/LanguageSwitcher.jsx";
import logo from "../../assets/logoSUTH.png";
import { getLegalDocument } from "./legalContent";
import "./LegalPage.css";

const TABS = [
  { kind: "terms", to: "/terms", label: ["ข้อกำหนดการใช้บริการ", "Terms"] },
  {
    kind: "privacy",
    to: "/privacy-policy",
    label: ["นโยบายความเป็นส่วนตัว", "Privacy"],
  },
];

export default function LegalPage({ kind }) {
  const { i18n } = useTranslation();
  const doc = getLegalDocument(kind, i18n.resolvedLanguage || "th");
  const en = doc.lang === "en";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [kind]);

  return (
    <div className="legal-page" lang={doc.lang}>
      <header className="legal-header">
        <Link to="/" className="legal-brand">
          <img src={logo} alt="" />
          <span>SUTHie Care</span>
        </Link>
        <LanguageSwitcher darkText />
      </header>

      <main className="legal-main">
        <Link to="/" className="legal-back">
          <FiArrowLeft aria-hidden="true" />
          {en ? "Back to home" : "กลับหน้าหลัก"}
        </Link>

        <nav className="legal-tabs" aria-label={en ? "Legal" : "เอกสาร"}>
          {TABS.map((tab) => (
            <Link
              key={tab.kind}
              to={tab.to}
              aria-current={tab.kind === kind ? "page" : undefined}
            >
              {tab.label[en ? 1 : 0]}
            </Link>
          ))}
        </nav>

        <article className="legal-doc">
          <h1>{doc.title}</h1>
          <p className="legal-updated">{doc.updated}</p>
          <p className="legal-intro">{doc.intro}</p>

          <nav className="legal-toc" aria-label={en ? "Contents" : "สารบัญ"}>
            <h2>{en ? "Contents" : "สารบัญ"}</h2>
            <ol>
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>

          {doc.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2>{section.title}</h2>
              {section.body?.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {section.list && (
                <ul>
                  {section.list.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              )}
              {section.after?.map((text) => (
                <p key={text}>{text}</p>
              ))}
              {section.link && (
                <p>
                  <Link to={section.link.to}>{section.link.label}</Link>
                </p>
              )}
            </section>
          ))}
        </article>
      </main>
    </div>
  );
}
