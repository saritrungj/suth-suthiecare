import test from 'node:test';
import assert from 'node:assert/strict';
import {displayExportValue, exportRecord} from './exportDisplay.js';

test('export values use screen labels with the correct resource context',()=>{
  assert.equal(displayExportValue('status','active','students'),'กำลังศึกษา');
  assert.equal(displayExportValue('status','active','users'),'ใช้งาน');
  assert.equal(displayExportValue('gender','male','students'),'ชาย');
  assert.equal(displayExportValue('role_code','homeroom','school_roles'),'ครูประจำชั้น');
  assert.equal(displayExportValue('org_type','school','organizations'),'โรงเรียน');
  assert.equal(displayExportValue('status','draft','forms'),'ร่าง');
  assert.equal(displayExportValue('is_active',0,'master'),'ปิดใช้งาน');
  assert.equal(displayExportValue('is_boarder',1,'students'),'หอพัก');
  assert.equal(displayExportValue('health_domain','mental','forms'),'สุขภาพจิต');
});

test('custom labels and relationships are resolved without exporting database foreign keys',()=>{
  const display={options:[{organization_id:3,category:'student_status',code:'active',label:'ศึกษาอยู่'}],lookups:{school_id:{2:'โรงเรียนจำลอง'},role_id:{4:'ผู้ประสานงาน'}},clinics:{general:'คลินิกทั่วไป'}};
  const row=exportRecord({id:8,organization_id:3,student_code:'0008',school_id:2,status:'active',role_id:4,clinic_type:'general',can_view_health:true},'students',display);
  assert.equal(row.status,'ศึกษาอยู่');assert.equal(row.school_name,'โรงเรียนจำลอง');assert.equal(row.role_name,'ผู้ประสานงาน');assert.equal(row.clinic_type,'คลินิกทั่วไป');
  assert.equal(row.id,undefined);assert.equal(row.school_id,undefined);assert.equal(row.role_id,undefined);assert.equal(row.can_view_health,undefined);
});

test('dates use Buddhist years and date-only values do not shift by timezone',()=>{
  assert.match(displayExportValue('birth_date','2013-05-31','students'),/31\/05\/2556/);
  assert.match(displayExportValue('submitted_at','2026-10-15T00:30:00Z','cases'),/2569/);
  assert.equal(displayExportValue('student_code','0008','students'),'0008');
});
