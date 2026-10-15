import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {mockResponsiveApi,setRouteSession} from './helpers/responsive-fixtures.js';
const runtimeFailures=new WeakMap();

test.beforeEach(async({page})=>{
  const errors=[];runtimeFailures.set(page,errors);
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&message.text().startsWith('Application render error:'))errors.push(message.text());});
  await mockResponsiveApi(page);
  await mkdir('../outputs/interface-consistency',{recursive:true});
test.afterEach(async({page})=>{expect(runtimeFailures.get(page)).toEqual([]);});
  await page.route('**/api/clinics/all',route=>route.fulfill({json:{data:[{id:1,name:'คลินิกสาธิต',slug:'general',show_in_help_center:1}]}}));
});
async function openRoute(page,baseURL,path){await setRouteSession(page,path,baseURL);await page.goto(path,{waitUntil:'domcontentloaded'});await expect(page.locator('.suth-page-header,.sfb-builder-header').first()).toBeVisible();}
async function navigate(page,path){
  if(page.viewportSize().width<=1024)await page.locator('.mobile-hamburger-btn').click();
  await page.locator(`.sidebar a[href="${path}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(path+'$'));
  await expect(page.locator('.suth-page-header')).toBeVisible();
}
async function fits(dialog,page){
  const box=await dialog.boundingBox(),viewport=page.viewportSize();
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(viewport.width+1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+1);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
}

test('styles and alignment survive switching through real menus',async({page,baseURL})=>{
  await openRoute(page,baseURL,'/admin/clinics');
  const metrics=()=>page.locator('.cm-btn-edit').first().evaluate(el=>{
    const s=getComputedStyle(el);return {display:s.display,font:s.fontFamily,height:el.getBoundingClientRect().height,radius:s.borderRadius,padding:s.padding,opacity:s.opacity};
  });
  const before=await metrics();
  await navigate(page,'/admin/help-center');await navigate(page,'/admin/risk-cases');
  await navigate(page,'/admin/dashboard');await navigate(page,'/admin/clinics');
  expect(await metrics()).toEqual(before);
  const primary=page.locator('.cm-btn-add');
  await page.keyboard.press('Tab');await primary.focus();await expect(primary).toHaveCSS('outline-style','solid');
  const idle=await primary.evaluate(el=>getComputedStyle(el).backgroundColor);
  await primary.hover();await expect(primary).toHaveCSS('background-color','rgb(169, 67, 32)');
  expect(idle).toBe('rgb(196, 84, 40)');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('management dialogs share focus, close placement, scrolling and focus return',async({page,baseURL},info)=>{
  test.setTimeout(90_000);
  const scenarios=[
    ['/admin/users','เพิ่มผู้ใช้งาน','เพิ่มผู้ใช้งาน'],
    ['/admin/banner','เพิ่มแบนเนอร์ใหม่','เพิ่มแบนเนอร์ใหม่'],
    ['/admin/help-center','จัดการหมวดหมู่ย่อย','จัดการหมวดหมู่คำถามย่อย'],
    ['/admin/help-center','เพิ่มคำถามใหม่','เพิ่มข้อคำถามใหม่'],
    ['/admin/help-center','ตั้งค่าคลินิกหน้าช่วยเหลือ','ตั้งค่าการแสดงผลคลินิกบนหน้าช่วยเหลือ'],
  ];
  for(const [path,button,title]of scenarios){
    await openRoute(page,baseURL,path);
    const opener=page.getByRole('button',{name:button,exact:true});await opener.click();
    const dialog=page.getByRole('dialog',{name:title,exact:true});await expect(dialog).toBeVisible();
    await fits(dialog,page);expect(await page.locator('#root').evaluate(el=>el.inert)).toBe(true);
    expect(await dialog.evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Sarabun');
    const close=dialog.getByRole('button',{name:'ปิดหน้าต่าง',exact:true});
    await expect(close).toBeInViewport();expect((await close.boundingBox()).height).toBeGreaterThanOrEqual(44);
    await close.focus();await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
    if(['/admin/users','/admin/banner'].includes(path)||button==='เพิ่มคำถามใหม่')await page.screenshot({path:`../outputs/interface-consistency/modal-${path.split('/').at(-1)}-${info.project.name}.png`});
    await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(opener).toBeFocused();
    expect(await page.locator('#root').evaluate(el=>el.inert)).toBe(false);
  }
});

test('a failed staff save preserves the form and opens a reachable confirmation above it',async({page,baseURL})=>{
  let saves=0;
  await page.route('**/api/users',async route=>{
    if(route.request().method()!=='POST')return route.fallback();
    saves++;await new Promise(resolve=>setTimeout(resolve,800));
    return route.fulfill({status:500,json:{message:'ข้อมูลสาธิต: บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'}});
  });
  await openRoute(page,baseURL,'/admin/users');await page.getByRole('button',{name:'เพิ่มผู้ใช้งาน',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'เพิ่มผู้ใช้งาน',exact:true});
  await dialog.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();
  await expect(dialog.getByLabel('ชื่อผู้ใช้งาน (Username)',{exact:true})).toHaveAttribute('aria-invalid','true');
  await dialog.getByLabel('ชื่อผู้ใช้งาน (Username)',{exact:true}).fill('synthetic-user');
  await dialog.getByLabel('รหัสผ่าน',{exact:true}).fill('SuthieCare!234');
  await dialog.getByLabel('ชื่อ - นามสกุล',{exact:true}).fill('บุคคลสาธิต');
  await dialog.getByLabel('อีเมล',{exact:true}).fill('synthetic@example.test');
  await dialog.getByRole('button',{name:'บันทึกข้อมูล',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'บันทึกข้อมูล',exact:true})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  const alert=page.locator('.swal2-popup');await expect(alert).toBeVisible();
  const confirm=alert.locator('.swal2-confirm');
  await expect(confirm).toHaveCSS('background-color','rgb(196, 84, 40)');
  expect(await confirm.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  await confirm.click();await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('ชื่อ - นามสกุล',{exact:true})).toHaveValue('บุคคลสาธิต');
  expect(saves).toBe(1);
});

test('dropdowns inside dialogs stay anchored and Escape closes only the dropdown',async({page,baseURL})=>{
  await openRoute(page,baseURL,'/admin/users');await page.getByRole('button',{name:'เพิ่มผู้ใช้งาน',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'เพิ่มผู้ใช้งาน',exact:true}),select=dialog.getByRole('combobox',{name:'ระดับสิทธิ์ (Role)',exact:true});
  await select.click();const search=page.getByRole('combobox',{name:'ค้นหาระดับสิทธิ์ (Role)'});await expect(search).toBeFocused();
  const menu=page.locator('.searchable-select-menu');await fits(menu,page);
  const triggerBox=await select.boundingBox(),menuBox=await menu.boundingBox();
  expect(Math.min(Math.abs(menuBox.y-triggerBox.y-triggerBox.height),Math.abs(menuBox.y+menuBox.height-triggerBox.y))).toBeLessThanOrEqual(12);
  await search.fill('Staff');await search.press('Enter');await expect(select).toHaveValue('3');await expect(select).toBeFocused();
  await select.click();await search.press('Escape');await expect(menu).toHaveCount(0);await expect(dialog).toBeVisible();await expect(select).toBeFocused();
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
});

test('default assessment and editor use the brand while an authored theme is preserved',async({page,baseURL})=>{
  await setRouteSession(page,'/assessment/101',baseURL);await page.goto('/assessment/101');
  await expect(page.locator('.preview-form')).toBeVisible();
  await expect(page.getByRole('button',{name:'ส่งคำตอบ',exact:true})).toHaveCSS('background-color','rgb(196, 84, 40)');
  await openRoute(page,baseURL,'/admin/forms/create');
  expect(await page.locator('.sfb-main-container').evaluate(el=>getComputedStyle(el).getPropertyValue('--theme-color').trim())).toBe('#c45428');
  await page.route('**/api/forms/101',route=>route.fulfill({json:{id:101,title:'แบบประเมินสาธิตที่กำหนดธีมเอง',theme:{color:'#17663a'},questions:[]}}));
  await setRouteSession(page,'/assessment/101',baseURL);await page.goto('/assessment/101');
  await expect(page.getByRole('button',{name:'ส่งคำตอบ',exact:true})).toHaveCSS('background-color','rgb(23, 102, 58)');
});

test('banner upload is keyboard accessible and the cropped preview fits a narrow modal',async({page,baseURL},info)=>{
  await openRoute(page,baseURL,'/admin/banner');await page.getByRole('button',{name:'เพิ่มแบนเนอร์ใหม่',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'เพิ่มแบนเนอร์ใหม่'});

test('a case confirmation owns focus and Escape returns to the still-open case drawer',async({page,baseURL})=>{
  const row={id:101,first_name:'บุคคลสาธิต',person_id:7,master_case_id:10,form_id:101,form_title:'แบบประเมินสาธิต',clinic_type:'general',status:'รอติดต่อ (รอดำเนินการ)',submitted_at:'2026-10-15T09:00:00+07:00',summary_data:{display_name:'บุคคลสาธิต',raw_answers:{}}};
  await page.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname.replace(/^\/api/,'');
    if(path==='/all-cases'||path.startsWith('/forms/101/responses'))return route.fulfill({json:[row]});

test('question option actions are discoverable with touch and keyboard without overflowing',async({page,baseURL},info)=>{
  await page.route('**/api/forms/101',route=>route.fulfill({json:{id:101,title:'แบบประเมินสาธิต',theme:{},questions:[{id:'q-layout',type:'multiple_choice',title:'คำถามตัวอย่างที่มีตัวเลือก',options:['ตัวเลือกสำหรับตรวจข้อความยาวบนหน้าจอเล็ก','ตัวเลือกที่สอง'],required:false}]}}));
  await openRoute(page,baseURL,'/admin/forms/edit/101');
  const card=page.locator('.sfb-question-card').first();await card.click();
  const option=card.locator('.sfb-opt-input').first();await option.focus();
  const remove=card.getByRole('button',{name:'ลบตัวเลือก 1',exact:true});
  await expect(remove).toHaveCSS('opacity','1');
  if(info.project.name!=='desktop'){
    expect((await option.boundingBox()).width).toBeGreaterThanOrEqual(160);
    expect((await remove.boundingBox()).width).toBeGreaterThanOrEqual(44);
    const tool=await page.locator('.sfb-floating-toolbar > button').first().boundingBox();
    expect(tool.width).toBeGreaterThanOrEqual(44);expect(tool.height).toBeGreaterThanOrEqual(44);
  }
  expect(await card.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await remove.click();await expect(card.locator('.sfb-opt-input')).toHaveCount(1);
  await page.screenshot({path:`../outputs/interface-consistency/builder-options-${info.project.name}.png`});
});
    if(path==='/master-cases/by-id/10')return route.fulfill({json:{masterCases:[{id:10,status:'Open'}],responses:[row]}});
    if(path.endsWith('/person-timeline'))return route.fulfill({json:{responses:[row]}});
    if(/\/(staffs|status-options|case-statuses|services|note-templates|templates|answers|logs|appointments)$/.test(path))return route.fulfill({json:[]});
    return route.fallback();
  });
  await openRoute(page,baseURL,'/admin/cases');
  const opener=page.locator('.cw-person-open').first();await opener.click();
  const drawer=page.locator('.cw-drawer');await expect(drawer).toBeVisible();
  await drawer.getByRole('button',{name:'จัดการเคส',exact:true}).click();
  await drawer.getByRole('button',{name:'สิ้นสุดการรักษา (ปิดเคส)',exact:true}).click();
  const confirmation=page.getByRole('dialog',{name:'ยืนยันสิ้นสุดการรักษา',exact:true});await expect(confirmation).toBeVisible();await fits(confirmation,page);
  expect(await page.locator('.cw-drawer-overlay').evaluate(el=>el.inert)).toBe(true);
  await page.keyboard.press('Escape');await expect(confirmation).toHaveCount(0);await expect(drawer).toBeVisible();
  expect(await drawer.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  expect(await page.locator('#root').evaluate(el=>el.inert)).toBe(true);
  await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await expect(opener).toBeFocused();
});
  const picker=dialog.getByLabel('เลือกรูปภาพแบนเนอร์',{exact:true});
  await expect(picker).toBeFocused();
  const choose=page.waitForEvent('filechooser');await picker.press('Enter');
  await (await choose).setFiles({name:'synthetic-banner.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#fff4ec"/><rect x="160" y="120" width="480" height="360" rx="24" fill="#c45428"/></svg>')});
  const crop=dialog.getByRole('button',{name:'ยืนยันการตัดรูป',exact:true});await expect(crop).toBeEnabled();await crop.click();
  await expect(dialog.locator('img[alt="cropped"]')).toBeVisible();await fits(dialog,page);
  await expect(dialog.getByLabel('ชื่อแบนเนอร์:')).toBeVisible();
  await expect(dialog.getByRole('button',{name:'บันทึกแบนเนอร์',exact:true})).toBeEnabled();
  await page.screenshot({path:`../outputs/interface-consistency/cropped-banner-${info.project.name}.png`});
});
