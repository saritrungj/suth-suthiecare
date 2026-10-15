import {readFile,readdir,writeFile} from 'node:fs/promises';
async function files(dir){return(await Promise.all((await readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?files(`${dir}/${e.name}`):/\.(jsx?|tsx?)$/.test(e.name)?[`${dir}/${e.name}`]:[]))).flat();}
const changed=[];
for(const path of await files('app/src')) {
 const before=await readFile(path,'utf8');
 const after=before.replace(/(confirmButtonColor:\s*)["']#(?:f47932|fe6e35|f97316|3b82f6|3085d6|c2410c)["']/gi,'$1"var(--suth-action)"');
 if(after!==before){await writeFile(path,after);changed.push(path);}
}
await writeFile('outputs/interface-consistency/confirmation-colors.json',JSON.stringify(changed,null,2));console.log(changed.length+' files use the shared confirm color');
let dashboard=await readFile('app/src/pages/admin/dashboard.css','utf8');
await writeFile('app/src/pages/admin/dashboard.css',dashboard.replaceAll('.admin-page.dashboard-page','.dashboard-page'));
