import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { mockAdminApi } from './helpers/api-mocks';

test.use({ reducedMotion: 'reduce' });

async function setup(page) {
  await mockAdminApi(page);
  await page.addInitScript(() => {
    document.cookie = 'suth_staff_session=synthetic; path=/';
    localStorage.setItem('suth_active_organization_1','1');
  });
  await page.route('**/api/**',route => {
    const path = new URL(route.request().url()).pathname.replace(/^\/api/,'');
    if(path==='/me/authorization') return route.fulfill({json:{user:{id:1,username:'synthetic',role_id:1},is_system_admin:true,organizations:[
      {id:1,name:'โรงพยาบาลสาธิต',org_type:'hospital',org_level:'unit'},
      {id:3,name:'โรงเรียนสาธิต',org_type:'school',org_level:'unit'}],memberships:[]}});
    if(path==='/school/access')return route.fulfill({json:{can_view_school:true,can_create_school:true,can_update_school:true,can_manage_staff:true,can_view_students:true,can_view_health:true}});
    if(path.startsWith('/school/'))return route.fulfill({json:[]});
    if(path==='/master-data/categories')return route.fulfill({json:{can_manage:true,categories:[{code:'prefix',label:'คำนำหน้า',fields:['label']}]}});
    if(path==='/master-data/prefix')return route.fulfill({json:[{id:1,code:'demo',label:'รายการสาธิต',is_active:true,sort_order:1}]});
    if(path==='/me/profile')return route.fulfill({json:{id:1,username:'synthetic',name:'ผู้ดูแลสาธิต',email:'demo@example.test',status:'active'}});
    if(path==='/dashboard/forms'||path==='/organizations'||path==='/members'||path==='/patient-members')return route.fulfill({json:[]});
    return route.fallback();
  });
}

test('shared components stay consistent across real admin workspaces',async({page},testInfo)=>{
  test.setTimeout(180_000);await setup(page);
  const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(e.message));
  const inventory=[];
  for(const route of ['dashboard','cases','risk-cases','schedule','forms','clinics','users','help-center','master-data','organizations','roles','banner','profile','school/types']){
    await page.goto('/admin/'+route);
    const header=page.locator('.suth-page-header');await expect(header.first()).toBeVisible();
    // Audit the settled UI, including delayed legacy entrance animations.
    await page.evaluate(async () => {
      const finite = document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity);
      await Promise.allSettled(finite.map(animation => animation.finished));
    });
    await expect(header.locator('h1,h2').first()).toHaveCSS('font-size','24px');
    if(testInfo.project.name==='mobile-chromium'&&['clinics','dashboard'].includes(route))
      expect((await header.boundingBox()).height).toBeLessThan(route==='clinics'?260:500);
    const button=page.locator('.suth-button:visible').first();
    if(await button.count()){
      await expect(button).toHaveCSS('border-radius','10px');
      await expect(button).toHaveCSS('min-height','44px');
      await expect(button).toHaveCSS('box-shadow','none');
      expect(await button.evaluate(el=>getComputedStyle(el).fontFamily)).toContain('Sarabun');
    }
    const primary=page.locator('.suth-button--primary:visible').first();
    if(await primary.count())await expect(primary).toHaveCSS('background-color','rgb(196, 84, 40)');
    if(route==='clinics')await expect(page.getByText('ไม่พบข้อมูลคลินิก',{exact:true})).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const audit=await new AxeBuilder({page}).include('.admin-shell').withTags(['wcag2a','wcag2aa']).analyze();
    inventory.push({route,violations:audit.violations.map(({id,impact,nodes})=>({id,impact,targets:nodes.map(n=>n.target)}))});
    if(['dashboard','clinics','forms','school/types'].includes(route)) await page.screenshot({path:`../outputs/component-unification/${route.replace('/','-')}-${testInfo.project.name}.png`});
  }
  expect(runtimeErrors).toEqual([]);
  await writeFile(`../outputs/component-unification/audit-${testInfo.project.name}.json`,JSON.stringify(inventory,null,2));
  expect(inventory.filter(item=>item.violations.length)).toEqual([]);
});

test('clinic dialog shares input and keyboard behavior with school dialogs',async({page})=>{
  await setup(page);await page.goto('/admin/clinics');
  const opener=page.getByRole('button',{name:'เพิ่มคลินิกใหม่',exact:true});await opener.click();
  const dialog=page.getByRole('dialog',{name:'เพิ่มคลินิก',exact:true});await expect(dialog).toBeVisible();
  const field=dialog.getByRole('textbox',{name:'รหัสอ้างอิง (Slug)',exact:false});
  await expect(field).toHaveCSS('border-radius','10px');await field.fill('synthetic-clinic');
  await dialog.getByRole('textbox',{name:'ชื่อคลินิก (ภาษาไทย)',exact:false}).fill('คลินิกสาธิต');
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(opener).toBeFocused();
});

test('shared school dialog validates, traps focus, and returns to its opener',async({page})=>{
  await setup(page);await page.goto('/admin/school/types');
  const opener=page.getByRole('button',{name:'เพิ่มประเภทครู',exact:true});await opener.click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  const name=dialog.getByRole('textbox',{name:/^ชื่อ/});await expect(name).toBeFocused();
  await expect(name).toHaveCSS('border-radius','10px');
  await dialog.getByRole('button',{name:'บันทึก',exact:true}).click();
  await expect(dialog).toBeVisible();await expect(name).toHaveAttribute('aria-invalid','true');
  await name.fill('ประเภทตัวอย่าง');
  const close=dialog.getByRole('button',{name:'ปิดหน้าต่าง'});
  await close.focus();await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');await expect(dialog).toBeHidden();await expect(opener).toBeFocused();
});
