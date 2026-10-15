const test=require('node:test'),assert=require('node:assert/strict'),express=require('express');
let calls=[];
require.cache[require.resolve('../config/db')]={exports:{query:async(sql,params)=>{
 calls.push({sql,params});
 if(sql.startsWith('SELECT id,organization_id'))return [params[0]==='1'?[{id:1,organization_id:7}]:[]];
 if(sql.includes('pdpa_processing_purposes'))return [[]];
 throw Error('Unexpected SQL');
}}};
test('retired privacy settings do not query historical data; published forms still receive a standard notice',async()=>{
 const app=express();app.use(require('../routes/pdpaGovernanceRoutes'));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const [path,method] of [['/pdpa/requests','GET'],['/pdpa/organizations/7/retention','PUT'],['/pdpa/organizations/7/purposes/1','PUT'],['/patient/privacy/requests','POST'],['/patient/privacy/organizations','GET']])assert.equal((await fetch(base+path,{method})).status,410);
  assert.equal(calls.length,0);
  const notice=await fetch(base+'/forms/1/privacy-notice');
  assert.equal(notice.status,200);assert.equal(notice.headers.get('cache-control'),'no-store');
  assert.equal((await notice.json()).notice_version,'standard-v1');
  assert.equal((await fetch(base+'/forms/2/privacy-notice')).status,404);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
