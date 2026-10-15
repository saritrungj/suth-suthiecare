const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
const queries=[];
let row={role_id:1,organization_id:7,active_charts:'{}'},commits=0;
const questions=[{id:'multi',type:'checkboxes'},{id:'group',type:'group',subQuestions:[{id:'nested',type:'number'}]}];
const query=async(sql,params=[])=>{
 queries.push({sql,params});
 if(sql.startsWith('SELECT questions FROM forms'))return [Number(params[0])===1&&(!params[1]||Number(params[1])===7)?[{questions}]:[]];
 if(sql.includes('FROM form_answers'))return [[{response_id:10,question_title:'กิจกรรม',answer_value:['อ่าน','กีฬา'],summary_data:{score_results:[{question_id:'multi',label:'ปกติ'}],raw_answers:{secret:'never return'}},organization_id:7}]];
 if(sql.includes('SELECT * FROM dashboard_settings'))return [[row]];
 if(sql.startsWith('INSERT IGNORE'))return [{}];
 if(sql.startsWith('UPDATE dashboard_settings')){row={...row,active_charts:params[0]};return [{}];}
 if(sql.startsWith('SELECT id,title,status,questions'))return [[{id:1,title:'แบบฟอร์ม',status:'draft',questions}]];
 throw Error('Unexpected query: '+sql);
};
require.cache[require.resolve('../config/db')]={exports:{query,getConnection:async()=>({query,beginTransaction:async()=>{},commit:async()=>{commits++;},rollback:async()=>{},release:()=>{}})}};
require.cache[require.resolve('../middleware/authMiddleware')]={exports:{verifyToken:(_req,_res,next)=>next()}};
require.cache[require.resolve('../utils/storedAnswer')]={exports:{normalizeStoredAnswer:value=>value}};
require.cache[require.resolve('../utils/decryptCaseData')]={exports:{decryptSummaryData:value=>value,decryptCaseResponse:value=>value}};
const router=require('../routes/dashboardRoutes');
test('chart APIs enforce form ownership, preserve checkbox answers, apply dates and classroom scope, and isolate settings',async()=>{
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:1};req.organizationContext=req.get('X-Test-Org')==='all'?'all':Number(req.get('X-Test-Org')||7);if(req.get('X-Test-Classroom')){req.schoolSubjectScope={responseIds:[10],masterIds:[20]};req.schoolResourcePath='/charts/1/multi';}next();});app.use(router);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const chart={id:'c1',title:'กิจกรรม',question:'multi',type:'bar',aggregation:'count'};
 const save=(org,charts)=>fetch(base+'/dashboard-settings/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Test-Org':String(org)},body:JSON.stringify({formId:1,charts})});
 try{
  assert.equal((await fetch(base+'/charts/1/multi', {headers:{'X-Test-Org':'8'}})).status,404);
  assert.equal((await fetch(base+'/charts/1/missing')).status,404);
  assert.equal((await fetch(base+'/charts/1/multi?startDate=2026-10-10&endDate=2026-10-01')).status,422);
  const response=await fetch(base+'/charts/1/multi?startDate=2026-10-01&endDate=2026-10-15',{headers:{'X-Test-Classroom':'1'}});
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),[{answer:['อ่าน','กีฬา'],name:['อ่าน','กีฬา'],value:1,result:'ปกติ'}]);
  const scoped=queries.find(q=>q.sql.includes('FROM form_answers'));
  assert.match(scoped.sql,/fr.id IN/);assert.match(scoped.sql,/DATE\(fr.submitted_at\) >=/);assert.deepEqual(scoped.params,[ '1','1','multi',7,[10],'2026-10-01','2026-10-15']);
  assert.equal((await fetch(base+'/charts/1/nested')).status,200);
  assert.equal((await save('all',{1:[chart]})).status,422);
  assert.equal((await save(8,{1:[chart]})).status,422);
  assert.equal((await save(7,{1:[{...chart,question:'missing'}]})).status,422);
  assert.equal((await save(7,{1:[{...chart,type:'pie',aggregation:'average'}]})).status,422);
  assert.equal((await save(7,{1:[chart,chart]})).status,422);
  assert.equal((await save(7,{1:[{...chart,data:[{name:'private cached answer'}]}]})).status,200);
  assert.equal(commits,1);assert.ok(queries.some(q=>q.sql.includes('FOR UPDATE')));
  assert.equal(row.active_charts.includes('private cached answer'),false);
  assert.equal((await(await fetch(base+'/dashboard-settings/settings')).json()).active_charts[1][0].title,'กิจกรรม');
  assert.deepEqual((await(await fetch(base+'/dashboard-settings/settings',{headers:{'X-Test-Org':'8'}})).json()).active_charts,{});
  assert.equal((await(await fetch(base+'/dashboard/forms')).json())[0].status,'draft');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
