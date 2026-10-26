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

// Scores of several assessment forms in one chart, one line per form. Each
// series is { key, name, color, points: [{ t, score }] } with `t` a time in
// ms, so results of different forms on different days share one time axis.
const thaiDay = (t) =>
  new Date(t).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
export function ScoreTrendChart({ series }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart margin={{ left: 0, right: 16, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--suth-line-soft)" />
        <XAxis
          type="number"
          dataKey="t"
          scale="time"
          domain={["dataMin", "dataMax"]}
          padding={{ left: 16, right: 16 }}
          tickFormatter={thaiDay}
          fontSize={12}
          tick={{ fill: "var(--suth-muted)" }}
          allowDuplicatedCategory={false}
        />
        <YAxis
          fontSize={12}
          allowDecimals={false}
          tick={{ fill: "var(--suth-muted)" }}
        />
        <Tooltip
          labelFormatter={(t) => thaiDay(t)}
          itemStyle={{ color: "var(--suth-ink)" }}
          labelStyle={{ color: "var(--suth-ink)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            data={s.points}
            dataKey="score"
            name={s.name}
            type="monotone"
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4, fill: s.color }}
            activeDot={{ r: 6 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
