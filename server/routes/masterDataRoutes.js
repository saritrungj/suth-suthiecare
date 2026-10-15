const express=require('express');
const db=require('../config/db');
const catalog=require('../utils/masterCatalog');
const {requiredAudit}=require('../utils/pdpaAudit');
const {readField,writeField}=require('../utils/privateField');
const router=express.Router();
const fail=(res,status,message)=>res.status(status).json({message});
router.use(async(req,res,next)=>{
  if(!req.authorization)return fail(res,401,'กรุณาเข้าสู่ระบบ');
  const requested=req.query.organization_id;
  if(requested!==undefined){
    if(!req.authorization.isSystemAdmin && String(requested)!==String(req.organizationContext))return fail(res,403,'ไม่มีสิทธิ์ข้อมูลหน่วยงานนี้');
    if(requested!=='all' && !/^[1-9]\d*$/.test(String(requested)))return fail(res,422,'หน่วยงานไม่ถูกต้อง');
    req.organizationContext=requested==='all'?'all':Number(requested);
  }
  if(req.organizationContext==='all' && req.authorization.isSystemAdmin){
    if(req.method!=='GET')return fail(res,422,'กรุณาเลือกหน่วยงานที่จะบันทึก');
    req.masterAll=true;req.masterSchool=true;req.masterView=true;req.masterManage=true;return next();
  }
  if(!Number.isInteger(req.organizationContext))return fail(res,422,'กรุณาเลือกหน่วยงาน');
  const [[org]]=await db.query('SELECT org_type FROM organizations WHERE id=?',[req.organizationContext]);
  if(!org)return fail(res,404,'ไม่พบหน่วยงาน');
  req.masterSchool=org?.org_type==='school';
  const permissions=req.authorization.permissions;
  let admin=false;
  if(req.masterSchool){
    const [[role]]=await db.query(`SELECT 1 FROM school_staff_roles r JOIN schools s ON s.id=r.school_id JOIN organization_memberships om ON om.user_id=r.user_id AND om.organization_id=s.organization_id AND om.status='active' WHERE r.user_id=? AND s.organization_id=? AND r.role_code='admin' AND r.status='active' LIMIT 1`,[req.user.id,req.organizationContext]);admin=Boolean(role);
  }
  req.masterManage=req.authorization.isSystemAdmin || permissions?.has('master_data.manage') || admin;
  req.masterView=req.masterManage || permissions?.has('master_data.view');
  if(req.method!=='GET' && !req.masterManage)return fail(res,403,'ไม่มีสิทธิ์จัดการข้อมูลหลัก');
  next();
});
router.get('/categories',(req,res)=>{
  if(!req.masterView)return fail(res,403,'ไม่มีสิทธิ์ดูข้อมูลหลัก');
  res.json({can_manage:req.masterManage,categories:Object.entries(catalog).filter(([,d])=>!d.school||req.masterSchool).map(([code,d])=>({code,label:d.label,fixed:Boolean(d.fixed),fields:d.fields||['label'],locked_fields:d.lockedFields||[]}))});
});
router.use('/:category',(req,res,next)=>{
  const def=Object.hasOwn(catalog,req.params.category)?catalog[req.params.category]:null;
  if(!def || (def.school&&!req.masterSchool))return fail(res,404,'ไม่พบหมวดข้อมูลหลัก');
  // Form readers may fetch active options without administration rights.
  if(req.method==='GET' && !req.masterView && req.query.active!=='1')return fail(res,403,'ไม่มีสิทธิ์ดูข้อมูลหลัก');
  req.masterDefinition=def;req.masterCategory=req.params.category;next();
});
async function listRows(req,org){
  const def=req.masterDefinition;
  let rows;
  if(def.table){
    [rows]=await db.query(`SELECT id,${def.fields.join(',')},sort_order,${def.school?'status':'is_active'} FROM ${def.table} WHERE organization_id=? ORDER BY sort_order,id`,[org]);
    rows=rows.map(r=>({...r,code:String(r.id),label:r.name||r.label,is_active:def.school?r.status==='active':Boolean(r.is_active),...Object.fromEntries((def.private||[]).map(k=>[k,readField(r[k],def.table,k,org)]))}));
  }else{
    for(const [index,[code,label]] of (def.defaults||[]).entries()) await db.query('INSERT IGNORE INTO master_data_options (organization_id,category,code,label,sort_order) VALUES (?,?,?,?,?)',[org,req.masterCategory,code,label,index]);
    [rows]=await db.query('SELECT id,code,label,sort_order,is_active FROM master_data_options WHERE organization_id=? AND category=? ORDER BY sort_order,id',[org,req.masterCategory]);
  }
  return req.query.active==='1'?rows.filter(r=>r.is_active):rows;
}
router.get('/:category',async(req,res)=>{
  if(!req.masterAll)return res.json(await listRows(req,req.organizationContext));
  const [organizations]=await db.query("SELECT id,name,org_type FROM organizations WHERE org_level='unit' AND status='active' ORDER BY name,id");
  const rows=[];
  for(const org of organizations){
    if(req.masterDefinition.school && org.org_type!=='school')continue;
    for(const row of await listRows(req,org.id))rows.push({...row,organization_id:org.id,organization_name:org.name});
  }
  res.json(rows);
});
async function save(req,res,creating){
  const def=req.masterDefinition,body=req.body||{},org=req.organizationContext;
  if(def.fixed&&creating)return fail(res,422,'หมวดนี้ใช้รหัสระบบคงที่');
  const fields=def.fields||['code','label'];
  if(fields.some(k=>typeof body[k]!=='string'||(k!=='description'&&!body[k].trim())||body[k].length>(k==='text'?4000:255)))return fail(res,422,'กรุณาระบุข้อมูลให้ครบถ้วน');
  if(!Number.isInteger(Number(body.sort_order))||Number(body.sort_order)<0 || Number(body.sort_order)>100000 || ![true,false,0,1].includes(body.is_active))return fail(res,422,'ลำดับหรือสถานะไม่ถูกต้อง');
  if(!def.table && !/^[a-zA-Z0-9_.-]{1,64}$/.test(body.code))return fail(res,422,'รหัสต้องเป็นตัวอักษรอังกฤษ ตัวเลข จุด ขีด หรือขีดล่าง');
  if(def.fixed&&!def.defaults.some(([code])=>code===body.code))return fail(res,422,'เปลี่ยนรหัสระบบไม่ได้');
  const connection=await db.getConnection();
  try{
    await connection.beginTransaction();
    const table=def.table||'master_data_options',active=def.school?'status':'is_active';
    const columns=[...fields,'sort_order',active];
    const values=fields.map(k=>def.private?.includes(k)?writeField(body[k].trim(),table,k,org):body[k].trim());
    values.push(Number(body.sort_order),def.school?(body.is_active?'active':'inactive'):Number(body.is_active));
    let id;
    if(creating){
      if(!def.table){columns.push('category');values.push(req.masterCategory);}
      columns.push('organization_id');values.push(org);
      const [result]=await connection.query(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`,values);id=result.insertId;
    }else{
      const [existing]=await connection.query(`SELECT id${def.table?(def.lockedFields?.length?','+def.lockedFields.join(','):''):',code'} FROM ${table} WHERE id=? AND organization_id=?${def.table?'':' AND category=?'} FOR UPDATE`,[req.params.id,org,...(def.table?[]:[req.masterCategory])]);
      if(!existing.length){await connection.rollback();return fail(res,404,'ไม่พบข้อมูลหลัก');}
      if(def.lockedFields?.some(key=>existing[0][key]!==body[key])){await connection.rollback();return fail(res,422,'ชื่อสถานะนี้ใช้เป็นรหัสอ้างอิง เปลี่ยนไม่ได้ ให้เพิ่มสถานะใหม่แทน');}
      if(!def.table && existing[0].code!==body.code){await connection.rollback();return fail(res,422,'เปลี่ยนรหัสที่สร้างแล้วไม่ได้');}
      await connection.query(`UPDATE ${table} SET ${columns.map(k=>`${k}=?`).join(',')} WHERE id=? AND organization_id=?`,[...values,req.params.id,org]);id=Number(req.params.id);
    }
    await requiredAudit(req,'master_data.'+(creating?'create':'update'),'master',id,{category:req.masterCategory},connection);
    await connection.commit();res.status(creating?201:200).json({id});
  }catch(e){await connection.rollback();if(e.code==='ER_DUP_ENTRY')return fail(res,409,'รหัสหรือชื่อนี้มีอยู่แล้ว');throw e;}finally{connection.release();}
}
router.post('/:category',(req,res)=>save(req,res,true));
router.put('/:category/:id',(req,res)=>save(req,res,false));
module.exports=router;
