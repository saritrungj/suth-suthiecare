import {readFile,writeFile} from 'node:fs/promises';
import {parse} from '../../node_modules/.pnpm/node_modules/@babel/parser/lib/index.js';
const path='app/src/pages/admin/forms/FormBuilder.jsx';let source=await readFile(path,'utf8');
const ast=parse(source,{sourceType:'module',plugins:['jsx']}),edits=[];
function walk(n){if(!n||typeof n!=='object')return;
 if(n.type==='JSXElement'&&n.openingElement.name.name==='div'&&n.openingElement.attributes.some(a=>a.name?.name==='className'&&a.value?.value==='sfb-icon-group')){
  const attrs=n.openingElement.attributes.filter(a=>a.name?.name!=='style').map(a=>source.slice(a.start,a.end)).join(' ');
  const click=n.openingElement.attributes.find(a=>a.name?.name==='onClick')?.value?.expression?.name;
  const disabled=click==='handleUndo'?' disabled={past.length === 0}':click==='handleRedo'?' disabled={future.length === 0}':'';
  const body=source.slice(n.openingElement.end,n.closingElement.start).replaceAll('<p>','<span>').replaceAll('</p>','</span>');
  edits.push({start:n.start,end:n.end,text:`<button type="button" ${attrs}${disabled}>${body}</button>`});
 }
 for(const [k,v]of Object.entries(n)){if(['loc','comments','tokens'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
}
walk(ast);if(edits.length!==6)throw Error('Expected six editor actions');
for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
const start=source.indexOf('            {bannerType !== "none" && (');
const end=source.indexOf('            <div className="sfb-form-content">',start);
if(start<0||end<0)throw Error('Missing banner boundary');
const banner=source.slice(start,end);source=source.slice(0,start)+source.slice(end);
source=source.replace('<div className="sfb-form-canvas">','<div className="sfb-form-canvas">\n'+banner);
// Save is an application action; draft/published status remains in the label.
source=source.replace(/(className="sfb-btn-save"[\s\S]*?disabled=\{isSaving\})\s+style=\{\{[\s\S]*?\}\}/,'$1');
parse(source,{sourceType:'module',plugins:['jsx']});await writeFile(path,source);
const help='app/src/pages/admin/HelpCenterManager.jsx';let content=await readFile(help,'utf8');await writeFile(help,content.replace(/[\t ]+(?=\r?$)/gm,''));
