import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// One measure per chart (small multiples, never two y-axes). Loaded on demand
// so recharts stays out of the member page bundle until a student opens it.
export default function SchoolHealthTrend({ data, unit, label }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ top: 8, right: 12, bottom: 0, left: -8 }}
      >
        <CartesianGrid vertical={false} stroke="var(--suth-line-soft)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={{ stroke: "var(--suth-line)" }}
          tick={{ fill: "var(--suth-muted)", fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={16}
        />
        <YAxis
          width={40}
          tickLine={false}
          axisLine={false}
          domain={["auto", "auto"]}
          tick={{ fill: "var(--suth-muted)", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ stroke: "var(--suth-control-line)", strokeWidth: 1 }}
          formatter={(value) => [`${value} ${unit}`.trim(), label]}
          contentStyle={{
            border: "1px solid var(--suth-line)",
            borderRadius: 12,
            boxShadow: "var(--suth-shadow-pop)",
          }}
          itemStyle={{ color: "var(--suth-ink)" }}
          labelStyle={{ color: "var(--suth-muted)" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={label}
          stroke="var(--suth-action-ink)"
          strokeWidth={2}
          dot={{
            r: 4,
            strokeWidth: 2,
            stroke: "var(--suth-surface)",
            fill: "var(--suth-action-ink)",
          }}
          activeDot={{ r: 6, strokeWidth: 2, stroke: "var(--suth-surface)" }}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
