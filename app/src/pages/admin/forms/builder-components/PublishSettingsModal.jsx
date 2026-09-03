import React, { useState, useEffect } from "react";
import {
  FaCog,
  FaTimes,
  FaFileAlt,
  FaSyncAlt,
  FaChevronDown,
} from "react-icons/fa";
import { getActiveClinics } from "../../../../services/api";

const PublishSettingsModal = ({
  isOpen,
  onClose,
  formStatus,
  setFormStatus,
  clinicType,
  setClinicType,
  formType,
  setFormType, // 🟢 รับ Props formType
  isScheduled,
  setIsScheduled,
  publishStartDate,
  setPublishStartDate,
  publishEndDate,
  setPublishEndDate,
  loginEnforcement,
  setLoginEnforcement,
  resultDisplayMode,
  setResultDisplayMode,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clinics, setClinics] = useState([]);

  useEffect(() => {
    getActiveClinics()
      .then((res) => setClinics(res.data.data || []))
      .catch((err) => console.error("Failed to load clinics", err));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="sfb-modal-overlay">
      <div
        className="sfb-modal-content"
        style={{
          position: "relative",
          maxWidth: "500px",
          padding: "24px",
          background: "white",
          borderRadius: "12px",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "18px",
            color: "#64748b",
          }}
        >
          <FaTimes />
        </button>

        <h3
          style={{
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#1e293b",
          }}
        >
          <FaCog color="#64748b" /> ตั้งค่าฟอร์มและการเผยแพร่
        </h3>

        <div
          className="sfb-modal-body"
          style={{ display: "flex", flexDirection: "column", gap: "20px" }}
        >
          {/* 🟢 1. เลือกประเภทฟอร์ม (Registration / Follow-up) */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              background: "#f8fafc",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <label
              style={{
                fontWeight: "bold",
                fontSize: "14.5px",
                color: "#0f172a",
              }}
            >
              ประเภทของฟอร์ม
            </label>
            {/* 🔽 วางตรงนี้แทน select เดิม */}
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setDropdownOpen(!dropdownOpen)}
                style={{
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  background: "white",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      background:
                        formType === "Registration" ? "#dbeafe" : "#dcfce7",
                      padding: "6px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {formType === "Registration" ? (
                      <FaFileAlt color="#2563eb" size={14} />
                    ) : (
                      <FaSyncAlt color="#16a34a" size={14} />
                    )}
                  </div>

                  {formType === "Registration"
                    ? "ฟอร์มลงทะเบียนแรกเข้า"
                    : "แบบประเมินติดตามผล"}
                </div>

                <FaChevronDown />
              </div>

              {dropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "110%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    zIndex: 1000,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  <div
                    onClick={() => {
                      setFormType("Registration");
                      setDropdownOpen(false);
                    }}
                    style={{
                      padding: "10px",
                      display: "flex",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        background: "#dbeafe",
                        padding: "6px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FaFileAlt color="#2563eb" size={14} />
                    </div>
                    ฟอร์มลงทะเบียนแรกเข้า
                  </div>

                  <div
                    onClick={() => {
                      setFormType("Follow-up");
                      setDropdownOpen(false);
                    }}
                    style={{
                      padding: "10px",
                      display: "flex",
                      gap: "8px",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        background: "#dcfce7",
                        padding: "6px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FaSyncAlt color="#16a34a" size={14} />
                    </div>
                    แบบประเมินติดตามผล
                  </div>
                </div>
              )}
            </div>
            <p
              style={{
                fontSize: "12px",
                color: "#64748b",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              * ฟอร์มลงทะเบียนจะสร้างเคสใหม่เสมอ
              ส่วนฟอร์มติดตามผลจะเชื่อมกับเคสเดิม
            </p>
          </div>

          {/* 2. เลือกคลินิก */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontWeight: "bold",
                fontSize: "14.5px",
                color: "#0f172a",
              }}
            >
              ประเภทคลินิก
            </label>
            <select
              value={clinicType}
              onChange={(e) => setClinicType(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14.5px",
                outline: "none",
              }}
            >
              <option value="general">ทั่วไป (ใช้ร่วมกัน)</option>
              {clinics.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. สถานะฟอร์ม */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontWeight: "bold",
                fontSize: "14.5px",
                color: "#0f172a",
              }}
            >
              สถานะฟอร์มปัจจุบัน
            </label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "14.5px",
                outline: "none",
              }}
            >
              <option value="draft">ฉบับร่าง (ยังไม่เผยแพร่)</option>
              <option value="published">เผยแพร่ (พร้อมใช้งาน)</option>
            </select>
          </div>

          {/* 4. ตั้งเวลาเปิด-ปิด */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "4px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "14.5px",
                color: "#0f172a",
              }}
            >
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  accentColor: "#1967d2",
                }}
              />
              ตั้งเวลาเปิด-ปิดฟอร์มล่วงหน้า
            </label>

            {isScheduled && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  paddingLeft: "26px",
                  borderLeft: "2px solid #1967d2",
                  animation: "fadeIn 0.3s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label style={{ fontSize: "13px", color: "#475569" }}>
                    เริ่มเปิดรับข้อมูลตั้งแต่เวลา:
                  </label>
                  <input
                    type="datetime-local"
                    value={publishStartDate}
                    onChange={(e) => setPublishStartDate(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label style={{ fontSize: "13px", color: "#475569" }}>
                    ปิดรับข้อมูลอัตโนมัติเมื่อถึงเวลา:
                  </label>
                  <input
                    type="datetime-local"
                    value={publishEndDate}
                    onChange={(e) => setPublishEndDate(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
          {/* 5. การเข้าถึงแบบประเมิน */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            <label
              style={{
                fontWeight: "bold",
                fontSize: "14.5px",
                color: "#0f172a",
              }}
            >
              การเข้าถึงแบบประเมิน
            </label>
            {[
              {
                value: "none",
                label: "เปิดให้เข้าถึงได้เลย",
                desc: "ไม่ต้องเข้าสู่ระบบ ผู้ใช้ทำแบบประเมินได้ทันที",
                color: "#16a34a",
                bgColor: "#dcfce7",
              },
              {
                value: "optional",
                label: "แนะนำให้เข้าสู่ระบบ",
                desc: "แสดงข้อความแจ้งให้เข้าสู่ระบบ แต่ยังสามารถทดลองทำได้",
                color: "#d97706",
                bgColor: "#fef3c7",
              },
              {
                value: "strict",
                label: "บังคับเข้าสู่ระบบ",
                desc: "ต้องเข้าสู่ระบบก่อนจึงจะดูและทำแบบประเมินได้",
                color: "#dc2626",
                bgColor: "#fee2e2",
              },
            ].map((opt) => (
              <div
                key={opt.value}
                onClick={() => setLoginEnforcement(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `2px solid ${loginEnforcement === opt.value ? opt.color : "#cbd5e1"}`,
                  background: loginEnforcement === opt.value ? opt.bgColor : "white",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: `2px solid ${loginEnforcement === opt.value ? opt.color : "#94a3b8"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {loginEnforcement === opt.value && (
                    <div
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: opt.color,
                      }}
                    />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "14px",
                      color: "#0f172a",
                    }}
                  >
                    {opt.label}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#64748b",
                      marginTop: "2px",
                    }}
                  >
                    {opt.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 6. โหมดการแสดงผลลัพธ์ */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              background: "#f8fafc",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
            }}
          >
            <label
              style={{
                fontWeight: "bold",
                fontSize: "14.5px",
                color: "#0f172a",
              }}
            >
              โหมดการแสดงผลลัพธ์แบบประเมิน
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div
                onClick={() => setResultDisplayMode("realtime")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `2px solid ${resultDisplayMode === "realtime" ? "#1967d2" : "#cbd5e1"}`,
                  background: resultDisplayMode === "realtime" ? "#eff6ff" : "white",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `2px solid ${resultDisplayMode === "realtime" ? "#1967d2" : "#94a3b8"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {resultDisplayMode === "realtime" && (
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1967d2" }} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a" }}>
                    แสดงผลแบบเรียลไทม์
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    ผลลัพธ์และคะแนนมีการอัปเดตทันทีขณะกรอกแบบฟอร์ม
                  </div>
                </div>
              </div>
              <div
                onClick={() => setResultDisplayMode("on_submit")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: `2px solid ${resultDisplayMode === "on_submit" ? "#1967d2" : "#cbd5e1"}`,
                  background: resultDisplayMode === "on_submit" ? "#eff6ff" : "white",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `2px solid ${resultDisplayMode === "on_submit" ? "#1967d2" : "#94a3b8"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {resultDisplayMode === "on_submit" && (
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1967d2" }} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#0f172a" }}>
                    แสดงผลหลังส่งแบบประเมิน
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                    ซ่อนผลลัพธ์ระหว่างกรอก แสดงเฉพาะหลังส่งแบบฟอร์มสำเร็จ
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sfb-modal-footer" style={{ marginTop: "24px" }}>
          <button
            className="sfb-btn-cancel"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "8px",
              background: "#1967d2",
              color: "white",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
              fontSize: "15px",
            }}
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishSettingsModal;
