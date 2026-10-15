const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
let permissions=[],writes=[],org=7;
const connection={beginTransaction:async()=>{},commit:async()=>{},rollback:async()=>{},release(){},query:async(sql,params)=>{
 if(sql.startsWith('SELECT'))return [[{id:1,code:'active'}]];
 writes.push({sql,params});return [{insertId:2}];
}};
require.cache[require.resolve('../config/db')]={exports:{getConnection:async()=>connection,query:async(sql,params)=>{
 if(sql.includes('SELECT org_type'))return [[{org_type:'hospital'}]];
 if(sql.startsWith('INSERT'))return [{affectedRows:0}];
 if(sql.includes('SELECT id,code,label')){assert.deepEqual(params,[org,'student_status']);return [[{id:1,code:'active',label:'กำลังศึกษา',sort_order:3,is_active:1},{id:2,code:'graduated',label:'จบการศึกษา',sort_order:4,is_active:0}]];}
 throw Error('Unexpected SQL');
}}};
require.cache[require.resolve('../utils/pdpaAudit')]={exports:{requiredAudit:async()=>{}}};
test('master categories, fixed codes and updates are constrained to the active organization',async()=>{
 const app=express();app.use(express.json());app.use('/master',(req,res,next)=>{req.user={id:5};req.organizationContext=org;req.authorization={permissions:new Set(permissions)};next();},require('../routes/masterDataRoutes'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/master`;
 const update=body=>fetch(url+'/student_status/1',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  permissions=[];assert.equal((await fetch(url+'/categories')).status,403);
  const active=await(await fetch(url+'/student_status?active=1')).json();assert.equal(active.length,1);assert.equal(active[0].code,'active');
  assert.equal((await fetch(url+'/unknown?active=1')).status,404);assert.equal((await fetch(url+'/__proto__?active=1')).status,404);
  assert.equal((await update({code:'active',label:'กำลังศึกษา',sort_order:0,is_active:false})).status,403);
  permissions=['master_data.manage'];writes=[];
  assert.equal((await update({code:'changed',label:'เปลี่ยน',sort_order:0,is_active:true})).status,422);assert.equal(writes.length,0);
  assert.equal((await update({code:'active',label:'กำลังศึกษา',sort_order:10,is_active:false})).status,200);assert.deepEqual(writes[0].params,['active','กำลังศึกษา',10,0,'1',7]);
  org='all';assert.equal((await fetch(url+'/categories')).status,422);
 }finally{await new Promise(r=>server.close(r));}
});
