import base from "./playwright.responsive.config.mjs";
const port = 4196;
export default {
  ...base,
  testMatch: "interface-consistency.spec.js",
  outputDir: "test-results-interface",
  webServer: {
    ...base.webServer,
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
  },
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
};
