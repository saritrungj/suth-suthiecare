export function checkupDuration(start, end) {
  if (!start || !end) return "";
  const timestamps = [start, end].map((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
      ? date.getTime()
      : NaN;
  });
  if (timestamps.some((value) => !Number.isFinite(value)))
    return "วันที่ไม่ถูกต้อง";
  const days = (timestamps[1] - timestamps[0]) / 86400000 + 1;
  if (days < 1) return "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น";
  // Inclusive end becomes an exclusive boundary. Count whole calendar months
  // from the original start, clamping month-end dates without timezone/DST drift.
  const first = new Date(timestamps[0]);
  const boundary = new Date(timestamps[1] + 86400000);
  const addMonths = (count) => {
    const date = new Date(first);
    date.setUTCDate(1);
    date.setUTCMonth(first.getUTCMonth() + count);
    const lastDay = new Date(date);
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
    lastDay.setUTCDate(0);
    date.setUTCDate(Math.min(first.getUTCDate(), lastDay.getUTCDate()));
    return date;
  };
  let months =
    (boundary.getUTCFullYear() - first.getUTCFullYear()) * 12 +
    boundary.getUTCMonth() -
    first.getUTCMonth();
  if (addMonths(months) > boundary) months -= 1;
  const remainingDays = Math.round((boundary - addMonths(months)) / 86400000);
  const parts = [
    [Math.floor(months / 12), "ปี"],
    [months % 12, "เดือน"],
    [Math.floor(remainingDays / 7), "สัปดาห์"],
    [remainingDays % 7, "วัน"],
  ]
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}`);
  return `${days} วัน${months || remainingDays >= 7 ? ` (${parts.join(" ")})` : ""}`;
}
