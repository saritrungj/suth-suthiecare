const test=require('node:test');
const assert=require('node:assert/strict');
const {loadSchoolAccess,canViewStudentHealth,canSeeStudent,studentScopeClause}=require('../utils/schoolAccess');
const {current,normalizeStudentStatus}=require('../utils/studentStatus');
async function access(role,rooms=[{classroom_id:10,school_id:2,role:'homeroom'}],permissions=[]){
 return loadSchoolAccess({query:async(sql)=>{
  if(sql.includes('FROM school_staff_roles'))return [[...(role?[{school_id:2,role_code:role}]:[])]];
  if(sql.includes('FROM school_teachers'))return [[{id:5,school_id:2}]];
  if(sql.includes('FROM school_classroom_teachers'))return [rooms];
  throw Error('Unexpected query');
 }},{user:{id:1},organizationContext:7,authorization:{permissions:new Set(permissions)}});
}
test('admin and other teachers cannot gain insights through clinical permissions',async()=>{
 for(const role of ['admin','other',null]){
  const a=await access(role,undefined,['clinical.view','student_health.view','student_health.update']);
  assert.equal(canViewStudentHealth(a,{school_id:2,classroom_id:10}),false);
  assert.equal(a.canExportStudents,role==='admin');
 }
});
test('homeroom role is limited to its assigned homeroom and current school',async()=>{
 const a=await access('homeroom',[{classroom_id:10,school_id:2,role:'homeroom'},{classroom_id:11,school_id:2,role:'counselor'},{classroom_id:12,school_id:3,role:'homeroom'}],['students.view']);
 assert.equal(a.canViewAllStudents,false);
 assert.equal(canViewStudentHealth(a,{school_id:2,classroom_id:10}),true);
 assert.equal(canViewStudentHealth(a,{school_id:2,classroom_id:11}),false);
 assert.equal(canViewStudentHealth(a,{school_id:3,classroom_id:12}),false);
 assert.equal(canViewStudentHealth(await access('homeroom',[]),{school_id:2,classroom_id:10}),false);
});
test('counselor and admin general access stop at their school',async()=>{
 for(const role of ['counselor','admin']){
  const a=await access(role,[]);
  assert.equal(Boolean(canSeeStudent(a,{school_id:2,classroom_id:30})),true);
  assert.equal(Boolean(canSeeStudent(a,{school_id:3,classroom_id:30})),false);
  assert.deepEqual(studentScopeClause(a).params,[[2]]);
  assert.equal(canViewStudentHealth(a,{school_id:2,classroom_id:null}),role==='counselor');
 }
});
test('only the five current enrollment values can be written or imported',()=>{
 assert.equal(current.length,5);
 for(const [input,expected] of [['ลาพัก','on_leave'],['ลาออก','withdrawn'],['สละสิทธิ์','waived'],['active','active']])assert.equal(normalizeStudentStatus(input),expected);
 for(const input of ['inactive','transferred','unknown'])assert.equal(normalizeStudentStatus(input),undefined);
});
