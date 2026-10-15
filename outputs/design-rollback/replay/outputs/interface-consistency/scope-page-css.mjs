import {readFile,writeFile} from 'node:fs/promises';
import postcss from 'file:///D:/github-clone/suth-suthiecare/node_modules/.pnpm/node_modules/postcss/lib/postcss.js';
const jobs=[
 ['app/src/pages/admin/RiskCases.css',':where(.admin-wrapper2)',s=>!s.startsWith('.admin-wrapper2')],
 ['app/src/pages/admin/dashboard.css',':where(.dashboard-page)',s=>!s.startsWith(':root')],
 ['app/src/pages/admin/HelpCenterManager.css',':where(.hc-admin-page,.hc-dialog)',s=>!s.startsWith(':root')&&!/^\.hc-/.test(s)],
 ['app/src/components/appointment/AppointmentFormModal.css',':where(.form-modal)',s=>!s.startsWith('.form-modal')],
 ['app/src/components/appointment/AppointmentDetailModal.css',':where(.detail-modal)',s=>!s.startsWith('.detail-modal')&&!s.startsWith('.modal-overlay')],
];
for(const [path,scope,include]of jobs){
 const root=postcss.parse(await readFile(path,'utf8'));
 root.walkRules(rule=>{if(rule.parent.type==='atrule'&&/keyframes$/.test(rule.parent.name))return;
  rule.selectors=rule.selectors.map(s=>{
   if(!include(s))return s;
   if(path.endsWith('dashboard.css')&&s.startsWith('.admin-page'))return s.replace(/^\.admin-page/,'.admin-page.dashboard-page');
   return `${scope} ${s}`;
  });
 });
 await writeFile(path,root.toString());console.log(path);
}
