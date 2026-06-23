import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { FiPlus, FiImage, FiEdit3 } from "react-icons/fi";
import "./EditBannerModal.css";

// 🟢 ฟังก์ชันครอปรูปภาพ (1024x768 JPG)
const getCroppedImg = async (imageSrc, pixelCrop) => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = imageSrc;
    image.onload = () => {
      try {
        const cropCanvas = document.createElement("canvas");
        const cropCtx = cropCanvas.getContext("2d");
        cropCanvas.width = pixelCrop.width;
        cropCanvas.height = pixelCrop.height;
        cropCtx.drawImage(
          image,
          pixelCrop.x,
          pixelCrop.y,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height,
        );

        const targetCanvas = document.createElement("canvas");
        const targetCtx = targetCanvas.getContext("2d");
        targetCanvas.width = 1024;
        targetCanvas.height = 768;
        targetCtx.imageSmoothingEnabled = true;
        targetCtx.imageSmoothingQuality = "high";
        targetCtx.drawImage(
          cropCanvas,
          0,
          0,
          pixelCrop.width,
          pixelCrop.height,
          0,
          0,
          1024,
          768,
        );

        resolve(targetCanvas.toDataURL("image/jpeg", 0.8));
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = (error) => reject(error);
  });
};

export default function EditBannerModal({ banner, onClose, onSave }) {
  const [image, setImage] = useState(banner?.image || null); // รูปที่จะบันทึก (พรีวิวขวา)
  const [filename, setFilename] = useState(banner?.filename || "");
  const [link, setLink] = useState(banner?.link || "");
  const [rawImage, setRawImage] = useState(null); // รูปต้นฉบับสำหรับครอป
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  const onCropComplete = useCallback(
    (_area, pixels) => setCroppedAreaPixels(pixels),
    [],
  );

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFilename(file.name);
      setRawImage(URL.createObjectURL(file));
      setIsCropping(true);
    }
  };

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels) return;
    try {
      const cropped = await getCroppedImg(rawImage, croppedAreaPixels);
      setImage(cropped);
      setIsCropping(false);
      setRawImage(null);
    } catch (e) {
      alert("ไม่สามารถตัดรูปภาพได้ กรุณาลองใหม่อีกครั้งหรือใช้รูปภาพอื่น");
    }
  };

  const handleSave = () => {
    if (!image) return alert("กรุณาเลือกภาพแบนเนอร์");
    const finalFilename = filename.replace(/\.[^/.]+$/, ".jpg");
    onSave({ ...banner, image, filename: finalFilename, link });
    onClose();
  };

  return (
    <div className="ebm-premium-overlay">
      <div
        className="ebm-premium-card"
        style={isCropping ? { width: "700px" } : {}}
      >
        {!isCropping && (
          <button className="ebm-close-btn" onClick={onClose} type="button">
            <span className="ebm-close-icon"></span>
          </button>
        )}

        <div className="ebm-header">
          <h3>{isCropping ? "ปรับตำแหน่งรูปภาพใหม่" : "แก้ไขแบนเนอร์"}</h3>
          <p>
            {isCropping
              ? "ลากกรอบสัดส่วน 4:3 เพื่อจัดตำแหน่งภาพ"
              : "ภาพใหม่จะถูกบันทึกเป็นสัดส่วน 4:3 "}
          </p>
        </div>

        <div className="ebm-body">
          {isCropping ? (
            <div>
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "350px",
                  background: "#1e293b",
                  borderRadius: "12px",
                  overflow: "hidden",
                  marginBottom: "15px",
                }}
              >
                <Cropper
                  image={rawImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          ) : (
            <>
              <div className="ebm-grid">
                <div className="ebm-section">
                  <label>
                    <FiImage className="ebm-icon" /> ภาพเดิม
                  </label>
                  <div className="ebm-current-preview">
                    <img src={banner.image} alt="current" />
                  </div>
                </div>
                <div className="ebm-section">
                  <label>
                    <FiPlus className="ebm-icon" /> ภาพใหม่{" "}
                  </label>
                  <label
                    className={`ebm-upload-area ${image !== banner.image ? "is-new" : ""}`}
                  >
                    {image ? (
                      <div className="ebm-preview-wrapper">
                        <img
                          src={image}
                          alt="preview"
                          style={{ objectFit: "cover" }}
                        />
                        <div className="ebm-hover-overlay">
                          <FiEdit3 size={20} />
                          <span>เปลี่ยนรูป</span>
                        </div>
                      </div>
                    ) : (
                      <div className="ebm-placeholder">
                        <FiPlus size={30} />
                        <span>เลือกรูป</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      hidden
                    />
                  </label>
                </div>
              </div>
              <div className="ebm-input-group">
                <label>
                  <FiEdit3 className="ebm-icon" /> ชื่อไฟล์แบนเนอร์
                </label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="ebm-input"
                />
              </div>
              <div className="ebm-input-group">
                <label>
                  <FiEdit3 className="ebm-icon" /> ลิงก์ปลายทางเมื่อคลิกแบนเนอร์
                  (ถ้ามี)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="ebm-input"
                />
              </div>
            </>
          )}
        </div>

        <div className="ebm-footer">
          {isCropping ? (
            <>
              <button
                className="ebm-btn-cancel"
                onClick={() => setIsCropping(false)}
              >
                ยกเลิก
              </button>
              <button className="ebm-btn-save" onClick={handleConfirmCrop}>
                ยืนยันการตัดรูป
              </button>
            </>
          ) : (
            <>
              <button className="ebm-btn-cancel" onClick={onClose}>
                ยกเลิก
              </button>
              <button className="ebm-btn-save" onClick={handleSave}>
                บันทึกการแก้ไข
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
