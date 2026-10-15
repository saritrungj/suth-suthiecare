const express=require('express');
const db=require('../config/db');
const {collectSource}=require('../services/exportData');
const {loadSchoolAccess}=require('../utils/schoolAccess');
const {requiredAudit}=require('../utils/pdpaAudit');
const router=express.Router();
router.post('/local',async(req,res)=>{
 const {resource,count}=req.body||{};
 if(!req.authorization||!Number.isInteger(count)||count<0||count>100000)return res.status(422).json({message:'คำขอส่งออกไม่ถูกต้อง'});
 const p=req.authorization.permissions;
 let allowed=req.authorization.isSystemAdmin;
 if(resource==='form_draft')allowed ||= p?.has('forms.view')&&p?.has('forms.export');
 else if(resource==='import_results'&&typeof req.organizationContext==='number')allowed ||= (await loadSchoolAccess(db,req)).canExportStudents;
 else if(resource!=='import_results')return res.status(422).json({message:'ไม่พบหมวดส่งออก'});
 if(!allowed)return res.status(403).json({message:'ไม่มีสิทธิ์ส่งออก'});
 await requiredAudit(req,'data.export','route',resource,{format:'xlsx',count});res.json({success:true});
});
router.post('/data',async(req,res)=>{
 if(!req.authorization)return res.status(401).json({message:'กรุณาเข้าสู่ระบบ'});
 const {sources,include_insights=false}=req.body||{};
 if(!Array.isArray(sources)||!sources.length||sources.length>40||typeof include_insights!=='boolean')return res.status(422).json({message:'คำขอส่งออกไม่ถูกต้อง'});
 if(typeof req.organizationContext==='number'){
  const [[org]]=await db.query('SELECT org_type FROM organizations WHERE id=?',[req.organizationContext]);
  if(org?.org_type==='school')req.schoolAccess=await loadSchoolAccess(db,req);
 }
 try{
  const sheets=[];
  for(const source of sources){let data=await collectSource(req,source,include_insights);if(source.resource==="role_permissions")data=data.map(permission=>({role_id:source.id,permission}));sheets.push({resource:source.resource,id:source.id,data});}
  const display=await require('../services/exportDisplayContext').exportDisplayContext(req,sheets);
  for(const sheet of sheets)sheet.display=display;
  const count=sheets.reduce((n,s)=>n+(Array.isArray(s.data)?s.data.length:1),0);
  await requiredAudit(req,'data.export','route','excel',{format:'xlsx',count,resources:sources.map(s=>s.resource),include_insights});
  res.set('Cache-Control','no-store');res.json({sheets});
 }catch(e){res.status(e.status||503).json({message:e.status?e.message:'ส่งออกไม่สำเร็จ กรุณาลองใหม่'});}
});
module.exports=router;
