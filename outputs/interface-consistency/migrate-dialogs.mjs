import {readFile,writeFile} from 'node:fs/promises';
import {parse} from '../../node_modules/.pnpm/node_modules/@babel/parser/lib/index.js';
const jobs=[
 ['app/src/components/AddAdminModal.jsx','./ui/index.jsx'],
 ['app/src/components/AddBannerModal.jsx','./ui/index.jsx'],
 ['app/src/components/EditBannerModal.jsx','./ui/index.jsx'],
 ['app/src/components/CreateRoleModal.jsx','./ui/index.jsx'],
 ['app/src/components/PatientMemberModal.jsx','./ui/index.jsx'],
 ['app/src/components/appointment/AppointmentDetailModal.jsx','../ui/index.jsx'],
 ['app/src/components/appointment/AppointmentFormModal.jsx','../ui/index.jsx'],
 ['app/src/components/case/ExportExcelModal.jsx','../ui/index.jsx'],
 ['app/src/components/case/casedetail-childrens/TemplateManagerModal.jsx','../../ui/index.jsx'],
 ['app/src/components/case/casedetail-childrens/CaseModals.jsx','../../ui/index.jsx'],
 ['app/src/pages/admin/CaseData.jsx','../../components/ui/index.jsx'],
 ['app/src/pages/admin/forms/builder-components/PublishSettingsModal.jsx','../../../../components/ui/index.jsx'],
 ['app/src/pages/admin/forms/builder-components/MoveSectionModal.jsx','../../../../components/ui/index.jsx'],
 ['app/src/pages/assessment/history/HistoryResult.jsx','../../../components/ui/index.jsx'],
 ['app/src/pages/admin/HelpCenterManager.jsx','../../components/ui/index.jsx','standard'],
];
const closes={
 'ส่งแบบประเมินให้คนไข้':'() => setShowFollowupModal(false)',
 'ยืนยันสิ้นสุดการรักษา':'() => setShowCloseCaseConfirm(false)',
 'เลือกข้อมูลคัดลอก':'() => setShowSelectModal(false)',
 'ยืนยันลบแบบฟอร์ม':'() => setShowDeleteConfirm(false)',
 'ประวัติคำแนะนำ':'() => setAdviceModal({isOpen:false, logs:[], clinicInfo:null})',
 'จัดการหมวดหมู่คำถามย่อย':'() => setIsCatModalOpen(false)',
 'ตั้งค่าการแสดงผลคลินิกบนหน้าช่วยเหลือ':'() => setIsClinicModalOpen(false)',
};
const attr=(el,key)=>el.openingElement.attributes.find(a=>a.type==='JSXAttribute'&&a.name.name===key);
const value=(el,key)=>attr(el,key)?.value?.value;
function walk(node,parent,visit) { if(!node||typeof node!=='object')return;visit(node,parent);for(const [key,item] of Object.entries(node)){if(['loc','tokens','comments'].includes(key))continue;if(Array.isArray(item))item.forEach(n=>walk(n,node,visit));else if(item&&typeof item==='object')walk(item,node,visit);} }
for(const [path,from,mode] of jobs){
 let source=await readFile(path,'utf8');const ast=parse(source,{sourceType:'module',plugins:['jsx']});const edits=[];
 walk(ast,null,(node,parent)=>{
  if(node.type!=='JSXElement'||value(node,'role')!=='dialog')return;
  if(parent?.type!=='JSXElement')throw Error(`Missing overlay ${path}`);
  const contents=parent.children.filter(c=>c.type==='JSXElement');if(contents.length!==1||contents[0]!==node)throw Error(`Ambiguous overlay ${path}`);
  const label=value(node,'aria-label');
  const close=path.endsWith('HelpCenterManager.jsx')&&!label?'() => setIsFaqModalOpen(false)':closes[label]||'onClose';
  let body=source.slice(node.openingElement.end,node.closingElement.start);
  let replacement;
  if(mode==='standard') {
   const removed=node.children.filter(c=>c.type==='JSXElement'&&(['h2','h3'].includes(c.openingElement.name.name)||value(c,'aria-label')==='ปิดหน้าต่าง'||value(c,'className')==='hc-modal-header'));
   for(const c of removed.sort((a,b)=>b.start-a.start)) {const begin=c.start-node.openingElement.end,end=c.end-node.openingElement.end;body=body.slice(0,begin)+body.slice(end);}
   const labelAttr=attr(node,'aria-label');const labelCode=source.slice(labelAttr.value.start,labelAttr.value.end);
   replacement=`<SharedDialog title=${labelCode} onClose={${close}} className="hc-dialog">${body}</SharedDialog>`;
  } else {
   const attrs=node.openingElement.attributes.filter(a=>!(a.type==='JSXAttribute'&&['role','aria-modal'].includes(a.name.name))).map(a=>source.slice(a.start,a.end)).join('\n        ');
   const tag=node.openingElement.name.name;
   replacement=`<DialogFrame ${tag==='form'?'as="form" ':''}${attrs} onClose={${close}}${path.endsWith('PatientMemberModal.jsx')?' dismissible={!saving}':''}>${body}</DialogFrame>`;
  }
  edits.push({start:parent.start,end:parent.end,replacement});
 });
 if(!edits.length)throw Error(`No dialogs in ${path}`);
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.replacement+source.slice(e.end);
 source=`import { ${mode==='standard'?'Dialog as SharedDialog':'DialogFrame'} } from '${from}';\n`+source;
 parse(source,{sourceType:'module',plugins:['jsx']});await writeFile(path,source);console.log(`${path}: ${edits.length}`);
}
