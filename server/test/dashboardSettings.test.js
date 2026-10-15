const test=require('node:test'),assert=require('node:assert/strict');
const {readWorkspace,mergeWorkspace}=require('../utils/dashboardSettings');
test('legacy dashboard belongs only to its recorded organization',()=>{
 const row={organization_id:7,last_selected_form_id:3,active_charts:JSON.stringify({3:[{id:'old'}]})};
 assert.equal(readWorkspace(row,7).active_charts[3][0].id,'old');
 assert.deepEqual(readWorkspace(row,8),{last_selected_form_id:null,active_charts:{}});
});
test('saving another organization preserves the original and exposes only requested workspace',()=>{
 const row={organization_id:7,last_selected_form_id:3,active_charts:JSON.stringify({3:[{id:'old'}]})};
 const workspace={last_selected_form_id:4,active_charts:{4:[{id:'new'}]}};
 const updated={...row,active_charts:JSON.stringify(mergeWorkspace(row,8,workspace))};
 assert.equal(readWorkspace(updated,7).active_charts[3][0].id,'old');
 assert.deepEqual(readWorkspace(updated,8),workspace);
 assert.deepEqual(readWorkspace(updated,9).active_charts,{});
 const again={...updated,active_charts:mergeWorkspace(updated,8,{last_selected_form_id:null,active_charts:{}})};
 assert.equal(readWorkspace(again,7).active_charts[3][0].id,'old');
 assert.deepEqual(readWorkspace(again,8).active_charts,{});
});
test('legacy cached response data is never exposed by dashboard settings',()=>{
 const row={organization_id:7,active_charts:{1:[{id:'c',data:[{summary_data:{secret:'private'}}]}]}};
 assert.deepEqual(readWorkspace(row,7).active_charts,{1:[{id:'c'}]});
});
