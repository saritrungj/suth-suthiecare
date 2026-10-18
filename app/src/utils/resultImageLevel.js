// Result pictures come in three levels. The level of a scored result is read
// from the colour the form builder gave its criterion.
export const RESULT_IMAGE_LEVELS = ["low", "medium", "high"];

const HIGH_COLORS = ["d93025", "e53935", "f44336", "ef4444", "d32f2f"];
const MEDIUM_COLORS = ["fbbc04", "ff9800", "ffb300", "f59e0b", "f57c00"];

export function resultImageLevel(color) {
  const value = String(color || "").toLowerCase();
  if (HIGH_COLORS.some((hex) => value.includes(hex))) return "high";
  if (MEDIUM_COLORS.some((hex) => value.includes(hex))) return "medium";
  return "low";
}
