import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
export default function FormChartView({
  data,
  type = "bar",
  title = "กราฟ",
  aggregation = "count",
}) {
  if (!data.length)
    return <p className="fc-empty">ไม่มีข้อมูลตามเงื่อนไขที่เลือก</p>;
  const tooltipStyle = {
    borderRadius: 14,
    border: "1px solid var(--suth-line)",
    background: "var(--suth-surface)",
    color: "var(--suth-ink)",
    boxShadow: "0 8px 24px rgba(31,47,63,.1)",
    padding: "12px 16px",
  };
  const numeric = aggregation !== "count";
  const format = (n) =>
    Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
  return (
    <div className="fc-visual" aria-label={title}>
      {type !== "table" && (
        <div className="fc-canvas">
          <ResponsiveContainer width="100%" height="100%">
            {["pie", "donut"].includes(type) ? (
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={type === "donut" ? "48%" : 0}
                  outerRadius="78%"
                  cornerRadius={8}
                  paddingAngle={data.length > 1 ? 3 : 0}
                  stroke="var(--suth-surface)"
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={format}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--suth-chart-hover)" }}
                />
              </PieChart>
            ) : type === "line" ? (
              <LineChart
                data={data}
                margin={{ top: 16, right: 24, left: 0, bottom: 30 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--suth-line-soft)"
                />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={numeric} />
                <Tooltip
                  formatter={format}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--suth-chart-hover)" }}
                />
                <Line
                  type="linear"
                  dataKey="value"
                  name="ค่า"
                  stroke="var(--suth-chart-apricot)"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  dot={{ r: 4, fill: "var(--suth-surface)", strokeWidth: 2 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                />
              </LineChart>
            ) : (
              <BarChart
                data={data}
                layout={type === "horizontal" ? "vertical" : "horizontal"}
                margin={{
                  top: 16,
                  right: 24,
                  left: type === "horizontal" ? 30 : 0,
                  bottom: 30,
                }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--suth-line-soft)"
                />
                <XAxis
                  type={type === "horizontal" ? "number" : "category"}
                  dataKey={type === "horizontal" ? undefined : "name"}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type={type === "horizontal" ? "category" : "number"}
                  dataKey={type === "horizontal" ? "name" : undefined}
                  allowDecimals={numeric}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={format}
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "var(--suth-chart-hover)" }}
                />
                <Bar
                  dataKey="value"
                  name="ค่า"
                  maxBarSize={36}
                  radius={type === "horizontal" ? [6, 10, 10, 6] : [9, 9, 5, 5]}
                  isAnimationActive={false}
                >
                  {data.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
      {["pie", "donut"].includes(type) && (
        <ul className="fc-legend" aria-label="คำอธิบายกราฟ">
          {data.map((d) => (
            <li key={d.name}>
              <i style={{ background: d.color }} />
              <span>{d.name}</span>
              <strong>{format(d.value)}</strong>
            </li>
          ))}
        </ul>
      )}
      <details open={type === "table"}>
        <summary>
          ดูข้อมูลในตาราง ({data.length.toLocaleString("th-TH")} รายการ)
        </summary>
        <div className="fc-table-scroll">
          <table>
            <thead>
              <tr>
                <th>คำตอบ / ผลสรุป</th>
                <th>
                  {aggregation === "sum"
                    ? "ผลรวม"
                    : aggregation === "average"
                      ? "ค่าเฉลี่ย"
                      : "จำนวนคำตอบ"}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.name}>
                  <td>
                    <i style={{ background: d.color }} />
                    {d.name}
                  </td>
                  <td>{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
