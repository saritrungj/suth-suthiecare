import { mockAdminApi, mockPublicApi } from './api-mocks.js';

export const demoForm = {
  id:101,title:'แบบประเมินสุขภาพและการติดตามสำหรับบุคคลตัวอย่าง',description:'ข้อมูลสาธิตสำหรับตรวจการจัดวางและการใช้งาน',
  clinic_type:'general',status:'published',theme:{},questions:[],
};
const patient={id:1,username:'layout-demo',display_name:'บุคคลตัวอย่างสำหรับทดสอบการจัดวาง',status:'active',email:'demo@example.test',email_verified:true};
const schools=[{id:1,name:'โรงเรียนสาธิตสำหรับการตรวจรูปแบบหน้าจอ',code:'DEMO',status:'active',student_count:0,classroom_count:0,teacher_count:0}];

export async function mockResponsiveApi(page, { organizationId = 1 } = {}) {
  await mockPublicApi(page);await mockAdminApi(page);
  await page.addInitScript(({patient, organizationId})=>{
    localStorage.setItem('i18nextLng','th');
    localStorage.setItem('suth_active_organization_1',String(organizationId));
    sessionStorage.removeItem('patient_user');sessionStorage.removeItem('suth_user');
    if(location.pathname.startsWith('/admin')) sessionStorage.setItem('suth_user',JSON.stringify({id:1,username:'layout-admin',role_id:1}));
    if(document.cookie.includes('suth_patient_session='))sessionStorage.setItem('patient_user',JSON.stringify(patient));
    if(location.pathname==='/assessment-result')history.replaceState({usr:{formId:101,isSaved:true,results:[{score:3,label:'ระดับปกติสำหรับข้อมูลสาธิต',color:'#17663a',advice:'ข้อมูลสาธิตสำหรับตรวจข้อความยาวและการแสดงผลบนหน้าจอขนาดเล็ก'}]},key:'layout',idx:0},'',location.href);
    if(location.pathname==='/clinic-detail')history.replaceState({usr:{clinicType:'behavior',masterCase:{id:1},responses:[],bmiRecords:[],timelineEvents:[]},key:'layout',idx:0},'',location.href);
  },{patient,organizationId});
  await page.route('**/api/**',route=>{
    const req=route.request(),p=new URL(req.url()).pathname.replace(/^\/api/,'');
    const send=json=>route.fulfill({json});
    if(p==='/me/authorization')return send({user:{id:1,username:'layout-admin',role_id:1},is_system_admin:true,organizations:[{id:1,name:'โรงพยาบาลสาธิต',org_type:'hospital',org_level:'unit'},{id:3,name:'โรงเรียนสาธิต',org_type:'school',org_level:'unit'}],memberships:[]});
    if(p==='/session/patient')return req.headers().cookie?.includes('suth_patient_session=')?send({user:patient,csrf_token:'synthetic'}):route.fulfill({status:401,json:{}});
    if(p==='/school/access')return send({can_view_school:true,can_create_school:true,can_update_school:true,can_delete_school:true,can_manage_staff:true,can_view_students:true,can_create_students:true,can_manage_students:true,can_import_students:true,can_export_students:true,can_view_health:true,can_update_health:true});
    if(p==='/school/schools')return send(schools);
    if(p==='/school/students')return send({data:[],pagination:{page:1,total:0,total_pages:1,limit:20}});
    if(p==='/school/staff-roles')return send({schools,members:[],roles:[],guardians:[],students:[],role_labels:{other:'เจ้าหน้าที่'}});
    if(p==='/school/dashboard')return send({total:0,counts:{high:0,medium:0,normal:0,none:0},classrooms:[]});
    if(p.startsWith('/school/'))return send([]);
    if(p==='/patient/history')return send({success:true,profile:patient,identity_masked:'DEMO-****',masterCases:[],responses:[]});
    if(p==='/me/profile')return send({...patient,name:'ผู้ดูแลสาธิต'});
    if(p==='/master-data/categories')return send({can_manage:true,categories:[{code:'prefix',label:'คำนำหน้า',fields:['label']}]});
    if(p.startsWith('/master-data/'))return send([{id:1,code:'demo',label:'รายการข้อมูลสาธิตที่มีข้อความยาวสำหรับตรวจการจัดวาง',is_active:true,sort_order:1}]);
    if(p==='/forms/101')return send(demoForm);
    if(p==='/forms')return send([demoForm]);
    if(p==='/clinics')return send({data:[{id:1,slug:'general',name:'คลินิกสาธิตสำหรับตรวจรูปแบบและการจัดวาง',is_active:true,sort_order:1}]});
    if(p==='/clinics/1')return send({id:1,name:'คลินิกสาธิต',description:'ข้อมูลสาธิต',slug:'general'});
    if(['/dashboard/forms','/organizations','/members','/patient-members','/roles','/users','/all-cases','/appointments','/banners'].includes(p))return send([]);
    return route.fallback();
  });
}

export async function setRouteSession(page,path,baseURL) {
  await page.context().clearCookies();
  const name=path.startsWith('/admin')?'suth_staff_session':/^\/(history|clinic-detail|assessment\/|account\/(change-password|verify-email))/.test(path)?'suth_patient_session':null;
  if(name)await page.context().addCookies([{name,value:'synthetic-layout',url:baseURL}]);
}
