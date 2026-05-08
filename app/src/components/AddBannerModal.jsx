import React, { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import { FiPlus } from "react-icons/fi";
import "./AddBannerModal.css";

// ฟังก์ชันครอปรูปภาพ 
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
          pixelCrop.height
        );

        //  สร้าง Canvas หลัก เพื่อ "ย่อ/ขยาย" ให้เป็น 1024x768 px
        const targetCanvas = document.createElement("canvas");
        const targetCtx = targetCanvas.getContext("2d");

        targetCanvas.width = 1024;
        targetCanvas.height = 768;

        // เปิดโหมดภาพคมชัดขั้นสูงสุดเวลารีไซส์
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
          768
        );

        // แปลงเป็นไฟล์ JPG และบีบอัดคุณภาพ 80% (0.8)
        const base64Image = targetCanvas.toDataURL("image/jpeg", 0.8);
        resolve(base64Image);
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = (error) => {
      reject(error);
    };
  });
};

export default function AddBannerModal({ onClose, onSave }) {
  const [image, setImage] = useState(null);
  const [croppedImage, setCroppedImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);
  const [filename, setFilename] = useState("");

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFilename(file.name);
      setImage(URL.createObjectURL(file));
      setIsCropping(true);
    }
  };

  const handleConfirmCrop = async () => {
    if (!croppedAreaPixels) return;

    try {
      const cropped = await getCroppedImg(image, croppedAreaPixels);
      setCroppedImage(cropped);
      setIsCropping(false);
    } catch (e) {

      alert("เกิดข้อผิดพลาดในการประมวลผลรูปภาพ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const handleSave = () => {
    if (!croppedImage) return alert("กรุณาเลือกและตัดรูปภาพก่อน");

    const finalFilename = filename ? filename.replace(/\.[^/.]+$/, ".jpg") : `banner_${Date.now()}.jpg`;
    onSave({ image: croppedImage, filename: finalFilename });
    onClose();
  };

  return (
    <div className="abm-overlay">
      <div className="abm-card">
        <div className="abm-header">
          <h3>เพิ่มแบนเนอร์ใหม่</h3>
          <p>{isCropping ? "เลื่อนกรอบเพื่อจัดตำแหน่งรูปภาพ (ขนาด1024 x 768 px)" : "ระบุรายละเอียดแบนเนอร์"}</p>
          <button className="abm-close-btn-custom" onClick={onClose} aria-label="Close">
            <span className="close-cross"></span>
          </button>
        </div>

        <div className="abm-body">
          {isCropping ? (
            <div className="abm-crop-section">
              <div style={{ position: "relative", width: "100%", height: "350px", background: "#1e293b", borderRadius: '12px', overflow: 'hidden' }}>
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div style={{ marginTop: '15px' }}>
                <label className="abm-label">ซูม: {Math.round(zoom * 100)}%</label>
                <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(e.target.value)} style={{ width: '100%' }} />
              </div>
            </div>
          ) : (
            <div className="abm-preview-section">
              {!croppedImage ? (
                <label className="abm-upload-area">
                  <FiPlus size={40} />
                  <span>คลิกเพื่อเลือกรูปภาพ</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} hidden />
                </label>
              ) : (
                <>
                  <div style={{ marginBottom: '20px' }}>
                    <label className="abm-label" style={{ marginBottom: '8px' }}>ภาพแบนเนอร์ที่พร้อมใช้งาน</label>
                    <img
                      src={croppedImage}
                      alt="cropped"
                      style={{
                        width: '100%',
                        aspectRatio: '4 / 3',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: '2px solid #4a9b9f',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                    />
                    <button onClick={() => setIsCropping(true)} className="abm-btn-outline-sm" style={{ marginTop: '12px' }}>ตัดใหม่</button>
                  </div>
                  <div className="abm-input-group">
                    <label className="abm-label">ชื่อแบนเนอร์:</label>
                    <input
                      type="text"
                      className="abm-input"
                      value={filename}
                      onChange={(e) => setFilename(e.target.value)}
                      placeholder="เช่น ภาพปก"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="abm-footer">
          <button className="abm-btn-cancel" onClick={onClose}>ยกเลิก</button>
          {isCropping ? (
            <button className="abm-btn-save" onClick={handleConfirmCrop}>ยืนยันการตัดรูป</button>
          ) : (
            <button className="abm-btn-save" onClick={handleSave} disabled={!croppedImage}>บันทึกแบนเนอร์</button>
          )}
        </div>
      </div>
    </div>
  );
}