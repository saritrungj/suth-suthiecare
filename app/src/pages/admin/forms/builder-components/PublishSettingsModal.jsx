import SearchableSelect from "../../../../components/SearchableSelect";
import { toDisplayText } from "../../../../utils/textPresentation.js";
import MasterSelect from "../../../../components/MasterSelect";
import React, { useState, useEffect } from "react";
import {
  FaCog,
  FaTimes,
  FaFileAlt,
  FaSyncAlt,
  FaChevronDown,
} from "react-icons/fa";
import { getActiveClinics } from "../../../../services/api";
import { usePermissions } from "../../../../permissions/PermissionsProvider";
import ThaiDatePicker from "../../../../components/ThaiDatePicker";

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
  healthDomain = "",
  setHealthDomain = () => {},
  resultDisplayMode,
  setResultDisplayMode,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [clinics, setClinics] = useState([]);
  const { activeOrganization, activeOrganizationType } = usePermissions();
  // School forms are sorted by health domain, hospital forms by clinic; the
  // all-organizations view keeps both.
  const showClinic =
    activeOrganization === "all" || activeOrganizationType !== "school";
  const showHealthDomain =
    activeOrganization === "all" || activeOrganizationType === "school";

  useEffect(() => {
    getActiveClinics()
      .then((res) => setClinics(res.data.data || []))
      .catch((err) => console.error("Failed to load clinics", err));
  }, []);

  if (!isOpen) return null;

  return (
    <div className="sfb-modal-overlay" role="presentation">
      <div
        className="sfb-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label="ตั้งค่าการเผยแพร่แบบประเมิน"
        style={{
          position: "relative",
          maxWidth: "500px",
          padding: "24px",
          background: "var(--suth-surface)",
          borderRadius: "var(--suth-radius)",
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
            fontSize: "var(--suth-fs-section)",
            color: "var(--suth-muted)",
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
            color: "var(--suth-ink)",
          }}
        >
          <FaCog color="var(--suth-muted)" /> ตั้งค่าฟอร์มและการเผยแพร่
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
              background: "var(--suth-surface-2)",
              padding: "16px",
              borderRadius: "var(--suth-radius)",
              border: "1px solid var(--suth-line)",
            }}
          >
            <label
              style={{
                fontWeight: "bold",
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
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
                  borderRadius: "var(--suth-radius)",
                  border: "1px solid var(--suth-control-line)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  background: "var(--suth-surface)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <div
                    style={{
                      background:
                        formType === "Registration" ? "var(--suth-info-tint)" : "var(--suth-success-tint)",
                      padding: "6px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {formType === "Registration" ? (
                      <FaFileAlt color="var(--suth-info)" size={14} />
                    ) : (
                      <FaSyncAlt color="var(--suth-success)" size={14} />
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
                    background: "var(--suth-surface)",
                    border: "1px solid var(--suth-control-line)",
                    borderRadius: "var(--suth-radius)",
                    zIndex: "var(--z-dropdown)",
                    boxShadow: "0 4px 12px rgba(31, 47, 63, 0.1)",
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
                        background: "var(--suth-info-tint)",
                        padding: "6px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FaFileAlt color="var(--suth-info)" size={14} />
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
                        background: "var(--suth-success-tint)",
                        padding: "6px",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <FaSyncAlt color="var(--suth-success)" size={14} />
                    </div>
                    แบบประเมินติดตามผล
                  </div>
                </div>
              )}
            </div>
            <p
              style={{
                fontSize: "var(--suth-fs-caption)",
                color: "var(--suth-muted)",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              * ฟอร์มลงทะเบียนจะสร้างเคสใหม่เสมอ
              ส่วนฟอร์มติดตามผลจะเชื่อมกับเคสเดิม
            </p>
          </div>

          {/* 2. เลือกคลินิก */}
          <div
            hidden={!showClinic}
            style={{
              display: showClinic ? "flex" : "none",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label
              style={{
                fontWeight: "bold",
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
              }}
            >
              ประเภทคลินิก
            </label>
            <SearchableSelect
              value={clinicType}
              onChange={(e) => setClinicType(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "var(--suth-radius)",
                border: "1px solid var(--suth-control-line)",
                fontSize: "var(--suth-fs-sm)",
                outline: "none",
              }}
            >
              <option value="general">ทั่วไป (ใช้ร่วมกัน)</option>
              {clinics.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </SearchableSelect>
          </div>

          {/* หมวดสุขภาพ: ใช้แยกผลในแฟ้มนักเรียน (สุขภาพจิต / สุขภาพกาย) */}
          <div
            hidden={!showHealthDomain}
            style={{
              display: showHealthDomain ? "flex" : "none",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <label
              htmlFor="form-health-domain"
              style={{
                fontWeight: "bold",
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
              }}
            >
              หมวดสุขภาพ
            </label>
            <SearchableSelect
              id="form-health-domain"
              value={healthDomain}
              onChange={(e) => setHealthDomain(e.target.value)}
              style={{
                padding: "10px",
                borderRadius: "var(--suth-radius)",
                border: "1px solid var(--suth-control-line)",
                fontSize: "var(--suth-fs-sm)",
                outline: "none",
              }}
            >
              <option value="">ไม่ระบุ</option>
              <option value="mental">สุขภาพจิต</option>
              <option value="physical">สุขภาพกาย</option>
              <option value="general">สุขภาพทั่วไป</option>
            </SearchableSelect>
            <small style={{ color: "var(--suth-muted)", fontSize: "var(--suth-fs-caption)" }}>
              ใช้แยกผลแบบประเมินในแฟ้มสุขภาพนักเรียน (หน่วยงานโรงเรียน)
            </small>
          </div>

          {/* 3. สถานะฟอร์ม */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                fontWeight: "bold",
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
              }}
            >
              สถานะฟอร์มปัจจุบัน
            </label>
            <MasterSelect
              style={{
                minHeight: "44px",
                padding: "10px 12px",
                border: "1px solid var(--suth-control-line)",
                borderRadius: "var(--suth-radius)",
                font: "inherit",
              }}
              category="publication_status"
              allowedCodes={["draft", "published"]}
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value)}
              fallback={[
                { code: "draft", label: "แบบร่าง" },
                { code: "published", label: "เผยแพร่ (พร้อมใช้งาน)" },
              ]}
            />
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
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
              }}
            >
              <input
                type="checkbox"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                style={{
                  width: "16px",
                  height: "16px",
                  accentColor: "var(--suth-action)",
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
                  borderLeft: "1px solid var(--suth-line)",
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
                  <label
                    style={{ fontSize: "var(--suth-fs-label)", color: "var(--suth-ink-2)" }}
                  >
                    เริ่มเปิดรับข้อมูลตั้งแต่เวลา:
                  </label>
                  <ThaiDatePicker
                    label="เวลาเริ่มเปิดรับข้อมูล"
                    withTime
                    value={publishStartDate}
                    onChange={setPublishStartDate}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <label
                    style={{ fontSize: "var(--suth-fs-label)", color: "var(--suth-ink-2)" }}
                  >
                    ปิดรับข้อมูลอัตโนมัติเมื่อถึงเวลา:
                  </label>
                  <ThaiDatePicker
                    label="เวลาปิดรับข้อมูล"
                    withTime
                    value={publishEndDate}
                    onChange={setPublishEndDate}
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
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
              }}
            >
              การเข้าถึงแบบประเมิน
            </label>
            {[
              {
                value: "none",
                label: "เปิดให้เข้าถึงได้เลย",
                desc: "ไม่ต้องเข้าสู่ระบบ ผู้ใช้ทำแบบประเมินได้ทันที",
                color: "var(--suth-success)",
                bgColor: "var(--suth-success-tint)",
              },
              {
                value: "optional",
                label: "แนะนำให้เข้าสู่ระบบ",
                desc: "แสดงข้อความแจ้งให้เข้าสู่ระบบ แต่ยังสามารถทดลองทำได้",
                color: "var(--suth-warning)",
                bgColor: "var(--suth-warning-tint)",
              },
              {
                value: "strict",
                label: "บังคับเข้าสู่ระบบ",
                desc: "ต้องเข้าสู่ระบบก่อนจึงจะดูและทำแบบประเมินได้",
                color: "var(--suth-danger)",
                bgColor: "var(--suth-danger-tint)",
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
                  borderRadius: "var(--suth-radius-sm)",
                  border: `2px solid ${loginEnforcement === opt.value ? opt.color : "var(--suth-line)"}`,
                  background:
                    loginEnforcement === opt.value ? opt.bgColor : "var(--suth-surface)",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    border: `2px solid ${loginEnforcement === opt.value ? opt.color : "var(--suth-control-line)"}`,
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
                      fontSize: "var(--suth-fs-sm)",
                      color: "var(--suth-ink)",
                    }}
                  >
                    {toDisplayText(opt.label)}
                  </div>
                  <div
                    style={{
                      fontSize: "var(--suth-fs-caption)",
                      color: "var(--suth-muted)",
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
              background: "var(--suth-surface-2)",
              padding: "16px",
              borderRadius: "var(--suth-radius)",
              border: "1px solid var(--suth-line)",
            }}
          >
            <label
              style={{
                fontWeight: "bold",
                fontSize: "var(--suth-fs-sm)",
                color: "var(--suth-ink)",
              }}
            >
              โหมดการแสดงผลลัพธ์แบบประเมิน
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              <div
                onClick={() => setResultDisplayMode("realtime")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: "10px 12px",
                  borderRadius: "var(--suth-radius-sm)",
                  border: `2px solid ${resultDisplayMode === "realtime" ? "var(--suth-action)" : "var(--suth-line)"}`,
                  background:
                    resultDisplayMode === "realtime" ? "var(--suth-tint)" : "var(--suth-surface)",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `2px solid ${resultDisplayMode === "realtime" ? "var(--suth-action)" : "var(--suth-control-line)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {resultDisplayMode === "realtime" && (
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "var(--suth-action)",
                      }}
                    />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "var(--suth-fs-sm)",
                      color: "var(--suth-ink)",
                    }}
                  >
                    แสดงผลแบบเรียลไทม์
                  </div>
                  <div
                    style={{
                      fontSize: "var(--suth-fs-caption)",
                      color: "var(--suth-muted)",
                      marginTop: "2px",
                    }}
                  >
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
                  borderRadius: "var(--suth-radius-sm)",
                  border: `2px solid ${resultDisplayMode === "on_submit" ? "var(--suth-action)" : "var(--suth-line)"}`,
                  background:
                    resultDisplayMode === "on_submit" ? "var(--suth-tint)" : "var(--suth-surface)",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `2px solid ${resultDisplayMode === "on_submit" ? "var(--suth-action)" : "var(--suth-control-line)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {resultDisplayMode === "on_submit" && (
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "var(--suth-action)",
                      }}
                    />
                  )}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: "600",
                      fontSize: "var(--suth-fs-sm)",
                      color: "var(--suth-ink)",
                    }}
                  >
                    แสดงผลหลังส่งแบบประเมิน
                  </div>
                  <div
                    style={{
                      fontSize: "var(--suth-fs-caption)",
                      color: "var(--suth-muted)",
                      marginTop: "2px",
                    }}
                  >
                    ซ่อนผลลัพธ์ระหว่างกรอก แสดงเฉพาะหลังส่งแบบฟอร์มสำเร็จ
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sfb-modal-footer" style={{ marginTop: "24px" }}>
          <button
            className="sfb-btn-cancel sfb-btn-primary"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "var(--suth-radius)",
              background: "var(--suth-action)",
              color: "var(--suth-on-action)",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
              fontSize: "var(--suth-fs-body)",
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
