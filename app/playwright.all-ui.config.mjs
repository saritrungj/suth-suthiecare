import base from './playwright.config.mjs';
const port = 4197;
export default {
  ...base, testMatch: 'all-pages-ui.spec.js', outputDir: 'test-results-all-ui',
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}`, reducedMotion: 'reduce', video: 'off' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } },
  ],
  webServer: { ...base.webServer, command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false, env: { ...base.webServer.env, BROWSER: 'none' } },
};
