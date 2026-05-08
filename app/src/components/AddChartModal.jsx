import React, { useState, useEffect } from 'react';
import './AddChartModal.css';
import { createPortal } from "react-dom";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { getFormQuestions, getChartData } from "../services/api";

// ฟังก์ชันสร้างเส้นชี้และ Label เปอร์เซ็นต์ 
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.03) return null;

  const RADIAN = Math.PI / 180;

  const outerEdgeRadius = outerRadius + 8;
  const labelRadius = outerRadius + 20;

  const sx = cx + outerRadius * Math.cos(-midAngle * RADIAN);
  const sy = cy + outerRadius * Math.sin(-midAngle * RADIAN);
  const ex = cx + outerEdgeRadius * Math.cos(-midAngle * RADIAN);
  const ey = cy + outerEdgeRadius * Math.sin(-midAngle * RADIAN);
  const lx = cx + labelRadius * Math.cos(-midAngle * RADIAN);
  const ly = cy + labelRadius * Math.sin(-midAngle * RADIAN);

  const textAnchor = lx > cx ? 'start' : 'end';

  return (
    <g>
      <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#94a3b8" strokeWidth={1} />
      {/* จุดกลม */}
      <circle cx={ex} cy={ey} r={2} fill="#94a3b8" />
      {/* ตัวเลข % */}
      <text
        x={lx}
        y={ly}
        textAnchor={textAnchor}
        dominantBaseline="central"
        style={{ fontSize: '11px', fontWeight: '700', fill: '#374151' }}
      >
        {`${Math.round(percent * 100)}%`}
      </text>
    </g>
  );
};

const COLORS = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF8FAB",
  "#C77DFF", "#00C2A8", "#FFA94D", "#A0E7E5", "#B4F8C8",
  "#FBE7C6", "#FFAEBC", "#A0C4FF", "#BDB2FF", "#FFC6FF",
  "#9BF6FF", "#CAFFBF", "#FDFFB6", "#FFD6A5", "#E4C1F9"
];

const AddChartModal = ({ isOpen, onClose, onSave, formId }) => {
  const [chartName, setChartName] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [questions, setQuestions] = useState([])
  const [chartType, setChartType] = useState('pie');
  const [chartData, setChartData] = useState([]);

  
  // Logic ประมวลผลข้อมูล: ใช้ item.result ที่ได้จาก Backend เป็นหลักเพื่อความแม่นยำ
  const processedPieData = React.useMemo(() => {
    if (!chartData || chartData.length === 0) return [];

    // 🟢 ค้นหาเกณฑ์คะแนนของคำถามที่เลือก
    const selectedQDetails = questions.find(q => String(q.id) === String(selectedQuestion));
    const scoringRules = selectedQDetails?.scoringRules || [];

    const counts = {};
    chartData.forEach((item) => {
      let resultText = "";

      // 🟢 1. ตรวจสอบหาผลสรุปคะแนนจากฟิลด์ "result" ที่ Backend ส่งมาตรงๆ ก่อนเลย
      if (item.result) {
        resultText = item.result;
      }
      // 🟢 2. หากไม่มีใน result ให้ลองหาใน summary_data เผื่อไว้
      else if (item.summary_data) {
        try {
          const summary = typeof item.summary_data === 'string' 
            ? JSON.parse(item.summary_data) 
            : item.summary_data;

          if (summary.score_results && Array.isArray(summary.score_results)) {
            const sr = summary.score_results.find(s => 
              String(s.question_id) === String(selectedQuestion) ||
              String(s.id) === String(selectedQuestion) ||
              String(s.questionId) === String(selectedQuestion)
            );
            if (sr && sr.label) resultText = sr.label;
          }

          if (!resultText) {
            resultText = summary[`${selectedQuestion}_label`] || summary[`${selectedQuestion}_result`] || "";
          }

          if (!resultText) {
            if (selectedQuestion === "food_1774859637605") resultText = summary.food_result_text;
            else if (selectedQuestion === "exercise_1774859637605") resultText = summary.exercise_result_text;
            else if (selectedQuestion === "emotion_1774859637605") resultText = summary.emotion_result_text;
          }
        } catch (e) {
          
        }
      }

      // 🟢 3. กรณีไม่มีคะแนนสรุปจริงๆ ให้ดึงจากคำตอบดิบ
      if (!resultText) {
        let rawName = item.name;
        if (typeof rawName === 'string' && rawName.trim().startsWith('{')) {
          try { rawName = JSON.parse(rawName); } catch(e){}
        }

        if (typeof rawName === "object" && rawName !== null) {
          Object.values(rawName).forEach(val => {
            if (val) {
              const cleanVal = String(val).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
              counts[cleanVal] = (counts[cleanVal] || 0) + 1;
            }
          });
          return;
        } else if (rawName) {
          resultText = String(rawName).replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
        }
      }

      // 🟢 4. บันทึกผลลง counts
      if (resultText && resultText !== "-" && !resultText.includes("รอผลสรุปคะแนน")) {
        counts[resultText] = (counts[resultText] || 0) + (Number(item.value || 1));
      }
    });

    // 🟢 5. ใส่สีตามเกณฑ์
    return Object.keys(counts).map((k, index) => {
      const matchedRule = scoringRules.find(r => r.label === k);
      return {
        name: k,
        value: counts[k],
        color: matchedRule?.color || COLORS[index % COLORS.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [chartData, selectedQuestion, questions]);

  useEffect(() => {
    if (!formId) {
      setQuestions([]);
      return;
    }

    const fetchQuestions = async () => {
      try {
        const res = await getFormQuestions(formId);

        const questionsData =
          res.data?.data ||
          res.data?.questions ||
          res.data ||
          [];

        const choiceQuestions = questionsData.filter(q =>
          q.type === "multiple_choice" ||
          q.type === "checkboxes" ||
          q.type === "dropdown" ||
          q.type === "faculty" ||
          q.type === "user_status" ||
          q.type === "grid_multiple" ||
          q.type === "grid_checkbox"
        );

        setQuestions(choiceQuestions);

      } catch (err) {
        
        setQuestions([]);
      }
    };
    fetchQuestions();

  }, [formId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setChartName("");
      setSelectedQuestion("");
      setChartType("pie");
    }
  }, [isOpen]);

  useEffect(() => {
    const loadPreviewChart = async () => {
      if (!selectedQuestion || !formId) {
        setChartData([]);
        return;
      }

      try {
        const res = await getChartData(
          formId,
          selectedQuestion,
          null,
          null
        );
        const data = Array.isArray(res.data) ? res.data : res.data.data;

        setChartData(data || []);
      } catch (err) {
        
        setChartData([]);
      }
    };

    loadPreviewChart();
  }, [selectedQuestion, formId]);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isOpen]);

  // ไม่เปิด = ไม่ render
  if (!isOpen) return null;

  const handleSave = () => {
    if (!chartName || !selectedQuestion || !chartType) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    onSave({
      id: Date.now().toString(),
      title: chartName,
      question: selectedQuestion,
      type: chartType,
    });

    // reset ค่า
    setChartName('');
    setSelectedQuestion('');
    setChartType('pie');
    onClose();
  };


  return createPortal(
    <div className="modal-overlay">

      <div className="modal-content">

        {/* Header */}
        <div className="modal-header">
          <h2 className="text-2xl font-bold text-[#2d7d81]">เพิ่มกราฟ</h2>

          <button
            onClick={onClose}
            className="text-orange-500 hover:text-orange-600"
          >
            <svg
              className="w-8 h-8"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="modal-body">

          {/* Left Side */}
          <div className="space-y-6">

            <div className="form-group">
              <label>ชื่อกราฟ</label>
              <input
                type="text"
                className="form-control"
                placeholder="เช่น สรุปผล PHQ-9"
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>เลือกคำถามในแบบฟอร์ม</label>
              <select
                className="form-control"
                value={selectedQuestion}
                onChange={(e) => {
                  const questionId = e.target.value;
                  setSelectedQuestion(questionId);

                  const q = questions.find(q => q.id.toString() === questionId);

                  if (q) {
                    const text =
                      q.question_text ||
                      q.label ||
                      q.title ||
                      "";

                    const cleanTitle = text
                      .replace(/<[^>]*>/g, "")
                      .replace(/&nbsp;/g, " ")
                      .trim();

                    setChartName(cleanTitle);
                  }
                }}
              >
                <option value="">เลือกคำถาม...</option>

                {questions.map((q) => {
                  const text =
                    q.question_text ||
                    q.label ||
                    q.title ||
                    "";
                  const cleanTitle = text
                    .replace(/<[^>]*>/g, "")
                    .replace(/&nbsp;/g, " ")
                    .trim();

                  return (
                    <option key={q.id} value={q.id}>
                      {cleanTitle}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="form-group">
              <label>รูปแบบกราฟ</label>
              <select
                className="form-control"
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
              >
                <option value="pie">กราฟวงกลม (Pie Chart)</option>
                <option value="bar">กราฟแท่ง (Bar Chart)</option>
              </select>
            </div>

          </div>

          {/* ⭐⭐⭐ เพิ่มตรงนี้ ⭐⭐⭐ */}
          <div className="modal-divider"></div>

          {/* Right Side Preview */}
          <div className="preview-section">
            <h3 className="text-xl font-bold text-gray-700 mb-4">
              ตัวอย่างกราฟ
            </h3>

            <div className="preview-box">

              {!selectedQuestion && (
                <p className="text-gray-400">เลือกคำถามเพื่อดูตัวอย่างกราฟ</p>
              )}
              {/* --- ส่วนการแสดงผล Pie Chart --- */}
              {selectedQuestion && chartType?.toLowerCase() === "pie" && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "100%", height: "300px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, right: 35, bottom: 0, left: 35 }}>
                        <Pie
                          data={processedPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius="65%"
                          label={renderCustomizedLabel}
                          labelLine={false}
                        >
                          {processedPieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value} คน`, name]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* 🟢 ปรับป้ายคำอธิบายด้านล่างให้เป็นสีเทาอ่อน (Badges) เหมือน Dashboard */}
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "10px",
                    marginTop: "20px",
                    width: "100%",
                    padding: "0 10px"
                  }}>
                    {processedPieData.map((item, index) => (
                      <div key={index} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        background: '#f1f5f9', // 🟢 พื้นหลังสีเทาอ่อน
                        padding: '5px 12px',
                        borderRadius: '20px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {/* จุดสีวงกลม */}
                        <div style={{
                          width: "8px",
                          height: "8px",
                          background: item.color,
                          borderRadius: "50%"
                        }} />
                        <span style={{ color: "#475569", fontWeight: "500" }}>
                          {item.name}: <strong style={{ color: "#1e293b" }}>{item.value} คน</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- ส่วนการแสดงผล Bar Chart ---*/}
              {selectedQuestion && chartType?.toLowerCase() === "bar" && (
                <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: "100%", height: "280px" }}> {/* เพิ่มความสูงเล็กน้อยเพื่อให้มีพื้นที่สำหรับตัวเลขหัวแท่ง */}
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={processedPieData} margin={{ top: 25, right: 30, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />

                        <XAxis
                          dataKey="name"
                          hide={true}
                        />

                        <YAxis
                          allowDecimals={false}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 12, fill: '#1e293b', fontWeight: '500' }}
                        />

                        <Tooltip cursor={{ fill: '#f1f5f9' }} />

                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={65}>
                          {processedPieData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}

                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* สรุปรายการคำอธิบาย */}
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: "10px",
                    marginTop: "15px",
                    width: "100%",
                    padding: "0 10px"
                  }}>
                    {processedPieData.map((item, index) => (
                      <div key={index} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", background: 'transparent', padding: '4px 12px', borderRadius: '15px', border: 'none' }}>
                        <div style={{ width: "8px", height: "8px", background: item.color, borderRadius: "50%" }} />
                        <span style={{ color: "#475569" }}>{item.name}: <strong>{item.value} คน</strong></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
        {/* Footer */}
        < div className="modal-footer" >
          <button onClick={onClose} className="btn-secondary">
            ยกเลิก
          </button>

          <button onClick={handleSave}>
            บันทึก
          </button>
        </div >

      </div >
    </div >,
    document.body
  );
};

export default AddChartModal;