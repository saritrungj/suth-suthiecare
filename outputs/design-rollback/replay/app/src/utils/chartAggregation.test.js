import test from 'node:test';
import assert from 'node:assert/strict';
import {aggregateChart,chartQuestions} from './chartAggregation.js';
const compact=data=>data.map(({name,value})=>({name,value}));
test('checkbox choices count once per response and keep zero and false',()=>{
 assert.deepEqual(compact(aggregateChart([{answer:['ก','ก','ข']},{answer:['ข']},{answer:0},{answer:false},{answer:''}],{sort:'label'})),[{name:'0',value:1},{name:'ก',value:1},{name:'ข',value:2},{name:'false',value:1}]);
});
test('grid answers retain row labels instead of flattening unrelated rows',()=>{
 assert.deepEqual(compact(aggregateChart([{answer:{แถวหนึ่ง:['ดี','ดี'],แถวสอง:'ดี'}}],{sort:'original'})),[{name:'แถวหนึ่ง: ดี',value:1},{name:'แถวสอง: ดี',value:1}]);
});
test('numeric summaries include zero and negatives, ignore blank, text, booleans and objects',()=>{
 const rows=[{answer:0},{answer:'20'},{answer:-5},{answer:''},{answer:null},{answer:'ไม่ทราบ'},{answer:false},{answer:{weight:50}}];
 assert.equal(aggregateChart(rows,{aggregation:'sum'})[0].value,15);
 assert.equal(aggregateChart(rows,{aggregation:'average'})[0].value,5);
 assert.equal(aggregateChart([{answer:{weight:50}},{answer:{weight:0}}],{answerPath:'weight',aggregation:'average'})[0].value,25);
});
test('result mode does not substitute raw answers for missing scores',()=>{
 assert.deepEqual(compact(aggregateChart([{answer:'ลับ',result:'ปกติ'},{answer:'ลับ'}],{mode:'result',sort:'original'})),[{name:'ปกติ',value:1},{name:'ยังไม่มีผลสรุป',value:1}]);
});
test('blank policy, prototype-like labels and encoded labels remain accurate',()=>{
 assert.deepEqual(compact(aggregateChart([{answer:''},{answer:'constructor'},{answer:'<b>ดี</b>'},{answer:'ดี'}],{includeEmpty:true,sort:'desc'})),[{name:'ดี',value:2},{name:'ไม่ระบุ',value:1},{name:'constructor',value:1}]);
});
test('nested questions remain selectable without section headings',()=>{
 assert.deepEqual(chartQuestions([{id:'s',type:'section',questions:[{id:'1',type:'number'}]},{id:'g',type:'group',subQuestions:[{id:'2',type:'dropdown'}]},{id:'d',type:'description'}]).map(q=>q.id),['1','g','2']);
});
test('timeline counts each response once and averages numbers within each month',()=>{
 const rows=[{answer:['อ่าน','กีฬา'],submitted_date:'2026-10-01'},{answer:['กีฬา'],submitted_date:'2026-10-02'}];
 assert.deepEqual(compact(aggregateChart(rows,{groupBy:'month'})),[{name:'2026-10',value:2}]);
 assert.deepEqual(compact(aggregateChart([{answer:0,submitted_date:'2026-10-01'},{answer:40,submitted_date:'2026-10-02'},{answer:10,submitted_date:'2026-09-01'}],{groupBy:'month',aggregation:'average',sort:'label'})),[{name:'2026-09',value:10},{name:'2026-10',value:20}]);
});
test('grid labels use form row titles',()=>{
 assert.deepEqual(compact(aggregateChart([{answer:{0:'ดี'}}],{}, {rows:['การนอน']})),[{name:'การนอน: ดี',value:1}]);
});
test('chart restyling preserves the scoring rule color for risk categories',()=>{
 const [result]=aggregateChart([{answer:'ignored',result:'เสี่ยงสูง'}],{mode:'result'},{scoringRules:[{label:'เสี่ยงสูง',color:'#b42318'}]});
 assert.equal(result.color,'#b42318');
 assert.equal(result.name,'เสี่ยงสูง');
});
