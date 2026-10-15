import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const COLORS = {
  ต่ำ: "#22c55e",
  ปานกลาง: "#facc15",
  สูง: "#ef4444",
};

export default function PHQChart({ risk, score }) {
  const data = [
    { name: "ข้อ1", value: 2 },
    { name: "ข้อ2", value: 3 },
    { name: "ข้อ3", value: 2 },
    { name: "ข้อ4", value: 3 },
    { name: "ข้อ5", value: 1 },
    { name: "ข้อ6", value: 2 },
    { name: "ข้อ7", value: 2 },
    { name: "ข้อ8", value: 1 },
    { name: "ข้อ9", value: 0 },
  ];

  return (
    <div className="modal-section">
      <h4>ผล PHQ-9 Assessment</h4>

      <div className="score-box">
        <strong>{score}</strong>/27
        <span className={`risk-badge ${risk}`}>เสี่ยง{risk}</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill={COLORS[risk]} radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
