import base from "./playwright.config.mjs";

// Use an isolated dev server so an older desktop session cannot supply stale
// styles to the visual/accessibility audit.
const port = 4188;
export default {
  ...base,
  testMatch: "admin-colorize.spec.js",
  use: {
    ...base.use,
    baseURL: `http://127.0.0.1:${port}`,
    reducedMotion: "reduce",
  },
  webServer: {
    ...base.webServer,
    command: `pnpm dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    env: { ...base.webServer.env, BROWSER: "none" },
  },
};
