import base from './playwright.config.mjs';
const port=4194;
export default {
  ...base,testMatch:'responsive-layout.spec.js',outputDir:'test-results-responsive',
  use:{...base.use,baseURL:`http://127.0.0.1:${port}`,reducedMotion:'reduce',video:'off'},
  projects:[
    {name:'phone',use:{viewport:{width:320,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:1}},
    {name:'tablet',use:{viewport:{width:900,height:1000},hasTouch:true,deviceScaleFactor:1}},
    {name:'desktop',use:{viewport:{width:1440,height:1000},deviceScaleFactor:1}},
  ],
  webServer:{...base.webServer,command:`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,env:{...base.webServer.env,BROWSER:'none'}},
};
