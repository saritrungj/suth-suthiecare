import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FiCheckCircle, FiInfo, FiRotateCcw, FiUpload } from "react-icons/fi";
import { PageHero } from "../../../components/dashboard/DashboardKit";
import DataPanel from "../../../components/table/DataPanel";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import { useModuleActions } from "../../../permissions/useModuleActions";
import {
  getResultImages,
  resetResultImage,
  saveResultImage,
} from "../../../services/api";
import {
  showErrorAlert,
  showInfoAlert,
  showSuccessToast,
} from "../../../utils/alerts";
import riskLow from "../../../assets/01.png";
import riskMedium from "../../../assets/02.png";
import riskHigh from "../../../assets/03.png";
import "./ResultImageManager.css";

const LEVELS = [
  {
    key: "low",
    title: "ความเสี่ยงต่ำ / ปกติ",
    hint: "ผลลัพธ์สีเขียว สีฟ้า หรือสีอื่นที่ไม่ใช่สีเหลืองและสีแดง",
    fallback: riskLow,
  },
  {
    key: "medium",
    title: "ความเสี่ยงปานกลาง",
    hint: "ผลลัพธ์ที่ตั้งเป็นสีเหลืองหรือสีส้ม",
    fallback: riskMedium,
  },
  {
    key: "high",
    title: "ความเสี่ยงสูง",
    hint: "ผลลัพธ์ที่ตั้งเป็นสีแดง",
    fallback: riskHigh,
  },
];

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 800;
// Stay under the server's limit for the encoded image.
const MAX_ENCODED_CHARS = 2_900_000;

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านไฟล์ภาพไม่ได้"));
    };
    image.src = url;
  });

// Scale down to MAX_SIDE and encode as WebP, which keeps transparent
// backgrounds; fall back to PNG where WebP encoding is unavailable.
async function prepareImage(file) {
  const image = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.8, 0.65]) {
    const data = canvas.toDataURL("image/webp", quality);
    if (data.startsWith("data:image/webp") && data.length <= MAX_ENCODED_CHARS)
      return data;
  }
  const png = canvas.toDataURL("image/png");
  if (png.length <= MAX_ENCODED_CHARS) return png;
  throw new Error("ภาพมีรายละเอียดมากเกินไป กรุณาใช้ภาพที่เล็กลง");
}

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

function LevelCard({ level, saved, canEdit, busy, onUpload, onReset }) {
  const inputRef = useRef(null);
  const isCustom = Boolean(saved?.image);
  const titleId = `rim-${level.key}-title`;

  return (
    <article
      className={`rim-card rim-card--${level.key}`}
      aria-labelledby={titleId}
      aria-busy={busy}
    >
      <div className="rim-card__preview">
        <img src={saved?.image || level.fallback} alt="" />
        <span
          className={`rim-card__status ${isCustom ? "is-custom" : ""}`.trim()}
        >
          {isCustom ? (
            <>
              <FiCheckCircle aria-hidden="true" /> ภาพของหน่วยงาน
            </>
          ) : (
            "ภาพเริ่มต้นของระบบ"
          )}
        </span>
      </div>

      <div className="rim-card__body">
        <h2 id={titleId} className="rim-card__title">
          <span className="rim-card__dot" aria-hidden="true" />
          {level.title}
        </h2>
        <p className="rim-card__hint">{level.hint}</p>
        {isCustom && (
          <p className="rim-card__meta">
            {saved.filename || "ภาพที่อัปโหลด"}
            {saved.updated_at && ` · ${formatDate(saved.updated_at)}`}
          </p>
        )}

        {canEdit && (
          <div className="rim-card__actions">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="rim-card__file"
              aria-label={`เลือกภาพสำหรับ${level.title}`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onUpload(level, file);
              }}
            />
            <button
              type="button"
              className="rim-btn rim-btn--primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <FiUpload aria-hidden="true" />
              {busy ? "กำลังบันทึก…" : isCustom ? "เปลี่ยนภาพ" : "อัปโหลดภาพ"}
            </button>
            {isCustom && (
              <button
                type="button"
                className="rim-btn"
                disabled={busy}
                onClick={() => onReset(level)}
              >
                <FiRotateCcw aria-hidden="true" /> ใช้ภาพเริ่มต้น
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ResultImageManager() {
  const { activeOrganization } = usePermissions();
  const rights = useModuleActions("forms");
  const [images, setImages] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyLevel, setBusyLevel] = useState(null);
  const allOrganizations = !activeOrganization || activeOrganization === "all";

  const load = async () => {
    setLoading(true);
    try {
      const response = await getResultImages();
      setImages(response.data?.images || {});
    } catch (error) {
      await showErrorAlert({ error, title: "โหลดภาพผลลัพธ์ไม่สำเร็จ" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (allOrganizations) {
      setLoading(false);
      return;
    }
    load();
    // The admin layout remounts this page when the organization changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (level, file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      await showInfoAlert({
        title: "ไฟล์ไม่รองรับ",
        text: "กรุณาเลือกไฟล์ภาพ PNG, JPG หรือ WEBP",
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      await showInfoAlert({
        title: "ไฟล์ใหญ่เกินไป",
        text: "กรุณาเลือกไฟล์ภาพขนาดไม่เกิน 10 MB",
      });
      return;
    }
    setBusyLevel(level.key);
    try {
      const image = await prepareImage(file);
      await saveResultImage(level.key, { image, filename: file.name });
      await load();
      showSuccessToast(`บันทึกภาพ${level.title}แล้ว`);
    } catch (error) {
      await showErrorAlert({ error, title: "บันทึกภาพไม่สำเร็จ" });
    } finally {
      setBusyLevel(null);
    }
  };

  const handleReset = async (level) => {
    const confirm = await Swal.fire({
      title: "กลับไปใช้ภาพเริ่มต้น?",
      text: `ภาพของหน่วยงานสำหรับ${level.title}จะถูกลบ และหน้าผลลัพธ์จะแสดงภาพเริ่มต้นของระบบแทน`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "ใช้ภาพเริ่มต้น",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "var(--suth-action)",
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;
    setBusyLevel(level.key);
    try {
      await resetResultImage(level.key);
      await load();
      showSuccessToast("กลับไปใช้ภาพเริ่มต้นแล้ว");
    } catch (error) {
      await showErrorAlert({ error, title: "เปลี่ยนกลับไม่สำเร็จ" });
    } finally {
      setBusyLevel(null);
    }
  };

  return (
    <div className="rim-page">
      <PageHero
        title="ภาพผลลัพธ์การประเมิน"
        description="กำหนดภาพที่ผู้รับบริการเห็นบนหน้าผลการประเมินของแบบฟอร์มในหน่วยงานนี้ แยกตามระดับความเสี่ยง"
      />

      {allOrganizations ? (
        <DataPanel as="div" className="rim-empty" role="status">
          <FiInfo aria-hidden="true" />
          <strong>กรุณาเลือกหน่วยงาน</strong>
          <span>
            เลือกหน่วยงานที่ต้องการจัดการจากตัวเลือก
            &quot;หน่วยงานที่กำลังใช้งาน&quot; ที่แถบเมนูด้านซ้าย
          </span>
        </DataPanel>
      ) : (
        <DataPanel as="section" className="rim-panel" aria-label="ภาพตามระดับ">
          <div className="dz-section__head rim-panel__head">
            <div>
              <h2 className="dz-section__title">ภาพตามระดับผลลัพธ์</h2>
              <p className="dz-section__desc">
                ระบบเลือกภาพจากสีของเกณฑ์ผลลัพธ์ในแบบฟอร์ม
                ระดับที่ไม่ได้อัปโหลดจะใช้ภาพเริ่มต้นของระบบ
              </p>
            </div>
            <span className="rim-chip">PNG · JPG · WEBP ไม่เกิน 10 MB</span>
          </div>

          {loading ? (
            <div className="rim-loading" role="status">
              กำลังโหลดภาพผลลัพธ์…
            </div>
          ) : (
            <div className="rim-grid">
              {LEVELS.map((level) => (
                <LevelCard
                  key={level.key}
                  level={level}
                  saved={images[level.key]}
                  canEdit={rights.update}
                  busy={busyLevel === level.key}
                  onUpload={handleUpload}
                  onReset={handleReset}
                />
              ))}
            </div>
          )}

          <p className="rim-tip">
            <FiInfo aria-hidden="true" />
            แนะนำภาพสี่เหลี่ยมจัตุรัสพื้นหลังโปร่งใส ระบบจะย่อภาพให้ไม่เกิน{" "}
            {MAX_SIDE}×{MAX_SIDE} พิกเซลก่อนบันทึก
          </p>
        </DataPanel>
      )}
    </div>
  );
}
