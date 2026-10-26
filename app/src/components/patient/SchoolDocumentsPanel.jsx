import { useEffect, useId, useState } from "react";
import { FiDownload, FiExternalLink, FiFileText } from "react-icons/fi";
import {
  downloadStudentDocument,
  getStudentDocuments,
} from "../../services/api";
import { saveBlobResponse } from "../../utils/saveBlob";
import "./AssessmentTasksPanel.css";
import "./CounselingPanel.css";

// Documents the student's school shares with students. Hidden when there are none.
export default function SchoolDocumentsPanel({ language = "th" }) {
  const en = language === "en";
  const titleId = useId();
  const [documents, setDocuments] = useState([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    getStudentDocuments()
      .then(
        ({ data }) =>
          alive &&
          setDocuments(Array.isArray(data?.documents) ? data.documents : []),
      )
      .catch(() => alive && setDocuments([]));
    return () => {
      alive = false;
    };
  }, []);
  if (!documents.length) return null;
  return (
    <section className="at-panel cp-panel" aria-labelledby={titleId}>
      <header className="at-head">
        <span className="at-icon cp-icon" aria-hidden="true">
          <FiFileText />
        </span>
        <div className="at-heading">
          <p className="at-eyebrow">
            {en ? "From your school" : "จากโรงเรียนของคุณ"}
          </p>
          <h2 id={titleId} className="at-title">
            {en ? "School documents" : "เอกสารจากโรงเรียน"}
          </h2>
        </div>
      </header>
      {error && (
        <p className="cp-error" role="alert">
          {error}
        </p>
      )}
      <ul className="at-list">
        {documents.map((doc) => (
          <li key={doc.id} className="at-item">
            <div className="at-item__text">
              <strong>{doc.title}</strong>
              <span className="at-due">
                {[doc.category_name, doc.description]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
            {doc.kind === "file" ? (
              <button
                type="button"
                className="cp-secondary"
                onClick={async () => {
                  try {
                    saveBlobResponse(
                      await downloadStudentDocument(doc.id),
                      doc.file_name || doc.title,
                    );
                  } catch {
                    setError(en ? "Could not download." : "ดาวน์โหลดไม่สำเร็จ");
                  }
                }}
              >
                <FiDownload aria-hidden="true" />{" "}
                {en ? "Download" : "ดาวน์โหลด"}
              </button>
            ) : (
              <a
                className="cp-secondary"
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FiExternalLink aria-hidden="true" />{" "}
                {en ? "Open" : "เปิดลิงก์"}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
