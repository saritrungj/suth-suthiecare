import { useState } from "react";
import { FiDownload } from "react-icons/fi";
import api from "../services/api";
import { saveBlobResponse } from "../utils/saveBlob";

// Downloads the current list as CSV (the API answers ?format=csv and checks
// the module's export right itself).
export default function ExportCsvButton({
  path,
  params,
  fileName,
  label = "ส่งออก CSV",
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        type="button"
        className="sch-btn-secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            saveBlobResponse(
              await api.get(path, {
                params: { ...params, format: "csv" },
                responseType: "blob",
              }),
              fileName,
            );
          } catch {
            setError("ส่งออกไม่สำเร็จ");
          } finally {
            setBusy(false);
          }
        }}
      >
        <FiDownload aria-hidden="true" /> {busy ? "กำลังส่งออก…" : label}
      </button>
      {error && (
        <span className="sch-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
