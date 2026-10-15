const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
let role='homeroom',assigned=true;
const db={query:async(sql)=>{
 if(sql.includes('SELECT org_type'))return [[{org_type:'school'}]];
 if(sql.includes('FROM school_staff_roles'))return [role?[{school_id:2,role_code:role}]:[]];
 if(sql.includes('FROM school_teachers'))return [[{id:5,school_id:2}]];
 if(sql.includes('FROM school_classroom_teachers'))return [assigned?[{classroom_id:10,role:'homeroom',school_id:2}]:[]];
 if(sql.includes('FROM school_student_guardians'))return [assigned?[{id:1,school_id:2}]:[]];
 if(sql.includes('FROM school_students'))return [[{id:1,school_id:2,classroom_id:10,person_id:101,patient_account_id:201},{id:2,school_id:2,classroom_id:11,person_id:102,patient_account_id:202},{id:3,school_id:3,classroom_id:12,person_id:103,patient_account_id:203}]];
 if(sql.includes('FROM form_responses'))return [[{id:20,person_id:101,master_case_id:30},{id:21,person_id:102,master_case_id:31},{id:22,person_id:103,master_case_id:32}]];
 throw Error('Unexpected query');
}};
require.cache[require.resolve('../config/db')]={exports:db};
const {schoolPrivacyBoundary}=require('../middleware/schoolPrivacyBoundary');
const {organizationWhere}=require('../authorization/authorization');
async function withApp(run){
 const app=express();let mutations=0;
 app.use(express.json());app.use('/api',(req,res,next)=>{req.user={id:7};req.organizationContext=9;req.authorization={permissions:new Set(['cases.view','cases.update','clinical.view'])};next();},schoolPrivacyBoundary);
 app.get('/api/cases',(req,res)=>res.json([{id:20,notes:'own'},{id:21,notes:'other room'},{id:22,notes:'other school'}]));
 app.get('/api/cases/:id',(req,res)=>res.json({id:Number(req.params.id),notes:'detail'}));
 app.put('/api/cases/:id',(req,res)=>{mutations++;res.json({success:true});});
 app.get('/api/scope',(req,res)=>res.json(organizationWhere('fr.organization_id',req)));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const url=`http://127.0.0.1:${server.address().port}/api`;
 try{await run(url,()=>mutations);}finally{await new Promise(resolve=>server.close(resolve));}
}
test('generic case APIs and writes cannot bypass a homeroom boundary',async()=>{
 role='homeroom';assigned=true;
 await withApp(async(url,mutations)=>{
  assert.deepEqual((await(await fetch(url+'/cases')).json()).map(r=>r.id),[20]);
  assert.equal((await fetch(url+'/cases/21')).status,403);
  assert.equal((await fetch(url+'/cases/22',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal(mutations(),0);assert.equal((await fetch(url+'/cases/20',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,200);assert.equal(mutations(),1);
 });
});
test('role revocation and classroom removal take effect on the next API request',async()=>{
 await withApp(async(url)=>{
  role=null;assert.equal((await fetch(url+'/cases/20')).status,403);
  role='homeroom';assigned=false;assert.equal((await fetch(url+'/cases/20')).status,403);
  role='admin';assigned=true;assert.equal((await fetch(url+'/cases/20')).status,403);
  role='physical_admin';assert.equal((await fetch(url+'/cases/20')).status,403);
  role='mental_admin';assert.equal((await fetch(url+'/cases/21')).status,200);assert.equal((await fetch(url+'/cases/22')).status,403);
  role='counselor';assert.equal((await fetch(url+'/cases/21')).status,200);assert.equal((await fetch(url+'/cases/22')).status,403);
 });
});
test('subject restriction is included in SQL before pagination or aggregation',()=>{
 const scope=organizationWhere('fr.organization_id',{organizationContext:9,schoolResourcePath:'/cases',schoolSubjectScope:{responseIds:[20],masterIds:[30]}});
 assert.match(scope.sql,/fr.id IN/);assert.deepEqual(scope.params,[9,[20]]);
 const master=organizationWhere('mc.organization_id',{organizationContext:9,schoolResourcePath:'/appointments',schoolSubjectScope:{responseIds:[20],masterIds:[30]}});
 assert.match(master.sql,/mc.id IN/);assert.deepEqual(master.params,[9,[30]]);
});


test('guardian generic case requests stay scoped and mutations are denied even on their own child',async()=>{
 role='guardian';assigned=true;
 await withApp(async(url,mutations)=>{
  assert.deepEqual(await(await fetch(url+'/cases')).json(),[{id:20,notes:'own'}]);
  assert.equal((await fetch(url+'/cases/20')).status,200);
  assert.equal((await fetch(url+'/cases/21')).status,403);
  assert.equal((await fetch(url+'/cases/20',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal(mutations(),0);
  assigned=false;assert.equal((await fetch(url+'/cases/20')).status,403);
 });
});
