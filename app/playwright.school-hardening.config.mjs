import base from "./playwright.config.mjs";
export default {
  ...base,
  testDir: ".",
  testMatch: [
    "e2e/school-management.spec.js",
    "e2e/organization-hierarchy.spec.js",
    "e2e/route-smoke.spec.js",
    "e2e-audit/school-hardening.spec.js",
  ],
  projects: [
    {
      name: "desktop-chromium",
      use: { channel: "chrome", viewport: { width: 1366, height: 900 } },
    },
    {
      name: "mobile-chromium",
      use: {
        channel: "chrome",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
};
