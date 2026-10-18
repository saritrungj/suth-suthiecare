// Colours a form author picks or a template writes into a form's saved
// config (theme, page background, score bands). They are data: they are
// stored with the form and read back by the result page, charts and Excel,
// so they stay literal colours. UI chrome uses the --suth-* tokens instead.

export const DEFAULT_FORM_THEME = {
  color: "#673ab7",
  bg: "#f0f2f5",
  bannerBgColor: "#4285f4",
};

export const THEME_COLORS = [
  "#db4437",
  "#673ab7",
  "#3f51b5",
  "#4285f4",
  "#03a9f4",
  "#00bcd4",
  "#ff5722",
  "#ff9800",
  "#009688",
  "#4caf50",
  "#607d8b",
  "#9e9e9e",
];

export const BG_COLORS = [
  "#ffffff",
  "#f0f2f5",
  "#f8f9fa",
  "#fdf2f8",
  "#f3f1fa",
  "#e8f0fe",
  "#e6f4ea",
  "#fce8e6",
];

// Score band colours used by the built-in templates and new bands.
export const SCORE_BAND = {
  blue: "#03a9f4",
  green: "#4caf50",
  emerald: "#10b981",
  lime: "#36dd3c",
  yellow: "#fbbc04",
  lemon: "#f1ff2e",
  amber: "#f59e0b",
  orange: "#ff9800",
  brown: "#a9430b",
  red: "#d93025",
  crimson: "#ef4444",
  scarlet: "#ff1a1a",
};

export const DEFAULT_SCORE_BAND_COLOR = SCORE_BAND.green;

// Result colour when a form rule has none (the public result page derives
// tints from it, so it must be a literal hex).
export const DEFAULT_RESULT_COLOR = "#2d7d81";
