import base from './playwright.config.mjs';
const port=4198;
export default {...base,outputDir:'test-results-interface-regression',
  use:{...base.use,baseURL:`http://127.0.0.1:${port}`,video:'off',reducedMotion:'reduce'},
  webServer:{...base.webServer,command:`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{...base.webServer.env,BROWSER:'none'}}};
