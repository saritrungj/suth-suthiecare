const express = require('express');
const db = require('../config/db');
const { canManageSchool, canViewStudentHealth, canUpdateStudentHealth } = require('../utils/schoolAccess');
const { sealText, readJson, fieldContext } = require('../utils/privateData');
const { requiredAudit } = require('../utils/pdpaAudit');
const router = express.Router();
const fields = ['guardian_name','guardian_relationship','guardian_phone','living_with','family_status','living_conditions','support_needs'];
const roleLabels = {admin:'ผู้ดูแลข้อมูลทั่วไป',mental_admin:'แอดมินสุขภาพจิต',physical_admin:'แอดมินสุขภาพกาย',counselor:'ครูแนะแนว',homeroom:'ครูประจำชั้น',other:'ครูทั่วไป',dorm_staff:'เจ้าหน้าที่หอพัก',guardian:'ผู้ปกครอง'};
const fail = (res,status,message) => res.status(status).json({message});
router.use((req,res,next) => req.schoolAccess ? next() : fail(res,422,'กรุณาเลือกโรงเรียน'));
async function studentAccess(req,res,write=false) {
  const [[student]] = await db.query(`SELECT ss.id,ss.school_id,ss.classroom_id,ss.archived_at FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE ss.id=? AND s.organization_id=? AND ss.archived_at IS NULL`,[req.params.id,req.organizationContext]);
  if (!student || !(write ? canUpdateStudentHealth : canViewStudentHealth)(req.schoolAccess,student)) {
    fail(res,404,'ไม่พบข้อมูลนักเรียนในขอบเขตสิทธิ์');return null;
  }
  return student;
}
function strings(body,allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k=>!allowed.includes(k))) return null;
  if (allowed.some(k=>body[k]!=null && (typeof body[k] !== 'string' || body[k].length>4000))) return null;
  return Object.fromEntries(allowed.map(k=>[k,(body[k]||'').trim()]));
}
const context = (table,org) => fieldContext(table,'payload_encrypted',org);
router.post('/guardian-accounts',async(req,res)=>{
  const {school_id,student_ids}=req.body||{};
  if(!canManageSchool(req.schoolAccess,school_id))return fail(res,403,'ไม่มีสิทธิ์สร้างบัญชีในโรงเรียนนี้');
  const validated=require('../utils/userValidation').validateUserInput(req.body,{requirePassword:true});
  if(validated.error)return fail(res,422,validated.error);
  if(!Array.isArray(student_ids)||!student_ids.length||student_ids.length>200||student_ids.some(id=>!Number.isInteger(id)||id<=0))return fail(res,422,'กรุณาเลือกนักเรียนในความดูแล');
  const ids=[...new Set(student_ids)];
  const {username,name,email,password}=validated.value;
  const passwordHash=await require('bcryptjs').hash(password,12);
  const accountEmail=require('../utils/accountEmail');
  const connection=await db.getConnection();
  try{
    await connection.beginTransaction();
    const [[school]]=await connection.query('SELECT id FROM schools WHERE id=? AND organization_id=?',[school_id,req.organizationContext]);
    const [students]=await connection.query('SELECT id FROM school_students WHERE id IN (?) AND school_id=? AND archived_at IS NULL FOR UPDATE',[ids,school_id]);
    if(!school||students.length!==ids.length){await connection.rollback();return fail(res,422,'นักเรียนต้องอยู่ในโรงเรียนที่เลือก');}
    const [[role]]=await connection.query("SELECT id FROM roles WHERE name='school_guardian' LIMIT 1");
    if(!role)throw new Error('School guardian migration is required');
    const [[duplicate]]=await connection.query('SELECT id FROM users WHERE username=? OR email_hash=? OR (email_hash IS NULL AND email=?) LIMIT 1',[username,accountEmail.lookup(email),email]);
    if(duplicate){await connection.rollback();return fail(res,409,'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว');}
    const [user]=await connection.query(`INSERT INTO users (username,password,name,email,email_encrypted,email_hash,role_id,status,email_verified_at,auth_version) VALUES (?,?,?,NULL,?,?,?,'active',NULL,0)`,[username,passwordHash,require('../utils/privateField').writeField(name,'users','name'),accountEmail.encode(email,'users'),accountEmail.lookup(email),role.id]);
    await connection.query('INSERT INTO organization_memberships (organization_id,user_id,role_id,is_primary) VALUES (?,?,?,1)',[req.organizationContext,user.insertId,role.id]);
    await connection.query("INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,'guardian','active',?)",[school_id,user.insertId,req.user.id]);
    for(const id of ids)await connection.query("INSERT INTO school_student_guardians (student_id,user_id,status,updated_by) VALUES (?,?,'active',?)",[id,user.insertId,req.user.id]);
    await requiredAudit(req,'school.guardian.create','user',user.insertId,{school_id,student_ids:ids},connection);
    await connection.commit();res.status(201).json({id:user.insertId,username});
  }catch(e){await connection.rollback();if(e.code==='ER_DUP_ENTRY')return fail(res,409,'ชื่อผู้ใช้หรืออีเมลนี้มีอยู่แล้ว');throw e;}finally{connection.release();}
});
router.get('/staff-roles',async(req,res)=>{
  if (!req.schoolAccess.canManageStaff) return fail(res,403,'ไม่มีสิทธิ์จัดการบทบาทโรงเรียน');
  const [schools] = await db.query('SELECT id,name FROM schools WHERE organization_id=?',[req.organizationContext]);
  const allowed=schools.filter(s=>canManageSchool(req.schoolAccess,s.id));
  const [members]=await db.query(`SELECT u.id,u.username FROM organization_memberships om JOIN users u ON u.id=om.user_id WHERE om.organization_id=? AND om.status='active' AND u.status='active'`,[req.organizationContext]);
  const [roles]=await db.query(`SELECT r.* FROM school_staff_roles r JOIN schools s ON s.id=r.school_id WHERE s.organization_id=?`,[req.organizationContext]);
  const [students]=await db.query(`SELECT ss.id,ss.school_id,ss.student_code FROM school_students ss JOIN schools s ON s.id=ss.school_id WHERE s.organization_id=? AND ss.archived_at IS NULL ORDER BY ss.student_code`,[req.organizationContext]);
  const [guardians]=await db.query(`SELECT g.student_id,g.user_id,ss.school_id FROM school_student_guardians g JOIN school_students ss ON ss.id=g.student_id JOIN schools s ON s.id=ss.school_id WHERE s.organization_id=? AND g.status='active' AND ss.archived_at IS NULL`,[req.organizationContext]);
  res.json({schools:allowed,members,students:students.filter(s=>canManageSchool(req.schoolAccess,s.school_id)),guardians:guardians.filter(g=>canManageSchool(req.schoolAccess,g.school_id)),roles:roles.filter(r=>canManageSchool(req.schoolAccess,r.school_id)),role_labels:roleLabels});
});
router.put('/staff-roles',async(req,res)=>{
  const {school_id,user_id,role_code,status='active'}=req.body||{};
  const [[school]]=await db.query('SELECT id FROM schools WHERE id=? AND organization_id=?',[school_id,req.organizationContext]);
  if (!school || !canManageSchool(req.schoolAccess,school_id)) return fail(res,403,'ไม่มีสิทธิ์จัดการโรงเรียนนี้');
  if (!Object.hasOwn(roleLabels,role_code) || !['active','inactive'].includes(status)) return fail(res,422,'บทบาทหรือสถานะไม่ถูกต้อง');
  const [[member]]=await db.query(`SELECT om.user_id,r.name role_name FROM organization_memberships om JOIN roles r ON r.id=om.role_id WHERE om.organization_id=? AND om.user_id=? AND om.status='active'`,[req.organizationContext,user_id]);
  if (!member) return fail(res,422,'บัญชีต้องเป็นสมาชิกหน่วยงานนี้');
  let studentIds=[];
  if(role_code==='guardian'){
    if(!Array.isArray(req.body.student_ids) || req.body.student_ids.length>200 || req.body.student_ids.some(id=>!Number.isInteger(id)||id<=0))return fail(res,422,'กรุณาเลือกนักเรียนในความดูแล');
    studentIds=[...new Set(req.body.student_ids)];
    if(status==='active' && !studentIds.length)return fail(res,422,'กรุณาเลือกนักเรียนอย่างน้อยหนึ่งคน');
    // A system account cannot be narrowed to a parent by a school assignment.
    const [[system]]=await db.query(`SELECT u.id FROM users u WHERE u.id=? AND (u.role_id=1 OR EXISTS (SELECT 1 FROM user_system_roles usr JOIN system_roles sr ON sr.id=usr.system_role_id WHERE usr.user_id=u.id AND sr.code='system_admin'))`,[user_id]);
    if(system)return fail(res,422,'กรุณาใช้บัญชีผู้ปกครองแยกจากบัญชีผู้ดูแลระบบ');
  }
  const connection=await db.getConnection();
  try {
    await connection.beginTransaction();
    if(role_code==='guardian'){
      const [students]=studentIds.length ? await connection.query('SELECT id FROM school_students WHERE id IN (?) AND school_id=? AND archived_at IS NULL FOR UPDATE',[studentIds,school_id]) : [[]];
      if(students.length!==studentIds.length){await connection.rollback();return fail(res,422,'นักเรียนต้องอยู่ในโรงเรียนที่เลือก');}
      const [[role]]=await connection.query("SELECT id FROM roles WHERE name='school_guardian' LIMIT 1");
      if(!role)throw new Error('School guardian migration is required');
      await connection.query('UPDATE organization_memberships SET role_id=? WHERE organization_id=? AND user_id=?',[role.id,req.organizationContext,user_id]);
    }
    if(role_code!=='guardian' && member.role_name==='school_guardian'){
      const [[role]]=await connection.query("SELECT id FROM roles WHERE name='school_import_staff' LIMIT 1");
      if(!role)throw new Error('School workflow migration is required');
      await connection.query('UPDATE organization_memberships SET role_id=? WHERE organization_id=? AND user_id=?',[role.id,req.organizationContext,user_id]);
    }
    await connection.query(`UPDATE school_student_guardians g JOIN school_students ss ON ss.id=g.student_id SET g.status='inactive',g.updated_by=? WHERE g.user_id=? AND ss.school_id=?`,[req.user.id,user_id,school_id]);
    for(const id of studentIds)await connection.query(`INSERT INTO school_student_guardians (student_id,user_id,status,updated_by) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),updated_by=VALUES(updated_by)`,[id,user_id,status,req.user.id]);
    await connection.query(`INSERT INTO school_staff_roles (school_id,user_id,role_code,status,updated_by) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE role_code=VALUES(role_code),status=VALUES(status),updated_by=VALUES(updated_by)`,[school_id,user_id,role_code,status,req.user.id]);
    await requiredAudit(req,'school.roles.update','school',school_id,{user_id,role_code,status},connection);
    await connection.commit();res.json({success:true});
  } catch(e){await connection.rollback();throw e;} finally{connection.release();}
});
router.get('/students/:id/insights',async(req,res)=>{
  const student=await studentAccess(req,res);if(!student)return;
  const [[row]]=await db.query('SELECT * FROM school_student_insights WHERE student_id=?',[student.id]);
  const [records]=await db.query('SELECT * FROM school_guidance_records WHERE student_id=? ORDER BY recorded_at DESC,id DESC',[student.id]);
  res.set('Cache-Control','no-store');
  res.json({student_id:student.id,can_update:canUpdateStudentHealth(req.schoolAccess,student),profile:row?readJson(row.payload_encrypted,context('school_student_insights',req.organizationContext)):Object.fromEntries(fields.map(k=>[k,''])),records:records.map(r=>({id:r.id,recorded_at:r.recorded_at,follow_up_at:r.follow_up_at,recorded_by:r.recorded_by,...readJson(r.payload_encrypted,context('school_guidance_records',req.organizationContext))}))});
});
router.put('/students/:id/insights',async(req,res)=>{
  const student=await studentAccess(req,res,true);if(!student)return;
  const payload=strings(req.body,fields);if(!payload)return fail(res,422,'ข้อมูลเชิงลึกไม่ถูกต้อง');
  const connection=await db.getConnection();
  try{
    await connection.beginTransaction();
    await connection.query(`INSERT INTO school_student_insights (student_id,payload_encrypted,updated_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE payload_encrypted=VALUES(payload_encrypted),updated_by=VALUES(updated_by)`,[student.id,sealText(payload,context('school_student_insights',req.organizationContext)),req.user.id]);
    await requiredAudit(req,'student_insights.update','student',student.id,{},connection);
    await connection.commit();res.json({success:true});
  }catch(e){await connection.rollback();throw e;}finally{connection.release();}
});
function validDate(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;}
router.post('/students/:id/guidance',async(req,res)=>{
  const student=await studentAccess(req,res,true);if(!student)return;
  const {recorded_at,follow_up_at,...body}=req.body||{};
  const payload=strings(body,['issue','support']);
  if(!payload || !payload.issue || !validDate(recorded_at) || (follow_up_at && !validDate(follow_up_at)))return fail(res,422,'กรุณาระบุวันที่และเรื่องที่พบให้ถูกต้อง');
  const connection=await db.getConnection();
  try{
    await connection.beginTransaction();
    const [result]=await connection.query(`INSERT INTO school_guidance_records (student_id,recorded_at,follow_up_at,payload_encrypted,recorded_by) VALUES (?,?,?,?,?)`,[student.id,recorded_at,follow_up_at||null,sealText(payload,context('school_guidance_records',req.organizationContext)),req.user.id]);
    await requiredAudit(req,'student_guidance.create','student',student.id,{},connection);
    await connection.commit();res.status(201).json({id:result.insertId});
  }catch(e){await connection.rollback();throw e;}finally{connection.release();}
});
module.exports=router;
