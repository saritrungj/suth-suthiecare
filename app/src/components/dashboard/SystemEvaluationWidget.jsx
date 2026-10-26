import React, { useState, useEffect, useRef } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
} from "recharts";
import {
  FiMessageSquare,
  FiStar,
  FiBarChart2,
  FiActivity,
  FiList,
  FiChevronLeft,
  FiChevronRight,
  FiX,
} from "react-icons/fi";
import {
  getSystemEvaluationsStats,
  getSystemEvaluationsList,
} from "../../services/api";

export default function SystemEvaluationWidget() {
  const [stats, setStats] = useState({
    avg_ui: 0,
    avg_speed: 0,
    avg_content: 0,
    avg_access: 0,
    avg_overall: 0,
    avg_sus: 0,
    avg_sus1: 0,
    avg_sus2: 0,
    avg_sus3: 0,
    avg_sus4: 0,
    avg_sus5: 0,
    avg_sus6: 0,
    avg_sus7: 0,
    avg_sus8: 0,
    avg_sus9: 0,
    avg_sus10: 0,
    total_votes: 0,
    recent_comments: [],
  });
  const [isLoading, setIsLoading] = useState(true);

  // State สำหรับ Modal ตาราง Pagination
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listData, setListData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isListLoading, setIsListLoading] = useState(false);
  const viewAllRef = useRef(null);
  const closeRef = useRef(null);

  // Keyboard users land on the close button, leave with Escape and return to "ดูทั้งหมด".
  useEffect(() => {
    if (!isModalOpen) return undefined;
    const opener = viewAllRef.current;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsModalOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus();
    };
  }, [isModalOpen]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await getSystemEvaluationsStats();
        if (res.data) setStats(res.data);
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // ดึงข้อมูลตารางเมื่อเปิด Modal หรือเปลี่ยนหน้า
  useEffect(() => {
    if (isModalOpen) {
      const fetchList = async () => {
        setIsListLoading(true);
        try {
          const res = await getSystemEvaluationsList(currentPage, 10);
          if (res.data) {
            setListData(res.data.data);
            setTotalPages(res.data.totalPages);
          }
        } catch (error) {
          console.error("Error fetching list:", error);
        } finally {
          setIsListLoading(false);
        }
      };
      fetchList();
    }
  }, [isModalOpen, currentPage]);

  // 🟢 ข้อมูลสำหรับกราฟแท่ง Likert (แนวนอน)
  const likertData = [
    {
      name: "ภาพรวม",
      score: Number(stats.avg_overall).toFixed(2),
      fill: "var(--suth-danger)",
    },
    {
      name: "ใช้งานง่าย",
      score: Number(stats.avg_access).toFixed(2),
      fill: "var(--suth-chart-blue)",
    },
    {
      name: "เนื้อหา",
      score: Number(stats.avg_content).toFixed(2),
      fill: "var(--suth-chart-purple)",
    },
    {
      name: "ความรวดเร็ว",
      score: Number(stats.avg_speed).toFixed(2),
      fill: "var(--suth-chart-teal)",
    },
    {
      name: "ความสวยงาม",
      score: Number(stats.avg_ui).toFixed(2),
      fill: "var(--suth-action)",
    },
  ];

  // 🟢 สูตรแปลงคะแนน (Normalize) ให้อยู่ในสเกล 0-4
  const normalizeOdd = (val) => (val > 0 ? Number((val - 1).toFixed(1)) : 0);
  const normalizeEven = (val) => (val > 0 ? Number((5 - val).toFixed(1)) : 0);

  // 🟢 ข้อมูลสำหรับกราฟใยแมงมุม 10 แฉก (เฉพาะ SUS)
  const radarData = [
    { subject: "Q1 ใช้บ่อย", value: normalizeOdd(stats.avg_sus1), fullMark: 4 },
    {
      subject: "Q2 ไม่ซับซ้อน",
      value: normalizeEven(stats.avg_sus2),
      fullMark: 4,
    },
    {
      subject: "Q3 ใช้งานง่าย",
      value: normalizeOdd(stats.avg_sus3),
      fullMark: 4,
    },
    {
      subject: "Q4 พึ่งพาตนเองได้",
      value: normalizeEven(stats.avg_sus4),
      fullMark: 4,
    },
    {
      subject: "Q5 ระบบผสานดี",
      value: normalizeOdd(stats.avg_sus5),
      fullMark: 4,
    },
    {
      subject: "Q6 คงเส้นคงวา",
      value: normalizeEven(stats.avg_sus6),
      fullMark: 4,
    },
    {
      subject: "Q7 เรียนรู้เร็ว",
      value: normalizeOdd(stats.avg_sus7),
      fullMark: 4,
    },
    {
      subject: "Q8 ไม่ยุ่งยาก",
      value: normalizeEven(stats.avg_sus8),
      fullMark: 4,
    },
    { subject: "Q9 มั่นใจ", value: normalizeOdd(stats.avg_sus9), fullMark: 4 },
    {
      subject: "Q10 พร้อมใช้งาน",
      value: normalizeEven(stats.avg_sus10),
      fullMark: 4,
    },
  ];

  const getSusColor = (score) => {
    // Darker shades keep the SUS colour legible as text (WCAG AA).
    if (score >= 80) return "var(--suth-success)";
    if (score >= 68) return "var(--suth-info)";
    if (score >= 51) return "var(--suth-warning)";
    return "var(--suth-danger)";
  };

  const calculateLikertAvg = (item) => {
    return (
      (item.sat_ui +
        item.sat_speed +
        item.sat_content +
        item.sat_access +
        item.sat_overall) /
      5
    ).toFixed(1);
  };

  if (isLoading)
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        กำลังโหลดข้อมูลการประเมิน...
      </div>
    );

  return (
    <div
      style={{
        background: "var(--suth-surface)",
        borderRadius: "var(--suth-radius-panel)",
        padding: "24px",
        boxShadow: "0 4px 6px -1px rgba(31, 47, 63, 0.05)",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <h2
          style={{
            fontSize: "var(--suth-fs-title)",
            fontWeight: "700",
            color: "var(--suth-ink)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            margin: 0,
          }}
        >
          <FiStar color="var(--suth-action)" /> สรุปผลการประเมินระบบ
        </h2>
        <span
          style={{
            fontSize: "var(--suth-fs-sm)",
            color: "var(--suth-muted)",
            background: "var(--suth-surface-2)",
            border: "1px solid var(--suth-line)",
            padding: "6px 16px",
            borderRadius: "var(--suth-radius-card)",
            fontWeight: "600",
          }}
        >
          จำนวนผู้ประเมินทั้งหมด{" "}
          <span
            style={{ color: "var(--suth-info)", fontSize: "var(--suth-fs-md)" }}
          >
            {stats.total_votes}
          </span>{" "}
          คน
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "24px",
          minWidth: 0,
        }}
      >
        {/* 🟢 คอลัมน์ที่ 1: กราฟแท่ง Likert */}
        <div
          style={{
            border: "1px solid var(--suth-line)",
            borderRadius: "var(--suth-radius)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <h3
            style={{
              fontSize: "var(--suth-fs-md)",
              fontWeight: "700",
              color: "var(--suth-ink-2)",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FiBarChart2 color="var(--suth-chart-purple)" /> ความพึงพอใจ 5 ด้าน
          </h3>
          <div
            style={{
              width: "100%",
              minWidth: 0,
              height: "240px",
              marginTop: "10px",
            }}
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={likertData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--suth-line-soft)"
                />
                <XAxis
                  type="number"
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                  tick={{ fill: "var(--suth-muted)", fontSize: 12 }}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  tick={{
                    fill: "var(--suth-ink-2)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                />
                <Tooltip
                  cursor={{ fill: "var(--suth-control-line)" }}
                  formatter={(value) => [`${value} / 5.0`, "คะแนนเฉลี่ย"]}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={22}>
                  {likertData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🟢 คอลัมน์ที่ 2: คะแนน SUS และ กราฟใยแมงมุม */}
        <div
          style={{
            border: "1px solid var(--suth-line)",
            borderRadius: "var(--suth-radius)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            minWidth: 0,
          }}
        >
          <h3
            style={{
              fontSize: "var(--suth-fs-md)",
              fontWeight: "700",
              color: "var(--suth-ink-2)",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              alignSelf: "flex-start",
            }}
          >
            <FiActivity color={getSusColor(stats.avg_sus)} />{" "}
            ความสามารถในการใช้งาน (SUS)
          </h3>
          <div style={{ textAlign: "center", zIndex: 2 }}>
            <div
              className="ui-modal__header"
              style={{
                fontSize: "var(--suth-fs-display)",
                fontWeight: "800",
                color: getSusColor(stats.avg_sus),
                lineHeight: "1.2",
              }}
            >
              {Number(stats.avg_sus).toFixed(1)}{" "}
              <span
                style={{
                  fontSize: "var(--suth-fs-sm)",
                  color: "var(--suth-muted)",
                }}
              >
                / 100
              </span>
            </div>
          </div>
          <div
            style={{
              width: "100%",
              minWidth: 0,
              height: "220px",
              marginTop: "-15px",
            }}
          >
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart cx="50%" cy="50%" outerRadius="60%" data={radarData}>
                <PolarGrid stroke="var(--suth-line-soft)" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{
                    fill: "var(--suth-ink-2)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 4]}
                  tick={{ fontSize: 10, fill: "var(--suth-muted)" }}
                />
                <Radar
                  name="คะแนนแปลงสเกล (เต็ม 4)"
                  dataKey="value"
                  stroke="var(--suth-chart-purple)"
                  fill="var(--suth-chart-purple)"
                  fillOpacity={0.4}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 🟢 คอลัมน์ที่ 3: ฟีดข้อเสนอแนะล่าสุด + ปุ่มดูทั้งหมด */}
        <div
          style={{
            border: "1px solid var(--suth-line)",
            borderRadius: "var(--suth-radius)",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
            }}
          >
            <h3
              style={{
                fontSize: "var(--suth-fs-md)",
                fontWeight: "700",
                color: "var(--suth-ink-2)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                margin: 0,
              }}
            >
              <FiMessageSquare color="var(--suth-info)" /> ข้อเสนอแนะล่าสุด
            </h3>
            <button
              ref={viewAllRef}
              onClick={() => setIsModalOpen(true)}
              style={{
                background: "none",
                border: "none",
                color: "var(--suth-info)",
                fontSize: "var(--suth-fs-label)",
                cursor: "pointer",
                fontWeight: "600",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              ดูทั้งหมด <FiList />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              maxHeight: "230px",
              paddingRight: "8px",
            }}
          >
            {stats.recent_comments.length > 0 ? (
              stats.recent_comments.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: "var(--suth-surface-2)",
                    padding: "12px",
                    borderRadius: "var(--suth-radius)",
                    marginBottom: "10px",
                    borderLeft: "1px solid var(--suth-line)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "var(--suth-fs-sm)",
                      color: "var(--suth-ink-2)",
                      fontStyle: "italic",
                      lineHeight: "1.5",
                    }}
                  >
                    "{item.suggestions}"
                  </div>
                  <div
                    style={{
                      fontSize: "var(--suth-fs-caption)",
                      color: "var(--suth-muted)",
                      marginTop: "8px",
                      textAlign: "right",
                    }}
                  >
                    {new Date(item.created_at).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  textAlign: "center",
                  color: "var(--suth-muted)",
                  marginTop: "60px",
                }}
              >
                ยังไม่มีข้อเสนอแนะในขณะนี้
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🟢 Modal ตารางแสดงข้อมูลการประเมินทั้งหมด */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(31, 47, 63, 0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: "var(--z-modal)",
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-evaluation-modal-title"
            style={{
              background: "var(--suth-surface)",
              width: "90%",
              maxWidth: "1000px",
              borderRadius: "var(--suth-radius-panel)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              maxHeight: "90vh",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                id="system-evaluation-modal-title"
                style={{
                  margin: 0,
                  fontSize: "var(--suth-fs-title)",
                  color: "var(--suth-ink)",
                }}
              >
                รายการการประเมินทั้งหมด
              </h2>
              <button
                ref={closeRef}
                className="ui-modal__close"
                onClick={() => setIsModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "var(--suth-fs-hero)",
                  color: "var(--suth-muted)",
                  cursor: "pointer",
                }}
              >
                <FiX />
              </button>
            </div>

            <div
              className="ui-modal__body"
              tabIndex={0}
              role="region"
              aria-label="ตารางผลการประเมินระบบ"
              style={{ overflowX: "auto", flex: 1 }}
            >
              {isListLoading ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "var(--suth-muted)",
                  }}
                >
                  กำลังโหลดข้อมูล...
                </div>
              ) : (
                <table
                  className="admin-data-table"
                  aria-label="ข้อมูลผลการประเมินระบบ"
                >
                  <thead>
                    <tr>
                      <th>วันที่ประเมิน</th>
                      <th>พึงพอใจเฉลี่ย (Likert)</th>
                      <th>คะแนน SUS</th>
                      <th>ข้อเสนอแนะ / ความคิดเห็น</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listData.length > 0 ? (
                      listData.map((item) => (
                        <tr key={item.id}>
                          <td
                            style={{
                              padding: "12px",
                              whiteSpace: "nowrap",
                              color: "var(--suth-muted)",
                            }}
                          >
                            {new Date(item.created_at).toLocaleString("th-TH", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              fontWeight: "600",
                              color: "var(--suth-action-ink)",
                            }}
                          >
                            {calculateLikertAvg(item)}{" "}
                            <span
                              style={{
                                color: "var(--suth-muted)",
                                fontSize: "var(--suth-fs-caption)",
                              }}
                            >
                              / 5.0
                            </span>
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              fontWeight: "600",
                              color: getSusColor(item.sus_total_score),
                            }}
                          >
                            {Number(item.sus_total_score).toFixed(1)}
                          </td>
                          <td
                            style={{
                              padding: "12px",
                              color: "var(--suth-ink-2)",
                            }}
                          >
                            {item.suggestions ? (
                              `"${item.suggestions}"`
                            ) : (
                              <span style={{ color: "var(--suth-muted)" }}>
                                - ไม่มีข้อเสนอแนะ -
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan="4"
                          style={{
                            textAlign: "center",
                            padding: "30px",
                            color: "var(--suth-muted)",
                          }}
                        >
                          ไม่พบข้อมูล
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
                gap: "16px",
                marginTop: "20px",
                borderTop: "1px solid var(--suth-line)",
                paddingTop: "16px",
              }}
            >
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 16px",
                  borderRadius: "var(--suth-radius)",
                  border: "1px solid var(--suth-control-line)",
                  background:
                    currentPage === 1
                      ? "var(--suth-surface-2)"
                      : "var(--suth-surface)",
                  color:
                    currentPage === 1
                      ? "var(--suth-muted)"
                      : "var(--suth-ink-2)",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                }}
              >
                <FiChevronLeft /> ก่อนหน้า
              </button>
              <span
                style={{
                  fontSize: "var(--suth-fs-sm)",
                  color: "var(--suth-ink-2)",
                  fontWeight: "500",
                }}
              >
                หน้า {currentPage} จาก {totalPages || 1}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages || totalPages === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "8px 16px",
                  borderRadius: "var(--suth-radius)",
                  border: "1px solid var(--suth-control-line)",
                  background:
                    currentPage === totalPages || totalPages === 0
                      ? "var(--suth-surface-2)"
                      : "var(--suth-surface)",
                  color:
                    currentPage === totalPages || totalPages === 0
                      ? "var(--suth-muted)"
                      : "var(--suth-ink-2)",
                  cursor:
                    currentPage === totalPages || totalPages === 0
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                ถัดไป <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
