import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Charts of the student file. Loaded on demand (React.lazy) when the
// physical or mental health tab opens, so recharts stays out of the
// student list bundle.

export function GrowthChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 0, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--suth-line-soft)" />
        <XAxis
          dataKey="date"
          fontSize={12}
          tick={{ fill: "var(--suth-muted)" }}
        />
        <YAxis
          yAxisId="left"
          fontSize={12}
          tick={{ fill: "var(--suth-muted)" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          fontSize={12}
          tick={{ fill: "var(--suth-muted)" }}
        />
        <Tooltip
          itemStyle={{ color: "var(--suth-ink)" }}
          labelStyle={{ color: "var(--suth-ink)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => (
            <span style={{ color: "var(--suth-ink)" }}>{value}</span>
          )}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="BMI"
          stroke="var(--suth-accent)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="น้ำหนัก (กก.)"
          stroke="var(--suth-chart-blue)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="ส่วนสูง (ซม.)"
          stroke="var(--suth-success)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ScoreTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 0, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--suth-line-soft)" />
        <XAxis
          dataKey="date"
          fontSize={12}
          tick={{ fill: "var(--suth-muted)" }}
        />
        <YAxis
          fontSize={12}
          allowDecimals={false}
          tick={{ fill: "var(--suth-muted)" }}
        />
        <Tooltip
          itemStyle={{ color: "var(--suth-ink)" }}
          labelStyle={{ color: "var(--suth-ink)" }}
        />
        <Line
          type="monotone"
          dataKey="คะแนน"
          stroke="var(--suth-chart-purple)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
