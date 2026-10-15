import React from "react";
import {
  FaPalette,
  FaTimes,
  FaImage,
  FaAlignLeft,
  FaAlignCenter,
  FaAlignRight,
  FaCheck,
  FaPlus,
} from "react-icons/fa";

const THEME_COLORS = [
  "#db4437",
  "#673ab7",
  "#3f51b5",
  "#4285f4",
  "#03a9f4",
  "#00bcd4",
  "#ff5722",
  "#ff9800",
  "#009688",
  "#4caf50",
  "#607d8b",
  "#9e9e9e",
];
const BG_COLORS = [
  "#ffffff",
  "#f0f2f5",
  "#f8f9fa",
  "#fdf2f8",
  "#f3f1fa",
  "#e8f0fe",
  "#e6f4ea",
  "#fce8e6",
];

const ThemeSidebar = ({
  isOpen,
  onClose,
  bannerType,
  setBannerType,
  bannerBgColor,
  setBannerBgColor,
  headerImage,
  setHeaderImage,
  handleHeaderImageUpload,
  bannerText,
  setBannerText,
  bannerTextAlign,
  setBannerTextAlign,
  themeColor,
  setThemeColor,
  bgColor,
  setBgColor,
}) => {
  return (
    <>
      <div className={`sfb-theme-sidebar ${isOpen ? "open" : ""}`}>
        <div className="sfb-theme-sidebar-header">
          <div className="sfb-theme-title-group">
            <FaPalette /> <span>ตัวเลือกธีม</span>
          </div>
          <button className="sfb-btn-close-theme" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className="sfb-theme-sidebar-body">
          <div className="sfb-theme-setting-section">
            <h4>ส่วนหัว (Banner)</h4>
            <div className="sfb-banner-type-toggles">
              <button
                className={bannerType === "none" ? "active" : ""}
                onClick={() => setBannerType("none")}
              >
                ไม่มี
              </button>
              <button
                className={bannerType === "color" ? "active" : ""}
                onClick={() => setBannerType("color")}
              >
                สีทึบ
              </button>
              <button
                className={bannerType === "image" ? "active" : ""}
                onClick={() => setBannerType("image")}
              >
                รูปภาพ
              </button>
            </div>

            {bannerType === "color" && (
              <div className="sfb-banner-color-picker-wrap">
                <label>เลือกสี:</label>
                <input
                  type="color"
                  value={bannerBgColor}
                  onChange={(e) => setBannerBgColor(e.target.value)}
                />
              </div>
            )}

            {bannerType === "image" && (
              <>
                <p className="sfb-theme-hint-text">
                  แนะนำขนาด: 1600 x 400 พิกเซล
                </p>
                <input
                  type="file"
                  accept="image/*"
                  id="main-header-img"
                  hidden
                  onChange={handleHeaderImageUpload}
                />
                <button
                  className="sfb-btn-theme-upload"
                  onClick={() =>
                    document.getElementById("main-header-img").click()
                  }
                >
                  <FaImage /> อัปโหลดรูปภาพ
                </button>
                {headerImage && (
                  <button
                    className="sfb-btn-theme-remove-img"
                    onClick={() => {
                      setHeaderImage(null);
                      setBannerType("none");
                    }}
                  >
                    นำรูปภาพออก
                  </button>
                )}
              </>
            )}

            {bannerType !== "none" && (
              <div
                className="sfb-banner-align-toggles"
                style={{ marginTop: "15px" }}
              >
                <p
                  className="sfb-theme-hint-text"
                  style={{
                    marginBottom: "8px",
                    color: "#202124",
                    fontWeight: 500,
                  }}
                >
                  จัดตำแหน่งข้อความบนแบนเนอร์
                </p>
                <div className="sfb-align-buttons">
                  <button
                    className={bannerTextAlign === "left" ? "active" : ""}
                    onClick={() => setBannerTextAlign("left")}
                    title="จัดชิดซ้าย"
                  >
                    <FaAlignLeft />
                  </button>
                  <button
                    className={bannerTextAlign === "center" ? "active" : ""}
                    onClick={() => setBannerTextAlign("center")}
                    title="จัดกึ่งกลาง"
                  >
                    <FaAlignCenter />
                  </button>
                  <button
                    className={bannerTextAlign === "right" ? "active" : ""}
                    onClick={() => setBannerTextAlign("right")}
                    title="จัดชิดขวา"
                  >
                    <FaAlignRight />
                  </button>
                </div>
              </div>
            )}
          </div>

          <hr className="sfb-theme-divider" />

          <div className="sfb-theme-setting-section">
            <h4>สีธีม</h4>
            <div className="sfb-color-grid">
              {THEME_COLORS.map((color) => (
                <button
                  key={color}
                  className={`sfb-color-circle ${themeColor === color ? "active" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setThemeColor(color)}
                >
                  {themeColor === color && (
                    <FaCheck className="sfb-color-check-icon" />
                  )}
                </button>
              ))}
              <div
                style={{ position: "relative", width: "32px", height: "32px" }}
              >
                <input
                  type="color"
                  id="custom-theme-color"
                  value={themeColor}
                  onChange={(e) => setThemeColor(e.target.value)}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 0,
                    height: 0,
                    pointerEvents: "none",
                  }}
                />
                <button
                  className="sfb-color-circle sfb-custom-color-btn"
                  onClick={() =>
                    document.getElementById("custom-theme-color").click()
                  }
                  style={
                    !THEME_COLORS.includes(themeColor)
                      ? { backgroundColor: themeColor }
                      : { backgroundColor: "#f1f3f4" }
                  }
                >
                  {!THEME_COLORS.includes(themeColor) ? (
                    <FaCheck className="sfb-color-check-icon" />
                  ) : (
                    <FaPlus size={14} color="#5f6368" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <hr className="sfb-theme-divider" />

          <div className="sfb-theme-setting-section">
            <h4>สีพื้นหลัง</h4>
            <div className="sfb-color-grid sfb-bg-color-grid">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  className={`sfb-color-circle sfb-bg-circle ${bgColor === color ? "active" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setBgColor(color)}
                >
                  {bgColor === color && (
                    <FaCheck className="sfb-color-check-icon sfb-dark-check" />
                  )}
                </button>
              ))}
              <div
                style={{ position: "relative", width: "32px", height: "32px" }}
              >
                <input
                  type="color"
                  id="custom-bg-color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    width: 0,
                    height: 0,
                    pointerEvents: "none",
                  }}
                />
                <button
                  className="sfb-color-circle sfb-custom-color-btn sfb-bg-circle"
                  onClick={() =>
                    document.getElementById("custom-bg-color").click()
                  }
                  style={
                    !BG_COLORS.includes(bgColor)
                      ? { backgroundColor: bgColor }
                      : { backgroundColor: "#ffffff" }
                  }
                >
                  {!BG_COLORS.includes(bgColor) ? (
                    <FaCheck className="sfb-color-check-icon sfb-dark-check" />
                  ) : (
                    <FaPlus size={14} color="#5f6368" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {isOpen && (
        <div className="sfb-theme-sidebar-backdrop" onClick={onClose}></div>
      )}
    </>
  );
};

export default ThemeSidebar;
