// Result pictures come in three levels. The level of a scored result is read
// from the colour the form builder gave its criterion.
export const RESULT_IMAGE_LEVELS = ["low", "medium", "high"];

const HIGH_COLORS = ["d93025", "e53935", "f44336", "ef4444", "d32f2f"];
const MEDIUM_COLORS = ["fbbc04", "ff9800", "ffb300", "f59e0b", "f57c00"];

// Hue (0–360) of a saturated "#rrggbb" colour; null for greys and non-hex.
function vividHue(value) {
  const match = value.match(/#?([0-9a-f]{6})\b/);
  if (!match) return null;
  const [r, g, b] = [0, 2, 4].map(
    (start) => parseInt(match[1].slice(start, start + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.25 || max < 0.35) return null;
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

export function resultImageLevel(color) {
  const value = String(color || "").toLowerCase();
  if (HIGH_COLORS.some((hex) => value.includes(hex))) return "high";
  if (MEDIUM_COLORS.some((hex) => value.includes(hex))) return "medium";
  // Any other red reads as high and any orange or yellow as medium, so a
  // custom shade from the colour picker still gets the expected picture.
  const hue = vividHue(value);
  if (hue === null) return "low";
  if (hue < 20 || hue >= 345) return "high";
  if (hue < 65) return "medium";
  return "low";
}

// A scoring range may point at a level picture ("level:high") or a picture in
// the organization's library ("asset:12"); otherwise its colour decides. A
// library picture that was removed falls back to the level picture.
export function resultImageChoice(ref, color) {
  const value = String(ref || "");
  const asset = value.match(/^asset:(\d+)$/);
  const level = value.match(/^level:(low|medium|high)$/);
  return {
    level: level ? level[1] : resultImageLevel(color),
    assetId: asset ? asset[1] : null,
  };
}
